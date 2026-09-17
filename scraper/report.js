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
 * Degrades on purpose: with no BREVO_API_KEY it prints the report and exits 0,
 * so a missing secret never fails the run.
 *
 * Usage: node report.js
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY;
const API_KEY = process.env.BREVO_API_KEY;
const TO      = process.env.NOTIFY_EMAIL;
const FROM    = process.env.NOTIFY_FROM || TO;

const RUN_URL     = process.env.RUN_URL     || '';
const RUN_NUMBER  = process.env.RUN_NUMBER  || '?';
const RUN_STARTED = process.env.RUN_STARTED || '';

if (!SB_URL || !SB_KEY) { console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1); }

const TODAY = new Date().toISOString().split('T')[0];
// Fall back to 3h ago: long enough to cover a full run, short enough that it
// can't capture the previous week's writes.
const since = RUN_STARTED || new Date(Date.now() - 3 * 3600_000).toISOString();

const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

/** Row count for a filter, via PostgREST's exact-count header. */
async function count(query) {
  const res = await fetch(`${SB_URL}/rest/v1/events?select=id&${query}`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
    signal: AbortSignal.timeout(30_000),
  });
  const range = res.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : NaN;
  return Number.isFinite(total) ? total : null;
}

async function main() {
  const outcomes = JSON.parse(process.env.STEP_OUTCOMES || '{}');
  const failed   = Object.entries(outcomes).filter(([, v]) => v && v !== 'success');

  // No "updated" figure: there is no trigger on the table, so updated_at always
  // equals created_at and it would just restate `created`. Past events are the
  // more telling number — they should only ever be the 15 days purge retains.
  const [total, created, past, noImg, noCity, week] = await Promise.all([
    count(`date=gte.${TODAY}`),
    count(`created_at=gte.${since}`),
    count(`date=lt.${TODAY}`),
    count(`date=gte.${TODAY}&or=(img_url.is.null,img_url.eq.)`),
    count(`date=gte.${TODAY}&or=(city.is.null,city.eq.)`),
    count(`date=gte.${TODAY}&date=lte.${new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]}`),
  ]);

  const sources = {};
  for (const src of ['songkick', 'ra', 'bandsintown', 'website']) {
    sources[src] = await count(`date=gte.${TODAY}&source=eq.${src}`);
  }

  // Supabase unreachable is the failure that used to hide behind a green run.
  const broken = total === null;
  const ok     = !broken && !failed.length && total > 100;
  const status = broken ? '🔴 sin conexión a Supabase' : ok ? '✅ correcto' : '⚠️ con incidencias';

  const rows = [
    ['Eventos futuros en BD', total ?? 'inaccesible'],
    ['Nuevos en este run', created ?? '?'],
    ['En los próximos 7 días', week ?? '?'],
    ['Pasados sin purgar', past ?? '?'],
    ['Sin imagen', noImg ?? '?'],
    ['Sin ciudad', noCity ?? '?'],
  ];

  const text = [
    `SoundMyth · run #${RUN_NUMBER} · ${status}`,
    '',
    ...rows.map(([k, v]) => `  ${String(k).padEnd(24)}${v}`),
    '',
    '  Por fuente:',
    ...Object.entries(sources).map(([k, v]) => `    ${k.padEnd(22)}${v ?? '?'}`),
    '',
    failed.length
      ? `  Steps con fallo (${failed.length}): ${failed.map(([k, v]) => `${k} → ${v}`).join(', ')}`
      : `  Steps: los ${Object.keys(outcomes).length} correctos`,
    '',
    RUN_URL,
  ].join('\n');

  console.log(text);

  if (!API_KEY || !TO) {
    console.log('\n⚠️  BREVO_API_KEY o NOTIFY_EMAIL sin definir — informe no enviado.');
    return;
  }

  const td = 'padding:4px 10px;border-bottom:1px solid #eee;';
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">SoundMyth · run #${RUN_NUMBER}</h2>
      <p style="margin:0 0 16px;font-size:18px">${status}</p>
      <table style="border-collapse:collapse;font-size:14px;width:100%">
        ${rows.map(([k, v]) => `<tr><td style="${td}">${k}</td><td style="${td}text-align:right"><b>${v}</b></td></tr>`).join('')}
      </table>
      <h3 style="margin:20px 0 4px;font-size:14px">Eventos futuros por fuente</h3>
      <table style="border-collapse:collapse;font-size:14px;width:100%">
        ${Object.entries(sources).map(([k, v]) => `<tr><td style="${td}">${k}</td><td style="${td}text-align:right">${v ?? '?'}</td></tr>`).join('')}
      </table>
      <p style="font-size:14px;margin:20px 0 0">${
        failed.length
          ? `<b>Steps con fallo (${failed.length}):</b><br>` + failed.map(([k, v]) => `${k} → ${v}`).join('<br>')
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
      subject: `SoundMyth · run #${RUN_NUMBER} · ${status}`,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.ok) console.log(`\n📧  Informe enviado a ${TO}`);
  else console.error(`\n❌  Brevo respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
