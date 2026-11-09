// Validate terminal-dialog precedence for simultaneous boss defeat and party knockout.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('const defeated=Object.values(chars).every('),end=html.indexOf('\n};',start);
assert(start>=0&&end>start,'Turn-end result block not found');
const resultBlock=html.slice(start,end);
let checks=0;
for(const scenario of [
 {bossHp:0,allyHp:[0,0,0],expected:['勝利']},
 {bossHp:0,allyHp:[1,0,0],expected:['勝利']},
 {bossHp:10,allyHp:[0,0,0],expected:['全員戦闘不能']},
 {bossHp:10,allyHp:[1,0,0],expected:[]},
]){
 const calls=[],ctx=vm.createContext({chars:Object.fromEntries(scenario.allyHp.map((hp,i)=>[i,{hp}])),ended:false,render(){},say(){},hits:[],poisonEvents:[],inflicted:[],enemyHp:scenario.bossHp,dialog:(name)=>calls.push(name)});
 vm.runInContext(resultBlock,ctx);
 assert.deepEqual(calls,scenario.expected);checks++;
 assert.equal(ctx.ended,scenario.bossHp===0||scenario.allyHp.every(hp=>hp===0));checks++;
}
console.log('PASS '+checks+' terminal result assertions');
