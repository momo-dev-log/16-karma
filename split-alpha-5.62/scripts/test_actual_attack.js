// Execute real attack functions against a minimal DOM stub.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const section=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,a);return html.slice(i,j)};
const element=()=>({style:{setProperty(){}},appendChild(){},remove(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100}},querySelectorAll(){return [element(),element(),element()]}});
const elements={arena:element(),foe:element(),log:element()};
const ctx=vm.createContext({document:{createElement:element,getElementById:id=>elements[id]},setTimeout:fn=>{fn();return 1},clearTimeout(){},Promise,console,render(){},dialog(){}});
vm.runInContext(section('let selectedFoe=0;','function render(){'),ctx);
vm.runInContext(section('function playerAttack(','// Status infrastructure:'),ctx);
(async()=>{
 await vm.runInContext('queueAttack(50,"m")',ctx);
 assert.equal(vm.runInContext('boss.hp',ctx),370);
 assert.equal(vm.runInContext('foes[0].breakDamage',ctx),50);
 vm.runInContext('selectedFoe=1',ctx);
 await vm.runInContext('queueAttack(100,"r")',ctx);
 assert.equal(vm.runInContext('foes[1].breakDamage',ctx),100);
 assert.equal(vm.runInContext('foes[0].breakDamage',ctx),50);
 assert.equal(vm.runInContext('boss.hp',ctx),270);
 console.log('PASS actual queueAttack/playerAttack damage and target checks');
})().catch(e=>{console.error(e);process.exitCode=1});
