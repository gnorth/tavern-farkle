'use client';
import {useEffect,useRef,useState} from 'react';
import {Dices,Users,Link,Copy,Check,ArrowLeft,ArrowRight,Shield,Clock,LoaderCircle} from 'lucide-react';
import DiceTable from '@/components/dice-table';
import RulesDialog from '@/components/rules-dialog';
import {scoreDice,selectionBreakdown,type Game} from '@/lib/game';
type Reply=Snapshot & {error?:string;id?:string;token?:string;host:string;target:number;joinable:boolean};
type Snapshot={game:Game;names:string[];revision:number;seat:number;online:boolean[];rematch:number[]};
export default function OnlinePage(){
 const [initialized,setInitialized]=useState(false);
 const [room,setRoom]=useState(''),[token,setToken]=useState(''),[snap,setSnap]=useState<Snapshot|null>(null),[invite,setInvite]=useState<{host:string;target:number;joinable:boolean}|null>(null);
 const [name,setName]=useState(''),[target,setTarget]=useState(4000),[error,setError]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false),[copied,setCopied]=useState(false),[rules,setRules]=useState(false);
 const current=useRef<Snapshot|null>(null);current.current=snap;
 function accept(v:Snapshot){if(v.game&&(!current.current||v.revision>=current.current.revision)){current.current=v;setSnap(v);}setConnected(true);}
 useEffect(()=>{const id=new URLSearchParams(location.search).get('room')||'';setInitialized(true);setRoom(id);setName(localStorage.getItem('farkle-name')||'');if(id)setToken(localStorage.getItem(`farkle-room-${id}`)||'');},[]);
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
 const invitationUrl=typeof location==='undefined'?'':location.href;
 async function copyInvite(){try{await navigator.clipboard.writeText(invitationUrl);setCopied(true);}catch{setError('Виділіть і скопіюйте посилання з поля нижче.');}}
 if(!snap||!joined)return <main className="online-lobby"><section className="online-panel" aria-labelledby="lobby-title">
 <a href="/" className="online-back"><ArrowLeft size={16}/> До корчми</a>
 <header className="lobby-heading"><div className="lobby-seal" aria-hidden="true"><Dices size={38}/></div><span className="lobby-kicker">ПАРТІЯ НА ДВОХ</span><h1 id="lobby-title">{snap?'Ваш стіл готовий':room?'Вас запрошують до столу':'Вечір у добрій компанії'}</h1><p>{snap?'Залишилося покликати друга.':room?'Займіть вільне місце — і можна кидати кубики.':'Створіть запрошення та зіграйте з другом у корчмі.'}</p></header>
 {!initialized||room&&!snap&&!invite&&!error?<div className="lobby-wait" role="status"><LoaderCircle size={18} className="lobby-spinner"/> Шукаємо ваш стіл…</div>:snap?<>
 <div className="lobby-match"><span><Users size={16}/> 1 із 2 гравців</span><span>До <b>{snap.game.target.toLocaleString('uk-UA')}</b> очок</span></div>
 <div className="lobby-seats"><div className="lobby-seat"><span className="seat-avatar">{snap.names[0].slice(0,1).toUpperCase()}</span><strong>{snap.names[0]}</strong><small><Check size={13}/> Ви готові</small></div><div className="lobby-seat empty"><span className="seat-avatar"><Users size={27}/></span><strong>Місце для друга</strong><small>Чекає на запрошення</small></div></div>
 <div className="invite-box"><label htmlFor="invite-url"><Link size={16}/> Посилання для друга</label><div className="invite-field"><input id="invite-url" readOnly value={invitationUrl} onFocus={e=>e.currentTarget.select()}/></div><button className="primary lobby-primary" onClick={copyInvite}>{copied?<Check size={19}/>:<Copy size={19}/>} {copied?'Скопійовано — надішліть другу':'Скопіювати запрошення'}</button><p>Надішліть посилання в будь-якому месенджері.</p></div>
 <div className="lobby-wait" role="status"><span className={connected?'waiting-dot':'waiting-dot offline'}/>{connected?'Гра почнеться, коли друг приєднається':'Відновлюємо зв’язок…'}</div>
 <footer className="lobby-footnote"><Clock size={14}/> Запрошення діє 24 години</footer>
 </>:room&&invite&&!invite.joinable?<div className="lobby-empty"><Users size={28}/><h2>За столом уже двоє</h2><p>Якщо ви вже приєднувалися, відкрийте посилання в тому самому браузері.</p><a href="/online" className="primary">Створити свій стіл</a></div>:<form className="lobby-form" onSubmit={e=>{e.preventDefault();send(room?'join':'create');}}>
 {room&&invite&&<div className="lobby-host"><span className="seat-avatar">{invite.host.slice(0,1).toUpperCase()}</span><div><strong>{invite.host}</strong><span>Запрошує на партію до {invite.target.toLocaleString('uk-UA')} очок</span></div></div>}
 <label className="lobby-name" htmlFor="player-name">Як вас називати?<input id="player-name" placeholder="Ваше ім’я" value={name} required maxLength={24} onChange={e=>setName(e.target.value)} autoComplete="nickname"/></label>
 {!room&&<fieldset className="lobby-target"><legend>До скількох очок граємо?</legend><div className="target-options">{[4000,6000,8000].map((n,i)=><label key={n} className={target===n?'chosen':''}><input type="radio" name="target" value={n} checked={target===n} onChange={()=>setTarget(n)}/><strong>{n.toLocaleString('uk-UA')}</strong><span>{['Швидка партія','Ще трохи азарту','Довгий вечір'][i]}</span>{target===n&&<Check size={14} aria-hidden="true"/>}</label>)}</div></fieldset>}
 <button className="primary lobby-primary" disabled={busy||!name.trim()||(!!room&&!invite)} type="submit">{busy?<LoaderCircle size={19} className="lobby-spinner"/>:room?<Dices size={20}/>:<Link size={19}/>} {busy?'Готуємо стіл…':room?'Сісти за стіл':'Створити запрошення'} {!busy&&<ArrowRight size={18}/>}</button>
 <footer className="lobby-footnote"><Shield size={14}/> Без реєстрації · Телефон або комп’ютер</footer>
 </form>}
 {error&&<p className="lobby-error" role="alert">{error}</p>}</section></main>;
 return <main className="game-screen online-table">
 <DiceTable game={g!} authoritative interactive={canChoose&&!rules} onResult={()=>{}} onSelect={id=>send('select',g!.selected.includes(id)?g!.selected.filter(i=>i!==id):[...g!.selected,id])}/>
 {[0,1].map(p=><section key={p} className={`score-note ${p===snap.seat?'near':'far'} ${g!.player===p?'active':''}`}><div className="score-identity"><span className="score-avatar player-emblem">{snap.names[p].slice(0,1).toUpperCase()}</span><div className="score-identity-text"><h2>{snap.names[p]}{p===snap.seat?' (ви)':''}</h2></div></div><div className="total-line"><span>Рахунок / <span className="score-target">{g!.target.toLocaleString('uk-UA')}</span></span><strong>{g!.scores[p].toLocaleString('uk-UA')}</strong></div><dl><div><dt>За хід</dt><dd>{g!.player===p?g!.pot:0}</dd></div><div><dt>{snap.online[p]?'У грі':'Поза мережею'}</dt></div></dl></section>)}
 <div className="game-status" role="status">{!connected?'Відновлюємо зв’язок…':g!.phase==='rolling'?'Кубики котяться…':g!.phase==='won'?`${snap.names[g!.winner!]} перемагає!`:mine?'Ваш хід':`Хід: ${snap.names[g!.player]}`}</div>
 {(g!.phase==='bust'||g!.phase==='handoff')&&<div className="bust-explanation" role="status"><h2>{g!.phase==='bust'?'Невдалий кидок':`+${g!.result?.earned} очок`}</h2><p>{g!.phase==='bust'?`Немає залікової комбінації. За хід втрачено ${g!.result?.lost||0} очок.`:`${snap.names[g!.player]} передає хід.`}</p></div>}
 <div className="turn-controls">{error&&<div role="alert" className="selection-hint">{error}</div>}{selected>0&&g!.phase==='choose'&&<aside className="selection-hint"><div className="selection-hint-content"><strong>+{selected} <small>очок</small></strong><div className="selection-hint-parts">{selectionBreakdown(g!.selected.map(i=>g!.dice[i])).map(p=><div key={p.label}>{p.label}</div>)}</div></div></aside>}
 <nav className={`game-actions ${canChoose?'has-choice':''}`} aria-label="Дії гри"><button className="utility" onClick={()=>setRules(!rules)}>Правила</button>
 {g!.phase==='ready'&&mine&&<button className="main-action" disabled={busy||!connected} onClick={()=>send('roll')}>Кинути кубики</button>}
 {g!.phase==='choose'&&mine&&<><button disabled={!canChoose||!selected} onClick={()=>send('roll')}>Зарахувати й кинути</button><button className="main-action" disabled={!canChoose||!selected} onClick={()=>send('bank')}>Забрати {g!.pot+selected}</button></>}
 {g!.phase==='won'&&<button className="main-action" disabled={busy||snap.rematch.includes(snap.seat)} onClick={()=>send('rematch')}>{snap.rematch.includes(snap.seat)?'Чекаємо згоди друга':'Зіграти ще раз'}</button>}
 <button className="utility restart-action" onClick={()=>{setCopied(false);navigator.clipboard.writeText(location.href).then(()=>setCopied(true)).catch(()=>setError('Посилання можна скопіювати з адресного рядка.'));}}>{copied?'Скопійовано':'Запрошення'}</button><button className="utility" onClick={()=>location.assign('/')}>Вийти</button></nav></div>
 <RulesDialog open={rules} onOpenChange={setRules} target={g!.target}/>
 </main>;
}
