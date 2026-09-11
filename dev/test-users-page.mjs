import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('public_html/index.html','utf8'); const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1].replace(/import\.meta/g,'({})');
const base=JSON.parse(fs.readFileSync('public_html/crm_data.json','utf8'));const admin=base.paraveda_users_v1.d.find(u=>u.role==='admin');
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;
w.fetch=async()=>({ok:false});w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.console.error=e=>console.log('ERR',String(e).slice(0,300));w.console.warn=()=>{};w.confirm=()=>true;
for(const [k,v] of Object.entries(base)){w.localStorage.setItem(k,JSON.stringify(v.d));w.localStorage.setItem('ct_'+k,String(v.t));}
w.localStorage.setItem('paraveda_session_v1',String(admin.id));w.eval(js);const S=ms=>new Promise(r=>setTimeout(r,ms));await S(3500);
const d=w.document,byText=(t,sel='button,div,span')=>[...d.querySelectorAll(sel)].find(b=>b.textContent.trim()===t);
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));const gb=[...d.querySelectorAll('div[title]')].find(x=>x.getAttribute('title')==='Users Info');click(gb);await S(100);let el=[...d.querySelectorAll('button')].find(e=>/إدارة المستخدمين|Users$/.test(e.textContent.trim()));click(el.closest('button')||el);await S(700);
const T=d.body.textContent;
console.log('title?',/الفريق والمستخدمين/.test(T)?'✅':'❌','| KPIs?',/متصلين الآن/.test(T)&&/بلا صفحة مربوطة/.test(T)?'✅':'❌','| cards =',d.querySelectorAll('button.group.relative').length,'users =',base.paraveda_users_v1.d.length);
// open drawer for first non-admin
const card=[...d.querySelectorAll('button.group.relative')].find(c=>/Agent/.test(c.textContent));card.click();await S(300);
console.log('drawer?',!!d.querySelector('aside')?'✅':'❌','| photo input?',!!d.querySelector('aside input[type=file]')?'✅':'❌','| role/agent/pw controls?',d.querySelectorAll('aside select').length&&d.querySelectorAll('aside input').length>=3?'✅':'❌');
// change password inline
const pw=[...d.querySelectorAll('aside input')].find(i=>i.type==='password');const proto=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set;proto.call(pw,'newpass123');pw.dispatchEvent(new w.Event('input',{bubbles:true}));await S(200);
const users=JSON.parse(w.localStorage.getItem('paraveda_users_v1'));console.log('pw saved?',users.some(u=>u.password==='newpass123')?'✅':'❌');
// simulate photo set through updateUser via drawer: set photo directly to check header renders img
// new user modal
click(d.querySelector('aside button'));await S(200);click([...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='＋ مستخدم جديد'));await S(300);
const f=d.querySelector('form');console.log('modal form?',!!f);const ins=f.querySelectorAll('input');proto.call(ins[0],'test@paraveda.ma');ins[0].dispatchEvent(new w.Event('input',{bubbles:true}));proto.call(ins[1],'abc123');ins[1].dispatchEvent(new w.Event('input',{bubbles:true}));await S(100);click(f.querySelector('button[type=submit]'));await S(300);
console.log('user added?',JSON.parse(w.localStorage.getItem('paraveda_users_v1')).some(u=>u.username==='test@paraveda.ma')?'✅':'❌');
// list view
await S(1000);byText('☰')?.click();await S(300);console.log('list view rows =',d.querySelectorAll('tbody tr').length);
process.exit(0);
