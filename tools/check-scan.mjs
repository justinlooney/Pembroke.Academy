#!/usr/bin/env node
/**
 * Pembroke Academy — does the buffer scan see a hole that is really there?
 *
 *     node tools/check-scan.mjs
 *
 * The panel's `scan` line exists to answer one question that ten
 * photographs of a phone could not: when the screen shows a black
 * rectangle, is that rectangle IN the drawing buffer, or is the buffer
 * whole and Android failing to present it? The two answers want
 * opposite fixes, so the line has to be right.
 *
 * A scanner that has only ever printed "clean" has not been tested.
 * Twice on this branch a probe produced confident, well-formatted
 * numbers about something it was not measuring — once the night sky,
 * once a 360-degree sweep that turned the camera 6.28 degrees — and on
 * both occasions the output was indistinguishable from a working one.
 * So this blanks a KNOWN rectangle of the real drawing buffer and
 * holds scanDark() to what it finds, including which edge it names:
 * GL counts rows from the bottom and the person holding the phone does
 * not, and an inverted report would send the next investigation at the
 * wrong half of the screen.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".glb": "model/gltf-binary", ".png": "image/png",
               ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json",
               ".woff2": "font/woff2" };
const srv = createServer(async (req, res) => {
  const p = resolve(ROOT, decodeURIComponent(req.url.split("?")[0]).slice(1) || "index.html");
  if (!p.startsWith(ROOT + sep) && p !== ROOT) return res.writeHead(403).end();
  if (!existsSync(p) || !statSync(p).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise((ok) => srv.listen(0, ok));
const PORT = srv.address().port;

const browser = await chromium.launch({ args: ["--use-gl=swiftshader",
  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 384, height: 690 },
                                     deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(`http://localhost:${PORT}/index.html?debug`, { waitUntil: "load" });
await page.waitForFunction(() => typeof window.__scanDark === "function",
  null, { timeout: 180000 });
/* Let the campus actually arrive. A scan of a half-built frame is a
   scan of whatever happened to be resident. */
await page.waitForTimeout(20000);

/* Everything below runs INSIDE a rAF callback, which is the only place
   the drawing buffer is defined: preserveDrawingBuffer is false, so it
   is valid from the end of the app's render until the frame composites
   and undefined forever after. */
const out = await page.evaluate(() => new Promise((done) => {
  /* NOT querySelector("canvas") — the minimap is a 2D canvas and comes
     first in the document, so that picks a 132x132 surface with no GL
     context at all and every assertion below becomes a story about it. */
  const pair = [...document.querySelectorAll("canvas")]
    .map((el) => [el, el.getContext("webgl2") || el.getContext("webgl")])
    .find(([, g]) => g);
  if (!pair) return done({ fail: "no WebGL canvas in the document" });
  const [c, gl] = pair;
  const results = [];
  /* Blank a rectangle in GL coordinates, leaving every piece of state
     exactly as it was found. three.js caches clear colour and the
     scissor enable behind its own wrapper; changing either without
     putting it back would break the frames after this one and the
     failure would look like the bug under investigation. */
  const blank = (x, y, w, h) => {
    const was = gl.getParameter(gl.COLOR_CLEAR_VALUE);
    const hadScissor = gl.getParameter(gl.SCISSOR_TEST);
    const box = gl.getParameter(gl.SCISSOR_BOX);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(was[0], was[1], was[2], was[3]);
    gl.scissor(box[0], box[1], box[2], box[3]);
    if (!hadScissor) gl.disable(gl.SCISSOR_TEST);
  };
  let tries = 0;
  const step = (n) => requestAnimationFrame(() => { try {
    const W = c.width, H = c.height;
    const before = window.__scanDark();
    /* Precondition: a frame has been drawn. If the app has not rendered
       yet the buffer is uniformly black and the scan says so — which
       would make every assertion below pass for the wrong reason. */
    /* Anchored: the dark report now also contains the word "clean" when
       only one axis is holed ("across clean"), so a loose match would
       accept a frame that already has a hole as the clean baseline and
       every assertion below would pass against the wrong reference. */
    if (!/^scan\s+clean\b/.test(before)){
      if (++tries > 120) return done({ fail: "never got a clean frame: " + before.trim() });
      return step(n);
    }
    if (n === 0){
      results.push({ case: "untouched", got: before.trim() });
      blank(0, 0, W, Math.floor(H * 0.4));                 /* GL y=0 is the BOTTOM */
      results.push({ case: "bottom 40%", got: window.__scanDark().trim(),
                     want: /V 3[89]%|V 4[01]%/, wantEdge: /V \d+% from bottom/ });
      return step(1);
    }
    if (n === 1){
      blank(0, Math.floor(H * 0.75), W, H - Math.floor(H * 0.75));
      results.push({ case: "top 25%", got: window.__scanDark().trim(),
                     want: /V 2[456]%/, wantEdge: /V \d+% from top/ });
      return step(2);
    }
    blank(0, 0, Math.floor(W * 0.6), H);
    results.push({ case: "left 60%", got: window.__scanDark().trim(),
                   want: /H 6[01]%|H 59%/, wantEdge: /H \d+% from left/ });
    done({ results, buffer: W + "x" + H });
    } catch (e){ done({ fail: "threw in frame " + n + ": " + (e && e.stack || e) }); }
  });
  step(0);
}));

srv.close();
await browser.close();

if (out.fail){ console.log("FAIL — " + out.fail); process.exit(1); }
console.log("drawing buffer " + out.buffer + "\n");
let bad = 0;
for (const r of out.results){
  const ok = !r.want || (r.want.test(r.got) && r.wantEdge.test(r.got));
  if (!ok) bad++;
  console.log((ok ? "  ok   " : "  FAIL ") + (r.case + "            ").slice(0, 12) + r.got);
  if (!ok) console.log("       wanted " + r.want + " and " + r.wantEdge);
}
if (errs.length){ console.log("\npage errors:\n  " + errs.slice(0, 3).join("\n  ")); bad++; }
console.log(bad ? "\n" + bad + " check(s) failed" : "\nthe scan finds holes that are really there, on the edge they are really on");
process.exit(bad ? 1 : 0);
