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
/* Mobile & Touch PART E: MOBILE=1 runs the SAME tour in a touch context at
   phone size, saves everything under the 50-m- prefix, adds one portrait
   shot, and measures the HUD rectangles — jsdom has no layout engine, so a
   real browser is the only place the "the HUD fits a phone" claim can be
   checked at all. Nothing about the default 1280x720 desktop tour changes. */
const MOBILE = !!process.env.MOBILE && process.env.MOBILE !== '0';
const PRE = MOBILE ? '50-m-' : '';
const PHONE = { width: 844, height: 390 };          // iPhone landscape
const PHONE_PORTRAIT = { width: 390, height: 844 };
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
  const p = await b.newPage(MOBILE
    ? { viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1280, height: 720 } });
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
  await p.screenshot({ path: path.join(OUT, PRE + '00-title.png') });
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
  await p.screenshot({ path: path.join(OUT, PRE + '01-spawn.png') });
  /* PART E: the tour is judged on the touch LAYOUT, so it is forced on here
     rather than left to the emulated pointer type — and what the automatic
     detection would have said is printed, so the two can be compared. */
  if (MOBILE) {
    const det = await p.evaluate(() => {
      const before = debugTouchInfo();
      setSetting('touchControls', 'on');
      return { auto: before.coarse, mode: debugTouchInfo().mode, on: debugTouchInfo().on };
    });
    console.log('MOBILE: (pointer: coarse) detected ' + det.auto +
                ', forced mode ' + det.mode + ', layer on ' + det.on);
  }
  /* Dismiss the tutorial banner so it does not cover shots. */
  await p.keyboard.press('Escape');
  const snap = async (name) => { await p.waitForTimeout(1500); await p.screenshot({ path: path.join(OUT, PRE + name + '.png') }); console.log('shot', PRE + name); };
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
  /* PART B hides the bottom-left help card on a touch layout and PART D puts
     the list in the menu, so in MOBILE mode the list is opened the way a
     thumb opens it. The desktop tour still clicks the [?] itself. */
  const helpToggle = async () => {
    if (MOBILE) return p.evaluate(() => { touchSetMenu(true); touchToggleHelp(); touchSetMenu(false); });
    await p.click('#helpToggle');
  };
  await helpToggle();
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
  console.log('help-open overlap: ' + (overlap.length ? overlap.join(', ') : 'none') +
              (MOBILE ? '  (touch layout: PART B makes the open list a CENTRED overlay card, so a' +
                        ' corner card under it is the intended look, not the desktop bug PART E fixed)' : ''));

  /* And the compass card on its own, at the Grand Bazaar, where the labels
     collided. Clipped to the card so the labels are big enough to read. */
  const mm = await p.$('#hudMinimap');
  const box = mm && await mm.boundingBox();
  if (box) {
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, PRE + '43-compass.png'),
      clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: box.width + 12, height: box.height + 12 } });
    console.log('shot ' + PRE + '43-compass');
  } else console.log('no #hudMinimap box for 43-compass');
  await helpToggle();

  /* ---- PART E: the HUD really does fit a phone ---------------------------
     The eight rectangles the spec names, measured in a real browser at both
     orientations, plus the four the doubt pass showed were worth measuring
     (the HP bar, the ☰, the open help overlay and an open panel), and every
     intersecting pair printed.

     The CARDS are the gate: none of them may overlap another. #touchStick
     and the button cluster are judged separately, and the reason is NOT that
     the stick is pass-through — it is `pointer-events: auto`, which is the
     whole point of it. It is that the stick's zone is the left 45% of the
     bottom 65% of the screen by the spec's own numbers, a 390px-high screen
     cannot fit the top column above its edge, and every HUD card is
     `pointer-events: none` and so takes no input whether the stick is over
     it or not. What that exemption must never hide is a card the stick can
     actually spoil, which is why the HP bar — drawn under the 112px stick
     circle when it sat down there — is now measured by name. */
  if (MOBILE) {
    const CARDS = ['player card', 'day card', 'compass', 'minimap', '#hudZone',
                   '#hudPrompt', 'HP bar', 'the menu button'];
    const measure = () => p.evaluate(() => {
      const ids = { 'player card': 'hudPlayer', 'day card': 'hudWorld',
                    'compass': 'hudMinimap', 'minimap': 'hudMap',
                    '#hudZone': 'hudZone', '#hudPrompt': 'hudPrompt',
                    'HP bar': 'hpBarWrap', 'the menu button': 'touchMenuBtn',
                    '#touchStick': 'touchStick', 'button cluster': 'touchCluster' };
      const out = {};
      for (const k in ids) {
        const e = document.getElementById(ids[k]);
        if (!e) { out[k] = null; continue; }
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') { out[k] = null; continue; }
        const r = e.getBoundingClientRect();
        out[k] = (r.width > 0 && r.height > 0)
          ? { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }
          : null;
      }
      return out;
    });
    const report = async (label) => {
      const rects = await measure();
      const names = Object.keys(rects);
      for (const n of names)
        console.log('  ' + label + ' ' + n + ': ' +
          (rects[n] ? rects[n].l + ',' + rects[n].t + ' -> ' + rects[n].r + ',' + rects[n].b : 'not shown'));
      const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const cardPairs = [], zonePairs = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        if (!hit(rects[names[i]], rects[names[j]])) continue;
        const both = CARDS.includes(names[i]) && CARDS.includes(names[j]);
        (both ? cardPairs : zonePairs).push(names[i] + ' / ' + names[j]);
      }
      console.log(label + ' HUD CARD pairs that intersect: ' + (cardPairs.length ? cardPairs.join(', ') : 'none'));
      console.log(label + ' control-zone overlaps (expected, pass-through): ' +
                  (zonePairs.length ? zonePairs.join(', ') : 'none'));
      return cardPairs;
    };
    await p.waitForTimeout(600);
    await report('[844x390]');
    /* The doubt pass's two lockouts, asked of the browser rather than argued
       about: with a panel open, and with the help overlay open, is the ☰
       still the thing under the ☰? */
    const reachable = async (label) => {
      const r = await p.evaluate(() => {
        const b = document.getElementById('touchMenuBtn').getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return hit ? (hit.id || hit.className || hit.tagName) : 'nothing';
      });
      console.log(label + ' the ☰ is reachable: ' + (r === 'touchMenuBtn') + '  (topmost there: ' + r + ')');
      return r === 'touchMenuBtn';
    };
    await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: KEYBINDS.inventory })); });
    await p.waitForTimeout(300);
    await reachable('[844x390, Inventory open]');
    const panelFits = await p.evaluate(() => {
      const b = document.getElementById('invPanel').getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top),
               b: Math.round(b.bottom), vw: innerWidth, vh: innerHeight,
               fits: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight };
    });
    console.log('[844x390] Inventory panel on screen: ' + JSON.stringify(panelFits));
    await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: KEYBINDS.inventory })); });
    await helpToggle();
    await p.waitForTimeout(300);
    await reachable('[844x390, help overlay open]');
    await helpToggle();
    /* And BUILD, the panel whose own id rule beat the touch position. */
    await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: KEYBINDS.build })); });
    await p.waitForTimeout(300);
    console.log('[844x390] Build panel on screen: ' + JSON.stringify(await p.evaluate(() => {
      const b = document.getElementById('buildPanel').getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), vw: innerWidth,
               fits: b.left >= 0 && b.right <= innerWidth };
    })));
    await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: KEYBINDS.build })); });
    /* The ☰ row at the size that could not show it: how many of the eight
       are on screen, and does the rest really scroll? */
    console.log('[844x390] menu row: ' + JSON.stringify(await p.evaluate(() => {
      touchSetMenu(true);
      const m = document.getElementById('touchMenu');
      const vis = [].slice.call(m.children).filter(c => c.getBoundingClientRect().bottom <= m.getBoundingClientRect().bottom + 1).length;
      m.scrollTop = 9999;
      const scrolled = m.scrollTop;
      const lastVisible = m.lastElementChild.getBoundingClientRect().bottom <= m.getBoundingClientRect().bottom + 1;
      m.scrollTop = 0; touchSetMenu(false);
      return { of: m.children.length, visibleWithoutScrolling: vis,
               scrollable: scrolled > 0, lastReachableByScrolling: lastVisible };
    })));
    await p.setViewportSize(PHONE_PORTRAIT);
    await p.waitForTimeout(1200);
    /* PART C: the portrait hint, which is the one element allowed to overlap
       anything. Shot with it up, then measured with it dismissed. */
    await p.screenshot({ path: path.join(OUT, PRE + '90-portrait.png') });
    console.log('shot ' + PRE + '90-portrait');
    console.log('[390x844] portrait card shown: ' +
      await p.evaluate(() => debugTouchInfo().portraitShown));
    await p.evaluate(() => { debugSetTouchPortraitDismissed(true); applyPortraitCard(); });
    await p.waitForTimeout(600);
    await report('[390x844]');
    /* The doubt pass's text-size bug: the stacking measures post-zoom screen
       pixels and writes pre-zoom CSS, so SMALL and LARGE have to be checked
       in a browser or not at all. Three sizes, no screenshots. */
    for (const size of ['small', 'large', 'medium']) {
      await p.evaluate(s => { setSetting('textSize', s); applyTouchLayout(); }, size);
      await p.waitForTimeout(400);
      await report('[390x844 text=' + size + ']');
    }
    /* And the login card at 390 wide, which is where the title ran off both
       edges before PART B's clamp. */
    const title = await p.evaluate(() => {
      const h1 = document.querySelector('#login h1');
      if (!h1) return null;
      const r = h1.getBoundingClientRect();
      return { w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right),
               font: getComputedStyle(h1).fontSize, vw: window.innerWidth };
    });
    console.log('[390x844] RUNEHAVEN title: ' + JSON.stringify(title));
    await p.setViewportSize(PHONE);
  }

  console.log(errs.slice(0, 10).join('\n') || 'no page errors');
  await b.close();
})();
