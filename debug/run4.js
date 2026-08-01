/* run3.js — REQUIRED pre-ship gate. Drives the real login path with a
   table-aware supabase stub and a complete realtime-channel stub, then pumps
   render frames manually to catch post-login crashes. Built after v13's
   black-screen bug slipped past run2, which only ever tested the login
   screen and never actually entered the world. Never skip this step. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const FILE = process.argv[2] || '../runehaven.html';
const html = fs.readFileSync(FILE, 'utf8');
const scripts = html.split('<script');
const gameScript = scripts[scripts.length - 1].split('>').slice(1).join('>').split('</script>')[0];
const bodyHtml = html
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^<]*<\/script>/, '')
  .replace(/<script>[\s\S]*<\/script>/, '');

const dom = new JSDOM(bodyHtml, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
const { window } = dom;

const ctx2d = new Proxy({}, {
  get(t, prop) {
    if (prop === 'canvas') return { width: 1280, height: 720 };
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
      return () => ({ addColorStop: () => {} });
    if (prop === 'measureText') return () => ({ width: 10 });
    if (typeof prop === 'string') return () => {};
    return undefined;
  },
  set() { return true; }
});
window.HTMLCanvasElement.prototype.getContext = () => ctx2d;
window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// table-aware supabase stub — extend tableData as new tables are added
const tableData = {
  world: { seed: 123456789, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  mined_nodes: [],
  players: null,          // null = new-player path
  ground_items: [],
  pets: [],
};
function chain(table) {
  const result = () => {
    const d = tableData[table];
    return { data: d === undefined ? null : d, error: null };
  };
  const c = new Proxy(function () {}, {
    get(t, prop) {
      if (prop === 'then') {
        const r = result();
        return (res) => res(r);
      }
      return (...a) => c;
    },
    apply() { return c; }
  });
  return c;
}
window.supabase = {
  createClient: () => ({
    from: (table) => chain(table),
    channel: () => {
      const ch = {
        on: () => ch,
        subscribe: (cb) => { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; },
        send: async () => {},
        track: async () => {},
        untrack: async () => {},
        presenceState: () => ({}),
      };
      return ch;
    },
    removeChannel: () => {},
  })
};

let rafQ = [];
window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };

let caught = null;
window.addEventListener('error', e => { if (!caught) caught = e.error || e.message; });

(async () => {
  try {
    window.eval(gameScript);
  } catch (e) { caught = e; }

  const doc = window.document;
  console.log('login cards:', doc.getElementById('classRow')?.children.length);

  // drive the real login: pick a class, set creds + name, click ENTER
  try {
    doc.querySelectorAll('.class-card')[3].click();      // Beastmaster
    doc.getElementById('username').value = 'BootTest';
    const urlEl = doc.getElementById('sbUrl'), keyEl = doc.getElementById('sbKey');
    if (urlEl) urlEl.value = 'https://stub.supabase.co';
    if (keyEl) keyEl.value = 'stub-key';
    doc.getElementById('enterBtn').onclick();
    await new Promise(r => setTimeout(r, 200));          // let the async login settle
  } catch (e) { if (!caught) caught = e; }

  console.log('login hidden:', doc.getElementById('login')?.style.display === 'none');
  console.log('login err text:', JSON.stringify(doc.getElementById('loginError')?.textContent || ''));

  // pump 5 real frames
  for (let f = 1; f <= 5 && !caught; f++) {
    const q = rafQ; rafQ = [];
    for (const cb of q) {
      try { cb(f * 16.6); } catch (e) { caught = e; break; }
    }
  }
  console.log('frames pumped, CAUGHT ERROR:', caught ? (caught.stack || caught) : 'none');

  // ===== targeted wear-down / taming-gate simulation =====
  // Login above is Beastmaster (class card index 3), so +25% applies.
  // Extend this block whenever new tameable species or modifiers ship.
  try {
    const cwdt = window.canWearDownTame, tcf = window.tameChanceFor;
    const mk = (kind, hp, maxHp, dead = false) => ({ id: kind + ':test', kind, hp, maxHp, dead });
    const results = [];
    if (cwdt && tcf) {
      results.push(['gate CLOSED at full hp',        cwdt(mk('bear', 80, 80)) === false]);
      results.push(['gate CLOSED just above 25%',    cwdt(mk('bear', 21, 80)) === false]);
      results.push(['gate OPEN at exactly 25%',      cwdt(mk('bear', 20, 80)) === true]);
      results.push(['gate OPEN below 25%',           cwdt(mk('bear', 5, 80)) === true]);
      results.push(['gate CLOSED when dead',         cwdt(mk('bear', 5, 80, true)) === false]);
      results.push(['gate CLOSED for troll (never)', cwdt(mk('troll', 5, 90)) === false]);
      results.push(['gate CLOSED for goblin',        cwdt(mk('goblin', 5, 40)) === false]);
      const bearC = tcf({ id: 'bear:test', species: 'bear' }, false);
      results.push(['bear chance = base .40 + BM .25 = .65', Math.abs(bearC - 0.65) < 1e-9]);
      const phC = tcf({ id: 'phoenix:test', species: 'phoenix' }, true);
      results.push(['phoenix baited = .30+.25+.15 = .70', Math.abs(phC - 0.70) < 1e-9]);
      const boarC = tcf({ id: 'boar:test', species: 'boar' }, false);
      results.push(['boar chance = .45+.25 = .70', Math.abs(boarC - 0.70) < 1e-9]);
    } else {
      results.push(['canWearDownTame/tameChanceFor exist', false]);
    }
    // ===== v16 pet-combat stat table (locked spec — do not "improve") =====
    const pcd = window.petCombatDef;
    if (pcd) {
      const TBL = [
        ['wolf', 30, 4, 1500, false], ['bear', 55, 8, 2200, false], ['boar', 35, 6, 1300, false],
        ['griffin', 40, 7, 1600, false], ['golem', 60, 5, 2500, false],
        ['phoenix', 50, 10, 1500, true], ['shadowfox', 50, 10, 1300, true],
        // v17 — locked spec table, attached to the three new species
        ['stag', 25, 3, 1800, false], ['unicorn', 45, 8, 1600, true], ['lightfox', 50, 10, 1300, true],
      ];
      for (const [s, hp, dmg, cd, pvp] of TBL) {
        const d = pcd(s, 'Ranger');
        results.push([`pet ${s} = ${hp}hp/${dmg}dmg/${cd}ms/pvp:${pvp}`,
          !!d && d.hp === hp && d.dmg === dmg && d.cdMs === cd && d.pvp === pvp]);
      }
      // bible trait: Beastmaster grants the active pet +20% HP and damage
      const bw = pcd('wolf', 'Beastmaster');
      results.push(['BM wolf +20% -> 36hp/5dmg', !!bw && bw.hp === 36 && bw.dmg === 5]);
      const bg = pcd('golem', 'Beastmaster');
      results.push(['BM golem +20% -> 72hp/6dmg', !!bg && bg.hp === 72 && bg.dmg === 6]);
      const bp = pcd('phoenix', 'Beastmaster');
      results.push(['BM phoenix +20% -> 60hp/12dmg', !!bp && bp.hp === 60 && bp.dmg === 12]);
      // Common pets have NO combat role at all
      for (const s of ['tree_sprite', 'water_sprite', 'stone_sprite', 'wind_sprite']) {
        results.push([`${s} has no combat role`, pcd(s, 'Beastmaster') === null]);
      }
      // species from the locked table that aren't implemented yet must NOT
      // be pre-built — extend this list as each one actually ships
      for (const s of ['glow_moth', 'crystal_golem', 'basilisk',
                       'krakenling', 'salamander_king', 'duskfox_elder',
                       'golem_elder', 'dragon_elder', 'unicorn_elder']) {
        results.push([`${s} not pre-built`, pcd(s, 'Beastmaster') === null]);
      }
    } else {
      results.push(['petCombatDef exists', false]);
    }

    // ===== v17 time-window gates =====
    // Night runs dayT 0.5..1.0 (nightAlpha); dawn is the first 7% of the
    // cycle (DAWN_END), which sits inside duskGlow's dawn lobe.
    const vis = window.speciesVisibleAt;
    if (vis) {
      // Unicorn: night-only, exactly like the Shadowfox gate
      results.push(['unicorn hidden at midday (dayT .25)',  vis('unicorn', 0.25) === false]);
      results.push(['unicorn hidden at dawn (dayT .03)',    vis('unicorn', 0.03) === false]);
      results.push(['unicorn hidden just before dusk (.5)', vis('unicorn', 0.5) === false]);
      results.push(['unicorn VISIBLE deep in night (.75)',  vis('unicorn', 0.75) === true]);
      // Lightfox: dawn-only, a strictly narrower window than night
      results.push(['lightfox VISIBLE at dawn (dayT 0)',    vis('lightfox', 0) === true]);
      results.push(['lightfox VISIBLE late dawn (.069)',    vis('lightfox', 0.069) === true]);
      results.push(['lightfox hidden just past dawn (.07)', vis('lightfox', 0.07) === false]);
      results.push(['lightfox hidden at midday (.25)',      vis('lightfox', 0.25) === false]);
      results.push(['lightfox hidden at night (.75)',       vis('lightfox', 0.75) === false]);
      // the dawn window really is narrower than night
      let dawnN = 0, nightN = 0;
      for (let i = 0; i < 1000; i++) {
        if (vis('lightfox', i / 1000)) dawnN++;
        if (vis('unicorn', i / 1000)) nightN++;
      }
      results.push(['dawn window narrower than night', dawnN > 0 && dawnN < nightN]);
      // Stag has no time gate at all
      results.push(['stag visible day and night',
        vis('stag', 0.25) === true && vis('stag', 0.75) === true]);
      results.push(['unknown species never visible', vis('nope', 0.25) === false]);
    } else {
      results.push(['speciesVisibleAt exists', false]);
    }

    // ===== v17 worldgen sanity: the rare-variant biomes must be reachable =====
    // An unreachable biome is a threshold bug, not a design choice.
    const btc = window.biomeTileCounts;
    if (btc) {
      const counts = btc();
      const ench = counts.ENCHANTED || 0, sacr = counts.SACRED || 0;
      console.log('worldgen: ENCHANTED', ench, 'tiles, SACRED', sacr, 'tiles,',
                  'DARKFOREST', counts.DARKFOREST || 0, '(seed', tableData.world.seed + ')');
      results.push(['Enchanted Forest tiles exist in the seeded world', ench >= 1]);
      results.push(['Sacred Meadow tiles exist in the seeded world', sacr >= 1]);
      // still a rare variant, not a takeover of its parent biome
      results.push(['Enchanted Forest stays sparse (< 8% of map)', ench < 0.08 * 80 * 80]);
      results.push(['Sacred Meadow stays sparse (< 8% of map)', sacr < 0.08 * 80 * 80]);
      results.push(['parent Forest biome survives', (counts.FOREST || 0) > ench]);
    } else {
      results.push(['biomeTileCounts exists', false]);
    }

    let allOk = true;
    for (const [n, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n); if (!ok) allOk = false; }
    process.exit(allOk && !caught ? 0 : 1);
  } catch (e) {
    console.log('SIM ERROR:', e.stack || e);
    process.exit(1);
  }
})();
