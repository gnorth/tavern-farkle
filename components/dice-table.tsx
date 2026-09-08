'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Game} from '@/lib/game';
import {faceValues,normals,upperFace,createWorld,createDie,launchDie,nudgeTilted} from '@/lib/physics';
function pipTexture(value:number){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#eadfbd';ctx.fillRect(0,0,256,256);for(let i=0;i<1800;i++){ctx.fillStyle=`rgba(113,81,43,${Math.random()*.08})`;ctx.fillRect(Math.random()*256,Math.random()*256,Math.random()*3+1,1);}const pips:Record<number,number[][]>={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[-1,1],[1,-1],[1,1]],5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]],6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]};pips[value].forEach(([x,y])=>{ctx.beginPath();ctx.arc(128+x*63,128+y*63,value===1?24:19,0,Math.PI*2);ctx.fillStyle=value===1?'#823c29':'#30271f';ctx.fill();ctx.beginPath();ctx.arc(126+x*63,126+y*63,14,Math.PI,Math.PI*1.8);ctx.strokeStyle='#100b0766';ctx.lineWidth=3;ctx.stroke();});const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
function woodTexture(){const texture=new THREE.TextureLoader().load('/textures/tavern-oak.jpg');texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;}
type Props={game:Game;onResult:(v:Record<number,number>,rollId:number)=>void;onSelect:(id:number)=>void;interactive:boolean};
export default function DiceTable(props:Props){
 const mount=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 const controller=useRef<{roll:(ids:number[],id:number)=>void;highlight:()=>void;reset:()=>void}|null>(null);
 const [error,setError]=useState(false);
 useEffect(()=>{
  const host=mount.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-7,7,5,-5,.1,100);camera.up.set(0,0,-1);camera.position.set(0,20,0);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xffe6c7,0x302031,2.5));const light=new THREE.DirectionalLight(0xffcd86,3.2);light.position.set(-4,9,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.5,far:25});light.shadow.bias=-.001;scene.add(light);const fill=new THREE.PointLight(0xff8e36,12,20);fill.position.set(7,3,-4);scene.add(fill);
  const world=createWorld();
  const textures=faceValues.map(pipTexture),wood=woodTexture();const geometry=new RoundedBoxGeometry(.95,.95,.95,3,.07);
  const meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial[]>[]=[];const bodies:CANNON.Body[]=[];
  const boardMat=new THREE.MeshStandardMaterial({map:wood,roughness:.92,color:0xffffff});const edgeMat=new THREE.MeshStandardMaterial({color:0x714526,roughness:.7});const brass=new THREE.MeshStandardMaterial({color:0xd5a14d,metalness:.65,roughness:.48});
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,solid=false){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);if(solid){const b=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))});b.position.set(x,y,z);world.addBody(b);}return mesh;}
  box(13,.45,9,0,-.225,0,boardMat);box(.35,.65,9,-6.3,.25,0,edgeMat);box(.35,.65,9,6.3,.25,0,edgeMat);box(13,.65,.35,0,.25,4.35,edgeMat);box(13,.65,.35,0,.25,-4.35,edgeMat);
  box(.06,.05,8.4,-6.03,.59,0,brass);box(.06,.05,8.4,6.03,.59,0,brass);box(12.1,.05,.06,0,.59,-4.08,brass);box(12.1,.05,.06,0,.59,4.08,brass);
  for(const x of [-6.28,6.28])for(const z of [-4.33,4.33]){const nail=new THREE.Mesh(new THREE.SphereGeometry(.11,10,6),brass);nail.scale.y=.3;nail.position.set(x,.6,z);scene.add(nail);}
  let rolling=false,active:number[]=[],rollId=0,start=0,lastNudge=0;
  function reset(){rolling=false;bodies.forEach((b,i)=>{b.type=CANNON.Body.STATIC;b.position.set((i-2.5)*1.6,.51,0);b.quaternion.setFromEuler(0,0,0);const target=normals[faceValues.indexOf(i+1)];b.quaternion.setFromVectors(target,new CANNON.Vec3(0,1,0));b.velocity.setZero();b.angularVelocity.setZero();b.updateMassProperties();});}
  for(let i=0;i<6;i++){const material=textures.map(map=>new THREE.MeshStandardMaterial({map,roughness:.58,metalness:0,emissive:0x000000}));const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.index=i;scene.add(mesh);meshes.push(mesh);const b=createDie(world);bodies.push(b);}
  reset();
  function roll(ids:number[],id:number){active=ids;rollId=id;start=performance.now();lastNudge=start;rolling=true;
   bodies.forEach((b,i)=>{if(!ids.includes(i)){b.type=CANNON.Body.STATIC;b.position.set((i-2.5)*1.45,.52,-3.35);b.velocity.setZero();b.angularVelocity.setZero();b.updateMassProperties();return;}
    launchDie(b,ids.indexOf(i));
   });highlight();}
  function highlight(){meshes.forEach((m,i)=>m.material.forEach(mat=>{mat.emissive.setHex(latest.current.game.selected.includes(i)?0x947025:0x000000);mat.emissiveIntensity=.55;mat.color.setHex(latest.current.game.locked.includes(i)?0xb4a78d:0xffffff);}));}
  controller.current={roll,highlight,reset};
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);const aspect=w/Math.max(h,1);const vertical=Math.max(9.6,13.8/aspect);camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();const click=(e:PointerEvent)=>{if(!latest.current.interactive||rolling)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes)[0];if(hit)latest.current.onSelect(hit.object.userData.index);};renderer.domElement.addEventListener('pointerup',click);
  let raf=0,last=performance.now();function frame(now:number){const dt=Math.min((now-last)/1000,.05);last=now;world.step(1/60,dt,4);bodies.forEach((b,i)=>{meshes[i].position.copy(b.position as unknown as THREE.Vector3);meshes[i].quaternion.copy(b.quaternion as unknown as THREE.Quaternion);});
   if(rolling&&now-start>650){const stable=active.every(i=>bodies[i].sleepState===CANNON.Body.SLEEPING);const flat=active.every(i=>upperFace(bodies[i].quaternion).alignment>.985);
    if(stable&&flat){rolling=false;const values:Record<number,number>={};active.forEach(i=>values[i]=upperFace(bodies[i].quaternion).value);latest.current.onResult(values,rollId);}
    else if(now-lastNudge>2500){active.forEach(i=>nudgeTilted(bodies[i]));lastNudge=now;}
   }renderer.render(scene,camera);raf=requestAnimationFrame(frame);}
  raf=requestAnimationFrame(frame);
  if(latest.current.game.phase==='rolling')roll(latest.current.game.dice.map((_,i)=>i).filter(i=>!latest.current.game.locked.includes(i)),latest.current.game.rollId);
  return ()=>{cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.removeEventListener('pointerup',click);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach((m:THREE.Material)=>m.dispose());}});textures.forEach(t=>t.dispose());wood.dispose();renderer.dispose();host.replaceChildren();controller.current=null;};
 },[]);
 useEffect(()=>{if(props.game.phase==='rolling')controller.current?.roll(props.game.dice.map((_,i)=>i).filter(i=>!props.game.locked.includes(i)),props.game.rollId);else if(props.game.phase==='ready'&&props.game.round===1&&props.game.player===0)controller.current?.reset();},[props.game.rollId,props.game.phase]);
 useEffect(()=>controller.current?.highlight(),[props.game.selected,props.game.locked]);
 return <><div ref={mount} className="dice-canvas"/>{error&&<div className="graphics-error" role="alert">Не вдалося запустити 3D. Спробуйте браузер із підтримкою WebGL або ввімкніть апаратне прискорення.</div>}</>;
}
