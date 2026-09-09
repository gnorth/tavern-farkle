// Browser Web Crypto; never seeded from the player, score, clock or opponent.
export function randomUint32(){return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];}
export function secureRandom(){return randomUint32()/0x100000000;}
export function uniformInt(limit:number,draw:()=>number=randomUint32){
 if(!Number.isSafeInteger(limit)||limit<1||limit>0x100000000)throw new Error('Invalid random range');
 const ceiling=Math.floor(0x100000000/limit)*limit;let value:number;
 do{value=draw();}while(value>=ceiling);
 return value%limit;
}
