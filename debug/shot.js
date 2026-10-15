/* shot.js — offline screenshot harness (Playwright). Enters the real world with a
   stubbed Supabase, then screenshots it. Not a gate: for looking at what the game
   actually renders. Usage: node shot.js [out_dir] [html] [name1,name2,...]
   Needs the `playwright` package and a Chromium (PLAYWRIGHT_BROWSERS_PATH or
   /opt/pw-browsers/chromium). Never touches the network or the live database. */
const fs = require('fs'), path = require('path');
/* World Check Fixes PART J: this harness is a look, never a gate, so a
   machine without Playwright or without a Chromium must print "skipped" and
   exit 0 rather than throwing a module-not-found stack. The standard process
   says the same thing in words ("write visual check skipped: <reason> and
   continue; never try to install them"); this makes the script itself say it. */
let pw;
try { pw = require('playwright'); }
catch (e) {
  try { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
  catch (e2) { console.log('skipped: playwright is not available (' + e.message.split('\n')[0] + ')'); process.exit(0); }
}
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
  const snap = async (name) => { await p.waitForTimeout(4000); await p.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };
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
  /* 4. World Check Fixes PART J — the views this build is judged on.
     Night first, because worldEpoch is global state every later shot would
     inherit; it is put back afterwards so nothing below sees night. */
  const epoch0 = await p.evaluate(() => worldEpoch);
  await p.evaluate(() => { worldEpoch = Date.now() / 1000 - DAY_LENGTH * 0.75; });
  const spawnPt = await p.evaluate(() => [Math.floor(SPAWN.x), Math.floor(SPAWN.y)]);
  await hop(spawnPt[0], spawnPt[1]);
  await snap('40-night-spawn');
  const volPt = await p.evaluate(() => [Math.floor(VOLCANO.x), Math.floor(VOLCANO.y)]);
  await hop(volPt[0], volPt[1]);
  await snap('41-night-volcano');
  await p.evaluate(e => { worldEpoch = e; }, epoch0);

  /* The full control list open, over the compass and the zone banner — the
     two cards PART E lifts. Taken in the Bazaar so #hudZone is up too. */
  const bazPt = await p.evaluate(() => [Math.floor(BAZAAR.x), Math.floor(BAZAAR.y)]);
  await hop(bazPt[0], bazPt[1]);
  await p.click('#helpToggle');
  await snap('42-help-open');
  /* Real-browser layout check for PART E (jsdom has no layout): does the open
     help card still overlap the compass or the zone banner? */
  const overlap = await p.evaluate(() => {
    const r = id => { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') return null; return e.getBoundingClientRect(); };
    const h = r('hudHelp'), hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const pairs = ['hudMinimap', 'hudZone'].filter(id => hit(h, r(id)));
    if (hit(r('hudZone'), r('hudPrompt'))) pairs.push('hudZone/hudPrompt');
    return pairs;
  });
  console.log('help-open overlap: ' + (overlap.length ? overlap.join(', ') : 'none'));

  /* And the compass card on its own, at the Grand Bazaar, where the labels
     collided. Clipped to the card so the labels are big enough to read. */
  const mm = await p.$('#hudMinimap');
  const box = mm && await mm.boundingBox();
  if (box) {
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, '43-compass.png'),
      clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: box.width + 12, height: box.height + 12 } });
    console.log('shot 43-compass');
  } else console.log('no #hudMinimap box for 43-compass');
  await p.click('#helpToggle');

  /* 5. Gauntlet S2 — the two views the S2 scorecard asks for that the tour
     did not have: a fight, and the phone layouts. The fight is the nearest
     surface mob outside the spawn safe zone, the player two tiles off it,
     swinging at it (tryAttack, the game's own attack path). */
  const fightPt = await p.evaluate(() => {
    let best = null;
    for (const m of mobs) {
      if (m.dead || (m.space && m.space !== 'main')) continue;
      const d = Math.hypot(m.x - SPAWN.x, m.y - SPAWN.y);
      if (d < SAFE_RADIUS + 6) continue;
      if (!best || d < best.d) best = { x: m.x, y: m.y, d };
    }
    return best;
  });
  if (fightPt) {
    await hop(Math.floor(fightPt.x) - 2, Math.floor(fightPt.y) - 1);
    await p.waitForTimeout(600);
    for (let i = 0; i < 4; i++) {
      await p.evaluate(() => { const m = mobs.filter(q => !q.dead && (!q.space || q.space === 'main'))
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]; if (m) tryAttack(m.x, m.y); });
      await p.waitForTimeout(i < 3 ? 520 : 90);
    }
    await p.screenshot({ path: path.join(OUT, '44-fight.png') });
    console.log('shot 44-fight');
  } else console.log('no mob for 44-fight');

  /* The phone layouts: a fresh touch context at both orientations, through
     the real login, at Spawn. */
  for (const [name, vw, vh] of [['50-phone-landscape', 844, 390], ['51-phone-portrait', 390, 844]]) {
    const ctxP = await b.newContext({ viewport: { width: vw, height: vh }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const q = await ctxP.newPage();
    q.on('pageerror', e => errs.push('PAGEERR(' + name + ') ' + e.message));
    await q.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
      return r.abort();
    });
    await q.goto('file://' + FILE);
    await q.waitForTimeout(1500);
    await q.evaluate(() => {
      document.querySelectorAll('.class-card')[3].click();
      document.getElementById('username').value = 'ShotBot';
      document.getElementById('pinInput').value = '2468';
      const u = document.getElementById('sbUrl'), k = document.getElementById('sbKey');
      if (u) u.value = 'https://stub.supabase.co'; if (k) k.value = 'stub-key';
      document.getElementById('enterBtn').onclick();
    });
    await q.waitForFunction(() => document.getElementById('login').style.display === 'none', null, { timeout: 90000 });
    await q.waitForTimeout(2500);
    await q.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('shot', name);
    await ctxP.close();
  }

  console.log(errs.slice(0, 10).join('\n') || 'no page errors');
  await b.close();
})();
