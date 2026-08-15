import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";
const ROOT="/home/user/Pembroke.Academy";
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".glb":"model/gltf-binary",".png":"image/png",".woff2":"font/woff2"};
const srv=createServer(async(req,res)=>{
  const p=resolve(ROOT,decodeURIComponent(req.url.split("?")[0]).slice(1)||"index.html");
  if(!existsSync(p)||!statSync(p).isFile()) return res.writeHead(404).end();
  res.writeHead(200,{"content-type":MIME[extname(p)]||"application/octet-stream"});
  res.end(await readFile(p));
});
await new Promise(ok=>srv.listen(8325,ok));
const b=await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]});
const pg=await b.newPage();
pg.on("pageerror",e=>console.log("PAGE ERROR:",String(e).slice(0,200)));
await pg.goto("http://localhost:8325/index.html",{waitUntil:"load"});
await pg.waitForFunction(()=>window.__ways&&window.__colliders,null,{timeout:180000});
// give the outer world time to land
for(let i=0;i<40;i++){
  const done=await pg.evaluate(()=>!!(window.__vistas||[]).find(v=>/Residence/.test(v.name||v.label||"")));
  if(done) break;
  await pg.waitForTimeout(5000);
}
console.log(JSON.stringify(await pg.evaluate(()=>{
  const W=window.__ways.WAYPOINTS, C=window.__colliders;
  const out={waypoints:{}, colliders:[], vistas:[]};
  // the hall's footprint as configured
  const cx=140, cy=330, hw=215/2, hd=130/2;
  const inside=[];
  for(const k in W){ const [x,y]=W[k];
    if(Math.abs(x-cx)<=hw && Math.abs(y-cy)<=hd) inside.push([k,x,y]); }
  out.waypointsInsideFootprint=inside;
  // colliders near
  out.colliders=(C||[]).map(c=>{
    const b=c.box||c; const x=(b.min?.x+b.max?.x)/2, z=(b.min?.z+b.max?.z)/2;
    return {name:c.name||"", x:Math.round(x), z:Math.round(z),
            w:Math.round((b.max?.x-b.min?.x)||0), d:Math.round((b.max?.z-b.min?.z)||0)};
  }).filter(c=>Math.hypot(c.x-cx, c.z-cy)<400);
  out.vistas=(window.__vistas||[]).map(v=>v.name||v.label).slice(0,20);
  return out;
}), null, 1));
await b.close(); srv.close();
