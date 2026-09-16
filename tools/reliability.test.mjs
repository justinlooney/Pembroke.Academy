import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import worker, { validate, startProvider } from "../worker/src/index.mjs";
import { aiParse, DIALOGUE_LIMIT } from "../assets/app/ai-policy.mjs";
import { COURSES } from "../assets/app/courses.mjs";
import { STUDY } from "../assets/app/course-study.mjs";
import { gradeAnswer, practiceCleared } from "../assets/app/grading.mjs";
import { normalizeStudy, normalizeDone, normalizeNPC, normalizeJourney, createStorage, KEYS, exportProgress, previewImport } from "../assets/app/progress.mjs";
const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };

test("completion IDs are known and distinct", () => {
  assert.deepEqual(normalizeDone([...Array(12).fill("MATH101"), "unknown", null, ["CS101"]]), ["MATH101"]);
});
test("malformed study containers cannot swallow newly earned work", () => {
  for (const value of [[], null, "bad", 42]){
    const state = normalizeStudy(value); state.MATH201 = { "1.1": 2 };
    assert.equal(JSON.parse(JSON.stringify(state)).MATH201["1.1"], 2);
  }
  const state = normalizeStudy({ MATH201: { "1.1": 2, "1.2": "2", x: { "1.1": { ps: { earned: null }, hw: [1, 0] } }, log: [null] }, garbage: {} });
  assert.equal(state.MATH201["1.1"], 2); assert.equal(state.MATH201["1.2"], undefined);
  assert.deepEqual(state.MATH201.x["1.1"].ps.earned, {}); assert.equal(state.MATH201.x["1.1"].hw, undefined);
  assert.deepEqual(state.MATH201.log, []);
});
test("NPC and Journey repair nested fields while retaining valid progress", () => {
  assert.deepEqual(normalizeNPC({ rel: null, mem: null }), { rel: {}, mem: {} });
  const out = normalizeJourney({ registration: { registeredCourseIds: ["CS101", "CS101", {}], completedAt: [] },
    admissions: { application: { name: "Alex", email: null }, acceptedAt: 123 },
    onboarding: { campusVisit: { steps: { look: 500, walk: true, talk: "yes" } } } });
  assert.deepEqual(out.registration.registeredCourseIds, ["CS101"]); assert.equal(out.registration.completedAt, null);
  assert.equal(out.admissions.acceptedAt, 123); assert.deepEqual(out.admissions.application, { name: "Alex" });
  assert.deepEqual(out.onboarding.campusVisit.steps, { look: 500, walk: true });
  assert.equal({}.polluted, undefined);
});
test("quota failure remains exportable, visibly unsaved, and retryable", () => {
  const backend = memory(); let blocked = false, seen;
  const set = backend.setItem; backend.setItem = (k, v) => { if (blocked) throw new Error("Quota exceeded"); set(k, v); };
  const store = createStorage(() => backend, s => seen = s); blocked = true;
  assert.equal(store.setItem(KEYS.study, JSON.stringify({ MATH101: { "1.1": 2 } })), false);
  assert.equal(seen.unsaved, 1); assert.equal(seen.lastSaved, null);
  assert.equal(exportProgress(store).data.study.MATH101["1.1"], 2);
  blocked = false; store.retry(); assert.equal(store.status().unsaved, 0);
  assert.equal(JSON.parse(backend.getItem(KEYS.study)).MATH101["1.1"], 2);
});
test("backup preview and import preserve all supported domains", () => {
  const backend = memory(), store = createStorage(() => backend);
  store.setItem(KEYS.study, JSON.stringify({ MATH201: { "1.1": 2, x: { "1.1": { kc: 1, lab: 1, hw: [2, 3], ps: { earned: { "2": 1 } } } } } }));
  store.setItem(KEYS.done, '["MATH101"]');
  const file = exportProgress(store), preview = previewImport(JSON.stringify(file));
  assert.equal(preview.mastered, 1); assert.equal(preview.seals, 1); assert.deepEqual(preview.repairs, []);
  const other = memory(), target = createStorage(() => other); target.importRecords(preview.records);
  assert.deepEqual(exportProgress(target).data, file.data);
});
test("failed import restores old values before another write", () => {
  const backend = memory(), store = createStorage(() => backend);
  backend.setItem(KEYS.done, '["CS101"]'); backend.setItem(KEYS.study, '{"MATH101":{"1.1":1}}');
  const set = backend.setItem; let failed = false;
  backend.setItem = (k, v) => { if (k === KEYS.study && !failed){ failed = true; throw new Error("quota"); } set(k, v); };
  assert.throws(() => store.importRecords({ [KEYS.done]: ["MATH101"], [KEYS.study]: {} }), /Import failed/);
  assert.equal(backend.getItem(KEYS.done), '["CS101"]'); assert.equal(JSON.parse(backend.getItem(KEYS.study)).MATH101["1.1"], 1);
  assert.equal(backend.getItem("pembroke.progress.import-journal.v1"), null);
});
test("an interrupted import recovers on next initialization", () => {
  const backend = memory(); backend.setItem(KEYS.done, '["MATH101"]');
  backend.setItem("pembroke.progress.import-journal.v1", JSON.stringify({ [KEYS.done]: '["CS101"]' }));
  const store = createStorage(() => backend); assert.equal(store.getItem(KEYS.done), '["CS101"]'); assert.equal(store.status().recoveryFailed, false);
});
test("invalid backup format cannot replace current progress", () => {
  for (const source of ['{}', '{"format":"pembroke-progress","version":2,"data":{}}', '[]']) assert.throws(() => previewImport(source));
});
test("registry rejects inherited and coerced IDs before inference", async () => {
  let called = 0;
  for (const characterId of ["__proto__", "constructor", "toString", ["marcus"], {}, 3]){
    assert.equal(validate({ characterId, message: "hello" }), "unknown character");
    const res = await worker.fetch(new Request("https://gw.test/chat", { method: "POST", headers: { origin: "https://campus.test", "content-type": "application/json" }, body: JSON.stringify({ characterId, message: "hello" }) }), { ALLOWED_ORIGIN: "https://campus.test", AI_ENABLED: "1", RL: { limit: async () => ({ success: true }) }, AI: { run(){ called++; } } });
    assert.equal(res.status, 404);
  }
  assert.equal(called, 0);
});
test("localhost access is off in production", async () => {
  const res = await worker.fetch(new Request("https://gw.test/health", { headers: { origin: "http://localhost:8099" } }), { ALLOWED_ORIGIN: "https://campus.test", AI_ENABLED: "1" }); assert.equal(res.status, 403);
});
test("startup deadline settles an uncooperative provider", { timeout: 1000 }, async () => {
  const ctrl = new AbortController(); await assert.rejects(startProvider(() => new Promise(() => {}), ctrl, 15), /deadline/); assert.equal(ctrl.signal.aborted, true);
});
test("the fetch handler returns 502 for a pending provider", { timeout: 1000 }, async () => {
  const res = await worker.fetch(new Request("https://gw.test/chat", { method: "POST", headers: { origin: "https://campus.test", "content-type": "application/json" }, body: JSON.stringify({ characterId: "marcus", message: "hello" }) }), { ALLOWED_ORIGIN: "https://campus.test", AI_ENABLED: "1", AI_STARTUP_MS: "15", RL: { limit: async () => ({ success: true }) }, AI: { run: () => new Promise(() => {}) } }); assert.equal(res.status, 502);
});
test("late streams are cancelled and cooperative rejection is observed", async () => {
  let resolve, cancelled = false;
  await assert.rejects(startProvider(() => new Promise(r => resolve = r), new AbortController(), 10));
  resolve(new ReadableStream({ cancel(){ cancelled = true; } })); await new Promise(r => setTimeout(r, 1)); assert.equal(cancelled, true);
  const ctrl = new AbortController(); await assert.rejects(startProvider(() => new Promise((_, reject) => ctrl.signal.addEventListener("abort", () => reject(new Error("aborted")))), ctrl, 10));
});
test("all AI parse paths cap dialogue and discard structured intent targets", () => {
  const long = "a".repeat(10_000);
  for (const raw of [JSON.stringify({ dialogue: long }), '```json\n' + JSON.stringify({ dialogue: long }) + '\n```', '{"dialogue":"' + long + '", broken}', 'dialogue:' + long + ', emotion:happy']) assert.equal(aiParse(raw).dialogue.length, DIALOGUE_LIMIT);
  assert.deepEqual(aiParse('{"dialogue":"hello","intent":{"type":"open_practice","target":[]}}').intent, { type: "open_practice" });
});
test("grading treats blanks as unanswered and rejects numeric prefixes", () => {
  assert.deepEqual(gradeAnswer({ ans: 3 }, " "), { answered: false, correct: false });
  for (const value of ["3oops", "Infinity", "0x3"]) assert.equal(gradeAnswer({ ans: 3 }, value).correct, false);
  assert.equal(gradeAnswer({ ans: 3 }, "3.0").correct, true);
  assert.equal(practiceCleared([{ ans: 1 }, { ans: 2 }, { ans: 3 }, { ans: 4 }], { 0: 1, 1: 1 }), false);
  assert.equal(practiceCleared([{ ans: 1 }, { ans: 2 }, { ans: 3 }, { ans: 4 }], { 0: 1, 1: 1, 3: 1 }), true);
});
test("introductory unit has no catalog prerequisite and has complete practice", () => {
  assert.deepEqual(COURSES.find(c => c.id === "MATH101").prereqs, []);
  const sections = STUDY.MATH101.units.flatMap(u => u.sections); assert.equal(sections.length, 3);
  for (const s of sections){ assert.ok(s.full.worked.steps.length >= 3 && s.full.turn.length >= 2 && s.qs.length >= 3);
    for (const q of [...s.full.turn, ...s.full.homework.gen.map(fn => fn())]) assert.equal(gradeAnswer(q, q.ans).correct, true);
    for (const q of s.qs) assert.ok(q.opts[q.a] && q.why);
  }
});
function serviceWorker(fetcher, hit = new Response("<body>saved</body>")){
  const handlers = {}, removed = [], cache = { match: async () => hit?.clone(), put: async () => {}, delete: async () => {} };
  const context = { self: { addEventListener: (k, f) => handlers[k] = f, clients: { claim: async () => {} }, location: { origin: "https://campus.test" } },
    caches: { keys: async () => ["pembroke-v150-shell", "pembroke-v151-shell", "pembroke-assets-v3-depot", "other-app-cache"], delete: async k => removed.push(k), open: async () => cache },
    fetch: fetcher, Response, Headers, URL, AbortController, setTimeout, clearTimeout };
  vm.createContext(context); vm.runInContext(readFileSync(new URL("../sw.js", import.meta.url), "utf8") + '\nthis.networkFirst = networkFirst;', context);
  return { handlers, removed, load: () => context.networkFirst({ url: "https://campus.test/index.html", mode: "navigate" }, "shell", 15) };
}
test("activation deletes only obsolete Pembroke caches", async () => {
  const sw = serviceWorker(); let task; sw.handlers.activate({ waitUntil(p){ task = p; } }); await task;
  assert.deepEqual(sw.removed, ["pembroke-v150-shell"]);
});
test("navigation fallback handles rejection, transient status, and a hung network", { timeout: 1000 }, async () => {
  for (const fetcher of [async () => { throw new Error("offline"); }, async () => new Response("down", { status: 503 }), () => new Promise(() => {})]){
    const res = await serviceWorker(fetcher).load(); assert.equal(res.status, 200); assert.match(await res.text(), /saved copy/);
  }
  const fresh = await serviceWorker(async () => new Response("fresh")).load(); assert.equal(await fresh.text(), "fresh");
  const gone = await serviceWorker(async () => new Response("gone", { status: 404 })).load(); assert.equal(gone.status, 404);
  const noCache = await serviceWorker(async () => new Response("down", { status: 503 }), null).load(); assert.equal(noCache.status, 503);
  await assert.rejects(serviceWorker(async () => { throw new Error("offline"); }, null).load());
});

test("an older tab cannot overwrite progress saved by a newer tab", () => {
  const backend = memory(), oldTab = createStorage(() => backend), newTab = createStorage(() => backend);
  assert.equal(oldTab.getItem(KEYS.study), null);
  newTab.setItem(KEYS.study, '{"MATH101":{"1.1":2}}');
  assert.equal(oldTab.setItem(KEYS.study, '{"MATH101":{"1.2":1}}'), false);
  assert.equal(oldTab.status().conflict, true);
  assert.equal(JSON.parse(backend.getItem(KEYS.study)).MATH101["1.1"], 2);
  assert.equal(exportProgress(oldTab).data.study.MATH101["1.2"], 1);
});
