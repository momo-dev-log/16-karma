const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i);return html.slice(i,j)}
function element(){return {style:{setProperty(){}},appendChild(){},remove(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100}},querySelectorAll(){return [element(),element(),element()]}}}
const nodes={arena:element(),foe:element(),log:element(),end:{disabled:false}};
let nextTimer=0;const timers=new Map();let checks=0;
const ctx=vm.createContext({document:{createElement:element,getElementById:id=>nodes[id]},setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),Promise,console,ended:false,resolving:false,render(){},dialog(){}});
vm.runInContext(section('let selectedFoe=0;','function render(){'),ctx);
vm.runInContext(section('function playerAttack(','// Status infrastructure:'),ctx);
vm.runInContext("$('end').onclick=async()=>{if(ended||resolving||turnClosing)return;turnClosing=true;render();await attackQueue;if(ended){turnClosing=false;render();return;}resolving=true;}",ctx);
async function flush(){for(let i=0;i<5;i++)await Promise.resolve()}
(async()=>{
 const a=vm.runInContext('queueAttack(20,"m")',ctx);assert.equal(vm.runInContext('boss.hp',ctx),400);checks++;
 const b=vm.runInContext('queueAttack(30,"r")',ctx);assert.equal(vm.runInContext('boss.hp',ctx),370);checks++;
 const close=vm.runInContext("$('end').onclick()",ctx);
 assert.equal(vm.runInContext('turnClosing',ctx),true);checks++;
 assert.equal(vm.runInContext('resolving',ctx),false);checks++;
 await vm.runInContext("$('end').onclick()",ctx);assert.equal(vm.runInContext('resolving',ctx),false);checks++;
 assert.ok(vm.runInContext('pendingAttacks',ctx)>=1);checks++;
 for(const fn of [...timers.values()])fn();timers.clear();await Promise.all([a,b]);await flush();await close;
 assert.equal(vm.runInContext('pendingAttacks',ctx),0);checks++;
 assert.equal(vm.runInContext('resolving',ctx),true);checks++;
 vm.runInContext('resolving=false;turnClosing=false',ctx);
 const old=vm.runInContext('queueAttack(5,"m")',ctx);const fresh=vm.runInContext('queueAttack(6,"m")',ctx);
 assert.equal(vm.runInContext('boss.hp',ctx),359);checks++;
 assert.equal(timers.size,1);checks++;
 for(const fn of [...timers.values()])fn();timers.clear();await Promise.all([old,fresh]);await flush();
 assert.equal(vm.runInContext('pendingAttacks',ctx),0);checks++;
 console.log('PASS '+checks+' real queued attack / overlapping animation / turn-close assertions');
})().catch(e=>{console.error(e);process.exitCode=1});
