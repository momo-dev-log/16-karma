'use strict';
// Cross-check: replay the simulator's actions (prototype weapons as the page starts with them) in the real game page and compare the state
// at the start of every turn. Uses the Playwright that is preinstalled in this environment (no new package).
// Usage: node sim/verify_against_page.js [seeds=6]
const path=require('node:path'),http=require('node:http'),fs=require('node:fs');
const {chromium}=require('playwright');
const {Battle}=require('./engine');
const {BASELINE,makeWeapon}=require('./weapons');
const {factories:F,withPlainRef}=require('./variants');
// The page now starts Mio with the prototype common weapon (card attacks +3); the other two keep the prototype weapons.
const MIO_DEFAULT=makeWeapon(withPlainRef(F.mCommon({hp:0,card:3})),5);

const root=path.join(__dirname,'..');
function serve(){return new Promise(res=>{const srv=http.createServer((req,rsp)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
  fs.readFile(f,(e,d)=>{if(e){rsp.writeHead(404);rsp.end();return;}rsp.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.png')?'image/png':'application/octet-stream'});rsp.end(d);});});
  srv.listen(0,()=>res(srv));});}

(async()=>{
  const seeds=Number(process.argv[2]||6);
  const srv=await serve(),port=srv.address().port;
  const browser=await chromium.launch();
  let compared=0,mismatches=0,errors=0;
  for(const policy of ['attack','defense'])for(const scale of [3,10])for(let seed=0;seed<seeds;seed++){
    const sim=new Battle({seed,policy,bossScale:scale,weapons:{m:{...MIO_DEFAULT},r:{...BASELINE.r},k:{...BASELINE.k}},maxTurns:40}).run();
    const page=await browser.newPage({viewport:{width:360,height:800}});
    page.on('pageerror',()=>errors++);
    // Same RNG as the simulator (mulberry32); the page uses Math.random only in pickTargets.
    await page.addInitScript(seed=>{let a=seed>>>0;Math.random=function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};},seed);
    await page.goto(`http://localhost:${port}/index.html`);
    await page.evaluate(s=>{boss.hp=boss.max=420*s;foes.forEach(f=>f.breakLimit*=s);syncBoss();render();},scale);
    const snap=()=>page.evaluate(()=>({turn,boss:boss.hp,
      chars:ids.map(id=>{const c=chars[id];const st=c.statuses||{};return [c.hp,c.guard,c.cost,c.charge,c.poison||0,JSON.stringify(Object.keys(st).sort().map(k=>[k,st[k].power,st[k].turns]))];}),
      foes:foes.map(f=>[f.breakDamage,f.broken,!!f.stunned,f.wait,f.poison,(f.targets||[]).join(',')])}));
    let bad=null;
    for(const a of sim.actions){
      if(a.t==='snap'){const got=await snap();compared++;if(JSON.stringify(got)!==JSON.stringify(a.s)){bad={want:a.s,got};break;}}
      else if(a.t==='card')await page.evaluate(a=>{active=a.id;selectedFoe=a.part;render();return play(a.i);},a);
      else if(a.t==='weapon')await page.evaluate(a=>{active=a.id;selectedFoe=a.part;render();document.getElementById('weaponuse').click();},a);
      else if(a.t==='end'){await page.evaluate(()=>attackQueue);if(await page.evaluate(()=>ended))break;await page.click('#end');await page.waitForFunction(()=>!resolving&&!turnClosing,{timeout:15000});}
    }
    const fin=await page.evaluate(()=>({boss:boss.hp,hp:ids.map(id=>chars[id].hp)}));
    const finOk=sim.won?fin.boss===0:true;
    if(bad||!finOk){mismatches++;console.log('MISMATCH',policy,scale,seed,JSON.stringify(bad||{fin,sim:{won:sim.won,endHp:sim.endHp}}));}
    await page.close();
  }
  await browser.close();srv.close();
  console.log(`turn-start snapshots compared: ${compared}, battles with a mismatch: ${mismatches}, page errors: ${errors}`);
  process.exit(mismatches||errors?1:0);
})();
