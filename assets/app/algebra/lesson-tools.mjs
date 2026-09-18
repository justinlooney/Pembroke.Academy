/** Original Pembroke lessons. Textbook screenshots inform scope, not wording. */
export const N = (q, ans, work, hint = 'Identify the rule you need, write each operation, then check your result.', tol = 0) => ({ q, type:'num', ans, tol, work, sol:work, hint, hints:[hint] });
export const Q = (q, opts, a, why) => ({ q, opts, a, why });
export const E = (prompt, ...steps) => ({ prompt, steps });
export function L({ n, t, intro, goals, key, read, examples, practice, check, viz = null }){
  return { n, t, brief:intro, key, qs:check,
    full:{ professor:'Work through the explanation first. Pause before each worked step, attempt the practice independently, and use the solutions to explain any correction.',
      objectives:goals, lecture:read, viz, worked:examples[0], examples:examples.slice(1),
      turn:practice.slice(0,2), practice,
      homework:{ title:t+' · Exercises and solutions', gen:practice.slice(2).map(q => () => ({...q})) } } };
}
export function review(unit, n){
  const lessons=unit.sections, questions=lessons.flatMap(s=>s.qs.slice(0,lessons.length < 3 ? 2 : 1));
  const exercises=lessons.flatMap(s=>(s.full.practice||s.full.turn).slice(-1));
  const first=lessons[0];
  return { n, t:'Chapter review and practice test', brief:'Bring the chapter together. Review the formulas, choose a method without being told which one to use, and finish the mixed practice test.',
    key:'Explain your method, show intermediate work, and check the result in the original problem.', qs:questions,
    full:{ professor:'Use the review as a diagnostic. First attempt the questions with your notes closed. A missed question identifies a lesson to revisit; it does not erase the work you have already learned.',
      objectives:['Recall the main definitions and formulas.','Select a method in a mixed set of problems.','Check and explain answers without copying a worked example.'],
      lecture:[['How to use this review','On a separate sheet, write the quantities and restrictions in each problem before doing arithmetic. Choose a method and explain why it fits. If you cannot choose a method, return to the named topic below and solve its second worked example before attempting the review again.'],
        ...lessons.map(s=>[s.t,s.key]),
        ['Three passes through a practice test','On the first pass, solve questions whose methods you recognize. On the second, set up the remaining questions using a diagram, a table, a simpler case, or an equivalent equation. On the third, substitute numerical answers back, inspect signs and units, and check domain restrictions. Keep exact values until a problem asks for rounding.'],
        ['A useful error log','For each error, record the incorrect step, the reason it fails, and a corrected example. Distinguish a calculation slip from a misunderstanding of the method. Rework the missed question later without looking at the answer. Use the required mixed practice and the concept test below to check that the correction lasts.']],
      viz:null, worked:first.full.worked, examples:[], turn:exercises.slice(0,2), practice:exercises,
      homework:{title:'Mixed chapter exercises',gen:exercises.map(q=>()=>({...q}))} } };
}
export function chapter(title, sections, reviewId){const unit={title,sections};if(reviewId)unit.sections=[...sections,review(unit,reviewId)];return unit;}
