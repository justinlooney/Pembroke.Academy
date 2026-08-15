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

if (missing.length){
  console.log(`${missing.length} utility class(es) in index.html have no rule in ` +
              `assets/site.css, so they do nothing:\n  ` + missing.sort().join("\n  ") +
              `\n\nRebuild the stylesheet: tools/build-css.sh`);
  process.exit(1);
}
console.log(`every utility class in the markup has a rule — ` +
            `${used.size} in the markup, ${defined.size} defined in ` +
            `${Math.round(css.length / 1024)}KB of CSS`);
