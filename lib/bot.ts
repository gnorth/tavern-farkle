import {bestSelection,scoreDice,type Game} from './game.ts';
// Only public, already rolled dice and scores enter the strategy. No RNG or physics access.
const odds=new Map<number,{survival:number;gain:number}>();
function rollOdds(n:number){
 const cached=odds.get(n);if(cached)return cached;
 let survival=0,gain=0;const factorial=[1,1,2,6,24,120,720];
 const counts=Array(6).fill(0);
 function visit(face:number,left:number){
  if(face===5){counts[face]=left;const dice=counts.flatMap((count,i)=>Array(count).fill(i+1));const probability=factorial[n]/counts.reduce((p,c)=>p*factorial[c],1)/6**n;const score=bestSelection(dice).score;if(score){survival+=probability;gain+=probability*score;}return;}
  for(let c=0;c<=left;c++){counts[face]=c;visit(face+1,left-c);}
 }
 visit(0,n);const result={survival,gain};odds.set(n,result);return result;
}
function rollValue(total:number,remaining:number){const o=rollOdds(remaining||6);return o.survival*total+o.gain;}
export function botSelection(g:Game){
 if(g.opponent!=='merchant')return bestSelection(g.dice,g.locked).ids;
 const available=g.dice.map((_,i)=>i).filter(i=>!g.locked.includes(i));let choice:number[]=[],best=-Infinity;
 for(let mask=1;mask<1<<available.length;mask++){
  const ids=available.filter((_,i)=>mask&(1<<i)),points=scoreDice(ids.map(i=>g.dice[i]));if(!points)continue;
  const total=g.pot+points,remaining=available.length-ids.length;
  const value=g.scores[g.player]+total>=g.target?1e6+total:Math.max(total,rollValue(total,remaining));
  if(value>best){best=value;choice=ids;}
 }
 return choice;
}
export function botShouldBank(g:Game){
 const points=scoreDice(g.selected.map(i=>g.dice[i]));if(!points)return false;
 const total=g.pot+points,remaining=6-g.locked.length-g.selected.length;
 if(g.scores[g.player]+total>=g.target)return true;
 switch(g.opponent){
  case 'apprentice':return total>=250||(remaining>0&&remaining<=3);
  case 'innkeeper':return total>=700||(remaining>0&&remaining<=2&&total>=300);
  case 'mercenary':return total>=1200||(remaining===1&&total>=650)||(remaining===2&&total>=900);
  case 'merchant':{
   const behind=g.scores[1-g.player]-g.scores[g.player];
   const urgency=g.scores[1-g.player]>=g.target*.8&&behind>g.target*.125;
   return rollValue(total,remaining)<=total*(urgency?.90:1.03);
  }
 }
}
