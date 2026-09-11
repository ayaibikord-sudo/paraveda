import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const base=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));const users=base.paraveda_users_v1.d;
const sl=ms=>new Promise(r=>setTimeout(r,ms));
async function client(user){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;
w.fetch=async()=>({ok:false});w.alert=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>console.log('ERR',String(e).slice(0,200));w.console.warn=()=>{};
for(const [k,v] of Object.entries(base))w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('paraveda_session_v1',String(user.id));w.eval(js);await sl(2500);return w}
const setVal=(w,el,v)=>{const p=Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype,'value');p.set.call(el,v);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))};
// admin COMONDES
const wb=await client(users.find(u=>u.role==='admin'));{const __allbtn=[...wb.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='الكل');__allbtn&&__allbtn.dispatchEvent(new wb.MouseEvent('click',{bubbles:true}));await sl(400)}
[...wb.document.querySelectorAll('button,div[title]')].find(e=>e.textContent.trim().endsWith('COMONDES')).click();await sl(500);
const cell=wb.document.querySelector('td[data-field="commission"] input');console.log('COMONDES commission readOnly?',cell.readOnly?'✅':'❌','value',cell.value);
const row=cell.closest('tr');const villesHas=v=>JSON.parse(wb.localStorage.getItem('paraveda_villes_v2')).some(x=>(x.ville||x.nom||x.name||x[0])===v);const id=JSON.parse(wb.localStorage.getItem('paraveda_orders_v5'));
const before=cell.value;setVal(wb,cell,'999');await sl(300);console.log('after typing 999 →',cell.value,cell.value===before?'✅ unchanged':'❌');
// change city → commission auto-updates
const vc=[...row.querySelectorAll('input')].find(i=>villesHas(i.value));const villes=JSON.parse(wb.localStorage.getItem('paraveda_villes_v2'));const target=villes.find(v=>String(v.prix??v.frais??v[1])!==String(before))||villes[0];
const vname=target.ville||target.nom||target.name||target[0];setVal(wb,vc,vname);vc.dispatchEvent(new wb.Event('change',{bubbles:true}));vc.dispatchEvent(new wb.Event('blur',{bubbles:true}));await sl(400);
console.log('city →',vname,'| commission now',row.querySelector('td[data-field="commission"] input').value,'(city price',target.prix??target.frais??target[1],')');
// agent page
const ag=users.find(u=>u.role==='user'&&u.agent);const wa=await client(ag);{const b=[...wa.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='الكل');b&&b.dispatchEvent(new wa.MouseEvent('click',{bubbles:true}));await sl(400)}
const ins=[...wa.document.querySelectorAll('input[type=number]')].filter(i=>i.title.includes('Commission'));console.log('agent page commission inputs:',ins.length,'all readOnly?',ins.length&&ins.every(i=>i.readOnly)?'✅':'❌');
process.exit(0);
