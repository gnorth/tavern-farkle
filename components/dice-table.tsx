'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'cannon-es';
import type {Game} from '@/lib/game';
import {faceValues,normals,upperFace,createWorld,createDie,launchDie,nudgeTilted,PHYSICS_STEP} from '@/lib/physics';
function pipTexture(value:number){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#eadfbd';ctx.fillRect(0,0,256,256);for(let i=0;i<1800;i++){ctx.fillStyle=`rgba(113,81,43,${Math.random()*.08})`;ctx.fillRect(Math.random()*256,Math.random()*256,Math.random()*3+1,1);}const pips:Record<number,number[][]>={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[-1,1],[1,-1],[1,1]],5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]],6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]};pips[value].forEach(([x,y])=>{ctx.beginPath();ctx.arc(128+x*63,128+y*63,value===1?24:19,0,Math.PI*2);ctx.fillStyle=value===1?'#823c29':'#30271f';ctx.fill();ctx.beginPath();ctx.arc(126+x*63,126+y*63,14,Math.PI,Math.PI*1.8);ctx.strokeStyle='#100b0766';ctx.lineWidth=3;ctx.stroke();});const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
function woodTexture(){const texture=new THREE.TextureLoader().load('/textures/tavern-oak.jpg');texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;}
type Props={game:Game;onResult:(v:Record<number,number>,rollId:number)=>void;onSelect:(id:number)=>void;interactive:boolean};
export default function DiceTable(props:Props){
 const buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const mount=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 const controller=useRef<{roll:(ids:number[],id:number)=>void;highlight:()=>void;reset:()=>void}|null>(null);
 const [error,setError]=useState(false);
 useEffect(()=>{
  const host=mount.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-7,7,5,-5,.1,100);camera.up.set(0,0,-1);camera.position.set(0,20,0);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xffe6c7,0x302031,2.5));const light=new THREE.DirectionalLight(0xffcd86,3.2);light.position.set(-3,16,3);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.5,far:25});light.shadow.bias=-.001;scene.add(light);const fill=new THREE.PointLight(0xff8e36,12,20);fill.position.set(7,3,-4);scene.add(fill);
  const world=createWorld();
  const textures=faceValues.map(pipTexture),wood=woodTexture();const geometry=new RoundedBoxGeometry(.95,.95,.95,3,.025);
  const rings:THREE.Group[]=[];const meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial[]>[]=[];const bodies:CANNON.Body[]=[];
  const boardMat=new THREE.MeshStandardMaterial({map:wood,roughness:.92,color:0xffffff});boardMat.onBeforeCompile=(shader)=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float woodLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
