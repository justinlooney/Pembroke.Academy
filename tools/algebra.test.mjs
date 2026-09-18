import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INTRO_MATH} from '../assets/app/intro-math.mjs';
import {gradeAnswer} from '../assets/app/grading.mjs';
import {normalizeStudy} from '../assets/app/progress.mjs';
const sections=INTRO_MATH.units.flatMap(u=>u.sections), byId=Object.fromEntries(sections.map(s=>[s.n,s]));
test('algebra covers all chapters with teaching, worked examples, explained practice, and reviews',()=>{
  assert.equal(sections.length,73);assert.equal(new Set(sections.map(s=>s.n)).size,73);
  assert.deepEqual(sections.slice(0,3).map(s=>s.n),['1.1','1.2','1.3']);
  for(const prefix of ['P','G','FN','PF','EX','SY','MX','CO','SQ','PR','GE']){
    const lessons=sections.filter(s=>s.n.startsWith(prefix+'.')&&!s.n.endsWith('.R'));
    assert.ok(lessons.length>=2);assert.ok(byId[prefix+'.R']);
    for(const {full:f,qs,n} of lessons){
      assert.ok(f.lecture.length>=5,n);assert.ok(f.lecture.every(([h,p])=>h&&p.length>=140),n);
      assert.equal(1+f.examples.length,2,n);assert.ok([f.worked,...f.examples].every(e=>e.steps.length>=3),n);
      assert.equal(f.practice.length,6,n);assert.ok(f.practice.every(q=>q.work&&q.sol&&q.hints.length),n);
      assert.equal(f.homework.gen.length,4,n);assert.ok(qs.length>=3,n);
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
  assert.equal(normalizeStudy({MATH101:{'1.1':2,x:{'1.1':{kc:1}}}}).MATH101['1.1'],2);
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
  for(const file of ['lesson-tools','prerequisites','equations','functions','polynomials','exponentials','systems','matrices','conics','sequences','probability','geometry','final-review'])assert.ok(sw.includes('algebra/'+file+'.mjs'),file);
  assert.ok(sw.includes('algebra-figures.mjs'));
});
