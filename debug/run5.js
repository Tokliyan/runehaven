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
  base_pieces: [],       // v33
  pets: [],
};
/* v33: base pieces are minted by their insert, so a stub that never records
   one means placeBasePiece() always refunds and the whole render branch for
   built structures stays unreachable. Scoped to this one table by name. */
const INSERT_RECORDING = new Set(['base_pieces']);
let insertSeq = 0;
function chain(table) {
  let pending = null;
  const result = () => {
    if (pending) { const r = pending; pending = null; return { data: r, error: null }; }
    const d = tableData[table];
    return { data: d === undefined ? null : d, error: null };
  };
  const c = new Proxy(function () {}, {
    get(t, prop) {
      if (prop === 'then') {
        const r = result();
        return (res) => res(r);
      }
      if (prop === 'insert' && INSERT_RECORDING.has(table)) {
        return (rows) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          const stamped = arr.map(r => Object.assign({ id: table + ':' + (++insertSeq) }, r));
          tableData[table].push(...stamped);
          pending = stamped;
          return c;
        };
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
    /* v19: the world is 240x240 (9x the old area), so worldgen + bakeTerrain
       now take ~300ms — a fixed 200ms sleep expired BEFORE login finished and
       every later assertion silently ran against a world that was never
       entered. Wait for the real completion signal instead of a guess. */
    const t0 = Date.now();
    while (doc.getElementById('login').style.display !== 'none' && Date.now() - t0 < 60000)
      await new Promise(r => setTimeout(r, 25));
    console.log('login settled after', Date.now() - t0, 'ms');
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
                      "shadowfox", "boar", "bear", "griffin", "phoenix",
                      "stag", "unicorn", "lightfox",                      // v17
                      "fire_dragon", "glow_moth",                         // v18
                      "water_dragon",                                     // v21
                      "storm_dragon", "shadow_dragon",                    // v22
                      "crystal_golem", "krakenling", "salamander_king"];  // v25
    const MOBK = ["goblin", "bandit", "troll", "boar", "bear", "griffin", "phoenix",
                  "dark_wraith",                                          // v18
                  "sea_serpent",                                          // v21
                  // v25: the Salamander King's hostile rampage form. It is
                  // tameable:true, so it renders through drawSpecies like the
                  // v14 beasts — sweep every mob state over that path too.
                  "salamander_king"];
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
            // v18: the Dark Wraith's ranged-strike bolt only draws with a live
            // target and a fresh boltT, so the null-target pass above can never
            // reach it — exercise both halves of that branch explicitly.
            if (mk === "dark_wraith") {
              window.drawMob({ ...m, target: { x: 44, y: 53 }, boltT: performance.now() }, 800);
              window.drawMob({ ...m, target: { x: 44, y: 53 }, boltT: performance.now() - 9999 }, 800);
              n += 2;
            }
          }
        }
      }
    }
    /* v23: the colourblind palette is a real render branch — the weakened
       tame ring, the mob HP bar and the weakened name tag all read tameCol()
       / tameRgb(). Sweep every mob through BOTH sides of it, and both sides
       of the reduce-motion gate. EXTEND THIS whenever another colour or
       ambient effect learns a v23 twin. */
    if (window.drawMob && window.setSetting && window.debugSettingsInfo) {
      const wasCB = window.debugSettingsInfo().SETTINGS.colorblind;
      for (const cbOn of [true, false]) {
        window.setSetting('colorblind', cbOn);
        for (const mk of MOBK) {
          // hp well under the wear-down gate, so the weakened treatment draws
          const m = { id: mk + ':cb', kind: mk, x: 41, y: 51, hx: 41, hy: 51, hp: 4, maxHp: 80,
                      state: "cower", winding: false, flash: 0, fx: 1, fy: 0,
                      dead: false, target: null, ph: 1 };
          window.drawMob(m, 800);
          n += 1;
        }
      }
      window.setSetting('colorblind', wasCB);
      if (window.updateParticles) {
        const wasRM = window.debugSettingsInfo().SETTINGS.reduceMotion;
        for (const rmOn of [true, false]) {
          window.setSetting('reduceMotion', rmOn);
          for (let i = 0; i < 20; i++) { window.updateParticles(0.05, 500000 + i * 50); n += 1; }
        }
        window.setSetting('reduceMotion', wasRM);
      }
    }
    // v16: pet combat render states — following, lunging, damaged, downed.
    // Uses a stand-in host so the local-only overlays are exercised directly.
    if (window.drawPet && window.petOverlays) {
      const nowMs = 1000;
      for (const sp of SPECIES) {
        for (const st of ["idle", "lunge", "hurt", "downed"]) {
          const pet = {
            sp, x: 41, y: 51, ang: 0, moving: st === "idle",
            maxHp: 40, hp: st === "hurt" ? 12 : st === "downed" ? 0 : 40,
            atkAt: 0, downedUntil: st === "downed" ? nowMs + 40000 : 0,
            swingT: st === "lunge" ? nowMs : 0, ax: 1, ay: 0,
            flash: st === "hurt" ? nowMs : 0,
          };
          window.drawPet({ pet }, sp, 900);
          window.petOverlays(pet, 60, 60, nowMs, st === "downed", 60, 62);
          n += 2;
        }
      }
    }
    // v17: the two new gatherable node drawers + an Enchanted-Forest tree,
    // none of which the 5-frame boot is guaranteed to reach.
    if (window.drawHerbNode && window.drawEssenceNode) {
      for (let i = 0; i < 4; i++) {
        const f = { type: 'herb', x: 40.5, y: 50.5, tx: 40 + i, ty: 50, key: (40 + i) + ',50', h: 0.9 };
        window.drawHerbNode(f, 900 + i * 250);
        window.drawEssenceNode({ ...f, type: 'essence' }, 900 + i * 250);
        n += 2;
      }
    }
    if (window.drawTree && window.biomeAt && window.debugWorldInfo) {
      const { N, B } = window.debugWorldInfo();
      for (const target of [B.ENCHFOREST, B.SACMEADOW, B.FOREST, B.DARKFOREST]) {
        let hit = null;
        for (let y = 0; y < N && !hit; y++) for (let x = 0; x < N; x++) {
          if (window.biomeAt(x, y) === target) { hit = [x, y]; break; }
        }
        if (!hit) continue;
        window.drawTree({ type: 'tree', x: hit[0] + 0.5, y: hit[1] + 0.5, tx: hit[0], ty: hit[1],
                          key: hit.join(','), h: 0.8 }, 900);
        n += 1;
      }
    }
    // v18: the Underground Caves ground treatment is baked inside bakeTerrain(),
    // which paints EVERY tile of the map at boot — so the boot above has already
    // executed that branch. Report the tile count so a silently-empty biome
    // (which would mean the branch never ran) is visible here too.
    if (window.biomeAt && window.debugWorldInfo) {
      const { N, B } = window.debugWorldInfo();
      let cave = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (window.biomeAt(x, y) === B.UNDERCAVE) cave++;
      }
      console.log('undercave tiles baked this seed:', cave);
      if (!cave) { console.log('COVERAGE GAP: no B.UNDERCAVE tile — cave ground art never drew'); process.exit(1); }
      /* v21: the same check for the Underwater Caves ground treatment, which
         is baked by the same whole-map pass. An empty biome here means the
         branch never ran AND the biome is unreachable — a harder failure than
         elsewhere, since the dive mechanic exists to reach exactly these. */
      let uwc = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (window.biomeAt(x, y) === B.UWCAVE) uwc++;
      }
      console.log('uwcave tiles baked this seed:', uwc);
      if (!uwc) { console.log('COVERAGE GAP: no B.UWCAVE tile — underwater cave ground art never drew'); process.exit(1); }
      /* v22: the same check for the two new pockets. Both ground treatments
         are baked by the same whole-map pass, so a zero count means the
         branch never ran AND the biome is unreachable — and for the Hollow
         that also means the Shadow Dragon has nowhere to spawn. */
      let aby = 0, cald = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const b = window.biomeAt(x, y);
        if (b === B.ABYSSAL) aby++;
        else if (b === B.CALDERA) cald++;
      }
      console.log('abyssal tiles baked this seed:', aby);
      if (!aby) { console.log('COVERAGE GAP: no B.ABYSSAL tile — Abyssal Hollow ground art never drew'); process.exit(1); }
      console.log('caldera tiles baked this seed:', cald);
      if (!cald) { console.log('COVERAGE GAP: no B.CALDERA tile — Sunforge Caldera ground art never drew'); process.exit(1); }
    }
    /* v22: the Caldera's animated heat shimmer lives in drawWorld()'s tile
       loop, not in the bake, so it only runs when a caldera tile is actually
       on camera — which the 5-frame boot at spawn never is. Put the camera on
       one and pump frames so the branch is really executed. */
    if (window.debugSetPlayer && window.biomeAt && window.debugWorldInfo) {
      const { N, B } = window.debugWorldInfo();
      const before5 = window.debugWorldInfo().player;
      for (const target of [B.CALDERA, B.ABYSSAL]) {
        let hit = null;
        for (let y = 0; y < N && !hit; y++) for (let x = 0; x < N; x++) {
          if (window.biomeAt(x, y) === target) { hit = [x, y]; break; }
        }
        if (!hit) continue;
        window.debugSetPlayer({ x: hit[0] + 0.5, y: hit[1] + 0.5,
                                diving: target === B.ABYSSAL });
        for (let f = 60; f < 66; f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
          n += 1;
        }
      }
      if (before5) window.debugSetPlayer({ x: before5.x, y: before5.y, diving: !!before5.diving });
    }
    /* v21: the dive-state render. The 5-frame boot enters the world surfaced
       on dry land, so the diver's bubble cue never draws there — and it is
       local-player-only, so no remote unit can reach it either. Draw it
       directly, and then drive the real drawPlayerEntity() path with the
       player actually diving so the branch that calls it is covered too. */
    if (window.diveCue) {
      for (let i = 0; i < 4; i++) { window.diveCue(120, 90, 700 + i * 260); n += 1; }
    }
    if (window.debugSetPlayer && window.debugWorldInfo) {
      const before = window.debugWorldInfo().player;
      window.debugSetPlayer({ diving: true });
      for (let f = 40; f < 46; f++) {
        const q = rafQ; rafQ = [];
        for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
        n += 1;
      }
      window.debugSetPlayer({ diving: !!(before && before.diving) });
    }
    /* v20: the Ruin set pieces. Every cluster is now placed far out in the
       world by a hashed sweep, so the 5-frame boot is not guaranteed to have
       any of them on camera — exactly the gap this sweep exists to close.
       EXTEND RUINPIECE_LIST whenever a new set-piece kind ships. */
    if (window.drawRuinPiece && window.debugWorldInfo) {
      const RUINPIECE_LIST = ['wallX', 'wallY', 'col', 'lintelY', 'fallen',
                              'rubble', 'well', 'entrance'];          // v20: entrance
      const info5 = window.debugWorldInfo();
      const base = (info5.RUINS && info5.RUINS[0]) || { x: 60, y: 60 };
      for (const k of RUINPIECE_LIST) {
        window.drawRuinPiece({ k, x: base.x + 0.6, y: base.y + 0.4, hp: 22, z: 28 });
        n += 1;
      }
      // every kind the live world actually built, at its real coordinates
      for (const p of (info5.ruinPieceSpots || [])) {
        window.drawRuinPiece({ k: p.k, x: p.x, y: p.y, hp: 22, z: 28 });
        n += 1;
      }
      const built = new Set((info5.ruinPieceSpots || []).map(p => p.k));
      for (const k of RUINPIECE_LIST) {
        if (!built.has(k)) {
          console.log(`COVERAGE GAP: no "${k}" ruin piece was built in the live world`);
          process.exit(1);
        }
      }
    }
    /* v27: the ability AOE ring. It is drawn in render()'s own pass from
       `abilityRings`, which is empty for the whole 5-frame boot — so the
       aura() call that draws it is unreachable there. Cast each of the five
       class abilities for real and pump frames while a ring is alive, so the
       expanding-radius branch executes at several phases rather than none.
       EXTEND THIS whenever another ability learns a render of its own. */
    if (window.tryAbility && window.debugSetAbility && window.debugSetPlayer &&
        window.debugAbilityInfo && window.debugWorldInfo) {
      const wasA = window.debugAbilityInfo();
      const wasP = window.debugWorldInfo().player;
      let ringsSeen = 0;
      for (const cls of CLS) {
        window.debugSetPlayer({ cls, equipped: 'mystic_staff' });
        window.debugSetAbility({ lastAbility: -1e9 });
        window.tryAbility();
        ringsSeen += window.debugAbilityInfo().rings.length;
        n += 1;
        // frames INSIDE the ring's 520ms life, so the growing-radius draw runs
        for (let f = 300; f < 305; f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
          n += 1;
        }
      }
      // and the staff splash's own ring, at its own smaller radius
      if (window.staffSplash) {
        window.staffSplash({ x: wasP ? wasP.x : 60, y: wasP ? wasP.y : 60, dx: 1, dy: 0 }, 19, null, null);
        ringsSeen += window.debugAbilityInfo().rings.length;
        for (let f = 310; f < 314; f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
          n += 1;
        }
      }
      console.log('ability rings alive during the sweep:', ringsSeen);
      if (!ringsSeen) {
        console.log('COVERAGE GAP: no ability ring was ever alive — aura() in render() never drew');
        process.exit(1);
      }
      window.debugSetPlayer({ cls: wasA.cls, equipped: wasA.equipped });
      window.debugSetAbility({ lastAbility: 0, guardBreakUntil: 0,
                               markedShotUntil: 0, rallyCharges: 0, rings: null });
    }
    /* v33: the placed base pieces. Six kinds × five material tiers, none of
       which exists in a fresh world — so the 5-frame boot cannot reach a
       single one of these branches. Sweep the art directly at every tier,
       then build a real base out in the world and pump frames so the entity
       pass that dispatches to it runs too.
       EXTEND BASE_PIECE_LIST whenever another piece kind ships (v34 adds
       destruction and the Generator's production tick). */
    if (window.drawBasePiece && window.debugBaseInfo && window.debugSetPlayer) {
      const BASE_PIECE_LIST = ['foundation', 'wall', 'door', 'chest', 'forge', 'generator'];
      const bi5 = window.debugBaseInfo();
      const beforeB = window.debugWorldInfo().player;
      for (const k of BASE_PIECE_LIST) {
        for (const tier of bi5.BASE_TIERS) {
          window.drawBasePiece({ id: 'cov:' + k + ':' + tier, kind: k, tier,
                                 x: 61.4, y: 61.4, owner: 'BootTest' }, 900);
          n += 1;
        }
      }
      // now a real base, built through the real placement path, on camera
      const { N: N5 } = window.debugWorldInfo();
      const OFF5 = [[0, 0], [3, 0], [6, 0], [0, 3], [3, 3], [6, 3]];
      let site5 = null;
      for (let y = 12; y < N5 - 12 && !site5; y += 2) {
        for (let x = 12; x < N5 - 12; x += 2) {
          if (OFF5.every(o => window.basePlaceCheck('foundation', x + o[0] + 0.5, y + o[1] + 0.5).ok)) {
            site5 = [x, y]; break;
          }
        }
      }
      if (site5) {
        const [BX5, BY5] = site5;
        window.debugSetPlayer({ x: BX5 + 3.5, y: BY5 + 1.5,
          inv: { wood: 200, stone: 200, iron_bar: 200, runic_stone: 200, dragonsteel: 200 } });
        const TIER5 = ['wood', 'stone', 'iron', 'runic', 'dragonsteel', 'wood'];
        for (let i = 0; i < BASE_PIECE_LIST.length; i++) {
          await window.placeBasePiece(BASE_PIECE_LIST[i], TIER5[i],
            BX5 + OFF5[i][0] + 0.5, BY5 + OFF5[i][1] + 0.5);
          n += 1;
        }
        const builtKinds = new Set(window.debugBaseInfo().pieces.map(p => p.kind));
        for (const k of BASE_PIECE_LIST) {
          if (!builtKinds.has(k)) {
            console.log(`COVERAGE GAP: no "${k}" base piece was built in the live world`);
            process.exit(1);
          }
        }
        for (let f = 400; f < 408; f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
          n += 1;
        }
        console.log('base pieces built and rendered this seed:', builtKinds.size);
        window.debugSetBase({ clear: true });
      } else {
        console.log('COVERAGE GAP: no clear build site found for the base sweep');
        process.exit(1);
      }
      if (beforeB) window.debugSetPlayer({ x: beforeB.x, y: beforeB.y, inv: beforeB.inv });
    }
    console.log('coverage draws:', n, '— CAUGHT:', caught ? (caught.stack || caught) : 'none');
    process.exit(caught ? 1 : 0);
  } catch (e) {
    console.log('COVERAGE CRASH:', e.stack || e);
    process.exit(1);
  }
})();
