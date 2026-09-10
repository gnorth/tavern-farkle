import * as CANNON from 'cannon-es';
import {createWorld,createDie,launchDie,nudgeTilted,upperFace,cubeSymmetry,PHYSICS_STEP} from './physics.ts';
export type Pose={p:CANNON.Vec3;q:CANNON.Quaternion};
// Simulate once, then keep the same numbered shell throughout playback.
export function diceReplay(values:number[],seed:number,scale=1){
 const world=createWorld(true);const dice=values.map(()=>createDie(world,scale));
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 dice.forEach((b,i)=>launchDie(b,i,random,true));const frames:Pose[][]=[];
 for(let step=0;step<2400;step++){
  frames.push(dice.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})));
  if(step>60&&dice.every(b=>b.sleepState===CANNON.Body.SLEEPING&&upperFace(b.quaternion).alignment>.985))break;
  world.step(PHYSICS_STEP);if(step>0&&step%90===0)dice.forEach(nudgeTilted);
 }
 const shells=dice.map((b,i)=>{for(let n=0;n<24;n++){const shell=cubeSymmetry(n);if(upperFace(b.quaternion.mult(shell)).value===values[i])return shell;}throw new Error('Invalid die face');});
 for(const frame of frames)frame.forEach((pose,i)=>{pose.q=pose.q.mult(shells[i]);});
 return frames;
}
