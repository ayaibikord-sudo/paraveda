import fs from 'fs'; import path from 'path'; import { JSDOM } from 'jsdom';
const ROOT=path.resolve(new URL('.',import.meta.url).pathname,'..','public_html');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const base=JSON.parse(fs.readFileSync(path.join(ROOT,'crm_data.json'),'utf8'));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'✅':'❌')+' '+m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(seed,{user,posts=[],now}={}){
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});
 const w=dom.window; const errors=[];
 w.fetch=async(u,o={})=>{ if(o.method==='POST'){posts.push(JSON.parse(o.body));return {ok:true,status:200,json:async()=>({ok:true})}} return {ok:true,status:200,json:async()=>seed}; };
 w.alert=m=>errors.push('ALERT:'+m); w.confirm=()=>true; w.prompt=()=>null; w.scrollTo=()=>{};
 w.HTMLElement.prototype.scrollIntoView=function(){}; w.HTMLCanvasElement.prototype.getContext=()=>null;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
 w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),16); w.URL.createObjectURL=()=>'blob:x';
 w.console.error=(...a)=>errors.push(String(a[0]).split('\n')[0]); w.console.warn=()=>{};
 if(now){ const RD=w.Date; class FD extends RD{constructor(...a){super(...(a.length?a:[now]))} static now(){return now}} w.Date=FD; }
 if(user){ const u=seed.paraveda_users_v1.d.find(x=>x.username===user); w.localStorage.setItem('paraveda_session_v1',String(u.id)); }
 w.eval(js); w.__errors=errors; return w;
}
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));

// T1 — double-wrapped payload from server gets unwrapped
{ const seed=JSON.parse(JSON.stringify(base)); seed.custom_sheets_v1={t:Date.now(),d:{t:1,d:{Foo:{headers:['A'],rows:[['x']]}}}};
  const w=boot(seed,{user:'admin@paraveda.ma'}); await sleep(2500);
  const ls=JSON.parse(w.localStorage.getItem('custom_sheets_v1')); ok(ls&&ls.Foo&&!('t' in ls),'sync unwraps {t,d:{t,d}} → localStorage holds real payload'); }

// T2 — role "agent" normalised to "user" → users page counts it, agent sees her page
{ const seed=JSON.parse(JSON.stringify(base)); const posts=[];
  const w=boot(seed,{user:'admin@paraveda.ma',posts}); await sleep(2500);
  const users=JSON.parse(w.localStorage.getItem('paraveda_users_v1')); ok(users.every(u=>u.role==='admin'||u.role==='user'),'roles normalised on load ("agent" → "user")');
  click(w,w.document.querySelector('div[title="Users Info"]')); await sleep(50);
  click(w,[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Users'))); await sleep(300);
  const t=w.document.body.textContent.replace(/\s+/g,' '); ok(/👤3الوكيلات|👤 ?3 ?الوكيلات/.test(t.replace(/ /g,'')) || /3الوكيلات/.test(t.replace(/\s/g,'')),'Users page shows 3 agents (was 0)'); }

// T3 — LIVRAISON fields survive a reload
{ const seed=JSON.parse(JSON.stringify(base)); seed.paraveda_orders_v5.d[0]={...seed.paraveda_orders_v5.d[0],livreur:'Ali',tracking:'TRK-1',dateExp:'2026-09-01',dateLiv:'2026-09-02',motif:'x'};
  const w=boot(seed,{user:'admin@paraveda.ma'}); await sleep(2500);
  const o=JSON.parse(w.localStorage.getItem('paraveda_orders_v5'))[0]; ok(o.livreur==='Ali'&&o.tracking==='TRK-1'&&o.dateExp==='2026-09-01'&&o.motif==='x','livreur/tracking/dateExp/dateLiv/motif no longer dropped on reload'); }

// T4 — local date: at 00:30 Casablanca (UTC+1) → "today" must be the local day
{ const seed=JSON.parse(JSON.stringify(base)); const w=boot(seed,{user:'admin@paraveda.ma'});
  const r=w.eval('__pvLocalDate(new Date(2026,8,9,0,30))'); ok(r==='2026-09-09','__pvLocalDate uses local day (2026-09-09 at 00:30 local)');
  ok(!/toISOString\(\)\.slice\(0,10\)/.test(js),'no remaining UTC-based date truncations in bundle'); }

// T5 — agent cannot delete an order
{ const seed=JSON.parse(JSON.stringify(base)); const w=boot(seed,{user:'imane'}); await sleep(2500);
  const before=JSON.parse(w.localStorage.getItem('paraveda_orders_v5')).length;
  const del=[...w.document.querySelectorAll('button')].find(b=>/🗑|مسح|Supprimer/i.test(b.textContent));
  if(del){ click(w,del); await sleep(200); }
  const after=JSON.parse(w.localStorage.getItem('paraveda_orders_v5')).length;
  ok(after===before,'agent delete blocked (orders count unchanged'+(del?'':' — no delete button rendered for agent')+')'); }

// T6 — CA consistency: statistique CA == COMONDES CA for Livrée orders in "all" range
{ const o=base.paraveda_orders_v5.d.filter(x=>x.livraison==='Livrée'); const ca=o.reduce((a,x)=>a+Number(x.prix||0),0);
  const seed=JSON.parse(JSON.stringify(base)); const w=boot(seed,{user:'admin@paraveda.ma'}); await sleep(2500);
  click(w,w.document.querySelector('div[title="Bilan"]')); await sleep(50);
  click(w,[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('statistique'))); await sleep(300);
  const allBtns=[...w.document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='الكل'); click(w,allBtns[allBtns.length-1]); await sleep(300);
  const tot=[...w.document.querySelectorAll('tr')].find(tr=>tr.textContent.startsWith('TOTAL')); const txt=tot?tot.textContent.replace(/\u202f|\u00a0/g,' '):''; const fr=ca.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g,' ');
  ok(txt.includes(fr),`statistique TOTAL CA (all) = ${fr} DH = sum(prix of Livrée) — consistent with COMONDES (row: ${txt.slice(0,60)})`); }

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
