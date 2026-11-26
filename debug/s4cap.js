/* S4 world capture (for the owner's before/after GIFs): node debug/s4cap.js <outdir> <html> <spot> <dayT> <frames> <pb:on|off> [weather] [gapMs]
   spot: plains | meadow | forest | darkforest | sand | coast | border:<a>:<b> (a tile of biome a with biome b in view)
   pb: a biome key or comma list (plains, meadow, forest, darkforest, sand, coast, plains,meadow) = ONLY those switches on (the "after" look while the shipped switch is still false); off = every S4 biome
   switch off (the "before" look, same as main); on = the build's own switches; all = every switch on.
   dayT: 0..1 world clock (0.25 morning, 0.45 golden dusk; pick a night value where nightAlpha(dayT) >= 0.6).
   Enters the real world (stubbed Supabase), stands there, warms up, saves canvas frames. */
const fs = require('fs'), path = require('path'), pw = require('playwright');
const [OUT, FILE, SPOT, DAYT, NF, PB, WX, GAP] = process.argv.slice(2);
const STUB = fs.readFileSync(path.join(__dirname, 'shot.js'), 'utf8').match(/const STUB = `([\s\S]*?)`;/)[1];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue();
    if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB }); return r.abort(); });
  await p.goto('file://' + path.resolve(FILE)); await p.waitForTimeout(1200);
  await p.evaluate(() => { document.querySelectorAll('.class-card')[0].click(); document.getElementById('username').value = 'Harsh';
    document.getElementById('pinInput').value = '2468'; const u = document.getElementById('sbUrl'), k = document.getElementById('sbKey');
    if (u) u.value = 'https://stub.supabase.co'; if (k) k.value = 'stub-key'; document.getElementById('enterBtn').onclick(); });
  await p.waitForFunction(() => document.getElementById('login').style.display === 'none', null, { timeout: 90000 });
  await p.waitForTimeout(2000); await p.keyboard.press('Escape');
  const info = await p.evaluate(async ({ SPOT, DAYT, NF, PB, WX, GAP }) => {
    const BN = { plains: B.PLAINS, meadow: B.MEADOW, forest: B.FOREST, darkforest: B.DARKFOREST, sand: B.SAND, coast: B.SAND };
    if (PB === 'off' && typeof debugSetPb === 'function') debugSetPb({ biomes: { plains: false, meadow: false, forest: false, darkforest: false, sand: false, coast: false } });
    if (!['on', 'off', 'all'].includes(PB) && typeof debugSetPb === 'function') {   // any comma list of biome keys: ONLY those switches on (plains | meadow | plains,meadow | ...)
      const keys = String(PB).split(','), bi = { plains: false, meadow: false, forest: false, darkforest: false, sand: false, coast: false };
      for (const k of keys) if (k in bi) bi[k] = true; debugSetPb({ biomes: bi }); }
    if (PB === 'all' && typeof debugSetPb === 'function') debugSetPb({ biomes: { plains: true, meadow: true, forest: true, darkforest: true, sand: true, coast: true } });
    window.updateMob = function () {}; window.drawPlayerPlate = () => {}; window.queueWorldLabel = () => {};
    let want, other = null;
    if (SPOT.startsWith('border:')) { const s = SPOT.split(':'); want = BN[s[1]]; other = BN[s[2]]; } else want = BN[SPOT];
    let best = null;
    for (let r = 4; r < 900 && !best; r += 3) for (let a = 0; a < 72 && !best; a++) {
      const x = Math.round(SPAWN.x + Math.cos(a / 72 * 6.283) * r), y = Math.round(SPAWN.y + Math.sin(a / 72 * 6.283) * r);
      if (biomeAt(x, y) !== want) continue;
      let same = 0, oth = 0, sea = 0;
      for (let oy = -5; oy <= 5; oy++) for (let ox = -5; ox <= 5; ox++) { const q = biomeAt(x + ox, y + oy);
        if (q === want) same++; if (other !== null && q === other) oth++; if (q === B.SHALLOW || q === B.WATER) sea++; }
      if (other !== null ? (same > 45 && oth > 35) : SPOT === 'coast' ? (sea > 25 && same > 30) : same > 100) best = { x, y };
    }
    if (!best) return { err: 'no spot ' + SPOT };
    for (const m of mobs) { if (Math.hypot(m.x - best.x, m.y - best.y) < 16) { m.x += 40; m.y += 40; } }
    debugSetDayT(+DAYT); me.x = best.x + 0.5; me.y = best.y + 0.5; cam.x = me.x; cam.y = me.y;
    if (WX && WX !== '-' && typeof debugSetWeather === 'function') try { debugSetWeather({ force: WX }); } catch (e) {}
    await new Promise(r => setTimeout(r, 1500));
    const tW0 = performance.now(); while (performance.now() - tW0 < 2500) await new Promise(r => requestAnimationFrame(() => r()));
    const shots = [];
    for (let f = 0; f < +NF; f++) {
      await new Promise(r => requestAnimationFrame(() => r()));
      shots.push(canvas.toDataURL('image/png'));
      await new Promise(r => setTimeout(r, +(GAP || 110)));
    }
    window.__shots = shots;
    return { at: best, biome: biomeAt(best.x, best.y), n: shots.length, weather: curWeather,
      pb: typeof debugPbInfo === 'function' ? { sw: debugPbInfo().PIXEL_BIOMES, st: debugPbInfo().stats } : null };
  }, { SPOT, DAYT, NF, PB, WX, GAP });
  if (info.err) { console.log(info.err); process.exit(1); }
  for (let i = 0; i < info.n; i++) { const u = await p.evaluate(i => window.__shots[i], i); fs.writeFileSync(`${OUT}/${String(i).padStart(3, '0')}.png`, Buffer.from(u.split(',')[1], 'base64')); }
  console.log(JSON.stringify({ at: info.at, n: info.n, weather: info.weather, sw: info.pb && info.pb.sw, tufts: info.pb && info.pb.st.tufts, fails: info.pb && info.pb.st.fails }));
  if (errs.length) console.log('ERRS', errs.slice(0, 6).join('\n'));
  await b.close();
})();
