/** Pure grading rules shared by the campus and the lightweight study page. */
export function gradeAnswer(question, value){
  if (value == null || String(value).trim() === "") return { answered: false, correct: false };
  const text = String(value).trim().replace(/−/g, "-").replace(",", ".");
  if (question.type === "mc") return { answered: true, correct: /^\d+$/.test(text) && Number(text) === question.a };
  // Accept a single numeric fraction without evaluating arbitrary expressions.
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const parts = text.split("/").map(part => part.trim());
  const valid = parts.length <= 2 && parts.every(part => decimal.test(part) && Number.isFinite(Number(part))) &&
    (parts.length === 1 || Number(parts[1]) !== 0);
  const number = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(text);
  return { answered: true, correct: valid && Number.isFinite(number) &&
    Math.abs(number - question.ans) <= (question.tol || 0) + 1e-9 };
}
export function psetGradedKeys(ps){
  return ps.flatMap((item, i) => item.w ? [] : item.parts ? item.parts.map((_, p) => `${i}.${p}`) : [String(i)]);
}
export function practiceCleared(ps, earned = {}){
  if (!ps) return true;
  const keys = psetGradedKeys(ps);
  return keys.length > 0 && keys.filter(k => earned[k] === 1).length >= Math.ceil(keys.length * .75);
}
export function recordCheck(state, courseId, section, kind, correct, now = Date.now()){
  if (typeof correct !== "boolean") return;
  const course = state[courseId] ||= {};
  const log = course.log ||= [];
  log.push({ n: section, k: kind, ok: correct ? 1 : 0, at: now });
  if (log.length > 60) log.splice(0, log.length - 60);
}
