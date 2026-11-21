'use strict';
// Stage 3: check the two conditions. Usage: node sim/check_stage3.js
const assert=require('node:assert/strict');
const {Battle,IDS}=require('./engine');
const {BASELINE}=require('./weapons');
let checks=0;const ok=(msg,cond,detail)=>{assert(cond,msg+(detail!==undefined?' '+JSON.stringify(detail):''));checks++;console.log('OK  '+msg+(detail!==undefined?'  '+JSON.stringify(detail):''));};
const team=()=>({m:{...BASELINE.m},r:{...BASELINE.r},k:{...BASELINE.k}});

// 条件1：的
for(const policy of ['defense','attack']){
  let all=true,turns=new Set(),hpOk=true,noAil=true,cumOk=true,forecastHits=0;
  for(let s=0;s<200;s++){
    const r=new Battle({seed:1000+s,policy,hpScale:10,breakScale:10,dummyBoss:true,noAllyDamage:true,maxTurns:10,weapons:team(),log:true}).run();
    turns.add(r.turns);if(r.won||!r.timeout)all=false;
    if(r.endHp.join()!=='110,95,90')hpOk=false;
    if(r.lines.some(l=>/：(スタン|火傷|呪詛|感電|凍傷|毒)$/.test(l)))noAil=false;
    forecastHits+=r.lines.filter(l=>l.includes('受けない')).length;
    const c=r.st.cum;if(!(c[3]&&c[6]&&c[10])||c[10].m<c[6].m||c[6].m<c[3].m)cumOk=false;
  }
  ok(`的（${policy}）：200戦とも10ターン続き、倒れない`,all&&turns.size===1&&turns.has(10),[...turns]);
  ok(`的（${policy}）：味方のHPは減らない`,hpOk);
  ok(`的（${policy}）：状態異常は付かない`,noAil);
  ok(`的（${policy}）：敵は予告どおり攻撃している（受けないだけ）`,forecastHits>0,forecastHits);
  ok(`的（${policy}）：3・6・10ターン目の累計が記録され、増えていく`,cumOk);
}
{ // 的でも守り優先は狙われると盾カードを使う（予告で狙われることが働く）
  const r=new Battle({seed:1000,policy:'defense',hpScale:10,breakScale:10,dummyBoss:true,noAllyDamage:true,maxTurns:10,weapons:team(),log:true}).run();
  ok('的：守り優先は狙われたとき盾カードを使う',r.lines.some(l=>/揺るがぬ余裕|反骨|茨の盾/.test(l)));
}
{ // 的：部位の壊れる量と1.2倍は基準の条件と同じ
  const b=new Battle({seed:1,policy:'defense',hpScale:10,breakScale:10,dummyBoss:true,noAllyDamage:true,maxTurns:10,weapons:team()});
  ok('的：部位の壊れる量は10倍（1800・2200・1800）',b.foes.map(f=>f.breakLimit).join()==='1800,2200,1800');
  b.foes[0].broken=true;const h=b.boss.hp;b.hitPart(100,'m',0);ok('的：壊れた部位は1.2倍',h-b.boss.hp===120);
}
// 条件2：全員スタンを外す
{
  let allAt0=0,allOther=0,singleAt0=0,checked=0;
  for(let s=0;s<200;s++){
    const b=new Battle({seed:1000+s,policy:'defense',hpScale:10,breakScale:10,noAllStun:true,weapons:team()});
    for(let t=1;t<=12;t++){b.turn=t;b.chooseNextTargets();const k=b.foes[0].attackKind;checked++;
      if(t%4===0){if(k==='all')allAt0++;if(k==='single')singleAt0++;}
      if(b.foes[2].attackKind==='all'&&(t+2)%4===0)allOther++;}
  }
  ok('全員スタンを外す：禍は4の倍数のターンも全員を狙わず、1人を狙う',allAt0===0&&singleAt0===600,{allAt0,singleAt0});
  ok('全員スタンを外す：ほかの部位（灰）の全員攻撃はそのまま',allOther===600,allOther);
  const b=new Battle({seed:1,policy:'defense',hpScale:10,breakScale:10,weapons:team()});b.turn=4;b.chooseNextTargets();
  ok('設定なし：禍は4ターン目に全員を狙う（今のコードどおり）',b.foes[0].attackKind==='all');
}
{ // 全員スタンを外しても、禍の偶数ターンのスタン（1人）は残る
  let stunTurn4=0;
  for(let s=0;s<200;s++){const r=new Battle({seed:1000+s,policy:'defense',hpScale:10,breakScale:10,noAllStun:true,weapons:team(),log:true}).run();
    stunTurn4+=r.lines.filter(l=>/^T5 \S+：スタン$/.test(l)).length;}
  ok('全員スタンを外す：4ターン目の禍の攻撃で付くスタンは最大1人',stunTurn4<=200,stunTurn4);
}
console.log(`PASS ${checks} checks`);
