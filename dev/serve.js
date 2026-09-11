// Dev server: serves public_html and emulates api.php (GET/POST with X-Sync-Token) — no PHP needed.
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','public_html');
const DATA=path.join(ROOT,'crm_data.json');
const SECRET='c6e04cb5de9088be01a685abc243995a80426eba45de2060';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const read=()=>{try{return JSON.parse(fs.readFileSync(DATA,'utf8'))||{}}catch{return{}}};
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Sync-Token','Cache-Control':'no-store'};
  if(u.pathname==='/api.php'){
    if(req.method==='OPTIONS'){res.writeHead(204,cors);return res.end()}
    if(req.method==='GET'){const tk=req.headers['x-sync-token']||u.searchParams.get('token')||'';if(tk!==SECRET){res.writeHead(403,cors);return res.end('{"ok":false,"err":"token"}')}res.writeHead(200,{...cors,'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify(read()))}
    if(req.method==='POST'){
      let b='';req.on('data',c=>b+=c);req.on('end',()=>{
        const tok=req.headers['x-sync-token']||u.searchParams.get('token')||'';
        const out=(o,c=200)=>{res.writeHead(c,{...cors,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(o))};
        if(tok!==SECRET)return out({ok:false,err:'token'},403);
        let j;try{j=JSON.parse(b)}catch{return out({ok:false,err:'bad-json'},400)}
        if(j.action)return out({ok:false,err:'action-not-implemented:'+j.action,msg:'dev server'},501);
        if(!('key'in j)||!('d'in j))return out({ok:false,err:'bad-body'},400);
        const d=read();let nd=j.d;
        if(j.key==='paraveda_orders_v5'&&Array.isArray(nd)&&Array.isArray(d[j.key]?.d)){const m=new Map();d[j.key].d.forEach(o=>o&&m.set(String(o.id),o));nd.forEach(o=>{if(!o)return;const c=m.get(String(o.id));if(!c||(Number(o._u)||0)>=(Number(c._u)||0))m.set(String(o.id),o)});nd=[...m.values()].sort((a,b)=>b.id-a.id)}
        d[String(j.key)]={t:Number(j.t)||Date.now(),d:nd};
        fs.writeFileSync(DATA,JSON.stringify(d));out({ok:true});
      });return;
    }
  }
  let p=path.join(ROOT,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end('not found')}
  res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(p).pipe(res);
}).listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('CRM dev server on :'+(process.env.PORT||3000)));
