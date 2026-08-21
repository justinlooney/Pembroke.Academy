/**
 * The one web server and the one browser every probe was carrying.
 *
 * Twenty-two files under tools/ stood up their own static server, each
 * with the same MIME table, the same path-traversal guard, the same
 * three launch flags — and a port picked by hand. Three of those ports
 * were picked twice:
 *
 *     8311   check-onscreen        check-rig-names
 *     8321   check-dialogue        compare-lod
 *     8361   check-roles           check-sitting
 *
 * Those pairs cannot run at the same time. The second one binds, gets
 * EADDRINUSE, and dies before it checks anything — and it reads like a
 * broken checkout rather than a port clash. It has never bitten only
 * because at most one of each pair is wired into CI, which is luck.
 *
 * So the port is not a number here. serve() asks for 0 and lets the
 * operating system hand out one nobody else holds, which removes the
 * whole class rather than renumbering three instances of it.
 *
 * Everything is a plain export with no framework: a probe stays a
 * script you can run with `node tools/check-x.mjs` and read top to
 * bottom.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".glb": "model/gltf-binary", ".png": "image/png",
  ".woff2": "font/woff2", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
  ".json": "application/json", ".spz": "application/octet-stream",
};

/** The campus over HTTP, on a port the OS chose. Returns its origin. */
export async function serve(root = ROOT){
  const server = createServer(async (req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split("?")[0]); }
    catch { res.writeHead(400); return res.end(); }
    if (rel === "/favicon.ico"){ res.writeHead(204); return res.end(); }
    const path = resolve(root, "." + (rel === "/" ? "/index.html" : rel));
    /* a request may not climb out of the tree it is served from */
    if (path !== root && !path.startsWith(root + sep)){ res.writeHead(403); return res.end(); }
    if (!existsSync(path) || statSync(path).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(await readFile(path));
  });
  await new Promise((ok) => server.listen(0, ok));
  const { port } = server.address();
  return { origin: `http://localhost:${port}`, port, close: () => server.close() };
}

/** Chromium as every probe here launches it: no GPU, no sandbox. */
export function launch(extraArgs = []){
  return chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox", ...extraArgs],
  });
}

/**
 * Open the campus and wait for it to ignite.
 *
 * The timeout is generous on purpose and the reason is written down
 * rather than rediscovered: a boot is ~22s idle on a software
 * rasterizer with no GPU, and a probe that gives up at 120s reports a
 * page that will not start when what it found was a machine under
 * load. That false red has been paid for once already.
 */
export async function open(browser, origin, opts = {}){
  const { ready = () => window.__app, timeout = 240_000, ...ctxOpts } = opts;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...ctxOpts });
  const page = await ctx.newPage();
  await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const up = await page.waitForFunction(ready, null, { timeout }).then(() => true, () => false);
  return { ctx, page, up, close: () => ctx.close() };
}

/**
 * The reporter. Same two words in the same columns as every probe in
 * this repository prints, because a suite that reports six ways is a
 * suite nobody reads the tail of.
 *
 * `detail` is not decoration. Several checks here have failed while
 * printing the sentence that describes their SUCCESS, and one printed
 * the two numbers it was comparing, identical, in the failure message.
 * Give it what was observed, not what a pass would have meant.
 */
export function reporter(){
  const failures = [];
  const step = (name, ok, detail = "") => {
    console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? "  — " + detail : ""}`);
    if (!ok) failures.push(name);
    return ok;
  };
  const note = (text) => console.log(`  ..   ${text}`);
  const done = (what) => {
    if (failures.length){
      console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
      process.exit(1);
    }
    console.log(`\nall ${what} checks passed.`);
  };
  return { step, note, done, failures };
}
