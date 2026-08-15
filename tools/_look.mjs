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
await new Promise(ok=>srv.listen(8327,ok));
const b=await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]});
const pg=await b.newPage({viewport:{width:1100,height:700}});
pg.on("pageerror",e=>console.log("PAGE ERROR:",String(e).slice(0,180)));
await pg.goto("http://localhost:8327/index.html",{waitUntil:"load",timeout:300000});
await pg.waitForFunction(()=>window.__app&&window.__app.camera,null,{timeout:180000});
// wait for the hall itself to land
for(let i=0;i<60;i++){
  const there=await pg.evaluate(()=>(window.__assets||[]).some(a=>/reshall/.test(a.name)&&a.ms!=null));
  if(there) break;
  await pg.waitForTimeout(5000);
}
const shots=[
  ["front", [300, 40, 374], [149, 60, 374]],       // on the front walk looking west at the facade
  ["approach", [250, 55, 250], [149, 55, 374]],    // coming down the forecourt
  ["wide", [520, 260, 620], [149, 40, 374]],       // from the quad side, in context
];
const { writeFile } = await import("node:fs/promises");
for (const [name, pos, look] of shots){
  await pg.evaluate(([p,l])=>{
    const {camera, controls, THREE}=window.__app;
    const W=(v)=>v;                      // campus units are world units here
    camera.position.set(p[0],p[1],p[2]);
    controls.target.set(l[0],l[1],l[2]);
    controls.update();
  },[pos,look]);
  await pg.waitForTimeout(2500);
  await pg.screenshot({path: resolve(ROOT,".shots","site-"+name+".png"), timeout: 180000});
  console.log("  .shots/site-"+name+".png");
}
await b.close(); srv.close();
