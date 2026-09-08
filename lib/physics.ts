import * as CANNON from 'cannon-es';
export const faceValues=[1,6,2,5,3,4];
export const normals=[new CANNON.Vec3(1,0,0),new CANNON.Vec3(-1,0,0),new CANNON.Vec3(0,1,0),new CANNON.Vec3(0,-1,0),new CANNON.Vec3(0,0,1),new CANNON.Vec3(0,0,-1)];
export function upperFace(q:CANNON.Quaternion){let best=-2,index=0;normals.forEach((n,i)=>{const y=q.vmult(n).y;if(y>best){best=y;index=i;}});return {value:faceValues[index],alignment:best};}
export function createWorld(){const world=new CANNON.World({gravity:new CANNON.Vec3(0,-24,0),allowSleep:true});(world.solver as CANNON.GSSolver).iterations=16;world.defaultContactMaterial.friction=.36;world.defaultContactMaterial.restitution=.22;
 for(const [w,h,d,x,y,z] of [[13,.45,9,0,-.225,0],[.35,.65,9,-6.3,.25,0],[.35,.65,9,6.3,.25,0],[13,.65,.35,0,.25,4.35],[13,.65,.35,0,.25,-4.35]]){const b=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});b.position.set(x,y,z);world.addBody(b);}
 // Invisible tall perimeter keeps energetic dice on the table.
 for(const [w,d,x,z] of [[.35,9,-6.3,0],[.35,9,6.3,0],[13,.35,0,4.35],[13,.35,0,-4.35]]){const b=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,5,d/2))});b.position.set(x,5,z);world.addBody(b);}
 return world;
}
export function createDie(world:CANNON.World){const b=new CANNON.Body({mass:1,shape:new CANNON.Box(new CANNON.Vec3(.475,.475,.475)),linearDamping:.2,angularDamping:.23,allowSleep:true,sleepSpeedLimit:.12,sleepTimeLimit:.55});world.addBody(b);return b;}
export function launchDie(b:CANNON.Body,j:number,random:()=>number=Math.random){b.type=CANNON.Body.DYNAMIC;b.updateMassProperties();b.wakeUp();b.position.set((j%3-1)*2.3+(random()-.5)*.3,2.5+Math.floor(j/3)*1.2,(Math.floor(j/3)-.5)*2.2);b.quaternion.setFromEuler(random()*6.28,random()*6.28,random()*6.28);b.velocity.set((random()-.5)*7,-1,(random()-.5)*7);b.angularVelocity.set((random()-.5)*22,(random()-.5)*22,(random()-.5)*22);}
export function nudgeTilted(b:CANNON.Body){if(upperFace(b.quaternion).alignment<.985||b.position.y>1.1){b.wakeUp();b.position.y+=1.2;b.position.x=Math.max(-4.8,Math.min(4.8,b.position.x));b.position.z=Math.max(-2.6,Math.min(2.6,b.position.z));b.velocity.set(b.position.x>0?-2:2,4,b.position.z>0?-2:2);b.angularVelocity.set(4,3,2);}}
