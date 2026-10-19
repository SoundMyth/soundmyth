/**
 * SoundMyth – Run Report
 *
 * Summarises a pipeline run and emails it via Brevo's transactional API.
 *
 * Reads the outcome of every step from STEP_OUTCOMES (JSON the workflow builds
 * from `steps.<id>.outcome`) and the resulting data straight from Supabase, so
 * it never has to parse scraper logs. created_at / updated_at are what make the
 * "written this run" figures possible.
 *
 * Per-step stats come from data/run-stats.json (dedupe, validate, purge, festivals) and
 * double bookings from data/conflicts.json. Both are only shown when written at/after
 * RUN_STARTED, so a step that died this week cannot leak last week's numbers.
 *
 * If the email can't be sent (missing BREVO_API_KEY / NOTIFY_EMAIL, or Brevo rejects it)
 * it still prints the report but exits 1, so the step shows as failed in Actions instead
 * of a silent green tick. The workflow runs it with continue-on-error, so the run itself
 * is never failed by the report.
 *
 * Usage: node steps/17-report.js
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { todayISO, addDaysISO } from '../lib/normalize.js';
import { loadEnv } from '../lib/db.js';
import { readRunStats } from '../lib/run-stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv();

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY;
const API_KEY = process.env.BREVO_API_KEY;
const TO      = process.env.NOTIFY_EMAIL;
const FROM    = process.env.NOTIFY_FROM || TO;

const RUN_URL     = process.env.RUN_URL     || '';
const RUN_NUMBER  = process.env.RUN_NUMBER  || '?';
const RUN_STARTED = process.env.RUN_STARTED || '';

if (!SB_URL || !SB_KEY) { console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1); }

const TODAY = todayISO();
// Fall back to 3h ago: long enough to cover a full run, short enough that it
// can't capture the previous week's writes.
const since = RUN_STARTED || new Date(Date.now() - 3 * 3600_000).toISOString();

const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

let failedQueries = 0;

/** Row count for a filter, via PostgREST's exact-count header. Never throws:
 *  the report matters most when Supabase is down, so a rejected fetch here must
 *  not abort the very report that would have told you so. */
