import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3001';
async function post(body,token){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
async function get(id,token){const r=await fetch(base+'/api/rooms?id='+id,{headers:token?{Authorization:`Bearer ${token}`}:{}});return r.json();}
const host=await post({type:'create',name:'API test host',target:6000});assert.equal(host.status,200);const {id,token}=host.data;
assert.equal((await get(id)).joinable,true);
assert.equal((await post({id,type:'roll',revision:0},token)).status,400);
const attempts=await Promise.all(['A','B'].map(name=>post({id,type:'join',name})));assert.equal(attempts.filter(r=>r.status===200).length,1);
const guest=attempts.find(r=>r.status===200).data;
assert.equal((await post({id,type:'roll',revision:1},guest.token)).status,400);
assert.equal((await post({id,type:'roll',revision:1},'invalid')).status,403);
const roll=await post({id,type:'roll',revision:1},token);assert.equal(roll.status,200);assert.equal(roll.data.game.phase,'rolling');
assert.equal((await post({id,type:'roll',revision:1},token)).status,409);
const a=await get(id,token),b=await get(id,guest.token);assert.deepEqual(a.game,b.game);assert.equal(a.game.target,6000);assert.equal(a.game.dice.length,6);
assert.equal((await post({id,type:'rolled',revision:a.revision},token)).status,400);
assert.ok(!('tokens' in a));assert.ok(!JSON.stringify(b).includes(token));
console.log('PASS: two seats, join race, turn authorization, replay protection, shared dice and reconnect');
