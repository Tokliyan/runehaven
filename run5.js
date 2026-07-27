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

  // ===== exhaustive branch-coverage sweep =====
  // Executes every class/weapon/armor/species/mob-state combination once.
  // The 5-frame boot above can't reach content spawned far from camera —
  // this is what actually caught v13's mob-render duplication bug and is
  // required whenever species/mobs/gear are added or reworked.
  // EXTEND the *_LIST arrays below whenever new content ships.
  try {
    const c = window.document.createElement('canvas').getContext('2d');
    const CLS = ["Ranger", "Knight", "Mystic", "Beastmaster", "Architect"];
    const KINDS = ["sword", "dagger", "spear", "axe", "bow", "crossbow", "staff"];
    const SPECIES = ["tree_sprite", "water_sprite", "stone_sprite", "wind_sprite", "wolf", "golem",
                      "shadowfox", "boar", "bear", "griffin", "phoenix"];
    const MOBK = ["goblin", "bandit", "troll", "boar", "bear", "griffin", "phoenix"];
    let n = 0;
    if (window.drawUnit) {
      for (const cls of CLS) {
        for (const wk of [null, ...KINDS]) {
          for (const at of [null, "iron", "runic"]) {
            window.drawUnit(c, 50, 50, cls, 2.1, "runic", { x: 1, y: 0 }, 700, true, wk, at, false);
            window.drawUnit(c, 50, 50, cls, 2.1, "dragonsteel", { x: -1, y: 0 }, 700, true, wk, at, true);
            n += 2;
          }
        }
      }
    }
    if (window.drawSpecies) {
      for (const sp of SPECIES) { window.drawSpecies(sp, 80, 80, 900, true); window.drawSpecies(sp, 80, 80, 900, false); n += 2; }
    }
    if (window.drawMob) {
      for (const mk of MOBK) {
        for (const st of ["idle", "aggro", "attack", "cower"]) {
          for (const winding of [false, true]) {
            const m = { id: mk + ':cov', kind: mk, x: 41, y: 51, hx: 41, hy: 51, hp: st === "cower" ? 10 : 60, maxHp: 80,
                        state: st, winding, flash: 0, fx: winding ? -1 : 1, fy: 0, dead: false, target: null, ph: 1 };
            window.drawMob(m, 800);
            n += 1;
          }
        }
      }
    }
    console.log('coverage draws:', n, '— CAUGHT:', caught ? (caught.stack || caught) : 'none');
    process.exit(caught ? 1 : 0);
  } catch (e) {
    console.log('COVERAGE CRASH:', e.stack || e);
    process.exit(1);
  }
})();
