/* shot.js — offline screenshot harness (Playwright). Enters the real world with a
   stubbed Supabase, then screenshots it. Not a gate: for looking at what the game
   actually renders. Usage: node shot.js [out_dir] [html] [name1,name2,...]
   Needs the `playwright` package and a Chromium (PLAYWRIGHT_BROWSERS_PATH or
   /opt/pw-browsers/chromium). Never touches the network or the live database. */
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const OUT = path.resolve(process.argv[2] || 'shots');
const FILE = path.resolve(process.argv[3] || path.join(__dirname, '..', 'runehaven.html'));
fs.mkdirSync(OUT, { recursive: true });

const STUB = `
(function(){
  const tableData = { world:{seed:123456789,created_at:new Date(Date.now()-864e5*3).toISOString()},
    mined_nodes:[],players:null,ground_items:[],base_pieces:[],pets:[],account_pins:[] };
  function chain(t){ const c=new Proxy(function(){},{get(_,p){ if(p==='then'){const d=tableData[t];return r=>r({data:d===undefined?null:d,error:null});} return ()=>c; }, apply(){return c;}}); return c; }
  window.supabase = { createClient:()=>({ from:t=>chain(t),
    channel:()=>{const ch={on:()=>ch,subscribe:cb=>{if(cb)setTimeout(()=>cb('SUBSCRIBED'),0);return ch;},send:async()=>{},track:async()=>{},untrack:async()=>{},presenceState:()=>({})};return ch;},
    removeChannel:()=>{} }) };
})();`;

(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
    return r.abort();                       // everything else offline
  });
  await p.goto('file://' + FILE);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, '00-title.png') });
  await p.evaluate(() => {
    document.querySelectorAll('.class-card')[3].click();
    document.getElementById('username').value = 'ShotBot';
    document.getElementById('pinInput').value = '2468';
    const u = document.getElementById('sbUrl'), k = document.getElementById('sbKey');
    if (u) u.value = 'https://stub.supabase.co'; if (k) k.value = 'stub-key';
    document.getElementById('enterBtn').onclick();
  });
  await p.waitForFunction(() => document.getElementById('login').style.display === 'none', null, { timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: path.join(OUT, '01-spawn.png') });
  /* Dismiss the tutorial banner so it does not cover shots. */
  await p.keyboard.press('Escape');
  const snap = async (name) => { await p.waitForTimeout(1500); await p.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };
  const hop = (x, y) => p.evaluate(([x, y]) => { me.x = x + 0.5; me.y = y + 0.5; cam.x = me.x; cam.y = me.y; me.diving = false; }, [x, y]);
  /* 1. every fast-travel landmark */
  const pts = await p.evaluate(() => fastTravelPoints().map(q => q[0]));
  for (let i = 0; i < pts.length; i++) {
    await p.evaluate(i => fastTravelTo(i), i);
    await snap('10-landmark-' + pts[i].toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''));
  }
  /* 2. the first solid patch of each biome found on a coarse scan */
  const biomes = ['PLAINS', 'MEADOW', 'FOREST', 'DARKFOREST', 'ENCHFOREST', 'SACMEADOW', 'SAND'];
  for (const name of biomes) {
    const t = await p.evaluate((name) => {
      const id = B[name];
      for (let y = 20; y < N - 20; y += 7) for (let x = 20; x < N - 20; x += 7) {
        if (biomeAt(x, y) !== id) continue;
        let ok = true;
        for (let dy = -4; dy <= 4 && ok; dy += 2) for (let dx = -4; dx <= 4; dx += 2) if (biomeAt(x + dx, y + dy) !== id) { ok = false; break; }
        if (ok) return [x, y];
      }
      return null;
    }, name);
    if (!t) { console.log('no patch for', name); continue; }
    await hop(t[0], t[1]);
    await snap('20-biome-' + name.toLowerCase());
  }
  /* 3. the two interiors */
  for (const name of ['UWCAVE', 'ABYSSAL']) {
    const t = await p.evaluate((name) => {
      const id = B[name];
      for (let y = 20; y < N - 20; y += 5) for (let x = 20; x < N - 20; x += 5) if (biomeAt(x, y) === id) return [x, y];
      return null;
    }, name);
    if (!t) { console.log('no tile for', name); continue; }
    const ok = await p.evaluate(([x, y, name]) => { try { return enterInterior(x, y, B[name]); } catch (e) { return 'ERR ' + e.message; } }, [t[0], t[1], name]);
    console.log('enterInterior', name, ok);
    await snap('30-interior-' + name.toLowerCase());
    await p.evaluate(() => { try { if (inInterior()) exitInterior && exitInterior(); } catch (e) {} });
  }
  console.log(errs.slice(0, 10).join('\n') || 'no page errors');
  await b.close();
})();
