const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const i=html.indexOf('const CURSE_DAMAGE='),j=html.indexOf('const weaponDescriptions=',i);assert(i>=0&&j>i);
let count=0;
async function scenario({cost,curse=0,hp=30,charge=0,stun=false,shock=false,repeat=1}){
 const c={name:'美桜',hp,cost:3,charge,guard:0,cards:[['試験',cost,10,'','',null]]};const foe={hp:100,poison:0,weak:0,target:'m',wait:2};let queued=0,renders=0;
 const ctx=vm.createContext({chars:{m:c},active:'m',foes:[foe],selectedFoe:0,ended:false,resolving:false,turnClosing:false,originalWeapons:{m:{charge:6}},cardList:[['M1','m']],queueAttack:()=>queued++,render:()=>renders++,say(){}});
 vm.runInContext(html.slice(i,j),ctx);if(curse)vm.runInContext(`addStatus(chars.m,'curse',${curse},2)`,ctx);if(stun)vm.runInContext("addStatus(chars.m,'stun',1,2)",ctx);if(shock)vm.runInContext("addStatus(chars.m,'shock',1,2);statusBag(chars.m).shock.blockedCards=['M1']",ctx);
 for(let x=0;x<repeat;x++)await vm.runInContext('play(0)',ctx);
 return {c,queued,renders};
}
(async()=>{
 for(const [cost,loss] of [[0,0],[1,2],[2,5],[3,9]]){
  const {c,queued}=await scenario({cost,curse:1});assert.equal(c.hp,30-loss);assert.equal(c.cost,3-cost);assert.equal(c.charge,cost);assert.equal(queued,1);count+=4;
 }
 for(const [cost,loss] of [[1,4],[2,10],[3,18]]){const {c}=await scenario({cost,curse:2});assert.equal(c.hp,30-loss);count++}
 {const {c,queued}=await scenario({cost:3,curse:1,hp:9});assert.equal(c.hp,0);assert.equal(c.cost,0);assert.equal(c.charge,3);assert.equal(queued,0);count+=4}
 {const {c,queued}=await scenario({cost:1,curse:0,repeat:5});assert.equal(c.cost,0);assert.equal(c.charge,3);assert.equal(queued,3);count+=3}
 for(const key of ['stun','shock']){const {c,queued}=await scenario({cost:1,[key]:true});assert.equal(c.cost,3);assert.equal(c.charge,0);assert.equal(queued,0);count+=3}
 {const {c,queued}=await scenario({cost:0,curse:1,hp:1});assert.equal(c.hp,1);assert.equal(queued,1);count+=2}
 console.log('PASS '+count+' actual card/curse/charge/status assertions');
})().catch(e=>{console.error(e);process.exitCode=1});
