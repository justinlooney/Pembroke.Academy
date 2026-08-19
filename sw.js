/*
 * Pembroke Academy — service worker.
 *
 * The campus is ~85MB of models. Downloading it once is reasonable;
 * downloading it on every visit is not. This keeps the models in the
 * Cache API so a returning student walks onto the quad immediately,
 * and the campus survives its host going down.
 *
 * Three.js is vendored under assets/vendor/three, and so now are the
 * styles: assets/site.css carries the compiled utilities and the
 * @font-face rules, with the woff2 files beside it. Nothing this page
 * needs is cross-origin any more, so an offline visit renders properly
 * rather than unstyled — which was the standing caveat here for as
 * long as Tailwind came from a CDN.
 *
 * Deliberately NOT a precache: pulling all of it during install would make
 * a first visit worse to make later ones better, and most of that
 * weight is scenery the visitor may never walk to. Models are cached
 * as they are actually fetched, so the cost follows the use.
 *
 * It also deliberately handles only two kinds of request:
 *
 *   navigations      network-first — a new deploy must win over a stale copy
 *   same-origin art  cache-first   — immutable for a given VERSION
 *
 * Anything cross-origin is left alone — there is nothing left that the
 * page needs, but the rule stays because mediating other people's
 * origins adds real ways to fail: a response that arrived via a
 * redirect cannot legally be returned from a worker, and CDNs redirect.
 * A script that dies that way takes the whole page with it.
 *
 * VERSION tracks the RELEASE and versions only the shell. It used to
 * prefix the model depot too, which meant every release — however
 * text-only — flushed the whole model cache and made a returning
 * phone download the campus again to read a lecture edit. Review
 * caught it. The depot now carries its own version, ASSETS_V, bumped
 * ONLY when a file under assets/ changes in place — new files under
 * new names need no bump, cacheFirst simply fetches them once. The
 * engine and the stylesheet are re-precached by every install with
 * cache:"reload", so they track releases despite living in the depot.
 */
const VERSION = "pembroke-v133";
/* v3 stays even though this release removes assets. Re-versioning the
   depot is a blunt instrument: it throws away every model a returning
   visitor holds — all ~85MB of a campus they already walked — to
   reclaim the ~34MB this release stops using. RETIRED does it
   precisely instead; see the activate handler. */
const ASSETS_V = "pembroke-assets-v3";

/* Files that were in the depot and are not coming back. Deleting an
   asset from the repository does not un-cache it: cacheFirst simply
   never asks for it again, so a phone that once walked into Drosdick
   Hall would carry 27MB of splats for a room that no longer exists,
   forever. Named removal costs one pass over one cache on activate
   and reclaims all of it. An entry may leave this list once no
   plausible visitor still holds the file. */
const RETIRED = [
  "./assets/drosdick_atrium.spz",
  "./assets/drosdick_collider.glb",
  "./assets/cathedral2.glb",
  "./assets/vendor/spark/spark.module.min.js",
  "./assets/vendor/three-mesh-bvh/index.module.js",
];
const SHELL = VERSION + "-shell";
const DEPOT = ASSETS_V + "-depot";

/* A response that arrived through a redirect is rejected by the browser
   when a worker hands it back. Rebuilding it drops the redirect flag and
   keeps the bytes. */
async function plain(res){
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, {
    status: res.status, statusText: res.statusText, headers: res.headers });
}

// The page itself — small, and needed before anything else can happen.
const SHELL_FILES = ["./", "./index.html"];

/* Precache one URL, or fail the install. Failing is the point: see below. */
async function keep(cache, url){
  const res = await plain(await fetch(url, { cache: "reload" }));
  if (!res || !res.ok) throw new Error("precache failed: " + url);
  await cache.put(url, res);
}

/* Which worker is actually serving this page? The page cannot read it
   any other way, and it is the one fact that settles "am I looking at
   the new build or a cached old one" — a question that has now cost
   real time to answer from a screenshot. */
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "version")
    e.source?.postMessage({ type: "version", version: VERSION });
});

self.addEventListener("install", (e) => {
  /* Deliberately allowed to fail. Swallowing an error here and calling
     skipWaiting anyway would activate a worker that knows it has no
     shell, right after activate has deleted the previous version's
     caches — trading a working offline fallback for a broken one and
     saying nothing. Letting install reject instead leaves the existing
     worker in place, still serving, and the browser retries later.

     Not addAll: it stores whatever it gets, and a redirected response
     cached here could never legally be served back. */
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    for (const url of SHELL_FILES) await keep(shell, url);

    /* The engine is precached, unlike the models. It is 1.7MB against
       the depot's tens, it is needed before anything can be drawn, and
       it is fetched
       by the module loader the instant the page parses — long before a
       worker on a first visit has installed and claimed. Left to the
       runtime path it would never be cached on the visit that fetches
       it, and the campus would only work offline from the third visit.

       The list is generated by tools/vendor-three.mjs, so adding an
       import cannot silently leave a hole here. */
    const depot = await caches.open(DEPOT);
    /* The stylesheet is precached like the engine, and into the DEPOT
       rather than the shell — because isArt() matches .css, so every
       later request for it is answered by cacheFirst() looking in the
       DEPOT. Precaching it into the shell, as the first version of this
       did, filed it somewhere nothing would ever look: install
       succeeded, the copy was real, and an offline load could still
       miss it. It only ever appeared to work because by the time
       anything checked, an ordinary fetch had already put a second copy
       in the DEPOT. */
    await keep(depot, "./assets/site.css");
    const manifest = "./assets/vendor/three/files.json";
    const res = await plain(await fetch(manifest, { cache: "reload" }));
    if (!res || !res.ok) throw new Error("cannot read " + manifest);
    const { files } = await res.clone().json();
    await depot.put(manifest, res);
    await Promise.all(files.map((f) => keep(depot, "./assets/vendor/three/" + f)));

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  /* keep exactly the current shell and the current depot: old
     per-release shells go, and so do the old per-release depots from
     the era when VERSION prefixed both — one last flush, never again */
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== DEPOT)
                          .map((k) => caches.delete(k)));
    /* and inside the depot we keep, drop the files that were retired.

       ignoreVary because a stored response carries whatever Vary the
       host sent — GitHub Pages varies on Accept-Encoding — and a
       delete built from a bare URL string has none of those headers
       to match against. Without it the delete can quietly match
       nothing, which is the one failure this whole mechanism exists
       to avoid: 34MB left on a phone with no symptom anybody sees.

       Failing here costs disk, not correctness, so it must never take
       the activation down with it. */
    try {
      const depot = await caches.open(DEPOT);
      await Promise.all(RETIRED.map((u) => depot.delete(u, { ignoreVary: true })));
    } catch (_) {}
    await self.clients.claim();
  })());
});

/* .js is in here for assets/vendor/three — the engine is served from our
   own origin now, so it caches on the same terms as the models.
   .spz is gone with the Marble interior; the pattern keeps it so a
   worker installed before this release still answers for the file it
   is about to delete, rather than going to the network for it. */
const isArt = (url) => /\/assets\/.+\.(glb|spz|png|jpe?g|webp|svg|js|css|woff2)$/i.test(url.pathname);

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
