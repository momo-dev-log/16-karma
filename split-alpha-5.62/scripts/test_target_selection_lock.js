const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const patterns=[/b\.onclick=\(\)=>\{(if\(ended\|\|resolving\|\|turnClosing\)return;active=b\.dataset\.id;[^\n]+)\}/,/b\.onclick=\(\)=>\{(if\(ended\|\|resolving\|\|turnClosing\)return;selectedFoe=Number\(b\.dataset\.foe\);[^\n]+)\}/];
const bodies=patterns.map(p=>{const m=html.match(p);assert(m,'selection callback missing');return m[1]});
let checks=0;
for(const state of ['ended','resolving','turnClosing','free']){
 for(let i=0;i<2;i++){
  const ctx=vm.createContext({ended:state==='ended',resolving:state==='resolving',turnClosing:state==='turnClosing',active:'m',selectedFoe:0,b:{dataset:{id:'r',foe:'2'}},chars:{r:{name:'麗華'}},foes:[{},{},{glyph:'灰'}],render(){ctx.rendered++},renderFoes(){ctx.rendered++},say(){ctx.said++},rendered:0,said:0});
  vm.runInContext('(()=>{'+bodies[i]+'})()',ctx);
  assert.equal(i===0?ctx.active:ctx.selectedFoe,state==='free'?(i===0?'r':2):(i===0?'m':0));checks++;
  assert.equal(ctx.rendered,state==='free'?1:0);checks++;
  assert.equal(ctx.said,state==='free'?1:0);checks++;
 }
}
console.log('PASS '+checks+' ally/boss target selection lock assertions');
