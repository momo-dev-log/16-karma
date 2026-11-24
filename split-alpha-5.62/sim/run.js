'use strict';
// Runs every condition and writes sim/output/results.md, results.json and sample-log.txt.
// Usage:
//   node sim/run.js                       all weapons x policies x bosses x qualities (500 battles each)
//   node sim/run.js --battles 200         fewer battles
//   node sim/run.js --only m-rare,k-epic  only these weapon keys (baseline always runs)
//   node sim/run.js --bosses 10 --out output-boss10   other boss multipliers (HP and break limits), other output folder
//   node sim/run.js --log m-mythic --policy defense --boss 3 --quality 5 --seed 0
//                                         print the full log of one battle and exit
const fs=require('node:fs'),path=require('node:path');
const {Battle,IDS,NAMES}=require('./engine');
const {WEAPONS,BASELINE,makeWeapon}=require('./weapons');

const args=process.argv.slice(2);const opt=(name,def)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:def;};
const BATTLES=Number(opt('battles',500)),SEED0=Number(opt('seed0',1000)),MAX_TURNS=Number(opt('max-turns',100));
const POLICIES={attack:'攻め優先',defense:'守り優先'};
const BOSS_LIST=opt('bosses','1,3').split(',').map(Number);
const bossLabel=s=>s===1?'今のボス':`HP・壊れる量${s}倍`;
const QUALITIES=[1,5,10];

function team(weapon,quality){
  const w={m:{...BASELINE.m},r:{...BASELINE.r},k:{...BASELINE.k}};
  if(weapon)w[weapon.owner]=makeWeapon(weapon,quality);
  return w;
}
function battle(weapon,quality,policy,boss,seed,log){
  return new Battle({seed,policy,bossScale:boss,weapons:team(weapon,quality),log,maxTurns:MAX_TURNS}).run();
}

if(opt('log')){
  const key=opt('log');const w=key==='base'?null:WEAPONS.find(x=>x.key===key);
  if(key!=='base'&&!w){console.error('unknown weapon key: '+key);process.exit(1);}
  const r=battle(w,Number(opt('quality',5)),opt('policy','attack'),Number(opt('boss',3)),Number(opt('seed',SEED0)),true);
  console.log(r.lines.join('\n'));process.exit(0);
}

function measure(weapon,quality,policy,boss,owner){
  let wins=0,winTurns=0,dmgPerTurn=0,uses=0,endHp=0,timeouts=0;
  for(let n=0;n<BATTLES;n++){
    const r=battle(weapon,quality,policy,boss,SEED0+n,false);
    if(r.won){wins++;winTurns+=r.turns;}
    if(r.timeout)timeouts++;
    dmgPerTurn+=r.damage[owner]/r.turns;uses+=r.weaponUses[owner];
    endHp+=r.endHp.reduce((a,b)=>a+b,0)/3;
  }
  return {winRate:wins/BATTLES,avgTurns:wins?winTurns/wins:null,ownerDmgPerTurn:dmgPerTurn/BATTLES,weaponUses:uses/BATTLES,endHp:endHp/BATTLES,timeouts};
}

const only=opt('only')?opt('only').split(','):null;
const list=WEAPONS.filter(w=>!only||only.includes(w.key));
const results=[];
for(const policy of Object.keys(POLICIES))for(const boss of BOSS_LIST){
  const base={};for(const owner of IDS)base[owner]=measure(null,5,policy,boss,owner);
  for(const owner of IDS)results.push({policy,boss,quality:null,owner,key:BASELINE[owner].key,rarity:'基準',name:BASELINE[owner].name,base:BASELINE[owner].base,...base[owner],vsBase:0});
  for(const w of list)for(const q of QUALITIES){
    const m=measure(w,q,policy,boss,w.owner);
    const b=base[w.owner];
    results.push({policy,boss,quality:q,owner:w.owner,key:w.key,rarity:w.rarity,name:w.name,base:makeWeapon(w,q).base,...m,
      vsBase:b.ownerDmgPerTurn?(m.ownerDmgPerTurn/b.ownerDmgPerTurn-1)*100:null,
      turnsVsBase:(m.avgTurns!=null&&b.avgTurns!=null)?m.avgTurns-b.avgTurns:null});
  }
}

