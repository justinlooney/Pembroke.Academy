/** Equal-scale coordinate diagrams for the conic lessons. No external libraries. */
export function drawConic(canvas, t, out, color, spec){
  const g=canvas.getContext('2d'), W=canvas.width, H=canvas.height, scale=Math.min((W-64)/18,(H-48)/10);
  const X=x=>W/2+x*scale, Y=y=>H/2-y*scale;
  g.clearRect(0,0,W,H);
  function line(x1,y1,x2,y2,tone='#73839a',dash=[]){g.strokeStyle=tone;g.setLineDash(dash);g.beginPath();g.moveTo(X(x1),Y(y1));g.lineTo(X(x2),Y(y2));g.stroke();g.setLineDash([]);}
  function point(x,y,label){g.fillStyle='#f8fafc';g.beginPath();g.arc(X(x),Y(y),4,0,2*Math.PI);g.fill();g.font='14px system-ui';g.fillText(label,X(x)+7,Y(y)-8);}
  g.lineWidth=1; line(-9,0,9,0);line(0,-5,0,5);
  g.fillStyle='#cbd5e1';g.font='12px system-ui';g.fillText('x',X(9)-10,Y(0)-8);g.fillText('y',X(0)+8,Y(5)+12);
  for(let x=-8;x<=8;x+=2){line(x,-.08,x,.08);if(x)g.fillText(String(x),X(x)-4,Y(0)+17);}
  for(let y=-4;y<=4;y+=2){line(-.08,y,.08,y);if(y)g.fillText(String(y),X(0)+6,Y(y)+4);}
  function curve(fn,start,end){g.lineWidth=2.5;g.strokeStyle=color;g.beginPath();for(let i=0;i<=240;i++){const [x,y]=fn(start+(end-start)*i/240);if(i)g.lineTo(X(x),Y(y));else g.moveTo(X(x),Y(y));}g.stroke();}
  if(spec.shape==='ellipse'){
    const a=5,b=1+3.5*t,c=Math.sqrt(a*a-b*b);
    curve(v=>[a*Math.cos(v),b*Math.sin(v)],0,Math.PI*2);point(-c,0,'F₁');point(c,0,'F₂');
    out.textContent=`x²/25 + y²/${(b*b).toFixed(2)} = 1. a=5, b=${b.toFixed(2)}, c=${c.toFixed(2)}. Foci (±${c.toFixed(2)},0). Increasing b brings the foci toward the center.`;
  }else if(spec.shape==='hyperbola'){
    const a=2,b=1+2*t,c=Math.hypot(a,b);
    line(-9,-9*b/a,9,9*b/a,'#93c5fd',[6,5]);line(-9,9*b/a,9,-9*b/a,'#93c5fd',[6,5]);
    for(const sign of [-1,1])curve(v=>[sign*a*Math.cosh(v),b*Math.sinh(v)],-2.1,2.1);
    point(-c,0,'F₁');point(c,0,'F₂');
    out.textContent=`x²/4 − y²/${(b*b).toFixed(2)} = 1. Vertices (±2,0), foci (±${c.toFixed(2)},0). Dashed asymptotes have slopes ±${(b/a).toFixed(2)}.`;
  }else{
    const p=.5+1.5*t;
    line(-9,-p,9,-p,'#93c5fd',[6,5]);curve(x=>[x,x*x/(4*p)],-6,6);point(0,p,'F');
    g.fillStyle='#93c5fd';g.font='14px system-ui';g.fillText('directrix',X(-8),Y(-p)-8);
    out.textContent=`x² = ${(4*p).toFixed(2)}y. Vertex (0,0), focus (0,${p.toFixed(2)}), directrix y=−${p.toFixed(2)}. Larger p spreads the parabola wider.`;
  }
}
