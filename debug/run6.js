/* run6.js — S4 Performance browser gates (Playwright). Usage: node run6.js [html]
   1. PIXEL MATCH: at four camera positions (Spawn, a coastline, the volcano
      rim, a forest edge) draw one ground-only frame with the ground cache OFF
      and one with it ON (debugGroundFrame — underlay and ground pass only, so
      no entity, particle, HUD or clock is in it), and count pixels whose
      largest channel difference is > 8. Each must be <= 0.5% of the frame.
   2. FRAME RATE: in one session, at the Colosseum and the Bazaar, frames per
      second with the cache ON must be >= 1.2x the frames with it OFF (owner
      decision 2026-10-21; README has the measurements). The no-ground
      ceiling is printed beside it.
   3. LIVING WORLD S1 (camera zoom + device pixels): the same pixel match at
      zoom 1.0 and 2.2 at the spawn and a forest edge; a second page at
      deviceScaleFactor 2 (canvas must be 2x the window, pixel match at the
      1.6x default); and at the Bazaar the frame rate at 1.6x and 2.2x must be
      >= 0.9x the 1.0x figure, measured interleaved in one session.
   Like shot.js, a machine without Playwright or Chromium prints "skipped"
   and exits 0 — every jsdom gate in run3/run4/run5 still runs. Stubbed
   Supabase; never touches the network or the live database. */
const fs = require('fs'), path = require('path');
let pw;
try { pw = require('playwright'); }
catch (e) {
  try { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
  catch (e2) { console.log('skipped: playwright is not available (' + e.message.split('\n')[0] + ')'); process.exit(0); }
}
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'runehaven.html'));
const EXE = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
if (!fs.existsSync(EXE)) { console.log('skipped: no Chromium at ' + EXE); process.exit(0); }

const STUB = `
(function(){
  const tableData = { world:{seed:123456789,created_at:new Date(Date.now()-864e5*3).toISOString()},
    mined_nodes:[],players:null,ground_items:[],base_pieces:[],pets:[],account_pins:[] };
  function chain(t){ const c=new Proxy(function(){},{get(_,p){ if(p==='then'){const d=tableData[t];return r=>r({data:d===undefined?null:d,error:null});} return ()=>c; }, apply(){return c;}}); return c; }
  window.supabase = { createClient:()=>({ from:t=>chain(t), rpc:()=>chain('rpc'),
    channel:()=>{const ch={on:()=>ch,subscribe:cb=>{if(cb)setTimeout(()=>cb('SUBSCRIBED'),0);return ch;},send:async()=>{},track:async()=>{},untrack:async()=>{},presenceState:()=>({})};return ch;},
    removeChannel:()=>{} }) };
})();`;

