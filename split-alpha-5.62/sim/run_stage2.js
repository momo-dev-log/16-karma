'use strict';
// Stage 2 runner: weapon variants (variants.js), defense policy, quality 5.
// Conditions: base = boss HP x10 and break limits x10 (HP 4,200); aux = HP x10, break limits x3.
// Usage (from split-alpha-5.62/):
//   node sim/run_stage2.js                      all variants, 2,000 battles each -> sim/output-stage2/
//   node sim/run_stage2.js --battles 500 --only m-mythic,r-mythic
//   node sim/run_stage2.js --log m-mythic:ch6 --cond base --seed 1000     full log of one battle
//   node sim/run_stage2.js --check-current      "current" variants vs weapons.js (stage 1), battle by battle
const fs=require('node:fs'),path=require('node:path');
const {Battle,IDS,NAMES,HANDS}=require('./engine');
const {WEAPONS,BASELINE,makeWeapon}=require('./weapons');
const {VARIANTS}=require('./variants');

const args=process.argv.slice(2);const opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};const flag=n=>args.includes('--'+n);
const BATTLES=Number(opt('battles',2000)),SEED0=Number(opt('seed0',1000)),QUALITY=5,POLICY='defense',MAX_TURNS=100;
const CONDS={base:{label:'基準：HP4,200・壊れる量10倍',hpScale:10,breakScale:10},aux:{label:'補助：HP4,200・壊れる量3倍',hpScale:10,breakScale:3}};
const CARD_NAMES=Object.fromEntries(Object.values(HANDS).flat().map(c=>[c[0],c[1]]));

function team(def){const w={m:{...BASELINE.m},r:{...BASELINE.r},k:{...BASELINE.k}};if(def)w[def.owner]=makeWeapon(def,QUALITY);return w;}
function battle(def,cond,seed,mods,log){return new Battle({seed,policy:POLICY,hpScale:cond.hpScale,breakScale:cond.breakScale,mods,weapons:team(def),log,maxTurns:MAX_TURNS}).run();}

// ---- single battle log ----
if(opt('log')){
  const id=opt('log'),v=id==='base'?null:VARIANTS.find(x=>x.id===id);
  if(id!=='base'&&!v){console.error('unknown variant: '+id+'\n'+VARIANTS.map(v=>v.id).join('\n'));process.exit(1);}
  const r=battle(v?.def,CONDS[opt('cond','base')],Number(opt('seed',SEED0)),v?.mods,true);
  console.log(r.lines.join('\n'));process.exit(0);
}
// ---- current variants must equal stage-1 weapons ----
if(flag('check-current')){
  let bad=0,n=0;
  for(const v of VARIANTS.filter(v=>v.current)){
    const old=WEAPONS.find(w=>w.key===v.group);
    for(const cond of Object.values(CONDS))for(let s=0;s<200;s++){
      const a=battle(v.def,cond,SEED0+s),b=new Battle({seed:SEED0+s,policy:POLICY,hpScale:cond.hpScale,breakScale:cond.breakScale,weapons:team(old),maxTurns:MAX_TURNS}).run();
      n++;if(JSON.stringify([a.won,a.turns,a.damage,a.endHp,a.weaponUses])!==JSON.stringify([b.won,b.turns,b.damage,b.endHp,b.weaponUses])){bad++;if(bad<5)console.log('DIFF',v.id,s);}
    }
  }
  console.log(`current variants vs weapons.js: ${n} battles compared, ${bad} differ`);process.exit(bad?1:0);
}

