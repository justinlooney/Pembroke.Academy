import { COURSES } from "./courses.mjs";
import { STUDY } from "./course-study.mjs";
import { MATH201_PSET } from "./problem-sets.mjs";
import { ST_VIZ, PSET_ART } from "./figures.mjs";
import { gradeAnswer, recordCheck, psetGradedKeys, practiceCleared } from "./grading.mjs";
import { storage, KEYS, normalizeStudy, readJSON } from "./progress.mjs";
import { mountProgressTools } from "./progress-ui.mjs";
mountProgressTools();
const courseSelect = document.getElementById("course"), lesson = document.getElementById("lesson");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sections = id => Object.hasOwn(STUDY, id) ? STUDY[id].units.flatMap(u => u.sections) : [];
const state = normalizeStudy(readJSON(storage, KEYS.study, {}));
const save = () => storage.setItem(KEYS.study, JSON.stringify(state));
const ext = (id, n) => (((state[id] ||= {}).x ||= {})[n] ||= {});
const setOf = (id, n) => id === "MATH201" ? MATH201_PSET[n] : null;
function mastery(id, n){
  const x = ext(id, n), ps = setOf(id, n);
  if (x.kc === 1 && practiceCleared(ps, x.ps?.earned)) state[id][n] = 2;
}
function current(){
  const params = new URLSearchParams(location.hash.slice(1));
  const requested = params.get("course"), id = COURSES.some(c => c.id === requested) ? requested : "MATH101", list = sections(id);
  const resume = readJSON(storage, KEYS.resume, null);
  const requestedLesson = list.find(s => s.n === params.get("lesson"));
  const savedLesson = resume?.courseId === id ? list.find(s => s.n === resume.n) : null;
  return { id, n: requestedLesson?.n || savedLesson?.n || list.find(s => state[id]?.[s.n] !== 2)?.n || list[0]?.n };
}
const route = (id, n) => `#${new URLSearchParams({ course: id, ...(n ? { lesson: n } : {}) })}`;
courseSelect.innerHTML = COURSES.map(c => `<option value="${c.id}">${c.code} · ${c.title}${sections(c.id).length ? "" : " · Syllabus only"}</option>`).join("");
courseSelect.onchange = () => { location.hash = route(courseSelect.value); };
function navigation(id, n){
  courseSelect.value = id;
  const list = sections(id), plan = STUDY[id];
  document.getElementById("availability").textContent = plan?.lectures || "Syllabus only. Lessons are coming later; explore other available courses now.";
  document.getElementById("course-progress").textContent = list.length ? `${list.filter(s => state[id]?.[s.n] === 2).length} of ${list.length} available lessons mastered` : "";
  document.getElementById("lessons").innerHTML = plan ? plan.units.map(u => `<h3>${esc(u.title)}</h3>${u.sections.map(s => `<a href="${route(id, s.n)}" ${s.n === n ? 'aria-current="page"' : ""}>${state[id]?.[s.n] === 2 ? "✓ " : ""}${esc(s.n)} · ${esc(s.t)}</a>`).join("")}`).join("") : "";
}
function inputs(q, name){
  return q.type === "mc" || q.opts ? q.opts.map((o, i) => `<label><input type="radio" name="${name}" value="${i}"><span>${o}</span></label>`).join("")
    : `<label>Your answer <input type="text" inputmode="decimal" name="${name}" autocomplete="off"></label>`;
}
function value(host){ return host.querySelector("input:checked")?.value ?? host.querySelector("input[type=text]")?.value; }
function feedback(host, result, success, failure){
  host.classList.toggle("right", result.answered && result.correct);
  host.classList.toggle("wrong", result.answered && !result.correct);
  host.querySelector(".feedback").textContent = !result.answered ? "Enter an answer before checking." : result.correct ? success : failure;
}
function checkForm(id, sec){
  return `<h2>Knowledge check</h2><p>Answer every question. Pass all checks${setOf(id, sec.n) ? " and earn at least 75% of the required problem set" : ""} to master this lesson.</p><form id="knowledge">${sec.qs.map((q, i) => `<fieldset data-question="${i}"><legend>${i + 1}. ${q.q}</legend>${inputs(q, "kc" + i)}<p class="feedback" role="status"></p></fieldset>`).join("")}<button>Check my work</button><p id="check-status" role="status"></p></form>`;
}
function turnForm(q, i){ return `<fieldset data-turn="${i}"><legend>${q.q}</legend>${inputs(q, "turn" + i)}<button type="button">Check answer</button><p class="feedback" role="status"></p></fieldset>`; }
function render(focus = false){
  const { id, n } = current(), course = COURSES.find(c => c.id === id), sec = sections(id).find(s => s.n === n);
  navigation(id, n);
  if (!sec){
    lesson.innerHTML = `<h1>${esc(course.title)}</h1><p>${esc(course.desc)}</p><div class="notice">Syllabus only — lessons for this course are coming later.</div><h2>Course goals</h2><ul>${course.outcomes.map(o => `<li>${esc(o)}</li>`).join("")}</ul><a href="${route("MATH101", "1.1")}">Start College Algebra, Unit I</a>`;
    return;
  }
  const x = ext(id, n), full = sec.full;
  state[id][n] ||= 1;
  storage.setItem(KEYS.resume, JSON.stringify({ courseId: id, n })); save();
  document.title = `${course.code} · ${sec.t} · Pembroke`;
  lesson.innerHTML = `<p class="eyebrow">${esc(course.code)} · Lesson ${esc(n)}</p><h1>${sec.t}</h1><p>${sec.brief}</p><p class="key">${sec.key}</p>
    ${full ? `<p>${full.professor}</p><h2>Learning goals</h2><ul>${full.objectives.map(o => `<li>${o}</li>`).join("")}</ul>${full.lecture.map(([h, p]) => `<h2>${h}</h2><p>${p}</p>`).join("")}
    <h2>Explore the model</h2><canvas id="figure" width="640" height="360" role="img" aria-label="${esc(full.viz.note)}"></canvas><label for="model">Interactive control</label><input id="model" type="range" min="0" max="1000" value="0"><p id="readout" class="readout" aria-live="polite"></p><p>${full.viz.note}</p>
    <h2>Worked example</h2><p>${full.worked.prompt}</p>${full.worked.steps.map(([ask, reveal]) => `<details><summary>${ask}</summary><p>${reveal}</p></details>`).join("")}<h2>Your turn</h2>${full.turn.map(turnForm).join("")}` : ""}
    ${checkForm(id, sec)}
    <div class="actions">${setOf(id, n) ? '<button id="practice">Open required practice</button>' : ""}${full ? '<button id="homework">Homework</button>' : ""}</div>
    <p id="mastery" class="notice" role="status">${state[id][n] === 2 ? "Lesson mastered ✓" : x.kc ? "Checks passed. Complete required practice to master this lesson." : "Lesson opened. Knowledge checks are not yet passed."}</p>
    <div class="actions">${sections(id)[sections(id).indexOf(sec) + 1] ? `<a href="${route(id, sections(id)[sections(id).indexOf(sec) + 1].n)}">Next lesson →</a>` : '<p>You have reached the end of the currently available lessons for this course.</p>'}</div>`;
  lesson.querySelector("#knowledge").onsubmit = e => {
    e.preventDefault();
    const hosts = [...lesson.querySelectorAll("[data-question]")], results = sec.qs.map((q, i) => gradeAnswer({ ...q, type: "mc" }, value(hosts[i])));
    if (results.some(r => !r.answered)){
      lesson.querySelector("#check-status").textContent = "Answer every question before checking. Nothing has been graded.";
      hosts[results.findIndex(r => !r.answered)].querySelector("input").focus(); return;
    }
    results.forEach((result, i) => { recordCheck(state, id, n, "kc", result.correct); feedback(hosts[i], result, "✓ " + sec.qs[i].why, "Not yet. " + sec.qs[i].why); });
    if (results.every(r => r.correct)) x.kc = 1;
    mastery(id, n); save(); navigation(id, n);
    lesson.querySelector("#check-status").textContent = `${results.filter(r => r.correct).length} of ${results.length} correct.`;
    lesson.querySelector("#mastery").textContent = state[id][n] === 2 ? "Lesson mastered ✓" : x.kc ? "Checks passed. Complete required practice to master this lesson." : "Try the questions again after reviewing the feedback.";
  };
  if (full){
    const slider = lesson.querySelector("#model"), draw = () => ST_VIZ[full.viz.kind](lesson.querySelector("#figure"), Number(slider.value) / 1000, lesson.querySelector("#readout"), "#e2c488", full.viz);
    slider.oninput = () => { draw(); if (!x.lab){ x.lab = 1; save(); } }; draw();
    full.turn.forEach((q, i) => {
      const host = lesson.querySelector(`[data-turn="${i}"]`);
      host.querySelector("button").onclick = () => {
        const result = gradeAnswer(q, value(host));
        feedback(host, result, "✓ " + q.work, "Not yet. " + q.hint);
        if (result.answered){ if (result.correct) x["t" + i] = 1; recordCheck(state, id, n, "turn", result.correct); save(); }
      };
    });
    lesson.querySelector("#homework").onclick = () => homework(id, sec);
  }
  lesson.querySelector("#practice")?.addEventListener("click", () => practice(id, sec));
  if (focus) lesson.focus();
}
function homework(id, sec){
  const qs = sec.full.homework.gen.map(fn => fn()), n = sec.n;
  lesson.innerHTML = `<h1>${sec.full.homework.title}</h1><form>${qs.map((q, i) => `<fieldset data-hw="${i}"><legend>${q.q}</legend>${inputs(q, "hw" + i)}<p class="feedback" role="status"></p></fieldset>`).join("")}<button>Check homework</button><p id="hw-status" role="status"></p></form><button id="back">Back to lesson</button>`;
  lesson.querySelector("form").onsubmit = e => {
    e.preventDefault(); const hosts = [...lesson.querySelectorAll("fieldset")], results = qs.map((q, i) => gradeAnswer(q, value(hosts[i])));
    if (results.some(r => !r.answered)){ lesson.querySelector("#hw-status").textContent = "Answer every question before checking."; return; }
    results.forEach((r, i) => { feedback(hosts[i], r, "✓ Correct", "Not yet. The answer is " + qs[i].ans); recordCheck(state, id, n, "hw", r.correct); });
    const score = results.filter(r => r.correct).length, x = ext(id, n);
    if (!x.hw || score > x.hw[0]) x.hw = [score, qs.length]; save();
    lesson.querySelector("#hw-status").textContent = `${score}/${qs.length} correct. Best attempt kept.`;
  };
  lesson.querySelector("#back").onclick = () => render(true); lesson.focus();
}
function practice(id, sec){
  const n = sec.n, ps = setOf(id, n), x = ext(id, n), progress = x.ps ||= { earned: {} }, burned = new Set();
  const questions = new Map();
  const question = (q, key) => {
    questions.set(key, q);
    return `<fieldset data-problem="${key}"><legend>${q.q}</legend>${inputs(q, "ps" + key)}<div class="actions"><button type="button" data-check>Check answer</button><button type="button" data-hint>Hint</button></div><p class="feedback" role="status"></p></fieldset>`;
  };
  lesson.innerHTML = `<h1>Practice ${esc(n)} · ${sec.t}</h1><p>Earn 75% of the graded answers before viewing their full solutions. Hints are free. A revealed solution can be earned on a later visit.</p><p id="practice-status" class="notice" role="status"></p>` + ps.map((item, i) => {
    if (item.w) return `<h2>Worked example</h2><p>${item.q}</p>${item.steps.map(([ask, reveal]) => `<details><summary>${ask}</summary><p>${reveal}</p></details>`).join("")}`;
    return (item.lead ? `<h2>Complete the example</h2><p>${item.lead}</p>${(item.given || []).map(([a, b]) => `<p>${a} ${b}</p>`).join("")}` : "") +
      (item.parts ? `<h2>${item.q}</h2>${item.art ? `<canvas data-art="${item.art}" width="640" height="360" role="img" aria-label="${esc(item.q)}"></canvas>` : ""}${item.parts.map((q, j) => question(q, `${i}.${j}`)).join("")}` : question(item, String(i)));
  }).join("") + '<button id="back">Back to lesson</button>';
  lesson.querySelectorAll("[data-art]").forEach(cv => PSET_ART[cv.dataset.art](cv));
  function refresh(){
    const keys = psetGradedKeys(ps), earned = keys.filter(k => progress.earned[k] === 1).length;
    if (practiceCleared(ps, progress.earned)) progress.cleared = 1;
    mastery(id, n); save(); navigation(id, n);
    lesson.querySelector("#practice-status").textContent = `${earned} of ${keys.length} answers earned${progress.cleared ? " · practice cleared ✓" : ""}${state[id][n] === 2 ? " · lesson mastered ✓" : ""}`;
  }
  for (const [key, q] of questions){
    const host = lesson.querySelector(`[data-problem="${key}"]`); let hints = 0;
    host.querySelector("[data-check]").onclick = () => {
      const result = gradeAnswer(q, value(host));
      if (result.correct && !burned.has(key)) progress.earned[key] = 1;
      feedback(host, result, burned.has(key) && !progress.earned[key] ? "Correct, but the solution was shown. Reopen practice to earn it." : "✓ " + (q.sol || "Earned"), "Not yet. Try a hint.");
      if (result.answered){ recordCheck(state, id, n, "pset", result.correct); refresh(); }
    };
    host.querySelector("[data-hint]").onclick = e => {
      if (hints < (q.hints?.length || 0)){
        host.querySelector(".feedback").textContent = "Hint: " + q.hints[hints++];
        if (hints === q.hints.length) e.target.textContent = "Show solution";
      } else { burned.add(key); host.querySelector(".feedback").textContent = "Solution: " + (q.sol || ""); e.target.disabled = true; }
    };
  }
  lesson.querySelector("#back").onclick = () => render(true); refresh(); lesson.focus();
}
if (!location.hash){
  const resume = readJSON(storage, KEYS.resume, null);
  if (resume && sections(resume.courseId).some(s => s.n === resume.n)) history.replaceState(null, "", route(resume.courseId, resume.n));
}
window.addEventListener("hashchange", () => render(true));
render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
