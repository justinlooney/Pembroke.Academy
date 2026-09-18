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
/* Sections renamed when College Algebra adopted the textbook's own numbering,
   so that a lesson here and a page there carry the same number.

   Saved progress is keyed by section id, and normalizeStudy keeps only ids the
   current plan still lists — so without this a rename would silently discard a
   learner's mastery, with nothing to tell them that is what happened.

   The marker is not optional. "1.1" named "Expressions and substitution" before
   the renumbering and names "The Coordinate Plane" after it, so the id alone
   cannot say which lesson a saved record meant. normalizeStudy runs on every
   read, so a map applied unconditionally would keep rewriting freshly earned
   1.1 progress into 0.1 forever. A record carrying SCHEMA has already been
   through this and is left alone; one without it predates the renumbering.

   Renaming builds a fresh object rather than mutating in place, which is what
   lets "1.1" move to "0.1" and "G.1" move into "1.1" in the same pass without
   either landing on the other. Entries stay here permanently: a learner may
   come back after years away.                                                */
const SCHEMA = 2;
/* keys in a course record that are not section ids */
const META = new Set(["x", "log", "v"]);
const RENAMED = { MATH101: {
  /* the three orientation lessons stepped aside for Chapter 1 */
  "1.1": "0.1", "1.2": "0.2", "1.3": "0.3",
  /* Chapter 1 onto Stewart's own section numbers */
  "G.1": "1.1", "G.2": "1.2", "G.3": "1.3", "G.4": "1.4", "G.5": "1.5", "G.6": "1.6",
  "G.7": "1.7", "G.8": "1.8", "G.9": "1.9", "G.10": "1.10", "G.12": "1.11",
  "G.11": "1.FM", "G.R": "1.R",
  /* Chapter 4 likewise */
  "EX.1": "4.1", "EX.2": "4.2", "EX.3": "4.3", "EX.4": "4.4", "EX.5": "4.5", "EX.R": "4.R",
  /* Chapters 2 and 3 were consolidated below the book's section count, so two
     of their lessons were split in two and three sections were newly written.
     A split has no single destination: FN.1 became both 2.1 and 2.2, and PF.4
     became both 3.4 and 3.5. Progress moves to the first half, which is where
     that lesson's opening material now lives; the second half starts unstarted,
     because its practice is new and nobody has answered it yet. */
  "FN.1": "2.1", "FN.2": "2.3", "FN.3": "2.6", "FN.4": "2.7", "FN.5": "2.8", "FN.R": "2.R",
  "PF.1": "3.1", "PF.2": "3.2", "PF.3": "3.3", "PF.4": "3.4", "PF.5": "3.6", "PF.R": "3.R",
  /* Chapter 5 gained Partial Fractions at 5.3, which the course had skipped,
     so its nonlinear and inequality lessons shift down a number. */
  "SY.1": "5.1", "SY.2": "5.2", "SY.3": "5.4", "SY.4": "5.5", "SY.R": "5.R",
  /* Chapter 6 taught its four sections in a different order from the book, so
     every lesson moves and none keeps its number: row reduction was second and
     is the book's first section, the algebra of matrices was first and is its
     second, and inverses and determinants likewise trade places. */
  "MX.1": "6.2", "MX.2": "6.1", "MX.3": "6.4", "MX.4": "6.3", "MX.R": "6.R",
} };
function applyRenames(id, src){
  const map = RENAMED[id];
  if (!map || src.v === SCHEMA) return src;
  const move = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[map[k] || k] = v;
    return out;
  };
  const out = move(src);
  if (record(src.x)) out.x = move(src.x);
  if (Array.isArray(src.log)) out.log = src.log.map(e => record(e) && map[e.n] ? { ...e, n: map[e.n] } : e);
  return out;
}
export function normalizeStudy(raw){
  const out = {};
  if (!record(raw)) return out;
  for (const [id, plan] of Object.entries(STUDY)){
    if (!record(raw[id])) continue;
    const src = applyRenames(id, raw[id]), dst = out[id] = {}, sections = plan.units.flatMap(u => u.sections);
    const sectionIds = new Set(sections.map(s => s.n));
    for (const sec of sections){
      if (src[sec.n] === 1 || src[sec.n] === 2) dst[sec.n] = src[sec.n];
      const ext = src.x?.[sec.n];
      if (!record(ext)) continue;
      const x = (dst.x ||= {})[sec.n] = {};
      for (const key of ["kc", "lab", ...((sec.full?.turn || []).map((_, i) => "t" + i))]) if (flag(ext[key])) x[key] = 1;
      if (Array.isArray(ext.hw) && ext.hw.length === 2 && ext.hw.every(Number.isFinite) && ext.hw[1] > 0 && ext.hw[0] >= 0 && ext.hw[0] <= ext.hw[1]) x.hw = ext.hw;
      const ps = id === "MATH201" ? MATH201_PSET[sec.n] : sec.full?.practice || null;
      if (ps && record(ext.ps)){
        const earned = {};
        for (const k of psetGradedKeys(ps)) if (ext.ps.earned?.[k] === 1) earned[k] = 1;
        x.ps = { earned };
        if (practiceCleared(ps, earned)) x.ps.cleared = 1;
      }
      // Evidence may have saved before the section-level promotion did.
      if (x.kc === 1 && practiceCleared(ps, x.ps?.earned)) dst[sec.n] = 2;
    }
    dst.v = SCHEMA;   /* stamped so the rename above never runs on this record twice */
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
    /* count sections, not bookkeeping: a course record also carries x, log
       and the schema marker, and the marker's value is a number that means
       "mastered" one key over. */
    mastered: Object.values(learned).reduce((sum, c) => sum +
      Object.entries(c).filter(([k, v]) => !META.has(k) && v === 2).length, 0) };
}
