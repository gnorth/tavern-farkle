import * as CANNON from 'cannon-es';
export const faceValues=[1,6,2,5,3,4];
export const normals=[new CANNON.Vec3(1,0,0),new CANNON.Vec3(-1,0,0),new CANNON.Vec3(0,1,0),new CANNON.Vec3(0,-1,0),new CANNON.Vec3(0,0,1),new CANNON.Vec3(0,0,-1)];
export function upperFace(q:CANNON.Quaternion){let best=-2,index=0;normals.forEach((n,i)=>{const y=q.vmult(n).y;if(y>best){best=y;index=i;}});return {value:faceValues[index],alignment:best};}
export const PHYSICS_STEP=1/120;
const woodMaterial=new CANNON.Material('wood');
const boneMaterial=new CANNON.Material('bone');
// Plain cube: no bevel surfaces on which a die can rest.
export function diceShape(){return new CANNON.Box(new CANNON.Vec3(.475,.475,.475));}
export function createWorld(){const world=new CANNON.World({gravity:new CANNON.Vec3(0,-60,0),allowSleep:true});(world.solver as CANNON.GSSolver).iterations=20;
 world.addContactMaterial(new CANNON.ContactMaterial(woodMaterial,boneMaterial,{friction:.50,restitution:.035,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 world.addContactMaterial(new CANNON.ContactMaterial(boneMaterial,boneMaterial,{friction:.30,restitution:.07,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 for(const [w,h,d,x,y,z] of [[13,.45,9,0,-.225,0],[.35,10,9,-6.3,5,0],[.35,10,9,6.3,5,0],[13,10,.35,0,5,4.35],[13,10,.35,0,5,-4.35]]){const b=new CANNON.Body({mass:0,material:woodMaterial,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});b.position.set(x,y,z);world.addBody(b);}
 return world;
}
export function createDie(world:CANNON.World){const b=new CANNON.Body({mass:2.8,material:boneMaterial,shape:diceShape(),linearDamping:.18,angularDamping:.32,allowSleep:true,sleepSpeedLimit:.10,sleepTimeLimit:.5});world.addBody(b);return b;}
export function launchDie(b:CANNON.Body,j:number,random:()=>number=Math.random){
 b.type=CANNON.Body.DYNAMIC;b.updateMassProperties();b.wakeUp();
 b.position.set((j%3-1)*1.65+(random()-.5)*.08,.85+random()*.07,1.55+Math.floor(j/3)*1.6);
 // Uniform random orientation; outcomes still come solely from the physical resting face.
 const u=random(),v=random()*2*Math.PI,w=random()*2*Math.PI;b.quaternion.set(Math.sqrt(1-u)*Math.sin(v),Math.sqrt(1-u)*Math.cos(v),Math.sqrt(u)*Math.sin(w),Math.sqrt(u)*Math.cos(w));
 b.velocity.set((j%3-1)*.75+(random()-.5)*2.2,-.3+random()*.15,-(4+random()*1.2));
 b.angularVelocity.set(-(2.8+random()*2.4),(random()-.5)*4,(random()-.5)*3.5);
 b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.aabbNeedsUpdate=true;
}
const recoveryAttempts=new WeakMap<CANNON.Body,number>();
export function nudgeTilted(b:CANNON.Body){
 if(upperFace(b.quaternion).alignment>=.985)return;
 if(b.sleepState!==CANNON.Body.SLEEPING&&(b.velocity.length()>.35||b.angularVelocity.length()>.5))return;
 // Only free a resting cocked die with a small physical tap; never relocate it or pick its result.
 const attempt=recoveryAttempts.get(b)??0;recoveryAttempts.set(b,attempt+1);
 const angle=attempt*2.399963+b.position.x;
 b.wakeUp();b.applyImpulse(new CANNON.Vec3(Math.cos(angle)*1.8,4.4,Math.sin(angle)*1.8).scale(b.mass),new CANNON.Vec3(Math.cos(angle+.8)*.24,0,Math.sin(angle+.8)*.24));
}
