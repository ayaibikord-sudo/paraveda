import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const base=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));const admin=base.paraveda_users_v1.d.find(u=>u.role==='admin');
const P='TEST PRODUIT',today='2026-09-10';
base.paraveda_catalog_v1.d=[{nom:P,link:'',prix:'250',commission:'35',stock:''}];
base['sheet_pièce'].d=[[P,'100','40','4000',today]];
const mk=(id,qte,prix,up)=>({id,_u:1,dateCreation:today,dateConfirmation:today,statut:'Confirmé',remarques:'',idCmd:'C'+id,nom:'client'+id,telephone:'0600000000',ville:'Casablanca',adresse:'x',qte,prix,produit:P,livraison:'Livrée',upsell:up,carousell:'',agent:'AYA',link:'',carosellFlag:'',originLead:'Facebook',commission:35,fees:0});
base.paraveda_orders_v5.d=[mk(1,1,250,0),mk(2,2,280,1),mk(3,3,300,2)];
base.paraveda_perfrows_v1.d=[{id:1,source:'Facebook',produit:P,date:today,prix:250}];
base.paraveda_adspend_v1.d=[];
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;
w.fetch=async()=>({ok:false});w.alert=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>console.log('ERR',String(e).slice(0,200));w.console.warn=()=>{};
for(const [k,v] of Object.entries(base)){w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('ct_'+k,String(v.t));}w.localStorage.setItem('paraveda_session_v1',String(admin.id));w.localStorage.removeItem('perf_products_v1');w.eval(js);const S=ms=>new Promise(r=>setTimeout(r,ms));await S(3500);
const d=w.document,click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));
click([...d.querySelectorAll('div[title]')].find(x=>x.getAttribute('title')==='Bilan'));await S(150);click([...d.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith('Dashboard performance')));await S(800);
const kol=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='الكل');kol&&click(kol);await S(400);
const titles=[...d.querySelectorAll('[title]')].map(e=>e.title).find(t=>/GAIN\/PERTE/.test(t));
console.log(titles||'(no gain tooltip)');
// expected: revenue=250+280+300=830 ; pcs=6 × 40 = 240 ; ship = 3×35=105 ; conf 3×10=30 → gain = 830-240-105-30 = 455
console.log('gain 455?',/GAIN\/PERTE = 455/.test(titles||'')?'✅':'❌');

click([...d.querySelectorAll('div,span')].find(x=>x.children.length===0&&x.textContent.trim()==='COMONDES').closest('div[title]')||[...d.querySelectorAll('span')].find(x=>x.textContent.trim()==='COMONDES'));await S(600);
click([...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='الكل'));await S(400);
const qteIn=[...d.querySelectorAll('input[type=number]')].find(i=>i.value==='1');const set=(el,v)=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}))};
if(qteIn){set(qteIn,'5');await S(300);const o=JSON.parse(w.localStorage.getItem('paraveda_orders_v5')).find(o=>o.id===1);console.log('qte 5 → upsell auto 4?',o.qte===5&&o.upsell===4?'✅':'❌',o.qte,o.upsell)}else console.log('qte input not found');
process.exit(0);
