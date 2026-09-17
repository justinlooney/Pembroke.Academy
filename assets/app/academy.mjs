import { COURSES } from "./courses.mjs";
import { STUDY } from "./course-study.mjs";

export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const courseSections = id => Object.hasOwn(STUDY, id) ? STUDY[id].units.flatMap(u => u.sections) : [];
export const studyRoute = (id, n) => `#${new URLSearchParams({ course: id, ...(n ? { lesson: n } : {}) })}`;
const profiles = {
  MATH101: { symbol: "x + y", focus: "Build your mathematical footing.", faculty: "Dr. Ines Calloway", hall: "Great Library" },
  CS101: { symbol: "{ }", focus: "Learn to reason, then write code.", faculty: "Prof. Adaeze Okonjo", hall: "Drosdick Hall" },
  MATH201: { symbol: "∫", focus: "Understand a world in motion.", faculty: "Prof. Merion", hall: "Great Library" }
};
export function courseCatalog(state = {}){
  return COURSES.map(course => {
    const sections = courseSections(course.id), mastered = sections.filter(s => state[course.id]?.[s.n] === 2).length;
    return { ...course, ...profiles[course.id], symbol: profiles[course.id]?.symbol || course.code.split(" ")[0],
      sections, available: sections.length > 0, mastered,
      scope: sections.length ? `${STUDY[course.id].units.length === 1 ? "Unit I" : STUDY[course.id].units.length + " units"} · ${sections.length} lessons` : "Syllabus preview",
      next: sections.find(s => state[course.id]?.[s.n] !== 2) || sections[0] };
  }).sort((a, b) => Number(b.available) - Number(a.available) || (a.available && b.available ? a.prereqs.length - b.prereqs.length : 0));
}
export function filterCatalog(catalog, query = "", availability = "available"){
  const term = query.trim().toLowerCase().replace(/\s+/g, "");
  return catalog.filter(c => (availability === "all" || (availability === "syllabus" ? !c.available : c.available)) &&
    `${c.code} ${c.title} ${c.desc} ${c.faculty || ""}`.toLowerCase().replace(/\s+/g, "").includes(term));
}
export function learningDestination(state, resume){
  const catalog = courseCatalog(state), course = catalog.find(c => c.id === resume?.courseId && c.sections.some(s => s.n === resume.n));
  if (course) return { course, section: course.sections.find(s => s.n === resume.n), resumed: true };
  const first = catalog.find(c => c.available && c.mastered < c.sections.length) || catalog.find(c => c.available);
  return { course: first, section: first.next, resumed: false };
}

export function mountCatalog(host, state){
  const catalog = courseCatalog(state), available = catalog.filter(c => c.available);
  host.innerHTML = `<div class="catalog-intro"><p class="eyebrow">The Pembroke course library</p><h1>A place for<br>curious minds.</h1><p>Begin with a question. Leave with something you can explain, calculate or build.</p><div class="catalog-facts"><span><strong>${available.length}</strong> courses with lessons</span><span><strong>${available.reduce((n, c) => n + c.sections.length, 0)}</strong> available lessons</span><span>Self-paced · Free to explore</span></div></div>
    <div class="catalog-toolbar"><label>Find your next subject<input id="course-search" type="search" placeholder="Try algebra, Python or calculus" autocomplete="off"></label><label>Show<select id="course-availability"><option value="available">Available lessons</option><option value="all">All courses</option><option value="syllabus">Syllabus previews</option></select></label></div>
    <p id="catalog-count" class="catalog-count" role="status"></p><div id="catalog-cards" class="catalog-cards"></div>
    <div class="catalog-footnote"><h2>Real learning. An imaginary university.</h2><p>Pembroke is a self-directed learning environment, not an accredited university. Virtual faculty are fictional characters. Algebra and programming currently offer their first units; other unfinished courses are marked as syllabus previews. Lesson mastery records passed checks and required practice, not academic credit or a degree.</p><a href="./index.html">Meet the campus →</a></div>`;
  const search = host.querySelector("#course-search"), select = host.querySelector("#course-availability");
  const paint = () => {
    const filtered = filterCatalog(catalog, search.value, select.value);
    host.querySelector("#catalog-count").textContent = `${filtered.length} ${filtered.length === 1 ? "course" : "courses"} found`;
    host.querySelector("#catalog-cards").innerHTML = filtered.length ? filtered.map(c => `<section class="catalog-card" data-course-card="${c.id}">
      <div class="course-art course-art-${c.sector}" aria-hidden="true"><span>${escapeHTML(c.symbol)}</span><small>${escapeHTML(c.code)}</small></div>
      <div class="course-card-body"><p class="eyebrow">${escapeHTML(c.scope)}</p><h2><a href="${studyRoute(c.id, c.next?.n)}">${escapeHTML(c.title)}</a></h2><p>${escapeHTML(c.focus || c.desc)}</p>
      ${c.available ? `<p class="course-faculty">With ${escapeHTML(c.faculty)} · virtual faculty</p><p class="course-requirement">${c.prereqs.length ? "Suggested preparation: " + c.prereqs.map(id => COURSES.find(p => p.id === id).code).join(", ") : "No prior coursework required"}</p><div class="course-meter"><span style="width:${Math.round(c.mastered / c.sections.length * 100)}%"></span></div><p class="course-progress-label">${c.mastered} / ${c.sections.length} available lessons mastered</p>` : '<p class="course-requirement">Course outline only. No lessons or assessments available yet.</p>'}
      <a class="course-start" href="${studyRoute(c.id, c.next?.n)}">${c.available ? (c.mastered === c.sections.length ? "Review lessons" : c.mastered ? "Continue learning" : "Explore lessons") : "View syllabus"} <span aria-hidden="true">↗</span><span class="visually-hidden"> · ${escapeHTML(c.code)}</span></a></div></section>`).join("") : '<div class="catalog-empty"><h2>No courses match that search.</h2><p>Try another subject or show the full catalog.</p><button type="button" id="clear-search">Show all courses</button></div>';
    host.querySelector("#clear-search")?.addEventListener("click", () => { search.value = ""; select.value = "all"; paint(); search.focus(); });
  };
  search.addEventListener("input", paint); select.addEventListener("change", paint); paint();
}
