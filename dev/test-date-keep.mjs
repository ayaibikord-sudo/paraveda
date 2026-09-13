import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const server=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));const admin=server.paraveda_users_v1.d.find(u=>u.role==='admin');
const RESET=server.paraveda_reset_v1.t;const T0=RESET+1000;
const row={id:501,dateCreation:'2026-09-11',dateConfirmation:'2026-09-11',statut:'',nom:'Test',telephone:'0600',ville:'Casablanca',produit:'X',qte:1,prix:100,livraison:'',agent:'AYA',commission:35,upsell:0,originLead:'',_u:T0};
// server state: admin A already changed the date to 2026-08-01 (field-stamped)
server.paraveda_orders_v5={t:T0+5000,d:[{...row,dateCreation:'2026-08-01',_u:T0+5000,_f:{dateCreation:T0+5000}}]};
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;
const posts=[];w.fetch=async(u,o)=>{if(o&&o.method==='POST'){posts.push(JSON.parse(o.body));return{ok:true,json:async()=>({ok:true})}}return{ok:true,json:async()=>server}};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>console.log('ERR',String(e).slice(0,300));w.console.warn=()=>{};
// stale browser B: still holds the row with today's date, and edits statut locally BEFORE syncing (offline edit)
w.localStorage.setItem('paraveda_reset_seen',String(RESET));w.localStorage.setItem('paraveda_users_v1',JSON.stringify(server.paraveda_users_v1.d));w.localStorage.setItem('paraveda_session_v1',String(admin.id));
w.localStorage.setItem('paraveda_orders_v5',JSON.stringify([{...row,statut:'Confirmé',_u:T0+9000,_f:{statut:T0+9000}}]));w.localStorage.setItem('ct_paraveda_orders_v5',String(T0+1));
w.eval(js);await new Promise(r=>setTimeout(r,3500));
const o=JSON.parse(w.localStorage.getItem('paraveda_orders_v5'))[0];
console.log('client: old date kept + statut kept?',o.dateCreation==='2026-08-01'&&o.statut==='Confirmé'?'✅':'❌ '+JSON.stringify(o));
const p=posts.filter(p=>p.key==='paraveda_orders_v5').pop();console.log('posted row keeps old date?',!p||p.d[0].dateCreation==='2026-08-01'?'✅':'❌ '+JSON.stringify(p.d[0]));
// now edit statut through the UI on the merged row → date must stay
process.exit(0);
