'use strict';
// Stage 3: two conditions that do not hinge on "break 禍 by turn 4".
//  target (条件1): boss with the base-condition parts (x10 break limits, broken 1.2x) whose HP never runs out;
//                  10 turns; enemies forecast and attack as usual but allies take no damage and no ailments.
//                  Cumulative damage at the end of turns 3 / 6 / 10.
//  nostun (条件2): base condition (x10) with 禍's every-4th-turn all-target stun attack replaced by a single-target attack.
// Weapons: every entry of variants.js (the 18 current weapons, all stage-2 variants, controls) + the baseline weapon.
// Usage (from split-alpha-5.62/):
//   node sim/run_stage3.js                         both conditions -> sim/output-stage3/
//   node sim/run_stage3.js --only m-mythic --conds target --battles 300
//   node sim/run_stage3.js --log m-mythic:now --cond target --policy defense --quality 5 --seed 1000
const fs=require('node:fs'),path=require('node:path');
const {Battle,IDS,NAMES}=require('./engine');
const {BASELINE,makeWeapon}=require('./weapons');
const {VARIANTS}=require('./variants');

const args=process.argv.slice(2);const opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const SEED0=Number(opt('seed0',1000));
const POLICIES={defense:'守り優先',attack:'攻め優先'};
const COND={
  target:{label:'条件1：火力だけを測る的（10ターン、味方は受けない）',battles:Number(opt('battles',1000)),qualities:[1,5,10],
    opts:{hpScale:10,breakScale:10,dummyBoss:true,noAllyDamage:true,maxTurns:10}},
  nostun:{label:'条件2：全員スタンを外した実戦（HP4,200・壊れる量10倍）',battles:Number(opt('battles',2000)),qualities:[5],
    opts:{hpScale:10,breakScale:10,noAllStun:true,maxTurns:100}}
};
const TURNS=[3,6,10];

function team(def,q){const w={m:{...BASELINE.m},r:{...BASELINE.r},k:{...BASELINE.k}};if(def)w[def.owner]=makeWeapon(def,q);return w;}
function battle(ck,def,policy,q,seed,mods,log){return new Battle({seed,policy,mods,weapons:team(def,q),log,...COND[ck].opts}).run();}

if(opt('log')){
  const id=opt('log'),v=id==='base'?null:VARIANTS.find(x=>x.id===id);
  if(id!=='base'&&!v){console.error('unknown variant: '+id);process.exit(1);}
  const r=battle(opt('cond','target'),v?.def,opt('policy','defense'),Number(opt('quality',5)),Number(opt('seed',SEED0)),v?.mods,true);
  console.log(r.lines.join('\n'));if(opt('cond','target')==='target')console.log('累計ダメージ',JSON.stringify(r.st.cum));process.exit(0);
}

