import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const d=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'}); const w=dom.window; const errs=[];
w.fetch=async(u,o={})=>({ok:true,json:async()=>o.method==='POST'?{ok:true}:d});
w.alert=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>errs.push(String(e).slice(0,120));w.console.warn=()=>{};
for(const [k,v] of Object.entries(d)){w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('ct_'+k,String(v.t));}
w.localStorage.setItem('paraveda_session_v1','1'); w.eval(js); const sl=ms=>new Promise(r=>setTimeout(r,ms)); await sl(2500);
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));
click(w.document.querySelector('div[title="SHIPING"]')); await sl(50); click([...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Les villes'))); await sl(400);
let t=w.document.body.textContent;
console.log('Les villes page: shows 612 ?', /612/.test(t)?'✅':'❌', '| Agadir20 present?', /Agadir/.test(t)?'✅':'❌');
click(w.document.querySelector('div[title="SHIPING"]')); await sl(50); click([...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('LIVRAISON'))); await sl(500);
const rows=[...w.document.querySelectorAll('tr.lvx-row')]; const check=(city,exp)=>{const r=rows.find(r=>new RegExp('\\b'+city+'\\b','i').test(r.textContent)); if(!r) return city+': (no order)'; const f=r.querySelector('td[data-frais]')?.getAttribute('data-frais'); return `${city}: frais=${f} ${f==String(exp)?'✅':'❌ expected '+exp}`};
console.log(check('Agadir',20), '|', check('Casablanca',35), '|', check('Tanger',40), '|', check('Nador',45));
console.log('errors:',errs.length? errs:'none'); process.exit(0);
