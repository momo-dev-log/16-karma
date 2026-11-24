'use strict';
// Cross-check of Mio's three prototype weapons: the simulator's actions are replayed in the real page
// (index.html, weapon switched with equipMioWeapon) and the state is compared at the start of every turn.
// Usage (from split-alpha-5.62/): node sim/verify_mio_weapons.js [seeds=3]
const path=require('node:path'),http=require('node:http'),fs=require('node:fs');
const {chromium}=require('playwright');
const {Battle}=require('./engine');
const {BASELINE,makeWeapon}=require('./weapons');
const {factories:F,withPlainRef}=require('./variants');
const WEAPONS={common:F.mCommon({hp:0,card:3}),epic:F.mEpic(),mythic:F.mMythic({regain:false})};
const root=path.join(__dirname,'..');
function serve(){return new Promise(res=>{const srv=http.createServer((req,rsp)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
  fs.readFile(f,(e,d)=>{if(e){rsp.writeHead(404);rsp.end();return;}rsp.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.png')?'image/png':'application/octet-stream'});rsp.end(d);});});
  srv.listen(0,()=>res(srv));});}
(async()=>{
  const seeds=Number(process.argv[2]||3);const srv=await serve(),port=srv.address().port;const browser=await chromium.launch();
  let compared=0,mismatches=0,errors=0,battles=0;
  for(const [key,def] of Object.entries(WEAPONS))for(const policy of ['attack','defense'])for(const scale of [3,10])for(let seed=0;seed<seeds;seed++){
    const sim=new Battle({seed,policy,bossScale:scale,weapons:{m:makeWeapon(withPlainRef(def),5),r:{...BASELINE.r},k:{...BASELINE.k}},maxTurns:40}).run();
    const page=await browser.newPage({viewport:{width:360,height:800}});page.on('pageerror',()=>errors++);
    await page.addInitScript(seed=>{let a=seed>>>0;Math.random=function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};},seed);
    await page.goto(`http://localhost:${port}/index.html`);
    await page.evaluate(([s,key])=>{equipMioWeapon(key);boss.hp=boss.max=420*s;foes.forEach(f=>f.breakLimit*=s);syncBoss();render();},[scale,key]);
    const snap=()=>page.evaluate(()=>({turn,boss:boss.hp,
      chars:ids.map(id=>{const c=chars[id];const st=c.statuses||{};return [c.hp,c.guard,c.cost,c.charge,c.poison||0,JSON.stringify(Object.keys(st).sort().map(k=>[k,st[k].power,st[k].turns]))];}),
      foes:foes.map(f=>[f.breakDamage,f.broken,!!f.stunned,f.wait,f.poison,(f.targets||[]).join(',')]),bites:mioBites}));
    // Mio's bites are not in the simulator's snapshot: read them from a second, identical simulator run.
    let bad=null;let i=0;const simBites=[];
    { // re-run the simulator turn by turn to read Mio's bites at each turn start
      const b2=new Battle({seed,policy,bossScale:scale,weapons:{m:makeWeapon(withPlainRef(def),5),r:{...BASELINE.r},k:{...BASELINE.k}},maxTurns:40});
      const orig=b2.snapshot.bind(b2);b2.snapshot=()=>{simBites.push(b2.chars.m.ws.bites||0);return orig();};b2.run();
    }
    let snapNo=0;
    for(const a of sim.actions){
      if(a.t==='snap'){const got=await snap();compared++;const want={...a.s,bites:simBites[snapNo++]};if(JSON.stringify(got)!==JSON.stringify(want)){bad={want,got};break;}}
      else if(a.t==='card')await page.evaluate(a=>{active=a.id;selectedFoe=a.part;render();return play(a.i);},a);
      else if(a.t==='weapon')await page.evaluate(a=>{active=a.id;selectedFoe=a.part;render();document.getElementById('weaponuse').click();},a);
      else if(a.t==='end'){await page.evaluate(()=>attackQueue);if(await page.evaluate(()=>ended))break;await page.click('#end');await page.waitForFunction(()=>!resolving&&!turnClosing,{timeout:15000});}
    }
    const fin=await page.evaluate(()=>({boss:boss.hp}));battles++;
    if(bad||(sim.won&&fin.boss!==0)){mismatches++;console.log('MISMATCH',key,policy,scale,seed,JSON.stringify(bad||{fin,won:sim.won}));}
    await page.close();
  }
  await browser.close();srv.close();
  console.log(`battles: ${battles}, turn-start snapshots compared: ${compared}, battles with a mismatch: ${mismatches}, page errors: ${errors}`);
  process.exit(mismatches||errors?1:0);
})();
