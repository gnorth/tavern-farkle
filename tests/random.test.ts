import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {uniformInt,secureRandom} from '../lib/random.ts';
import {cubeSymmetry,upperFace,normals,setShellRotation,clearShellRotation,visibleQuaternion,rolledFace} from '../lib/physics.ts';
import {bestSelection} from '../lib/game.ts';
test('rejection sampling avoids modulo bias',()=>{const draws=[4294967295,4294967280,23];assert.equal(uniformInt(24,()=>draws.shift()!),23);assert.equal(draws.length,0);});
test('each number has exactly 1/6 probability for every possible resting face',()=>{
 for(const normal of normals){
  const resting=new CANNON.Quaternion().setFromVectors(normal,new CANNON.Vec3(0,1,0));const counts=Array(6).fill(0);
  for(let i=0;i<24;i++){const result=upperFace(resting.mult(cubeSymmetry(i)));assert.ok(result.alignment>.999);counts[result.value-1]++;}
  assert.deepEqual(counts,[4,4,4,4,4,4]);
 }
});
test('rendering and score use the same fixed numbered shell, including interpolation',()=>{
 const b=new CANNON.Body();b.quaternion.setFromEuler(.3,.8,.5);b.interpolatedQuaternion.copy(b.quaternion);
 for(let i=0;i<24;i++){setShellRotation(b,i);assert.deepEqual(rolledFace(b),upperFace(visibleQuaternion(b,true)));const q=visibleQuaternion(b).clone();assert.deepEqual(visibleQuaternion(b),q);}
 clearShellRotation(b);assert.deepEqual(visibleQuaternion(b),b.quaternion);
});
test('secure random draws stay in range and do not use Math.random',()=>{
 const original=Math.random;Math.random=()=>{throw new Error('Not a secure source');};
 try{for(let i=0;i<1000;i++){const n=secureRandom();assert.ok(n>=0&&n<1);const index=uniformInt(24);assert.ok(index>=0&&index<24);}}finally{Math.random=original;}
});
test('report exact scoring frequency for six ordinary fair dice',()=>{
 let scoring=0,triples=0;
 for(let n=0;n<46656;n++){let k=n;const dice=Array.from({length:6},()=>{const d=k%6+1;k=Math.floor(k/6);return d;});if(bestSelection(dice).score)scoring++;if([1,2,3,4,5,6].some(v=>dice.filter(d=>d===v).length>=3))triples++;}
 console.log(JSON.stringify({scoring,triples,outcomes:46656,scoringPercent:scoring/46656*100,triplesPercent:triples/46656*100}));
 assert.ok(scoring>0&&scoring<46656);
});
