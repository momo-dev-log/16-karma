'use strict';
// Battle engine for the weapon simulator.
// Rules are ported from ../index.html (functions named in the comments). Weapon effects are hooks in weapons.js.
// Anything the game code does not define is marked "ASSUMPTION" and listed in README.md.

// ---- deterministic RNG (mulberry32) ----
function makeRng(seed){
  let a=seed>>>0;
  return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

const IDS=['m','r','k'];
const NAMES={m:'美桜',r:'麗華',k:'小春'};
const AILMENT_NAMES={burn:'火傷',stun:'スタン',curse:'呪詛',shock:'感電',frost:'凍傷',poison:'毒'};
// index.html cardList: the first 4 cards of each character form the hand (chars.*.cards). Cards are not consumed.
// [id, name, cost, damage, effect]
const HANDS={
  m:[['M1','怒りを宿す刃',1,50,'hit'],['M2','逆上',1,40,'ifM'],['M3','庇護の怒り',1,40,'ifAlly'],['M4','反骨',1,35,'guard15']],
  r:[['R1','高貴なる一閃',1,50,'hit'],['R2','揺るがぬ余裕',1,35,'guard20'],['R3','格の違い',1,40,'weaken10'],['R4','優雅なる強襲',2,110,'hit']],
  k:[['K1','嫉妬の毒針',1,30,'poison2'],['K2','花の囁き',1,42,'poison1'],['K3','毒を含む囁き',1,35,'poisonweak'],['K4','茨の盾',1,25,'poisonguard']]
};
// Guard amount per effect, as implemented in play(): guard15 +15, guard20 +20, poisonguard +25.
const CARD_GUARD={guard15:15,guard20:20,poisonguard:25};
// Poison per effect, as implemented in play(): poison1/poisonweak/poisonguard +1, poison2 +2.
const CARD_POISON={poison1:1,poisonweak:1,poisonguard:1,poison2:2};
const CARD_WEAK={weaken10:10,poisonweak:8};
const CURSE_DAMAGE={0:0,1:2,2:5,3:9}; // index.html CURSE_DAMAGE
const BASE_ALLIES={m:{hp:110},r:{hp:95},k:{hp:90}};
// index.html foes
const BASE_FOES=[
  {name:'禍',interval:1,wait:1,damage:12,target:'m',ailments:['burn','stun'],breakLimit:180},
  {name:'呪',interval:2,wait:2,damage:24,target:'r',ailments:['curse','shock'],breakLimit:220},
  {name:'灰',interval:1,wait:1,damage:8,target:'k',ailments:['frost','poison'],breakLimit:180}
];

class Battle{
  // opts: {seed, policy:'attack'|'defense', bossScale, weapons:{m,r,k} (from weapons.js), log:boolean, maxTurns, poisonValue}
  constructor(opts){
    this.rng=makeRng(opts.seed);
    this.policy=opts.policy;
    this.maxTurns=opts.maxTurns||100;
    this.poisonValue=opts.poisonValue??3;
    this.logOn=!!opts.log;this.lines=[];this.actions=[];
    this.turn=1;this.ended=false;this.won=false;
    const s=opts.bossScale||1;
    this.boss={hp:420*s,max:420*s};
    this.foes=BASE_FOES.map(f=>({...f,breakLimit:f.breakLimit*s,breakDamage:0,broken:false,stunned:false,poison:0,plague:0,weak:0,statuses:{},targets:[],attackKind:'single'}));
    this.chars={};
    for(const id of IDS){
      const w=opts.weapons[id];
      const hp=BASE_ALLIES[id].hp+(w.maxHp||0);
      this.chars[id]={id,name:NAMES[id],hp,max:hp,cost:3,guard:0,charge:0,poison:0,statuses:{},weapon:w,ws:{}};
      if(w.init)w.init(this,this.chars[id]);
    }
    this.stats={damage:{m:0,r:0,k:0},weaponUses:{m:0,r:0,k:0}};
    this.chooseNextTargets();
  }
  log(s){if(this.logOn)this.lines.push(`T${this.turn} ${s}`);}

  // ---- statuses: statusBag / addStatus / statusPower / tickStatuses ----
  addStatus(u,key,power,turns){
    if(!u||u.hp<=0)return;
    const old=u.statuses[key];
    u.statuses[key]={...old,power:Math.max(0,(old?.power||0)+power),turns:Math.max(old?.turns||0,turns)};
  }
  sp(u,key){return u.statuses[key]?.power||0;}
  tick(u){for(const [k,v] of Object.entries(u.statuses)){v.turns--;if(v.turns<=0)delete u.statuses[k];}}
  // modifiedDamage(base, attacker, target): frost on the attacker, burn on the target, Math.round (code rounding).
  modifiedDamage(base,attacker,target){return Math.max(0,Math.round(Math.max(0,base-this.sp(attacker,'frost'))*(1+this.sp(target,'burn')/100)));}
  isElectroBlocked(c,cardId){const s=c.statuses.shock;return !!s&&(s.blockedCards?.includes(cardId)||s.blockedAllCards===true);}

  // ---- enemy targeting: chooseNextTargets / pickTargets / attackTargets ----
  living(){return IDS.filter(id=>this.chars[id].hp>0);}
  pickTargets(pool,count){
    const left=[...pool],picked=[];
    while(picked.length<count&&left.length){
      const total=left.length;let roll=this.rng()*total,index=0; // targetWeight(id)=1 for everyone
      while(index<left.length-1&&(roll-=1)>=0)index++;
      picked.push(...left.splice(index,1));
    }
    return picked.sort((a,b)=>IDS.indexOf(a)-IDS.indexOf(b));
  }
  chooseNextTargets(){
    const alive=this.living();
    this.foes.forEach((f,i)=>{
      if(!alive.length){f.targets=[];return;}
      const mode=(this.turn+i)%4;
      f.attackKind=mode===0?'all':mode===1?'range':'single';
      if(f.attackKind==='all')f.targets=[...alive];
      else if(f.attackKind==='range')f.targets=this.pickTargets(alive,2);
      else f.targets=this.pickTargets(alive,1);
    });
  }
  attackTargets(f){return f.targets.filter(id=>this.chars[id].hp>0);}
  dueParts(){return this.foes.map((f,i)=>i).filter(i=>{const f=this.foes[i];return this.boss.hp>0&&!f.stunned&&f.wait<=1&&!this.sp(f,'stun');});}
  // Forecast damage to one ally this turn (what the "被弾 N" badge sums).
  forecastTo(id){
    const c=this.chars[id];let sum=0;
    for(const i of this.dueParts()){const f=this.foes[i];if(this.attackTargets(f).includes(id))sum+=this.modifiedDamage(Math.max(0,f.damage-(f.weak||0)),f,c);}
    return sum;
  }

  // ---- player damage: playerAttack ----
  // opts.noBroken: all-part hits skip the broken 1.2x. opts.breakAmount: override break progress.
  hitPart(n,ownerId,partIndex,opts={}){
    if(this.ended)return {dealt:0,broke:false};
    const foe=this.foes[partIndex];
    const dealt=(!opts.noBroken&&foe.broken)?Math.round(n*1.2):n; // code: Math.round(n*1.2)
    const before=this.boss.hp;this.boss.hp=Math.max(0,this.boss.hp-dealt);
    const actual=before-this.boss.hp;this.stats.damage[ownerId]+=actual;
    let broke=false;
    if(!opts.skipBreak)broke=this.addBreak(partIndex,opts.breakAmount??dealt);
    this.log(`${NAMES[ownerId]} → ${foe.name} ${dealt}${foe.broken&&!broke&&!opts.noBroken?'（壊れた部位1.2倍）':''}${broke?' 【部位破壊】':''} 共有HP ${this.boss.hp}`);
    if(this.boss.hp===0)this.finish(true);
    return {dealt,broke,actual};
  }
  addBreak(partIndex,amount){
    const foe=this.foes[partIndex];
    if(foe.broken)return false;
    foe.breakDamage=Math.min(foe.breakLimit,foe.breakDamage+amount);
    if(foe.breakDamage>=foe.breakLimit){foe.broken=true;foe.stunned=true;foe.wait=foe.interval;return true;}
    return false;
  }
  finish(won){if(!this.ended){this.ended=true;this.won=won;this.endTurnNo=this.turn;this.log(won?'勝利':'敗北');}}

  // ---- target choice (policy, not game code) ----
  // Once a part is broken, keep hitting a broken part (1.2x); otherwise the unbroken part closest to breaking.
  choosePart(){
    const broken=this.foes.map((f,i)=>i).filter(i=>this.foes[i].broken);
    if(broken.length)return broken[0]; // ASSUMPTION: several broken parts -> lowest index
    let best=0,bestKey=null;
    this.foes.forEach((f,i)=>{const key=[f.breakDamage/f.breakLimit,-(f.breakLimit-f.breakDamage)];
      if(bestKey===null||key[0]>bestKey[0]||key[0]===bestKey[0]&&key[1]>bestKey[1]){best=i;bestKey=key;}});
    return best;
  }

  // ---- cards: play() ----
  cardBaseDamage(c,card){
    const [,, ,dmg,effect]=card;let damage=dmg;
    // play(): ifM / ifAlly read the static foe.target field ('m','r','k'), not the forecast targets.
    if(effect==='ifM'&&this.foes.some(f=>this.boss.hp>0&&f.target==='m'&&f.wait===1))damage+=20;
    if(effect==='ifAlly'&&this.foes.some(f=>this.boss.hp>0&&f.target!=='m'&&f.wait===1))damage+=20;
    if(c.weapon.cardBonus)damage+=c.weapon.cardBonus(this,c,card);
    return damage;
  }
  cardPlayable(c,i){
    const card=HANDS[c.id][i];
    return !this.ended&&c.hp>0&&c.cost>=card[2]&&!this.sp(c,'stun')&&!this.isElectroBlocked(c,card[0]);
  }
  playCard(c,i){
    const card=HANDS[c.id][i];const [cardId,name,cost,,effect]=card;
    c.cost-=cost;c.charge=Math.min(c.weapon.ch,c.charge+cost);
    // applyCurseOnCard
    const curse=this.sp(c,'curse');
    if(curse&&cost){const loss=Math.min(c.hp,(CURSE_DAMAGE[cost]||0)*curse);c.hp-=loss;this.log(`${c.name} 呪詛 −${loss}（HP ${c.hp}）`);}
    const part=this.choosePart(),foe=this.foes[part];
    this.actions.push({t:'card',id:c.id,i,part});
    if(c.hp<=0){this.log(`${c.name} 倒れた（呪詛）`);this.afterCard(c);return;}
    let damage=this.cardBaseDamage(c,card);
    const g=CARD_GUARD[effect];if(g)c.guard+=g+(c.weapon.guardBonus||0);
    if(CARD_WEAK[effect])foe.weak=(foe.weak||0)+CARD_WEAK[effect];
    if(CARD_POISON[effect])this.addPoison(c,part,CARD_POISON[effect]);
    damage=this.modifiedDamage(damage,c,foe); // foe never has burn here
    if(c.weapon.cardDamage)damage=c.weapon.cardDamage(this,c,part,damage);
    this.log(`${c.name}：${name}（Cost${cost}）${g?` 盾+${g+(c.weapon.guardBonus||0)}`:''}${CARD_POISON[effect]?` 毒+${CARD_POISON[effect]}`:''} チャージ${c.charge}/${c.weapon.ch}`);
    const res=this.hitPart(damage,c.id,part);
    if(c.weapon.afterCardHit)c.weapon.afterCardHit(this,c,part,damage,res);
    this.afterCard(c);
  }
  afterCard(c){if(c.weapon.afterCard)c.weapon.afterCard(this,c);}
  addPoison(c,part,n){
    // Poison is stored per part (foe.poison) in index.html; Koharu's mythic turns it into plague.
    if(c.weapon.plague)this.foes[part].plague+=n;else this.foes[part].poison+=n;
  }

  // ---- weapon: render() #weaponuse handler ----
  weaponReady(c){return !this.ended&&c.hp>0&&c.charge>=c.weapon.ch&&!this.sp(c,'stun')&&!this.sp(c,'shock');}
  fireWeapon(c){
    c.charge=0;this.stats.weaponUses[c.id]++;
    this.log(`${c.name} 武器技「${c.weapon.name}」`);
    if(c.weapon.fire)c.weapon.fire(this,c);
    else{const part=this.choosePart();this.actions.push({t:'weapon',id:c.id,part});this.hitPart(c.weapon.base,c.id,part);}
    if(c.weapon.afterFire)c.weapon.afterFire(this,c);
  }

  // ---- ally turn (policy) ----
  cardValue(c,i){
    const card=HANDS[c.id][i];
    const pois=CARD_POISON[card[4]]||0;
    return this.cardBaseDamage(c,card)+pois*this.poisonValue*(c.weapon.plague?2:1);
  }
  bestCard(c,kind){
    let best=-1,bestKey=null;
    HANDS[c.id].forEach((card,i)=>{
      const isGuard=!!CARD_GUARD[card[4]];
      if(kind==='guard'!==isGuard||!this.cardPlayable(c,i))return;
      const v=kind==='guard'?CARD_GUARD[card[4]]:this.cardValue(c,i);
      const key=[v/card[2],v,-i];
      if(bestKey===null||key[0]>bestKey[0]||key[0]===bestKey[0]&&(key[1]>bestKey[1]||key[1]===bestKey[1]&&key[2]>bestKey[2])){best=i;bestKey=key;}
    });
    return best;
  }
  allyTurn(c){
    if(c.hp<=0)return;
    const fireIfReady=()=>{while(this.weaponReady(c))this.fireWeapon(c);};
    fireIfReady();
    if(this.policy==='defense'&&this.attackTargetsAny(c.id)&&this.forecastTo(c.id)>=10){
      const g=this.bestCard(c,'guard');if(g>=0&&!this.ended){this.playCard(c,g);fireIfReady();}
    }
    for(const kind of ['attack','guard']){
      while(!this.ended){const i=this.bestCard(c,kind);if(i<0)break;this.playCard(c,i);fireIfReady();}
    }
  }
  attackTargetsAny(id){return this.dueParts().some(i=>this.attackTargets(this.foes[i]).includes(id));}

  // ---- enemy phase: $('end').onclick ----
  endTurn(){
    this.actions.push({t:'end'});
    for(const id of IDS){const w=this.chars[id].weapon;if(w.endPlayerPhase)w.endPlayerPhase(this,this.chars[id]);}
    const due=this.dueParts().map(i=>({f:this.foes[i],i}));
    const incoming={},dueTargets=new Map();
    for(const {f,i} of due){const ids=this.attackTargets(f);dueTargets.set(i,ids);ids.forEach(id=>incoming[id]=(incoming[id]||0)+this.modifiedDamage(Math.max(0,f.damage-(f.weak||0)),f,this.chars[id]));}
    const hits=Object.entries(incoming).map(([id,n])=>{const c=this.chars[id],blocked=Math.min(c.guard,n),actual=Math.min(c.hp,n-blocked);return {id,n,c,blocked,actual};});
    for(const h of hits){h.c.guard-=h.blocked;h.c.hp=Math.max(0,h.c.hp-h.actual);this.log(`敵 → ${h.c.name} ${h.n}${h.blocked?`（盾${h.blocked}）`:''} → −${h.actual}（HP ${h.c.hp}）`);}
    // poison per part, then wait / stun bookkeeping
    this.foes.forEach(f=>{
      const tick=f.poison+2*f.plague; // plague = 2x poison (simulator rule, not in index.html)
      if(this.boss.hp>0&&tick>0){const loss=Math.min(this.boss.hp,tick);this.boss.hp-=loss;this.stats.damage.k+=loss;this.log(`${f.name} 毒${f.poison}${f.plague?`・疫毒${f.plague}`:''} → −${loss} 共有HP ${this.boss.hp}`);}
      f.weak=0;
      const wasStunned=!!f.stunned||!!this.sp(f,'stun');
      this.tick(f);
      if(f.stunned){f.stunned=false;f.wait=f.interval;}
      else if(this.boss.hp>0&&!wasStunned)f.wait=f.wait<=1?f.interval:f.wait-1;
    });
    if(this.boss.hp===0)this.finish(true);
    this.turn++;
    for(const c of Object.values(this.chars)){
      if(c.poison>0){c.hp=Math.max(0,c.hp-c.poison);this.log(`${c.name} 毒 −${c.poison}（HP ${c.hp}）`);}
      this.tick(c);c.cost=c.hp>0?3:0;c.guard=0;
    }
    this.chooseNextTargets();
    for(const {f,i} of due){
      for(const id of dueTargets.get(i)||[]){
        const h=hits.find(h=>h.id===id);
        if(!h||h.actual<=0||h.c.hp<=0)continue;
        const key=f.ailments[(this.turn-2)%f.ailments.length];
        if(key==='poison')h.c.poison+=2;
        else{this.addStatus(h.c,key,key==='burn'?25:key==='frost'?10:1,2);if(key==='shock')h.c.statuses.shock.blockedCards=[{m:'M1',r:'R1',k:'K1'}[id]];}
        this.log(`${h.c.name}：${AILMENT_NAMES[key]}`);
      }
    }
    if(!this.ended&&IDS.every(id=>this.chars[id].hp===0))this.finish(false);
    for(const id of IDS){const w=this.chars[id].weapon;if(w.newTurn)w.newTurn(this,this.chars[id]);}
  }

  snapshot(){
    return {turn:this.turn,boss:this.boss.hp,
      chars:IDS.map(id=>{const c=this.chars[id];return [c.hp,c.guard,c.cost,c.charge,c.poison,JSON.stringify(Object.keys(c.statuses).sort().map(k=>[k,c.statuses[k].power,c.statuses[k].turns]))];}),
      foes:this.foes.map(f=>[f.breakDamage,f.broken,!!f.stunned,f.wait,f.poison,f.targets.join(',')])};
  }
  run(){
    while(!this.ended&&this.turn<=this.maxTurns){
      this.log(`--- ターン開始 共有HP ${this.boss.hp} / 味方HP ${IDS.map(id=>this.chars[id].hp).join('・')} / 予告 ${this.foes.map((f,i)=>this.dueParts().includes(i)?`${f.name}→${this.attackTargets(f).map(x=>NAMES[x]).join('・')}`:`${f.name}:${f.stunned?'破壊で停止':'予兆'}`).join(' ')}`);
      this.actions.push({t:'snap',s:this.snapshot()});
      for(const id of IDS){if(this.ended)break;this.allyTurn(this.chars[id]);}
      if(this.ended)break;
      this.endTurn();
    }
    if(!this.ended)this.log('ターン上限で打ち切り');
    return {
      won:this.won,turns:this.ended?this.endTurnNo:this.maxTurns,timeout:!this.ended,
      damage:{...this.stats.damage},weaponUses:{...this.stats.weaponUses},
      endHp:IDS.map(id=>this.chars[id].hp),lines:this.lines,actions:this.actions
    };
  }
}

module.exports={Battle,makeRng,IDS,NAMES,HANDS,BASE_FOES};
