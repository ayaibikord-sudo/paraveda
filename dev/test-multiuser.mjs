import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const TOK='c6e04cb5de9088be01a685abc243995a80426eba45de2060';
const srvGet=async()=>(await (await fetch('http://localhost:3000/api.php',{headers:{'X-Sync-Token':TOK}})).json());
const base=await srvGet(); const users=base.paraveda_users_v1.d; const agentUser=users.find(u=>u.role==='user'&&u.agent); const admin=users.find(u=>u.role==='admin');
const before=base.paraveda_orders_v5.d.length; console.log('server orders before:',before,'| agent:',agentUser.agent);
const sl=ms=>new Promise(r=>setTimeout(r,ms));
async function client(user){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000/',pretendToBeVisual:true,runScripts:'outside-only'}); const w=dom.window;
  w.fetch=(u,o)=>fetch(new URL(u,'http://localhost:3000/').href,o); w.alert=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>console.log('ERR',String(e).slice(0,150));w.console.warn=()=>{};
  for(const [k,v] of Object.entries(base)){w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('ct_'+k,String(v.t));}
  w.localStorage.setItem('paraveda_session_v1',String(user.id)); w.eval(js); await sl(2500); return w;
}
const [wa,wb]=await Promise.all([client(agentUser),client(admin)]);
const btn=(w,txt)=>[...w.document.querySelectorAll('button')].find(b=>b.title&&b.textContent.includes(txt)||b.textContent.trim().startsWith(txt));
const nav=(w,name)=>{const el=[...w.document.querySelectorAll('button,div[title]')].find(e=>e.textContent.trim().endsWith(name));el&&el.click()};
nav(wb,'COMONDES'); await sl(500); const adminRows0=wb.document.querySelectorAll('td[data-field="produit"]').length; console.log('admin rows at start:',adminRows0);
console.log('agent has Commande btn?',!!btn(wa,'＋Commande'),'| admin has Ligne btn?',!!btn(wb,'＋Ligne'));
for(let i=0;i<10;i++){btn(wa,'＋Commande').click();btn(wb,'＋Ligne').click();await sl(150)}
await sl(9000);
const srv=(await srvGet()).paraveda_orders_v5.d; const la=JSON.parse(wa.localStorage.getItem('paraveda_orders_v5')), lb=JSON.parse(wb.localStorage.getItem('paraveda_orders_v5'));
const ids=new Set(srv.map(o=>o.id));
console.log('server orders after:',srv.length,'(expected',before+20,')',srv.length===before+20?'✅':'❌');
console.log('unique ids on server:',ids.size===srv.length?'✅':'❌');
console.log('agent local:',la.length,'admin local:',lb.length,(la.length===before+20&&lb.length===before+20)?'✅ both tabs see all 20':'❌');
const drafts=srv.filter(o=>o._d); console.log('drafts on server (agent ones):',drafts.length, drafts.length===10?'✅':'❌');
const adminRows=wb.document.querySelectorAll('td[data-field="produit"]').length; console.log('admin COMONDES rows:',adminRows,'(expected',adminRows0+10,')',adminRows===adminRows0+10?'✅ drafts hidden':'❌');
console.log('admin sees draft badge?',wb.document.body.textContent.includes('مسودة عند الوكلاء')?'✅':'❌');
const pub=btn(wa,'إرسال للأدمين'); console.log('publish button:',pub?pub.textContent:'MISSING'); pub.click(); await sl(8000);
const srv2=(await srvGet()).paraveda_orders_v5.d; console.log('drafts after publish:',srv2.filter(o=>o._d).length,srv2.filter(o=>o._d).length===0?'✅':'❌');
const adminRows2=wb.document.querySelectorAll('td[data-field="produit"]').length; console.log('admin COMONDES rows now:',adminRows2,adminRows2===adminRows0+20?'✅ published visible':'❌');
const agentRowsBefore=wa.document.querySelectorAll('input[placeholder="Nom & Prénom"]').length;
const del=[...wb.document.querySelectorAll('td button')].find(b=>b.textContent.trim()==='✕'&&b.className.includes('text-red-500')); console.log('delete btn found?',!!del); del&&del.click(); await sl(8000);
const srv3=(await srvGet()).paraveda_orders_v5.d;
console.log('after admin delete: tombstones on server',srv3.filter(o=>o._del).length,'| admin rows',wb.document.querySelectorAll('td[data-field="produit"]').length,'| agent rows',agentRowsBefore,'→',wa.document.querySelectorAll('input[placeholder="Nom & Prénom"]').length,'| agent local visible',JSON.parse(wa.localStorage.getItem('paraveda_orders_v5')).filter(o=>!o._del).length,'(expected',before+19,')');
process.exit(0);
