'use strict';
// Stage 2: parameterised weapon definitions and the variants to compare.
// weapons.js (stage 1, commit 35f3fdf) is kept unchanged; the "current" variant of every factory below
// reproduces it exactly (checked by run_stage2.js --check-current).
// Every weapon effect reports itself with b.effect(owner, label, count, extraDamage).
const pct=(n,p)=>Math.floor(n*p/100);

// A weapon hit on the policy's part. Records extra damage relative to a plain hit of `plain` on that part.
function hit(b,c,amount,part=b.choosePart()){const res=b.hitPart(amount,c.id,part);return {part,res};}
function weaponPoison(b,c,part,n,label='武器技の毒'){if(!n)return;b.addPoison(c,part,n,'weapon');b.effect(c.id,label,1,0);b.log(`${c.name} ${label} +${n}（${b.foes[part].name}）`);}

// ---------------- 美桜 ----------------
const mCommon=({hp=10,card=0}={})=>({owner:'m',rarity:'コモン',name:'デコ・ミニチェンソー',min:92,max:110,ch:6,maxHp:hp,
  cardBonus:card?(()=>card):undefined});
const mUncommon=({card=8,ch=5}={})=>({owner:'m',rarity:'アンコモン',name:'逆棘のソー',min:94,max:114,ch,cardBonus:()=>card});
const mRare=({p=60}={})=>({owner:'m',rarity:'レア',name:'双刃チェンソー',min:98,max:118,ch:6,
  fire:(b,c)=>{const base=c.weapon.base;let total=0,first=null;
    for(let i=0;i<2&&!b.ended;i++){const {part,res}=hit(b,c,pct(base,p));if(first===null)first=part;total+=res.dealt;}
    b.effect(c.id,`2回に分かれる（${p}%×2）`,1,total-b.plainDealtBefore);}});
const mEpic=()=>({owner:'m',rarity:'エピック',name:'再点火のソー',min:100,max:122,ch:6,
  afterFire:(b,c)=>{if(!c.ws.reignited){c.ws.reignited=true;c.cost+=1;c.ws.bonusCost=1;b.effect(c.id,'Cost+1',1,0);b.log(`${c.name} 再点火：Cost+1（${c.cost}）`);}},
  // The extra Cost is the last one spent: the card that brings Cost to 0 used it.
  afterCardHit:(b,c,part,damage,res)=>{if(c.ws.bonusCost&&c.cost===0){c.ws.bonusCost=0;b.effect(c.id,'Cost+1で使ったカード',1,res.dealt);}},
  newTurn:(b,c)=>{c.ws.reignited=false;c.ws.bonusCost=0;}});
const mLegendary=({ch=7}={})=>({owner:'m',rarity:'レジェンダリー',name:'往復刃',min:96,max:116,ch,
  afterCardHit:(b,c,part,damage)=>{if(!b.ended){const n=Math.floor(damage/3);b.log(`${c.name} 往復刃の追撃 ${n}`);const r=b.hitPart(n,c.id,part);b.effect(c.id,'追撃',1,r.dealt);}}});
const mMythic=({ch=8,regain=true}={})=>({owner:'m',rarity:'ミシック',name:'食い込みの鋸',min:98,max:120,ch,cardEffectLabel:'食い込み（カード）',
  init:(b,c)=>{c.ws.bites=0;},
  cardBonus:(b,c)=>3*c.ws.bites,
  afterCardHit:(b,c)=>{c.ws.bites=Math.min(8,c.ws.bites+1);},
  fire:(b,c)=>{const bites=c.ws.bites,n=c.weapon.base+bites*10,part=b.choosePart(),plain=b.plainDealt(c.weapon.base,part);
    b.log(`${c.name} 食い込み${bites}を使う（+${bites*10}）`);c.ws.bites=0;
    const r=b.hitPart(n,c.id,part);if(bites)b.effect(c.id,'食い込み（武器技）',1,r.dealt-plain);
    if(regain)c.ws.bites=Math.min(8,c.ws.bites+1);}});

// ---------------- 麗華 ----------------
const rCommon=({hp=10,card=0}={})=>({owner:'r',rarity:'コモン',name:'クラシック・リボルバー',min:102,max:120,ch:6,maxHp:hp,
  cardBonus:card?(()=>card):undefined});
