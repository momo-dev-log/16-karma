// Run the actual enemy-phase stun recovery loop from the game source.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('foes.forEach((f,i)=>{\n  if(boss.hp>0&&f.poison>0)');
const end=html.indexOf('syncBoss();',start);
assert(start>=0&&end>start,'Enemy-phase recovery code not found');
const phase=html.slice(start,end);
const ctx=vm.createContext({boss:{hp:420},foes:[],poisonEvents:[],tickStatuses(f){if(f.statuses?.stun){f.statuses.stun.turns--;if(f.statuses.stun.turns<=0)delete f.statuses.stun}},statusPower(f,key){return f.statuses?.[key]?.power||0}});
const run=()=>vm.runInContext(phase,ctx);
let checks=0;function eq(a,b){assert.equal(a,b);checks++}
const broken={glyph:'禍',hp:420,poison:0,weak:0,stunned:true,wait:1,interval:2};
ctx.foes=[broken];run();eq(broken.stunned,false);eq(broken.wait,2);run();eq(broken.wait,1);run();eq(broken.wait,2);
const statusStun={glyph:'呪',hp:420,poison:0,weak:0,wait:1,interval:2,statuses:{stun:{power:1,turns:1}}};
ctx.foes=[statusStun];run();eq(statusStun.wait,1);eq(statusStun.statuses.stun,undefined);run();eq(statusStun.wait,2);
const ready={glyph:'灰',hp:420,poison:0,weak:0,wait:1,interval:1};ctx.foes=[ready];run();eq(ready.wait,1);
console.log('PASS '+checks+' real enemy-phase stun/recovery assertions');
