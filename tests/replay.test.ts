import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diceReplay,replayCursor} from '../lib/dice-replay.ts';
import {upperFace} from '../lib/physics.ts';
test('online replay ends on the server faces without a final face swap',()=>{
 for(const scale of [1,.918])for(let seed=1;seed<=20;seed++){
 const values=[1,2,3,4,5,6],frames=diceReplay(values,seed,scale),last=frames.at(-1)!;
 assert.ok(frames.length<2400);
 last.forEach((p,i)=>{assert.equal(upperFace(p.q).value,values[i]);assert.ok(upperFace(p.q).alignment>.985);const previous=frames.at(-2)![i].q;assert.ok(Math.abs(p.q.x*previous.x+p.q.y*previous.y+p.q.z*previous.z+p.q.w*previous.w)>.999);});
 }
});
test('replay is deterministic for both participants',()=>{const a=diceReplay([3,1,5],919),b=diceReplay([3,1,5],919);assert.deepEqual(a,b);});

test('a throw started inside RAF holds its first frame instead of indexing before zero',()=>{
 const frames=diceReplay([1,5,3,2],12);
 for(const now of [900,999.9,1000,1000.1,1900,2800,5000]){
  const cursor=replayCursor(frames.length,now,1000);
  assert.ok(frames[cursor.a]);assert.ok(frames[cursor.b]);
  assert.ok(cursor.alpha>=0&&cursor.alpha<=1);
 }
 assert.deepEqual(replayCursor(frames.length,999,1000),{progress:0,a:0,b:1,alpha:0});
 assert.equal(replayCursor(frames.length,5000,1000).progress,1);
});