async function count(query) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/events?select=id&${query}`, {
      headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
      signal: AbortSignal.timeout(30_000),
    });
    const range = res.headers.get('content-range');
    const total = range ? Number(range.split('/')[1]) : NaN;
    if (Number.isFinite(total)) return total;
  } catch { /* falls through */ }
  failedQueries++;
  return null;
}

/** A stats section counts only if this run wrote it (or no run boundary is known). */
function fresh(section) {
  if (!section) return null;
  if (!RUN_STARTED || !section.generated) return section;
  return section.generated >= RUN_STARTED ? section : null;
}

function readConflicts() {
  const p = resolve(__dirname, '../data/conflicts.json');
  try {
    const c = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
    return fresh(c);
  } catch { return null; }
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

async function main() {
  const outcomes = JSON.parse(process.env.STEP_OUTCOMES || '{}');
  const failed   = Object.entries(outcomes).filter(([, v]) => v && v !== 'success');

  const stats     = readRunStats();
  const validate  = fresh(stats.validate);
  const dedupe    = fresh(stats.dedupe);
  const purge     = fresh(stats.purge);
  const festivals = stats.festivals || null;    // written by discover-festivals (merge, not overwrite)
  const conflicts = readConflicts();

  // No "updated" figure: there is no trigger on the table, so updated_at always
  // equals created_at and it would just restate `created`. Past events are the
  // more telling number — they should only ever be the 8 days purge retains.
  const [total, created, past, noImg, noCity, week] = await Promise.all([
    count(`date=gte.${TODAY}`),
    count(`created_at=gte.${since}`),
    count(`date=lt.${TODAY}`),
    count(`date=gte.${TODAY}&or=(img_url.is.null,img_url.eq.)`),
    count(`date=gte.${TODAY}&or=(city.is.null,city.eq.)`),
    count(`date=gte.${TODAY}&date=lte.${addDaysISO(TODAY, 7)}`),
  ]);

  const sources = {};
  for (const src of ['songkick', 'ra', 'bandsintown', 'website', 'direct']) {
    sources[src] = await count(`date=gte.${TODAY}&source=eq.${src}`);
  }

  // Supabase unreachable is the failure that used to hide behind a green run.
  // failedQueries catches partial degradation too: the totals can answer while the
  // per-source queries time out, which must not read as a clean run.
  const broken = total === null;
  const ok     = !broken && !failed.length && !failedQueries && total > 100;
  const status = broken ? '🔴 sin conexión a Supabase' : ok ? '✅ correcto' : '⚠️ con incidencias';
  // The subject counts likely errors only. Possible double-headers are in the body.
  const nLikely = conflicts ? conflicts.likelyErrors : null;
  const conflictTag = nLikely ? ` · ⚠️ ${nLikely} likely error${nLikely === 1 ? '' : 's'}` : '';

  const rows = [
    ['Eventos futuros en BD', total ?? 'inaccesible'],
    ['Nuevos en este run', created ?? '?'],
    ['En los próximos 7 días', week ?? '?'],
    ['Pasados sin purgar (8 días)', past ?? '?'],
    ['Sin imagen', noImg ?? '?'],
    ['Sin ciudad', noCity ?? '?'],
  ];

  // Validation / dedupe / purge figures (only when this run wrote them)
  const runRows = [];
  if (validate) {
    runRows.push(
      ['Blocked by you', validate.blocked ?? 0],
      ['Descartados: sin ciudad/país', validate.droppedNoGeo],
      ['Descartados: fecha fuera de rango', validate.droppedDate],
      ['Descartados: web legacy', validate.droppedLegacyWebsite],
      ['Ciudades normalizadas', validate.cityCanonicalized],
      ['Ciudades rellenadas desde club', validate.cityFromVenue],
      ['Países rellenados', validate.countryFilled],
      ['Listas de DJs limpiadas', validate.djListsCleaned],
      ['Flags geo (revisar)', (validate.geoFlags?.hubMismatchCount || 0) + (validate.geoFlags?.multiCountryCount || 0)],
    );
  }
  if (dedupe) {
    runRows.push(
      ['Fragmentos de festival unidos', dedupe.fragmentsMerged ?? '?'],
      ['Dobles reservas: posibles errores', dedupe.likelyErrors ?? '?'],
      ['Dobles reservas: posibles doble sesión', dedupe.possibleDoubleHeaders ?? '?'],
    );
  }
  if (purge) runRows.push(['Purgados (retención 8 días)', purge.deleted]);

  // ── Double bookings (data/conflicts.json, written by dedupe Pass 6, detection only) ──
  // Likely errors: one event per block of each pair, with its source_id for events_block.json.
  // Possible double-headers: one compact line per pair, capped.
  const pairs = conflicts?.conflicts || [];
  const LIKELY = pairs.filter(p => p.category === 'likely-error');
  const DOUBLE = pairs.filter(p => p.category === 'possible-double-header');
  const DOUBLE_LIMIT = 15;
  const BLOCK_HINT = 'to block one, add its source_id to scraper/data/events_block.json';
  const where = e => [e.city, e.country].filter(Boolean).join(', ');
  const linkOf = e => e.ticket_url || 'sin link';

  const festLines = festivals
    ? [
        `New festivals added this week: ${(festivals.added || []).length}`,
        ...(festivals.added || []).slice(0, 20).map(n => `  + ${n}`),
        `Pending festival candidates: ${festivals.candidates ?? 0}`,
      ]
    : [];

  const text = [
    `SoundMyth · run #${RUN_NUMBER} · ${status}${conflictTag}`,
    '',
    ...rows.map(([k, v]) => `  ${String(k).padEnd(28)}${v}`),
    '',
    '  Por fuente:',
    ...Object.entries(sources).map(([k, v]) => `    ${k.padEnd(22)}${v ?? '?'}`),
    ...(runRows.length ? ['', '  Limpieza de este run:', ...runRows.map(([k, v]) => `    ${String(k).padEnd(34)}${v ?? '?'}`)] : []),
    ...(festLines.length ? ['', ...festLines] : []),
    '',
    `⚠️ Likely errors to review${conflicts ? ` (${LIKELY.length})` : ''}`,
    ...(conflicts === null
      ? ['  (no generado en este run — dedupe no terminó)']
      : LIKELY.length === 0
        ? ['  ✅ Ninguno']
        : [`  ${BLOCK_HINT}`, ...LIKELY.flatMap((p, i) => [
            '',
            `  ${i + 1}. ${p.dj} · ${p.date}`,
            ...[p.a, p.b].flatMap(e => [
              `     · ${e.name} · ${where(e)} · ${e.date}`,
              `       ${linkOf(e)}`,
              `       source_id: \`${e.source_id}\``,
            ]),
          ])]),
    '',
    `Possible double-headers${conflicts ? ` (${DOUBLE.length})` : ''}`,
    ...(conflicts === null
      ? []
      : DOUBLE.length === 0
        ? ['  Ninguno']
        : DOUBLE.slice(0, DOUBLE_LIMIT).map(p => `  · ${p.dj} · ${p.date} · ${p.a.city} / ${p.b.city}${p.a.country ? ' · ' + p.a.country : ''}`)
            .concat(DOUBLE.length > DOUBLE_LIMIT ? [`  … and ${DOUBLE.length - DOUBLE_LIMIT} more in data/conflicts.json`] : [])),
    ...(conflicts ? ['', `Festival appearances ignored: ${conflicts.ignoredFestival ?? 0}`] : []),
    '',
    failed.length
      ? `  Steps con fallo (${failed.length}): ${failed.map(([k, v]) => `${k} → ${v}`).join(', ')}`
      : `  Steps: los ${Object.keys(outcomes).length} correctos`,
    '',
    RUN_URL,
  ].join('\n');

  console.log(text);

  if (!API_KEY || !TO) {
    console.error('\n❌  BREVO_API_KEY o NOTIFY_EMAIL sin definir — informe no enviado. Añádelos en Settings → Secrets and variables → Actions.');
    process.exitCode = 1;
    return;
  }

  const td = 'padding:4px 10px;border-bottom:1px solid #eee;';
  const block = 'border:1px solid #eee;border-radius:8px;padding:10px 12px;margin:8px 0;font-size:14px;word-break:break-word;';
  const mono  = 'font-family:Menlo,Consolas,monospace;font-size:12px;background:#f4f4f4;padding:1px 4px;border-radius:4px;word-break:break-all;';
  const link = u => u ? `<a href="${esc(u)}">entradas</a>` : '<span style="color:#999">sin link</span>';

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">SoundMyth · run #${RUN_NUMBER}</h2>
      <p style="margin:0 0 16px;font-size:18px">${status}${conflictTag ? `<br><span style="font-size:15px">${esc(conflictTag.replace(' · ', ''))}</span>` : ''}</p>
      <table style="border-collapse:collapse;font-size:14px;width:100%">
        ${rows.map(([k, v]) => `<tr><td style="${td}">${esc(k)}</td><td style="${td}text-align:right"><b>${esc(v)}</b></td></tr>`).join('')}
      </table>
      <h3 style="margin:20px 0 4px;font-size:14px">Eventos futuros por fuente</h3>
      <table style="border-collapse:collapse;font-size:14px;width:100%">
        ${Object.entries(sources).map(([k, v]) => `<tr><td style="${td}">${k}</td><td style="${td}text-align:right">${v ?? '?'}</td></tr>`).join('')}
      </table>
      ${runRows.length ? `
      <h3 style="margin:20px 0 4px;font-size:14px">Limpieza de este run</h3>
      <table style="border-collapse:collapse;font-size:14px;width:100%">
        ${runRows.map(([k, v]) => `<tr><td style="${td}">${esc(k)}</td><td style="${td}text-align:right">${esc(v ?? '?')}</td></tr>`).join('')}
      </table>` : ''}
      ${festivals ? `
      <h3 style="margin:20px 0 4px;font-size:14px">New festivals added this week</h3>
      <div style="${block}">${(festivals.added || []).length ? (festivals.added || []).slice(0, 20).map(n => esc(n)).join('<br>') : 'Ninguno'}
        <div style="margin-top:6px;color:#555">Pending festival candidates: <b>${esc(festivals.candidates ?? 0)}</b></div></div>` : ''}
      <h3 style="margin:20px 0 4px;font-size:14px">⚠️ Likely errors to review${conflicts ? ` (${LIKELY.length})` : ''}</h3>
      ${conflicts === null
        ? `<div style="${block}">No generado en este run (dedupe no terminó).</div>`
        : LIKELY.length === 0
          ? `<div style="${block}">✅ Ninguno</div>`
          : `<p style="font-size:13px;color:#555;margin:4px 0">To block one, add its <code style="${mono}">source_id</code> to <code style="${mono}">scraper/data/events_block.json</code>.</p>` +
            LIKELY.map((p, i) => `
              <div style="${block}">
                <b>${i + 1}. ${esc(p.dj)} · ${esc(p.date)}</b>
                ${[p.a, p.b].map(e => `
                  <div style="margin-top:8px">${esc(e.name)}<br>
                    <span style="color:#555">${esc(where(e))} · ${esc(e.date)} · ${esc(e.source)} · ${link(e.ticket_url)}</span><br>
                    <code style="${mono}">${esc(e.source_id)}</code>
                  </div>`).join('')}
              </div>`).join('')}
      <h3 style="margin:20px 0 4px;font-size:14px">Possible double-headers${conflicts ? ` (${DOUBLE.length})` : ''}</h3>
      ${conflicts === null
        ? ''
        : DOUBLE.length === 0
          ? `<div style="${block}">Ninguno</div>`
          : `<ul style="margin:4px 0;padding-left:18px;font-size:14px;line-height:1.6">${DOUBLE.slice(0, DOUBLE_LIMIT).map(p => `<li>${esc(p.dj)} · ${esc(p.date)} · ${esc(p.a.city)} / ${esc(p.b.city)}${p.a.country ? ' · ' + esc(p.a.country) : ''}</li>`).join('')}</ul>`
            + (DOUBLE.length > DOUBLE_LIMIT ? `<p style="font-size:13px;color:#555">… and ${DOUBLE.length - DOUBLE_LIMIT} more in data/conflicts.json</p>` : '')}
      ${conflicts ? `<p style="font-size:13px;color:#555;margin:8px 0 0">Festival appearances ignored: <b>${esc(conflicts.ignoredFestival ?? 0)}</b></p>` : ''}
      <p style="font-size:14px;margin:20px 0 0">${
        failed.length
          ? `<b>Steps con fallo (${failed.length}):</b><br>` + failed.map(([k, v]) => `${esc(k)} → ${esc(v)}`).join('<br>')
          : `Los ${Object.keys(outcomes).length} steps terminaron correctamente.`
      }</p>
      ${RUN_URL ? `<p style="font-size:14px"><a href="${RUN_URL}">Ver el run completo en GitHub</a></p>` : ''}
    </div>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'SoundMyth', email: FROM },
      to: [{ email: TO }],
      subject: `SoundMyth · run #${RUN_NUMBER} · ${status}${conflictTag}`,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.ok) console.log(`\n📧  Informe enviado a ${TO}`);
  else {
    console.error(`\n❌  Brevo respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exitCode = 1;
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
