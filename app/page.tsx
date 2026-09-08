'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Dices, BookOpen, RotateCcw, Shield, Crown, ArrowRight, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import DiceTable from '@/components/dice-table';
import { gameReducer, initialGame, scoreDice, bestSelection, playerName, type Mode, type Game } from '@/lib/game';
const number=(n:number)=>n.toLocaleString('uk-UA');

export default function Home(){
 const [game,dispatch]=useReducer(gameReducer,undefined,()=>initialGame());
 const [rules,setRules]=useState(false),[menu,setMenu]=useState(false),[newMode,setNewMode]=useState<Mode|null>(null);
 const gameRef=useRef(game);gameRef.current=game;
 const isBot=game.mode==='bot'&&game.player===1;
 const selectedScore=scoreDice(game.selected.map(i=>game.dice[i]));
 const canChoose=game.phase==='choose'&&!isBot;
 const nextName=playerName(game,1-game.player);
 const selectedInvalid=game.selected.length>0&&!selectedScore;
 const fresh=game.scores.every(n=>n===0)&&game.phase==='ready'&&game.round===1&&game.player===0;
 const requestNew=(mode:Mode)=>{if(fresh)dispatch({type:'new',mode});else setNewMode(mode);};
 useEffect(()=>{
  if(rules||newMode||menu)return;
  let fn:(()=>void)|undefined;
  if(game.phase==='handoff'||game.phase==='bust')fn=()=>dispatch({type:'next'});
  else if(isBot&&game.phase==='ready')fn=()=>dispatch({type:'roll'});
  else if(isBot&&game.phase==='choose'){
   if(!game.selected.length)fn=()=>dispatch({type:'select',ids:bestSelection(game.dice,game.locked).ids});
   else{const total=game.pot+selectedScore;const remaining=6-game.locked.length-game.selected.length;const winning=game.scores[1]+total>=4000;const stop=winning||total>=700||(remaining<=2&&remaining>0&&total>=300);fn=()=>dispatch({type:stop?'bank':'roll'});}
  }
  if(fn){const id=setTimeout(fn,game.phase==='bust'||game.phase==='handoff'?4500:1100);return ()=>clearTimeout(id);}
 },[game,isBot,selectedScore,rules,newMode,menu]);
 // Optional browser-agent readback uses exactly the same game state.
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  try{Promise.resolve(context.registerTool({name:'read_farkle_game',title:'Read the current Farkle game',description:'Read scores, active player, dice, held dice and the current turn phase.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');const g=gameRef.current;return {mode:g.mode,phase:g.phase,player:playerName(g),scores:g.scores,turnPoints:g.pot,dice:g.dice,selected:g.selected,locked:g.locked,target:4000};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
  return ()=>lifecycle.abort();
 },[]);
 let instruction=game.message;
 if(game.phase==='choose')instruction=isBot?'Корчмар обмірковує наступний кидок…':selectedInvalid?'У виборі є кубики, що не дають очок.':selectedScore?`Вибрано: +${number(selectedScore)}. Забрати чи ризикнути?`:'Натисніть на кубики, що дають очки.';
 if(game.phase==='ready'&&isBot)instruction='Корчмар готується кидати…';
 return <main className="game-screen">
 <DiceTable game={game} interactive={canChoose&&!rules&&!menu&&!newMode} onSelect={id=>dispatch({type:'toggle',id})} onResult={(values,rollId)=>dispatch({type:'rolled',values,rollId})}/>
 <PlayerScore game={game} p={1}/><PlayerScore game={game} p={0}/>
 <div className="game-status" role="status">{game.phase==='rolling'?'Кубики котяться…':isBot&&!game.result?'Хід корчмаря':game.phase==='choose'?(selectedInvalid?'Ця комбінація не дає очок':game.selected.length?'':'Виберіть кубики'):game.phase==='ready'?`Хід: ${playerName(game)}`:''}</div>
 <nav className="game-actions" aria-label="Дії гри">
 <button className="utility" onClick={()=>setRules(true)}><BookOpen size={16}/> Правила</button>
 {game.phase==='ready'&&!isBot&&<button className="main-action" onClick={()=>dispatch({type:'roll'})}><Dices size={19}/> Кинути кубики</button>}
 {game.phase==='choose'&&!isBot&&<><button disabled={!selectedScore} onClick={()=>dispatch({type:'roll'})}><Dices size={18}/>{game.selected.length+game.locked.length===6?'Кинути всі 6':'Зарахувати й кинути'}</button><button className="main-action" disabled={!selectedScore} onClick={()=>dispatch({type:'bank'})}><Check size={18}/>Забрати {number(game.pot+selectedScore)}</button></>}
 <button className="utility" onClick={()=>setMenu(true)}><RotateCcw size={16}/> Меню</button>
 </nav>
 {game.result&&game.phase==='won'&&<TurnSummary key={`${game.rollId}-${game.phase}`} game={game} nextName={nextName} onNext={()=>dispatch({type:'next'})} onRestart={()=>dispatch({type:'new',mode:game.mode})}/>}
 <Dialog open={menu} onOpenChange={setMenu}><DialogContent className="game-dialog" showCloseButton={false}><DialogClose className="dialog-close" aria-label="Закрити меню"><X size={20}/></DialogClose><DialogTitle className="dialog-title">Корчма</DialogTitle><DialogDescription>Нова партія до 4 000 очок</DialogDescription><div className="menu-options"><button className="primary" onClick={()=>{setMenu(false);requestNew('bot');}}><Crown size={20}/> Проти корчмаря</button><button className="primary" onClick={()=>{setMenu(false);requestNew('hotseat');}}><Shield size={20}/> Удвох на одному пристрої</button><DialogClose className="secondary">Повернутися до гри</DialogClose></div></DialogContent></Dialog>
 <Dialog open={rules} onOpenChange={setRules}><DialogContent className="game-dialog" showCloseButton={false}><DialogClose className="dialog-close" aria-label="Закрити правила"><X size={20}/></DialogClose><DialogTitle className="dialog-title">Правила корчми</DialogTitle><DialogDescription>Перший, хто набере 4 000 очок, перемагає.</DialogDescription><div className="rules-body"><p>Киньте шість кубиків. Виберіть хоча б одну залікову комбінацію, а потім заберіть очки або киньте решту кубиків ще раз.</p><div className="rule-row"><span>Одна 1 / одна 5</span><b>100 / 50</b></div><div className="rule-row"><span>Три 1</span><b>1 000</b></div><div className="rule-row"><span>Три 2, 3, 4, 5 або 6</span><b>200–600</b></div><div className="rule-row"><span>Кожен наступний однаковий</span><b>подвоює комбінацію</b></div><div className="rule-row"><span>1–2–3–4–5</span><b>500</b></div><div className="rule-row"><span>2–3–4–5–6</span><b>750</b></div><div className="rule-row"><span>1–2–3–4–5–6</span><b>1 500</b></div><p><b>Невдалий кидок:</b> якщо жоден кубик не дає очок, усі незабрані очки цього ходу згорають. Загальний рахунок залишається.</p><p><b>Усі шість залікові?</b> Можна знову кинути всі шість і продовжити накопичувати очки.</p><p>Комбінації складаються тільки з одного кидка. Відкладені кубики не можна додати до нової комбінації.</p><DialogClose className="primary">До столу</DialogClose></div></DialogContent></Dialog>
 <Dialog open={newMode!==null} onOpenChange={open=>{if(!open)setNewMode(null);}}><DialogContent className="game-dialog" showCloseButton={false}><DialogTitle className="dialog-title">Почати нову партію?</DialogTitle><DialogDescription>Поточний рахунок буде скинуто. Режим: {newMode==='bot'?'проти корчмаря':'удвох на одному пристрої'}.</DialogDescription><div className="dialog-actions"><button className="secondary" onClick={()=>setNewMode(null)}>Продовжити гру</button><button className="primary" onClick={()=>{dispatch({type:'new',mode:newMode!});setNewMode(null);}}>Нова партія</button></div></DialogContent></Dialog>
 </main>
}
function PlayerScore({game,p}:{game:Game;p:number}){const active=game.player===p;return <section className={`score-note ${p===0?'near':'far'} ${active?'active':''} ${game.result?.player===p&&game.result.earned?'score-earned':''}`} aria-label={`Рахунок: ${playerName(game,p)}`}><h2>{playerName(game,p)}{active&&<span className="turn-mark" aria-label="Зараз грає">◆</span>}</h2><div className="total-line"><span>Рахунок / 4000</span><strong>{game.result?.player===p?<CountUp key={`${game.rollId}-${game.phase}`} from={game.result.before} to={game.result.after}/>:number(game.scores[p])}</strong></div><dl><div><dt>За хід</dt><dd>{active?number(game.pot):0}</dd></div><div><dt>Вибрано</dt><dd>{active?number(scoreDice(game.selected.map(i=>game.dice[i]))):0}</dd></div></dl></section>}

function CountUp({from,to}:{from:number;to:number}){
 const [value,setValue]=useState(from);
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setValue(to);return;}
  let frame=0;const start=performance.now()+450;
  const tick=(now:number)=>{const t=Math.min(1,Math.max(0,(now-start)/1100));setValue(Math.round(from+(to-from)*(1-(1-t)**3)));if(t<1)frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[from,to]);
 return <><span aria-hidden="true">{number(value)}</span><span className="sr-only">{number(to)}</span></>;
}
function TurnSummary({game,nextName,onNext,onRestart}:{game:Game;nextName:string;onNext:()=>void;onRestart:()=>void}){
 const result=game.result!;const won=game.phase==='won',bust=game.phase==='bust';
 const [ready,setReady]=useState(false);
 useEffect(()=>{const id=setTimeout(()=>setReady(true),1800);return()=>clearTimeout(id);},[]);
 return <div className={won?"table-overlay result-overlay":"turn-feedback"}><section className={`turn-result ${bust?'result-bust':''}`} aria-label="Підсумок ходу">
 <div role="status" className="sr-only">{playerName(game,result.player)}: {result.earned} очок за хід. {bust&&result.lost?`Втрачено ${result.lost} незабраних очок.`:''} Загальний рахунок: {result.after}.{won?' Перемога!':''}</div>
 <p className="result-caption">{won?'Перемога':bust?'Невдалий кидок':'Хід завершено'}</p>
 <h2>{playerName(game,result.player)}</h2>
 <div className="result-points">+{number(result.earned)}<span>очок за хід</span></div>
 {bust&&<p className="result-loss">{result.lost?`Згоріло ${number(result.lost)} незабраних очок`:'Жодної залікової комбінації'}</p>}
 <div className="result-total"><span>Загальний рахунок</span><div>{number(result.before)} <ArrowRight size={20}/><strong><CountUp from={result.before} to={result.after}/></strong></div></div>
 <div className="result-footer">{won?<button className="primary" disabled={!ready} onClick={onRestart}>Зіграти ще раз</button>:<><p>Далі: {nextName}</p><button className="primary" disabled={!ready} onClick={onNext}>{game.mode==='hotseat'?'Передати хід':'Продовжити'} <ArrowRight size={18}/></button></>}</div>
 </section></div>;
}