const rUncommon=()=>({owner:'r',rarity:'アンコモン',name:'護衛の短銃',min:100,max:120,ch:5,guardBonus:5,cardBonus:()=>4});
const rRare=({p=30}={})=>({owner:'r',rarity:'レア',name:'銀線のリボルバー',min:104,max:126,ch:6,cardEffectLabel:'印のカード攻撃',
  fire:(b,c)=>{const {part}=hit(b,c,c.weapon.base);c.ws.mark={part,left:3,until:b.turn+1};b.effect(c.id,'印を付けた',1,0);b.log(`${c.name} ${b.foes[part].name}に印（T${b.turn+1}の終わりまで、3回）`);},
  cardDamage:(b,c,part,damage)=>{const m=c.ws.mark;if(m&&m.part===part&&m.left>0){m.left--;return damage+pct(damage,p);}return damage;},
  endPlayerPhase:(b,c)=>{if(c.ws.mark&&b.turn>=c.ws.mark.until)c.ws.mark=null;}});
const rEpic=({min=136,max=160,ch=7}={})=>({owner:'r',rarity:'エピック',name:'蓄圧リボルバー',min,max,ch,
  afterCard:(b,c)=>{if(c.cost===0&&!c.ws.pressed){c.ws.pressed=true;c.charge=Math.min(c.weapon.ch,c.charge+1);b.effect(c.id,'チャージ+1',1,0);b.log(`${c.name} 蓄圧：チャージ+1（${c.charge}）`);}},
  newTurn:(b,c)=>{c.ws.pressed=false;}});
const rLegendary=({need=30}={})=>({owner:'r',rarity:'レジェンダリー',name:'威圧のリボルバー',min:108,max:130,ch:6,guardNeed:need,
  fire:(b,c)=>{const base=c.weapon.base,g=c.guard;let bonus=0;
    if(g>=need)bonus=(b.attackTargetsAny(c.id)&&g>=b.forecastTo(c.id))?60:25;
    b.curFire.intimidate=bonus;
    const part=b.choosePart(),plain=b.plainDealt(base,part);
    if(bonus)b.log(`${c.name} 威圧 +${bonus}%（盾${g}）`);
    const r=b.hitPart(base+pct(base,bonus),c.id,part);if(bonus)b.effect(c.id,`威圧+${bonus}%`,1,r.dealt-plain);}});
// choose: false = same part / 'rule' = the usual part choice after the 1st shot / 'other' = best part other than the 1st (reference)
const rMythic=({choose=false}={})=>({owner:'r',rarity:'ミシック',name:'女王の追撃銃',min:108,max:130,ch:6,
  fire:(b,c)=>{const base=c.weapon.base;const {part,res}=hit(b,c,base);if(b.ended)return;
    const p=res.broke?80:50,part2=choose==='other'?b.choosePart(part):choose?b.choosePart():part;
    b.log(`${c.name} 追加射撃 ${p}%${part2!==part?`（${b.foes[part2].name}へ）`:''}`);
    const r=b.hitPart(pct(base,p),c.id,part2);
    b.effect(c.id,res.broke?'追加射撃（80%）':'追加射撃（50%）',1,r.dealt);if(part2!==part)b.effect(c.id,'追加射撃を別の部位へ',1,0);}});

// ---------------- 小春 ----------------
const kCommon=({poison=1,hp=10,card=0}={})=>({owner:'k',rarity:'コモン',name:'花毒の針',min:90,max:108,ch:6,maxHp:hp,
  cardBonus:card?(()=>card):undefined,
  fire:poison?((b,c)=>{const {part}=hit(b,c,c.weapon.base);weaponPoison(b,c,part,poison);}):undefined});
const kUncommon=({card=8,ch=5,poison=2}={})=>({owner:'k',rarity:'アンコモン',name:'深翠の針',min:88,max:108,ch,cardBonus:()=>card,
  fire:poison?((b,c)=>{const {part}=hit(b,c,c.weapon.base);weaponPoison(b,c,part,poison);}):undefined});
// 散華: shared HP -base once (no broken 1.2x) in every mode.
//  a: break 50% into every part / b: chosen part 100%, the others 40% / c: a + poison +1 on every part
const kRare=({mode='a'}={})=>({owner:'k',rarity:'レア',name:'散華の針束',min:92,max:114,ch:6,
  fire:(b,c)=>{const base=c.weapon.base,part=b.choosePart();
    b.hitPart(base,c.id,part,{noBroken:true,skipBreak:true});
    let progress=0,broke=0;
    const focus=mode==='b'||mode==='bc',poison=mode==='c'||mode==='bc';
    b.foes.forEach((f,i)=>{const amount=focus?(i===part?base:pct(base,40)):pct(base,50);
      const before=f.breakDamage;if(b.addBreak(i,amount)){broke++;b.log(`散華で${f.name} 【部位破壊】`);}progress+=f.breakDamage-before;
      if(poison)b.addPoison(c,i,1,'weapon');});
    b.effect(c.id,'全部位の壊れる量',1,0);if(broke)b.effect(c.id,'散華で部位破壊',broke,0);
    b.curFire.breakProgress=progress;if(poison)b.effect(c.id,'全部位に毒+1',1,0);}});
