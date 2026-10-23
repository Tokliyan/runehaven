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

  if (errs.length) results.push(['S4 run6: no page errors (' + errs.slice(0, 3).join(' | ') + ')', false]);
  await b.close();
  let ok = true;
  for (const [n, pass] of results) { console.log((pass ? 'PASS' : 'FAIL') + ' - ' + n); if (!pass) ok = false; }
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('RUN6 ERROR: ' + (e.stack || e)); process.exit(1); });
