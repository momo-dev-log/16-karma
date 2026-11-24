'use strict';
// Stage 2: check that each variant's effect does exactly what it says, on hand-made battle states.
// Usage: node sim/check_stage2.js
const assert=require('node:assert/strict');
const {Battle}=require('./engine');
const {BASELINE,makeWeapon}=require('./weapons');
const {factories:F,withPlainRef}=require('./variants');

let checks=0;const ok=(msg,cond,detail)=>{assert(cond,msg+(detail!==undefined?' '+JSON.stringify(detail):''));checks++;console.log('OK  '+msg+(detail!==undefined?'  '+JSON.stringify(detail):''));};
function make(def,mods){const w={m:{...BASELINE.m},r:{...BASELINE.r},k:{...BASELINE.k}};if(def)w[def.owner]=makeWeapon(withPlainRef(def),5);
  const b=new Battle({seed:1,policy:'defense',hpScale:10,breakScale:10,mods,weapons:w,log:true});return b;}
const fire=(b,id)=>{const c=b.chars[id];c.charge=c.weapon.ch;b.fireWeapon(c);return c;};
const hpLoss=(b,fn)=>{const h=b.boss.hp;fn();return h-b.boss.hp;};

// 美桜
{const b=make(F.mMythic());const c=b.chars.m;c.ws.bites=5;const d=hpLoss(b,()=>fire(b,'m'));ok('食い込み（たまる）：武器技 107+5×10、あと1つ残る',d===157&&c.ws.bites===1,{d,bites:c.ws.bites});}
{const b=make(F.mMythic({regain:false}));const c=b.chars.m;c.ws.bites=5;fire(b,'m');ok('食い込み（たまらない）：武器技のあと0',c.ws.bites===0);}
{const b=make(F.mMythic({ch:6}));ok('食い込み Ch6',b.chars.m.weapon.ch===6);}
{const b=make(F.mRare({p:70}));const d=hpLoss(b,()=>fire(b,'m'));ok('双刃 70%：2回で floor(106×0.7)×2=148',d===148,d);}
{const b=make(F.mRare());const d=hpLoss(b,()=>fire(b,'m'));ok('双刃 60%：2回で floor(106×0.6)×2=126',d===126,d);}
{const b=make(F.mUncommon({card:5}));const c=b.chars.m;const d=hpLoss(b,()=>b.playCard(c,0));ok('逆棘 カード+5：怒りを宿す刃 50+5',d===55,d);}
{const b=make(F.mUncommon({ch:6}));ok('逆棘 Ch6',b.chars.m.weapon.ch===6);}
{const b=make(F.mLegendary({ch:6}));ok('往復刃 Ch6',b.chars.m.weapon.ch===6);}
{const b=make(F.mCommon({hp:0,card:3}));const c=b.chars.m;const d=hpLoss(b,()=>b.playCard(c,0));ok('デコ・ミニチェンソー カード+3・最大HP 110のまま',d===53&&c.max===110,{d,max:c.max});}
// 麗華
{const b=make(F.rCommon({hp:0,card:3}));const c=b.chars.r;const d=hpLoss(b,()=>b.playCard(c,0));ok('クラシック カード+3・最大HP 95のまま',d===53&&c.max===95,{d,max:c.max});}
{const b=make(F.rRare({p:20}));const c=b.chars.r;fire(b,'r');const part=c.ws.mark.part;const d=hpLoss(b,()=>b.playCard(c,0));ok('銀線 印+20%：高貴なる一閃 50+10',d===60&&b.choosePart()===part,d);}
{const b=make(F.rEpic({min:110,max:132}));ok('蓄圧 基礎値110〜132 → 品質5で119',b.chars.r.weapon.base===119&&b.chars.r.weapon.ch===7);}
{const b=make(F.rEpic({ch:6}));ok('蓄圧 基礎値146・Ch6',b.chars.r.weapon.base===146&&b.chars.r.weapon.ch===6);}
{const b=make(F.rLegendary({need:20}));const c=b.chars.r;c.guard=20;b.foes.forEach(f=>f.targets=['m']);const d=hpLoss(b,()=>fire(b,'r'));ok('威圧 盾20：盾20で+25%（117+29）',d===146&&b.curFire.intimidate===25,{d,bonus:b.curFire.intimidate});}
{const b=make(F.rLegendary({need:20}));const c=b.chars.r;c.guard=20;b.foes.forEach(f=>f.targets=['r']);b.foes[1].wait=2;const fc=b.forecastTo('r');const d=hpLoss(b,()=>fire(b,'r'));ok('威圧 盾20：狙われていて盾≧予告合計なら+60%（117+70）',fc<=20&&d===187&&b.curFire.intimidate===60,{fc,d});}
{const b=make(F.rLegendary());const c=b.chars.r;c.guard=29;const d=hpLoss(b,()=>fire(b,'r'));ok('威圧 盾30：盾29では上乗せなし',d===117,d);}
{const b=make(F.rLegendary(),{reikaGuardFirst:true});const c=b.chars.r;b.allyTurn(c);const lines=b.lines.filter(l=>l.includes('麗華：'));ok('盾カードを先に使う：麗華は揺るがぬ余裕を2枚（盾40）使ってから攻撃',lines[0].includes('揺るがぬ余裕')&&lines[1].includes('揺るがぬ余裕')&&!lines[2].includes('揺るがぬ余裕'),lines.map(l=>l.slice(3,20)));}
{const b=make(F.rLegendary({need:20}),{reikaGuardFirst:true});const c=b.chars.r;b.allyTurn(c);const n=b.lines.filter(l=>l.includes('麗華：揺るがぬ余裕')).length;ok('盾カードを先に使う（盾20）：揺るがぬ余裕は1枚',n===1,n);}
{const b=make(F.rMythic({choose:true}));const c=b.chars.r;b.foes[2].breakDamage=b.foes[2].breakLimit-50;// part 2 is closest to breaking
 const part=b.choosePart();c.charge=c.weapon.ch;b.fireWeapon(c);const l=b.lines.filter(x=>x.includes('→')&&x.includes('麗華'));ok('女王（選べる）：1発目で灰が壊れ、2発目は80%で壊れた灰へ（選ぶ決まりどおり）',part===2&&l.length===2&&l[1].includes('灰'),l.map(x=>x.slice(3,30)));}
{const b=make(F.rMythic({choose:true}));const c=b.chars.r;b.foes[0].broken=true;b.foes[1].breakDamage=10;c.charge=c.weapon.ch;b.fireWeapon(c);const l=b.lines.filter(x=>x.includes('→')&&x.includes('麗華'));ok('女王（選べる）：壊れた部位があれば2発目もそこへ',l.every(x=>x.includes('禍')),l.map(x=>x.slice(3,30)));}
{const b=make(F.rMythic({choose:'other'}));const c=b.chars.r;c.charge=c.weapon.ch;b.fireWeapon(c);const l=b.lines.filter(x=>x.includes('→')&&x.includes('麗華'));ok('女王（参考・別の部位）：2発目は1発目と違う部位',l.length===2&&l[0].split(' ')[3]!==l[1].split(' ')[3],l.map(x=>x.slice(3,30)));}
{const w={owner:'r',rarity:'基準',name:'基準（試作）',base:110,ch:6,guardNeed:30};const b=make(w,{reikaGuardFirst:true});b.allyTurn(b.chars.r);const n=b.lines.filter(l=>l.includes('麗華：揺るがぬ余裕')).length;ok('対照：基準の武器でも盾カードを2枚先に使う',n===2,n);}
// 小春
{const b=make(F.kRare({mode:'bc'}));const part=b.choosePart();fire(b,'k');ok('散華 b＋毒：選んだ部位+101・ほか+40・全部位に毒+1',b.foes.every((f,i)=>f.breakDamage===(i===part?101:40)&&f.poison===1));}
{const b=make(F.kMythic({weaponPoison:2,plusOne:true}));fire(b,'k');ok('疫病 組み合わせ：武器技で疫毒2+1=3',b.foes.reduce((a,f)=>a+f.plague,0)===3);}
{const b=make(F.kCommon({poison:0,hp:0,card:3}));const c=b.chars.k;fire(b,'k');const d=hpLoss(b,()=>b.playCard(c,1));ok('花毒 カード+3だけ：武器技の毒なし・最大HP 90・花の囁き 45',b.foes.every(f=>f.poisonBy.weapon===0)&&c.max===90&&d===45,{d});}
{const b=make(F.kUncommon({poison:0}));fire(b,'k');ok('深翠 毒なし：武器技で毒が付かない',b.foes.every(f=>f.poison===0));}
{const b=make(F.kUncommon({card:5}));const d=hpLoss(b,()=>b.playCard(b.chars.k,1));ok('深翠 カード+5：花の囁き 42+5',d===47,d);}
{const b=make(F.kUncommon({ch:6}));ok('深翠 Ch6',b.chars.k.weapon.ch===6);}
{const b=make(F.kRare({mode:'b'}));const part=b.choosePart();const d=hpLoss(b,()=>fire(b,'k'));const br=b.foes.map(f=>f.breakDamage);ok('散華 b：共有HP−101、選んだ部位+101・ほか+40',d===101&&br[part]===101&&br.filter((x,i)=>i!==part).every(x=>x===40),{d,br});}
{const b=make(F.kRare({mode:'c'}));const d=hpLoss(b,()=>fire(b,'k'));ok('散華 c：共有HP−101、全部位に壊れる量+50・毒+1',d===101&&b.foes.every(f=>f.breakDamage===50&&f.poison===1),{d,br:b.foes.map(f=>[f.breakDamage,f.poison])});}
{const b=make(F.kRare());b.foes[0].broken=true;const d=hpLoss(b,()=>fire(b,'k'));ok('散華 a：壊れた部位があっても1.2倍なし（−101）',d===101,d);}
{const b=make(F.kEpic({poison:18}));fire(b,'k');ok('残毒 +18',b.foes.reduce((a,f)=>a+f.poison,0)===18);}
{const b=make(F.kLegendary({per:3}));const d=hpLoss(b,()=>fire(b,'k'));ok('群針 1本+3：3本で毒9・ダメージ floor(103×0.4)×3=123',b.foes.reduce((a,f)=>a+f.poison,0)===9&&d===123,{d});}
{const b=make(F.kMythic({weaponPoison:2}));fire(b,'k');ok('疫病 武器技で疫毒+2',b.foes.reduce((a,f)=>a+f.plague,0)===2&&b.foes.every(f=>f.poison===0));}
{const b=make(F.kMythic({plusOne:true}));b.playCard(b.chars.k,1);b.playCard(b.chars.k,0);ok('疫病 毒の数+1：花の囁き 1+1、嫉妬の毒針 2+1 → 疫毒5',b.foes.reduce((a,f)=>a+f.plague,0)===5);}
{const b=make(F.kMythic());b.foes[0].plague=3;b.foes[0].plagueBy.card=3;const h=b.boss.hp;b.foes.forEach(f=>f.targets=[]);b.endTurn();ok('疫毒は毒の2倍で削る（疫毒3 → −6）',h-b.boss.hp===6&&Math.abs(b.st.plagueExtra-3)<1e-9,{loss:h-b.boss.hp,extra:b.st.plagueExtra});}
{const b=make(null,{koharuPoisonFirst:true});b.policy='attack';b.allyTurn(b.chars.k);const n=b.lines.filter(l=>l.includes('小春：嫉妬の毒針')).length;ok('毒をためる動かし方：小春は嫉妬の毒針（毒2）を3枚',n===3,n);}
{const b=make(null);b.policy='attack';b.allyTurn(b.chars.k);const n=b.lines.filter(l=>l.includes('小春：花の囁き')).length;ok('いつもの動かし方：小春は花の囁きを3枚',n===3,n);}
// records
{const b=make(F.mLegendary());b.playCard(b.chars.m,0);ok('記録：往復刃の追撃（回数1・ダメージ16）',b.st.effects.m['追撃'].count===1&&b.st.effects.m['追撃'].extra===16,b.st.effects.m);}
{const b=make(F.mUncommon());b.playCard(b.chars.m,0);ok('記録：カード攻撃の上乗せ +8',b.st.effects.m['カード攻撃の上乗せ'].extra===8,b.st.effects.m);}
{const b=make(F.kEpic());const c=b.chars.k;fire(b,'k');b.foes.forEach(f=>f.targets=[]);b.endTurn();ok('記録：武器技の毒のダメージを武器の分として数える',Math.abs(b.st.poisonDmg.weapon-12)<1e-9,b.st.poisonDmg);}
{const b=make(F.rLegendary());b.chars.r.guard=33;fire(b,'r');ok('記録：武器技の時の盾',b.st.fires.r[0].guard===33);}
{const b=make(null);b.addStatus(b.chars.m,'stun',1,2);b.allyTurn(b.chars.m);ok('記録：スタンで動けなかったターン',b.st.stunLost.m===1);}
console.log(`PASS ${checks} checks`);
