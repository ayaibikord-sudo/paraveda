import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const d=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));
const old={}; for(const [k,v] of Object.entries(d)) old[k.replace(/^paraveda_/,'afrizon_')]=v;   // simulate old server file
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'}); const w=dom.window;
w.fetch=async(u,o={})=>({ok:true,json:async()=>o.method==='POST'?{ok:true}:d});
w.alert=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=()=>{};w.console.warn=()=>{};
w.localStorage.setItem('afrizon_orders_v5',JSON.stringify(old.afrizon_orders_v5.d)); w.localStorage.setItem('ct_afrizon_orders_v5','1'); w.localStorage.setItem('afrizon_session_v1','1');
w.eval(js); await new Promise(r=>setTimeout(r,2500));
console.log('browser migration:', w.localStorage.getItem('afrizon_orders_v5')===null && JSON.parse(w.localStorage.getItem('paraveda_orders_v5')).length===203 && !!w.document.querySelector('#root').textContent.includes('Paraveda') ? '✅' : '❌');
process.exit(0);
