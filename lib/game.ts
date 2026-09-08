export type Mode='bot'|'hotseat';
export type Phase='ready'|'rolling'|'choose'|'bust'|'handoff'|'won';
export type TurnResult={player:number;earned:number;lost:number;before:number;after:number};
export type Game={result:TurnResult|null;mode:Mode;phase:Phase;player:number;scores:number[];pot:number;dice:number[];locked:number[];selected:number[];rollId:number;round:number;message:string;winner:number|null};
export function scoreDice(dice:number[]):number{
 if(!dice.length || dice.some(v=>!Number.isInteger(v)||v<1||v>6))return 0;
 const counts=Array(7).fill(0);dice.forEach(v=>counts[v]++);
 // KCD straights can be combined with remaining scoring dice.
 let straight=0;
 if([1,2,3,4,5,6].every(v=>counts[v])){straight=1500;for(let v=1;v<=6;v++)counts[v]--;}
 else if([1,2,3,4,5].every(v=>counts[v])){straight=500;for(let v=1;v<=5;v++)counts[v]--;}
 else if([2,3,4,5,6].every(v=>counts[v])){straight=750;for(let v=2;v<=6;v++)counts[v]--;}
 let total=straight;
 for(let v=1;v<=6;v++){const n=counts[v];if(n>=3)total+=(v===1?1000:v*100)*2**(n-3);else if(v===1)total+=n*100;else if(v===5)total+=n*50;else if(n)return 0;}
 return total;
}
export function bestSelection(dice:number[],locked:number[]=[]){
 const available=dice.map((_,i)=>i).filter(i=>!locked.includes(i));let best:number[]=[];let score=0;
 for(let mask=1;mask<1<<available.length;mask++){const ids=available.filter((_,i)=>mask&(1<<i));const n=scoreDice(ids.map(i=>dice[i]));if(n>score||(n===score&&n>0&&ids.length>best.length)){score=n;best=ids;}}
 return {ids:best,score};
}
export const playerName=(g:Game,p=g.player)=>p===0?(g.mode==='bot'?'Ви':'Гравець 1'):(g.mode==='bot'?'Корчмар':'Гравець 2');
export function initialGame(mode:Mode='bot',rollId=0):Game{return {result:null,mode,phase:'ready',player:0,scores:[0,0],pot:0,dice:[1,2,3,4,5,6],locked:[],selected:[],rollId,round:1,message:'Кидайте кубики, щоб почати партію.',winner:null};}
export type Action={type:'new';mode:Mode}|{type:'roll'}|{type:'rolled';values:Record<number,number>;rollId:number}|{type:'select';ids:number[]}|{type:'toggle';id:number}|{type:'bank'}|{type:'next'};
export function gameReducer(g:Game,a:Action):Game{
 if(a.type==='new')return initialGame(a.mode,g.rollId+1);
 if(a.type==='roll'){
  if(g.phase!=='ready'&&g.phase!=='choose')return g;
  const value=scoreDice(g.selected.map(i=>g.dice[i]));if(g.phase==='choose'&&!value)return g;
  let locked=g.phase==='choose'?[...g.locked,...g.selected]:[];if(locked.length===6)locked=[];
  return {...g,locked,selected:[],pot:g.pot+value,phase:'rolling',rollId:g.rollId+1,message:'Кубики на столі…'};
 }
 if(a.type==='rolled'){
  if(g.phase!=='rolling'||a.rollId!==g.rollId)return g;
  const active=g.dice.map((_,i)=>i).filter(i=>!g.locked.includes(i));if(active.some(i=>!Number.isInteger(a.values[i])||a.values[i]<1||a.values[i]>6))return g;
  const dice=g.dice.map((v,i)=>g.locked.includes(i)?v:a.values[i]);const bust=!bestSelection(dice,g.locked).score;
  return {...g,dice,result:bust?{player:g.player,earned:0,lost:g.pot,before:g.scores[g.player],after:g.scores[g.player]}:null,phase:bust?'bust':'choose',message:bust?`Невдалий кидок. ${g.pot?`Втрачено ${g.pot} очок за хід.`:'Жодної залікової комбінації.'}`:'Виберіть залікові кубики.'};
 }
 if(a.type==='toggle'&&g.phase==='choose'&&Number.isInteger(a.id)&&a.id>=0&&a.id<6&&!g.locked.includes(a.id))return {...g,selected:g.selected.includes(a.id)?g.selected.filter(i=>i!==a.id):[...g.selected,a.id]};
 if(a.type==='select'&&g.phase==='choose'&&a.ids.every(i=>Number.isInteger(i)&&i>=0&&i<6&&!g.locked.includes(i)))return {...g,selected:[...new Set(a.ids)]};
 if(a.type==='bank'&&g.phase==='choose'){
  const score=scoreDice(g.selected.map(i=>g.dice[i]));if(!score)return g;
  const earned=g.pot+score;const scores=g.scores.map((v,i)=>i===g.player?v+earned:v);const won=scores[g.player]>=4000;
  return {...g,result:{player:g.player,earned,lost:0,before:g.scores[g.player],after:scores[g.player]},scores,pot:0,selected:[],locked:[],phase:won?'won':'handoff',winner:won?g.player:null,message:won?`${playerName(g)} — перемога!`:`${playerName(g)}: +${earned} очок до рахунку.`};
 }
 if(a.type==='next'&&(g.phase==='bust'||g.phase==='handoff'))return {...g,result:null,player:1-g.player,phase:'ready',pot:0,locked:[],selected:[],round:g.round+(g.player===1?1:0),message:'Ваш хід. Кидайте кубики.'};
 return g;
}

export function selectionBreakdown(dice:number[]):{label:string;points:number}[]{
 if(!scoreDice(dice))return [];
 const counts=Array(7).fill(0);dice.forEach(v=>counts[v]++);
 const parts:{label:string;points:number}[]=[];
 for(const [values,points] of [[[1,2,3,4,5,6],1500],[[1,2,3,4,5],500],[[2,3,4,5,6],750]] as [number[],number][]){
  if(values.every(v=>counts[v])){parts.push({label:values.join('–'),points});values.forEach(v=>counts[v]--);break;}
 }
 const names=['','одиниці','двійки','трійки','четвірки','п’ятірки','шістки'];
 for(let v=1;v<=6;v++){
  const n=counts[v];if(!n)continue;
  const label=n===1?(v===1?'Одиниця':'П’ятірка'):n===2?`Дві ${names[v]}`:n===3?`Три ${names[v]}`:`${n} × ${v}`;
  parts.push({label,points:n>=3?(v===1?1000:v*100)*2**(n-3):n*(v===1?100:50)});
 }
 return parts;
}
