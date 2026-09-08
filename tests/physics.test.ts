import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {createWorld,createDie,launchDie,nudgeTilted,upperFace,normals,faceValues} from '../lib/physics.ts';
test('top-face detection agrees with all six rendered materials',()=>{normals.forEach((n,i)=>{const q=new CANNON.Quaternion();q.setFromVectors(n,new CANNON.Vec3(0,1,0));assert.equal(upperFace(q).value,faceValues[i]);assert.ok(upperFace(q).alignment>.999);});});
test('100 seeded six-die throws settle on flat faces within tray',()=>{let seed=7193;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};let longest=0;
 for(let run=0;run<100;run++){const world=createWorld();const dice=Array.from({length:6},()=>createDie(world));dice.forEach((b,i)=>launchDie(b,i,random));let settled=false;
 for(let step=0;step<1800;step++){world.step(1/60);if(step>40&&dice.every(b=>b.sleepState===CANNON.Body.SLEEPING&&upperFace(b.quaternion).alignment>.985)){settled=true;longest=Math.max(longest,step/60);break;}if(step>0&&step%150===0)dice.forEach(nudgeTilted);}
 assert.ok(settled,`throw ${run} failed to settle`);dice.forEach(b=>{assert.ok(Math.abs(b.position.x)<6.3&&Math.abs(b.position.z)<4.35);assert.ok(upperFace(b.quaternion).value>=1&&upperFace(b.quaternion).value<=6);});}
 console.log(`100 physics throws settled; longest ${longest.toFixed(2)}s`);
});
