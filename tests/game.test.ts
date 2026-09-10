import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreDice,selectionBreakdown,bestSelection,initialGame,gameReducer,type Game} from '../lib/game.ts';
const roll=(g:Game,values:number[])=>{g=gameReducer(g,{type:'roll'});return gameReducer(g,{type:'rolled',rollId:g.rollId,values:Object.fromEntries(values.map((v,i)=>[i,v]))});};
test('standard scoring, doubling, straights and invalid leftover dice',()=>{
 for(const [dice,expected] of [ [[1],100],[[5],50],[[2],0],[[1,1,1],1000],[[1,1,1,1,1,1],8000],[[3,3,3,3],600],[[2,3,4,5,6],750],[[1,2,3,4,5],500],[[1,2,3,4,5,6],1500],[[1,1,2,3,4,5],600],[[1,2],0],[[5,5,5,5,5],2000] ] as [number[],number][])assert.equal(scoreDice(dice),expected,dice.join(','));
});
test('invalid selections cannot be banked or rerolled',()=>{let g=roll(initialGame(),[2,2,3,3,4,1]);g=gameReducer(g,{type:'toggle',id:0});assert.equal(gameReducer(g,{type:'bank'}),g);assert.equal(gameReducer(g,{type:'roll'}),g);});
test('bank accumulates score and hotseat transfers only on confirmation',()=>{let g=roll(initialGame('hotseat'),[1,2,3,4,6,6]);g=gameReducer(g,{type:'toggle',id:0});g=gameReducer(g,{type:'bank'});assert.deepEqual(g.scores,[100,0]);assert.equal(g.phase,'handoff');assert.deepEqual(g.result,{player:0,earned:100,lost:0,before:0,after:100});assert.equal(g.player,0);g=gameReducer(g,{type:'next'});assert.equal(g.player,1);assert.equal(g.result,null);assert.equal(g.pot,0);});
test('bust loses only current turn points',()=>{let g=initialGame();g.scores=[500,200];g=roll(g,[1,2,3,4,6,6]);g=gameReducer(g,{type:'toggle',id:0});g=roll(g,[6,2,2,3,3,4]);assert.equal(g.phase,'bust');assert.deepEqual(g.result,{player:0,earned:0,lost:100,before:500,after:500});assert.equal(g.pot,100);assert.deepEqual(g.scores,[500,200]);g=gameReducer(g,{type:'next'});assert.equal(g.pot,0);assert.deepEqual(g.scores,[500,200]);});
test('hot dice returns all six and retains turn points',()=>{let g=roll(initialGame(),[1,2,3,4,5,6]);g=gameReducer(g,{type:'select',ids:[0,1,2,3,4,5]});g=gameReducer(g,{type:'roll'});assert.deepEqual(g.locked,[]);assert.equal(g.pot,1500);assert.equal(g.phase,'rolling');});
test('stale physics callbacks do not affect a new game',()=>{let g=gameReducer(initialGame(),{type:'roll'});const old=g.rollId;g=gameReducer(g,{type:'new',mode:'bot'});g=gameReducer(g,{type:'roll'});assert.equal(gameReducer(g,{type:'rolled',rollId:old,values:{0:1,1:1,2:1,3:1,4:1,5:1}}),g);});
test('reaching target ends game immediately',()=>{let g=initialGame();g.scores=[3950,0];g=roll(g,[1,2,3,4,6,6]);g=gameReducer(g,{type:'toggle',id:0});g=gameReducer(g,{type:'bank'});assert.equal(g.phase,'won');assert.deepEqual(g.result,{player:0,earned:100,lost:0,before:3950,after:4050});assert.equal(g.winner,0);assert.equal(gameReducer(g,{type:'roll'}),g);});
test('locked dice cannot be reused or selected',()=>{let g=roll(initialGame(),[1,2,3,4,6,6]);g=gameReducer(g,{type:'toggle',id:0});g=roll(g,[6,1,2,3,4,6]);assert.equal(g.dice[0],1);assert.deepEqual(g.locked,[0]);assert.equal(gameReducer(g,{type:'toggle',id:0}),g);assert.ok(!bestSelection(g.dice,g.locked).ids.includes(0));});
test('all 46,656 six-die outcomes produce a valid best choice or genuine bust',()=>{for(let n=0;n<46656;n++){let k=n;const dice=Array.from({length:6},()=>{const v=k%6+1;k=Math.floor(k/6);return v;});const b=bestSelection(dice);assert.equal(scoreDice(b.ids.map(i=>dice[i])),b.score);if(!b.score){assert.ok(!dice.includes(1)&&!dice.includes(5));assert.ok([2,3,4,6].every(v=>dice.filter(x=>x===v).length<3));}}});

