// v3.38 patch set — every replacement must match exactly once, otherwise we abort.
import fs from 'fs';
const F='public_html/index.html'; let s=fs.readFileSync(F,'utf8'); const orig=s;
const patches=[];
function rep(name, from, to){ const n=s.split(from).length-1; if(n!==1) throw new Error(`[${name}] expected 1 match, got ${n}`); s=s.replace(from,to); patches.push(name); }

// FIX 1 — Sync layer: unwrap double-wrapped payloads {t,d:{t,d:X}} -> X (data corruption seen in prod for custom_sheets_v1 / afrizon_team_photos_v1)
rep('sync-unwrap',
 'function ig(e){const n=[];return sg.forEach(a=>{const i=e[a];if(i&&typeof i.t=="number"){',
 'function __pvUnwrap(v){let g=0;while(v&&typeof v=="object"&&!Array.isArray(v)&&typeof v.t=="number"&&"d"in v&&Object.keys(v).length<=2&&g++<5)v=v.d;return v}function ig(e){const n=[];return sg.forEach(a=>{let i=e[a];if(i&&typeof i.t=="number"){i={t:i.t,d:__pvUnwrap(i.d)};');

// FIX 2 — Roles: production users have role "agent" (legacy). Normalise to "user" on load so agents count/edit correctly.
rep('role-normalise',
 'JSON.parse(d).map(h=>h.role==="admin"&&h.username==="admin"?{...h,username:"admin@paraveda.ma"}:h)',
 'JSON.parse(d).map(h=>{const r=h.role==="admin"?"admin":"user";return h.role==="admin"&&h.username==="admin"?{...h,role:r,username:"admin@paraveda.ma"}:h.role===r?h:{...h,role:r}})');

// FIX 3 — Order normaliser F4 dropped LIVRAISON fields (livreur, tracking, dateExp, dateLiv, motif) on every reload.
rep('orders-keep-livraison-fields',
 'commission:Number(i.commission)||0,fees:String(i.fees??"")}}):[]',
 'commission:Number(i.commission)||0,fees:String(i.fees??""),livreur:String(i.livreur??""),tracking:String(i.tracking??""),dateExp:String(i.dateExp??"").slice(0,10),dateLiv:String(i.dateLiv??"").slice(0,10),motif:String(i.motif??"")}}):[]');

// FIX 4 — Agents (non-admin) could edit/delete Livrée orders? No — but they could edit ANY field of others' orders. Keep as is; however block non-admin from deleting *any* order (history shows deletes are rare & dangerous).
rep('no-delete-for-agents',
 'del:v=>{const A=a.find(D=>D.id===v);A&&A.livraison==="Livrée"&&n?.role!=="admin"||',
 'del:v=>{const A=a.find(D=>D.id===v);if(n?.role!=="admin"){alert("المسح مسموح غير للأدمين");return}A&&A.livraison==="Livrée"&&n?.role!=="admin"||');

// FIX 5 — Local dates: toISOString() is UTC → after 23:00/00:00 (Morocco UTC+1) "today" is wrong. Replace all "today"-style computations with a local formatter.
const before=s;
s=s.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/g,'__pvLocalDate(new Date())');
s=s.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,8\)\+"01"/g,'__pvLocalDate(new Date()).slice(0,8)+"01"');
s=s.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,4\)\+"-01-01"/g,'__pvLocalDate(new Date()).slice(0,4)+"-01-01"');
s=s.replace(/new Date\(Date\.now\(\)-(\d+e\d|\d+\*864e5)\)\.toISOString\(\)\.slice\(0,10\)/g,'__pvLocalDate(new Date(Date.now()-$1))');
s=s.replace(/Jc=e=>e\.toISOString\(\)\.slice\(0,10\)/,'Jc=e=>__pvLocalDate(e)');
s=s.replace(/const E=S\.toISOString\(\)\.slice\(0,10\)/,'const E=__pvLocalDate(S)');
s=s.replace(/return ([A-Za-z])\.setDate\(\1\.getDate\(\)-([A-Za-z])\),\1\.toISOString\(\)\.slice\(0,10\)/g,'return $1.setDate($1.getDate()-$2),__pvLocalDate($1)');
if(s===before) throw new Error('local-date: nothing replaced');
const left=(s.match(/toISOString\(\)\.slice\(0,10\)/g)||[]).length;
patches.push(`local-date (${left} untouched occurrences left: history timestamps use full ISO which is fine)`);
// define helper right before the sync layer
rep('local-date-helper','const N4=b4,w4=y4,Rd=','function __pvLocalDate(d){const p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}const N4=b4,w4=y4,Rd=');

// FIX 6 — "Repair" button in the error boundary wiped afrizon_history_v1 / afrizon_villes_v2 / worktimes / chat / remarques from localStorage. With server sync that's mostly re-fetched, but villes prices & history could be lost if the server copy was older. Only clear truly technical keys.
rep('repair-button-safe',
 'Kj=["afrizon_chat_v1","afrizon_worktimes_v1","afrizon_remarques_v1","afrizon_villes_v1","afrizon_villes_v2","afrizon_history_v1"]',
 'Kj=["afrizon_villes_v1","afrizon_chat_mute_v1","afrizon_session_v1"]');

// FIX 7 — Footer version label
rep('version-label','children:"v2.0"','children:"v3.38"');

// FIX 8 — LIVRAISON: frais for "Out Of Stock" (never shipped) should be 0 like Retour/Annulé
rep('frais-oos',
 'const frais = x => (x.livraison === "Retour" || String(x.statut) === "Annulé") ? 0 : (wo(x.ville, cities) ?? 0);',
 'const frais = x => (x.livraison === "Retour" || x.livraison === "Out Of Stock" || String(x.statut) === "Annulé") ? 0 : (wo(x.ville, cities) ?? 0);');

// FIX 9 — statistique: charges fixes were counted per Livrée order; also CA ignored qte in several pages -> handled below (CA = prix is the *order total* in this CRM; qte>1 orders already carry the bundle price, e.g. 2 x =280). So we DO NOT multiply prix*qte. Fix the one page that did multiply (statistique + LIVRAISON kCA) to be consistent with COMONDES/Ranking/Salaire.
rep('statistique-ca-consistent',
 '_=M.reduce((K,V)=>K+V.prix*(V.qte||1),0)',
 '_=M.reduce((K,V)=>K+(Number(V.prix)||0),0)');
rep('livraison-ca-consistent',
 'const kCA = shown.filter(inC("Livré")).reduce((a, x) => a + (Number(x.qte) || 0) * (Number(x.prix) || 0), 0);',
 'const kCA = shown.filter(inC("Livré")).reduce((a, x) => a + (Number(x.prix) || 0), 0);');
rep('livraison-row-total-consistent',
 'const tot = (Number(x.qte) || 0) * (Number(x.prix) || 0);',
 'const tot = Number(x.prix) || 0;');

fs.writeFileSync(F,s);
console.log('applied:\n - '+patches.join('\n - '));
console.log('size',orig.length,'->',s.length);
