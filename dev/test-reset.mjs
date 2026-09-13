import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const server=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));const admin=server.paraveda_users_v1.d.find(u=>u.role==='admin');
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;
const posts=[];w.fetch=async(u,o)=>{if(o&&o.method==='POST'){posts.push(JSON.parse(o.body));return{ok:true,json:async()=>({ok:true})}}return{ok:true,json:async()=>server}};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>console.log('ERR',String(e).slice(0,200));w.console.warn=()=>{};
let reloaded=false;w.eval('window.__rl=()=>{}');const _js=js.replace('location.reload();return n}','(window.__reloaded=1);return n}');
// STALE BROWSER: old orders + old timestamps in localStorage
const OLD=server.paraveda_reset_v1.t-1e8;
w.localStorage.setItem('paraveda_orders_v5',JSON.stringify([{id:1,_u:OLD,produit:'OLD',nom:'old',prix:100,qte:1,agent:'AYA',dateCreation:'2026-08-01',statut:'',livraison:'',originLead:'',ville:'',telephone:'',adresse:'',upsell:0}]));
w.localStorage.setItem('ct_paraveda_orders_v5',String(OLD));w.localStorage.setItem('paraveda_catalog_v1',JSON.stringify([{nom:'OLD PRODUCT',prix:'1'}]));w.localStorage.setItem('ct_paraveda_catalog_v1',String(OLD));
w.localStorage.setItem('paraveda_users_v1',JSON.stringify(server.paraveda_users_v1.d));w.localStorage.setItem('paraveda_session_v1',String(admin.id));
w.eval(_js);await new Promise(r=>setTimeout(r,3000));reloaded=!!w.__reloaded;
const o=JSON.parse(w.localStorage.getItem('paraveda_orders_v5')||'[]'),c=JSON.parse(w.localStorage.getItem('paraveda_catalog_v1')||'[]');
console.log('reset applied (reload)?',reloaded?'✅':'❌','| old orders wiped?',o.length===0?'✅':'❌ '+o.length,'| old catalog wiped?',c.length===0?'✅':'❌','| reset_seen set?',!!w.localStorage.getItem('paraveda_reset_seen')?'✅':'❌');
console.log(JSON.stringify(posts.filter(p=>p.key==='paraveda_orders_v5').map(p=>p.d)).slice(0,400));console.log('POSTs of old orders to server?',posts.filter(p=>p.key==='paraveda_orders_v5'&&p.d.length).length===0?'✅ none':'❌ '+posts.filter(p=>p.key==='paraveda_orders_v5').map(p=>p.d.length));
process.exit(0);
