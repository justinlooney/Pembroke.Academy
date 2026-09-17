#!/usr/bin/env node
/** Count actual repaired pixels, including odd edges and failed readbacks.
 * Uses real WebGL; no models, screenshots, or repository writes. */
import assert from "node:assert/strict";
import { serve, launch } from "./_harness.mjs";
const server = await serve(), browser = await launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
  await page.goto(server.origin + "/missing-repair-fixture");
  await page.setContent(`<script type="importmap">{"imports":{"three":"${server.origin}/assets/vendor/three/build/three.module.js","three/addons/":"${server.origin}/assets/vendor/three/examples/jsm/"}}</script>`);
  const out = await page.evaluate(async origin => {
    const T = await import("three");
    const { FiniteColorPass } = await import(origin + "/assets/app/finite-color-pass.mjs");
    const { FiniteColorShader } = await import(origin + "/assets/app/finite-color.mjs");
    const { ShaderPass } = await import("three/addons/postprocessing/ShaderPass.js");
    const r = new T.WebGLRenderer(); r.info.autoReset = false;
    const guard = new FiniteColorPass({ diagnostics: true });
    const copy = new ShaderPass({ uniforms: { tDiffuse: { value: null } },
      vertexShader: FiniteColorShader.vertexShader,
      fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse,vUv); }" });
    const rows = [];
    let finalInput, finalOutput;
    for (const [w,h,kind,filter] of [[1,1,"healthy",T.NearestFilter], [7,5,"mixed",T.NearestFilter],
      [7,5,"mixed",T.LinearFilter], [257,257,"nan",T.NearestFilter], [129,127,"healthy",T.LinearFilter]]){
      const values = new Float32Array(w*h*4);
      for (let i=0; i<values.length; i+=4) values.set([2.5,.25,16,.375],i);
      if (kind === "nan") for (let i=0; i<values.length; i+=4) values[i] = NaN;
      if (kind === "mixed"){
        values[0]=NaN; values[(w-1)*4]=-1; values[(w*h-1)*4+3]=NaN;
        values[(w*(h-1))*4]=Infinity; values[3*w*4]=65;
        values.set([NaN,Infinity,-1,.5], (2*w+3)*4);
      }
      const texture = new T.DataTexture(values,w,h,T.RGBAFormat,T.FloatType);
      texture.minFilter=texture.magFilter=filter; texture.needsUpdate=true;
      const input={width:w,height:h,texture};
      const raw = new T.WebGLRenderTarget(w,h,{type:T.FloatType,depthBuffer:false});
      const fixed = new T.WebGLRenderTarget(w,h,{type:T.FloatType,depthBuffer:false});
      copy.render(r,raw,input);
      const before = new Float32Array(values.length), after = new Float32Array(values.length);
      r.readRenderTargetPixels(raw,0,0,w,h,before);
      const baseline = new FiniteColorPass();
      let readbacks=0;
      const read=r.readRenderTargetPixels;
      r.readRenderTargetPixels=function(...args){ readbacks++; return read.apply(this,args); };
      baseline.render(r,fixed,input);
      const dormant = { targets:baseline.targets.length, mask:!!baseline.mask, reads:readbacks };
      r.readRenderTargetPixels=read;
      baseline.dispose();
      Object.assign(r.info.render,{calls:10,triangles:20,points:30,lines:40});
      guard.nextProbeAt=0; guard.render(r,fixed,input);
      const counters={...r.info.render}, stats={...guard.repairStats};
      const summary=guard.repairSummary();
      r.readRenderTargetPixels(fixed,0,0,w,h,after);
      let changed=0, nan=0, inf=0, range=0;
      for(let i=0;i<before.length;i+=4){
        let differs=false, hasNan=false, hasInf=false, hasRange=false;
        for(let c=0;c<4;c++){
          const a=before[i+c], b=after[i+c];
          if(!Number.isFinite(b)) throw new Error("Guard left a nonfinite value");
          if(Number.isNaN(a)) hasNan=true;
          else if(!Number.isFinite(a)) hasInf=true;
          else if(a!==b) hasRange=true;
          if(a!==b) differs=true;
        }
        changed+=differs; nan+=hasNan; inf+=hasInf; range+=hasRange;
      }
      const samples=guard.repairSamples;
      guard.nextProbeAt=performance.now()+500; guard.render(r,fixed,input);
      rows.push({w,h,kind,filter,stats,changed,nan,inf,range,counters,dormant,summary,
        throttled:guard.repairSamples===samples, targetRestored:r.getRenderTarget()===fixed});
      raw.dispose();
      if(finalInput){finalInput.texture.dispose(); finalOutput.dispose();}
      finalInput=input; finalOutput=fixed;
    }
    const peak=guard.repairPeak, cost=guard.takeProbeMs(), clearedCost=guard.takeProbeMs();
    // Simulate both throwing and silent readback failures. The guard must
    // still draw and the diagnostic must say unavailable, never zero.
    const read=r.readRenderTargetPixels, failures=[];
    for(const silent of [false,true]){
      r.readRenderTargetPixels=()=>{if(!silent)throw new Error("fixture read failure");};
      guard.nextProbeAt=0; guard.render(r,finalOutput,finalInput);
      failures.push({stats:guard.repairStats,summary:guard.repairSummary(),target:r.getRenderTarget()===finalOutput});
    }
    r.readRenderTargetPixels=read;
    guard.nextProbeAt=0; guard.render(r,finalOutput,finalInput);
    const recovery={stats:guard.repairStats,peak:guard.repairPeak,nanPeak:guard.nanPeak,summary:guard.repairSummary(),
      paused:guard.repairSummary({paused:true}),lost:guard.repairSummary({contextLost:true})};
    const error=r.getContext().getError();
    finalInput.texture.dispose(); finalOutput.dispose(); copy.dispose(); guard.dispose(); r.dispose();
    return {rows,peak,cost,clearedCost,failures,recovery,error};
  },server.origin);
  for(const row of out.rows){
    assert.equal(row.stats.pixels,row.changed);
    assert.equal(row.stats.nan,row.nan); assert.equal(row.stats.inf,row.inf); assert.equal(row.stats.range,row.range);
    assert.deepEqual(row.dormant,{targets:0,mask:false,reads:0});
    assert.equal(row.counters.calls,11); assert.equal(row.counters.triangles,21);
    assert.equal(row.counters.points,30); assert.equal(row.counters.lines,40);
    assert.ok(row.throttled && row.targetRestored);
    assert.ok(row.summary.split("\n").every(line=>line.length<=44), "phone diagnostic must not be clipped");
    console.log(`ok — ${row.w}x${row.h} ${row.kind}: ${row.changed} repaired pixels counted; NaN ${row.nan}, Inf ${row.inf}, range ${row.range}`);
  }
  assert.equal(out.rows[1].changed,6); assert.equal(out.rows[1].nan,3);
  assert.equal(out.rows[1].inf,2); assert.equal(out.rows[1].range,3);
  assert.equal(out.peak,66049); assert.ok(out.cost>0); assert.equal(out.clearedCost,0);
  for(const failure of out.failures){assert.equal(failure.stats,null);assert.match(failure.summary,/unavailable/);assert.ok(failure.target);}
  assert.equal(out.recovery.stats.pixels,0); assert.equal(out.recovery.peak,66049);
  assert.equal(out.recovery.nanPeak,66049); assert.match(out.recovery.summary,/NaN peak 66049/);
  assert.match(out.recovery.paused,/paused/); assert.match(out.recovery.lost,/context lost/);
  assert.equal(out.error,0); assert.deepEqual(errors,[]);
  console.log("ok — debug-only allocation/readback, 2Hz throttle, draw accounting, peak retention and failed-readback recovery");
} finally {await browser.close();server.close();}
