import * as CANNON from 'cannon-es';
export const faceValues=[1,6,2,5,3,4];
export const normals=[new CANNON.Vec3(1,0,0),new CANNON.Vec3(-1,0,0),new CANNON.Vec3(0,1,0),new CANNON.Vec3(0,-1,0),new CANNON.Vec3(0,0,1),new CANNON.Vec3(0,0,-1)];
export function upperFace(q:CANNON.Quaternion){let best=-2,index=0;normals.forEach((n,i)=>{const y=q.vmult(n).y;if(y>best){best=y;index=i;}});return {value:faceValues[index],alignment:best};}
export const PHYSICS_STEP=1/120;
const woodMaterial=new CANNON.Material('wood');
const boneMaterial=new CANNON.Material('bone');
// Narrow edge relief leaves large, stable scoring faces.
export function diceShape(){
 const a=.475,b=.463,vertices:CANNON.Vec3[]=[];
 for(let axis=0;axis<3;axis++)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const p=[b*x,b*y,b*z];p[axis]=a*[x,y,z][axis];vertices.push(new CANNON.Vec3(...p));}
 const directions:CANNON.Vec3[]=[];
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push(new CANNON.Vec3(x,y,z).unit());
 const faces=directions.map(n=>{const support=Math.max(...vertices.map(v=>v.dot(n)));const ids=vertices.map((_,i)=>i).filter(i=>support-vertices[i].dot(n)<1e-6);const center=new CANNON.Vec3();ids.forEach(i=>center.vadd(vertices[i],center));center.scale(1/ids.length,center);const u=n.cross(Math.abs(n.x)<.9?new CANNON.Vec3(1,0,0):new CANNON.Vec3(0,1,0)).unit();const v=n.cross(u);return ids.sort((i,j)=>{const p=vertices[i].vsub(center),q=vertices[j].vsub(center);return Math.atan2(p.dot(v),p.dot(u))-Math.atan2(q.dot(v),q.dot(u));});});
 return new CANNON.ConvexPolyhedron({vertices,faces});
}
export function createWorld(){const world=new CANNON.World({gravity:new CANNON.Vec3(0,-60,0),allowSleep:true});(world.solver as CANNON.GSSolver).iterations=20;
 world.addContactMaterial(new CANNON.ContactMaterial(woodMaterial,boneMaterial,{friction:.50,restitution:.035,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 world.addContactMaterial(new CANNON.ContactMaterial(boneMaterial,boneMaterial,{friction:.12,restitution:.10,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 for(const [w,h,d,x,y,z] of [[13,.45,9,0,-.225,0],[.35,10,9,-6.3,5,0],[.35,10,9,6.3,5,0],[13,10,.35,0,5,4.35],[13,10,.35,0,5,-4.35]]){const b=new CANNON.Body({mass:0,material:woodMaterial,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});b.position.set(x,y,z);world.addBody(b);}
 return world;
}
export function createDie(world:CANNON.World){const b=new CANNON.Body({mass:2.8,material:boneMaterial,shape:diceShape(),linearDamping:.18,angularDamping:.32,allowSleep:true,sleepSpeedLimit:.10,sleepTimeLimit:.5});world.addBody(b);return b;}
export function launchDie(b:CANNON.Body,j:number,random:()=>number=Math.random){
 recoveryAttempts.delete(b);b.type=CANNON.Body.DYNAMIC;b.updateMassProperties();b.wakeUp();
 b.position.set((j%3-1)*1.65+(random()-.5)*.08,.85+random()*.07,1.55+Math.floor(j/3)*1.6);
 // Uniform random orientation; outcomes still come solely from the physical resting face.
 const u=random(),v=random()*2*Math.PI,w=random()*2*Math.PI;b.quaternion.set(Math.sqrt(1-u)*Math.sin(v),Math.sqrt(1-u)*Math.cos(v),Math.sqrt(u)*Math.sin(w),Math.sqrt(u)*Math.cos(w));
 b.velocity.set((j%3-1)*1.1+(random()-.5)*2.6,.8+random()*.5,-(10.5+random()*2.5));
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
 const neighbor=b.world?.bodies.filter(other=>other!==b&&other.mass>0&&other.position.distanceTo(b.position)<1.65).sort((a,c)=>a.position.distanceTo(b.position)-c.position.distanceTo(b.position))[0];
 if(neighbor){const dx=b.position.x-neighbor.position.x,dz=b.position.z-neighbor.position.z;if(Math.hypot(dx,dz)>.05)angle=Math.atan2(dz,dx);}
 const strength=1+Math.min(attempt,3)*.2;
 b.wakeUp();b.applyImpulse(new CANNON.Vec3(Math.cos(angle)*2.6*strength,4.4,Math.sin(angle)*2.6*strength).scale(b.mass),new CANNON.Vec3(Math.cos(angle+.8)*.24,0,Math.sin(angle+.8)*.24));
}
