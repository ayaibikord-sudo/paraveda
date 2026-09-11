import fs from 'fs'; import path from 'path'; import { JSDOM } from 'jsdom';
const ROOT=path.resolve(new URL('.',import.meta.url).pathname,'..','public_html');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const js=html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1];
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'crm_data.json'),'utf8'));
const errors=[];
function boot(seed, userSel){
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});
 const w=dom.window;
 w.fetch=async(u,o={})=>({ok:true,status:200,json:async()=>(!o.method||o.method==='GET')?seed:{ok:true}});
 w.alert=m=>errors.push('ALERT:'+m); w.confirm=()=>true; w.prompt=()=>null; w.scrollTo=()=>{};
 w.HTMLElement.prototype.scrollIntoView=function(){}; w.HTMLCanvasElement.prototype.getContext=()=>null;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
 w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),16); w.URL.createObjectURL=()=>'blob:x';
 w.console.error=(...a)=>errors.push(a.map(x=>x instanceof Error?x.stack:String(x)).join(' ').split('\n')[0].slice(0,250));
 w.console.warn=()=>{};
 w.addEventListener('error',e=>errors.push('window.error: '+(e.error?.stack||e.message).split('\n')[0]));
 for(const [k,v] of Object.entries(seed)){ w.localStorage.setItem(k,JSON.stringify(v.d)); w.localStorage.setItem('ct_'+k,String(v.t)); }
 const u=seed.paraveda_users_v1.d.find(userSel); if(u) w.localStorage.setItem('paraveda_session_v1',String(u.id));
 w.eval(js.replace(/import\.meta/g,'({})'));
 return w;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));

// 1) agent login (role "agent" in prod data)
let w=boot(data,u=>u.username==='imane'); await sleep(3000);
let t=w.document.body.textContent;
console.log('[agent imane] len',t.length,'| has COMONDES menu:',/COMONDES/.test(t),'| has Bilan:',/Bilan/.test(t),'| has Historique:',/Historique/.test(t), '| header:', t.slice(0,120));
// 2) a fresh install (empty server) with prod users -> what does an agent see
const clone=JSON.parse(JSON.stringify(data));
w=boot(clone,u=>u.username==='admin@paraveda.ma'); await sleep(3000);
const btn=[...w.document.querySelectorAll('div[title="Users Info"]')][0]; click(w,btn); await sleep(100);
const ub=[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Users')); click(w,ub); await sleep(400);
t=w.document.body.textContent; 
const m=t.match(/الوكيلات[^0-9]*(\d+)|Agents[^0-9]*(\d+)/); console.log('[users page] snippet:',t.replace(/\s+/g,' ').slice(0,700));
console.log('\nerrors:',[...new Set(errors)]);
process.exit(0);
