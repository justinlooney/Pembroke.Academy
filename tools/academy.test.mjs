import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { courseCatalog, filterCatalog, learningDestination, escapeHTML } from "../assets/app/academy.mjs";
import { INTRO_CS } from "../assets/app/intro-cs.mjs";
import { programTrace } from "../assets/app/programming-lab.mjs";
import { gradeAnswer } from "../assets/app/grading.mjs";
import { normalizeStudy } from "../assets/app/progress.mjs";

test("catalog distinguishes 106 available lessons from nine syllabus-only courses", () => {
  const catalog = courseCatalog();
  assert.equal(catalog.length, 12);
  assert.deepEqual(catalog.filter(c => c.available).map(c => c.id).sort(), ["CS101", "MATH101", "MATH201"]);
  assert.equal(catalog.reduce((sum, c) => sum + c.sections.length, 0), 106);
  assert.equal(filterCatalog(catalog, "", "syllabus").length, 9);
  assert.deepEqual(filterCatalog(catalog, "cs 101").map(c => c.id), ["CS101"]);
  assert.deepEqual(filterCatalog(catalog, "a subject that does not exist"), []);
  assert.equal(filterCatalog(catalog, "", "all").length, 12);
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});
test("continue uses a valid saved lesson and never sends a learner to a missing one", () => {
  const state = { MATH101: { "0.1": 2 }, CS101: { "1.1": 2 } };
  const valid = learningDestination(state, { courseId: "CS101", n: "1.3" });
  assert.equal(valid.course.id, "CS101"); assert.equal(valid.section.n, "1.3"); assert.equal(valid.resumed, true);
  for (const invalid of [null, { courseId: "CS201", n: "1.1" }, { courseId: "CS101", n: "missing" }, { courseId: "__proto__", n: "1.1" }]){
    const next = learningDestination(state, invalid);
    assert.equal(next.course.id, "MATH101"); assert.equal(next.section.n, "0.2"); assert.equal(next.resumed, false);
  }
  assert.equal(courseCatalog(state).find(c => c.id === "CS101").mastered, 1);
});
test("CS101 has four complete lessons with gradable positive and negative assertions", () => {
  const sections = INTRO_CS.units.flatMap(u => u.sections);
  assert.equal(sections.length, 4); assert.match(INTRO_CS.lectures, /not the full course/);
  for (const sec of sections){
    assert.equal(sec.full.lecture.length, 4); assert.ok(sec.full.objectives.length >= 3);
    assert.equal(sec.full.viz.kind, "pythontrace"); assert.ok(programTrace(sec.full.viz.trace).frames.length >= 5);
    for (const q of sec.qs){
      assert.equal(gradeAnswer({ ...q, type: "mc" }, String(q.a)).correct, true);
      assert.equal(gradeAnswer({ ...q, type: "mc" }, String((q.a + 1) % q.opts.length)).correct, false);
    }
    for (const q of [...sec.full.turn, ...sec.full.homework.gen.map(f => f())]){
      assert.equal(gradeAnswer(q, String(q.ans)).correct, true);
      assert.equal(gradeAnswer(q, String(q.ans + 1)).correct, false);
      assert.equal(gradeAnswer(q, "").answered, false);
    }
  }
});
test("trace snapshots preserve earlier states, skipped branches and repeated loop lines", () => {
  const assignment = programTrace("assignment"), branch = programTrace("branch"), loop = programTrace("loop"), fn = programTrace("function");
  assert.deepEqual(assignment.frames[0].vars, {});
  assert.deepEqual(assignment.frames[3].vars, { hours: 3, rate: 8, cost: 24 });
  assert.deepEqual(assignment.frames.at(-1).vars, { hours: 4, rate: 8, cost: 24 });
  assert.equal(assignment.frames.at(-1).output, "24 4");
  assert.equal(branch.frames.some(f => f.line === 4), false);
  assert.equal(branch.frames.at(-1).output, "1");
  assert.deepEqual(loop.frames.filter(f => f.line === 2).map(f => f.vars.total), [1, 3, 6]);
  assert.equal(loop.frames.at(-1).output, "6");
  assert.deepEqual(fn.frames.at(-1).vars, { a: 9, b: 16 }); assert.equal(fn.frames.at(-1).output, "25");
  assert.throws(() => programTrace("not-a-program"), RangeError);
});
test("new programming mastery and evidence survive backup normalization", () => {
  const restored = normalizeStudy({ CS101: { "1.1": 1, x: { "1.1": { kc: 1, lab: 1, t0: 1, hw: [2, 2] } }, log: [{ n: "1.1", k: "kc", ok: 1, at: 1 }] } });
  assert.equal(restored.CS101["1.1"], 2); assert.equal(restored.CS101.x["1.1"].lab, 1);
  assert.deepEqual(restored.CS101.x["1.1"].hw, [2, 2]); assert.equal(restored.CS101.log.length, 1);
  assert.equal(normalizeStudy({ CS101: { "1.1": 1, x: { "1.1": { lab: 1 } } } }).CS101["1.1"], 1);
});
test("the offline shell includes every new learning dependency", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  for (const module of ["academy.mjs", "intro-cs.mjs", "programming-lab.mjs", "campus-desk.mjs", "campus-desk.css"])
    assert.ok(sw.includes('"' + module + '"'), module);
});