(async () => {
  const b = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
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
    document.getElementById('username').value = 'GateBot';
    document.getElementById('pinInput').value = '2468';
    const u = document.getElementById('sbUrl'), k = document.getElementById('sbKey');
    if (u) u.value = 'https://stub.supabase.co'; if (k) k.value = 'stub-key';
    document.getElementById('enterBtn').onclick();
  });
  await p.waitForFunction(() => document.getElementById('login').style.display === 'none', null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');
  const results = [];

  /* ---- 1. pixel match ------------------------------------------------- */
  const spots = await p.evaluate(() => {
    const out = {};
    const ring = (cx, cy, rMax, test) => {
      for (let r = 0; r <= rMax; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = Math.floor(cx) + dx, y = Math.floor(cy) + dy;
        if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2) continue;
        if (test(x, y)) return [x, y];
      }
      return null;
    };
    out.spawn = [Math.floor(SPAWN.x), Math.floor(SPAWN.y)];
    out.coast = ring(SPAWN.x, SPAWN.y, 400, (x, y) => biomeAt(x, y) === B.SHALLOW &&
      heightAt(x, y - 1) >= 0 && heightAt(x + 1, y) >= 0);
    out.volcanoRim = ring(VOLCANO.x, VOLCANO.y, 160, (x, y) => biomeAt(x, y) === B.LAVA &&
      biomeAt(x + 1, y) !== B.LAVA && heightAt(x + 1, y) > heightAt(x, y));
    out.forestEdge = ring(SPAWN.x, SPAWN.y, 600, (x, y) => biomeAt(x, y) === B.FOREST &&
      biomeAt(x + 1, y) === B.PLAINS && biomeAt(x, y + 1) === B.PLAINS);
    return out;
  });
  for (const [name, at] of Object.entries(spots)) {
    if (!at) { results.push([`S4 pixel match: found a ${name} camera position`, false]); continue; }
    const r = await p.evaluate(([x, y]) => {
      // a fractional camera on purpose: the camera offset is snapped to whole pixels for BOTH paths (camOffset), so this proves the snap holds
      me.x = x + 0.37; me.y = y + 0.61; cam.x = me.x; cam.y = me.y; me.diving = false;
      const w = canvas.width, h = canvas.height;
      debugGroundFrame(false);
      const off = ctx.getImageData(0, 0, w, h).data;
      const info = debugGroundFrame(true);
      const on = ctx.getImageData(0, 0, w, h).data;
      let diff = 0;
      for (let i = 0; i < off.length; i += 4) {
        const d = Math.max(Math.abs(off[i] - on[i]), Math.abs(off[i + 1] - on[i + 1]), Math.abs(off[i + 2] - on[i + 2]));
        if (d > 8) diff++;
      }
      return { diff, total: w * h, passes: info.passes, chunks: info.size, cached: debugGroundCache().blits > 0 };
    }, at);
    const pct = 100 * r.diff / r.total;
    console.log(`pixel match ${name} at ${at}: ${r.diff} of ${r.total} px differ by > 8 (${pct.toFixed(3)}%), ${r.passes} passes, ${r.chunks} chunks cached`);
    results.push([`S4 pixel match at ${name}: ${pct.toFixed(3)}% of the frame differs by more than 8 (limit 0.5%)`, r.cached && pct <= 0.5]);
  }

  /* ---- 2. frame rate -------------------------------------------------- */
  /* Living World S1: the S4 frame-rate gate is measured at zoom 1, the 1:1
     camera it was calibrated at — at the 1.6x default far fewer tiles are on
     screen and headless Chrome sits on its 60 fps vsync cap with the cache on
     AND off, so a ratio there measures the cap, not the cache. The zoom's own
     frame-rate gates follow below. */
  await p.evaluate(() => debugSetZoom(1));
  for (const [name, expr] of [['Colosseum', 'COLOSSEUM'], ['Bazaar', 'BAZAAR']]) {
    const r = await p.evaluate(async (expr) => {
      const P = eval(expr);
      me.x = P.x + 0.5; me.y = P.y + (expr === 'COLOSSEUM' ? 9.5 : 0.5); cam.x = me.x; cam.y = me.y;
      const count = ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(f); });
      const out = { on: [], off: [], none: [] };
      debugSetGroundCache(true); await new Promise(z => setTimeout(z, 2500));   // let every visible chunk bake
      const pass = window.drawGroundPass;
      for (let rep = 0; rep < 5; rep++) for (const mode of ['off', 'on', 'none']) {
        // 'none' draws no ground at all: the ceiling any ground cache could reach (printed, not gated)
        window.drawGroundPass = mode === 'none' ? () => {} : pass;
        debugSetGroundCache(mode !== 'off'); await new Promise(z => setTimeout(z, 300));
        out[mode].push(await count(2000));
      }
      window.drawGroundPass = pass;
      debugSetGroundCache(true);
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      return { on: avg(out.on), off: avg(out.off), none: avg(out.none), onAll: out.on, offAll: out.off };
    }, expr);
    console.log(`frame rate ${name}: cache on ${r.on.toFixed(1)} fps, off ${r.off.toFixed(1)} fps (x${(r.on / r.off).toFixed(2)}); no ground at all ${r.none.toFixed(1)} fps (ceiling x${(r.none / r.off).toFixed(2)}) — on ${r.onAll.map(v => v.toFixed(1))}, off ${r.offAll.map(v => v.toFixed(1))}`);
    /* Owner decision 2026-10-21 (README, Performance spec, frame-rate gate):
       the bar is 1.2x. At build time drawing NO ground reached only 1.39x at
       the Colosseum, so 1.4x was out of reach for any ground cache there. */
    results.push([`S4 frame rate at ${name}: cache on ${r.on.toFixed(1)} fps >= 1.2x cache off ${r.off.toFixed(1)} fps (ceiling x${(r.none / r.off).toFixed(2)})`, r.on >= 1.2 * r.off]);
  }

  /* ---- 3. Living World S1: the pixel match at every scale ------------------
     The same method as section 1 — one ground-only frame with the cache OFF
     and one with it ON, pixels whose largest channel differs by more than 8,
     at most 0.5% — but at the zoom range's two ends (1.0 and 2.2) at the
     spawn and the forest edge. After each zoom the real loop is given 1.5 s to
     re-bake every visible chunk at the new scale (the cache never bakes while
     the zoom moves and re-bakes two a frame after), and the frame is only
     compared if no stale chunk is left in it: a resampled chunk is a
     different image by design. */
  const cmpFrame = () => {
    const w = canvas.width, h = canvas.height;
    const s0 = debugGroundCache().staleBlits || 0;
    debugGroundFrame(false);
    const off = ctx.getImageData(0, 0, w, h).data;
    const info = debugGroundFrame(true);
    const on = ctx.getImageData(0, 0, w, h).data;
    let diff = 0;
    for (let i = 0; i < off.length; i += 4) {
      const d = Math.max(Math.abs(off[i] - on[i]), Math.abs(off[i + 1] - on[i + 1]), Math.abs(off[i + 2] - on[i + 2]));
      if (d > 8) diff++;
    }
    const g = debugGroundCache();
    return { diff, total: w * h, passes: info.passes, chunks: info.size, cached: g.blits > 0, stale: (g.staleBlits || 0) - s0, scale: g.VIEW_SCALE, bakeScale: g.bakeScale, w, h };
  };
  const goTo = ([x, y, z]) => {
    if (z) debugSetZoom(z);
    me.x = x + 0.37; me.y = y + 0.61; cam.x = me.x; cam.y = me.y; me.diving = false;
  };
  for (const z of [1, 2.2]) {
    for (const name of ['spawn', 'forestEdge']) {
      const at = spots[name];
      if (!at) { results.push([`Living World S1 pixel match at ${z}x: found a ${name} camera position`, false]); continue; }
      await p.evaluate(goTo, [at[0], at[1], z]);
      await p.waitForTimeout(1500);
      const r = await p.evaluate(cmpFrame);
      const pct = 100 * r.diff / r.total;
      console.log(`pixel match ${z}x ${name} at ${at}: ${r.diff} of ${r.total} px differ by > 8 (${pct.toFixed(3)}%), scale ${r.scale}, ${r.passes} passes, ${r.chunks} chunks cached, ${r.stale} stale blits`);
      results.push([`Living World S1 pixel match at ${z}x at the ${name}: ${pct.toFixed(3)}% of the frame differs by more than 8 (limit 0.5%), view scale ${r.scale}, ${r.stale} stale chunks in the frame`,
        r.cached && r.stale === 0 && r.scale === z && pct <= 0.5]);
    }
  }

  /* ---- 4. Living World S1: a Retina screen --------------------------------
     A second page at deviceScaleFactor 2, set up exactly like the first. The
     backing store must be 2x the CSS size (and the page must see ratio 2),
     and the cached ground must still match the direct path pixel for pixel at
     the 1.6x default — a backing scale of 3.2, the cap on the bake scale. */
  const errs2 = [];
  const p2 = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  p2.on('pageerror', e => errs2.push(e.message));
  await p2.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
    return r.abort();
  });
  await p2.goto('file://' + FILE);
  await p2.waitForTimeout(1500);
  await p2.evaluate(() => {
    document.querySelectorAll('.class-card')[3].click();
    document.getElementById('username').value = 'GateBot';
    document.getElementById('pinInput').value = '2468';
    const u = document.getElementById('sbUrl'), k = document.getElementById('sbKey');
    if (u) u.value = 'https://stub.supabase.co'; if (k) k.value = 'stub-key';
    document.getElementById('enterBtn').onclick();
  });
  await p2.waitForFunction(() => document.getElementById('login').style.display === 'none', null, { timeout: 120000 });
  await p2.waitForTimeout(1500);
  await p2.keyboard.press('Escape');
  const ret = await p2.evaluate(() => ({ dpr: window.devicePixelRatio, iw: innerWidth, ih: innerHeight, cw: canvas.width, ch: canvas.height, zoom: zoomNow, scale: VIEW_SCALE,
    lightW: lightCanvas.width, lightH: lightCanvas.height }));
  console.log(`retina page: devicePixelRatio ${ret.dpr}, inner ${ret.iw}x${ret.ih}, canvas ${ret.cw}x${ret.ch}, zoom ${ret.zoom}, view scale ${ret.scale}, light canvas ${ret.lightW}x${ret.lightH}`);
  results.push([`Living World S1 Retina: devicePixelRatio ${ret.dpr} gives a backing store of 2x the window — canvas ${ret.cw}x${ret.ch} = 2 x ${ret.iw}x${ret.ih}, at the 1.6x default (view scale ${ret.scale})`,
    ret.dpr === 2 && ret.cw === 2 * ret.iw && ret.ch === 2 * ret.ih && ret.zoom === 1.6 && ret.scale === 3.2]);
  results.push([`Living World S1 Retina: the night light canvas stays CSS-sized (${ret.lightW}x${ret.lightH}), not 4x the fill`, ret.lightW === ret.iw && ret.lightH === ret.ih]);
  for (const name of ['spawn', 'forestEdge']) {
    const at = spots[name];
    if (!at) { results.push([`Living World S1 Retina pixel match: found a ${name} camera position`, false]); continue; }
    await p2.evaluate(goTo, [at[0], at[1], 1.6]);
    await p2.waitForTimeout(1500);
    const r = await p2.evaluate(cmpFrame);
    const pct = 100 * r.diff / r.total;
    console.log(`pixel match retina 1.6x ${name} at ${at}: ${r.diff} of ${r.total} px differ by > 8 (${pct.toFixed(3)}%), scale ${r.scale}, bake scale ${r.bakeScale}, ${r.passes} passes, ${r.chunks} chunks cached, ${r.stale} stale blits`);
    results.push([`Living World S1 Retina pixel match at 1.6x at the ${name}: ${pct.toFixed(3)}% of the ${r.w}x${r.h} frame differs by more than 8 (limit 0.5%), ${r.stale} stale chunks in the frame`,
      r.cached && r.stale === 0 && r.w === 2 * ret.iw && r.scale === 3.2 && r.bakeScale === 3.2 && pct <= 0.5]);
  }
  await p2.close();
  if (errs2.length) results.push(['Living World S1 run6: no page errors on the Retina page (' + errs2.slice(0, 3).join(' | ') + ')', false]);

  /* ---- 5. Living World S1: zooming in must not cost frame rate -------------
     At the Bazaar, in one session, interleaved (1.0, 1.6, 2.2, 1.0, ...), the
     average frames per second at 1.6x and at 2.2x must each be at least 0.9x
     the 1.0x figure. Each switch is a debugSetZoom (a jump, no ease) followed
     by 1.5 s for the cache to re-bake every visible chunk at the new scale,
     so what is timed is the settled frame, which is what a player sits in. */
  {
    const r = await p.evaluate(async () => {
      const P = BAZAAR;
      me.x = P.x + 0.5; me.y = P.y + 0.5; cam.x = me.x; cam.y = me.y; me.diving = false;
      debugSetGroundCache(true);
      const count = ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(f); });
      const out = { 1: [], 1.6: [], 2.2: [] };
      for (let rep = 0; rep < 4; rep++) for (const z of [1, 1.6, 2.2]) {
        debugSetZoom(z); await new Promise(res => setTimeout(res, 1500));
        out[z].push(await count(2000));
      }
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      debugSetZoom(1.6);
      return { f1: avg(out[1]), f16: avg(out[1.6]), f22: avg(out[2.2]), all: out };
    });
    console.log(`frame rate by zoom at the Bazaar: 1.0x ${r.f1.toFixed(1)} fps, 1.6x ${r.f16.toFixed(1)} fps (x${(r.f16 / r.f1).toFixed(2)}), 2.2x ${r.f22.toFixed(1)} fps (x${(r.f22 / r.f1).toFixed(2)}) — 1.0 ${r.all[1].map(v => v.toFixed(1))}, 1.6 ${r.all[1.6].map(v => v.toFixed(1))}, 2.2 ${r.all[2.2].map(v => v.toFixed(1))}`);
    results.push([`Living World S1 frame rate at the Bazaar: 1.6x ${r.f16.toFixed(1)} fps >= 0.9 x the 1.0x figure ${r.f1.toFixed(1)} fps (x${(r.f16 / r.f1).toFixed(2)})`, r.f16 >= 0.9 * r.f1]);
    results.push([`Living World S1 frame rate at the Bazaar: 2.2x ${r.f22.toFixed(1)} fps >= 0.9 x the 1.0x figure ${r.f1.toFixed(1)} fps (x${(r.f22 / r.f1).toFixed(2)})`, r.f22 >= 0.9 * r.f1]);
  }

  /* ---- 6. Living World S2: the Pixel Forge in a real browser ---------------
     jsdom's canvas is a stub, so the real bake is only provable here.
     (1) Every class is baked through forgeBake at forgeGrid(1.6).px with a
         sword strike frame: it must return a canvas whose pixels are only
         alpha 0 or 255 and use at most FORGE_MAX_COLORS colours.
     (2) The boxes are big enough: across every class and every state (all
         attack kinds and frames, gathering, casting, hurt, the death fall,
         the emotes — baked in the wide box; idle, walk, block, taming — in
         the narrow one) no solid pixel touches the sprite's outer edge, so
         nothing is clipped (a spear thrust, the dust cloud, a raised arm).
     (3) Standing still, the cache goes quiet: after the idle loop has been
         baked, 60 rendered frames add no bake, no live draw, no fallback, the
         forge stays on and the sprites are served as hits.
     (4) A bake costs less than 4 ms on average (the cost that is paid once
         per new frame of a player, never per drawn frame). */
  {
    const r = await p.evaluate(() => {
      const S = 2.4, FI = debugForgeInfo(), px16 = forgeGrid(1.6).px, px22 = forgeGrid(2.2).px;
      const classes = Object.keys(CLASSES);
      const mk = (cls, fr, o) => Object.assign({ owner: 'gate', cls, S, tier: 'iron', face: { x: 1, y: 1 }, wk: fr.tool || 'sword', atier: 'iron', blocking: false, cos: null,
        step: fr.step, bob: fr.bob, pose: fr.P, tA: fr.tA, animKey: fr.key, wide: false }, o || {});
      const scan = (e) => {
        const d = e.cv.getContext('2d').getImageData(0, 0, e.W, e.H).data, cols = new Set();
        let badAlpha = 0, solid = 0, edge = 0;
        for (let y = 0; y < e.H; y++) for (let x = 0; x < e.W; x++) {
          const i = (y * e.W + x) * 4, a = d[i + 3];
          if (a !== 0 && a !== 255) badAlpha++;
          if (a === 255) { solid++; cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); if (x === 0 || y === 0 || x === e.W - 1 || y === e.H - 1) edge++; }
        }
        return { badAlpha, solid, colours: cols.size, edge };
      };
      const out = { px16, classes: [], tot: 0, edgeBad: [], times: [], maxColours: 0, nulls: 0, FI: { MAXC: FI.FORGE_MAX_COLORS } };
      // (1) one strike frame of a sword for each class
      const dur = swingDur('sword');
      const strike = heroAnimFrame({ s: 'attack', k: 'sword', at: 0, dur }, 3.5 / 8 * dur, 0);
      for (const cls of classes) {
        const t0 = performance.now();
        const e = forgeBake(mk(cls, strike, { wide: true }), px16);
        const ms = performance.now() - t0;
        if (!e) { out.nulls++; out.classes.push({ cls, null: true }); continue; }
        const s = scan(e); e.cv.width = e.cv.height = 0;
        out.classes.push({ cls, isCanvas: e.cv instanceof HTMLCanvasElement, W: e.W, H: e.H, px: e.px, colours: s.colours, reported: e.colors, badAlpha: s.badAlpha, solid: s.solid, ms });
        out.maxColours = Math.max(out.maxColours, s.colours);
      }
      // (2) every state, every frame, every class: nothing touches the edge of its box
      const jobs = [];
      const atk = ['sword', 'axe', 'dagger', 'spear', 'staff', 'fists', 'bow', 'crossbow'];
      for (const k of atk) { const d2 = k === 'bow' || k === 'crossbow' ? ANIM_SHOOT_MS : swingDur(k); for (let i = 0; i < 8; i++) jobs.push([heroAnimFrame({ s: 'attack', k, at: 0, dur: d2 }, (i + 0.5) / 8 * d2, 0), true, k === 'fists' ? null : k, 'attack ' + k + ' ' + i]); }
      for (const k of ['chop', 'mine', 'pick']) for (let i = 0; i < 6; i++) jobs.push([heroAnimFrame({ s: 'gather', k, at: 0, dur: ANIM_GATHER_MS }, (i + 0.5) / 6 * ANIM_GATHER_MS, 0), true, null, 'gather ' + k + ' ' + i]);
      for (let i = 0; i < 6; i++) { jobs.push([heroAnimFrame({ s: 'cast', at: 0, dur: ANIM_CAST_MS }, (i + 0.5) / 6 * ANIM_CAST_MS, 0), true, 'staff', 'cast ' + i]); jobs.push([heroAnimFrame({ s: 'death', at: 0, dur: ANIM_DEATH_MS }, (i + 0.5) / 6 * ANIM_DEATH_MS, 0), true, 'sword', 'death ' + i]); }
      for (let i = 0; i < 3; i++) jobs.push([heroAnimFrame({ s: 'hurt', at: 0, dur: ANIM_HURT_MS }, (i + 0.5) / 3 * ANIM_HURT_MS, 0), true, 'sword', 'hurt ' + i]);
      for (let i = 0; i < 8; i++) jobs.push([heroAnimFrame({ s: 'emote', k: 'wave', at: 0, dur: 1600 }, i * 100 + 10, 0), true, 'sword', 'wave ' + i]);
      for (let i = 0; i < 6; i++) jobs.push([heroAnimFrame({ s: 'emote', k: 'cheer', at: 0, dur: 1400 }, i * 100 + 10, 0), true, 'sword', 'cheer ' + i]);
      jobs.push([heroAnimFrame({ s: 'emote', k: 'sit', at: 0, dur: 0 }, 10, 0), true, 'sword', 'sit']);
      for (let i = 0; i < 24; i++) jobs.push([heroAnimFrame({ s: 'idle' }, 0, i * 200 + 3), false, 'sword', 'idle ' + i]);
      const stride = 2 * Math.PI * WALK_MS;
      for (let i = 0; i < 8; i++) jobs.push([heroAnimFrame({ s: 'walk' }, 0, (i + 0.5) / 8 * stride), false, 'sword', 'walk ' + i]);
      jobs.push([heroAnimFrame({ s: 'block' }, 0, 0), false, 'sword', 'block'], [heroAnimFrame({ s: 'tame', at: 0 }, 100, 0), false, 'sword', 'tame']);
      out.jobs = jobs.length;
      for (const px of [px16, px22]) for (const cls of (px === px16 ? classes : ['Knight'])) for (const [fr, wide, wk, label] of jobs) for (const face of [1, -1]) {
        const t0 = performance.now();
        const e = forgeBake(mk(cls, fr, { wide, wk, face: { x: face, y: 1 }, blocking: label === 'block' }), px);
        const ms = performance.now() - t0;
        out.times.push([wide, ms]);
        if (!e) { out.nulls++; continue; }
        const s = scan(e); out.tot++; e.cv.width = e.cv.height = 0;
        out.maxColours = Math.max(out.maxColours, s.colours);
        if (s.edge || s.badAlpha || s.colours > FI.FORGE_MAX_COLORS) out.edgeBad.push(`${cls} ${label} ${face} @${px.toFixed(3)}: edge ${s.edge} badAlpha ${s.badAlpha} colours ${s.colours}`);
      }
      return out;
    });
    for (const c of r.classes) console.log(`forge bake ${c.cls}: ${c.null ? 'null' : `${c.W}x${c.H} art px at ${c.px}, ${c.colours} colours (reported ${c.reported}), ${c.solid} solid px, ${c.badAlpha} partly transparent, ${c.ms.toFixed(2)} ms`}`);
    results.push([`Living World S2 forge (1): each of the ${r.classes.length} classes bakes a sword strike frame at forgeGrid(1.6).px (${r.px16}) into a canvas of only alpha 0 / 255 with at most ${r.FI.MAXC} colours (most used ${r.maxColours})`,
      r.classes.length === 5 && r.classes.every(c => !c.null && c.isCanvas && c.badAlpha === 0 && c.colours <= r.FI.MAXC && c.colours <= c.reported && c.reported <= r.FI.MAXC && c.solid > 150 && c.W > 20 && c.H > 20)]);
    results.push([`Living World S2 forge (2): the boxes never clip — ${r.tot} sprites (${r.jobs} state frames x 5 classes x both facings at 1.6x, plus the Knight at 2.2x) have no solid pixel on their outer edge, only alpha 0 / 255 and at most ${r.FI.MAXC} colours${r.edgeBad.length ? '; first offenders: ' + r.edgeBad.slice(0, 4).join(' | ') : ''}`,
      r.nulls === 0 && r.tot === r.jobs * (5 + 1) * 2 && r.edgeBad.length === 0]);
    const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    const tn = r.times.filter(t => !t[0]).map(t => t[1]), tw = r.times.filter(t => t[0]).map(t => t[1]), ta = r.times.map(t => t[1]).concat(r.classes.map(c => c.ms));
    const srt = ta.slice().sort((a, b) => a - b), p95 = srt[Math.floor(srt.length * 0.95)];
    console.log(`forge bake time over ${ta.length} bakes: average ${avg(ta).toFixed(2)} ms (narrow ${avg(tn).toFixed(2)}, wide ${avg(tw).toFixed(2)}), p95 ${p95.toFixed(2)}, max ${srt[srt.length - 1].toFixed(2)}`);
    results.push([`Living World S2 forge (4): a bake is cheap — over ${ta.length} bakes the average is ${avg(ta).toFixed(2)} ms (narrow ${avg(tn).toFixed(2)}, wide ${avg(tw).toFixed(2)}; limit 4 ms), p95 ${p95.toFixed(2)} ms`, avg(ta) < 4]);
  }
  {
    /* (3) standing still: the idle loop is 24 frames of 200 ms, so give the real loop longer than one loop to bake them all */
    await p.evaluate(() => { debugSetForge(false); debugSetForge(true); debugSetZoom(1.6); me.x = SPAWN.x + 0.5; me.y = SPAWN.y + 0.5; cam.x = me.x; cam.y = me.y; me.diving = false; });
    await p.waitForTimeout(7000);
    const r = await p.evaluate(async () => {
      const a = debugForgeInfo();
      await new Promise(res => { let n = 0; const f = () => { if (++n >= 60) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const b = debugForgeInfo();
      return { on: b.FORGE_ON, a: a.stats, b: b.stats, size: b.size, onBefore: a.FORGE_ON };
    });
    console.log(`standing still: bakes ${r.a.bakes} -> ${r.b.bakes}, hits ${r.a.hits} -> ${r.b.hits}, live ${r.a.live} -> ${r.b.live}, fallbacks ${r.a.fallbacks} -> ${r.b.fallbacks}, ${r.size} sprites cached, forge ${r.on ? 'on' : 'OFF'}`);
    results.push([`Living World S2 forge (3): standing still for 60 rendered frames adds no bake (${r.a.bakes} -> ${r.b.bakes}), no live draw (${r.a.live} -> ${r.b.live}) and no fallback (${r.a.fallbacks} -> ${r.b.fallbacks}); every frame is a cache hit (${r.b.hits - r.a.hits} hits), FORGE_ON stays true and nothing failed (${r.b.failures} failures)`,
      r.onBefore && r.on === true && r.b.bakes === r.a.bakes && r.b.live === r.a.live && r.b.fallbacks === r.a.fallbacks && r.b.hits - r.a.hits >= 55 && r.b.failures === 0 && r.size > 0]);
  }

  if (errs.length) results.push(['S4 run6: no page errors (' + errs.slice(0, 3).join(' | ') + ')', false]);
  await b.close();
  let ok = true;
  for (const [n, pass] of results) { console.log((pass ? 'PASS' : 'FAIL') + ' - ' + n); if (!pass) ok = false; }
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('RUN6 ERROR: ' + (e.stack || e)); process.exit(1); });