function measure(ck,def,policy,q,mods,owner){
  const N=COND[ck].battles;
  const a={wins:[],turnsWin:0,endHp:0,uses:0,effects:{},stunLost:0,firstBreak:0,firstBreakN:0,cum:Object.fromEntries(TURNS.map(t=>[t,{party:0,owner:0}])),poisonWeapon:0,poisonBonus:0,plagueExtra:0};
  for(let n=0;n<N;n++){
    const r=battle(ck,def,policy,q,SEED0+n,mods,false),st=r.st;
    a.wins.push(r.won?1:0);if(r.won)a.turnsWin+=r.turns;a.endHp+=r.endHp.reduce((x,y)=>x+y,0)/3;a.uses+=r.weaponUses[owner];
    for(const [k,e] of Object.entries(st.effects[owner])){const x=a.effects[k]||(a.effects[k]={count:0,extra:0});x.count+=e.count;x.extra+=e.extra;}
    a.stunLost+=IDS.reduce((x,id)=>x+st.stunLost[id],0);
    if(st.breaks.length){a.firstBreak+=Math.min(...st.breaks.map(b=>b.turn));a.firstBreakN++;}
    for(const t of TURNS){const c=st.cum[t];if(c){a.cum[t].party+=c.m+c.r+c.k;a.cum[t].owner+=c[owner];}}
    a.poisonWeapon+=st.poisonDmg.weapon;a.poisonBonus+=st.poisonDmg.bonus;a.plagueExtra+=st.plagueExtra;
  }
  const per=x=>x/N,wins=a.wins.reduce((x,y)=>x+y,0);
  const effects=Object.fromEntries(Object.entries(a.effects).map(([k,e])=>[k,{count:per(e.count),extra:per(e.extra)}]));
  if(a.poisonWeapon/N>=0.5)effects['武器の毒のダメージ']={count:0,extra:per(a.poisonWeapon)};
  if(a.poisonBonus/N>=0.5)effects['毒の数+1のダメージ']={count:0,extra:per(a.poisonBonus)};
  if(def?.plague&&a.plagueExtra/N>=0.5)effects['疫毒（2倍）で増えた分']={count:0,extra:per(a.plagueExtra)};
  return {winRate:wins/N,wins:a.wins,avgTurnsWin:wins?a.turnsWin/wins:null,endHp:per(a.endHp),weaponUses:per(a.uses),effects,stunLost:per(a.stunLost),
    firstBreakTurn:a.firstBreakN?a.firstBreak/a.firstBreakN:null,cum:Object.fromEntries(TURNS.map(t=>[t,{party:per(a.cum[t].party),owner:per(a.cum[t].owner)}]))};
}
const paired=(a,b)=>{let up=0,down=0;for(let i=0;i<a.length;i++){if(a[i]&&!b[i])up++;else if(!a[i]&&b[i])down++;}return {up,down};};

const only=opt('only')?opt('only').split(','):null;
const list=VARIANTS.filter(v=>!only||only.includes(v.group));
const condKeys=opt('conds','target,nostun').split(',');
const out=path.resolve(__dirname,opt('out','output-stage3'));fs.mkdirSync(path.join(out,'logs'),{recursive:true});
const R={};
for(const ck of condKeys)for(const policy of Object.keys(POLICIES))for(const q of COND[ck].qualities){
  const key=`${ck}|${policy}|${q}`;R[key]={baseline:{},variants:{}};
  for(const o of IDS)R[key].baseline[o]=measure(ck,null,policy,q,undefined,o);
  for(const v of list){R[key].variants[v.id]=measure(ck,v.def,policy,q,v.mods,v.def.owner);}
  process.stderr.write(`${key} done\n`);
}
// one full log per variant and condition (defense, quality 5, first seed)
for(const ck of condKeys)for(const v of list){const r=battle(ck,v.def,'defense',5,SEED0,v.mods,true);
  fs.writeFileSync(path.join(out,'logs',`${ck}_${v.id.replace(/:/g,'_')}.txt`),`${COND[ck].label}／${v.group}「${v.def.name}」${v.label}／守り優先／品質5／種${SEED0}\n`+r.lines.join('\n')+(ck==='target'?'\n累計ダメージ '+JSON.stringify(r.st.cum):'')+'\n');}