test('selection hint explains only valid scoring combinations',()=>{
 assert.deepEqual(selectionBreakdown([5,5,5]),[{label:'Три п’ятірки',points:500}]);
 assert.deepEqual(selectionBreakdown([1,2]),[]);
 for(const dice of [[1,5],[1,1,2,3,4,5],[2,3,4,5,6],[1,1,1,1],[5,5,5,5,5,5]])assert.equal(selectionBreakdown(dice).reduce((n,p)=>n+p.points,0),scoreDice(dice));
});
test('all match targets govern victory in both modes and persist on restart',()=>{
 for(const mode of ['bot','hotseat'] as const)for(const target of [4000,6000,8000] as const){
  let g=initialGame(mode,0,'merchant',target);g.scores=[target-150,0];
  g=roll(g,[1,2,3,4,6,6]);g=gameReducer(g,{type:'toggle',id:0});g=gameReducer(g,{type:'bank'});
  assert.equal(g.phase,'handoff');assert.equal(g.target,target);
  const restart=gameReducer(g,{type:'new',mode});assert.equal(restart.target,target);assert.equal(restart.opponent,'merchant');
  g={...g,phase:'choose',selected:[0],pot:0};g=gameReducer(g,{type:'bank'});assert.equal(g.phase,'won');
  assert.equal(g.scores[0],target+50);
 }
});
test('new match can select target without changing an ongoing match',()=>{
 const g=initialGame('bot',0,'innkeeper',4000);
 const next=gameReducer(g,{type:'new',mode:'hotseat',target:8000,opponent:'apprentice'});
 assert.equal(g.target,4000);assert.equal(next.target,8000);assert.deepEqual(next.scores,[0,0]);
});

// Ordinary-dice table: https://kingdom-come-deliverance.fandom.com/wiki/Dice
// Special dice and Devil's Head are deliberately outside this game mode.
test('complete KCD ordinary dice table and hint totals',()=>{
 const triples=[1000,200,300,400,500,600];
 for(let face=1;face<=6;face++)for(let count=1;count<=6;count++){
  const dice=Array(count).fill(face);
  const expected=count>=3?triples[face-1]*2**(count-3):face===1?count*100:face===5?count*50:0;
  assert.equal(scoreDice(dice),expected,`${count} dice showing ${face}`);
  assert.equal(selectionBreakdown(dice).reduce((sum,part)=>sum+part.points,0),expected);
 }
 for(const [dice,expected] of [[[1,2,3,4,5],500],[[2,3,4,5,6],750],[[1,2,3,4,5,6],1500],[[2,2,3,3,6,6],0],[[2,2,2,3,3,3],500]] as [number[],number][]){
  assert.equal(scoreDice(dice),expected);
  assert.equal(selectionBreakdown(dice).reduce((sum,part)=>sum+part.points,0),expected);
 }
});
test('KCD allows banking one of two scoring dice and forbids combining separate throws',()=>{
 let g=roll(initialGame(),[5,5,2,3,4,6]);
 g=gameReducer(g,{type:'select',ids:[0]});
 g=roll(g,[1,2,2,3,3,4]);
 assert.deepEqual(g.locked,[0]);assert.equal(g.pot,50);assert.equal(g.phase,'bust');
 g=roll(initialGame(),[2,2,2,1,3,4]);
 g=gameReducer(g,{type:'select',ids:[0,1,2]});
 g=roll(g,[1,1,1,2,3,4]);
 assert.equal(g.pot,200);assert.equal(g.phase,'bust');
});
