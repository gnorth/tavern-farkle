import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,gameReducer,scoreDice,playerName,type Game} from '../lib/game.ts';
import {opponents} from '../lib/opponents.ts';
import {botSelection,botShouldBank} from '../lib/bot.ts';
const choice=(id:Game['opponent']):Game=>({...initialGame('bot',0,id),player:1,phase:'choose',dice:[1,5,2,3,4,6]});
test('all opponents accept identical actual dice without changing values or scoring',()=>{
 for(const o of opponents)for(const player of [0,1]){
  let g={...initialGame('bot',0,o.id),player};g=gameReducer(g,{type:'roll'});
  g=gameReducer(g,{type:'rolled',rollId:g.rollId,values:{0:1,1:5,2:2,3:3,4:4,5:6}});
  assert.deepEqual(g.dice,[1,5,2,3,4,6]);assert.equal(g.phase,'choose');
  assert.equal(scoreDice(g.dice),1500);
 }
});
test('strategies choose legal dice and never mutate the game or consult randomness',()=>{
 const original=Math.random;Math.random=()=>{throw new Error('strategy must not access dice RNG');};
 try{for(const o of opponents){const g=choice(o.id);g.locked=[5];const before=structuredClone(g);const ids=botSelection(g);assert.ok(scoreDice(ids.map(i=>g.dice[i]))>0);assert.ok(ids.every(i=>!g.locked.includes(i)));botShouldBank({...g,selected:ids});assert.deepEqual(g,before);}}finally{Math.random=original;}
});
test('cautious, balanced and daring opponents make distinct risk decisions',()=>{
 const make=(id:Game['opponent'],pot:number)=>({...choice(id),pot,selected:[0]});
 assert.equal(botShouldBank(make('apprentice',200)),true);
 assert.equal(botShouldBank(make('innkeeper',200)),false);
 assert.equal(botShouldBank(make('innkeeper',700)),true);
 assert.equal(botShouldBank(make('mercenary',700)),false);
});
test('every opponent banks a winning selection and survives restart with correct identity',()=>{
 for(const o of opponents){const g={...choice(o.id),scores:[3000,3950],selected:[0]};assert.equal(botShouldBank(g),true);const reset=gameReducer(g,{type:'new',mode:'bot'});assert.equal(reset.opponent,o.id);assert.equal(playerName({...reset,player:1}),o.name);}
});
test('bots use the configured victory target, never the old 4000 constant',()=>{
 for(const opponent of opponents)for(const target of [4000,6000,8000] as const){
  const g={...choice(opponent.id),target,scores:[0,target-50],selected:[0]};assert.equal(botShouldBank(g),true);
 }
 const extended={...choice('innkeeper'),target:8000 as const,scores:[0,3950],selected:[0]};assert.equal(botShouldBank(extended),false);
});
