import fs from 'fs';
const F='public_html/index.html'; let s=fs.readFileSync(F,'utf8');
function rep(name,from,to){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${name}] ${n} matches`);s=s.replace(from,to);console.log('✔',name)}
// helper: clean text fields (trim + collapse spaces) on every add/update/import
rep('clean-helper','function __pvLocalDate(d){',
 'function __pvClean(o){if(!o||typeof o!="object")return o;const r={...o};for(const k of ["produit","ville","nom","agent","telephone","adresse","idCmd"])if(typeof r[k]=="string")r[k]=r[k].replace(/\\s+/g," ").trim();return r}function __pvLocalDate(d){');
rep('clean-add','add:v=>{const A=Math.max(0,...a.map(D=>D.id))+1;i(D=>[{...v,id:A},...D])','add:v=>{v=__pvClean(v);const A=Math.max(0,...a.map(D=>D.id))+1;i(D=>[{...v,id:A},...D])');
rep('clean-import','importOrders:v=>{if(!v.length)return 0;','importOrders:v=>{v=v.map(__pvClean);if(!v.length)return 0;');
rep('clean-upd','upd:(v,A)=>{const D=a.find(k=>k.id===v);','upd:(v,A)=>{A=__pvClean(A);const D=a.find(k=>k.id===v);');
// also normalise on load (F4) so old data is clean everywhere
rep('clean-load','ville:String(i.ville??""),','ville:String(i.ville??"").replace(/\\s+/g," ").trim(),');
rep('clean-load2','produit:String(i.produit??""),','produit:String(i.produit??"").replace(/\\s+/g," ").trim(),');
// GET api.php with token already sent by app (header X-Sync-Token present in S4/E4) — nothing to change client side.
rep('version','children:"v3.38"','children:"v3.39"');
fs.writeFileSync(F,s);
