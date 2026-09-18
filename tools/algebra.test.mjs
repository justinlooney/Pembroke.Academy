import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INTRO_MATH} from '../assets/app/intro-math.mjs';
import {gradeAnswer} from '../assets/app/grading.mjs';
import {normalizeStudy} from '../assets/app/progress.mjs';
const sections=INTRO_MATH.units.flatMap(u=>u.sections), byId=Object.fromEntries(sections.map(s=>[s.n,s]));
test('algebra covers all chapters with teaching, worked examples, explained practice, and reviews',()=>{
  assert.equal(sections.length,80);assert.equal(new Set(sections.map(s=>s.n)).size,80);
  assert.deepEqual(sections.slice(0,3).map(s=>s.n),['0.1','0.2','0.3']);
  for(const prefix of ['P','1','2','3','4','SY','MX','CO','SQ','PR','GE']){
    const lessons=sections.filter(s=>s.n.startsWith(prefix+'.')&&!s.n.endsWith('.R'));
    assert.ok(lessons.length>=2);assert.ok(byId[prefix+'.R']);
    for(const {full:f,qs,n} of lessons){
      assert.ok(f.lecture.length>=5,n);assert.ok(f.lecture.every(([h,p])=>h&&p.length>=140),n);
      const expanded=prefix==='1'&&n!=='1.FM';
      if(expanded)assert.ok(1+f.examples.length>=3,n);else assert.equal(1+f.examples.length,2,n);
      assert.ok([f.worked,...f.examples].every(e=>e.steps.length>=3),n);
      assert.equal(f.practice.length,n==='1.11'?10:expanded?8:6,n);assert.ok(f.practice.every(q=>q.work&&q.sol&&q.hints.length),n);
      assert.equal(f.homework.gen.length,f.practice.length-2,n);assert.ok(qs.length>=3,n);
    }
  }
  assert.equal(byId['FINAL.1'].full.practice.length,24);
});
test('fraction answers accept numeric notation without evaluating code or invalid divisions',()=>{
  const q={ans:-.75};for(const s of ['-3/4','−3 / 4','3/-4','-0.75','-75e-2'])assert.equal(gradeAnswer(q,s).correct,true,s);
  for(const s of ['1/0','0/0','3/4/5','3/4oops','Infinity/Infinity','1e999/1e999','alert(1)','2**3',''])assert.equal(gradeAnswer(q,s).correct,false,s);
  assert.equal(gradeAnswer({ans:1/3},'1/3').correct,true);
});
test('new lesson practice survives normalization and remains required for mastery',()=>{
  const n='MX.4';const state=earned=>normalizeStudy({MATH101:{x:{[n]:{kc:1,ps:{earned}}}}}).MATH101;
  assert.notEqual(state({0:1,1:1,2:1,3:1})[n],2);
  assert.equal(state({0:1,1:1,2:1,3:1,4:1})[n],2);
  assert.deepEqual(state({0:1,1:1,2:1,3:1,4:1,bogus:1}).x[n].ps.earned,{0:1,1:1,2:1,3:1,4:1});
  assert.equal(normalizeStudy({MATH101:{'P.2':2,x:{'P.2':{kc:1}}}}).MATH101['P.2'],2);
});
test('independently recomputed cumulative answers agree with the authored key',()=>{
  const p=byId['FINAL.1'].full.practice;
  const expected=[3*(2*6-5)-2*(6+1),(8+10)/(5-3),(7+Math.sqrt(49-40))/2,(-8-4)/(3-(-1)),(4-6)/2,
    7,(2*4-3)**2+1,(17-2)/5,3+3,2**3+2*2-5,250*1.2**2,2**4+1,(11+7)/3,
    (2-Math.sqrt(4+12))/2,5*4-2*3,-2,Math.sqrt(100-64),Math.sqrt(25+144),5+11*4,15/(1-.4),9*8/2,3*.5**3,Math.hypot(20,21),2**2*9];
  expected.forEach((value,i)=>assert.ok(Math.abs(p[i].ans-value)<1e-9,p[i].q));
  // Validate equation candidates by substitution, not just equality to a copied key.
  for(const x of [-1,2,3])assert.equal(x**3-4*x*x+x+6,0);
  for(const [x,y,z] of [[1,2,3]]){assert.equal(x+y+z,6);assert.equal(x-y+z,2);assert.equal(2*x+y-z,1);}
  const A=[[2,1],[1,1]],B=[[1,-1],[-1,2]];
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)assert.equal(A[i][0]*B[0][j]+A[i][1]*B[1][j],Number(i===j));
});
test('all question keys are finite, selectable, and reject a different answer',()=>{
  for(const s of sections){
    for(const q of s.full.practice||s.full.turn){assert.ok(Number.isFinite(q.ans),s.n);assert.equal(gradeAnswer(q,q.ans).correct,true);assert.equal(gradeAnswer(q,q.ans+1).correct,false);}
    for(const q of s.qs){assert.ok(q.opts[q.a]&&q.why,s.n);assert.equal(new Set(q.opts).size,q.opts.length,s.n);}
  }
});
test('every algebra import is precached for offline chapters',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of ['lesson-tools','chapter-one','prerequisites','equations','functions','polynomials','exponentials','systems','matrices','conics','sequences','probability','geometry','final-review'])assert.ok(sw.includes('algebra/'+file+'.mjs'),file);
  assert.ok(sw.includes('algebra-figures.mjs'));
});
test('Chapter 1 covers every supplied topic within the chapter, including variation and mixed assessment',()=>{
  const unit=INTRO_MATH.units.find(u=>u.title==='1 · Equations and graphs');
  assert.deepEqual(unit.sections.map(s=>s.n),['1.1','1.2','1.3','1.4','1.5','1.6','1.7','1.8','1.9','1.10','1.11','1.FM','1.R']);
  const required={
    '1.1':[/quadrants/i,/distance/i,/midpoint/i],
    '1.2':[/table/i,/intercepts/i,/y-axis symmetry/i,/x-axis symmetry/i,/origin symmetry/i],
    '1.3':[/radius/i,/complete.*squares/i,/classify/i,/no real points/i],
    '1.4':[/slope/i,/point-slope/i,/slope-intercept/i,/general equation/i,/vertical/i,/horizontal/i,/parallel/i,/perpendicular/i],
    '1.5':[/factoring/i,/complete the square/i,/quadratic formula/i,/discriminant/i,/modeling/i],
    '1.6':[/addition/i,/multiplication/i,/division/i,/square roots of negative/i,/complex solutions/i],
    '1.7':[/rational/i,/radical/i,/quadratic.form/i,/extraneous/i],
    '1.8':[/linear/i,/polynomial/i,/rational/i,/modeling with inequalities/i],
    '1.9':[/equations/i,/inequalities/i,/outside/i,/tolerance/i],
    '1.10':[/using graphing devices/i,/inequalities/i,/intersection/i,/window/i],
    '1.11':[/direct variation/i,/inverse variation/i,/joint variation/i,/combining different types/i,/constant/i]
  };
  for(const [id,patterns] of Object.entries(required)){
    const s=unit.sections.find(s=>s.n===id),text=JSON.stringify(s);
    for(const pattern of patterns)assert.match(text,pattern,id);
    assert.ok(s.full.lecture.some(([h])=>/discuss/i.test(h)),id+' must invite explanation, not only calculation');
    assert.ok(s.full.practice.some(q=>q.q.startsWith('Skills Plus')),id);
    assert.ok(s.full.practice.some(q=>q.q.startsWith('Application')),id);
    assert.ok(s.qs.length>=3,id+' concept exercises');
  }
  assert.equal(byId['1.R'].full.practice.length,12);
  assert.ok(byId['1.R'].full.practice.some(q=>/intensity/i.test(q.q)));
  assert.ok(byId['1.R'].full.lecture.some(([h])=>/Modeling variation/.test(h)));
  assert.match(byId['1.FM'].t,/Fitting lines/,'existing lesson identity must not be reassigned');
});
test('Chapter 1 added answer keys agree with independently calculated results and substitutions',()=>{
  const added={
    '1.1':[2*(-1)-3,50*Math.hypot(4-1,5-1)],
    '1.2':[Math.sqrt(25-(-3)**2),120/8],
    '1.3':[Math.sqrt(4+1+4),Math.hypot(6-(-2),7-1)/2],
    '1.4':[-6/3,26-(44-26)/(5-2)*2],
    '1.5':[(-1-Math.sqrt(1+24))/6,(-2+Math.sqrt(4+192))/2],
    '1.6':[(1*1-4*(-2))/(1**2+(-2)**2),Math.sqrt(13-9)],
    '1.7':[[1].filter(x=>x!==1&&(x*x-1)/(x-1)===2).length,1/(1/6+1/3)],
    '1.8':[[0,1,2,3,4,5].filter(x=>(x-1)*(x-4)<=0).length,Math.floor((60-10)/7)],
    '1.9':[(-7-1)/3,20+.4],
    '1.10':[-1,35/(12-5)]
  };
  for(const [id,values] of Object.entries(added)){
    values.forEach((v,i)=>assert.ok(Math.abs(byId[id].full.practice[6+i].ans-v)<1e-10,id));
  }
  const expected=[18/6,18/6*10,12*5/15,24/(2*3),20/2**2*5**2,6*2**2/3*8/4**2,90/3*7,3*40/60,2/2**2,80*2**2/4**2];
  expected.forEach((v,i)=>assert.equal(byId['1.11'].full.practice[i].ans,v));
  for(const x of [-1/3,3])assert.ok(Math.abs(1/(x-1)+1/(x+1)-3/4)<1e-12);
  for(const x of [(-1-Math.sqrt(7))/3,(-1+Math.sqrt(7))/3])assert.ok(Math.abs(3*x*x+2*x-2)<1e-12);
  assert.equal(gradeAnswer(byId['1.9'].full.practice[6],'-8/3').correct,true);
  assert.equal(gradeAnswer(byId['1.11'].full.practice[8],'1/2').correct,true);
});
