// Test the original alpha 5.62 status functions without a browser.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('const CURSE_DAMAGE=');
const end=html.indexOf('async function play(',start);
assert(start>=0&&end>start,'Cannot locate status code in HTML');
const context=vm.createContext({});
vm.runInContext(html.slice(start,end),context);
const run=s=>vm.runInContext(s,context);
let checks=0;
function eq(actual,expected){assert.equal(actual,expected);checks++;}
for(const [cost,expected] of [[0,0],[1,2],[2,5],[3,9]]){
 const unit={hp:100};context.unit=unit;
 run("addStatus(unit,'curse',1,2)");context.cost=cost;
 eq(run('applyCurseOnCard(unit,cost)'),expected);
 eq(unit.hp,100-expected);
}
context.unit={hp:3};run("addStatus(unit,'curse',2,2)");
eq(run('applyCurseOnCard(unit,3)'),3);eq(context.unit.hp,0);
context.unit={hp:100};run("addStatus(unit,'shock',1,2)");
run("statusBag(unit).shock.blockedCards=['M1']");
eq(run("isElectroBlocked(unit,'M1')"),true);
eq(run("isElectroBlocked(unit,'M2')"),false);
run('tickStatuses(unit)');
eq(run("statusBag(unit).shock.turns"),1);
run('tickStatuses(unit)');
eq(run("isElectroBlocked(unit,'M1')"),false);
context.attacker={hp:100};context.target={hp:100};
run("addStatus(attacker,'frost',10,2)");
run("addStatus(target,'burn',25,2)");
eq(run('modifiedDamage(50,attacker,target)'),50);
console.log('PASS '+checks+' status assertions against actual alpha 5.62 code');
