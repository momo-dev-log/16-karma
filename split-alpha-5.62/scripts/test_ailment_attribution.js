// Document the current multi-attacker ailment attribution gap without changing game rules.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const begin=html.indexOf('const due=foes.map('),end=html.indexOf("const statusNames=",begin);
assert(begin>=0&&end>begin);
const phase=html.slice(begin,end);
let checks=0;function check(condition,message){assert(condition,message);checks++;}
check(phase.includes('incoming[id]=(incoming[id]||0)+modifiedDamage('),'Attacks are summed by ally'); 
check(phase.includes('blocked=Math.min(c.guard,n)'),'Guard is applied once to combined damage');
check(phase.includes('const h=hits.find(h=>h.id===id)'),'Ailments are decided using aggregate hit per ally');
check(phase.includes('if(!h||h.actual<=0||h.c.hp<=0)return;'),'All attackers share the aggregate damage/survival check');
check(phase.includes('ids.forEach(id=>{'),'Ailments are iterated per enemy');
const sample={hp:100,guard:10,attacks:[{damage:8,ailment:'burn'},{damage:7,ailment:'frost'}]};
const combined=sample.attacks.reduce((sum,a)=>sum+a.damage,0);
const actual=Math.min(sample.hp,Math.max(0,combined-sample.guard));
const currentAilments=sample.attacks.filter(()=>actual>0&&sample.hp>actual).map(a=>a.ailment);
check(actual===5,'Combined damage is 5 after guard');
check(currentAilments.join(',')==='burn,frost','Current code allows both ailments even though guard absorbed 10 of 15 damage');
console.log('PASS '+checks+' documented multi-hit ailment attribution checks (behavior preserved)');