vec3 mutedWood = mix(vec3(woodLuminance), diffuseColor.rgb, 0.25);
diffuseColor.rgb = mix(vec3(0.26), mutedWood, 0.38) * 0.42;`);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float tableLightness = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
outgoingLight = mix(vec3(tableLightness), outgoingLight, 0.45) * 0.22;
#include <opaque_fragment>`);};boardMat.customProgramCacheKey=()=> 'dark-walnut-contrast-v4';const edgeMat=new THREE.MeshStandardMaterial({color:0x714526,roughness:.7});const brass=new THREE.MeshStandardMaterial({color:0xd5a14d,metalness:.65,roughness:.48});
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,solid=false){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);if(solid){const b=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});b.position.set(x,y,z);world.addBody(b);}return mesh;}
  wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.repeat.set(5,5);box(90,.45,65,0,-.225,0,boardMat);
  type Transfer={index:number;from:THREE.Vector3;to:THREE.Vector3;fromQ:THREE.Quaternion;toQ:THREE.Quaternion;start:number;duration:number};
  let transfers:Transfer[]=[],pendingLaunch:{ids:number[];id:number;at:number}|null=null,visualSelected:number[]=[];
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rolling=false,active:number[]=[],rollId=0,start=0,lastNudge=0;
  function reset(){transfers=[];pendingLaunch=null;visualSelected=[];rolling=false;bodies.forEach((b,i)=>{b.type=CANNON.Body.STATIC;b.collisionResponse=true;b.position.set((i%3-1)*1.8,.51,(Math.floor(i/3)-.5)*1.8);b.quaternion.setFromEuler(0,0,0);const target=normals[faceValues.indexOf(i+1)];b.quaternion.setFromVectors(target,new CANNON.Vec3(0,1,0));b.velocity.setZero();b.angularVelocity.setZero();b.updateMassProperties();b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.aabbNeedsUpdate=true;});}
  for(let i=0;i<6;i++){const material=textures.map(map=>new THREE.MeshStandardMaterial({map,roughness:.58,metalness:0,emissive:0x000000}));const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.index=i;scene.add(mesh);meshes.push(mesh);const ring=new THREE.Group();
   const ringBand=(radius:number,thickness:number,color:number,order:number)=>{const band=new THREE.Mesh(new THREE.TorusGeometry(radius,thickness,10,72),new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false}));band.rotation.x=-Math.PI/2;band.renderOrder=order;ring.add(band);};
   ringBand(.72,.025,0x3b2915,2);ringBand(.72,.012,0xcda663,3);
   ring.visible=false;scene.add(ring);rings.push(ring);const b=createDie(world);bodies.push(b);}
  reset();
  function syncBody(b:CANNON.Body){b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.aabbNeedsUpdate=true;}
  function beginThrow(ids:number[],id:number){active=ids;rollId=id;start=performance.now();lastNudge=start;rolling=true;ids.forEach((i,j)=>{bodies[i].collisionResponse=true;launchDie(bodies[i],j);});}
  function roll(ids:number[],id:number){
   rolling=false;transfers=[];pendingLaunch=null;
   const held=bodies.map((_,i)=>i).filter(i=>!ids.includes(i));
   // The previous visual selection includes all six on a hot-dice reroll.
   const toPark=[...new Set([...held,...visualSelected])];
   const now=performance.now();
   toPark.forEach((i,slot)=>{const b=bodies[i],mesh=meshes[i];const to=new THREE.Vector3((slot-(toPark.length-1)/2)*1.35,.51,-5.0);const q=new CANNON.Quaternion();q.setFromVectors(normals[faceValues.indexOf(latest.current.game.dice[i])],new CANNON.Vec3(0,1,0));
    const targetQ=new THREE.Quaternion(q.x,q.y,q.z,q.w);const distance=mesh.position.distanceTo(to);
    if(distance>.04)transfers.push({index:i,from:mesh.position.clone(),to,fromQ:mesh.quaternion.clone(),toQ:targetQ,start:now+(reducedMotion?0:slot*35),duration:reducedMotion?0:560});
    b.type=CANNON.Body.STATIC;b.collisionResponse=false;b.velocity.setZero();b.angularVelocity.setZero();b.position.set(to.x,to.y,to.z);b.quaternion.copy(q);b.updateMassProperties();syncBody(b);
   });
   if(transfers.length)pendingLaunch={ids:[...ids],id,at:Math.max(...transfers.map(t=>t.start+t.duration))+(reducedMotion?0:90)};
   else beginThrow(ids,id);
   highlight();
  }
  function highlight(){visualSelected=[...latest.current.game.selected];rings.forEach((r,i)=>r.visible=latest.current.game.selected.includes(i));meshes.forEach((m,i)=>m.material.forEach(mat=>{mat.emissive.setHex(latest.current.game.selected.includes(i)?0x947025:0x000000);mat.emissiveIntensity=.12;mat.color.setHex(latest.current.game.locked.includes(i)?0xb4a78d:0xffffff);}));}
  controller.current={roll,highlight,reset};
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);const aspect=w/Math.max(h,1);const portrait=aspect<.85;camera.up.set(portrait?1:0,0,portrait?0:-1);camera.lookAt(0,0,0);const vertical=portrait?Math.max(20.5,12.4/aspect):Math.max(12.0,14/aspect);camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();const click=(e:PointerEvent)=>{if(!latest.current.interactive||rolling)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes)[0];if(hit)latest.current.onSelect(hit.object.userData.index);};renderer.domElement.addEventListener('pointerup',click);
  let raf=0,last=performance.now();function frame(now:number){const dt=Math.min((now-last)/1000,.05);last=now;if(pendingLaunch&&now>=pendingLaunch.at){const next=pendingLaunch;pendingLaunch=null;transfers=[];beginThrow(next.ids,next.id);}world.step(PHYSICS_STEP,dt,8);bodies.forEach((b,i)=>{meshes[i].position.copy(b.interpolatedPosition as unknown as THREE.Vector3);meshes[i].quaternion.copy(b.interpolatedQuaternion as unknown as THREE.Quaternion);const transfer=transfers.find(t=>t.index===i);if(transfer){const t=transfer.duration?Math.min(1,Math.max(0,(now-transfer.start)/transfer.duration)):1;const eased=t*t*(3-2*t);meshes[i].position.lerpVectors(transfer.from,transfer.to,eased);meshes[i].position.y+=Math.sin(Math.PI*t)*.22;meshes[i].quaternion.slerpQuaternions(transfer.fromQ,transfer.toQ,eased);}rings[i].position.set(meshes[i].position.x,.06,meshes[i].position.z);const el=buttons.current[i];if(el){const p=meshes[i].position.clone().project(camera);el.style.left=`${(p.x*.5+.5)*host.clientWidth}px`;el.style.top=`${(-p.y*.5+.5)*host.clientHeight}px`;const size=Math.max(44,host.clientWidth/(camera.right-camera.left)*1.4);el.style.width=el.style.height=`${size}px`;}});
   if(rolling&&now-start>650){const stable=active.every(i=>bodies[i].sleepState===CANNON.Body.SLEEPING);const flat=active.every(i=>upperFace(bodies[i].quaternion).alignment>.985&&bodies[i].position.y<.65);
    if(stable&&flat){rolling=false;const values:Record<number,number>={};active.forEach(i=>values[i]=upperFace(bodies[i].quaternion).value);latest.current.onResult(values,rollId);}
    else if(now-lastNudge>1250){active.forEach(i=>nudgeTilted(bodies[i]));lastNudge=now;}
   }renderer.render(scene,camera);raf=requestAnimationFrame(frame);}
  raf=requestAnimationFrame(frame);
  if(latest.current.game.phase==='rolling')roll(latest.current.game.dice.map((_,i)=>i).filter(i=>!latest.current.game.locked.includes(i)),latest.current.game.rollId);
  return ()=>{cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.removeEventListener('pointerup',click);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach((m:THREE.Material)=>m.dispose());}});textures.forEach(t=>t.dispose());wood.dispose();renderer.dispose();host.replaceChildren();controller.current=null;};
 },[]);
 useEffect(()=>{if(props.game.phase==='rolling')controller.current?.roll(props.game.dice.map((_,i)=>i).filter(i=>!props.game.locked.includes(i)),props.game.rollId);else if(props.game.phase==='ready'&&props.game.round===1&&props.game.player===0)controller.current?.reset();},[props.game.rollId,props.game.phase]);
 useEffect(()=>controller.current?.highlight(),[props.game.selected,props.game.locked]);
 return <><div ref={mount} className="dice-canvas"/>{props.game.dice.map((v,i)=><button key={i} ref={el=>{buttons.current[i]=el;}} className={`dice-hit ${props.game.selected.includes(i)?"is-selected":""}`} aria-label={`Кубик ${i+1}: ${v}${props.game.locked.includes(i)?", відкладений":""}`} aria-pressed={props.game.selected.includes(i)} disabled={!props.interactive||props.game.locked.includes(i)} onClick={()=>props.onSelect(i)}></button>)}{error&&<div className="graphics-error" role="alert">Не вдалося запустити 3D. Спробуйте браузер із підтримкою WebGL або ввімкніть апаратне прискорення.</div>}</>;
}
