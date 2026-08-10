/*
 * Pembroke Academy — service worker.
 *
 * The campus is ~39MB of models. Downloading it once is reasonable;
 * downloading it on every visit is not. This keeps the models in the
 * Cache API so a returning student walks onto the quad immediately,
 * and the site keeps working with no connection at all.
 *
 * Deliberately NOT a precache: pulling 39MB during install would make
 * a first visit worse to make later ones better, and most of that
 * weight is scenery the visitor may never walk to. Models are cached
 * as they are actually fetched, so the cost follows the use.
 *
 * It also deliberately handles only two kinds of request:
 *
 *   navigations      network-first — a new deploy must win over a stale copy
 *   same-origin art  cache-first   — immutable for a given VERSION
 *
 * Everything else — the CDN modules, the fonts, the stylesheet — is left
 * alone. Those are cross-origin and already immutable in the HTTP cache,
 * so mediating them buys nothing while adding real ways to fail: a
 * response that arrived via a redirect cannot legally be returned from a
 * worker, and unpkg redirects. A module script that dies that way takes
 * the whole page with it. Not touching them is the feature.
 *
 * BUMP VERSION whenever anything under assets/ changes, or returning
 * visitors keep the old models forever.
 */
const VERSION = "pembroke-v1";
const SHELL = VERSION + "-shell";
const DEPOT = VERSION + "-assets";

self.addEventListener("install", (e) => {
  // Only the shell is worth precaching — it is small and always needed.
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(["./", "./index.html"]).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isArt = (url) => /\/assets\/.+\.(glb|png|jpe?g|webp|svg)$/i.test(url.pathname);

/* A response that arrived through a redirect is rejected by the browser
   when a worker hands it back. Rebuilding it drops the redirect flag and
   keeps the bytes. */
async function plain(res){
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, {
    status: res.status, statusText: res.statusText, headers: res.headers });
}

async function cacheFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await plain(await fetch(req));
  // Caching a 404 would persist the failure, so only keep real answers.
  // The put can still fail on storage quota — that costs speed, not
  // correctness, so it must never take the response down with it.
  if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  try {
    const res = await plain(await fetch(req));
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(req) || await cache.match("./index.html");
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* the CDN is not ours to manage */

  /* the page itself: always prefer the network so a fresh deploy lands,
     but fall back to the cached campus when there is no connection */
  if (req.mode === "navigate"){
    e.respondWith(networkFirst(req, SHELL));
    return;
  }
  if (isArt(url)){
    e.respondWith(cacheFirst(req, DEPOT));
  }
  /* anything else same-origin falls through to the browser, which
     already knows how to fetch and cache it better than this does */
});
