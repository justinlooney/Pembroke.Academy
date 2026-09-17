import { drawProgramTrace } from "./programming-lab.mjs";
function stAxes(g, W, H, X0, X1, Y0, Y1){
  const mx = x => (x - X0) / (X1 - X0) * W, my = y => H - (y - Y0) / (Y1 - Y0) * H;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = "rgba(148,163,184,.35)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(mx(X0), my(0)); g.lineTo(mx(X1), my(0));
  g.moveTo(mx(0), my(Y0)); g.lineTo(mx(0), my(Y1)); g.stroke();
  return { mx, my };
}
function stCurve(g, m, fn, x0, x1, color){
  g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= 120; i++){
    const x = x0 + (x1 - x0) * i / 120;
    i ? g.lineTo(m.mx(x), m.my(fn(x))) : g.moveTo(m.mx(x), m.my(fn(x)));
  }
  g.stroke();
}
/* each viz kind: (canvas, slider01, readoutEl, color) → redraw(t) */
const ST_VIZ = {
  pythontrace: drawProgramTrace,
  /* the vertical line test, live: a parabola that always passes and a
     sideways parabola that fails wherever the line crosses it twice */
  vline(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -4, 4, -3, 3);
    stCurve(g, m, x => x * x - 2, -2.2, 2.2, color);
    g.strokeStyle = "#38bdf8"; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 120; i++){
      const y = -2.4 + 4.8 * i / 120;
      i ? g.lineTo(m.mx(y * y - 2), m.my(y)) : g.moveTo(m.mx(y * y - 2), m.my(y));
    }
    g.stroke();
    const x = -3.6 + 7.2 * t;
    g.strokeStyle = "#f8fafc"; g.setLineDash([5, 4]); g.beginPath();
    g.moveTo(m.mx(x), 0); g.lineTo(m.mx(x), H); g.stroke(); g.setLineDash([]);
    const hitsA = x >= -2.2 && x <= 2.2 ? 1 : 0;                 /* the drawn domain of y = x²−2 */
    const hitsB = x + 2 > 0 ? 2 : (x + 2 === 0 ? 1 : 0);           /* x = y²−2 */
    out.textContent = `at x = ${x.toFixed(1)}: gold curve ${hitsA} crossing — a function · blue curve ${hitsB} — ${hitsB > 1 ? "NOT a function" : hitsB === 1 ? "so far so good" : "no crossings"}`;
  },
  /* shifts made visible: the slider slides the parabola's vertex */
  transform(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -5, 5, -3, 6);
    const h = -2.5 + 5 * t, k = -1 + 2 * t;
    stCurve(g, m, x => x * x, -2.3, 2.3, "rgba(148,163,184,.5)");
    stCurve(g, m, x => (x - h) * (x - h) + k, h - 2.3, h + 2.3, color);
    g.fillStyle = "#f8fafc"; g.beginPath(); g.arc(m.mx(h), m.my(k), 4, 0, 7); g.fill();
    out.textContent = `y = (x − ${h.toFixed(1)})² + ${k.toFixed(1)} — the grey parent slid right ${h.toFixed(1)}, up ${k.toFixed(1)}`;
  },
  /* one line, one number: the slider is the slope */
  line(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -4, 4, -4, 4);
    const sl = -3 + 6 * t;
    stCurve(g, m, x => 1 + sl * x, -3.8, 3.8, color);
    g.strokeStyle = "rgba(248,250,252,.6)"; g.setLineDash([4, 4]); g.beginPath();
    g.moveTo(m.mx(1), m.my(1 + sl)); g.lineTo(m.mx(2), m.my(1 + sl)); g.lineTo(m.mx(2), m.my(1 + 2 * sl)); g.stroke(); g.setLineDash([]);
    out.textContent = `m = ${sl.toFixed(2)} — one step right, ${sl.toFixed(2)} up; ${sl > 0.02 ? "climbing" : sl < -0.02 ? "falling" : "flat"}`;
  },
  /* the base decides everything: growth above 1, decay below */
  explog(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -3, 3, -0.5, 6);
    const b = 0.3 + 2.7 * t;
    stCurve(g, m, x => Math.pow(b, x), -2.8, Math.min(2.8, Math.log(6) / Math.max(0.05, Math.abs(Math.log(b)))), color);
    g.fillStyle = "#f8fafc"; g.beginPath(); g.arc(m.mx(0), m.my(1), 4, 0, 7); g.fill();
    out.textContent = `y = ${b.toFixed(2)}ˣ — ${b > 1.02 ? "growth: each step multiplies by " + b.toFixed(2) : b < 0.98 ? "decay: each step keeps only " + b.toFixed(2) : "b = 1: frozen flat"} · always through (0, 1)`;
  },
  /* the log is the exponential in a mirror */
  loginv(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -2, 6, -2, 6);
    g.strokeStyle = "rgba(248,250,252,.35)"; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(m.mx(-2), m.my(-2)); g.lineTo(m.mx(6), m.my(6)); g.stroke(); g.setLineDash([]);
    stCurve(g, m, x => Math.pow(2, x), -1.9, 2.55, color);
    stCurve(g, m, x => Math.log2(x), 0.26, 5.8, "#38bdf8");
    const a = -1.5 + 3.9 * t, ya = Math.pow(2, a);
    g.fillStyle = color; g.beginPath(); g.arc(m.mx(a), m.my(ya), 4.5, 0, 7); g.fill();
    g.fillStyle = "#38bdf8"; g.beginPath(); g.arc(m.mx(ya), m.my(a), 4.5, 0, 7); g.fill();
    out.textContent = `(${a.toFixed(1)}, ${ya.toFixed(2)}) on 2ˣ mirrors to (${ya.toFixed(2)}, ${a.toFixed(1)}) on log₂x — the same fact, asked backwards`;
  },
  /* a hole with an answer: both sides of x = 2 close in on 4 */
  limithole(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -0.5, 4.5, -0.5, 6.5);
    stCurve(g, m, x => x + 2, -0.4, 4.3, color);       /* (x²−4)/(x−2) simplified */
    g.fillStyle = "#0b1220"; g.strokeStyle = color; g.lineWidth = 2;
    g.beginPath(); g.arc(m.mx(2), m.my(4), 5, 0, 7); g.fill(); g.stroke();
    const h = 1.6 - 1.585 * t;
    for (const x of [2 - h, 2 + h]){
      g.fillStyle = "#38bdf8"; g.beginPath(); g.arc(m.mx(x), m.my(x + 2), 4.5, 0, 7); g.fill();
    }
    out.textContent = `f(2 − ${h.toFixed(2)}) = ${(4 - h).toFixed(2)} and f(2 + ${h.toFixed(2)}) = ${(4 + h).toFixed(2)} → both sides head for 4 · f(2) itself is undefined`;
  },
  /* f above, f′ implied: the marker's tangent slope IS the derivative's value */
  derivfn(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -2.6, 2.6, -4.5, 4.5);
    const f = x => x * x * x - 3 * x, df = x => 3 * x * x - 3;
    stCurve(g, m, f, -2.35, 2.35, color);
    stCurve(g, m, df, -1.65, 1.65, "#38bdf8");
    const x0 = -2.1 + 4.2 * t;
    g.strokeStyle = "#f8fafc"; g.lineWidth = 2; g.beginPath();
    g.moveTo(m.mx(x0 - 0.55), m.my(f(x0) - 0.55 * df(x0)));
    g.lineTo(m.mx(x0 + 0.55), m.my(f(x0) + 0.55 * df(x0))); g.stroke();
    g.fillStyle = "#f8fafc"; g.beginPath(); g.arc(m.mx(x0), m.my(f(x0)), 4.5, 0, 7); g.fill();
    g.fillStyle = "#38bdf8"; g.beginPath(); g.arc(m.mx(x0), m.my(df(x0)), 4.5, 0, 7); g.fill();
    out.textContent = `at x = ${x0.toFixed(1)}: tangent slope on gold f = ${df(x0).toFixed(2)} = height of blue f′ — ${df(x0) > 0.05 ? "f rising, f′ positive" : df(x0) < -0.05 ? "f falling, f′ negative" : "f pausing, f′ zero"}`;
  },
  /* a cost curve narrated by its tangent: the marginal reading */
  marginal(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -2, 32, -5, 130);
    const C = x => 0.1 * x * x + 20, dC = x => 0.2 * x;
    stCurve(g, m, C, 0, 31, color);
    const x0 = 2 + 27 * t;
    g.strokeStyle = "#f8fafc"; g.lineWidth = 2; g.beginPath();
    g.moveTo(m.mx(x0 - 7), m.my(C(x0) - 7 * dC(x0))); g.lineTo(m.mx(x0 + 7), m.my(C(x0) + 7 * dC(x0))); g.stroke();
    g.fillStyle = "#f8fafc"; g.beginPath(); g.arc(m.mx(x0), m.my(C(x0)), 4.5, 0, 7); g.fill();
    out.textContent = `at x = ${x0.toFixed(0)} units: total cost ${C(x0).toFixed(1)} · marginal cost C′ = ${dC(x0).toFixed(2)} ≈ cost of unit ${Math.ceil(x0) + 1}`;
  },
  /* the product rule as a growing rectangle: two strips, not one */
  prodrect(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const x = 1 + 3 * t, f = 1 + x, gg = 2 + 0.5 * x;
    const sc = 46, ox = 70, oy = H - 40;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(148,163,184,.15)"; g.fillRect(ox, oy - gg * sc, f * sc, gg * sc);
    g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(ox, oy - gg * sc, f * sc, gg * sc);
    g.fillStyle = "rgba(56,189,248,.35)";
    g.fillRect(ox + f * sc, oy - gg * sc, 0.35 * sc, gg * sc);        /* f grows: strip g tall  */
    g.fillRect(ox, oy - gg * sc - 0.18 * sc, f * sc, 0.18 * sc);      /* g grows: strip f wide  */
    g.fillStyle = "#e2e8f0"; g.font = "12px ui-monospace";
    g.fillText("f(x) = " + f.toFixed(2), ox, oy + 16);
    g.save(); g.translate(ox - 10, oy - gg * sc); g.rotate(Math.PI / 2); g.fillText("g(x) = " + gg.toFixed(2), 0, 0); g.restore();
    out.textContent = `area = f·g = ${(f * gg).toFixed(2)} · growing by two strips: f′·g + f·g′ = ${(1 * gg + f * 0.5).toFixed(2)} per step — never just f′·g′`;
  },
  /* the chain rule as gears: outer rate times inner rate */
  chain(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -3.2, 3.2, -0.5, 4);
    const f = x => Math.sqrt(x * x + 1);
    stCurve(g, m, f, -3, 3, color);
    const x0 = -2.6 + 5.2 * t, u = x0 * x0 + 1;
    const du = 2 * x0, dy = 1 / (2 * Math.sqrt(u)), d = du * dy;
    g.strokeStyle = "#f8fafc"; g.lineWidth = 2; g.beginPath();
    g.moveTo(m.mx(x0 - 0.8), m.my(f(x0) - 0.8 * d)); g.lineTo(m.mx(x0 + 0.8), m.my(f(x0) + 0.8 * d)); g.stroke();
    g.fillStyle = "#f8fafc"; g.beginPath(); g.arc(m.mx(x0), m.my(f(x0)), 4.5, 0, 7); g.fill();
    out.textContent = `y = √(x²+1) at x = ${x0.toFixed(1)}: inner du/dx = ${du.toFixed(2)}, outer dy/du = ${dy.toFixed(2)} · product = slope ${d.toFixed(2)}`;
  },
  /* implicit differentiation on the circle: −x/y read off the wheel */
  circle(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -7, 7, -7, 7);
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 120; i++){
      const a = i / 120 * 2 * Math.PI;
      i ? g.lineTo(m.mx(5 * Math.cos(a)), m.my(5 * Math.sin(a))) : g.moveTo(m.mx(5), m.my(0));
    }
    g.stroke();
    const a = 0.12 + t * (Math.PI - 0.24);          /* keep y > 0: slope well-defined */
    const x = 5 * Math.cos(a), y = 5 * Math.sin(a), sl = -x / y;
    g.strokeStyle = "#f8fafc"; g.lineWidth = 2; g.beginPath();
    const L = 2.4 / Math.hypot(1, sl);
    g.moveTo(m.mx(x - L), m.my(y - L * sl)); g.lineTo(m.mx(x + L), m.my(y + L * sl)); g.stroke();
    g.fillStyle = "#f8fafc"; g.beginPath(); g.arc(m.mx(x), m.my(y), 4.5, 0, 7); g.fill();
    out.textContent = `x² + y² = 25 at (${x.toFixed(1)}, ${y.toFixed(1)}): dy/dx = −x/y = ${sl.toFixed(2)} — no y = f(x) ever solved for`;
  },
  /* related rates as a spreading ripple: one rate drives another */
  ripple(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const r = 0.5 + 4.5 * t, sc = 34, cx = W / 2, cy = H / 2;
    for (const rr of [r * 0.55, r * 0.8, r]){
      g.strokeStyle = rr === r ? color : "rgba(148,163,184,.35)"; g.lineWidth = rr === r ? 2.5 : 1;
      g.beginPath(); g.arc(cx, cy, rr * sc, 0, 7); g.stroke();
    }
    g.fillStyle = "#f8fafc"; g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill();
    out.textContent = `r = ${r.toFixed(1)}, growing at dr/dt = 2 · area grows at dA/dt = 2πr·(dr/dt) = ${(2 * Math.PI * r * 2).toFixed(1)} — same dr/dt, ever faster area`;
  },
  /* a rational function honouring its asymptotes */
  asym(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -6, 12, -8, 12);
    const f = x => (2 * x + 1) / (x - 3);
    g.strokeStyle = "rgba(248,250,252,.45)"; g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(m.mx(-6), m.my(2)); g.lineTo(m.mx(12), m.my(2)); g.stroke();
    g.beginPath(); g.moveTo(m.mx(3), m.my(-8)); g.lineTo(m.mx(3), m.my(12)); g.stroke(); g.setLineDash([]);
    stCurve(g, m, f, -5.8, 2.62, color);
    stCurve(g, m, f, 3.45, 11.8, color);
    const x0 = 3.6 + 8.2 * t;
    g.fillStyle = "#38bdf8"; g.beginPath(); g.arc(m.mx(x0), m.my(f(x0)), 4.5, 0, 7); g.fill();
    out.textContent = `f(${x0.toFixed(1)}) = ${f(x0).toFixed(2)} — sliding out along x, the curve settles toward the dashed y = 2; at x = 3 it blows up`;
  },
  /* the optimization classic: fixed fence, sliding shape, peak area */
  fence(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const w = 2 + 16 * t, h = 20 - w, A = w * h;   /* perimeter 40 */
    const sc = 9, ox = 60, oy = H - 46;
    g.strokeStyle = color; g.lineWidth = 2.5;
    g.strokeRect(ox, oy - h * sc, w * sc, h * sc);
    g.fillStyle = "rgba(212,175,106,.14)"; g.fillRect(ox, oy - h * sc, w * sc, h * sc);
    const bx = W - 90;
    g.fillStyle = "rgba(56,189,248,.5)"; g.fillRect(bx, oy - A * 1.35, 26, A * 1.35);
    g.strokeStyle = "rgba(148,163,184,.5)"; g.strokeRect(bx, oy - 135, 26, 135);
    g.fillStyle = "#e2e8f0"; g.font = "12px ui-monospace";
    g.fillText(`${w.toFixed(1)} × ${h.toFixed(1)}`, ox, oy + 18);
    g.fillText("area", bx - 6, oy + 18);
    out.textContent = `perimeter fixed at 40 · area = ${A.toFixed(1)} of a possible 100 — ${Math.abs(w - 10) < 0.3 ? "the square wins" : "keep sliding toward the square"}`;
  },
  /* Riemann sums: rectangles crowd in under the parabola */
  riemann(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -0.3, 2.3, -0.4, 4.4);
    const f = x => x * x, n = 2 + Math.round(38 * t);
    let sum = 0;
    for (let i = 0; i < n; i++){
      const x0 = 2 * i / n, x1 = 2 * (i + 1) / n, xm = (x0 + x1) / 2;
      sum += f(xm) * (x1 - x0);
      g.fillStyle = "rgba(56,189,248,.30)"; g.strokeStyle = "rgba(56,189,248,.55)";
      const rx = m.mx(x0), rw = m.mx(x1) - m.mx(x0), ry = m.my(f(xm)), rh = m.my(0) - ry;
      g.fillRect(rx, ry, rw, rh); g.strokeRect(rx, ry, rw, rh);
    }
    stCurve(g, m, f, 0, 2.15, color);
    out.textContent = `${n} rectangles: total area ≈ ${sum.toFixed(4)} → the exact answer 8/3 = ${(8/3).toFixed(4)}`;
  },
  /* accumulation: the area-so-far function and its telltale rate */
  accum(cv, t, out, color){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -0.3, 2.3, -0.4, 4.4);
    const f = x => x * x, x0 = 0.15 + 1.95 * t;
    g.fillStyle = "rgba(212,175,106,.22)";
    g.beginPath(); g.moveTo(m.mx(0), m.my(0));
    for (let i = 0; i <= 60; i++){ const x = x0 * i / 60; g.lineTo(m.mx(x), m.my(f(x))); }
    g.lineTo(m.mx(x0), m.my(0)); g.closePath(); g.fill();
    stCurve(g, m, f, 0, 2.15, color);
    g.strokeStyle = "#f8fafc"; g.setLineDash([4, 4]); g.beginPath();
    g.moveTo(m.mx(x0), m.my(0)); g.lineTo(m.mx(x0), m.my(f(x0))); g.stroke(); g.setLineDash([]);
    out.textContent = `area from 0 to ${x0.toFixed(2)} = x³/3 = ${(x0**3/3).toFixed(3)} · its growth rate right now = the curve's own height ${(x0*x0).toFixed(2)} — that is the FTC`;
  },
  /* the course's flagship: Q slides into P and the secant becomes the tangent */
  secant(cv, t, out, color, spec){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const m = stAxes(g, W, H, -0.5, 3, -0.5, 6);
    const f = x => x * x;
    stCurve(g, m, f, -0.4, 2.45, color);
    const h = 1.5 - 1.49 * t;                     /* 1.5 → 0.01 */
    const P = [1, 1], Q = [1 + h, f(1 + h)];
    const sSlope = (f(1 + h) - 1) / h;
    if (!spec || spec.tangent !== false){
      g.strokeStyle = "rgba(248,250,252,.5)"; g.setLineDash([5, 4]); g.beginPath();
      g.moveTo(m.mx(-0.3), m.my(1 + 2 * (-0.3 - 1))); g.lineTo(m.mx(2.6), m.my(1 + 2 * (2.6 - 1)));
      g.stroke(); g.setLineDash([]);
    }
    g.strokeStyle = "#38bdf8"; g.lineWidth = 2; g.beginPath();
    g.moveTo(m.mx(-0.2), m.my(1 + sSlope * (-0.2 - 1))); g.lineTo(m.mx(2.6), m.my(1 + sSlope * (2.6 - 1)));
    g.stroke();
    for (const [pt, cc] of [[P, "#f8fafc"], [Q, "#38bdf8"]]){
      g.fillStyle = cc; g.beginPath(); g.arc(m.mx(pt[0]), m.my(pt[1]), 5, 0, 7); g.fill();
    }
    out.textContent = `h = ${h.toFixed(2)} · secant slope = ${sSlope.toFixed(3)} → tangent slope 2`;
  },
};

