import {env} from 'cloudflare:workers';
import {initialGame} from '@/lib/game';
import {advanceRoom,roomAction,validName,validTarget,type Room} from '@/lib/online';
const db=()=> (env as unknown as {DB:D1Database}).DB;
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function hash(t:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function row(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Некоректне запрошення.');const v=await db().prepare('SELECT * FROM rooms WHERE id=? AND expires>?').bind(id,Date.now()).first<{id:string;state:string;revision:number;seen0:number;seen1:number}>();if(!v)throw new Error('Кімнату не знайдено або запрошення прострочене.');return v;}
function view(r:Room,revision:number,seat:number,seen:number[]){const game=structuredClone(r.game);if(Date.now()<r.readyAt)game.phase='rolling';return {game,names:r.names,revision,seat,rematch:r.rematch,online:seen.map(t=>Date.now()-t<15000)};}
export async function GET(req:Request){try{
 const id=new URL(req.url).searchParams.get('id')||'',v=await row(id),r:Room=JSON.parse(v.state),token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 const seat=token?r.tokens.indexOf(await hash(token)):-1;
 if(seat<0)return reply({joinable:r.names.length<2,host:r.names[0],target:r.game.target});
 const before=JSON.stringify(r);advanceRoom(r);let revision=v.revision;
 if(JSON.stringify(r)!==before){const update=await db().prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(r),id,v.revision).run();if(update.meta.changes)revision++;else return reply({error:'Стан оновився. Повторіть запит.'},409);}
 await db().prepare(`UPDATE rooms SET seen${seat}=? WHERE id=?`).bind(Date.now(),id).run();const seen=[v.seen0,v.seen1];seen[seat]=Date.now();
 return reply(view(r,revision,seat,seen));
 }catch(e){return reply({error:(e as Error).message},400);}}
export async function POST(req:Request){try{
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==new URL(req.url).origin)return reply({error:'Недозволений запит.'},403);
 if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'Запит завеликий.'},413);
 const text=await req.text();if(text.length>4096)return reply({error:'Запит завеликий.'},413);
 const body=JSON.parse(text) as {type:string;id:string;name?:string;target?:number;revision?:number;ids?:number[]};
 if(body.type==='create'){
  const token=crypto.randomUUID(),id=crypto.randomUUID(),now=Date.now();
  const r:Room={game:initialGame('hotseat',0,'innkeeper',validTarget(body.target)),names:[validName(body.name)],tokens:[await hash(token)],readyAt:0,nextAt:0,rematch:[]};
  await db().prepare('DELETE FROM rooms WHERE expires<?').bind(now).run();
  await db().prepare('INSERT INTO rooms(id,state,expires,seen0) VALUES(?,?,?,?)').bind(id,JSON.stringify(r),now+86400000,now).run();
  return reply({id,token,...view(r,0,0,[now,0])});
 }
 const v=await row(body.id),r:Room=JSON.parse(v.state);let token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'',seat=token?r.tokens.indexOf(await hash(token)):-1;
 let next=r;
 if(body.type==='join'){
  if(seat>=0)return reply(view(r,v.revision,seat,[v.seen0,v.seen1]));
  if(r.names.length>=2)return reply({error:'Обидва місця вже зайняті.'},409);
  token=crypto.randomUUID();seat=1;r.names.push(validName(body.name));r.tokens.push(await hash(token));
 }else{
  if(seat<0)return reply({error:'Потрібно приєднатися до кімнати.'},403);
  if(body.revision!==v.revision)return reply({error:'Стан оновився. Спробуйте ще раз.'},409);
  next=roomAction(r,seat,body);
 }
 const update=await db().prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(next),body.id,v.revision).run();
 if(!update.meta.changes)return reply({error:'Стан оновився. Спробуйте ще раз.'},409);
 return reply({...view(next,v.revision+1,seat,[v.seen0,v.seen1]),...(body.type==='join'?{token}:{})});
 }catch(e){return reply({error:(e as Error).message},400);}}