const kEpic=({poison=12}={})=>({owner:'k',rarity:'エピック',name:'残毒の針',min:90,max:112,ch:6,
  fire:(b,c)=>{const {part}=hit(b,c,c.weapon.base);weaponPoison(b,c,part,poison);}});
const kLegendary=({per=2}={})=>({owner:'k',rarity:'レジェンダリー',name:'群針',min:94,max:116,ch:6,
  fire:(b,c)=>{for(let i=0;i<3&&!b.ended;i++){const {part}=hit(b,c,pct(c.weapon.base,40));weaponPoison(b,c,part,per,'針の毒');}}});
const kMythic=({weaponPoison:wp=0,plusOne=false}={})=>({owner:'k',rarity:'ミシック',name:'疫病の原針',min:88,max:110,ch:6,plague:true,
  poisonBonus:plusOne?1:0,
  fire:wp?((b,c)=>{const {part}=hit(b,c,c.weapon.base);weaponPoison(b,c,part,wp,'武器技の疫毒');}):undefined});

// Plain-hit reference for split weapon techniques: set before fire() by run_stage2's wrapper (see withPlainRef).
function withPlainRef(def){
  if(!def.fire)return def;
  const fire=def.fire;
  return {...def,fire:(b,c)=>{const part=b.choosePart();b.plainDealtBefore=b.plainDealt(c.weapon.base,part);fire(b,c);}};
}

