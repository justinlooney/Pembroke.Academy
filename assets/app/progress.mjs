import { COURSES } from "./courses.mjs";
import { STUDY } from "./course-study.mjs";
import { MATH201_PSET } from "./problem-sets.mjs";
import { psetGradedKeys, practiceCleared } from "./grading.mjs";

export const KEYS = Object.freeze({ done: "pembroke.registrar.completed", study: "pembroke.study",
  journey: "pembroke.registrar.journey", npc: "pembroke.npc", resume: "pembroke.learning.resume" });
const JOURNAL = "pembroke.progress.import-journal.v1";
const ids = new Set(COURSES.map(c => c.id));
const record = v => !!v && typeof v === "object" && !Array.isArray(v);
const safeKey = k => !["__proto__", "constructor", "prototype"].includes(k);
const time = v => typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
const text = (v, max = 500) => typeof v === "string" ? v.slice(0, max) : "";
const flag = v => v === 1 ? 1 : 0;
const courseIds = raw => Array.isArray(raw) ? [...new Set(raw.filter(id => typeof id === "string" && ids.has(id)))] : [];
export function normalizeDone(raw){
  const requested = courseIds(raw), accepted = new Set();
  // Resolve the prerequisite graph regardless of the backup's array order.
  for (let changed = true; changed;){
    changed = false;
    for (const course of COURSES){
      if (requested.includes(course.id) && !accepted.has(course.id) && course.prereqs.every(id => accepted.has(id))){
        accepted.add(course.id); changed = true;
      }
    }
  }
  return requested.filter(id => accepted.has(id));
}
export function normalizeStudy(raw){
  const out = {};
  if (!record(raw)) return out;
  for (const [id, plan] of Object.entries(STUDY)){
    if (!record(raw[id])) continue;
    const src = raw[id], dst = out[id] = {}, sections = plan.units.flatMap(u => u.sections);
    const sectionIds = new Set(sections.map(s => s.n));
    for (const sec of sections){
      if (src[sec.n] === 1 || src[sec.n] === 2) dst[sec.n] = src[sec.n];
      const ext = src.x?.[sec.n];
      if (!record(ext)) continue;
      const x = (dst.x ||= {})[sec.n] = {};
      for (const key of ["kc", "lab", ...((sec.full?.turn || []).map((_, i) => "t" + i))]) if (flag(ext[key])) x[key] = 1;
      if (Array.isArray(ext.hw) && ext.hw.length === 2 && ext.hw.every(Number.isFinite) && ext.hw[1] > 0 && ext.hw[0] >= 0 && ext.hw[0] <= ext.hw[1]) x.hw = ext.hw;
      const ps = id === "MATH201" ? MATH201_PSET[sec.n] : null;
      if (ps && record(ext.ps)){
        const earned = {};
        for (const k of psetGradedKeys(ps)) if (ext.ps.earned?.[k] === 1) earned[k] = 1;
        x.ps = { earned };
        if (practiceCleared(ps, earned)) x.ps.cleared = 1;
      }
      // Evidence may have saved before the section-level promotion did.
      if (x.kc === 1 && practiceCleared(ps, x.ps?.earned)) dst[sec.n] = 2;
    }
    if (Array.isArray(src.log)) dst.log = src.log.filter(e => record(e) && sectionIds.has(e.n) &&
      ["kc", "turn", "hw", "pset"].includes(e.k) && (e.ok === 0 || e.ok === 1) && time(e.at))
      .slice(-60).map(({ n, k, ok, at }) => ({ n, k, ok, at }));
  }
  return out;
}
export function normalizeNPC(raw){
  const out = { rel: {}, mem: {} };
  if (!record(raw)) return out;
  for (const [name, rel] of Object.entries(record(raw.rel) ? raw.rel : {})){
    if (!safeKey(name) || name.length > 80 || !record(rel)) continue;
    out.rel[name] = { met: Number.isInteger(rel.met) && rel.met >= 0 ? rel.met : 0,
      fam: Number.isFinite(rel.fam) ? Math.max(0, Math.min(1, rel.fam)) : 0 };
  }
  for (const [name, mem] of Object.entries(record(raw.mem) ? raw.mem : {})){
    if (!safeKey(name) || name.length > 80 || !Array.isArray(mem)) continue;
    out.mem[name] = mem.filter(m => record(m) && typeof m.f === "string" && time(m.at))
      .slice(0, 12).map(m => ({ f: text(m.f, 300), at: m.at, imp: Number.isFinite(m.imp) ? Math.max(0, Math.min(1, m.imp)) : 0 }));
  }
  return out;
}
export function normalizeJourney(raw, completed = []){
  const r = record(raw) ? raw : {}, a = record(r.admissions) ? r.admissions : {}, cv = r.onboarding?.campusVisit || {};
  const application = v => {
    if (!record(v)) return null;
    return Object.fromEntries(Object.entries(v).filter(([k, v]) => safeKey(k) && typeof v === "string").map(([k, v]) => [k, text(v, 2000)]));
  };
  const out = {
    onboarding: { campusVisit: { status: ["new", "active", "done"].includes(cv.status) ? cv.status : "new",
      steps: Object.fromEntries(["look", "walk", "talk", "adm", "ledger"].filter(k => (cv.steps?.[k] === true || time(cv.steps?.[k]))).map(k => [k, cv.steps[k]])),
      completedAt: time(cv.completedAt), hidden: cv.hidden === true } },
    admissions: { draft: application(a.draft), application: application(a.application),
      applicationStatus: ["none", "draft", "submitted", "accepted"].includes(a.applicationStatus) ? a.applicationStatus : "none",
      applicationSubmittedAt: time(a.applicationSubmittedAt), acceptedAt: time(a.acceptedAt), term: text(a.term, 100) || null },
    advising: { status: ["new", "active", "done"].includes(r.advising?.status) ? r.advising.status : "new", completedAt: time(r.advising?.completedAt) },
    academics: { declaredMajorId: ["lib", "eng", "sci", "adm"].includes(r.academics?.declaredMajorId) ? r.academics.declaredMajorId : null,
      declaredAt: time(r.academics?.declaredAt) },
    registration: { term: text(r.registration?.term, 100) || null, registeredCourseIds: courseIds(r.registration?.registeredCourseIds), completedAt: time(r.registration?.completedAt) }
  };
  const admission = out.admissions;
  // Admission requires a submitted form; orientation remains independently optional.
  if (!admission.application) admission.applicationSubmittedAt = null;
  if (!admission.applicationSubmittedAt){
    admission.acceptedAt = null;
    admission.draft ||= admission.application;
    admission.application = null;
  }
  admission.applicationStatus = admission.acceptedAt ? "accepted" : admission.applicationSubmittedAt ? "submitted" : admission.draft ? "draft" : "none";
  if (!admission.acceptedAt) out.advising = { status: "new", completedAt: null };
  else out.advising.status = out.advising.completedAt ? "done" : out.advising.status === "active" ? "active" : "new";
  if (!out.advising.completedAt) out.academics = { declaredMajorId: null, declaredAt: null };
  if (!out.academics.declaredMajorId){
    out.academics.declaredAt = null;
    out.registration = { term: null, registeredCourseIds: [], completedAt: null };
  } else {
    const seals = new Set(normalizeDone(completed));
    out.registration.registeredCourseIds = out.registration.registeredCourseIds.filter(id =>
      COURSES.find(c => c.id === id).prereqs.every(prerequisite => seals.has(prerequisite)));
    if (!out.registration.registeredCourseIds.length) out.registration.completedAt = null;
  }
  return out;
}
function normalizeResume(raw){
  return record(raw) && typeof raw.courseId === "string" && Object.hasOwn(STUDY, raw.courseId) && STUDY[raw.courseId].units.some(u => u.sections.some(s => s.n === raw.n))
    ? { courseId: raw.courseId, n: raw.n } : null;
}
const normalizers = { done: normalizeDone, study: normalizeStudy, journey: normalizeJourney, npc: normalizeNPC, resume: normalizeResume };
export function readJSON(store, key, fallback){ try { return JSON.parse(store.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } }

/** A failed write remains in memory for export and is never reported as saved. */
export function createStorage(getBackend, notify = () => {}){
  const pending = new Map(), snapshots = new Map();
  let lastSaved = null, unavailable = false, recoveryFailed = false, conflict = false;
  const status = () => ({ lastSaved, unsaved: pending.size, unavailable, recoveryFailed, conflict });
  const publish = () => notify(status());
  function recover(){
    try {
      const backend = getBackend(), raw = backend.getItem(JOURNAL);
      if (raw){
        const before = JSON.parse(raw);
        if (!record(before) || Object.keys(before).some(k => !Object.values(KEYS).includes(k)) ||
          Object.values(before).some(v => v !== null && typeof v !== "string")) throw new Error("Invalid recovery record");
        for (const [key, value] of Object.entries(before)) value === null ? backend.removeItem(key) : backend.setItem(key, value);
        backend.removeItem(JOURNAL);
      }
      recoveryFailed = false;
    } catch { unavailable = true; recoveryFailed = true; }
  }
  recover();
  // Import replaces every progress domain, including ones this view never reads.
  // Snapshot those at boot too, so an import cannot overwrite a newer tab's work.
  try {
    const backend = getBackend();
    for (const key of Object.values(KEYS)) snapshots.set(key, backend.getItem(key));
  } catch { unavailable = true; }
  function assertCurrent(backend, key){
    if (conflict) throw new Error("Progress changed in another tab. Export unsaved work, then reload before saving or importing.");
    const current = backend.getItem(key);
    if (!snapshots.has(key)) snapshots.set(key, current);
    if (snapshots.get(key) !== current){
      conflict = true;
      throw new Error("Progress changed in another tab. Export unsaved work, then reload before saving or importing.");
    }
    return current;
  }
  function write(key, value){
    pending.set(key, value);
    try {
      if (recoveryFailed) throw new Error("Import recovery needed");
      const backend = getBackend();
      assertCurrent(backend, key);
      value === null ? backend.removeItem(key) : backend.setItem(key, value);
      snapshots.set(key, value); pending.delete(key); lastSaved = Date.now(); unavailable = false; publish(); return true;
    } catch { unavailable = true; publish(); return false; }
  }
  return {
    getItem(key){
      if (pending.has(key)) return pending.get(key);
      try { const value = getBackend().getItem(key); if (!snapshots.has(key)) snapshots.set(key, value); return value; } catch { unavailable = true; publish(); return null; }
    },
    setItem: (key, value) => write(key, String(value)), removeItem: key => write(key, null), status,
    retry(){ if (recoveryFailed) recover(); for (const [key, value] of [...pending]) write(key, value); publish(); },
    importRecords(records){
      if (recoveryFailed) throw new Error("Previous import needs recovery. Retry saving first.");
      const backend = getBackend(), before = {};
      try {
        for (const key of Object.keys(records)){
          if (!Object.values(KEYS).includes(key)) throw new Error("Unknown progress key");
          before[key] = assertCurrent(backend, key);
        }
      } catch (error){ unavailable = true; publish(); throw error; }
      // Persist the undo record before changing any progress. Recovery runs before loaders.
      backend.setItem(JOURNAL, JSON.stringify(before));
      try {
        for (const [key, value] of Object.entries(records)) backend.setItem(key, JSON.stringify(value));
        backend.removeItem(JOURNAL);
      } catch (error){ recover(); publish(); throw new Error("Import failed; previous progress restored where storage allowed. " + error.message); }
      for (const key of Object.keys(records)){ pending.delete(key); snapshots.set(key, JSON.stringify(records[key])); }
      conflict = false;
      lastSaved = Date.now(); unavailable = false; publish();
    }
  };
}
export const storage = createStorage(() => globalThis.localStorage, detail => {
  if (typeof globalThis.dispatchEvent === "function") globalThis.dispatchEvent(new CustomEvent("pembroke-save", { detail }));
});
export function exportProgress(store = storage){
  const data = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, readJSON(store, key, null)]));
  const done = normalizeDone(data.done);
  return { format: "pembroke-progress", version: 1, exportedAt: new Date().toISOString(),
    data: Object.fromEntries(Object.keys(KEYS).map(name => [name, name === "journey" ? normalizeJourney(data[name], done) : normalizers[name](data[name])])) };
}
export function previewImport(contents){
  if (typeof contents !== "string" || contents.length > 2_000_000) throw new Error("Choose a JSON backup smaller than 2 MB.");
  const file = JSON.parse(contents);
  if (file?.format !== "pembroke-progress" || file.version !== 1 || !record(file.data)) throw new Error("Unsupported Pembroke backup format or version.");
  if (Object.keys(KEYS).some(k => !Object.hasOwn(file.data, k))) throw new Error("The backup is missing a progress section.");
  const records = {}, repairs = [];
  const done = normalizeDone(file.data.done);
  for (const [name, key] of Object.entries(KEYS)){
    records[key] = name === "journey" ? normalizeJourney(file.data[name], done) : normalizers[name](file.data[name]);
    if (JSON.stringify(records[key]) !== JSON.stringify(file.data[name])) repairs.push(name);
  }
  const learned = records[KEYS.study];
  return { records, repairs, seals: records[KEYS.done].length,
    mastered: Object.values(learned).reduce((sum, c) => sum + Object.values(c).filter(v => v === 2).length, 0) };
}
