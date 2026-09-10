import {gameReducer,initialGame,scoreTargets,type Game,type Action} from './game.ts';
import {uniformInt} from './random.ts';
export type Room={game:Game;names:string[];tokens:string[];readyAt:number;nextAt:number;rematch:number[]};
export function roomAction(room:Room,seat:number,input:{type:string;ids?:number[]},now=Date.now()):Room{
 const r=structuredClone(room),g=r.game;
 if(r.names.length<2)throw new Error('Чекаємо другого гравця.');
 if(input.type==='rematch'){
  if(g.phase!=='won')throw new Error('Партія ще триває.');
  r.rematch=[...new Set([...r.rematch,seat])];
  if(r.rematch.length===2){r.game=initialGame('hotseat',g.rollId+1,'innkeeper',g.target);r.rematch=[];r.readyAt=0;r.nextAt=0;}
  return r;
 }
 if(now<r.readyAt||g.player!==seat)throw new Error('Зараз хід іншого гравця або ще триває кидок.');
 if(!['roll','bank','select'].includes(input.type))throw new Error('Невідома дія.');
 const action=input as Action;
 if(input.type==='select'&&(!Array.isArray(input.ids)||input.ids.length>6||new Set(input.ids).size!==input.ids.length))throw new Error('Некоректний вибір.');
 const next=gameReducer(g,action);if(next===g)throw new Error('Ця дія зараз недоступна.');
 r.game=next;
 if(next.phase==='rolling'){
  const values:Record<number,number>={};next.dice.forEach((_,i)=>{if(!next.locked.includes(i))values[i]=uniformInt(6)+1;});
  r.game=gameReducer(next,{type:'rolled',values,rollId:next.rollId});r.readyAt=now+4500;
 }
 if(r.game.phase==='bust'||r.game.phase==='handoff')r.nextAt=Math.max(now,r.readyAt)+4500;
 return r;
}
export function advanceRoom(r:Room,now=Date.now()){if(r.nextAt&&now>=r.nextAt){r.game=gameReducer(r.game,{type:'next'});r.nextAt=0;}return r;}
export function validName(v:unknown){if(typeof v!=='string'||!v.trim()||v.trim().length>24)throw new Error('Введіть ім’я до 24 символів.');return v.trim();}
export function validTarget(v:unknown){if(!scoreTargets.includes(v as 4000))throw new Error('Оберіть 4 000, 6 000 або 8 000.');return v as Game['target'];}
