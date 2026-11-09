const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const from=html.indexOf('async function play(i){'),to=html.indexOf('const weaponDescriptions=',from);
assert(from>=0&&to>from);
const playCode=html.slice(from,to);
const endFrom=html.indexOf("$('end').onclick=async()=>{"),endTo=html.indexOf(' const due=foes.map(',endFrom);
assert(endFrom>=0&&endTo>endFrom);
const endCode=html.slice(endFrom,endTo)+'}';
let checks=0;
(async()=>{
 for(const state of [{ended:true,resolving:false,turnClosing:false},{ended:false,resolving:true,turnClosing:false},{ended:false,resolving:false,turnClosing:true}]){
  let attacks=0,rendered=0;
  const c={hp:100,cost:3,charge:6,cards:[['攻撃',1,10]],guard:0};
  const ctx=vm.createContext({...state,active:'m',chars:{m:c},selectedFoe:0,foes:[{hp:100}],originalWeapons:{m:{charge:6,damage:100}},cardList:[],queueAttack(){attacks++},render(){rendered++},say(){},statusPower(){return 0},isElectroBlocked(){return false},modifiedDamage:n=>n,$:()=>({})});
  vm.runInContext(playCode,ctx);await vm.runInContext('play(0)',ctx);
  assert.equal(c.cost,3);assert.equal(c.charge,6);assert.equal(attacks,0);assert.equal(rendered,0);checks+=4;
  const endButton={};const endCtx=vm.createContext({...state,$:()=>endButton,render(){throw Error('turn advanced')},attackQueue:Promise.resolve()});
  vm.runInContext(endCode,endCtx);await vm.runInContext("$('end').onclick()",endCtx);checks++;
 }
 assert(html.includes("c.charge<originalWeapons[active].charge||ended||resolving||turnClosing"));checks++;
 assert(html.includes("if(resolving||turnClosing||ended||c.charge<originalWeapons[active].charge"));checks++;
 assert(html.includes("c.cost<x[1]||ended||resolving||turnClosing"));checks++;
 assert(html.includes("$('end').disabled=ended||resolving||turnClosing"));checks++;
 console.log('PASS '+checks+' post-end controls assertions');
})().catch(e=>{console.error(e);process.exitCode=1});
