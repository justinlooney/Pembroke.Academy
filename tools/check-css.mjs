#!/usr/bin/env node
/**
 * Does every utility class in index.html have a rule behind it?
 *
 * assets/site.css is a build artifact: Tailwind compiled against
 * exactly the classes the page used the day it was built. Add a class
 * afterwards and nothing complains — the attribute is there, the
 * element renders, and it is simply missing the styling it asked for.
 * No console error, no failed request, nothing a smoke test driving
 * the page would notice. That is the quiet kind of breakage this
 * repository keeps getting bitten by, so it gets a loud check.
 *
 * It lists the class selectors the sheet defines, UNESCAPES them, and
 * asks whether each class in the markup is among them. Unescaping
 * rather than escaping, because the first attempt did the reverse and
 * reported two false positives inside a minute: Tailwind writes a
 * comma as the CSS hex escape "\2c " and a hand-rolled table wrote
 * "\,". Reproducing another tool's escaping is a table that rots;
 * undoing escapes is one rule.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(`${ROOT}/index.html`, "utf8");
const css = await readFile(`${ROOT}/assets/site.css`, "utf8");

/* Classes the markup carries. A className built at runtime in JS is out
   of reach of any static pass and is not this check's business — the
   utilities live in the markup. */
const used = new Set();
for (const m of html.matchAll(/\bclass="([^"]*)"/g))
  for (const c of m[1].split(/\s+/)) if (c) used.add(c);

/* Ours, not Tailwind's: the page defines plenty of its own classes in
   its <style> block, and those are hand-written CSS. */
const own = new Set();
const style = (html.match(/<style>[\s\S]*?<\/style>/g) || []).join("\n");
for (const m of style.matchAll(/\.([A-Za-z_][\w-]*)/g)) own.add(m[1]);

/* A class token in a stylesheet: a dot, then a run of escapes and
   ordinary characters. The three alternatives matter in order —
   "\2c " (hex escape, optional trailing space) has to be tried before
   "\x" (any escaped character), or a comma escape is read as an
   escaped "2" and the rest of the selector is lost. Found the hard
   way: without it 71 classes read as missing, sm:block among them. */
const TOKEN = /\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[-\w])+)/g;
const unesc = (sel) => sel
  .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/\\(.)/g, "$1");

const defined = new Set();
for (const m of css.matchAll(TOKEN)) defined.add(unesc(m[1]));

/* Only the utilities are ours to compile. A class that is neither a
   Tailwind variant nor a known utility prefix belongs to the page. */
const VARIANT = /^-?(sm|md|lg|xl|2xl|hover|focus|focus-visible|active|group-hover|first|last|odd|even|disabled|dark|motion-safe|motion-reduce):/;
const PREFIX = /^-?(m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl|w|h|min-w|min-h|max-w|max-h|text|bg|border|rounded|flex|grid|gap|space|items|justify|self|content|order|col|row|inline|block|hidden|absolute|relative|fixed|sticky|static|top|right|bottom|left|inset|z|opacity|shadow|ring|overflow|object|font|leading|tracking|whitespace|break|list|align|table|transform|translate|scale|rotate|skew|origin|transition|duration|ease|delay|animate|cursor|select|resize|appearance|outline|fill|stroke|sr|not-sr|pointer-events|uppercase|lowercase|capitalize|truncate|italic|underline|antialiased|backdrop|blur|brightness|contrast|grayscale|invert|saturate|sepia|divide|placeholder|caret|accent|aspect|columns|float|clear|isolate|mix|filter)(-|$)/;

const missing = [];
for (const c of used){
  if (own.has(c)) continue;
  if (!VARIANT.test(c) && !PREFIX.test(c)) continue;
  if (!defined.has(c)) missing.push(c);
}

/* ══════════════════════════════════════════════════════════════════
   And the other direction: a rule nothing can ever match.

   The check above asks whether every class in the markup has a rule.
   This asks whether every rule has something to rule over — which is
   the failure that keeps costing this repository real bugs, because
   CSS fails SILENTLY. A selector that matches nothing throws nothing,
   logs nothing, and renders identically to a selector that works.

   #stage.walking and #scene.walking were written to make walk mode
   fullscreen. Nothing in this file has ever added a class called
   "walking" to anything — the class is body.walkmode — so those rules
   have never once applied, and the campus spent months rendering into
   a canvas offset 120px down with a seam across the middle of its
   best frame. Nine CI jobs never saw it. Neither did I, three times.

   The test is deliberately the narrowest one that cannot be wrong: a
   class or id that appears NOWHERE in this file except inside its own
   stylesheet. Not "does querySelectorAll find it right now" — half
   this sheet styles surfaces that only exist mid-conversation — but
   "is there any evidence anybody ever creates this". A token built by
   interpolation still appears as a literal somewhere (kind === "done"),
   so it stays quiet; a token that exists only in the CSS cannot.

   What it does NOT catch, said plainly so nobody trusts it further
   than it goes: a rule that matches and is then overridden. .moon
   {right:24%} written above the breakpoint that owns .moon matched
   perfectly and lost every time. That is a cascade question, and this
   is a spelling one. */
/* Comments out first, or a hex value written in prose about the sky
   reads as an id — #c8e2f6 was the first thing this check reported. */
