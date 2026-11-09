// Execute the real ally poison/turn-reset and enemy ailment application phases.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('turn++;foes[1].aoe='),middle=html.indexOf('const inflicted=[];',start),end=html.indexOf('resolving=false;turnClosing=false;',middle);
assert(start>=0&&middle>start&&end>middle,'Turn phase boundaries missing');
const chars={m:{name:'美桜',hp:2,poison:3,cost:1,guard:8},r:{name:'麗華',hp:10,poison:2,cost:1,guard:5},k:{name:'小春',hp:0,poison:0,cost:1,guard:3}};
const statuses=[];const ctx=vm.createContext({turn:1,foes:[{},{}],chars,chooseNextTargets(){},tickStatuses:c=>statuses.push(c.name),due:[],dueTargets:new Map(),hits:[],addStatus(){throw Error('Unexpected status')},statusBag(){return {}},Map});
vm.runInContext(html.slice(start,middle),ctx);
let checks=0;function eq(a,b){assert.equal(a,b);checks++}
eq(chars.m.hp,0);eq(chars.m.cost,0);eq(chars.m.guard,0);
eq(chars.r.hp,8);eq(chars.r.cost,3);eq(chars.r.guard,0);
eq(chars.k.hp,0);eq(chars.k.cost,0);eq(chars.k.guard,0);
eq(ctx.turn,2);eq(statuses.length,3);
// A character reduced to zero HP by enemy attacks must not receive new ailments.
const dead={name:'美桜',hp:0};const alive={name:'麗華',hp:8};const applied=[];
ctx.due=[{f:{ailments:['burn']},i:0}];ctx.dueTargets=new Map([[0,['m','r']]]);
ctx.hits=[{id:'m',actual:5,c:dead},{id:'r',actual:5,c:alive}];
ctx.addStatus=(c,key,power,turns)=>applied.push({name:c.name,key,power,turns});
vm.runInContext(html.slice(middle,end),ctx);
eq(applied.length,1);eq(applied[0].name,'麗華');eq(applied[0].key,'burn');eq(applied[0].power,25);
console.log('PASS '+checks+' ally poison KO, guard reset and ailment exclusion checks');
