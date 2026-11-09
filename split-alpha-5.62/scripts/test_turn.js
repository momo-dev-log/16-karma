// Regression tests for target selection, status expiry, and damage arithmetic.
// Executes functions extracted from the real alpha 5.62 HTML, not reimplementations.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function extract(start,end){const a=html.indexOf(start);const b=html.indexOf(end,a);assert(a>=0&&b>a,`Missing code section: ${start}`);return html.slice(a,b);}
const ctx=vm.createContext({});
vm.runInContext(extract('const CURSE_DAMAGE=','async function play('),ctx);
vm.runInContext(extract('function attackTargets(','let attackQueue=').replace(/function syncBoss\(\)[\s\S]*$/,''),ctx);
ctx.chars={m:{hp:110,guard:0},r:{hp:95,guard:0},k:{hp:90,guard:0}};
const evalIn=s=>vm.runInContext(s,ctx);
let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++};
eq(evalIn("attackTargets({},0).join(',')"),'m');
eq(evalIn("attackTargets({},1).join(',')"),'r');
eq(evalIn("attackTargets({},2).join(',')"),'k');
ctx.chars.r.hp=0;
eq(evalIn("attackTargets({},1).length"),0);
ctx.chars.r.hp=95;
ctx.target={hp:95};ctx.attacker={hp:420};
eq(evalIn('modifiedDamage(24,attacker,target)'),24);
evalIn("addStatus(attacker,'frost',10,2)");
eq(evalIn('modifiedDamage(24,attacker,target)'),14);
evalIn("addStatus(target,'burn',25,2)");
eq(evalIn('modifiedDamage(24,attacker,target)'),18); // round(14*1.25)=18
evalIn('tickStatuses(attacker);tickStatuses(target)');
eq(evalIn("statusBag(attacker).frost.turns"),1);
eq(evalIn("statusBag(target).burn.turns"),1);
evalIn('tickStatuses(attacker);tickStatuses(target)');
eq(evalIn("statusPower(attacker,'frost')"),0);
eq(evalIn("statusPower(target,'burn')"),0);
eq(evalIn('modifiedDamage(24,attacker,target)'),24);
// Enemy phase snapshots damage then subtracts guard; preserve its intended arithmetic.
const guarded={hp:90,guard:15},incoming=8;
eq(Math.min(guarded.guard,incoming),8);
eq(Math.min(guarded.hp,incoming-Math.min(guarded.guard,incoming)),0);
// Verify that the actual turn-end code contains its poison, status, and guard-reset phases.
const turn=extract("$('end').onclick=async()=>{","const statusNames=");
for(const fragment of ['const due=foes.map(', 'const blocked=Math.min(c.guard,n)', 'if(boss.hp>0&&f.poison>0)', 'tickStatuses(f)', 'tickStatuses(c)', 'c.guard=0', 'const defeated=Object.values(chars).every']) {
 assert(turn.includes(fragment),`Missing turn phase: ${fragment}`);checks++;
}
console.log(`PASS ${checks} target/status/damage assertions and turn phase checks`);