const styleBody = style.replace(/<\/?style>/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const outside = html.replace(style, "");

/* Where a class can actually COME from, rather than "anywhere in the
   file". Searching the whole document was the first attempt and it is
   too loose by half: it stayed silent about .walking because the word
   "walking" occurs in a calculus lecture — "walking along the tangent
   line" — which is not a class anybody ever applied to anything.

   Three sources, and then every short bare string literal. That last
   one is what keeps a class built by interpolation quiet: `class=
   "jstage ${kind}"` never spells out "done", but `kind === "done"`
   does, and a lecture sentence is neither short nor punctuation-free
   enough to pass for a class list. The trade is deliberate — this
   check must never cry wolf, so it would rather miss a dead rule than
   invent one. */
const live = new Set();
const feed = (v) => { for (const t of String(v).split(/\s+/)) if (t) live.add(t); };
for (const m of outside.matchAll(/\bclass=["']([^"']*)["']/g)) feed(m[1]);
for (const m of outside.matchAll(/\bid=["']([\w-]+)["']/g)) live.add(m[1]);
for (const m of outside.matchAll(/classList\.(?:add|remove|toggle|replace|contains)\(([^)]*)\)/g))
  for (const q of m[1].matchAll(/["'`]([^"'`]*)["'`]/g)) feed(q[1]);
for (const m of outside.matchAll(/\.(?:className|id)\s*[+]?=\s*["'`]([^"'`]*)["'`]/g)) feed(m[1]);
/* a selector written in JS is evidence somebody expects it to exist */
for (const m of outside.matchAll(/(?:querySelector(?:All)?|closest|matches)\(\s*["'`]([^"'`]*)["'`]/g))
  for (const t of m[1].matchAll(/[.#]([\w-]+)/g)) live.add(t[1]);
/* And a bare string literal only when it is a SINGLE token — a whole
   string that is nothing but one class-shaped word. Allowing spaces
   here meant splitting sentences and keeping the pieces: "walking to
   a class" and "their walking has a limp" between them taught this
   check that .walking was alive, which is the one token it was
   written to catch. One word, no spaces. */
for (const m of outside.matchAll(/["'`]([A-Za-z][\w-]{0,29})["'`]/g)) live.add(m[1]);

/* Selector TEXT only — the run between a brace and the next "{" — so
   a declaration can never be read as a selector and background:#fff
   never looks like an id. Leading "{" as well as "}", or every rule
   nested inside an @media block is skipped. */
const need = new Map();          /* token -> the selector that wants it */
for (const m of styleBody.matchAll(/(?:^|[{}])([^{}@]+)\{/g)){
  const sel = m[1].trim();
  if (!sel) continue;
  /* No delimiter required before the dot. The first draft demanded one
     and so read #stage.walking as naming only #stage — missing the
     exact token this check was written for, and .slope-n.terra as
     naming only the first half. Compound selectors are the case that
     matters: that is where a live element and a dead class get joined
     into a rule that never fires. */
  for (const t of sel.matchAll(/([.#])([A-Za-z_][\w-]*)/g)){
    const tok = t[1] + t[2];
    if (!need.has(tok)) need.set(tok, sel.split("\n").pop().trim().slice(0, 70));
  }
}
/* ── the pre-WebGL campus ─────────────────────────────────────────
   Every token below belongs to the CSS-3D campus this project drew
   before three.js: buildings as transformed divs (.b3d, .wall, .roof,
   .spire-n), students as stacked boxes (.torso, .legs, .rig), trees as
   sprites. None of it is reachable — #scene, the element they all hung
   under, is not in the markup and nothing creates it.

   It is listed rather than deleted because that is a large removal
   made at the end of a long night, and a list that names the debt is
   honest where a silent pass is not. Anything NOT on this list fails
   the build, which is the point: the check exists to stop the next
   #stage.walking, not to relitigate the last one. The list should only
   ever get shorter. */
const LEGACY = new Set([
  ".b-label", ".b3d", ".bb-inner", ".beacon", ".beacon-of", ".bgroup",
  ".billboard", ".card", ".chimney", ".deco", ".face", ".fdot",
  ".figure", ".finial", ".fly", ".ground", ".lamppool", ".lead",
  ".legs", ".lit", ".lot", ".p2", ".pinn", ".plaza",
  ".plinth", ".pulse", ".rig", ".roof", ".say", ".shadow",
  ".slope-n", ".slope-s", ".spire-e", ".spire-face", ".spire-n", ".spire-s",
  ".spire-w", ".sprite", ".sshadow", ".stem", ".tag", ".talking",
  ".terra", ".text-slate-600", ".tok-f", ".torso", ".tree", ".tshadow",
  ".walkring", ".wall", ".wall-r",
]);
const dead = [];
for (const [tok, where] of need){
  const bare = tok.slice(1);
  if (LEGACY.has(tok)) continue;
  if (!live.has(bare)) dead.push(`${tok}  —  ${where}`);
}
if (dead.length){
  console.log(`${dead.length} selector token(s) appear nowhere but the stylesheet, ` +
              `so the rules that need them can never match:\n  ` + dead.sort().join("\n  ") +
              `\n\nEither the class is never applied (check what the JS actually adds) ` +
              `or the rule is dead and should go.`);
  process.exit(1);
}

if (missing.length){
  console.log(`${missing.length} utility class(es) in index.html have no rule in ` +
              `assets/site.css, so they do nothing:\n  ` + missing.sort().join("\n  ") +
              `\n\nRebuild the stylesheet: tools/build-css.sh`);
  process.exit(1);
}
console.log(`no rule names a class nobody creates — ${need.size} selector token(s) ` +
            `checked, ${LEGACY.size} known-dead from the pre-WebGL campus`);
console.log(`every utility class in the markup has a rule — ` +
            `${used.size} in the markup, ${defined.size} defined in ` +
            `${Math.round(css.length / 1024)}KB of CSS`);
