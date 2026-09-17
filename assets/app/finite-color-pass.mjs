import { WebGLRenderTarget, UnsignedByteType, FloatType, NearestFilter } from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FiniteColorShader } from "./finite-color.mjs";

// Match the guard's input sample, before it is repaired. Each channel counts
// PIXELS, not components. Categories can overlap; only r is the union.
const MaskShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: FiniteColorShader.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      bool nan = any(isnan(c)), inf = any(isinf(c));
      bool range = false;
      for (int i = 0; i < 4; i++){
        float limit = i == 3 ? 1.0 : 64.0;
        if (!isnan(c[i]) && !isinf(c[i]) && (c[i] < 0.0 || c[i] > limit)) range = true;
      }
      gl_FragColor = vec4(float(nan || inf || range), float(nan), float(inf), float(range));
    }`,
};
const SumShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: FiniteColorShader.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse;
    void main(){
      ivec2 size = textureSize(tDiffuse, 0), start = ivec2(gl_FragCoord.xy) * 4;
      vec4 total = vec4(0.0);
      for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++){
        ivec2 p = start + ivec2(x, y);
        if (all(lessThan(p, size))) total += texelFetch(tDiffuse, p, 0);
      }
      gl_FragColor = total;
    }`,
};

/** Optional, full-resolution 2Hz snapshots, reduced on the GPU to four
 * floats. No targets, extra draws or readbacks on an ordinary visit.
 * A zero describes sampled frames only, not every frame since page load. */
export class FiniteColorPass extends ShaderPass {
  constructor({ diagnostics = false } = {}){
    super(FiniteColorShader);
    this.diagnostics = diagnostics;
    this.repairStats = null;
    this.repairError = null;
    this.repairPeak = 0;
    this.nanPeak = 0;
    this.repairSamples = 0;
    this.probeMs = 0;
    this.nextProbeAt = 0;
    this.targets = [];
    this.mask = null;
    this.sum = null;
    this.pixel = new Float32Array(4);
  }

  render(renderer, writeBuffer, readBuffer){
    if (this.diagnostics && performance.now() >= this.nextProbeAt){
      const started = performance.now();
      const target = renderer.getRenderTarget();
      const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      const { calls, triangles, points, lines } = renderer.info.render;
      try {
        this.measure(renderer, readBuffer);
        this.repairError = null;
      } catch {
        // An unavailable diagnostic must never read as zero or stop repair.
        this.repairStats = null;
        this.repairError = "unavailable";
      } finally {
        renderer.setRenderTarget(target, face, mip);
        Object.assign(renderer.info.render, { calls, triangles, points, lines });
        const finished = performance.now();
        this.probeMs += finished - started;
        this.nextProbeAt = finished + 500;
      }
    }
    super.render(renderer, writeBuffer, readBuffer);
  }

  measure(renderer, input){
    const { width, height } = input;
    if (renderer.getContext().isContextLost() || !renderer.extensions.has("EXT_color_buffer_float") ||
        width * height > 16777216) throw new Error("Exact repair count unavailable");
    if (!this.mask){
      this.mask = new ShaderPass(MaskShader);
      this.sum = new ShaderPass(SumShader);
      this.mask.material.depthTest = this.mask.material.depthWrite = false;
      this.sum.material.depthTest = this.sum.material.depthWrite = false;
    }
    if (this.targets[0]?.width !== width || this.targets[0]?.height !== height){
      for (const rt of this.targets) rt.dispose();
      this.targets = [];
      let w = width, h = height;
      // Byte mask, float sums: no half-float overflow at 65,504 pixels.
      do {
        this.targets.push(new WebGLRenderTarget(w, h, {
          type: this.targets.length ? FloatType : UnsignedByteType,
          minFilter: NearestFilter, magFilter: NearestFilter,
          depthBuffer: false, stencilBuffer: false,
        }));
        if (w === 1 && h === 1 && this.targets.length > 1) break;
        w = Math.ceil(w / 4); h = Math.ceil(h / 4);
      } while (true);
    }
    this.mask.render(renderer, this.targets[0], input);
    for (let i = 1; i < this.targets.length; i++)
      this.sum.render(renderer, this.targets[i], this.targets[i - 1]);
    const last = this.targets.at(-1);
    // Some WebGL readback failures return silently without writing the array.
    this.pixel.fill(NaN);
    renderer.readRenderTargetPixels(last, 0, 0, 1, 1, this.pixel);
    if (!Array.from(this.pixel).every(n => Number.isInteger(n) && n >= 0 && n <= width * height))
      throw new Error("Repair count readback failed");
    const [pixels, nan, inf, range] = this.pixel;
    this.repairPeak = Math.max(this.repairPeak, pixels);
    this.nanPeak = Math.max(this.nanPeak, nan);
    this.repairSamples++;
    this.repairStats = { pixels, nan, inf, range, width, height, at: performance.now() };
  }

  takeProbeMs(){ const ms = this.probeMs; this.probeMs = 0; return ms; }

  repairSummary({ paused = false, contextLost = false } = {}){
    if (!this.diagnostics) return "";
    if (contextLost) return "repair unavailable (context lost)\n";
    if (paused) return "repair paused (campus hidden)\n";
    if (this.repairError) return "repair unavailable (probe failed)\n";
    const s = this.repairStats;
    if (!s) return "repair waiting for first sample\n";
    return `repair ${s.pixels}px  peak ${this.repairPeak}px\n` +
      `       NaN ${s.nan}  Inf ${s.inf}\n` +
      `       range ${s.range} · NaN peak ${this.nanPeak}\n` +
      `       ${s.width}x${s.height} · 2Hz snapshots\n`;
  }

  dispose(){
    for (const rt of this.targets) rt.dispose();
    this.mask?.dispose(); this.sum?.dispose();
    super.dispose();
  }
}
