// Ensure attack forecasts agree with the real turn-end hit/ailment rules.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const begin=html.indexOf('const CURSE_DAMAGE='),end=html.indexOf('async function play(',begin);
assert(begin>=0&&end>begin);
const ctx=vm.createContext({});vm.runInContext(html.slice(begin,end),ctx);
const damage=(base,weak,attacker,target)=>{ctx.base=base;ctx.weak=weak;ctx.attacker=attacker;ctx.target=target;return vm.runInContext('modifiedDamage(Math.max(0,base-weak),attacker,target)',ctx)};
let checks=0;function eq(a,b){assert.equal(a,b);checks++}
const turnEnd=html.slice(html.indexOf("$('end').onclick=async()=>{"),html.indexOf('const statusNames='));
const forecast=html.slice(html.indexOf('function drawLines(){'),html.indexOf('const wait=ms=>'));
assert(forecast.includes("victim.hp>damage-victim.guard"),'Forecast must omit lethal-hit ailment icons');checks++;
assert(forecast.includes("statusPower(f,'stun')"),'Forecast must omit stunned enemies');checks++;
assert(turnEnd.includes('if(!h||h.actual<=0||h.c.hp<=0)return;'),'Actual ailment requires a surviving damaged target');checks++;
assert(turnEnd.includes('const key=f.ailments?.[(turn-2)%f.ailments.length]'),'Check actual ailment selection');checks++;
assert(forecast.includes('f.ailments?.[(turn-1)%f.ailments.length]'),'Check forecast ailment selection');checks++;
for(const [turn,ailments] of [[1,['burn','stun']],[2,['curse','shock']],[3,['frost','poison']],[4,['burn','stun']]]){
 const forecastEffect=ailments[(turn-1)%ailments.length];
 const actualEffect=ailments[((turn+1)-2)%ailments.length];
 eq(forecastEffect,actualEffect);
}
for(const sample of [
 {base:12,weak:0,hp:110,guard:0,expected:12,ailment:true},
 {base:12,weak:0,hp:110,guard:15,expected:12,ailment:false},
 {base:12,weak:0,hp:12,guard:0,expected:12,ailment:false},
 {base:12,weak:0,hp:13,guard:0,expected:12,ailment:true},
 {base:24,weak:10,hp:95,guard:5,expected:14,ailment:true},
 {base:8,weak:0,hp:90,guard:8,expected:8,ailment:false},
]){
 const target={hp:sample.hp,guard:sample.guard};
 const incoming=damage(sample.base,sample.weak,{hp:420},target);
 eq(incoming,sample.expected);
 const actual=Math.min(target.hp,Math.max(0,incoming-Math.min(target.guard,incoming)));
 const survives=target.hp>actual;
 const ailmentApplied=actual>0&&survives;
 const forecastAilment=incoming>target.guard&&target.hp>incoming-target.guard;
 eq(forecastAilment,ailmentApplied);
 eq(ailmentApplied,sample.ailment);
}
console.log('PASS '+checks+' attack forecast, guard, lethal-hit and ailment assertions');
