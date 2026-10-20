/* perf.js — the Performance build's two REAL-BROWSER proof gates (Playwright).
   Everything else in debug/ runs in jsdom, which stubs the canvas and so can
   count calls but never rasterise a pixel or measure a millisecond. These two
   claims cannot be made anywhere else:

     1. PIXEL MATCH. At four camera positions, one frame with GROUND_CACHE
        false and one with it true, at a frozen `t` and a frozen world clock,
        with the mutable entity collections emptied. Pixels whose channel
        difference exceeds 8 must be at most 0.5% of the frame.
     2. FRAME RATE. At the Colosseum and the Bazaar, interleaved samples with
        the cache on and off; on must be at least 1.4x off.

   A determinism CONTROL runs first at every position: the same frame rendered
   twice with the same setting must differ by zero pixels. Without it a diff
   could be a swing arc or a hit flash rather than the ground, and the whole
   measurement would be worthless.

   Offline: the only request allowed out is the supabase-js script, which is
   fulfilled by the stub below. Never touches the network or the live database.
   Usage: node debug/perf.js [html]
   Exit 0 = both gates passed (or Playwright is genuinely unavailable, which
   the standard process says to report as "skipped"); exit 1 = a gate failed. */
const fs = require('fs'), path = require('path');
let pw;
try { pw = require('playwright'); }
catch (e) {
  try { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
  catch (e2) { console.log('skipped: playwright is not available (' + e.message.split('\n')[0] + ')'); process.exit(0); }
}
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'runehaven.html'));

const STUB = `
(function(){
  const tableData = { world:{seed:123456789,created_at:new Date(Date.now()-864e5*3).toISOString()},
    mined_nodes:[],players:null,ground_items:[],base_pieces:[],pets:[],account_pins:[] };
  function chain(t){ const c=new Proxy(function(){},{get(_,p){ if(p==='then'){const d=tableData[t];return r=>r({data:d===undefined?null:d,error:null});} return ()=>c; }, apply(){return c;}}); return c; }
  window.supabase = { createClient:()=>({ from:t=>chain(t),
    channel:()=>{const ch={on:()=>ch,subscribe:cb=>{if(cb)setTimeout(()=>cb('SUBSCRIBED'),0);return ch;},send:async()=>{},track:async()=>{},untrack:async()=>{},presenceState:()=>({})};return ch;},
    removeChannel:()=>{} }) };
})();`;

const PIXEL_BUDGET = 0.005;      // the spec's 0.5% of the frame
const DIFF_CHANNEL = 8;          // the spec's "channel difference greater than 8"
const FPS_RATIO = 1.4;           // the spec's "at least 1.4x"
const T_FROZEN = 123456;         // any fixed t; the ground pass does not read it at all

