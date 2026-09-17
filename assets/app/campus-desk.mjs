import { courseCatalog, learningDestination, escapeHTML as esc } from "./academy.mjs";
import { storage, KEYS, readJSON } from "./progress.mjs";

export function mountCampusDesk(host, { state, attend, walk, meet }){
  let rendering = false, mounted = false;
  const render = () => {
    if (rendering) return;
    rendering = true;
    try {
      const catalog = courseCatalog(state()), available = catalog.filter(c => c.available);
      const { course, section, resumed } = learningDestination(state(), readJSON(storage, KEYS.resume, null));
      if (mounted){
        // Keep button identity: the lesson dialog returns focus to its opener.
        // Replacing the whole panel during a save would detach that opener.
        const resume = host.querySelector(".desk-resume"), button = resume.querySelector("button");
        resume.querySelector("div > span").textContent = resumed ? "Your place is saved" : "Your first seminar";
        resume.querySelector("h3").textContent = section.t;
        resume.querySelector("p").textContent = `${course.code} · Lesson ${section.n}`;
        button.dataset.attend = course.id; button.dataset.lesson = section.n;
        button.innerHTML = `${resumed ? "Resume" : "Begin"} lesson <span aria-hidden="true">↗</span>`;
        for (const c of available){
          const card = host.querySelector(`.desk-course[data-attend="${c.id}"]`);
          if (card) card.dataset.lesson = c.next.n;
        }
        return;
      }
      host.innerHTML = `<p class="desk-kicker">An open campus for an open mind</p><h2>Come for the world.<br><em>Stay for the ideas.</em></h2><p class="desk-intro">Walk the quad. Meet your virtual classmates. Then settle into a lesson that asks you to think.</p>
      <div class="desk-resume"><div><span>${resumed ? "Your place is saved" : "Your first seminar"}</span><h3>${esc(section.t)}</h3><p>${esc(course.code)} · Lesson ${esc(section.n)}</p></div><button type="button" data-attend="${course.id}" data-lesson="${section.n}">${resumed ? "Resume" : "Begin"} lesson <span aria-hidden="true">↗</span></button></div>
      <div class="desk-heading"><h3>On the syllabus today</h3><a href="./study.html#catalog">Course library ↗</a></div>
      <div class="desk-courses">${available.map(c => `<button type="button" data-attend="${c.id}" data-lesson="${c.next.n}" class="desk-course"><span class="desk-symbol" aria-hidden="true">${esc(c.symbol.replace(/\s/g, ""))}</span><span><small>${esc(c.code)} · ${esc(c.scope)}</small><strong>${esc(c.title)}</strong><span>${esc(c.faculty)} · ${esc(c.hall)}</span></span><span aria-hidden="true">↗</span></button>`).join("")}</div>
      <div class="desk-explore"><button type="button" data-walk>Walk the campus <span aria-hidden="true">→</span></button><button type="button" data-meet>Meet someone nearby <span aria-hidden="true">→</span></button></div><p class="desk-note">Lessons are open now—no application required. Self-directed learning, not an accredited degree.</p>`;
      host.querySelectorAll("[data-attend]").forEach(b => b.addEventListener("click", () => attend(b.dataset.attend, b.dataset.lesson)));
      host.querySelector("[data-walk]").addEventListener("click", walk);
      host.querySelector("[data-meet]").addEventListener("click", meet);
      mounted = true;
    } finally { rendering = false; }
  };
  render();
  // Coalesce synchronous writes into one in-place update.
  let queued = false;
  window.addEventListener("pembroke-save", () => {
    // A denied getItem publishes a save warning itself; never let a render
    // recursively schedule another read of storage that is still denied.
    if (rendering || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; render(); });
  });
  return render;
}
