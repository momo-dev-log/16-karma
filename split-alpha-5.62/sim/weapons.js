'use strict';
// Simulator weapons (all provisional). To add a weapon, add an entry to WEAPONS; see README.md.
// Fields: key, owner ('m'|'r'|'k'), rarity, name, min, max (base value range by quality), ch (charge needed),
// maxHp, guardBonus, plague, and hooks (b = Battle, c = owner):
//   cardBonus(b,c,card)          -> number added to the card's damage before frost (modifiedDamage)
//   cardDamage(b,c,part,damage)  -> final card damage (after modifiedDamage, before the broken-part 1.2x)
//   afterCardHit(b,c,part,damage,result), afterCard(b,c)
//   fire(b,c) replaces the default weapon hit (base damage on the chosen part); afterFire(b,c)
//   endPlayerPhase(b,c), newTurn(b,c), init(b,c)
// All percentages of weapon effects are floored (common rule).

const pct=(n,p)=>Math.floor(n*p/100);
// Default weapon hit: base on the policy's part, returns {part,res}
function plainHit(b,c,amount){const part=b.choosePart();const res=b.hitPart(amount,c.id,part);return {part,res};}
function poisonOnHit(n){return (b,c)=>{const {part}=plainHit(b,c,c.weapon.base);b.addPoison(c,part,n);b.log(`${c.name} 武器技の毒 +${n}（${b.foes[part].name}）`);};}

