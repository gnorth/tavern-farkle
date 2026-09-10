import * as CANNON from 'cannon-es';
import {secureRandom,uniformInt} from './random.ts';
export const DICE_RADIUS=.16;
export const faceValues=[1,6,2,5,3,4];
export const normals=[new CANNON.Vec3(1,0,0),new CANNON.Vec3(-1,0,0),new CANNON.Vec3(0,1,0),new CANNON.Vec3(0,-1,0),new CANNON.Vec3(0,0,1),new CANNON.Vec3(0,0,-1)];
export function upperFace(q:CANNON.Quaternion){let best=-2,index=0;normals.forEach((n,i)=>{const y=q.vmult(n).y;if(y>best){best=y;index=i;}});return {value:faceValues[index],alignment:best};}
// A cube has 24 rotational symmetries. Randomize the numbered shell before
// each throw, independently of the unlabelled collision body's trajectory.
// For ANY resting body face, each number occurs in exactly 4 of the 24 poses.
// The same shell quaternion is rendered throughout the throw and read at rest.
const shellRotations=new WeakMap<CANNON.Body,CANNON.Quaternion>();
export function cubeSymmetry(index:number){
 if(!Number.isInteger(index)||index<0||index>=24)throw new Error('Invalid cube symmetry');
 const up=new CANNON.Vec3(0,1,0),align=new CANNON.Quaternion(),yaw=new CANNON.Quaternion();
 align.setFromVectors(normals[Math.floor(index/4)],up);yaw.setFromAxisAngle(up,index%4*Math.PI/2);
 return yaw.mult(align).normalize();
}
export function clearShellRotation(b:CANNON.Body){shellRotations.delete(b);}
export function setShellRotation(b:CANNON.Body,index:number){shellRotations.set(b,cubeSymmetry(index));}
export function visibleQuaternion(b:CANNON.Body,interpolated=false){
 const q=interpolated?b.interpolatedQuaternion:b.quaternion,shell=shellRotations.get(b);
 return shell?q.mult(shell):q;
}
export function rolledFace(b:CANNON.Body){return upperFace(visibleQuaternion(b));}
export const PHYSICS_STEP=1/120;
const woodMaterial=new CANNON.Material('wood');
const boneMaterial=new CANNON.Material('bone');
const awaitingLanding=new WeakSet<CANNON.Body>();
// Six flat faces and square edges: no bevels that can support a tilted die.
export function diceShape(scale=1){return new CANNON.Box(new CANNON.Vec3(.475*scale,.475*scale,.475*scale));}
const compactWorlds=new WeakSet<CANNON.World>();
const GRAVITY=38;
const trayWalls=new WeakMap<CANNON.World,CANNON.Body[]>();
export function setWorldCompact(world:CANNON.World,compact:boolean){
 if(compact)compactWorlds.add(world);else compactWorlds.delete(world);
 const walls=trayWalls.get(world);if(!walls)return;
 const halfX=compact?3:6.3,halfZ=compact?2.5:4.35;
 walls[0].position.x=-halfX;walls[1].position.x=halfX;
 walls[2].position.z=halfZ;walls[3].position.z=-halfZ;
 walls.forEach(w=>{w.aabbNeedsUpdate=true;});
}
// Numerical safety net for a missed collision or a viewport change mid-throw.
// Preserve orientation and numbering; only return escaped bodies to the tray.
function containDice(world:CANNON.World){
 const compact=compactWorlds.has(world),halfX=compact?3:6.3,halfZ=compact?2.5:4.35;
 for(const b of world.bodies){
  if(b.type!==CANNON.Body.DYNAMIC||!(b.shapes[0] instanceof CANNON.Box))continue;
  const radius=b.shapes[0].boundingSphereRadius;
  let moved=false;
  for(const [axis,limit] of [['x',halfX-.175-radius],['z',halfZ-.175-radius]] as const){
   if(Math.abs(b.position[axis])>limit){
    const sign=Math.sign(b.position[axis]);b.position[axis]=sign*limit;
    if(b.velocity[axis]*sign>0)b.velocity[axis]*=-.16;
    moved=true;
   }
  }
  if(b.position.y<0){b.position.y=radius;b.velocity.y=Math.max(0,b.velocity.y);moved=true;}
  if(moved){b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.aabbNeedsUpdate=true;b.wakeUp();}
 }
}
export function createWorld(compact=false){const world=new CANNON.World({gravity:new CANNON.Vec3(0,-GRAVITY,0),allowSleep:true});(world.solver as CANNON.GSSolver).iterations=20;if(compact)compactWorlds.add(world);
 world.addContactMaterial(new CANNON.ContactMaterial(woodMaterial,boneMaterial,{friction:.4,restitution:.16,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 world.addContactMaterial(new CANNON.ContactMaterial(boneMaterial,boneMaterial,{friction:0,restitution:.12,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 const halfX=compact?3:6.3,halfZ=compact?2.5:4.35;
 for(const [w,h,d,x,y,z] of [[13,.45,9,0,-.225,0],[.35,10,9,-halfX,5,0],[.35,10,9,halfX,5,0],[13,10,.35,0,5,halfZ],[13,10,.35,0,5,-halfZ]]){const b=new CANNON.Body({mass:0,material:woodMaterial,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});b.position.set(x,y,z);world.addBody(b);}
 trayWalls.set(world,world.bodies.slice(1,5));
 world.addEventListener('postStep',()=>containDice(world));
 // A modest first-impact loss retains a natural bounce and tumble on wood.
 world.addEventListener('postStep',()=>{for(const contact of world.contacts){
  const die=awaitingLanding.has(contact.bi)?contact.bi:awaitingLanding.has(contact.bj)?contact.bj:null;
  if(!die)continue;const other=contact.bi===die?contact.bj:contact.bi;
  if(other.mass!==0||other.position.y>=0)continue;
  awaitingLanding.delete(die);die.velocity.x*=.65;die.velocity.z*=.65;die.angularVelocity.scale(.65,die.angularVelocity);
 }});
 return world;
}
export function createDie(world:CANNON.World,scale=1){const b=new CANNON.Body({mass:2.8,material:boneMaterial,shape:diceShape(scale),linearDamping:.16,angularDamping:.24,allowSleep:true,sleepSpeedLimit:.10,sleepTimeLimit:.5});world.addBody(b);return b;}
export function launchDie(b:CANNON.Body,j:number,random:()=>number=secureRandom,compact=false){
 compact=b.world?compactWorlds.has(b.world):compact;
 setShellRotation(b,uniformInt(24));
 recoveryAttempts.delete(b);b.type=CANNON.Body.DYNAMIC;b.updateMassProperties();b.wakeUp();
 const row=Math.floor(j/3),lane=j%3-1;
 b.position.set(lane*1.65,1.2+row*1.6,compact?1.75:3.5);
 awaitingLanding.add(b);
 // Physical tumbling is independent of the numbered shell orientation.
 const u=random(),v=random()*2*Math.PI,w=random()*2*Math.PI;b.quaternion.set(Math.sqrt(1-u)*Math.sin(v),Math.sqrt(1-u)*Math.cos(v),Math.sqrt(u)*Math.sin(w),Math.sqrt(u)*Math.cos(w));
 // Solve the flight to a spread of landing points around the table center.
 const up=2+random()*.3,flight=(up+Math.sqrt(up*up+2*GRAVITY*(b.position.y-.7)))/GRAVITY;
 const targetX=lane*1.45+(random()-.5)*.24,targetZ=(row?.8:-.6)+(random()-.5)*.2;
 b.velocity.set((targetX-b.position.x)/flight,up,(targetZ-b.position.z)/flight);
 b.angularVelocity.set(-(9+random()*4),(random()-.5)*5,(random()-.5)*4);
 b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.aabbNeedsUpdate=true;
}
const recoveryAttempts=new WeakMap<CANNON.Body,number>();
export function nudgeTilted(b:CANNON.Body){
 if(upperFace(b.quaternion).alignment>=.985&&b.position.y<.65)return;
 if(b.sleepState!==CANNON.Body.SLEEPING&&(b.velocity.length()>.35||b.angularVelocity.length()>.5))return;
 // Only free a resting cocked die with a small physical tap; never relocate it or pick its result.
 const attempt=recoveryAttempts.get(b)??0;recoveryAttempts.set(b,attempt+1);
 let angle=attempt*2.399963+b.position.x;
 // Push away from the closest die supporting this one, instead of back into it.
 const neighbor=b.world?.bodies.filter(other=>other!==b&&other.mass>0&&other.shapes[0] instanceof CANNON.Box&&other.position.distanceTo(b.position)<1.65).sort((a,c)=>a.position.distanceTo(b.position)-c.position.distanceTo(b.position))[0];
 if(neighbor){const dx=b.position.x-neighbor.position.x,dz=b.position.z-neighbor.position.z;if(Math.hypot(dx,dz)>.05)angle=Math.atan2(dz,dx)+Math.sin(attempt*2.399963)*.35;}
 if(Math.abs(b.position.x)>(b.world&&compactWorlds.has(b.world)?2:3)||Math.abs(b.position.z)>(b.world&&compactWorlds.has(b.world)?1.5:2.5))angle=Math.atan2(-b.position.z,-b.position.x)+(b.world&&compactWorlds.has(b.world)?Math.sin(attempt*2.399963)*1.1:0);
 const strength=1+Math.min(attempt,3)*.2;
 b.wakeUp();b.applyImpulse(new CANNON.Vec3(Math.cos(angle)*2.6*strength,4.4,Math.sin(angle)*2.6*strength).scale(b.mass),new CANNON.Vec3(Math.cos(angle+.8)*.24,0,Math.sin(angle+.8)*.24));
}
