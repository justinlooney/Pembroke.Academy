#!/usr/bin/env node
/** Real WebGL regression for invalid HDR samples spreading through bloom.
 * No model downloads, screenshots, or repository writes. */
import assert from "node:assert/strict";
import { serve, launch } from "./_harness.mjs";
const server = await serve(), browser = await launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
  await page.goto(server.origin + "/missing-postprocessing-fixture");
  await page.setContent(`<script type="importmap">{"imports":{"three":"${server.origin}/assets/vendor/three/build/three.module.js","three/addons/":"${server.origin}/assets/vendor/three/examples/jsm/"}}</script>`);
  const results = await page.evaluate(async origin => {
    const T = await import("three");
    const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
    const { ShaderPass } = await import("three/addons/postprocessing/ShaderPass.js");
    const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
    const { SMAAPass } = await import("three/addons/postprocessing/SMAAPass.js");
    const { OutputPass } = await import("three/addons/postprocessing/OutputPass.js");
    const { FiniteColorShader } = await import(origin + "/assets/app/finite-color.mjs");
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.toneMapping = T.ACESFilmicToneMapping;
    const composer = new EffectComposer(renderer);
    const source = new ShaderPass({ uniforms: { bad: { value: 4 }, center: { value: new T.Vector2() } },
      vertexShader: FiniteColorShader.vertexShader,
      fragmentShader: `uniform float bad; uniform vec2 center; varying vec2 vUv;
        void main(){
          vec3 c = vec3(0.2 + vUv.x * 0.3, 0.3 + vUv.y * 0.3, 0.6);
          if (distance(gl_FragCoord.xy, center) < 4.0) c = vec3(bad);
          gl_FragColor = vec4(c, 1.0);
        }` });
    const guard = new ShaderPass(FiniteColorShader);
    const bloom = new UnrealBloomPass(new T.Vector2(768, 1380), .15, .32, .9);
    const smaa = new SMAAPass(768, 1380), output = new OutputPass();
    for (const pass of [source, guard, bloom, smaa, output]) composer.addPass(pass);
    // The anti-aliasing lookup images must be loaded for the reference too.
    await Promise.all([smaa.areaTexture.image, smaa.searchTexture.image].map(img => img.decode()));
    const gl = renderer.getContext(), results = [];
    for (const [width, height] of [[768, 1380], [960, 640], [1380, 768]]){
      renderer.setSize(width, height); composer.setSize(width, height);
      source.uniforms.center.value.set(width * .72, height * .3);
      const draw = (bad, guarded, glowing = true) => {
        source.uniforms.bad.value = bad; guard.enabled = guarded; bloom.enabled = glowing;
        composer.render();
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let black = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] < 16 && pixels[i+1] < 16 && pixels[i+2] < 16) black++;
        return { pixels, black: black / (width * height) };
      };
      const reference = draw(4, false), safe = draw(4, true), noGlow = draw(4, true, false);
      let maxDelta = 0, glowPixels = 0;
      for (let i = 0; i < safe.pixels.length; i++){
        maxDelta = Math.max(maxDelta, Math.abs(safe.pixels[i] - reference.pixels[i]));
        if (i % 4 !== 3 && safe.pixels[i] > noGlow.pixels[i] + 1) glowPixels++;
      }
      const broken = draw(NaN, false).black;
      const repaired = [NaN, Infinity, -Infinity, 1e20].map(value => draw(value, true).black);
      results.push({ size: `${width}x${height}`, broken, repaired, maxDelta, glowPixels, error: gl.getError() });
    }
    // Read the guard before tone mapping: preserve HDR, healthy channels and
    // transparency; repair NaN, both infinities, and finite negative radiance.
    const fixture = new ShaderPass({ uniforms: { color: { value: new T.Vector4() } },
      vertexShader: FiniteColorShader.vertexShader,
      fragmentShader: "uniform vec4 color; void main(){ gl_FragColor = color; }" });
    // Nearest sampling isolates each channel here. Linear interpolation of
    // infinity can itself yield NaN (Infinity * 0); the image tests above use
    // the production linear-filtered targets and cover that path as well.
    const input = new T.WebGLRenderTarget(2, 2, { type: T.FloatType,
      minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    const repaired = new T.WebGLRenderTarget(2, 2, { type: T.FloatType });
    const channels = [];
    guard.enabled = true; guard.renderToScreen = false;
    for (const value of [[2.5, NaN, 16, .375], [Infinity, -Infinity, -.5, 0], [64, .25, 1, 1]]){
      fixture.uniforms.color.value.fromArray(value);
      fixture.render(renderer, input); guard.render(renderer, repaired, input);
      const pixel = new Float32Array(4); renderer.readRenderTargetPixels(repaired, 0, 0, 1, 1, pixel);
      channels.push(Array.from(pixel));
    }
    results.push({ channels, error: gl.getError() });
    fixture.dispose(); input.dispose(); repaired.dispose();
    for (const pass of composer.passes) pass.dispose();
    composer.dispose(); renderer.dispose(); return results;
  }, server.origin);
  for (const row of results.slice(0, -1)){
    assert.ok(row.broken > .4, "unguarded pipeline must reproduce the large black rectangle");
    assert.ok(row.repaired.every(f => f < .001), "invalid highlights must remain local, including after resize");
    assert.ok(row.maxDelta <= 1, "ordinary lighting must match the original pipeline");
    assert.ok(row.glowPixels > 20, "bloom must still visibly light neighboring pixels");
    assert.equal(row.error, 0);
    console.log(`ok — ${row.size}: ${(100 * row.broken).toFixed(1)}% black without protection; worst repaired ${(100 * Math.max(...row.repaired)).toFixed(3)}%; normal image delta ${row.maxDelta}/255; bloom preserved`);
  }
  assert.deepEqual(results.at(-1).channels, [[2.5, 0, 16, .375], [64, 0, 0, 0], [64, .25, 1, 1]]);
  assert.equal(results.at(-1).error, 0); assert.deepEqual(errors, []);
  console.log("ok — valid HDR, individual color channels and transparency survive; invalid channels are bounded");
} finally { await browser.close(); server.close(); }