(async () => {
  const results = [];
  const b = await pw.chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
    return r.abort();
  });
  await p.goto('file://' + FILE);
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.querySelectorAll('.class-card')[3].click();
    document.getElementById('username').value = 'PerfBot';
    document.getElementById('pinInput').value = '2468';
    const u = document.getElementById('sbUrl'), k = document.getElementById('sbKey');
    if (u) u.value = 'https://stub.supabase.co'; if (k) k.value = 'stub-key';
    document.getElementById('enterBtn').onclick();
  });
  await p.waitForFunction(() => document.getElementById('login').style.display === 'none', null, { timeout: 90000 });
  await p.waitForTimeout(2500);

  const info = await p.evaluate(() => debugGroundCacheInfo());
  console.log(`cache: GC_TILES ${info.GC_TILES}, GC_MAX ${info.GC_MAX}, ` +
              `GC_BAKE_PER_FRAME ${info.GC_BAKE_PER_FRAME}, chunk canvas ${info.GC_W}x${info.GC_H}, ` +
              `RENDER_SCALE ${info.RENDER_SCALE}`);

  /* ---------------- GATE 1: pixel match ---------------------------------
     The loop is stopped by replacing requestAnimationFrame, so the only
     frames from here on are the ones this gate asks for and `t` is whatever
     it passes. The world clock is pinned too, and the mutable entity
     collections are emptied: the landmarks that are always drawn stay, but
     they are static shapes and the control below proves it. */
  const spots = await p.evaluate(() => {
    const pick = (name, from) => {
      const id = B[name];
      for (let r = 6; r < 900; r += 6) {
        for (let a = 0; a < 24; a++) {
          const x = Math.round(from.x + Math.cos(a / 24 * 6.2832) * r);
          const y = Math.round(from.y + Math.sin(a / 24 * 6.2832) * r);
          if (x < 8 || y < 8 || x >= N - 8 || y >= N - 8) continue;
          if (biomeAt(x, y) === id) return [x, y];
        }
      }
      return null;
    };
    const out = [['Spawn', Math.floor(SPAWN.x), Math.floor(SPAWN.y)]];
    const coast = pick('SAND', SPAWN);        if (coast) out.push(['coastline', coast[0], coast[1]]);
    const rim = pick('VOLROCK', VOLCANO);     if (rim) out.push(['volcano rim', rim[0], rim[1]]);
    const forest = pick('FOREST', SPAWN);     if (forest) out.push(['forest edge', forest[0], forest[1]]);
    return out;
  });

  await p.evaluate(() => {
    window.__rafOff = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;                 // the loop stops after the in-flight frame
  });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    /* The world clock, frozen. nightAlpha / sunShadow / the sky all read it. */
    window.__epoch0 = worldEpoch;
    worldEpoch = Date.now() / 1000 - DAY_LENGTH * 0.25;      // flat daylight
    /* "Hide entities": every mutable collection the entity pass gathers
       from. The fixed landmarks cannot be emptied and do not need to be —
       they are static draws, which the control frame proves. */
    const drop = ['features', 'ruinPieces', 'decor', 'critters', 'mobs', 'wilds',
                  'projectiles', 'particles', 'flocks'];
    for (const n of drop) { try { const a = window[n] || eval(n); if (a && a.length !== undefined) a.length = 0; } catch (e) {} }
    try { others.clear(); } catch (e) {}
    try { groundItems.clear(); } catch (e) {}
    try { basePieces.clear(); } catch (e) {}
    /* and the HUD, which is DOM and so is not in the canvas anyway — hidden
       so the page screenshot and the canvas read agree about what is there. */
    const s = document.createElement('style');
    s.textContent = '.hud,#hudHelp,#toast{display:none !important}';
    document.head.appendChild(s);
  });

  const diffAt = async (label, x, y) => {
    return await p.evaluate(([label, x, y, T, CH]) => {
      me.x = x + 0.5; me.y = y + 0.5; cam.x = me.x; cam.y = me.y; me.diving = false;
      const W = canvas.width, H = canvas.height, px = W * H;
      const grab = () => ctx.getImageData(0, 0, W, H).data;
      const count = (a, c) => {
        let n = 0;
        for (let i = 0; i < a.length; i += 4)
          if (Math.abs(a[i] - c[i]) > CH || Math.abs(a[i + 1] - c[i + 1]) > CH || Math.abs(a[i + 2] - c[i + 2]) > CH) n++;
        return n;
      };
      debugSetGroundCache(false);
      render(T); const off1 = grab();
      render(T); const off2 = grab();
      const control = count(off1, off2);          // determinism control: must be 0
      debugSetGroundCache(true);
      for (let i = 0; i < 40; i++) render(T);     // warm every visible chunk (2 bakes a frame)
      const g = debugGroundCacheInfo();
      render(T); const on1 = grab();
      const bad = count(off2, on1);
      return { label, control, bad, px, pct: bad / px * 100,
               chunks: g.chunksFrame, baked: g.size, bakesFrame: g.bakesFrame,
               tiles: g.ground.tiles, scanned: g.ground.scanned };
    }, [label, x, y, T_FROZEN, DIFF_CHANNEL]);
  };

  console.log('\n--- GATE 1: pixel match (cache off vs cache on, frozen frame) ---');
  let worstPct = 0, controlBad = 0;
  for (const [label, x, y] of spots) {
    const d = await diffAt(label, x, y);
    console.log(`  ${d.label.padEnd(12)} ${d.bad} of ${d.px} px differ by >${DIFF_CHANNEL} = ` +
                `${d.pct.toFixed(4)}%   (control ${d.control}; ${d.chunks} chunks, ` +
                `${d.tiles} tiles of ${d.scanned} scanned)`);
    worstPct = Math.max(worstPct, d.pct);
    if (d.control !== 0) controlBad++;
  }
  results.push(['the frozen frame is deterministic (every control diff is 0 px)', controlBad === 0]);
  results.push([`the cached ground matches the direct ground to ${(PIXEL_BUDGET * 100).toFixed(1)}% of the frame ` +
                `(worst ${worstPct.toFixed(4)}%, ${spots.length} camera positions)`,
    spots.length >= 4 && worstPct <= PIXEL_BUDGET * 100]);

  /* ---------------- GATE 2: frame rate ---------------------------------- */
  await p.evaluate(() => {
    worldEpoch = window.__epoch0;
    window.requestAnimationFrame = window.__rafOff;
    requestAnimationFrame(loop);                 // the real loop again
    try { buildFeatureList(); } catch (e) {}     // and the world back, so this measures a real frame
  });
  await p.waitForTimeout(1200);

  const fpsAt = async (x, y, on, ms) => {
    await p.evaluate(([x, y, on]) => {
      me.x = x + 0.5; me.y = y + 0.5; cam.x = me.x; cam.y = me.y;
      debugSetGroundCache(on);
    }, [x, y, on]);
    await p.waitForTimeout(700);                 // settle, and warm the cache when on
    const a = await p.evaluate(() => [debugGroundCacheInfo().frames, performance.now()]);
    await p.waitForTimeout(ms);
    const z = await p.evaluate(() => [debugGroundCacheInfo().frames, performance.now()]);
    return (z[0] - a[0]) / ((z[1] - a[1]) / 1000);
  };

  /* ⚠️ FIVE INTERLEAVED SAMPLES OF TWO SECONDS, not three of 1.6. This
     measurement is noisy — the mobs in view move between samples and this is
     software rasterising on a shared machine — and three short samples put
     the spread wider than the thing being measured. Interleaved on/off/on/off
     so a drift in machine load lands on both sides equally. The 1.4x bar
     itself is the spec's and is NOT adjusted here. */
  console.log('\n--- GATE 2: frame rate (interleaved, 5 samples each) ---');
  const fpsSpots = await p.evaluate(() => [
    ['Colosseum', Math.floor(COLOSSEUM.x), Math.floor(COLOSSEUM.y)],
    ['Bazaar', Math.floor(BAZAAR.x), Math.floor(BAZAAR.y)],
  ]);
  let worstRatio = 99;
  for (const [label, x, y] of fpsSpots) {
    const off = [], on = [];
    for (let i = 0; i < 5; i++) {
      off.push(await fpsAt(x, y, false, 2000));
      on.push(await fpsAt(x, y, true, 2000));
    }
    /* The MEDIAN as well as the mean: one stalled sample moves a five-sample
       mean by more than the effect being measured. Both are printed, and the
       gate is judged on the median pair. */
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const med = a => { const s = a.slice().sort((p, q) => p - q); return s[(s.length - 1) >> 1]; };
    const mOff = med(off), mOn = med(on), ratio = mOn / mOff;
    console.log(`  ${label.padEnd(10)} off ${mOff.toFixed(1)} fps median (mean ${mean(off).toFixed(1)}) [${off.map(v => v.toFixed(1)).join(', ')}]`);
    console.log(`  ${''.padEnd(10)} on  ${mOn.toFixed(1)} fps median (mean ${mean(on).toFixed(1)}) [${on.map(v => v.toFixed(1)).join(', ')}]  = ${ratio.toFixed(2)}x`);
    worstRatio = Math.min(worstRatio, ratio);
  }
  results.push([`the cache is at least ${FPS_RATIO}x the direct path at the Colosseum and the Bazaar ` +
                `(worst ${worstRatio.toFixed(2)}x)`, worstRatio >= FPS_RATIO]);

  const cacheEnd = await p.evaluate(() => debugGroundCacheInfo());
  console.log(`\ncache at the end: ${cacheEnd.size} chunks baked (GC_MAX ${cacheEnd.GC_MAX}), ` +
              `${cacheEnd.bakes} bakes, ${cacheEnd.blits} blits, ${cacheEnd.evicts} evicted, ` +
              `most bakes in one frame ${cacheEnd.bakeFrameMax}`);
  console.log(errs.slice(0, 6).join('\n') || 'no page errors');
  await b.close();

  console.log('');
  let bad = 0;
  for (const [label, ok] of results) { console.log((ok ? 'PASS - ' : 'FAIL - ') + label); if (!ok) bad++; }
  console.log(`\nperf: ${results.length - bad} PASS, ${bad} FAIL`);
  process.exit(bad ? 1 : 0);
})();
