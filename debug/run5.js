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
  account_pins: [],      // Account PIN Protection: present, and empty
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
    /* Account PIN Protection: a genuinely new name cannot be created without
       a PIN, so the sweep's own login supplies one — same submit, both
       fields. The gate's four proofs live in run4. */
    doc.getElementById('pinInput').value = '2468';
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
                      "crystal_golem", "krakenling", "salamander_king",   // v25
                      // v39: the Elder trio. All three are drawn through the
                      // same chain — the Golem Elder as a wild mob AND as a
                      // companion, the other two as companions.
                      "golem_elder", "dragon_elder", "unicorn_elder"];
    const MOBK = ["goblin", "bandit", "troll", "boar", "bear", "griffin", "phoenix",
                  "dark_wraith",                                          // v18
                  "sea_serpent",                                          // v21
                  // v25: the Salamander King's hostile rampage form. It is
                  // tameable:true, so it renders through drawSpecies like the
                  // v14 beasts — sweep every mob state over that path too.
                  "salamander_king",
                  // v39: the Golem Elder's hostile form is tameable:true, so
                  // it renders through drawSpecies exactly as the v14 beasts
                  // do — sweep every mob state over that path too.
                  "golem_elder"];
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
    /* v18/v21/v22 counted these biomes' tiles and took a non-zero count as
       proof their ground art had drawn, because bakeTerrain() painted EVERY
       tile of the map at boot.

       EXPANSION 2A CHANGED WHAT THIS BLOCK MEANS. The whole-map bake is gone
       — ground is drawn per frame for visible tiles only — so a boot at spawn
       no longer touches a cave, a hollow or a caldera anywhere in the world,
       and a tile count on its own now proves the biome EXISTS and nothing
       about whether its branch ever ran. Counting alone would have quietly
       become a weaker test that still passed, which is the worst kind.

       So the counts stay (they are still the reachability check they always
       were, and the Hollow's doubles as "the Shadow Dragon has somewhere to
       spawn"), and every one of them now also DRAWS a real tile of that
       biome through drawGroundTile — the same shape as the drawTree sweep
       above. EXTEND GROUND_BIOMES whenever a biome gets its own ground
       treatment inside drawGroundTile. */
    if (window.biomeAt && window.debugWorldInfo && window.drawGroundTile) {
      const gInfo = window.debugWorldInfo();
      const GROUND_BIOMES = ['DEEP', 'SHALLOW', 'WATER', 'SAND', 'PLAINS', 'MEADOW',
                             'FOREST', 'DARKFOREST', 'ROCK', 'PEAK', 'VOLROCK', 'LAVA',
                             'RUINB', 'ENCHFOREST', 'SACMEADOW', 'UNDERCAVE', 'UWCAVE',
                             'ABYSSAL', 'CALDERA'];
      const gctx = window.document.createElement('canvas').getContext('2d');
      let drewBiomes = 0, missing = [];
      for (const name of GROUND_BIOMES) {
        if (!(name in gInfo.B)) { missing.push(name + '(no such biome id)'); continue; }
        let hit = null;
        for (let y = 0; y < gInfo.N && !hit; y++) for (let x = 0; x < gInfo.N; x++) {
          if (window.biomeAt(x, y) === gInfo.B[name]) { hit = [x, y]; break; }
        }
        if (!hit) { missing.push(name); continue; }
        /* Draw the tile itself and its two uphill neighbours, so the SOUTH
           and EAST cliff-face branches get a run at a real height step too. */
        window.drawGroundTile(gctx, hit[0], hit[1]);
        window.drawGroundTile(gctx, Math.max(0, hit[0] - 1), hit[1]);
        window.drawGroundTile(gctx, hit[0], Math.max(0, hit[1] - 1));
        n += 3; drewBiomes++;
      }
      console.log('ground biomes drawn through drawGroundTile:', drewBiomes, 'of', GROUND_BIOMES.length);
      if (missing.length) {
        console.log('COVERAGE GAP: no tile of', missing.join(', '),
                    '— that ground branch never drew');
        process.exit(1);
      }
    } else if (window.biomeAt && window.debugWorldInfo) {
      console.log('COVERAGE GAP: drawGroundTile is missing — the ground pass cannot be covered');
      process.exit(1);
    }
    if (window.biomeAt && window.debugWorldInfo) {
      const { N, B } = window.debugWorldInfo();
      let cave = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (window.biomeAt(x, y) === B.UNDERCAVE) cave++;
      }
      console.log('undercave tiles this seed:', cave);
      if (!cave) { console.log('COVERAGE GAP: no B.UNDERCAVE tile in the world'); process.exit(1); }
      /* v21: the same reachability check for the Underwater Caves. An empty
         biome here is a harder failure than elsewhere, since the dive mechanic
         exists to reach exactly these. (Expansion 2a: the ground BRANCH is now
         covered by the drawGroundTile sweep above; this is the count.) */
      let uwc = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (window.biomeAt(x, y) === B.UWCAVE) uwc++;
      }
      console.log('uwcave tiles this seed:', uwc);
      if (!uwc) { console.log('COVERAGE GAP: no B.UWCAVE tile in the world'); process.exit(1); }
      /* v22: the same reachability check for the two new pockets. A zero
         count means the biome is unreachable — and for the Hollow it also
         means the Shadow Dragon has nowhere to spawn. */
      let aby = 0, cald = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const b = window.biomeAt(x, y);
        if (b === B.ABYSSAL) aby++;
        else if (b === B.CALDERA) cald++;
      }
      console.log('abyssal tiles this seed:', aby);
      if (!aby) { console.log('COVERAGE GAP: no B.ABYSSAL tile in the world'); process.exit(1); }
      console.log('caldera tiles this seed:', cald);
      if (!cald) { console.log('COVERAGE GAP: no B.CALDERA tile in the world'); process.exit(1); }
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
    /* v39: the two set pieces this version adds to the world, plus the one
       object in it that only exists inside a 48-hour window. None of them is
       guaranteed to be on camera during the 5-frame boot — the altar is 34
       tiles from the Tower and the orb may already be claimed — so both art
       paths are swept directly, and then the real world is walked to so the
       entity pass that dispatches to them runs for real. */
    if (window.drawDragonAltarEntity && window.drawOrbNode && window.debugV39Info) {
      const v39 = window.debugV39Info();
      for (let i = 0; i < 4; i++) {
        window.drawDragonAltarEntity(600 + i * 400);
        window.drawOrbNode({ x: v39.TOWER.x + 0.5, y: v39.TOWER.y + 0.5, h: 0.5 }, 600 + i * 400);
        n += 2;
      }
      if (window.debugSetPlayer) {
        const beforeV = window.debugWorldInfo().player;
        // stand at the altar, then at the Tower, pumping real frames at each
        for (const at of [[v39.DRAGON_ALTAR.x, v39.DRAGON_ALTAR.y + 2],
                          [v39.TOWER.x, v39.TOWER.y + 2]]) {
          window.debugSetPlayer({ x: at[0], y: at[1] });
          for (let f = 500; f < 506; f++) {
            const q = rafQ; rafQ = [];
            for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
            n += 1;
          }
        }
        // the Golem Elder actually standing in the world, on camera
        if (v39.GOLEM_ELDER) {
          window.debugSetPlayer({ x: v39.GOLEM_ELDER.x + 1.5, y: v39.GOLEM_ELDER.y + 1.5 });
          for (let f = 520; f < 528; f++) {
            const q = rafQ; rafQ = [];
            for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
            n += 1;
          }
        } else {
          console.log('COVERAGE GAP: no Golem Elder in the world to render');
          process.exit(1);
        }
        // ...and the Unicorn Elder, wherever this seed put it
        const uw = v39.unicornElderWild;
        if (uw) {
          window.debugSetPlayer({ x: uw.x, y: uw.y });
          for (let f = 540; f < 548; f++) {
            const q = rafQ; rafQ = [];
            for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
            n += 1;
          }
        } else {
          console.log('COVERAGE GAP: no Unicorn Elder in the world to render');
          process.exit(1);
        }
        if (v39.orbSite === null) {
          console.log('COVERAGE GAP: this window\'s Golden Orb was already claimed');
          process.exit(1);
        }
        console.log('v39 set pieces rendered — altar, orb, Golem Elder, Unicorn Elder');
        if (beforeV) window.debugSetPlayer({ x: beforeV.x, y: beforeV.y });
      }
    }
    /* ============ Mob Rarity + Music sweep ================================
       PART C resized the ENTIRE tameable roster, so every one of these bodies
       paints at a scale it has never painted at — including the overlay
       offsets, which are pixel values that do not scale with the art. The
       SPECIES / MOBK / drawPet sweeps above already walk every one of them,
       so RESIZED exists to be the named list a future size pass extends
       rather than to add a path they miss: it draws each resized creature
       through drawMob in every combat state AND through drawSpecies, with the
       "!" tell and the HP bar up, which is where a body that outgrew its
       offset actually shows. EXTEND IT whenever a creature is resized. */
    const RESIZED = ['tree_sprite', 'water_sprite', 'stone_sprite', 'wind_sprite',
                     'glow_moth', 'wolf', 'golem', 'stag', 'boar', 'bear', 'griffin',
                     'unicorn', 'crystal_golem', 'phoenix', 'fire_dragon',
                     'water_dragon', 'storm_dragon', 'shadow_dragon',
                     'shadowfox', 'lightfox', 'krakenling', 'salamander_king',
                     'golem_elder', 'dragon_elder', 'unicorn_elder'];
    if (window.drawSpecies) {
      const c2 = window.document.createElement('canvas').getContext('2d');
      for (const sp of RESIZED) {
        for (const moving of [true, false]) { window.drawSpecies(sp, 90, 90, 1200, moving); n += 1; }
      }
      // the ones with a hostile form, wearing their tell and their bar
      if (window.drawMob) {
        for (const mk of ['boar', 'bear', 'griffin', 'phoenix', 'salamander_king', 'golem_elder']) {
          for (const st of ['idle', 'aggro', 'attack', 'cower']) {
            for (const winding of [false, true]) {
              window.drawMob({ id: mk + ':resized', kind: mk, x: 41, y: 51, hx: 41, hy: 51,
                hp: st === 'cower' ? 8 : 40, maxHp: 80, state: st, winding,
                flash: winding ? performance.now() : 0, fx: winding ? -1 : 1, fy: 0,
                dead: false, target: null, ph: 1 }, 1200);
              n += 1;
            }
          }
        }
      }
      void c2;
    }
    /* PART A: a world at its daily cap is a world with things MISSING from
       it, which is a frame the boot above never draws. Force every Rare-and-up
       species to its cap, rebuild, and pump real frames — then put it back. */
    if (window.debugSetRareTakes && window.debugRareTakesInfo && window.buildFeatureList) {
      const rt = window.debugRareTakesInfo();
      const allTaken = {};
      for (const sp of Object.keys(rt.PET_RARITY)) {
        if (rt.CAPPED_RARITIES.indexOf(rt.PET_RARITY[sp]) >= 0) allTaken[sp] = rt.caps[sp];
      }
      window.debugSetRareTakes({ takes: allTaken, day: rt.day });
      window.buildFeatureList();
      for (let f = 560; f < 568; f++) {
        const q = rafQ; rafQ = [];
        for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
        n += 1;
      }
      const capped = window.debugRareTakesInfo();
      console.log('capped world rendered — rare+ wilds left:',
        Object.keys(capped.wildSpeciesInWorld)
              .filter(s => capped.CAPPED_RARITIES.indexOf(capped.PET_RARITY[s]) >= 0).length);
      window.debugSetRareTakes({ takes: {}, day: window.debugRareTakesInfo().day });
      window.buildFeatureList();
    }
    /* PART D: the Elder cue is a branch of the per-frame music check that no
       ordinary frame reaches. Drive it through real frames, both ways. */
    if (window.debugSetMusicState && window.debugMusicInfo) {
      window.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
      for (const state of [{ elderMusicUntil: performance.now() + 6000, combatMusicUntil: performance.now() + 6000 },
                           { elderMusicUntil: 0, combatMusicUntil: performance.now() + 6000 },
                           { elderMusicUntil: 0, combatMusicUntil: 0 }]) {
        window.debugSetMusicState(Object.assign({ musicCheckAt: 0 }, state));
        try { window.update(0.016, 900000); } catch (e) { if (!caught) caught = e; }
        n += 1;
      }
      window.debugSetMusicState({ elderMusicUntil: 0, combatMusicUntil: 0,
                                  inCombatMusic: false, musicCheckAt: 0 });
      console.log('music states swept — Elder cue, combat track, rotation');
    }
    /* PART E: the credits panel gained a MUSIC block. */
    if (window.renderCredits) {
      window.renderCredits();
      const mcl = window.document.getElementById('musicCreditsList');
      if (!mcl || mcl.children.length < 2) {
        console.log('COVERAGE GAP: the MUSIC credits block did not render');
        process.exit(1);
      }
      console.log('credits rendered — RUNEHAVEN, MUSIC (' + mcl.children.length + '), COLLABORATIONS');
      n += 1;
    }
    /* v46 PART D: the real minimap. Its whole render body is unreachable from
       the plain boot unless the card is actually up and something is standing
       on it, so this sweeps the branches by hand: a terrain window over every
       ground biome the seed can reach, a nearby player dot, a remote player in
       another space (which must NOT draw), and the interior hide. */
    if (window.debugMapInfo && window.updateWorldMap) {
      const wi = window.debugWorldInfo(), Bm = wi.B;
      const seen = {}, want = Object.keys(Bm).map(k => Bm[k]);
      // find one tile of each biome the seed holds, and draw the map standing on it
      const step = Math.max(1, Math.floor(wi.N / 260));
      for (let ty = 2; ty < wi.N - 2; ty += step)
        for (let tx = 2; tx < wi.N - 2; tx += step) {
          const b = window.biomeAt(tx, ty);
          if (seen[b] !== undefined) continue;
          seen[b] = [tx, ty];
        }
      let drawn = 0;
      const oth5 = window.debugCombatHandles ? window.debugCombatHandles().others : null;
      for (const b of want) {
        const spot = seen[b];
        if (!spot) continue;
        window.debugSetPlayer({ x: spot[0] + 0.5, y: spot[1] + 0.5, hp: 100 });
        if (oth5) {
          oth5.set('MapDot', { x: spot[0] + 2.5, y: spot[1] + 1.5, cls: 'Mystic',
                               hp: 100, maxHp: 100, lastHeard: 1e15, space: 'main' });
          oth5.set('MapElsewhere', { x: spot[0] + 1.5, y: spot[1] + 1.5, cls: 'Knight',
                                     hp: 100, maxHp: 100, lastHeard: 1e15, space: 'cave:x' });
          oth5.set('MapDown', { x: spot[0] + 1.5, y: spot[1] + 2.5, cls: 'Ranger',
                                hp: 0, maxHp: 100, dead: true, lastHeard: 1e15, space: 'main' });
        }
        window.updateWorldMap();
        if (window.debugMapInfo().visible) drawn++;
        n += 1;
      }
      if (oth5) { oth5.delete('MapDot'); oth5.delete('MapElsewhere'); oth5.delete('MapDown'); }
      if (drawn < 10) {
        console.log('COVERAGE GAP: the minimap drew only ' + drawn + ' biome windows');
        process.exit(1);
      }
      console.log('minimap windows drawn over distinct biomes:', drawn);
      // the hide branch: inside an interior the card must go away
      let cave = null;
      for (let y = 0; y < wi.N && !cave; y++) for (let x = 0; x < wi.N; x++) {
        if (window.biomeAt(x, y) === Bm.UWCAVE) { cave = [x, y]; break; }
      }
      if (cave) {
        window.debugSetPlayer({ x: cave[0] + 0.5, y: cave[1] + 0.5, diving: true, hp: 100, breath: 30 });
        window.enterInterior(cave[0], cave[1], Bm.UWCAVE);
        window.updateWorldMap();
        const hidden = window.debugMapInfo().visible === false;
        window.exitInterior();
        window.debugSetPlayer({ x: wi.SPAWN.x, y: wi.SPAWN.y, diving: false, hp: 100 });
        window.updateWorldMap();
        n += 2;
        if (!hidden || window.debugMapInfo().visible !== true) {
          console.log('COVERAGE GAP: the minimap did not hide inside an interior and come back');
          process.exit(1);
        }
        console.log('minimap hide/show swept — interior and surface');
      }
    }
    console.log('coverage draws:', n, '— CAUGHT:', caught ? (caught.stack || caught) : 'none');
    process.exit(caught ? 1 : 0);
  } catch (e) {
    console.log('COVERAGE CRASH:', e.stack || e);
    process.exit(1);
  }
})();
