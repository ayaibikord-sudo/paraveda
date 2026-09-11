import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const d=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));
let server=JSON.parse(JSON.stringify(d)); const posts=[];
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'}); const w=dom.window; const errs=[];
// server: accepts writes but simulates an OLD tab that keeps pushing the catalog price (260) for order #1 every 5s
w.fetch=async(u,o={})=>{ if(o.method==='POST'){const b=JSON.parse(o.body);posts.push(b);server[b.key]={t:b.t,d:b.d};return {ok:true,json:async()=>({ok:true})}} return {ok:true,json:async()=>server}; };
w.alert=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>errs.push(String(e).slice(0,120));w.console.warn=()=>{};
for(const [k,v] of Object.entries(d)){w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('ct_'+k,String(v.t));}
w.localStorage.setItem('paraveda_session_v1','1'); w.eval(js); const sl=ms=>new Promise(r=>setTimeout(r,ms)); await sl(2500);
const setVal=(el,v)=>{const p=Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype,'value');p.set.call(el,v);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))};
const row=w.document.querySelector('td[data-field="produit"]').parentElement;
const sel=row.querySelector('td[data-field="produit"] select'); const prix=row.querySelector('td[data-field="prix"] input');
const prod=[...sel.options].map(o=>o.value).find(v=>v&&!/قديم/.test(v)); const cat=JSON.parse(w.localStorage.getItem('paraveda_catalog_v1')).find(c=>c.nom===prod);
setVal(sel,prod); await sl(300); console.log(`1) choose "${prod}" → prix auto = ${prix.value} (catalog ${cat.prix}) ${String(prix.value)===String(cat.prix)?'✅':'❌'}`);
setVal(prix,'240'); await sl(300); console.log('2) type 240 → prix =',prix.value, prix.value==='240'?'✅':'❌');
const id=Number(row.getAttribute('data-id'))||JSON.parse(w.localStorage.getItem('paraveda_orders_v5')).find(o=>o.produit===prod&&o.prix===240)?.id;
// simulate stale copy arriving from server (another device / old tab): same order with catalog price and older _u, newer t
await sl(1500); const stale=JSON.parse(JSON.stringify(server.paraveda_orders_v5.d)); const so=stale.find(o=>o.id===id); so.prix=Number(cat.prix); so._u=(so._u||0)-60000; server.paraveda_orders_v5={t:Date.now()+1,d:stale};
await sl(7000);
const now=JSON.parse(w.localStorage.getItem('paraveda_orders_v5')).find(o=>o.id===id);
console.log('3) after server pushed stale 260 → local prix =',now.prix, now.prix===240?'✅ kept 240':'❌ reverted');
console.log('4) UI shows', row.querySelector('td[data-field="prix"] input').value, row.querySelector('td[data-field="prix"] input').value==='240'?'✅':'❌');
console.log('errors:',errs.length?errs:'none'); process.exit(0);
