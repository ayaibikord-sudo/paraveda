import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const d=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'}); const w=dom.window; const errs=[];
w.fetch=async(u,o={})=>({ok:true,json:async()=>o.method==='POST'?{ok:true}:d});
w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>errs.push(String(e).slice(0,120));w.console.warn=()=>{};
for(const [k,v] of Object.entries(d)){w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('ct_'+k,String(v.t));}
w.localStorage.setItem('paraveda_session_v1','1'); w.eval(js); const sl=ms=>new Promise(r=>setTimeout(r,ms)); await sl(2500);{const b=[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='الكل');b&&b.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await sl(400)}
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));
const setVal=(el,v)=>{const p=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value');p.set.call(el,v);el.dispatchEvent(new w.Event('input',{bubbles:true}))};
const opts=()=>{const sel=[...w.document.querySelectorAll('td[data-field="produit"] select')][0]; return sel?[...sel.options].map(o=>o.textContent):null};
let o=opts(); console.log('COMONDES dropdown options:',o.length,'| manual entry option?',o.some(x=>/يدوي/.test(x))?'❌ still there':'✅ none','| any <input> in produit cell?',w.document.querySelector('td[data-field="produit"] input')?'❌':'✅');
// add product in PRODUITS
click(w.document.querySelector('div[title="Articles"]')); await sl(50); click([...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('PRODUITS'))); await sl(400);
click([...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('إضافة منتج'))); await sl(200); const form=[...w.document.querySelectorAll('form')].find(f=>f.querySelector('input')); const inp=form.querySelector('input'); setVal(inp,'TEST PRODUIT X'); await sl(50);
form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); await sl(400);
const cat=JSON.parse(w.localStorage.getItem('paraveda_catalog_v1')); console.log('catalog now has TEST PRODUIT X?',cat.some(c=>c.nom==='TEST PRODUIT X')?'✅':'❌');
click([...w.document.querySelectorAll('button,div[title]')].find(b=>b.textContent.trim().endsWith('COMONDES'))); await sl(400);
o=opts(); console.log('COMONDES dropdown includes new product (no reload)?',o.includes('TEST PRODUIT X')?'✅':'❌', '| options:',o.length);
console.log('errors:',errs.length?errs:'none'); process.exit(0);
