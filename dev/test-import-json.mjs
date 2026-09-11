import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const server=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));const admin=server.paraveda_users_v1.d.find(u=>u.role==='admin');
const RESET=server.paraveda_reset_v1.t;
const backup={paraveda_orders_v5:{t:RESET-5e8,d:[
 {id:11,dateCreation:'2026-06-03',dateConfirmation:'2026-06-03',statut:'Confirmé',nom:'Khadija',telephone:'0661',ville:'Casablanca',produit:'SERUM',qte:2,prix:300,livraison:'Livrée',agent:'AYA',commission:35,upsell:1,originLead:'Facebook',_u:RESET-5e8},
 {id:12,dateCreation:'2026-06-04',dateConfirmation:'2026-06-04',statut:'Confirmé',nom:'Omar',telephone:'0662',ville:'Rabat',produit:'SERUM',qte:1,prix:150,livraison:'Retour',agent:'HIBA',commission:35,upsell:0,originLead:'TikTok',_u:RESET-4e8},
 {id:13,_del:1,nom:'x',_u:1}]},
 paraveda_catalog_v1:{t:1,d:[{nom:'SERUM',prix:150,achat:40}]}};
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;
const posts=[];w.fetch=async(u,o)=>{if(o&&o.method==='POST'){posts.push(JSON.parse(o.body));return{ok:true,json:async()=>({ok:true})}}return{ok:true,json:async()=>server}};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>console.log('ERR',String(e).slice(0,300));w.console.warn=()=>{};
w.localStorage.setItem('paraveda_reset_seen',String(RESET));w.localStorage.setItem('paraveda_users_v1',JSON.stringify(server.paraveda_users_v1.d));w.localStorage.setItem('paraveda_session_v1',String(admin.id));
w.eval(js);const sl=ms=>new Promise(r=>setTimeout(r,ms));await sl(3000);
const d=w.document;const btn=[...d.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith('Import Excel'));btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await sl(300);
const inp=d.querySelector('input[type=file]');console.log('accept json?',/json/.test(inp.accept)?'✅':'❌');
const file=new w.File([JSON.stringify(backup)],'crm_data.json',{type:'application/json'});
Object.defineProperty(inp,'files',{value:[file]});inp.dispatchEvent(new w.Event('change',{bubbles:true}));await sl(500);
console.log('preview shows 2 orders?',d.body.textContent.includes('2 طلبية')&&d.body.textContent.includes('Livrée: 1')?'✅':'❌');
const go=[...d.querySelectorAll('button')].find(b=>b.textContent.includes('رجّع'));go.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await sl(1200);
const o=JSON.parse(w.localStorage.getItem('paraveda_orders_v5'));
const k=o.find(x=>x.nom==='Khadija'),m=o.find(x=>x.nom==='Omar');
console.log('2 orders, tombstone dropped?',o.length===2?'✅':'❌ '+o.length,'| fields kept?',k&&k.livraison==='Livrée'&&k.statut==='Confirmé'&&k.dateCreation==='2026-06-03'&&k.agent==='AYA'&&k.prix===300&&k.qte===2&&m.livraison==='Retour'&&m.originLead==='TikTok'?'✅':'❌ '+JSON.stringify(k));
console.log('_u >= reset (server accepts)?',o.every(x=>x._u>=RESET)?'✅':'❌');
console.log('catalog SERUM added?',JSON.parse(w.localStorage.getItem('paraveda_catalog_v1')||'[]').some(p=>p.nom==='SERUM')?'✅':'❌');
const p=posts.filter(p=>p.key==='paraveda_orders_v5').pop();console.log('POSTed to server with 2 rows & fresh t?',p&&p.d.length===2&&p.t>=RESET?'✅':'❌');
// re-import same file: no duplicates
btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await sl(300);
process.exit(0);
