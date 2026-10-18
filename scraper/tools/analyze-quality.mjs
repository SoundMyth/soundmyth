/**
 * Throwaway data-quality probe (read-only). Quantifies the issues reported:
 *  1) DJ names duplicated by case/diacritics
 *  2) near-duplicate events on the same city+date
 *  3) events with no image
 * Usage: node analyze-quality.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
// read the public anon URL+key straight from the frontend (read-only)
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const SB_URL = html.match(/SB_URL='([^']+)'/)[1];
const SB_KEY = html.match(/SB_KEY='([^']+)'/)[1];
const sb = createClient(SB_URL, SB_KEY, { auth:{persistSession:false} });
const today = new Date().toISOString().split('T')[0];
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
const normName = s => norm(s).replace(/[^a-z0-9]+/g,' ').trim();

let rows=[], from=0;
while(true){
  const{data,error}=await sb.from('events').select('id,name,city,country,date,djs,img_url,source,tags').gte('date',today).order('date').range(from,from+999);
  if(error){ console.error(error.message); process.exit(1); }
  rows=rows.concat(data); if(data.length<1000) break; from+=1000;
}
console.log(`\nFuture events: ${rows.length}\n`);

// ── 1) DJ case/diacritic duplicates ──
const byNorm={};
for(const e of rows) for(const dj of (e.djs||[])){ const k=norm(dj); if(!k) continue; (byNorm[k]=byNorm[k]||new Set()).add(dj); }
const dupDjs=Object.entries(byNorm).filter(([k,set])=>set.size>1);
const totalDistinctDisplay=Object.values(byNorm).reduce((a,s)=>a+s.size,0);
console.log(`── DJs ──`);
console.log(`distinct DJ display strings : ${totalDistinctDisplay}`);
console.log(`distinct DJ (normalized)    : ${Object.keys(byNorm).length}`);
console.log(`DJs with >1 spelling        : ${dupDjs.length}`);
dupDjs.sort((a,b)=>b[1].size-a[1].size).slice(0,15).forEach(([k,set])=>console.log(`   ${k}  →  ${[...set].map(x=>JSON.stringify(x)).join('  |  ')}`));

// ── 2) near-duplicate events same city+date ──
const groups={};
for(const e of rows){ const g=`${norm(e.city)}|${e.date}`; (groups[g]=groups[g]||[]).push(e); }
let dupClusters=0, dupExtra=0; const examples=[];
for(const [g,evs] of Object.entries(groups)){
  if(evs.length<2) continue;
  const used=new Array(evs.length).fill(false);
  for(let i=0;i<evs.length;i++){
    if(used[i]) continue;
    const cluster=[evs[i]]; const ni=normName(evs[i].name);
    for(let j=i+1;j<evs.length;j++){
      if(used[j]) continue;
      const nj=normName(evs[j].name);
      const ti=new Set(ni.split(' ')), tj=new Set(nj.split(' '));
      const inter=[...ti].filter(x=>tj.has(x)).length, uni=new Set([...ti,...tj]).size;
      const jac=uni?inter/uni:0;
      if(ni===nj || ni.includes(nj)||nj.includes(ni) || jac>=0.6){ cluster.push(evs[j]); used[j]=true; }
    }
    if(cluster.length>1){ dupClusters++; dupExtra+=cluster.length-1; if(examples.length<12) examples.push(cluster.map(e=>`${e.name} [${e.source}]`)); }
  }
}
console.log(`\n── Same city+date near-duplicate events ──`);
console.log(`duplicate clusters : ${dupClusters}`);
console.log(`redundant events   : ${dupExtra}`);
examples.forEach(c=>console.log(`   • ${c.join('   ||   ')}`));

// ── 3) missing images ──
const noImg=rows.filter(e=>!e.img_url);
const bySource={};
for(const e of noImg){ bySource[e.source||'?']=(bySource[e.source||'?']||0)+1; }
console.log(`\n── Images ──`);
console.log(`events without img_url : ${noImg.length} / ${rows.length} (${Math.round(noImg.length/rows.length*100)}%)`);
console.log(`   by source: ${Object.entries(bySource).sort((a,b)=>b[1]-a[1]).map(([s,n])=>`${s}:${n}`).join('  ')}`);

// ════ SIMULATE the new frontend canon + dedupe to validate before deploy ════
const djNorm=norm;
function normEventName(n){ const r=(n||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\([^)]*\)/g,' ').replace(/\b20\d{2}\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\b(festival|fest|openair|open air|the|at|presents|pres|edition|vol)\b/g,' ').replace(/\s+/g,' ').trim(); return r||(n||'').toLowerCase().trim(); }
function mergeInto(ex,ev){ for(const d of (ev.djs||[])) if(!ex.djs.some(x=>djNorm(x)===djNorm(d))) ex.djs.push(d); ex._merged=(ex._merged||[]).concat([ev.name]); }
function mergeBy(list,keyFn){ const m=new Map(); for(const ev of list){ const k=keyFn(ev); if(m.has(k)) mergeInto(m.get(k),ev); else m.set(k,{...ev,djs:[...(ev.djs||[])]}); } return [...m.values()]; }
function dedupeEvents(list){
  const out=mergeBy(list, e=>`${e.date}|${djNorm(e.city)}|${normEventName(e.name)}`);
  const byDC={}; out.forEach(e=>{const k=`${e.date}|${djNorm(e.city)}`;(byDC[k]=byDC[k]||[]).push(e);});
  const rm=new Set(), bareMerges=[];
  for(const k in byDC){ const evs=byDC[k]; for(const e of evs){ if(rm.has(e)||(e.tags&&e.tags.includes('festival'))||!e.djs.length) continue; const bare=normEventName(e.name)===djNorm(e.djs[0])||normEventName(e.name)===normEventName(e.djs[0]); if(!bare) continue; const host=evs.find(o=>o!==e&&!rm.has(o)&&(o.djs||[]).some(d=>djNorm(d)===djNorm(e.djs[0]))&&normEventName(o.name)!==normEventName(e.name)); if(host){ bareMerges.push(`${e.name}  ⟶  ${host.name}`); mergeInto(host,e); rm.add(e);} } }
  return {out:out.filter(e=>!rm.has(e)), bareMerges};
}
const {out:deduped, bareMerges}=dedupeEvents(rows);
console.log(`\n── SIMULATED dedupe (new logic) ──`);
console.log(`events: ${rows.length} → ${deduped.length}  (removed ${rows.length-deduped.length})`);
const merged=deduped.filter(e=>e._merged&&e._merged.length);
console.log(`name-merge clusters: ${merged.length}. Samples:`);
merged.slice(0,14).forEach(e=>console.log(`   • "${e.name}"  ⟵  ${e._merged.map(x=>JSON.stringify(x)).join(', ')}`));
console.log(`bare-artist merges: ${bareMerges.length}. Samples:`);
bareMerges.slice(0,10).forEach(s=>console.log(`   • ${s}`));

// image recovery via DJ→image reuse
const djImg={}; for(const e of rows){ if(!e.img_url) continue; for(const d of (e.djs||[])){ const k=djNorm(d); if(k&&!djImg[k]) djImg[k]=e.img_url; } }
let recovered=0; for(const e of noImg){ if((e.djs||[]).length && djImg[djNorm(e.djs[0])]) recovered++; }
console.log(`\n── Image recovery (DJ photo reuse) ──`);
console.log(`no-img events that get an artist photo: ${recovered} / ${noImg.length}  (remaining on city/country stock: ${noImg.length-recovered})`);
