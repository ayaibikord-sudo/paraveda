// Boot the real bundle in jsdom with real crm_data.json, log in, visit every page, capture errors.
import fs from 'fs'; import path from 'path'; import { JSDOM } from 'jsdom';
const ROOT=path.resolve(new URL('.',import.meta.url).pathname,'..','public_html');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1];
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'crm_data.json'),'utf8'));
const errors=[], warns=[];
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.fetch=async(u,o={})=>{ if(String(u).startsWith('api.php')){ if(!o.method||o.method==='GET') return {ok:true,status:200,json:async()=>data}; return {ok:true,status:200,json:async()=>({ok:true})}; } return {ok:false,status:404,json:async()=>({})}; };
w.alert=()=>{}; w.confirm=()=>true; w.prompt=()=>null; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){}; w.HTMLCanvasElement.prototype.getContext=()=>null;
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}}; w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
w.AudioContext=undefined; w.webkitAudioContext=undefined; w.Notification=undefined;
w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),16); w.cancelAnimationFrame=clearTimeout;
w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
const origErr=w.console.error.bind(w.console);
w.console.error=(...a)=>{const s=a.map(x=>x instanceof Error?x.stack:String(x)).join(' '); errors.push(s)};
w.console.warn=(...a)=>{warns.push(a.map(String).join(' '))};
w.addEventListener('error',e=>errors.push('window.error: '+(e.error?.stack||e.message)));
w.addEventListener('unhandledrejection',e=>errors.push('unhandledrejection: '+(e.reason?.stack||e.reason)));
// pre-seed localStorage exactly as the sync layer would
for(const [k,v] of Object.entries(data)){ w.localStorage.setItem(k,JSON.stringify(v.d)); w.localStorage.setItem('ct_'+k,String(v.t)); }
const admin=data.paraveda_users_v1.d.find(u=>u.role==='admin');
w.localStorage.setItem('paraveda_session_v1',String(admin.id));
w.eval(js.replace(/import\.meta/g,'({})'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=(sel)=>w.document.querySelector(sel);
const byText=(txt,tag='*')=>[...w.document.querySelectorAll(tag)].find(el=>el.children.length===0&&el.textContent.trim()===txt)||[...w.document.querySelectorAll(tag)].find(el=>el.textContent.trim()===txt);
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));
await sleep(3500);
const text=()=>w.document.body.textContent;
console.log('booted; root chars=',text().length,'| errors so far',errors.length);
const pages=['COMONDES','Dashboard performance','suivi confirmation','statistique','PRODUITS','pièce','Les villes','LIVRAISON','Work Times','Work Team','Ranking','Live Activity','Heatmap','CRM Ads','Salaire','Historique','إدارة المستخدمين','LES RENV','LES OBJECTIFS','RECLAMATION','Sheet129', ...data.paraveda_agent_names_v1.d];
const groups={Bilan:['Dashboard performance','suivi confirmation','statistique'],Articles:['PRODUITS','pièce'],SHIPING:['Les villes','LIVRAISON'],TEAM:['Work Times','Work Team','Ranking','Live Activity','Heatmap'],ADS:['CRM Ads','Salaire','Historique'],'Users Info':['إدارة المستخدمين']};
const report=[];
for(const p of pages){
  const before=errors.length;
  let el=null;
  const grp=Object.entries(groups).find(([g,l])=>l.includes(p))?.[0];
  if(grp){ const gb=[...w.document.querySelectorAll('div[title]')].find(d=>d.getAttribute('title')===grp); if(gb){click(gb); await sleep(200);} }
  el=[...w.document.querySelectorAll('button,div[title],span')].find(e=>e.textContent.trim()===p || (e.tagName==='BUTTON'&&e.textContent.trim().endsWith(p)))||null;
  if(!el){ el=byText(p); }
  if(!el){report.push({page:p,status:'NOT FOUND in menu'});continue;}
  click(el.closest('button')||el); await sleep(400);
  const t=text();
  report.push({page:p,status:errors.length>before?'ERROR':'ok',len:t.length,newErrors:errors.slice(before).map(e=>e.split('\n')[0].slice(0,200))});
}
for(const r of report) console.log((r.status==='ok'?'✅':'❌'), r.page, r.status, r.len??'', r.newErrors?.length?'\n   '+r.newErrors.join('\n   '):'');
const uniqErr=[...new Set(errors.map(e=>e.split('\n')[0].slice(0,300)))];
console.log('\n=== unique console.error (',uniqErr.length,') ==='); uniqErr.forEach(e=>console.log(' -',e));
const uniqWarn=[...new Set(warns.map(e=>e.slice(0,300)))];
console.log('\n=== unique console.warn (',uniqWarn.length,') ==='); uniqWarn.forEach(e=>console.log(' -',e));
process.exit(0);