// ---- measure ----
function measure(def,cond,mods,owner){
  const agg={wins:[],turnsWin:0,turnsAll:0,uses:0,endHp:0,ownerDmg:0,effects:{},cards:{m:{},r:{},k:{}},breaks:0,firstBreak:0,firstBreakN:0,partBreaks:[0,0,0],breakAt4:0,
    fires:0,bites:0,guard:0,intimidate:0,intimidate60:0,endPoison:0,endPlague:0,kPoison:0,kDirect:0,kTurns:{},poisonBy:{card:0,weapon:0,bonus:0},plagueExtra:0,stunLost:{m:0,r:0,k:0},deadTurns:{m:0,r:0,k:0}};
  for(let n=0;n<BATTLES;n++){
    const r=battle(def,cond,SEED0+n,mods,false),st=r.st;
    agg.wins.push(r.won?1:0);if(r.won)agg.turnsWin+=r.turns;agg.turnsAll+=r.turns;
    agg.uses+=r.weaponUses[owner];agg.endHp+=r.endHp.reduce((a,b)=>a+b,0)/3;agg.ownerDmg+=r.damage[owner]/r.turns;
    for(const [k,e] of Object.entries(st.effects[owner])){const a=agg.effects[k]||(agg.effects[k]={count:0,extra:0});a.count+=e.count;a.extra+=e.extra;}
    for(const id of IDS)for(const [k,c] of Object.entries(st.cards[id]))agg.cards[id][k]=(agg.cards[id][k]||0)+c;
    agg.breaks+=st.breaks.length;if(st.breaks.length){const t=Math.min(...st.breaks.map(b=>b.turn));agg.firstBreak+=t;agg.firstBreakN++;if(t===4)agg.breakAt4++;}
    for(const b of st.breaks)agg.partBreaks[b.part]++;
    for(const f of st.fires[owner]){agg.fires++;agg.bites+=f.bites||0;agg.guard+=f.guard;if(f.intimidate)agg.intimidate++;if(f.intimidate===60)agg.intimidate60++;}
    agg.endPoison+=r.endPoison;agg.endPlague+=r.endPlague;
    const kp=Object.values(st.kTurn).reduce((a,t)=>a+t.poison,0);agg.kPoison+=kp/r.turns;agg.kDirect+=st.direct.k/r.turns;
    for(const [t,v] of Object.entries(st.kTurn)){const a=agg.kTurns[t]||(agg.kTurns[t]={poison:0,direct:0});a.poison+=v.poison;a.direct+=v.direct;}
    for(const k of Object.keys(agg.poisonBy))agg.poisonBy[k]+=st.poisonDmg[k];agg.plagueExtra+=st.plagueExtra;
    for(const id of IDS){agg.stunLost[id]+=st.stunLost[id];agg.deadTurns[id]+=st.deadTurns[id];}
  }
  const N=BATTLES,per=x=>x/N,wins=agg.wins.reduce((a,b)=>a+b,0);
  return {winRate:wins/N,wins:agg.wins,avgTurnsWin:wins?agg.turnsWin/wins:null,avgTurnsAll:agg.turnsAll/N,weaponUses:per(agg.uses),endHp:per(agg.endHp),ownerDmgPerTurn:per(agg.ownerDmg),
    effects:Object.fromEntries(Object.entries(agg.effects).map(([k,e])=>[k,{count:per(e.count),extra:per(e.extra)}])),
    cards:Object.fromEntries(IDS.map(id=>[id,Object.fromEntries(Object.entries(agg.cards[id]).map(([k,c])=>[k,per(c)]))])),
    breaks:per(agg.breaks),breakAt4Rate:per(agg.breakAt4),firstBreakTurn:agg.firstBreakN?agg.firstBreak/agg.firstBreakN:null,battlesWithBreak:agg.firstBreakN/N,partBreakRate:agg.partBreaks.map(per),
    fireBites:agg.fires?agg.bites/agg.fires:null,fireGuard:agg.fires?agg.guard/agg.fires:null,intimidateRate:agg.fires?agg.intimidate/agg.fires:null,intimidate60Rate:agg.fires?agg.intimidate60/agg.fires:null,
    endPoison:per(agg.endPoison),endPlague:per(agg.endPlague),kPoisonPerTurn:per(agg.kPoison),kDirectPerTurn:per(agg.kDirect),
    kTurns:Object.fromEntries(Object.entries(agg.kTurns).filter(([t])=>t<=12).map(([t,v])=>[t,{poison:per(v.poison),direct:per(v.direct)}])),
    poisonBy:Object.fromEntries(Object.entries(agg.poisonBy).map(([k,v])=>[k,per(v)])),plagueExtra:per(agg.plagueExtra),
    stunLost:Object.fromEntries(IDS.map(id=>[id,per(agg.stunLost[id])])),deadTurns:Object.fromEntries(IDS.map(id=>[id,per(agg.deadTurns[id])]))};
}
// Paired comparison on the same seeds: battles won only by A / only by B.
const paired=(a,b)=>{let up=0,down=0;for(let i=0;i<a.length;i++){if(a[i]&&!b[i])up++;else if(!a[i]&&b[i])down++;}return {up,down};};