/* ── the lesson player: ordered blocks from the course manifest ──── */

const PSET_ART = {
  /* a piecewise-linear graph with a shelf and two axis crossings */
  pw1(cv){
    const g = cv.getContext("2d");
    const m = stAxes(g, cv.width, cv.height, -5, 7, -4, 5);
    const pts = [[-4, -3], [-1, 3], [3, 3], [6, -3]];
    g.strokeStyle = "#d4af6a"; g.lineWidth = 2.5; g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(m.mx(x), m.my(y)) : g.moveTo(m.mx(x), m.my(y)));
    g.stroke();
    g.fillStyle = "#d4af6a";
    for (const [x, y] of [pts[0], pts[3]]){
      g.beginPath(); g.arc(m.mx(x), m.my(y), 4, 0, Math.PI * 2); g.fill();
    }
    /* light ticks so the axes are readable without a grid */
    g.fillStyle = "rgba(148,163,184,.8)"; g.font = "12px system-ui";
    for (let x = -4; x <= 6; x += 2) g.fillText(String(x), m.mx(x) - 4, m.my(0) + 16);
    for (let y = -3; y <= 3; y += 3) if (y) g.fillText(String(y), m.mx(0) + 6, m.my(y) + 4);
  },
  /* the parent parabola (ghost) and its shifted twin */
  tf1(cv){
    const g = cv.getContext("2d");
    const m = stAxes(g, cv.width, cv.height, -4, 7, -3, 8);
    g.setLineDash([5, 4]);
    stCurve(g, m, x => x * x, -2.6, 2.6, "rgba(148,163,184,.55)");
    g.setLineDash([]);
    stCurve(g, m, x => (x - 3) * (x - 3) - 2, 0.1, 5.9, "#d4af6a");
    g.fillStyle = "#d4af6a";
    g.beginPath(); g.arc(m.mx(3), m.my(-2), 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(148,163,184,.8)"; g.font = "12px system-ui";
    for (let x = -2; x <= 6; x += 2) if (x) g.fillText(String(x), m.mx(x) - 4, m.my(0) + 16);
    for (const y of [-2, 4]) g.fillText(String(y), m.mx(0) + 6, m.my(y) + 4);
  },
  /* one straight line, intercepts on show */
  ln1(cv){
    const g = cv.getContext("2d");
    const m = stAxes(g, cv.width, cv.height, -3, 5, -5, 5);
    stCurve(g, m, x => 1.5 * x - 2, -1.8, 4.4, "#d4af6a");
    g.fillStyle = "#d4af6a";
    for (const [x, y] of [[0, -2], [4, 4]]){
      g.beginPath(); g.arc(m.mx(x), m.my(y), 4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "rgba(148,163,184,.8)"; g.font = "12px system-ui";
    for (let x = -2; x <= 4; x += 2) if (x) g.fillText(String(x), m.mx(x) - 4, m.my(0) + 16);
    for (let y = -4; y <= 4; y += 2) if (y) g.fillText(String(y), m.mx(0) + 6, m.my(y) + 4);
  },
  /* a cubic with a hill, a valley, and three crossings */
  cb1(cv){
    const g = cv.getContext("2d");
    const m = stAxes(g, cv.width, cv.height, -3, 3, -4, 4);
    stCurve(g, m, x => x * x * x - 3 * x, -2.3, 2.3, "#d4af6a");
    g.fillStyle = "#d4af6a";
    for (const [x, y] of [[-1, 2], [1, -2]]){
      g.beginPath(); g.arc(m.mx(x), m.my(y), 4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "rgba(148,163,184,.8)"; g.font = "12px system-ui";
    for (let x = -2; x <= 2; x++) if (x) g.fillText(String(x), m.mx(x) - 4, m.my(0) + 16);
    for (const y of [-2, 2]) g.fillText(String(y), m.mx(0) + 6, m.my(y) + 4);
  },
  /* the doubling curve, two landmarks dotted */
  ex1(cv){
    const g = cv.getContext("2d");
    const m = stAxes(g, cv.width, cv.height, -3.4, 3.4, -1, 9);
    stCurve(g, m, x => Math.pow(2, x), -3.2, 3.1, "#d4af6a");
    g.fillStyle = "#d4af6a";
    for (const [x, y] of [[0, 1], [2, 4]]){
      g.beginPath(); g.arc(m.mx(x), m.my(y), 4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "rgba(148,163,184,.8)"; g.font = "12px system-ui";
    for (let x = -3; x <= 3; x++) if (x) g.fillText(String(x), m.mx(x) - 4, m.my(0) + 16);
    for (const y of [1, 4, 8]) g.fillText(String(y), m.mx(0) + 6, m.my(y) + 4);
  },
  /* the logarithm, climbing ever slower off its wall */
  lg1(cv){
    const g = cv.getContext("2d");
    const m = stAxes(g, cv.width, cv.height, -1, 9.5, -3, 4);
    stCurve(g, m, x => Math.log2(x), 0.15, 9.2, "#d4af6a");
    g.fillStyle = "#d4af6a";
    for (const [x, y] of [[1, 0], [4, 2], [8, 3]]){
      g.beginPath(); g.arc(m.mx(x), m.my(y), 4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "rgba(148,163,184,.8)"; g.font = "12px system-ui";
    for (const x of [1, 4, 8]) g.fillText(String(x), m.mx(x) - 4, m.my(0) + 16);
    for (const y of [2, 3]) g.fillText(String(y), m.mx(0) + 6, m.my(y) + 4);
  },
};

export { ST_VIZ, PSET_ART };
