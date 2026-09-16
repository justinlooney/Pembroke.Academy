import { aiParse, DIALOGUE_LIMIT } from "./ai-policy.mjs";
export function aiPeekDialogue(raw){
  const m = raw.match(/"dialogue"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (m){
    try { return JSON.parse('"' + m[1].replace(/\\$/, "") + '"'); } catch(_){ return ""; }
  }
  /* unquoted spelling, same recovery as aiParse: paint what follows
     dialogue: and stop the moment another key starts arriving — or is
     MID-ARRIVAL: a stream can end this frame on ", emo", and painting
     that flicker is worse than holding two tokens back */
  const loose = raw.match(/["']?dialogue["']?\s*:\s*["']?([\s\S]*)/);
  if (!loose) return "";
  return loose[1].replace(/\s*,?\s*["']?(emotion|intent)["']?\s*:[\s\S]*$/i, "")
    .replace(/,\s*["']?(e(m(o(t(i(o(n)?)?)?)?)?)?|i(n(t(e(n(t)?)?)?)?)?)?["']?\s*:?\s*$/i, "")
    .replace(/["'}\],]+\s*$/, "");
}
/* both providers speak the same wire dialect — one JSON object per
   line, tokens in message.content — so one reader serves them all */
export async function aiReadStream(r, onToken, t0, diag = {}){
    /* STREAMING: Ollama sends one JSON object per line. Each line's
       message.content is a token; the dialogue field is shown the
       moment its first words exist. A non-streaming body — a mock, an
       old proxy — is simply one big final line: same parser, no mode. */
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let raw = "", carry = "", shown = "", bad = 0;
    /* the terminal line the gateway sends carries counts, not just a
       flag; take them wherever they appear so both dialects work */
    const facts = (j) => {
      if (j.prompt_eval_count) diag.ptok = j.prompt_eval_count;
      if (j.eval_count) diag.ctok = j.eval_count;
      if (typeof j.bad === "number") bad = j.bad;
      if (j.cut) diag.cut = j.cut;      /* the gateway ended it early */
    };
    for (;;){
      const { done, value } = await reader.read();
      if (done) break;
      carry += dec.decode(value, { stream: true });
      const lines = carry.split("\n");
      carry = lines.pop();
      for (const line of lines){
        if (!line.trim()) continue;
        let j; try { j = JSON.parse(line); } catch(_){ continue; }
        raw += j.message?.content ?? "";
        facts(j);
        const d = aiPeekDialogue(raw);
        if (d && d !== shown){
          if (!diag.ttft) diag.ttft = Math.round(performance.now() - t0);
          shown = d; onToken?.(d.slice(0, DIALOGUE_LIMIT));
        }
      }
    }
    if (carry.trim()){
      try { const j = JSON.parse(carry); raw += j.message?.content ?? "";
        facts(j); } catch(_){}
    }
  diag.ms = Math.round(performance.now() - t0);
  diag.bad = bad;
  /* A finished stream that carried no content is not a character with
     nothing to say — it is a provider that failed AFTER the headers
     went out, when 200 is the only status the transport can still
     offer. Returning it ends the fallback chain on an empty bubble and
     Ollama is never tried. Failing here is what makes the chain a
     chain: the next provider gets its turn, and if none answers the
     caller's own catch reaches the canned dossier. */
  if (!raw.trim()){
    const e = new Error(bad ? `stream carried ${bad} unreadable frame(s) and no tokens`
                            : "stream carried no content");
    e.aiState = "provider-unavailable";
    throw e;
  }
  return aiParse(raw);
}