// ---------------- variants ----------------
// group: weapon key; id: unique; label: what changed; current: the stage-1 definition; def: factory call; mods: policy additions.
const V=(group,id,label,def,extra={})=>({group,id,label,def:withPlainRef(def),...extra});
const VARIANTS=[
  // 美桜
  V('m-common','m-common:now','今の形（最大HP+10）',mCommon(),{current:true}),
  V('m-common','m-common:card3','カード攻撃+3（最大HP+10なし）',mCommon({hp:0,card:3})),
  V('m-uncommon','m-uncommon:now','今の形（カード+8・Ch5）',mUncommon(),{current:true}),
  V('m-uncommon','m-uncommon:card5','カード+5（Ch5）',mUncommon({card:5})),
  V('m-uncommon','m-uncommon:ch6','Ch6（カード+8）',mUncommon({ch:6})),
  V('m-rare','m-rare:now','今の形（60%×2）',mRare(),{current:true}),
  V('m-rare','m-rare:70','70%×2',mRare({p:70})),
  V('m-epic','m-epic:now','今の形（変更なし・記録用）',mEpic(),{current:true}),
  V('m-legendary','m-legendary:now','今の形（Ch7）',mLegendary(),{current:true}),
  V('m-legendary','m-legendary:ch6','Ch6',mLegendary({ch:6})),
  V('m-legendary','m-legendary:ch5','参考：Ch5（必要チャージの段差の確認）',mLegendary({ch:5}),{reference:true}),
  V('m-mythic','m-mythic:now','今の形（Ch8・武器技のあと1つたまる）',mMythic(),{current:true}),
  V('m-mythic','m-mythic:ch8-noregain','Ch8・たまらない',mMythic({regain:false})),
  V('m-mythic','m-mythic:ch7','Ch7・たまる',mMythic({ch:7})),
  V('m-mythic','m-mythic:ch7-noregain','Ch7・たまらない',mMythic({ch:7,regain:false})),
  V('m-mythic','m-mythic:ch6','Ch6・たまる',mMythic({ch:6})),
  V('m-mythic','m-mythic:ch6-noregain','Ch6・たまらない',mMythic({ch:6,regain:false})),
  // 麗華
  V('r-common','r-common:now','今の形（最大HP+10）',rCommon(),{current:true}),
  V('r-common','r-common:card3','カード攻撃+3（最大HP+10なし）',rCommon({hp:0,card:3})),
  V('r-uncommon','r-uncommon:now','今の形（変更なし・記録用）',rUncommon(),{current:true}),
  V('r-rare','r-rare:now','今の形（印+30%）',rRare(),{current:true}),
  V('r-rare','r-rare:20','印+20%',rRare({p:20})),
  V('r-epic','r-epic:now','今の形（基礎値136〜160・Ch7）',rEpic(),{current:true}),
  V('r-epic','r-epic:low','基礎値110〜132・Ch7',rEpic({min:110,max:132})),
  V('r-epic','r-epic:ch6','基礎値136〜160・Ch6',rEpic({ch:6})),
  V('r-epic','r-epic:low-ch6','組み合わせ：基礎値110〜132・Ch6',rEpic({min:110,max:132,ch:6}),{combo:true}),
  V('r-legendary','r-legendary:now','今の形（盾30）',rLegendary(),{current:true}),
  V('r-legendary','r-legendary:20','盾20',rLegendary({need:20})),
  V('r-legendary','r-legendary:guardfirst','盾30＋盾カードを先に使う動かし方',rLegendary(),{mods:{reikaGuardFirst:true}}),
  V('r-legendary','r-legendary:20-guardfirst','組み合わせ：盾20＋盾カードを先に使う動かし方',rLegendary({need:20}),{mods:{reikaGuardFirst:true},combo:true}),
  V('r-legendary','r-legendary:control-guardfirst','対照：基準の武器（威圧なし）＋盾カードを2枚先に使う動かし方',{owner:'r',rarity:'基準',name:'基準（試作）',base:110,ch:6,guardNeed:30},{mods:{reikaGuardFirst:true},reference:true}),
  V('r-mythic','r-mythic:now','今の形（同じ部位に2連射）',rMythic(),{current:true}),
  V('r-mythic','r-mythic:choose','追加射撃の部位を選べる（選ぶ決まりは1発目と同じ）',rMythic({choose:'rule'})),
  V('r-mythic','r-mythic:other','参考：追加射撃は必ず別の部位へ（推測の解釈）',rMythic({choose:'other'}),{reference:true}),
  // 小春
  V('k-common','k-common:now','今の形（武器技で毒+1・最大HP+10）',kCommon(),{current:true}),
  V('k-common','k-common:card3','カード攻撃+3だけ',kCommon({poison:0,hp:0,card:3})),
  V('k-uncommon','k-uncommon:now','今の形（カード+8・Ch5・武器技の毒+2）',kUncommon(),{current:true}),
  V('k-uncommon','k-uncommon:card5','カード+5',kUncommon({card:5})),
  V('k-uncommon','k-uncommon:ch6','Ch6',kUncommon({ch:6})),
  V('k-uncommon','k-uncommon:nopoison','武器技の毒なし',kUncommon({poison:0})),
  V('k-rare','k-rare:now','a. 今の形（全部位に壊れる量50%）',kRare(),{current:true}),
  V('k-rare','k-rare:b','b. 選んだ部位100%・ほか40%',kRare({mode:'b'})),
  V('k-rare','k-rare:c','c. 今の形＋全部位に毒+1',kRare({mode:'c'})),
  V('k-rare','k-rare:bc','組み合わせ：b＋全部位に毒+1',kRare({mode:'bc'}),{combo:true}),
  V('k-epic','k-epic:now','今の形（毒+12）',kEpic(),{current:true}),
  V('k-epic','k-epic:18','毒+18',kEpic({poison:18})),
  V('k-legendary','k-legendary:now','今の形（針1本ごとに毒+2）',kLegendary(),{current:true}),
  V('k-legendary','k-legendary:3','針1本ごとに毒+3',kLegendary({per:3})),
  V('k-mythic','k-mythic:now','今の形（毒がすべて疫毒）',kMythic(),{current:true}),
  V('k-mythic','k-mythic:wp2','武器技で疫毒+2',kMythic({weaponPoison:2})),
  V('k-mythic','k-mythic:plus1','小春が付ける毒の数+1',kMythic({plusOne:true})),
  V('k-mythic','k-mythic:wp2-plus1','組み合わせ：武器技で疫毒+2＋毒の数+1',kMythic({weaponPoison:2,plusOne:true}),{combo:true}),
];
// Koharu poison-first policy: every Koharu weapon (current form) once more with the policy addition.
for(const v of VARIANTS.filter(v=>v.current&&v.group.startsWith('k-')))
  VARIANTS.push({...v,id:v.id.replace(':now',':poisonfirst'),label:'今の形＋毒をためるカードを優先する動かし方',current:false,mods:{koharuPoisonFirst:true}});
// Koharu poison-first with the prototype weapon (policy effect alone).
VARIANTS.push(V('k-base','k-base:poisonfirst','対照：基準の武器＋毒をためるカードを優先する動かし方',{owner:'k',rarity:'基準',name:'基準（試作）',base:100,ch:6},{mods:{koharuPoisonFirst:true},reference:true}));
VARIANTS.push(V('k-base','k-base:now','対照：基準の武器（いつもの動かし方）',{owner:'k',rarity:'基準',name:'基準（試作）',base:100,ch:6},{current:true,reference:true}));
VARIANTS.push(V('r-base','r-base:now','対照：基準の武器（いつもの動かし方）',{owner:'r',rarity:'基準',name:'基準（試作）',base:110,ch:6},{current:true,reference:true}));

module.exports={VARIANTS,factories:{mCommon,mUncommon,mRare,mEpic,mLegendary,mMythic,rCommon,rUncommon,rRare,rEpic,rLegendary,rMythic,kCommon,kUncommon,kRare,kEpic,kLegendary,kMythic},withPlainRef};