const only=opt('only')?opt('only').split(','):null;
const list=VARIANTS.filter(v=>!only||only.includes(v.group));
const condKeys=(opt('conds','base,aux')).split(',');
const out=path.resolve(__dirname,opt('out','output-stage2'));fs.mkdirSync(path.join(out,'logs'),{recursive:true});
const results={};
for(const ck of condKeys){
  const cond=CONDS[ck];results[ck]={baseline:{},variants:{}};
  const modsList=[undefined,...new Set(list.filter(v=>v.mods).map(v=>JSON.stringify(v.mods)))];
  for(const m of modsList){const mods=m?JSON.parse(m):undefined;results[ck].baseline[m||'none']=measure(null,cond,mods,'m');}
  for(const v of list){results[ck].variants[v.id]=measure(v.def,cond,v.mods,v.def.owner);process.stderr.write('.');}
  process.stderr.write(`\n${ck} done\n`);
}
// per-variant battle logs (first seed, base condition) for checking that effects work
for(const v of list){const r=battle(v.def,CONDS.base,SEED0,v.mods,true);fs.writeFileSync(path.join(out,'logs',v.id.replace(/:/g,'_')+'.txt'),`${v.group}「${v.def.name}」${v.label}／${CONDS.base.label}／守り優先／品質5／種${SEED0}\n`+r.lines.join('\n')+'\n');}

// ---- report ----
const f0=x=>x==null?'—':x.toFixed(0),f1=x=>x==null?'—':x.toFixed(1),f2=x=>x==null?'—':x.toFixed(2),pc=x=>x==null?'—':(x*100).toFixed(1)+'%';
const sgn=x=>(x>=0?'+':'')+x;
// Effects plus the poison damage that came from weapon effects (tracked by poison source in the engine).
function shownEffects(v,r){const e={...r.effects};
  if(r.poisonBy.weapon>=0.5)e['武器の毒のダメージ']={count:0,extra:r.poisonBy.weapon};
  if(r.poisonBy.bonus>=0.5)e['毒の数+1のダメージ']={count:0,extra:r.poisonBy.bonus};
  if(v.def.plague&&r.plagueExtra>=0.5)e['疫毒（2倍）で増えた分']={count:0,extra:r.plagueExtra};
  return e;}
