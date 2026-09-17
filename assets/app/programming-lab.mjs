/** Small, inspectable execution traces, not a Python interpreter or an eval sandbox. */
export function programTrace(kind){
  const frames = [], add = (line, vars, output = "", note = "") => frames.push({ line, vars: { ...vars }, output, note });
  let code;
  if (kind === "assignment"){
    code = ["hours = 3", "rate = 8", "cost = hours * rate", "hours = hours + 1", "print(cost, hours)"];
    const v = {}; add(-1, v, "", "No statements have run yet.");
    v.hours = 3; add(0, v); v.rate = 8; add(1, v); v.cost = v.hours * v.rate; add(2, v);
    v.hours += 1; add(3, v, "", "cost keeps its earlier value; it is not a live formula.");
    add(4, v, `${v.cost} ${v.hours}`, "print writes values; it does not change them.");
  } else if (kind === "branch"){
    code = ["score = 7", "if score >= 6:", "    result = 1", "else:", "    result = 0", "print(result)"];
    const v = {}; add(-1, v, "", "No statements have run yet."); v.score = 7; add(0, v);
    add(1, v, "", "7 >= 6 is True. Take the indented if branch."); v.result = 1; add(2, v);
    add(5, v, String(v.result), "The else branch is skipped, not executed later.");
  } else if (kind === "loop"){
    code = ["total = 0", "for n in range(1, 4):", "    total = total + n", "print(total)"];
    const v = {}; add(-1, v, "", "No statements have run yet."); v.total = 0; add(0, v);
    for (let n = 1; n < 4; n++){ v.n = n; add(1, v, "", `Next value from range: ${n}.`); v.total += n; add(2, v); }
    add(3, v, String(v.total), "range(1, 4) is exhausted; 4 was never included.");
  } else if (kind === "function"){
    code = ["def square(x):", "    return x * x", "a = square(3)", "b = square(4)", "print(a + b)"];
    add(-1, {}, "", "No statements have run yet.");
    add(0, {}, "", "Define square. Its body has not run.");
    add(2, { "local x": 3 }, "", "Call square(3): a fresh local x is bound to 3.");
    add(1, { "local x": 3 }, "", "Return 9 to the first caller.");
    add(2, { a: 9 }, "", "The returned value is assigned to a; local x is gone.");
    add(3, { a: 9, "local x": 4 }, "", "Call square(4) with a new local x.");
    add(1, { a: 9, "local x": 4 }, "", "Return 16 to the second caller.");
    add(3, { a: 9, b: 16 }, "", "Assign the returned value to b.");
    add(4, { a: 9, b: 16 }, "25", "Add the two returned values, then print.");
  } else throw new RangeError("Unknown teaching trace: " + kind);
  return { code, frames };
}

export function drawProgramTrace(canvas, t, readout, _color, config){
  const { code, frames } = programTrace(config.trace), step = Math.round(Math.max(0, Math.min(1, t)) * (frames.length - 1));
  const frame = frames[step], g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H); g.fillStyle = "#132135"; g.fillRect(0, 0, W, H);
  g.font = "13px monospace"; g.fillStyle = "#a9bdcf"; g.fillText("PYTHON 3 · EXECUTION TRACE", 24, 30);
  g.fillText(`STEP ${step} / ${frames.length - 1}`, W - 160, 30);
  code.forEach((line, i) => {
    const y = 64 + i * 28;
    if (i === frame.line){ g.fillStyle = "#304958"; g.fillRect(16, y - 19, W - 32, 27); }
    g.font = "16px monospace"; g.fillStyle = i === frame.line ? "#ffe4a2" : "#e2eaf1";
    g.fillText(`${i + 1}  ${line}`, 26, y);
  });
  const vars = Object.entries(frame.vars).map(([k, v]) => `${k} = ${v}`).join("  ·  ") || "No variables yet";
  g.font = "15px monospace"; g.fillStyle = "#9de1ca"; g.fillText(vars, 24, H - 63);
  g.fillStyle = "#f5e9ce"; g.fillText("Output: " + (frame.output || "—"), 24, H - 30);
  readout.textContent = `Step ${step} of ${frames.length - 1}. ${frame.line < 0 ? "Before execution." : `Line ${frame.line + 1}: ${code[frame.line].trim()}.`} Variables: ${vars}. Output: ${frame.output || "none"}. ${frame.note}`;
}
