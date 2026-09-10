import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {createWorld,createDie,launchDie,nudgeTilted,upperFace,normals,faceValues,PHYSICS_STEP} from '../lib/physics.ts';
test('top-face detection agrees with all six rendered materials',()=>{normals.forEach((n,i)=>{const q=new CANNON.Quaternion();q.setFromVectors(n,new CANNON.Vec3(0,1,0));assert.equal(upperFace(q).value,faceValues[i]);assert.ok(upperFace(q).alignment>.999);});});
test('100 seeded six-die throws settle on flat faces within tray',()=>{let seed=7193;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};let longest=0;
 for(let run=0;run<100;run++){const world=createWorld();const dice=Array.from({length:6},()=>createDie(world));dice.forEach((b,i)=>launchDie(b,i,random));let settled=false;
 for(let step=0;step<3600;step++){world.step(PHYSICS_STEP);if(step>40&&dice.every(b=>b.sleepState===CANNON.Body.SLEEPING&&upperFace(b.quaternion).alignment>.985&&b.position.y<.65)){settled=true;longest=Math.max(longest,step*PHYSICS_STEP);break;}if(step>0&&step%90===0)dice.forEach(nudgeTilted);}
 assert.ok(settled,`throw ${run} failed to settle`);dice.forEach(b=>{assert.ok(Math.abs(b.position.x)<6.3&&Math.abs(b.position.z)<4.35);assert.ok(upperFace(b.quaternion).value>=1&&upperFace(b.quaternion).value<=6);});}
 console.log(`100 physics throws settled; longest ${longest.toFixed(2)}s`);
});
test('all reroll sizes settle alongside held dice',()=>{let seed=8041;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};for(let count=1;count<=5;count++)for(let run=0;run<20;run++){const world=createWorld();const dice=Array.from({length:6},()=>createDie(world));dice.forEach((b,i)=>{if(i<count)launchDie(b,i,random);else{b.type=CANNON.Body.STATIC;b.position.set((i-2.5)*1.45,.52,-3.35);b.updateMassProperties();}});let settled=false;for(let step=0;step<3600;step++){world.step(PHYSICS_STEP);if(step>80&&dice.slice(0,count).every(b=>b.sleepState===CANNON.Body.SLEEPING&&upperFace(b.quaternion).alignment>.985&&b.position.y<.65)){settled=true;break;}if(step>0&&step%90===0)dice.slice(0,count).forEach(nudgeTilted);}assert.ok(settled,`reroll ${count} / ${run}: ${JSON.stringify(dice.slice(0,count).map(b=>({p:b.position,v:b.velocity,w:b.angularVelocity,s:b.sleepState,a:upperFace(b.quaternion).alignment})))}`);dice.slice(count).forEach((b,j)=>assert.equal(b.position.x,(count+j-2.5)*1.45));}});
test('cocked-die recovery applies an impulse without teleporting',()=>{const world=createWorld();const b=createDie(world);b.position.set(0,.6,0);b.quaternion.setFromEuler(0,0,Math.PI/4);b.sleep();const before=b.position.clone();nudgeTilted(b);assert.deepEqual(b.position,before);assert.ok(b.velocity.length()>0);});

test('sleeping dice stacked or leaning on a neighbor separate and settle on the table',()=>{
 for(const offset of [0,.35,.7]){
  const world=createWorld(),bottom=createDie(world),top=createDie(world);
  bottom.position.set(0,.475,0);top.position.set(offset,1.425,0);
  bottom.sleep();top.sleep();
  const before=top.position.clone();nudgeTilted(top);
  assert.deepEqual(top.position,before);assert.ok(top.velocity.length()>0);
  let settled=false;
  for(let step=0;step<1800;step++){
   world.step(PHYSICS_STEP);
   if(step>0&&step%90===0)[bottom,top].forEach(nudgeTilted);
   if([bottom,top].every(b=>b.sleepState===CANNON.Body.SLEEPING&&b.position.y<.65&&upperFace(b.quaternion).alignment>.985)){settled=true;break;}
  }
  assert.ok(settled,`stack at offset ${offset} failed to separate`);
 }
});
test('strong throws first touch the table in its central landing area',()=>{
 let seed=202609;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let run=0;run<30;run++){
  const world=createWorld(),dice=Array.from({length:6},()=>createDie(world)),landed=new Set<CANNON.Body>();
  dice.forEach((b,i)=>{b.addEventListener('collide',(event:{body:CANNON.Body})=>{
   if(event.body.mass!==0||event.body.position.y>=0||landed.has(b))return;
   landed.add(b);assert.ok(Math.abs(b.position.x)<2.5&&Math.abs(b.position.z)<1.8,`landing ${run}/${i}: ${b.position.x}, ${b.position.z}`);
  });launchDie(b,i,random);});
  for(let step=0;step<120&&landed.size<6;step++)world.step(PHYSICS_STEP);
  assert.equal(landed.size,6);
 }
});

test('tilted dice slide free of neighboring dice across contact directions',()=>{
 for(let i=0;i<12;i++){
  const world=createWorld(),base=createDie(world),leaning=createDie(world),angle=i*Math.PI/6;
  base.position.set(0,.475,0);
  leaning.position.set(Math.cos(angle)*.85,.85,Math.sin(angle)*.85);
  leaning.quaternion.setFromEuler(.35,angle,.55);
  base.sleep();leaning.sleep();let settled=false;
  for(let step=0;step<1800;step++){
   world.step(PHYSICS_STEP);
   if(step%90===0)[base,leaning].forEach(nudgeTilted);
   if([base,leaning].every(b=>b.sleepState===CANNON.Body.SLEEPING&&b.position.y<.65&&upperFace(b.quaternion).alignment>.985)){settled=true;break;}
  }
  assert.ok(settled,`leaning contact ${i} did not separate`);
 }
});

test('mobile throws stay central and cannot overlap the held row',()=>{
 let seed=49031;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let count=1;count<=6;count++)for(let run=0;run<10;run++){
  const world=createWorld(true),dice=Array.from({length:count},()=>createDie(world,1.2));
  dice.forEach((die,i)=>launchDie(die,i,random,true));let settled=false;
  for(let step=0;step<3600;step++){
   world.step(PHYSICS_STEP);
   dice.forEach(die=>assert.ok(die.position.z> -2.6,'thrown die entered held row'));
   if(step%90===0)dice.forEach(nudgeTilted);
   if(step>80&&dice.every(die=>die.sleepState===CANNON.Body.SLEEPING&&upperFace(die.quaternion).alignment>.985&&die.position.y<.65)){settled=true;break;}
  }
  assert.ok(settled,`mobile ${count} dice, run ${run} did not settle: ${JSON.stringify(dice.map(b=>({p:b.position,a:upperFace(b.quaternion).alignment,s:b.sleepState})))}`);
  for(const die of dice){assert.ok(Math.abs(die.position.x)<3&&Math.abs(die.position.z)<2.5);assert.ok(die.position.z-0.84>-3.5+0.57,'visible dice overlap held row');}
 }
});
