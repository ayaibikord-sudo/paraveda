import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const base=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));const admin=base.paraveda_users_v1.d.find(u=>u.role==='admin');
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;
w.fetch=async()=>({ok:false});w.alert=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;const errs=[];w.console.error=e=>errs.push(String(e).slice(0,300));w.console.warn=()=>{};
for(const [k,v] of Object.entries(base))w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('paraveda_session_v1',String(admin.id));w.eval(js);await sl(2500);
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));
{const b=[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='الكل');b&&click(b);await sl(300)}
const gb=[...w.document.querySelectorAll('div[title]')].find(d=>d.getAttribute('title')==='Bilan');gb&&click(gb);await sl(50);
const el=[...w.document.querySelectorAll('button,div[title],span')].find(e=>e.textContent.trim()==='suivi confirmation');click(el.closest('button')||el);await sl(600);
const t=w.document.body.textContent;
console.log('title?',/Suivi confirmation/.test(t)?'✅':'❌','| KPIs?',/Commandes/.test(t)&&/Meilleur taux conf/.test(t)?'✅':'❌','| 3 sections?',w.document.querySelectorAll('section').length===3?'✅':'❌ '+w.document.querySelectorAll('section').length,'| tfoot totals?',w.document.querySelectorAll('tfoot').length,'| CSV btn?',/📥 CSV/.test(t)?'✅':'❌');
const rows=[...w.document.querySelectorAll('section:first-of-type tbody tr')];console.log('agent rows:',rows.length,'| first row:',rows[0]?.textContent.replace(/\s+/g,' ').slice(0,160));
// consistency: KPI Confirmées == tfoot conf
const tf=w.document.querySelector('section:first-of-type tfoot');console.log('tfoot:',tf?.textContent.replace(/\s+/g,' ').slice(0,200));
// click agent -> detail
const ab=rows[0]?.querySelector('button');ab&&click(ab);await sl(400);console.log('agent detail opens?',/suivi confirmation — /.test(w.document.body.textContent)?'✅':'❌');
console.log('errors:',errs.length?errs:'none');process.exit(0);