// ---- report ----
const f0=x=>x==null?'—':x.toFixed(0),f1=x=>x==null?'—':x.toFixed(1),f2=x=>x==null?'—':x.toFixed(2),pc=x=>x==null?'—':(x*100).toFixed(1)+'%';
const rel=(a,b)=>b?((a/b-1)*100):null,sp=x=>x==null?'—':(x>=0?'+':'')+x.toFixed(1)+'%';
const name=v=>`${NAMES[v.def.owner]} ${v.def.rarity}「${v.def.name}」`;
const effText=(r,withExtra)=>Object.entries(r.effects).filter(([,e])=>withExtra?Math.round(e.extra):e.count).map(([k,e])=>withExtra?`${k} ${f0(e.extra)}`:`${k} ${f2(e.count)}`).join('<br>')||'—';
let md=`# 武器バランス再試算・第3段階\n\n乱数の種は ${SEED0} から順に、どの武器も同じ種を使う。`+
`「基準比」は同じ動かし方・同じ条件の基準の武器（試作：美桜100・麗華110・小春100、必要チャージ6、効果なし）と比べた値。\n`;
const json={seed0:SEED0,conds:{},variants:VARIANTS.map(({def,...v})=>({...v,weapon:def.name,owner:def.owner,rarity:def.rarity}))};
for(const ck of condKeys){
  md+=`\n# ${COND[ck].label}\n`;
  for(const policy of Object.keys(POLICIES))for(const q of COND[ck].qualities){
    const key=`${ck}|${policy}|${q}`,D=R[key];
    json.conds[key]={baseline:Object.fromEntries(Object.entries(D.baseline).map(([k,v])=>[k,{...v,wins:undefined}])),variants:{}};
    if(ck==='target'){
      const b=D.baseline.m;
      md+=`\n## ${POLICIES[policy]}・品質${q}（${COND[ck].battles}戦）\n\n基準の武器のパーティ合計：3T ${f0(b.cum[3].party)}／6T ${f0(b.cum[6].party)}／10T ${f0(b.cum[10].party)}。持ち主（基準）：`+
        IDS.map(o=>`${NAMES[o]} ${f0(D.baseline[o].cum[3].owner)}／${f0(D.baseline[o].cum[6].owner)}／${f0(D.baseline[o].cum[10].owner)}`).join('、')+`\n\n`+
        `| 武器 | 条件 | 持ち主 3T | 6T | 10T | 持ち主の基準比 3T | 6T | 10T | パーティの基準比 3T | 6T | 10T | 武器技/10T | 効果の発動（10Tまで） | 効果で増えたダメージ（10Tまで） |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
      for(const v of list){const r=D.variants[v.id],bo=D.baseline[v.def.owner];
        json.conds[key].variants[v.id]={...r,wins:undefined,vsBase:Object.fromEntries(TURNS.map(t=>[t,{owner:rel(r.cum[t].owner,bo.cum[t].owner),party:rel(r.cum[t].party,bo.cum[t].party)}]))};
        md+=`| ${name(v)} | ${v.label} | ${f0(r.cum[3].owner)} | ${f0(r.cum[6].owner)} | ${f0(r.cum[10].owner)} | ${TURNS.map(t=>sp(rel(r.cum[t].owner,bo.cum[t].owner))).join(' | ')} | ${TURNS.map(t=>sp(rel(r.cum[t].party,bo.cum[t].party))).join(' | ')} | ${f2(r.weaponUses)} | ${effText(r,false)} | ${effText(r,true)} |\n`;}
    }else{
      const b=D.baseline.m;
      md+=`\n## ${POLICIES[policy]}・品質${q}（${COND[ck].battles}戦）\n\n基準の武器：勝率 ${pc(b.winRate)}、平均決着 ${f2(b.avgTurnsWin)}T、終わりの平均HP ${f1(b.endHp)}、スタンで失ったT ${f2(b.stunLost)}／戦、最初の破壊 ${f2(b.firstBreakTurn)}T\n\n`+
        `| 武器 | 条件 | 勝率 | 基準比（ポイント） | 勝ち越し（対 基準） | 勝ち越し（対 今の形） | 平均決着T | 平均HP | 武器技/戦 | 効果の発動/戦 | 効果で増えたダメージ/戦 | スタンで失ったT/戦 | 最初の破壊T |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
      for(const v of list){const r=D.variants[v.id],bo=D.baseline[v.def.owner],cur=D.variants[list.find(x=>x.group===v.group&&x.current)?.id];
        const pb=paired(r.wins,bo.wins),pcur=cur&&!v.current?paired(r.wins,cur.wins):null;
        json.conds[key].variants[v.id]={...r,wins:undefined,vsBase:{points:(r.winRate-bo.winRate)*100,...pb},vsCurrent:pcur?{points:(r.winRate-cur.winRate)*100,...pcur}:null};
        md+=`| ${name(v)} | ${v.label} | ${pc(r.winRate)} | ${((r.winRate-bo.winRate)*100>=0?'+':'')+((r.winRate-bo.winRate)*100).toFixed(1)} | +${pb.up}/−${pb.down} | ${pcur?`+${pcur.up}/−${pcur.down}`:'—'} | ${f2(r.avgTurnsWin)} | ${f1(r.endHp)} | ${f2(r.weaponUses)} | ${effText(r,false)} | ${effText(r,true)} | ${f2(r.stunLost)} | ${f2(r.firstBreakTurn)} |\n`;}
    }
  }
}
// rankings and short/long comparison (current 18 weapons)
const RAR=['コモン','アンコモン','レア','エピック','レジェンダリー','ミシック'];
const cur18=list.filter(v=>v.current&&!v.reference);
if(condKeys.includes('target')||condKeys.includes('nostun')){
  md+=`\n# キャラごとの強さの順（今の形の武器）\n`;
  for(const o of IDS){
    const ws=cur18.filter(v=>v.def.owner===o).sort((a,b)=>RAR.indexOf(a.def.rarity)-RAR.indexOf(b.def.rarity));
    md+=`\n## ${NAMES[o]}\n\n| レア度 | 武器 |${condKeys.includes('target')?' 条件1 守り 6T基準比 | 順位 | 条件1 攻め 6T基準比 | 順位 |':''}${condKeys.includes('nostun')?' 条件2 守り 勝率 | 順位 | 条件2 攻め 勝率 | 順位 |':''}\n|---|---|${condKeys.includes('target')?'---|---|---|---|':''}${condKeys.includes('nostun')?'---|---|---|---|':''}\n`;
    const rankOf=(vals,x)=>1+vals.filter(y=>y>x+1e-9).length;
    const t6=p=>ws.map(v=>{const j=json.conds[`target|${p}|5`];return j?j.variants[v.id].vsBase[6].owner:null;});
    const w2=p=>ws.map(v=>{const j=json.conds[`nostun|${p}|5`];return j?j.variants[v.id].winRate:null;});
    const cols=[];if(condKeys.includes('target'))cols.push(t6('defense'),t6('attack'));if(condKeys.includes('nostun'))cols.push(w2('defense'),w2('attack'));
    ws.forEach((v,i)=>{md+=`| ${v.def.rarity} | ${v.def.name} |`+cols.map((c,ci)=>{const isT=condKeys.includes('target')&&ci<2;return ` ${isT?sp(c[i]):pc(c[i])} | ${rankOf(c,c[i])} |`;}).join('')+'\n';});
  }
}
if(condKeys.includes('target')){
  md+=`\n# 短い戦い・長い戦い（条件1・品質5、持ち主の基準比 3T → 10T）\n\n| 武器 | 条件 | 守り 3T | 守り 10T | 差 | 攻め 3T | 攻め 10T | 差 |\n|---|---|---|---|---|---|---|---|\n`;
  for(const v of list){const d=json.conds['target|defense|5'].variants[v.id].vsBase,a=json.conds['target|attack|5'].variants[v.id].vsBase;
    md+=`| ${name(v)} | ${v.label} | ${sp(d[3].owner)} | ${sp(d[10].owner)} | ${sp(d[10].owner-d[3].owner)} | ${sp(a[3].owner)} | ${sp(a[10].owner)} | ${sp(a[10].owner-a[3].owner)} |\n`;}
  md+=`\n# 品質1・5・10（条件1・守り優先、持ち主の6T基準比）\n\n| 武器 | 条件 | 品質1 | 品質5 | 品質10 |\n|---|---|---|---|---|\n`;
  for(const v of list){md+=`| ${name(v)} | ${v.label} | ${[1,5,10].map(q=>sp(json.conds[`target|defense|${q}`].variants[v.id].vsBase[6].owner)).join(' | ')} |\n`;}
}
fs.writeFileSync(path.join(out,'results.md'),md);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(json,null,1));
console.log('done -> '+path.relative(process.cwd(),path.join(out,'results.md')));
