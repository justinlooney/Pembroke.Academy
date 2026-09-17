#!/usr/bin/env node
/**
 * Pembroke Academy — reproduce the phone's black band, or fail to.
 *
 *     node tools/probe-black.mjs
 *
 * The panel's scan line settled the question it was added for: the
 * black IS in the drawing buffer. The GPU hands back a frame with the
 * bottom 63-81% empty, at 60fps, with a correctly sized buffer and no
 * context loss.
 *
 * It also killed the fix I expected to make. "Dark means ask for less"
 * was the plan; the captures that read 63% and 81% had ALREADY given
 * up SSAO to the quality ladder, 442 draws against 681 and 3.18M
 * triangles against 5.04M — a third less work than the captures that
 * only lost 39%. Cost is not the variable, so the shadow map and the
 * redundant MSAA framebuffer are not the answer.
 *
 * What the photographs show is the sky band rendering and everything
 * below the horizon missing, with the boundary moving the way a
 * horizon moves. Geometry is being submitted and is not arriving.
 *
 * So: the phone's geometry exactly — 384x690 CSS at dpr 2, walk mode,
 * daylight — sweeping the heading and reading the same scanDark() the
 * panel reads. If this reproduces on a software rasterizer in a
 * container then it was never a driver fault and it can be debugged
 * here instead of through someone's camera. If it does NOT reproduce,
 * that is worth just as much: it means the fault needs the real GPU
 * and the panel stays the only instrument that can see it.
 *
 * Degrees, not radians: walker.h is degrees, and a probe on this
 * branch has already once swept 6.28 of them while reporting 360.
 * Daylight is asserted rather than hoped for, because a probe on this
 * branch has already once measured the night sky and called the bug
 * reproduced.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
const ROOT = "/home/user/Pembroke.Academy";
const MIME = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript",
  ".css":"text/css", ".glb":"model/gltf-binary", ".png":"image/png", ".jpg":"image/jpeg",
  ".webp":"image/webp", ".json":"application/json", ".woff2":"font/woff2" };
const srv = createServer(async (req,res)=>{
  const p = resolve(ROOT, decodeURIComponent(req.url.split("?")[0]).slice(1) || "index.html");
  if (!p.startsWith(ROOT+sep) && p!==ROOT) return res.writeHead(403).end();
  if (!existsSync(p) || !statSync(p).isFile()) return res.writeHead(404).end();
  res.writeHead(200,{ "content-type": MIME[extname(p)]||"application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise(ok=>srv.listen(0,ok));
const PORT = srv.address().port;
const browser = await chromium.launch({ args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport:{ width:384, height:690 }, deviceScaleFactor:2 });
const errs=[]; page.on("pageerror", e=>errs.push(String(e)));
await page.goto(`http://localhost:${PORT}/index.html?debug`, { waitUntil:"load" });
await page.waitForFunction(()=>typeof window.__scanDark==="function", null,{timeout:180000});
await page.waitForTimeout(25000);

/* walk mode + daylight, both ASSERTED rather than hoped for */
const setup = await page.evaluate(async ()=>{
  const w = window.__walker;
  if (!w) return { err:"no __walker" };
  if (!w.on){ const b=document.getElementById("walkbtn"); if (b) b.click(); }
  await new Promise(r=>setTimeout(r,2500));
  return { on: !!window.__walker.on, visual: window.__visual,
           buffer: (()=>{const c=[...document.querySelectorAll("canvas")]
             .find(el=>el.getContext("webgl2")||el.getContext("webgl"));
             return c ? c.width+"x"+c.height+" css "+c.clientWidth+"x"+c.clientHeight : "?";})() };
});
console.log("walk mode:", setup.on, " visual:", setup.visual, " buffer:", setup.buffer);
if (!setup.on){ console.log("ABORT — never entered walk mode:", JSON.stringify(setup)); await browser.close(); srv.close(); process.exit(2); }
if (setup.visual === "night"){ console.log("ABORT — campus is in night; a dark frame would prove nothing"); await browser.close(); srv.close(); process.exit(2); }

console.log("\n heading   scan                                          draws    tris");
for (let deg = 0; deg < 360; deg += 30){
  const row = await page.evaluate(async (d)=>{
    window.__walker.h = d;                       /* DEGREES. walker.h is degrees. */
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return await new Promise(done=>requestAnimationFrame(()=>{
      const s = window.__scanDark ? window.__scanDark().trim() : "(no scanner)";
      done({ s, calls: window.__rendererInfo ? 0 : 0 });
    }));
  }, deg);
  const panel = await page.evaluate(()=>{
    const t=[...document.querySelectorAll("div")].map(x=>x.textContent)
      .find(x=>x&&x.startsWith("PEMBROKE · DIAGNOSTICS"))||"";
    const m=t.match(/draws\s+(\d+)\s+tris\s+([\d.]+M)/); return m?[m[1],m[2]]:["?","?"];
  });
  console.log(String(deg).padStart(5)+"    "+(row.s+"                                             ").slice(0,44)
              +" "+panel[0].padStart(6)+"  "+panel[1].padStart(6));
}
console.log("\npage errors:", errs.length?errs.slice(0,3):"none");
await browser.close(); srv.close();
