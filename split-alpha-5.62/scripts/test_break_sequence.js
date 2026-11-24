// Exercise real queued attacks: break threshold, attack cancellation and target capture.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const section=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,'Missing '+a);return html.slice(i,j)};
const element=()=>({style:{setProperty(){}},appendChild(){},remove(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100}},querySelectorAll(){return [element(),element(),element()]}});
const elements={arena:element(),foe:element(),log:element()};
const ctx=vm.createContext({document:{createElement:element,getElementById:id=>elements[id]},setTimeout:fn=>{fn();return 1},clearTimeout(){},Promise,console,render(){},dialog(){}});
vm.runInContext(section('let selectedFoe=0;','function render(){'),ctx);
vm.runInContext(section('function playerAttack(','// Status infrastructure:'),ctx);
const get=expr=>vm.runInContext(expr,ctx);
(async()=>{
 let assertions=0;
 const eq=(expr,expected)=>{assert.equal(get(expr),expected,expr);assertions++};
 await get('queueAttack(179,"m")');
 eq('foes[0].breakDamage',179);eq('foes[0].broken',false);eq('boss.hp',241);
 await get('queueAttack(1,"m")');
 eq('foes[0].breakDamage',180);eq('foes[0].broken',true);eq('foes[0].stunned',true);eq('foes[0].wait',1);eq('boss.hp',240);
 await get('queueAttack(10,"m")');
 eq('boss.hp',228);eq('foes[0].breakDamage',180);
 // The queued attack must keep the target chosen when called, not the current UI selection.
 get('selectedFoe=1');const first=get('queueAttack(20,"r")');
 get('selectedFoe=2');const second=get('queueAttack(30,"k")');
 await Promise.all([first,second]);
 eq('foes[1].breakDamage',20);eq('foes[2].breakDamage',30);eq('foes[0].breakDamage',180);eq('boss.hp',178);
 eq('pendingAttacks',0);await get('attackQueue');
 console.log('PASS '+assertions+' real break/queue assertions');
})().catch(e=>{console.error(e);process.exitCode=1});
