function parseRaw(raw){
  let out = { dialogue: "", emotion: "neutral", intent: { type: "none" } };
  const take = (j) => {
    if (typeof j.dialogue === "string") out.dialogue = j.dialogue;
    if (typeof j.emotion === "string") out.emotion = j.emotion.slice(0, 24);
    if (j.intent && typeof j.intent.type === "string") out.intent = j.intent;
    return out;
  };
  try { return take(JSON.parse(raw)); } catch(_){}
  /* the hosted models are sloppier than the schema: markdown fences,
     prose around the object, unquoted keys and values. Field report,
     verbatim: "it starts with dialogue: and always ends with
     emotion:casual, intent:type:none" — the old last-resort stripped
     the braces and showed every key. Recover in stages instead. */
  const fenced = raw.replace(/```(?:json)?/gi, "");
  const block = fenced.match(/\{[\s\S]*\}/);
  if (block){ try { return take(JSON.parse(block[0])); } catch(_){} }
  /* quoted dialogue inside an otherwise broken object */
  const q = fenced.match(/"dialogue"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (q){ try { out.dialogue = JSON.parse('"' + q[1] + '"'); } catch(_){ out.dialogue = q[1]; } }
  else {
    /* unquoted: capture from dialogue: up to the next known key */
    const loose = fenced.match(/["']?dialogue["']?\s*:\s*["']?([\s\S]*?)["']?\s*,?\s*(?=["']?emotion["']?\s*:|["']?intent["']?\s*:|\}|$)/);
    out.dialogue = (loose ? loose[1] : fenced.replace(/[{}\[\]"]/g, ""))
      .replace(/\s*,?\s*["']?(emotion|intent)["']?\s*:[\s\S]*$/i, "")
      .trim();
  }
  const em = fenced.match(/["']?emotion["']?\s*:\s*["']?([a-z ]{2,24})/i);
  if (em) out.emotion = em[1].trim();
  const it = fenced.match(/["']?type["']?\s*:\s*["']?([a-z_]{2,32})/i);
  if (it) out.intent = { type: it[1] };   /* the governor's wall judges it */
  const tg = fenced.match(/["']?target["']?\s*:\s*["']?([\w.\-]{1,32})/i);
  if (tg && out.intent.type !== "none") out.intent.target = tg[1];
  return out;
}
/* ── the capability policy ─────────────────────────────────────────
   One authoritative table of what each ROLE may PROPOSE. The governor
   evaluates role → journey stage → prerequisite state → target
   validity against this table and nothing else; the prompt's intent
   documentation is GENERATED from it, so what a character is told it
   may request and what the governor will accept cannot drift apart.
   Twenty staff characters later, this is still the one place to look. */
export const AI_POLICY = {
  social:    ["point_to_location", "end_conversation"],
  academic:  ["point_to_location", "end_conversation"],
  advisor:   ["point_to_location", "end_conversation",
              "open_advising", "open_major_review", "open_registration", "review_schedule"],
  professor: ["point_to_location", "end_conversation",
              "open_current_lesson", "open_lecture", "open_interactive",
              "open_practice", "open_assignment", "explain_concept"],
};


export const DIALOGUE_LIMIT = 1200;
export function aiParse(raw){
  const parsed = parseRaw(typeof raw === "string" ? raw.slice(0, 65536) : "");
  const intent = { type: typeof parsed.intent?.type === "string" ? parsed.intent.type.slice(0, 32) : "none" };
  if (typeof parsed.intent?.target === "string") intent.target = parsed.intent.target.slice(0, 32);
  return { dialogue: String(parsed.dialogue || "").slice(0, DIALOGUE_LIMIT),
    emotion: typeof parsed.emotion === "string" ? parsed.emotion.slice(0, 24) : "neutral", intent };
}