const WEAPONS=[
  // ---- 美桜 ----
  {key:'m-common',owner:'m',rarity:'コモン',name:'デコ・ミニチェンソー',min:92,max:110,ch:6,maxHp:10},
  {key:'m-uncommon',owner:'m',rarity:'アンコモン',name:'逆棘のソー',min:94,max:114,ch:5,cardBonus:()=>8},
  {key:'m-rare',owner:'m',rarity:'レア',name:'双刃チェンソー',min:98,max:118,ch:6,
    fire:(b,c)=>{for(let i=0;i<2&&!b.ended;i++)plainHit(b,c,pct(c.weapon.base,60));}},
  {key:'m-epic',owner:'m',rarity:'エピック',name:'再点火のソー',min:100,max:122,ch:6,
    afterFire:(b,c)=>{if(!c.ws.reignited){c.ws.reignited=true;c.cost+=1;b.log(`${c.name} 再点火：Cost+1（${c.cost}）`);}},
    newTurn:(b,c)=>{c.ws.reignited=false;}},
  {key:'m-legendary',owner:'m',rarity:'レジェンダリー',name:'往復刃',min:96,max:116,ch:7,
    afterCardHit:(b,c,part,damage)=>{if(!b.ended){const n=Math.floor(damage/3);b.log(`${c.name} 往復刃の追撃 ${n}`);b.hitPart(n,c.id,part);}}},
  {key:'m-mythic',owner:'m',rarity:'ミシック',name:'食い込みの鋸',min:98,max:120,ch:8,
    init:(b,c)=>{c.ws.bites=0;},
    cardBonus:(b,c)=>3*c.ws.bites,
    afterCardHit:(b,c)=>{c.ws.bites=Math.min(8,c.ws.bites+1);},
    fire:(b,c)=>{const n=c.weapon.base+c.ws.bites*10;b.log(`${c.name} 食い込み${c.ws.bites}を使う（+${c.ws.bites*10}）`);c.ws.bites=0;plainHit(b,c,n);c.ws.bites=Math.min(8,c.ws.bites+1);}},
  // ---- 麗華 ----
  {key:'r-common',owner:'r',rarity:'コモン',name:'クラシック・リボルバー',min:102,max:120,ch:6,maxHp:10},
  {key:'r-uncommon',owner:'r',rarity:'アンコモン',name:'護衛の短銃',min:100,max:120,ch:5,guardBonus:5,cardBonus:()=>4},
  {key:'r-rare',owner:'r',rarity:'レア',name:'銀線のリボルバー',min:104,max:126,ch:6,
    fire:(b,c)=>{const {part}=plainHit(b,c,c.weapon.base);c.ws.mark={part,left:3,until:b.turn+1};b.log(`${c.name} ${b.foes[part].name}に印（T${b.turn+1}の終わりまで、3回）`);},
    cardDamage:(b,c,part,damage)=>{const m=c.ws.mark;if(m&&m.part===part&&m.left>0){m.left--;return damage+pct(damage,30);}return damage;},
    endPlayerPhase:(b,c)=>{if(c.ws.mark&&b.turn>=c.ws.mark.until)c.ws.mark=null;}},
  {key:'r-epic',owner:'r',rarity:'エピック',name:'蓄圧リボルバー',min:136,max:160,ch:7,
    afterCard:(b,c)=>{if(c.cost===0&&!c.ws.pressed){c.ws.pressed=true;c.charge=Math.min(c.weapon.ch,c.charge+1);b.log(`${c.name} 蓄圧：チャージ+1（${c.charge}）`);}},
    newTurn:(b,c)=>{c.ws.pressed=false;}},
  {key:'r-legendary',owner:'r',rarity:'レジェンダリー',name:'威圧のリボルバー',min:108,max:130,ch:6,
    fire:(b,c)=>{const base=c.weapon.base,g=c.guard;let bonus=0;
      if(g>=30)bonus=(b.attackTargetsAny(c.id)&&g>=b.forecastTo(c.id))?60:25;
      if(bonus)b.log(`${c.name} 威圧 +${bonus}%（盾${g}）`);
      plainHit(b,c,base+pct(base,bonus));}},
  {key:'r-mythic',owner:'r',rarity:'ミシック',name:'女王の追撃銃',min:108,max:130,ch:6,
    fire:(b,c)=>{const base=c.weapon.base;const {part,res}=plainHit(b,c,base);if(b.ended)return;
      const p=res.broke?80:50;b.log(`${c.name} 追加射撃 ${p}%`);b.hitPart(pct(base,p),c.id,part);}},
  // ---- 小春 ----
  {key:'k-common',owner:'k',rarity:'コモン',name:'花毒の針',min:90,max:108,ch:6,maxHp:10,fire:poisonOnHit(1)},
  {key:'k-uncommon',owner:'k',rarity:'アンコモン',name:'深翠の針',min:88,max:108,ch:5,cardBonus:()=>8,fire:poisonOnHit(2)},
  {key:'k-rare',owner:'k',rarity:'レア',name:'散華の針束',min:92,max:114,ch:6,
    fire:(b,c)=>{const base=c.weapon.base;
      // All parts: shared HP once (no broken 1.2x), break progress 50% into every part.
      b.hitPart(base,c.id,0,{noBroken:true,skipBreak:true});
      b.foes.forEach((f,i)=>{if(b.addBreak(i,pct(base,50)))b.log(`散華で${f.name} 【部位破壊】`);});}},
  {key:'k-epic',owner:'k',rarity:'エピック',name:'残毒の針',min:90,max:112,ch:6,fire:poisonOnHit(12)},
  {key:'k-legendary',owner:'k',rarity:'レジェンダリー',name:'群針',min:94,max:116,ch:6,
    fire:(b,c)=>{for(let i=0;i<3&&!b.ended;i++){const {part}=plainHit(b,c,pct(c.weapon.base,40));b.addPoison(c,part,2);}}},
  {key:'k-mythic',owner:'k',rarity:'ミシック',name:'疫病の原針',min:88,max:110,ch:6,plague:true}
];
// Current prototype weapons (index.html originalWeapons): fixed damage, charge 6, no extra effect.
const BASELINE={m:{key:'m-base',owner:'m',rarity:'基準',name:'基準（試作）',base:100,ch:6},r:{key:'r-base',owner:'r',rarity:'基準',name:'基準（試作）',base:110,ch:6},k:{key:'k-base',owner:'k',rarity:'基準',name:'基準（試作）',base:100,ch:6}};

function baseValue(w,quality){return w.min+Math.floor((w.max-w.min)*(quality-1)/9);}
function makeWeapon(def,quality){return def.base!==undefined?{...def}:{...def,base:baseValue(def,quality),quality};}

module.exports={WEAPONS,BASELINE,baseValue,makeWeapon};
