/* s4fps.js — the S4 biome's frame cost in real frames per second, on vs off.
   Usage: node debug/s4fps.js [html] [biome] [dayT] [zoom...]
     biome  plains (default) — the PIXEL_BIOMES key to switch on and off
     dayT   0..1 world clock, default 0.45 (golden dusk, the slice's GIF hour)
     zoom   one or more view scales to measure at; default "1 1.6"

   The method is run6 section 2's, unchanged: one browser session, one camera
   position, `count(ms)` over requestAnimationFrame, and the two modes
   INTERLEAVED over 5 repetitions so a machine that slows down halfway through
   slows both of them. Switching a PIXEL_BIOMES switch resets the ground cache,
   so each mode gets 2.5 s to re-bake every visible chunk before it is counted
   (run6 gives the cache the same settle).

   Not a gate: it prints, it never fails. Playwright or Chromium missing prints
   "skipped" and exits 0, like run6 and shot.js. Stubbed Supabase, no network. */
const fs = require('fs'), path = require('path');
let pw;
try { pw = require('playwright'); }
catch (e) {
  try { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
  catch (e2) { console.log('skipped: playwright is not available (' + e.message.split('\n')[0] + ')'); process.exit(0); }
}
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'runehaven.html'));
const KEY = process.argv[3] || 'plains';
const DAYT = process.argv[4] === undefined ? 0.45 : +process.argv[4];
const ZOOMS = (process.argv.slice(5).length ? process.argv.slice(5) : ['1', '1.6']).map(Number);
const EXE = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
if (!fs.existsSync(EXE)) { console.log('skipped: no Chromium at ' + EXE); process.exit(0); }

const STUB = fs.readFileSync(path.join(__dirname, 'run6.js'), 'utf8').match(/const STUB = `([\s\S]*?)`;/)[1];

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
    document.getElementById('username').value = 'FpsBot';
    document.getElementById('pinInput').value = '2468';
    const u = document.getElementById('sbUrl'), k = document.getElementById('sbKey');
    if (u) u.value = 'https://stub.supabase.co'; if (k) k.value = 'stub-key';
    document.getElementById('enterBtn').onclick();
  });
  await p.waitForFunction(() => document.getElementById('login').style.display === 'none', null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');

  /* stand in the middle of a broad field of the biome, the same finder the
     capture tool uses, so the figure and the GIFs are the same ground */
  const spot = await p.evaluate(({ KEY, DAYT }) => {
    const BN = { plains: B.PLAINS, meadow: B.MEADOW, forest: B.FOREST, darkforest: B.DARKFOREST, sand: B.SAND };
    const want = BN[KEY];
    if (want === undefined) return { err: 'no biome ' + KEY };
    let best = null;
    for (let r = 4; r < 900 && !best; r += 3) for (let a = 0; a < 72 && !best; a++) {
      const x = Math.round(SPAWN.x + Math.cos(a / 72 * 6.283) * r), y = Math.round(SPAWN.y + Math.sin(a / 72 * 6.283) * r);
      if (biomeAt(x, y) !== want) continue;
      let same = 0;
      for (let oy = -5; oy <= 5; oy++) for (let ox = -5; ox <= 5; ox++) if (biomeAt(x + ox, y + oy) === want) same++;
      if (same > 100) best = { x, y };
    }
    if (!best) return { err: 'no spot ' + KEY };
    for (const m of mobs) if (Math.hypot(m.x - best.x, m.y - best.y) < 16) { m.x += 40; m.y += 40; }
    debugSetDayT(DAYT);
    me.x = best.x + 0.5; me.y = best.y + 0.5; cam.x = me.x; cam.y = me.y;
    return { at: best, biome: biomeAt(best.x, best.y) };
  }, { KEY, DAYT });
  if (spot.err) { console.log(spot.err); await b.close(); process.exit(1); }

  for (const z of ZOOMS) {
    await p.evaluate((z) => debugSetZoom(z), z);
    await p.waitForTimeout(800);
    const r = await p.evaluate(async ({ KEY }) => {
      const count = ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(f); });
      const out = { on: [], off: [] };
      for (let rep = 0; rep < 5; rep++) for (const mode of ['off', 'on']) {
        debugSetPb({ biomes: { [KEY]: mode === 'on' } });
        await new Promise(z2 => setTimeout(z2, 2500));      // the switch reset the ground cache: let it re-bake
        out[mode].push(await count(2000));
      }
      debugSetPb({ biomes: { [KEY]: false } });             // leave it as it ships
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      const st = debugPbInfo();
      return { on: avg(out.on), off: avg(out.off), onAll: out.on, offAll: out.off,
               sw: st.PIXEL_BIOMES, sprites: st.forgeCacheSize, bakes: st.stats.bakes, fails: st.stats.fails };
    }, { KEY });
    const cost = r.off / r.on;      // > 1 means the biome costs frames
    console.log(`${KEY} frame rate at zoom ${z}: on ${r.on.toFixed(1)} fps, off ${r.off.toFixed(1)} fps ` +
      `— frame COST x${cost.toFixed(3)} (limit 1.15) — on ${r.onAll.map(v => v.toFixed(1))}, off ${r.offAll.map(v => v.toFixed(1))}`);
    console.log(`  switches after: ${JSON.stringify(r.sw)}; forge cache ${r.sprites} sprites, ${r.bakes} bakes, ${r.fails} failed`);
  }
  if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 6).join(' | '));
  await b.close();
})();
