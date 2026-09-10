'use client';
import {Dice1,Dice2,Dice3,Dice4,Dice5,Dice6,Dices,X,ArrowRight} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
const number=(n:number)=>n.toLocaleString('uk-UA');
export default function RulesDialog({open,onOpenChange,target}:{open:boolean;onOpenChange:(open:boolean)=>void;target:number}){return (<Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="game-dialog tavern-rules" showCloseButton={false}>
 <DialogClose className="dialog-close" aria-label="Закрити правила"><X size={20}/></DialogClose>
 <div className="rules-heading"><div className="rules-seal" aria-hidden="true"><Dices size={28}/></div><div><DialogTitle className="dialog-title">Правила корчми</DialogTitle><DialogDescription>Наберіть {number(target)} очок, щоб перемогти.</DialogDescription></div></div>
 <div className="rules-body"><p className="rules-intro">Кожен хід починається з шести кубиків. Виберіть хоча б один заліковий кубик або комбінацію, потім заберіть очки чи киньте решту знову.</p>
 <div className="rules-tip"><b>Не обов’язково забирати всі залікові кубики</b><p>Наприклад, із двох п’ятірок можна вибрати лише одну. Решта кубиків залишаться для наступного кидка.</p></div>
 <h3 className="rules-section-title">Окремі кубики</h3>
 <div className="rules-combos"><RuleCombo dice={[1]} label="Одиниця" points="100"/><RuleCombo dice={[5]} label="П’ятірка" points="50"/></div>
 <h3 className="rules-section-title">Три однакові</h3>
 <div className="rules-combos">{[1,2,3,4,5,6].map(v=><RuleCombo key={v} dice={[v,v,v]} label={`Три кубики зі значенням ${v}`} points={number(v===1?1000:v*100)}/>)}</div>
 <div className="rules-multiplier"><span className="rules-times">×2</span><div><b>Ще один такий самий — удвічі більше</b><p>Наприклад: три двійки — 200, чотири — 400, п’ять — 800, шість — 1 600 очок.</p></div></div>
 <h3 className="rules-section-title">Послідовності</h3>
 <div className="rules-combos"><RuleCombo dice={[1,2,3,4,5]} label="Від одного до п’яти" points="500"/><RuleCombo dice={[2,3,4,5,6]} label="Від двох до шести" points="750"/><RuleCombo dice={[1,2,3,4,5,6]} label="Повна послідовність" points="1 500"/></div>
 <div className="rules-tip rules-risk"><b>Невдалий кидок</b><p>Жодної залікової комбінації? Незабрані очки цього ходу згорають. Загальний рахунок залишається.</p></div>
 <div className="rules-tip"><b>Усі шість кубиків залікові?</b><p>Кидайте всі шість знову й продовжуйте накопичувати очки.</p></div>
 <p className="rules-footnote">Комбінації складаються лише з одного кидка. Відкладені кубики не додаються до нової комбінації. Перемагає той, хто першим зарахує щонайменше {number(target)} очок.</p>
 <p className="rules-footnote">Граємо звичайними кубиками, без джокерів і бонусів удачі. <a href="https://kingdom-come-deliverance.fandom.com/wiki/Dice" target="_blank" rel="noopener noreferrer" className="underline">Правила KCD ↗</a></p>
 <DialogClose className="primary rules-return">До столу <ArrowRight size={17}/></DialogClose></div></DialogContent></Dialog>);}
function RuleCombo({dice,label,points}:{dice:number[];label:string;points:string}){
 const icons=[Dice1,Dice2,Dice3,Dice4,Dice5,Dice6];
 return <div className="rule-combo" aria-label={`${label}: ${points} очок`}><div className="rule-dice" aria-hidden="true">{dice.map((value,i)=>{const Icon=icons[value-1];return <Icon key={i} className={`rule-die ${value===1?'rule-die-one':''}`} strokeWidth={1.7}/>;})}</div><span className="rule-points">{points}<small>очок</small></span></div>;
}