// ---- output ----
const out=path.join(__dirname,opt('out','output'));fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({battles:BATTLES,seed0:SEED0,maxTurns:MAX_TURNS,results},null,1));
const f1=x=>x==null?'—':x.toFixed(1),f2=x=>x==null?'—':x.toFixed(2),pc=x=>x==null?'—':(x>=0?'+':'')+x.toFixed(1)+'%';
let md=`# 武器の試算結果\n\n各条件 ${BATTLES} 戦（乱数の種 ${SEED0}〜${SEED0+BATTLES-1}、全条件で同じ種）。ターン上限 ${MAX_TURNS}。\n`+
`「与ダメ/T」は武器の持ち主が1ターンに与えた平均ダメージ（小春は毒・疫毒のダメージを含む）。「基準比」は与ダメ/Tを、同じ持ち主の基準の武器と比べた値。「ターン差」は勝った戦の平均ターン数の差（マイナスほど早い）。\n`;
for(const policy of Object.keys(POLICIES))for(const boss of BOSS_LIST)for(const q of QUALITIES){
  md+=`\n## ${POLICIES[policy]}・${bossLabel(boss)}・品質${q}\n\n| 持ち主 | レア度 | 武器 | 基礎値 | 勝率 | 平均ターン | 与ダメ/T | 武器技/戦 | 終了時の味方平均HP | 基準比 | ターン差 |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for(const owner of IDS){
    const rows=results.filter(r=>r.policy===policy&&r.boss===boss&&r.owner===owner&&(r.quality===q||r.quality===null));
    for(const r of rows)md+=`| ${NAMES[owner]} | ${r.rarity} | ${r.name} | ${r.base} | ${(r.winRate*100).toFixed(1)}% | ${f2(r.avgTurns)} | ${f1(r.ownerDmgPerTurn)} | ${f2(r.weaponUses)} | ${f1(r.endHp)} | ${r.quality===null?'基準':pc(r.vsBase)} | ${r.quality===null?'—':(r.turnsVsBase==null?'—':(r.turnsVsBase>=0?'+':'')+r.turnsVsBase.toFixed(2))} |\n`;
  }
}
// Quality comparison: base value and "基準比" at quality 1 / 5 / 10 for every condition.
md+=`\n## 品質1・5・10の比較（基準比＝持ち主の与ダメ/Tを基準と比べた値、括弧内は基礎値）\n\n| 武器 | ${Object.keys(POLICIES).flatMap(p=>BOSS_LIST.map(b=>`${POLICIES[p]}・${bossLabel(b)}`)).join(' | ')} |\n|---|${Object.keys(POLICIES).flatMap(()=>BOSS_LIST.map(()=>'---')).join('|')}|\n`;
for(const w of list){
  const cells=Object.keys(POLICIES).flatMap(p=>BOSS_LIST.map(b=>QUALITIES.map(q=>{const r=results.find(r=>r.key===w.key&&r.policy===p&&r.boss===b&&r.quality===q);return `${pc(r.vsBase)}(${r.base})`;}).join(' / ')));
  md+=`| ${NAMES[w.owner]} ${w.rarity}「${w.name}」 | ${cells.join(' | ')} |\n`;
}
fs.writeFileSync(path.join(out,'results.md'),md);
// One battle with every action logged (baseline team, attack-first, 3x boss, first seed).
const sampleBoss=BOSS_LIST.includes(3)?3:BOSS_LIST[0];
const sample=battle(null,5,'attack',sampleBoss,SEED0,true);
fs.writeFileSync(path.join(out,'sample-log.txt'),`基準の武器・攻め優先・${bossLabel(sampleBoss)}・種${SEED0}\n`+sample.lines.join('\n')+'\n');
console.log(`done: ${results.length} rows -> ${path.relative(process.cwd(),path.join(out,'results.md'))}`);
