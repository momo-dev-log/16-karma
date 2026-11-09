// Regression checks for queued attacks and shared boss HP / break thresholds.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const section=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x);assert(x>=0&&y>x,'Missing '+a);return html.slice(x,y)};
const combat=section('function playerAttack(','// Status infrastructure:');
const boss=section('const foes=[','let attackQueue=');
let checks=0;const check=(ok,msg)=>{assert(ok,msg);checks++};
check(html.includes('const foeIndex=selectedFoe;'),'Queue must capture target when attack is queued');
check(html.includes('playerAttack(n,id,foeIndex)'),'Attack must use captured target');
check(combat.includes('const foe=foes[foeIndex]'),'Damage must resolve against captured foe');
check(combat.includes('boss.hp=Math.max(0,boss.hp-dealt)'),'Damage must reduce shared boss HP');
check(combat.includes('foe.breakDamage=Math.min(foe.breakLimit,foe.breakDamage+dealt)'),'Break progress must accumulate on targeted part');
check(combat.includes('if(!foe.broken)'),'Broken parts must not reaccumulate break damage');
check(combat.includes('foe.broken=true;foe.stunned=true;foe.wait=foe.interval'),'Breaking a part must cancel its attack');
check(combat.includes('const dealt=foe.broken?Math.round(n*1.2):n'),'Broken-part multiplier must be 1.2');
check(html.includes('attackQueue=Promise.all([attackQueue,p])'),'Turn closure must wait for queued animations');
check(boss.includes('function syncBoss(){enemyHp=boss.hp;foes.forEach(f=>{f.hp=boss.hp;f.max=boss.max;});}'),'Shared boss HP must synchronize to all parts');
// Use the live configured values, not hardcoded copies.
const limits=[...boss.matchAll(/breakLimit:(\d+),broken:false/g)].map(x=>Number(x[1]));
const maxHp=Number(boss.match(/const boss=\{hp:(\d+)/)?.[1]||boss.match(/const maxEnemy=(\d+)/)?.[1]);
check(limits.length===3,'Expected three boss break limits');
check(Number.isFinite(maxHp)&&maxHp>0,'Expected shared boss HP');
check(limits.reduce((a,b)=>a+b,0)>maxHp,'Document current balancing constraint: all breaks exceed shared HP');
console.log('PASS '+checks+' queue/boss structural and balancing checks; limits='+limits.join('+')+', HP='+maxHp);
