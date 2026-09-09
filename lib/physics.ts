import * as CANNON from 'cannon-es';
import {secureRandom,uniformInt} from './random.ts';
import {Vector3} from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
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
// Sample spherical corners around a smaller cube, retaining six broad flat faces.
// Merge coplanar hull triangles so contacts use continuous faces.
export function diceShape(){
 const core=.475-DICE_RADIUS,points:Vector3[]=[];
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
  for(let x=0;x<=1;x++)for(let y=0;y<=1;y++)for(let z=0;z<=1;z++){
   if(!x&&!y&&!z)continue;
   const n=new Vector3(x*sx,y*sy,z*sz).normalize();
   points.push(n.multiplyScalar(DICE_RADIUS).add(new Vector3(sx*core,sy*core,sz*core)));
  }
 }
 const hull=new ConvexHull().setFromPoints(points),vertices:CANNON.Vec3[]=[],indices=new Map<string,number>();
 const planes=new Map<string,{normal:Vector3,ids:Set<number>}>();
 for(const face of hull.faces){
  const key=[face.normal.x,face.normal.y,face.normal.z,face.constant].map(v=>v.toFixed(6)).join(',');
  let plane=planes.get(key);if(!plane){plane={normal:face.normal.clone(),ids:new Set()};planes.set(key,plane);}
  let edge=face.edge;do{const p=edge.head().point,k=p.toArray().map(v=>v.toFixed(6)).join(',');let id=indices.get(k);if(id===undefined){id=vertices.length;indices.set(k,id);vertices.push(new CANNON.Vec3(p.x,p.y,p.z));}plane.ids.add(id);edge=edge.next;}while(edge!==face.edge);
 }
 const faces=[...planes.values()].map(({normal,ids})=>{
  const n=new CANNON.Vec3(normal.x,normal.y,normal.z),center=new CANNON.Vec3();ids.forEach(i=>center.vadd(vertices[i],center));center.scale(1/ids.size,center);
  const u=n.cross(Math.abs(n.x)<.9?new CANNON.Vec3(1,0,0):new CANNON.Vec3(0,1,0)).unit(),v=n.cross(u);
  return [...ids].sort((i,j)=>{const p=vertices[i].vsub(center),q=vertices[j].vsub(center);return Math.atan2(p.dot(v),p.dot(u))-Math.atan2(q.dot(v),q.dot(u));});
 });
 return new CANNON.ConvexPolyhedron({vertices,faces});
}
export function createWorld(){const world=new CANNON.World({gravity:new CANNON.Vec3(0,-60,0),allowSleep:true});(world.solver as CANNON.GSSolver).iterations=20;
 world.addContactMaterial(new CANNON.ContactMaterial(woodMaterial,boneMaterial,{friction:.50,restitution:.035,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 world.addContactMaterial(new CANNON.ContactMaterial(boneMaterial,boneMaterial,{friction:0,restitution:.12,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 for(const [w,h,d,x,y,z] of [[13,.45,9,0,-.225,0],[.35,10,9,-6.3,5,0],[.35,10,9,6.3,5,0],[13,10,.35,0,5,4.35],[13,10,.35,0,5,-4.35]]){const b=new CANNON.Body({mass:0,material:woodMaterial,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});b.position.set(x,y,z);world.addBody(b);}
 // A heavy first impact dissipates the throw's forward energy on the wood.
 world.addEventListener('postStep',()=>{for(const contact of world.contacts){
  const die=awaitingLanding.has(contact.bi)?contact.bi:awaitingLanding.has(contact.bj)?contact.bj:null;
  if(!die)continue;const other=contact.bi===die?contact.bj:contact.bi;
  if(other.mass!==0||other.position.y>=0)continue;
  awaitingLanding.delete(die);die.velocity.x*=.42;die.velocity.z*=.42;die.angularVelocity.scale(.35,die.angularVelocity);
 }});
 return world;
}
export function createDie(world:CANNON.World){const b=new CANNON.Body({mass:2.8,material:boneMaterial,shape:diceShape(),linearDamping:.18,angularDamping:.32,allowSleep:true,sleepSpeedLimit:.10,sleepTimeLimit:.5});world.addBody(b);return b;}
export function launchDie(b:CANNON.Body,j:number,random:()=>number=secureRandom){
 setShellRotation(b,uniformInt(24));
 recoveryAttempts.delete(b);b.type=CANNON.Body.DYNAMIC;b.updateMassProperties();b.wakeUp();
 const row=Math.floor(j/3),lane=j%3-1;
 b.position.set(lane*1.65,1.2+row*1.6,3.5);
 awaitingLanding.add(b);
 // Physical tumbling is independent of the numbered shell orientation.
 const u=random(),v=random()*2*Math.PI,w=random()*2*Math.PI;b.quaternion.set(Math.sqrt(1-u)*Math.sin(v),Math.sqrt(1-u)*Math.cos(v),Math.sqrt(u)*Math.sin(w),Math.sqrt(u)*Math.cos(w));
 // Solve the flight to a spread of landing points around the table center.
 const up=2+random()*.3,flight=(up+Math.sqrt(up*up+120*(b.position.y-.7)))/60;
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
 const neighbor=b.world?.bodies.filter(other=>other!==b&&other.shapes[0] instanceof CANNON.ConvexPolyhedron&&other.position.distanceTo(b.position)<1.65).sort((a,c)=>a.position.distanceTo(b.position)-c.position.distanceTo(b.position))[0];
 if(neighbor){const dx=b.position.x-neighbor.position.x,dz=b.position.z-neighbor.position.z;if(Math.hypot(dx,dz)>.05)angle=Math.atan2(dz,dx)+Math.sin(attempt*2.399963)*.35;}
 if(Math.abs(b.position.x)>3||Math.abs(b.position.z)>2.5)angle=Math.atan2(-b.position.z,-b.position.x);
 const strength=1+Math.min(attempt,3)*.2;
 b.wakeUp();b.applyImpulse(new CANNON.Vec3(Math.cos(angle)*2.6*strength,4.4,Math.sin(angle)*2.6*strength).scale(b.mass),new CANNON.Vec3(Math.cos(angle+.8)*.24,0,Math.sin(angle+.8)*.24));
}
