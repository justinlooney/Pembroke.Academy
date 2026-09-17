/** Keep invalid scene samples out of spatial effects. A single NaN/Infinity
 * spreads through bloom's blur pyramid into a screen-sized black rectangle.
 * Run after scene/AO rendering and before bloom, SMAA and tone mapping.
 * 64 is still HDR (well above the campus's lights), with headroom for the
 * weighted bloom sum in half-float targets. Ordinary colors and alpha pass
 * through unchanged; only invalid/negative/over-range channels are repaired.
 */
export const FiniteColorShader = {
  name: "PembrokeFiniteColor",
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    float finiteChannel(float v){
      if (isnan(v)) return 0.0;
      return clamp(v, 0.0, 64.0);
    }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(finiteChannel(c.r), finiteChannel(c.g), finiteChannel(c.b),
        isnan(c.a) ? 1.0 : clamp(c.a, 0.0, 1.0));
    }`,
};
