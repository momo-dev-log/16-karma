const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');const a=html.indexOf('const CURSE_DAMAGE='),b=html.indexOf('async function play(',a);assert(a>=0&&b>a);
const ctx=vm.createContext({});vm.runInContext(html.slice(a,b),ctx);const run=s=>vm.runInContext(s,ctx);let n=0;
function eq(expr,expected){assert.equal(run(expr),expected,expr);n++}
ctx.unit={hp:100};run("addStatus(unit,'burn',25,2);addStatus(unit,'burn',10,1)");eq("statusPower(unit,'burn')",35);eq('statusBag(unit).burn.turns',2);
run('tickStatuses(unit)');eq('statusBag(unit).burn.turns',1);eq("statusPower(unit,'burn')",35);run('tickStatuses(unit)');eq("statusPower(unit,'burn')",0);eq("Object.keys(statusBag(unit)).length",0);
run("addStatus(unit,'frost',5,1);addStatus(unit,'frost',3,3)");eq("statusPower(unit,'frost')",8);eq('statusBag(unit).frost.turns',3);
run('tickStatuses(unit)');eq('statusBag(unit).frost.turns',2);run('tickStatuses(unit)');eq('statusBag(unit).frost.turns',1);run('tickStatuses(unit)');eq("statusPower(unit,'frost')",0);
run("addStatus(unit,'shock',1,2);statusBag(unit).shock.blockedCards=['M1']");eq("isElectroBlocked(unit,'M1')",true);eq("isElectroBlocked(unit,'M2')",false);run("addStatus(unit,'shock',1,1)");eq("isElectroBlocked(unit,'M1')",true);eq("statusPower(unit,'shock')",2);eq('statusBag(unit).shock.turns',2);
ctx.dead={hp:0};run("addStatus(dead,'burn',25,2)");eq("statusPower(dead,'burn')",0);
ctx.bad={hp:10};run("addStatus(bad,'burn',Infinity,2);addStatus(bad,'burn',1,0);addStatus(bad,'burn',NaN,2)");eq("statusPower(bad,'burn')",0);
ctx.atk={hp:10};ctx.target={hp:10};run("addStatus(atk,'frost',10,2);addStatus(target,'burn',25,2)");eq('modifiedDamage(50,atk,target)',50);eq('modifiedDamage(5,atk,target)',0);
console.log('PASS '+n+' status lifecycle and stacking assertions');
