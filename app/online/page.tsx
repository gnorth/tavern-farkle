'use client';
import {useEffect,useRef,useState} from 'react';
import DiceTable from '@/components/dice-table';
import {scoreDice,selectionBreakdown,type Game} from '@/lib/game';
type Reply=Snapshot & {error?:string;id?:string;token?:string;host:string;target:number;joinable:boolean};
type Snapshot={game:Game;names:string[];revision:number;seat:number;online:boolean[];rematch:number[]};
export default function OnlinePage(){
 const [room,setRoom]=useState(''),[token,setToken]=useState(''),[snap,setSnap]=useState<Snapshot|null>(null),[invite,setInvite]=useState<{host:string;target:number;joinable:boolean}|null>(null);
 const [name,setName]=useState(''),[target,setTarget]=useState(4000),[error,setError]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false),[copied,setCopied]=useState(false),[rules,setRules]=useState(false);
 const current=useRef<Snapshot|null>(null);current.current=snap;
 function accept(v:Snapshot){if(v.game&&(!current.current||v.revision>=current.current.revision)){current.current=v;setSnap(v);}setConnected(true);}
 useEffect(()=>{const id=new URLSearchParams(location.search).get('room')||'';setRoom(id);setName(localStorage.getItem('farkle-name')||'');if(id)setToken(localStorage.getItem(`farkle-room-${id}`)||'');},[]);
 useEffect(()=>{if(!room)return;let cancelled=false,timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
 async function poll(){try{const res=await fetch(`/api/rooms?id=${encodeURIComponent(room)}`,{headers:token?{Authorization:`Bearer ${token}`}:{},signal:controller.signal});const data=await res.json() as Reply;if(cancelled)return;if(!res.ok)throw new Error(data.error);if(data.game){accept(data);setError('');}else setInvite(data);setConnected(true);}catch(e){if(!cancelled){setConnected(false);setError((e as Error).message);}}finally{if(!cancelled)timer=setTimeout(poll,1500);}}
 poll();return()=>{cancelled=true;controller.abort();clearTimeout(timer);};},[room,token]);
 async function send(type:string,ids?:number[]){if(busy)return;setBusy(true);setError('');try{
 const res=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({type,id:room,name,target,revision:current.current?.revision,ids})});const v=await res.json() as Reply;if(!res.ok)throw new Error(v.error);
 if(v.token){const id=v.id||room;localStorage.setItem(`farkle-room-${id}`,v.token);localStorage.setItem('farkle-name',name.trim());setToken(v.token);setRoom(id);history.replaceState(null,'',`/online?room=${id}`);}accept(v);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const g=snap?.game,joined=(snap?.names.length||0)===2;
 const mine=!!snap&&g?.player===snap.seat,canChoose=joined&&mine&&g?.phase==='choose'&&!busy&&connected;
 const selected=g?scoreDice(g.selected.map(i=>g.dice[i])):0;
 if(!snap||!joined)return <main className="online-lobby"><section className="online-panel"><a href="/" className="online-back">← До корчми</a><h1>{snap?'Місце для друга':'Грати з другом'}</h1>
 {snap?<><p>Ви — {snap.names[0]}. Гра до {snap.game.target.toLocaleString('uk-UA')} очок.</p><p>Надішліть це посилання другу. Коли він приєднається, партія почнеться.</p><input aria-label="Посилання-запрошення" readOnly value={typeof location==='undefined'?'':location.href}/><button className="primary" onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setCopied(true);}catch{setError('Скопіюйте посилання з поля вище.');}}}>{copied?'Посилання скопійовано':'Скопіювати запрошення'}</button><p role="status">{connected?'Чекаємо друга…':'Відновлюємо зв’язок…'}</p><small>Запрошення діє 24 години. Ця вкладка зберігає ваше місце.</small></>:<>
 {room&&invite&&<p>{invite.host} запрошує до гри на {invite.target.toLocaleString('uk-UA')} очок.</p>}
 {room&&invite&&!invite.joinable?<p>Обидва місця зайняті. Якщо ви вже грали тут, відкрийте посилання в тому самому браузері.</p>:<><label>Ваше ім’я<input value={name} maxLength={24} onChange={e=>setName(e.target.value)} autoComplete="nickname"/></label>{!room&&<label>Ціль партії<select value={target} onChange={e=>setTarget(Number(e.target.value))}>{[4000,6000,8000].map(n=><option key={n} value={n}>{n.toLocaleString('uk-UA')}</option>)}</select></label>}<button className="primary" disabled={busy||!name.trim()||(!!room&&!invite)} onClick={()=>send(room?'join':'create')}>{busy?'Зачекайте…':room?'Приєднатися':'Створити запрошення'}</button></>}
 </>}{error&&<p role="alert">{error}</p>}</section></main>;
 return <main className="game-screen online-table">
 <DiceTable game={g!} authoritative interactive={canChoose} onResult={()=>{}} onSelect={id=>send('select',g!.selected.includes(id)?g!.selected.filter(i=>i!==id):[...g!.selected,id])}/>
 {[0,1].map(p=><section key={p} className={`score-note ${p===snap.seat?'near':'far'} ${g!.player===p?'active':''}`}><div className="score-identity"><span className="score-avatar player-emblem">{snap.names[p].slice(0,1).toUpperCase()}</span><div className="score-identity-text"><h2>{snap.names[p]}{p===snap.seat?' (ви)':''}</h2></div></div><div className="total-line"><span>Рахунок / <span className="score-target">{g!.target.toLocaleString('uk-UA')}</span></span><strong>{g!.scores[p].toLocaleString('uk-UA')}</strong></div><dl><div><dt>За хід</dt><dd>{g!.player===p?g!.pot:0}</dd></div><div><dt>{snap.online[p]?'У грі':'Поза мережею'}</dt></div></dl></section>)}
 <div className="game-status" role="status">{!connected?'Відновлюємо зв’язок…':g!.phase==='rolling'?'Кубики котяться…':g!.phase==='won'?`${snap.names[g!.winner!]} перемагає!`:mine?'Ваш хід':`Хід: ${snap.names[g!.player]}`}</div>
 {(g!.phase==='bust'||g!.phase==='handoff')&&<div className="bust-explanation" role="status"><h2>{g!.phase==='bust'?'Невдалий кидок':`+${g!.result?.earned} очок`}</h2><p>{g!.phase==='bust'?`Немає залікової комбінації. За хід втрачено ${g!.result?.lost||0} очок.`:`${snap.names[g!.player]} передає хід.`}</p></div>}
 <div className="turn-controls">{error&&<div role="alert" className="selection-hint">{error}</div>}{selected>0&&g!.phase==='choose'&&<aside className="selection-hint"><div className="selection-hint-content"><strong>+{selected} <small>очок</small></strong><div className="selection-hint-parts">{selectionBreakdown(g!.selected.map(i=>g!.dice[i])).map(p=><div key={p.label}>{p.label}</div>)}</div></div></aside>}
 <nav className={`game-actions ${canChoose?'has-choice':''}`} aria-label="Дії гри"><button className="utility" onClick={()=>setRules(!rules)}>Правила</button>
 {g!.phase==='ready'&&mine&&<button className="main-action" disabled={busy||!connected} onClick={()=>send('roll')}>Кинути кубики</button>}
 {g!.phase==='choose'&&mine&&<><button disabled={!canChoose||!selected} onClick={()=>send('roll')}>Зарахувати й кинути</button><button className="main-action" disabled={!canChoose||!selected} onClick={()=>send('bank')}>Забрати {g!.pot+selected}</button></>}
 {g!.phase==='won'&&<button className="main-action" disabled={busy||snap.rematch.includes(snap.seat)} onClick={()=>send('rematch')}>{snap.rematch.includes(snap.seat)?'Чекаємо згоди друга':'Зіграти ще раз'}</button>}
 <button className="utility restart-action" onClick={()=>{setCopied(false);navigator.clipboard.writeText(location.href).then(()=>setCopied(true)).catch(()=>setError('Посилання можна скопіювати з адресного рядка.'));}}>{copied?'Скопійовано':'Запрошення'}</button><button className="utility" onClick={()=>location.assign('/')}>Вийти</button></nav></div>
 {rules&&<div className="table-overlay"><section className="table-notice"><h2>Правила корчми</h2><p>Одиниця — 100. П’ятірка — 50.<br/>Три однакових — значення × 100, три одиниці — 1 000.<br/>Кожен наступний однаковий кубик подвоює комбінацію.<br/>1–5: 500; 2–6: 750; 1–6: 1 500.</p><p>Зарахуйте вибір і ризикніть знову або заберіть очки.<br/>Невдалий кидок обнуляє очки цього ходу.</p><button className="primary" onClick={()=>setRules(false)}>Зрозуміло</button></section></div>}
 </main>;
}
