#!/usr/bin/env node
/**
 * Pembroke Academy — is each body tightened at the right power?
 *
 *     node tools/check-skin.mjs
 *
 * index.html runs tightenWeights over every body at load, which pulls
 * each vertex towards its dominant bone. That helps a body whose
 * weights are spread too far and HURTS one whose weights are already
 * tight — so a single global power cannot be right for a mixed cast,
 * and the cast is now very mixed: twelve replacement bodies from an
 * outside source and two survivors of the original set.
 *
 * The global default was chosen from a four-body table and every body
 * in it was an original. Measured across the cast as it stands, power
 * 2 is wrong for six of fourteen, and for char5 it more than DOUBLES
 * the tearing it is supposed to reduce — 4.99x authored, 10.38x as
 * shipped, which made him the worst body on the campus without anybody
 * having measured it.
 *
 * So CAST_SKIN holds a power per body. This runs probe-asset-skin at
 * 1, 2 and 3 and fails if the power a body actually ships is not the
 * best of the three.
 *
 * It exists because the last two tables of measured constants in
 * index.html — CAST_MB and BODY_VRAM_MB — both rotted silently when
 * the bodies under them were replaced, and nothing noticed for ten
 * swaps. A table of measured numbers with no check is a table that is
 * already drifting.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POWERS = [1, 2, 3];

const src = await readFile(resolve(ROOT, "index.html"), "utf8");
const castFiles = Object.fromEntries(
  [...src.match(/const CAST_FILES = \{([\s\S]*?)\n\};/)[1]
     .matchAll(/^\s*(char\d+):\s*"([^"]+)"/gm)].map(m => [m[1], m[2]]));
const globalPower = +src.match(/const SKIN_TIGHTEN = .*: (\d+);/)[1];
const perBody = Object.fromEntries(
  [...(src.match(/const CAST_SKIN = \{([\s\S]*?)\};/)?.[1] || "")
     .matchAll(/(char\d+):\s*(\d+)/g)].map(m => [m[1], +m[2]]));

/* file -> body, so the probe's rows can be named back */
const byFile = Object.fromEntries(
  Object.entries(castFiles).map(([k, p]) => [p.split("/").pop().replace(/^stu_|\.glb$/g, ""), k]));

const worstAt = {};
for (const p of POWERS){
  process.stdout.write(`  measuring at skin=${p} ...\n`);
  const out = execFileSync("node",
    [resolve(ROOT, "tools/probe-asset-skin.mjs"), "75", `--skin=${p}`,
     ...Object.values(castFiles)],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  /* the probe's table: name, internal count, worst as "N.NNx", bone, breadth */
  for (const m of out.matchAll(/^\s{2}(\S+)\s+(\d+)\s+([\d.]+)x\s+\S+\s+[\d.]+\s*$/gm)){
    const k = byFile[m[1]]; if (!k) continue;
    (worstAt[k] ||= {})[p] = +m[3];
  }
}

let bad = 0;
console.log(`\n  body     ${POWERS.map(p => `skin=${p}`.padStart(8)).join("")}` +
            `     best   ships`);
for (const k of Object.keys(castFiles)){
  const row = worstAt[k];
  if (!row){ console.log(`  ${k.padEnd(8)} NOT MEASURED`); bad++; continue; }
  const best = POWERS.reduce((a, p) => (row[p] < row[a] ? p : a), POWERS[0]);
  const ships = perBody[k] ?? globalPower;
  const off = ships !== best;
  if (off) bad++;
  console.log(`  ${k.padEnd(8)} ` +
    POWERS.map(p => `${row[p].toFixed(2)}x`.padStart(8)).join("") +
    `   ${String(best).padStart(6)}  ${String(ships).padStart(6)}` +
    (off ? `   <-- ships ${row[ships].toFixed(2)}x, could be ${row[best].toFixed(2)}x` : ""));
}

const shipped = Object.keys(castFiles)
  .filter(k => worstAt[k])
  .map(k => worstAt[k][perBody[k] ?? globalPower]);
console.log(`\n  worst body as shipped: ${Math.max(...shipped).toFixed(2)}x`);
console.log(bad ? `\n  ${bad} body(s) are not tightened at their best power.`
                : `\n  Every body ships at the best of ${POWERS.join(", ")}.`);
process.exit(bad ? 1 : 0);