let md=`# 武器バランス再試算・第2段階\n\n守り優先・品質5・各条件 ${BATTLES} 戦（種 ${SEED0}〜${SEED0+BATTLES-1}、全条件で同じ種）。\n`+
`「勝ち越し」は同じ種で比べて、変更前（今の形）は負けて変更後は勝った戦の数／その逆の数。\n`+
`「4ターン目に最初の破壊」：最初に部位が壊れたのが4ターン目だった戦の割合（4ターン目の禍の「全員・スタン」の攻撃が止まる）。基準の条件では勝敗をほぼ決めている（基準の武器：4ターン目に壊せた戦の勝率90%、5ターン目以降は5%以下）。\n`+
`95%の幅のめやす：勝率70%・2,000戦なら±2.0ポイント（独立な場合）。同じ種で比べているので、差は「勝ち越し」の数で見る方が確か。\n`;
const json={battles:BATTLES,seed0:SEED0,quality:QUALITY,policy:POLICY,conds:{},variants:VARIANTS.map(({def,...v})=>({...v,weapon:def.name,owner:def.owner}))};
for(const ck of condKeys){
  const R=results[ck];json.conds[ck]={label:CONDS[ck].label,baseline:Object.fromEntries(Object.entries(R.baseline).map(([k,v])=>[k,{...v,wins:undefined}])),variants:{}};
  const b0=R.baseline.none;
  md+=`\n## ${CONDS[ck].label}\n\n基準の武器（試作）：勝率 ${pc(b0.winRate)}、平均決着 ${f2(b0.avgTurnsWin)} ターン`;
  for(const [k,v] of Object.entries(R.baseline))if(k!=='none')md+=`／動かし方 ${k}：勝率 ${pc(v.winRate)}`;
  md+=`\n\n| 武器 | 条件 | 勝率 | 今の形との差 | 勝ち越し | 平均決着T | 武器技/戦 | 効果の発動/戦 | 効果で増えたダメージ/戦 | 部位破壊/戦 | 最初の破壊T | 4ターン目に最初の破壊 | スタンで失ったT/戦 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for(const v of list){
    const r=R.variants[v.id],cur=R.variants[list.find(x=>x.group===v.group&&x.current).id];
    const d=r.winRate-cur.winRate,p=paired(r.wins,cur.wins);
    const effs=shownEffects(v,r);
    const eff=Object.entries(effs).filter(([,e])=>e.count).map(([k,e])=>`${k} ${f2(e.count)}`).join('<br>')||'—';
    const ext=Object.entries(effs).filter(([,e])=>Math.round(e.extra)).map(([k,e])=>`${k} ${f0(e.extra)}`).join('<br>')||'—';
    md+=`| ${NAMES[v.def.owner]} ${v.def.rarity}「${v.def.name}」 | ${v.label} | ${pc(r.winRate)} | ${v.current?'—':sgn((d*100).toFixed(1))} | ${v.current?'—':`+${p.up}/−${p.down}`} | ${f2(r.avgTurnsWin)} | ${f2(r.weaponUses)} | ${eff} | ${ext} | ${f2(r.breaks)} | ${f2(r.firstBreakTurn)} | ${pc(r.breakAt4Rate)} | ${f2(IDS.reduce((a,id)=>a+r.stunLost[id],0))} |\n`;
    json.conds[ck].variants[v.id]={...r,wins:undefined,vsCurrent:{winRateDiff:d,...p}};
  }
  // character details
  md+=`\n### 持ち主ごとの記録（${CONDS[ck].label}）\n\n| 武器 | 条件 | 持ち主のカードの使い方（1戦あたり） | 美桜：武器技時の食い込み | 麗華：武器技時の盾／威圧の発動割合（うち+60%） | 小春：終わりの毒／疫毒 | 小春：毒ダメ/T・直接ダメ/T |\n|---|---|---|---|---|---|---|\n`;
  for(const v of list){
    const r=R.variants[v.id],o=v.def.owner;
    const cards=Object.entries(r.cards[o]).map(([k,c])=>`${CARD_NAMES[k]} ${f1(c)}`).join('・');
    md+=`| ${NAMES[o]}「${v.def.name}」 | ${v.label} | ${cards} | ${o==='m'&&r.fireBites!=null&&v.group==='m-mythic'?f2(r.fireBites):'—'} | ${o==='r'?`${f1(r.fireGuard)}／${pc(r.intimidateRate)}（${pc(r.intimidate60Rate)}）`:'—'} | ${o==='k'?`${f1(r.endPoison)}／${f1(r.endPlague)}`:'—'} | ${o==='k'?`${f1(r.kPoisonPerTurn)}・${f1(r.kDirectPerTurn)}`:'—'} |\n`;
  }
  // Koharu per-turn breakdown
  md+=`\n### 小春：ターンごとの毒ダメージ／直接ダメージ（1戦あたりの平均、${CONDS[ck].label}）\n\n| 武器 | 条件 | ${Array.from({length:10},(_,i)=>`T${i+1}`).join(' | ')} |\n|---|---|${Array.from({length:10},()=>'---').join('|')}|\n`;
  for(const v of list.filter(v=>v.def.owner==='k')){const r=R.variants[v.id];md+=`| 「${v.def.name}」 | ${v.label} | ${Array.from({length:10},(_,i)=>{const t=r.kTurns[i+1];return t?`${f0(t.poison)}／${f0(t.direct)}`:'—';}).join(' | ')} |\n`;}
}
fs.writeFileSync(path.join(out,'results.md'),md);
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(json,null,1));
console.log('done -> '+path.relative(process.cwd(),path.join(out,'results.md')));
