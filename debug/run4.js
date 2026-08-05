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
      // v17: the three rare-biome passive tames use the same v12 formula
      const stagC = tcf({ id: 'stag:test', species: 'stag' }, false);
      results.push(['stag chance = .45+.25 = .70', Math.abs(stagC - 0.70) < 1e-9]);
      const uniC = tcf({ id: 'unicorn:test', species: 'unicorn' }, false);
      results.push(['unicorn chance = .25+.25 = .50', Math.abs(uniC - 0.50) < 1e-9]);
      const lfC = tcf({ id: 'lightfox:test', species: 'lightfox' }, false);
      results.push(['lightfox chance = .20+.25 = .45', Math.abs(lfC - 0.45) < 1e-9]);
      const lfBaitC = tcf({ id: 'lightfox:test', species: 'lightfox' }, true);
      results.push(['lightfox baited = .20+.25+.15 = .60', Math.abs(lfBaitC - 0.60) < 1e-9]);
      // none of the three is fight-to-tame — the wear-down gate must stay shut
      for (const s of ['stag', 'unicorn', 'lightfox']) {
        results.push([`${s} is NOT fight-to-tame`, cwdt(mk(s, 1, 40)) === false]);
      }
      // ===== v18: the two Underground Caves pets, same v12 passive formula =====
      const fdC = tcf({ id: 'fire_dragon:test', species: 'fire_dragon' }, false);
      results.push(['fire_dragon chance = .25+.25 = .50', Math.abs(fdC - 0.50) < 1e-9]);
      const fdBaitC = tcf({ id: 'fire_dragon:test', species: 'fire_dragon' }, true);
      results.push(['fire_dragon baited = .25+.25+.15 = .65', Math.abs(fdBaitC - 0.65) < 1e-9]);
      const gmC = tcf({ id: 'glow_moth:test', species: 'glow_moth' }, false);
      results.push(['glow_moth chance = .65+.25 = .90', Math.abs(gmC - 0.90) < 1e-9]);
      for (const s of ['fire_dragon', 'glow_moth']) {
        results.push([`${s} is NOT fight-to-tame`, cwdt(mk(s, 1, 40)) === false]);
      }
      // the Dark Wraith is a kill-for-loot mob — the tame gate must never open
      results.push(['dark_wraith gate CLOSED at 1hp', cwdt(mk('dark_wraith', 1, 65)) === false]);
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
        // v17 — locked from the v16 spec table, attached to the new species
        ['stag', 25, 3, 1800, false], ['unicorn', 45, 8, 1600, true],
        ['lightfox', 50, 10, 1300, true],
        // v18 — Fire Dragon, locked at 55/12/1.6s, Rare-tier so PvP-capable
        ['fire_dragon', 55, 12, 1600, true],
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
      // Common pets have NO combat role at all. v18: Glow Moth joins this list
      // rather than the not-yet-built one below — it SHIPPED this version, and
      // having no combat role is its correct, deliberate state.
      for (const s of ['tree_sprite', 'water_sprite', 'stone_sprite', 'wind_sprite', 'glow_moth']) {
        results.push([`${s} has no combat role`, pcd(s, 'Beastmaster') === null]);
      }
      // species from the locked table that aren't implemented yet must NOT
      // be pre-built — extend this list as each one actually ships
      for (const s of ['water_dragon', 'crystal_golem', 'basilisk',
                       'krakenling', 'salamander_king', 'duskfox_elder',
                       'golem_elder', 'dragon_elder', 'unicorn_elder']) {
        results.push([`${s} not pre-built`, pcd(s, 'Beastmaster') === null]);
      }
    } else {
      results.push(['petCombatDef exists', false]);
    }

    // ===== v17 time-window gates (Unicorn night-only, Lightfox dawn-only) =====
    // getDayT is a function declaration, so it lands on the global object and
    // can be stubbed to drive isWildVisible through the whole day cycle.
    const iwv = window.isWildVisible, realDayT = window.getDayT;
    if (iwv && realDayT) {
      const at = (t, sp) => { window.getDayT = () => t; const v = iwv({ species: sp }); window.getDayT = realDayT; return v; };
      // Unicorn: visible/tameable only while nightAlpha >= 0.4 (t 0.5..1.0)
      results.push(['unicorn hidden at midday (t=.25)',   at(0.25, 'unicorn') === false]);
      results.push(['unicorn hidden at dawn (t=.03)',     at(0.03, 'unicorn') === false]);
      results.push(['unicorn hidden at dusk (t=.52)',     at(0.52, 'unicorn') === false]);
      results.push(['unicorn VISIBLE deep night (t=.75)', at(0.75, 'unicorn') === true]);
      // Lightfox: dawn window only — the first few % of the cycle
      results.push(['lightfox VISIBLE at dawn (t=.01)',   at(0.01, 'lightfox') === true]);
      results.push(['lightfox VISIBLE at dawn (t=.06)',   at(0.06, 'lightfox') === true]);
      results.push(['lightfox hidden just after dawn (t=.08)', at(0.08, 'lightfox') === false]);
      results.push(['lightfox hidden at midday (t=.25)',  at(0.25, 'lightfox') === false]);
      results.push(['lightfox hidden at night (t=.75)',   at(0.75, 'lightfox') === false]);
      // the dawn window really is narrower than the night check
      let dawnT = 0, nightT = 0;
      for (let i = 0; i < 1000; i++) {
        if (at(i / 1000, 'lightfox')) dawnT++;
        if (at(i / 1000, 'unicorn')) nightT++;
      }
      results.push([`dawn window ${dawnT / 10}% of cycle, in the 5-8% target`, dawnT >= 50 && dawnT <= 80]);
      results.push([`dawn window narrower than night (${dawnT / 10}% < ${nightT / 10}%)`, dawnT < nightT]);
      // Stag has no time gate at all
      results.push(['stag visible by day',   at(0.25, 'stag') === true]);
      results.push(['stag visible by night', at(0.75, 'stag') === true]);
      // v18: neither cave pet is time-gated — the biome is their rarity
      for (const s of ['fire_dragon', 'glow_moth']) {
        results.push([`${s} visible by day`,   at(0.25, s) === true]);
        results.push([`${s} visible by night`, at(0.75, s) === true]);
      }
    } else {
      results.push(['isWildVisible/getDayT exist', false]);
    }

    // ===== v17 worldgen sanity: both rare biomes must actually be reachable =====
    // If either never appears, the rarity threshold is wrong — fix the
    // threshold rather than shipping an unreachable biome.
    const dwi = window.debugWorldInfo, biomeAt = window.biomeAt;
    if (dwi && biomeAt) {
      const { N, B } = dwi();
      const counts = {};
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const b = biomeAt(x, y);
        counts[b] = (counts[b] || 0) + 1;
      }
      const ench = counts[B.ENCHFOREST] || 0, sac = counts[B.SACMEADOW] || 0;
      const dark = counts[B.DARKFOREST] || 0, forest = counts[B.FOREST] || 0, meadow = counts[B.MEADOW] || 0;
      console.log(`worldgen (seed 123456789): forest ${forest}, meadow ${meadow}, darkforest ${dark}, ` +
                  `enchforest ${ench}, sacmeadow ${sac}`);
      results.push([`Enchanted Forest exists (${ench} tiles)`, ench > 0]);
      results.push([`Sacred Meadow exists (${sac} tiles)`, sac > 0]);
      // sparse pockets, not a takeover of the parent biome
      results.push([`Enchanted Forest stays a sparse pocket (${ench}/${ench + forest})`, ench < forest]);
      results.push([`Sacred Meadow stays a sparse pocket (${sac}/${sac + meadow})`, sac < meadow]);
      // the rare fields must be independent of the moisture band: Dark Forest
      // is untouched by them, and regular Forest/Meadow both still exist
      /* Same invariant as v17/v18 — the rare-variant overlays read their own
         noise fields and must never consume the moisture band — but the pinned
         value is scale-bound and moves with N. At N=80 this seed produced a
         1-tile band; at N=240 the same moisture logic produces 875. */
      results.push([`Dark Forest band untouched (${dark} tiles)`, dark === 875]);
      results.push(['regular Forest still exists', forest > 0]);
      results.push(['regular Meadow still exists', meadow > 0]);
      // Stag has no presence roll, so it must reliably find its biome. Unicorn
      // and Lightfox deliberately may not exist in a given session (presence
      // roll), so their spawn count is not assertable here.
      const spawned = dwi().wildSpecies;
      const stags = spawned.filter(s => s === 'stag').length;
      console.log('wild spawns:', JSON.stringify(spawned));
      results.push([`Stag reaches its Enchanted Forest biome (${stags} spawned)`, stags > 0]);
      // the two new gatherables must actually spawn somewhere
      if (window.featureTypeAt) {
        let herbs = 0, essences = 0;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const ft = window.featureTypeAt(x, y);
          if (ft === 'herb') herbs++;
          if (ft === 'essence') essences++;
        }
        console.log(`gatherables: rare_herb nodes ${herbs}, magic_essence nodes ${essences}`);
        results.push([`rare_herb nodes spawn (${herbs})`, herbs > 0]);
        results.push([`magic_essence nodes spawn (${essences})`, essences > 0]);
      }
    } else {
      results.push(['debugWorldInfo/biomeAt exist', false]);
    }

    // ===== v18 PART A: the density pass, exactly the locked table =====
    const dwi2 = window.debugWorldInfo;
    if (dwi2 && dwi2().MOBS) {
      const info = dwi2();
      /* v19 PART D — every count above rescaled for the 9x map: common
         ambient wildlife x3, already-gated rare pets x2. This table is the
         locked spec's, exactly as v18's was; it is not a floor or a guess. */
      const MOB_COUNTS = { goblin: 9, bandit: 9, troll: 6, boar: 6, bear: 6,
                           griffin: 3, phoenix: 3, dark_wraith: 6 };
      for (const [k, want] of Object.entries(MOB_COUNTS)) {
        results.push([`MOBS.${k}.count = ${want}`, info.MOBS[k] && info.MOBS[k].count === want]);
      }
      const SP_COUNTS = { tree_sprite: 9, water_sprite: 9, stone_sprite: 9, wind_sprite: 9,
                          wolf: 6, golem: 3, stag: 6,
                          // x2, not x3 — scarcity IS these three's design, so a
                          // bigger map must not make them proportionally easier
                          shadowfox: 4, unicorn: 4, lightfox: 4,
                          fire_dragon: 3, glow_moth: 9 };
      for (const [k, want] of Object.entries(SP_COUNTS)) {
        results.push([`WILD_SPECIES.${k}.count = ${want}`,
          info.WILD_SPECIES[k] && info.WILD_SPECIES[k].count === want]);
      }

      // ===== v18 PART A proof: no species was cut to zero spawns =====
      // Species carrying a presenceRoll may legitimately be absent from any
      // given session, and fight-to-tame species spawn as mobs, so neither is
      // assertable here — everything else must actually reach its biome.
      const spawned = info.wildSpecies, spawnedMobs = info.mobKinds;
      console.log('mob spawns:', JSON.stringify(spawnedMobs));
      for (const [k, def] of Object.entries(info.WILD_SPECIES)) {
        if (def.presenceRoll || def.fightToTame) continue;
        const n2 = spawned.filter(s => s === k).length;
        results.push([`${k} still spawns after the density cut (${n2})`, n2 > 0]);
      }
      for (const k of ['goblin', 'bandit', 'troll', 'boar', 'bear', 'griffin', 'phoenix']) {
        const n2 = spawnedMobs.filter(s => s === k).length;
        results.push([`mob ${k} still spawns after the density cut (${n2})`, n2 > 0]);
      }
      /* v19: the Dark Wraith is now ASSERTED. v18 could not assert it because
         Dark Forest was a one-tile band in this seed at N=80, so the placement
         search never landed on it. The scale-up fixed that as a side effect —
         the same moisture logic over 9x the tiles yields a real 875-tile band —
         so the gap v18 reported openly is now closed and held closed here.
         Shadowfox (DARKFOREST-only too) benefits identically, but keeps its
         presence roll and so still cannot be asserted. */
      const wraiths = spawnedMobs.filter(s => s === 'dark_wraith').length;
      results.push([`mob dark_wraith now reaches its Dark Forest (${wraiths})`, wraiths > 0]);

      // ===== v18 PART C: Dark Wraith's locked stats + its ranged mechanism =====
      const dw = info.MOBS.dark_wraith;
      results.push(['dark_wraith 65 HP',        !!dw && dw.hp === 65]);
      results.push(['dark_wraith 12 dmg',       !!dw && dw.dmg === 12]);
      results.push(['dark_wraith 600ms windup', !!dw && dw.windupMs === 600]);
      results.push(['dark_wraith is not tameable', !!dw && dw.tameable === false]);
      results.push(['dark_wraith spawns in Dark Forest only',
        !!dw && dw.biomes.length === 1 && dw.biomes[0] === info.B.DARKFOREST]);
      results.push(['dark_wraith drops runic materials',
        !!dw && dw.loot.some(l => l.type === 'runic_stone')]);
      // the ranged read: it strikes from well outside every melee mob's reach
      const melee = Object.entries(info.MOBS).filter(([k]) => k !== 'dark_wraith')
        .map(([, d]) => d.atkRange);
      results.push([`dark_wraith is RANGED (${dw.atkRange} vs melee max ${Math.max(...melee)})`,
        !!dw && dw.atkRange >= 3 && dw.atkRange > Math.max(...melee)]);
      // and it must still open fire from inside its own aggro radius
      results.push(['dark_wraith aggro radius exceeds its attack range',
        !!dw && dw.aggroRadius > dw.atkRange]);

      // ===== v18 PART B: Underground Caves must actually be reachable =====
      const { N: N2, B: B2 } = info;
      let cave = 0, rock2 = 0, peak2 = 0, ench2 = 0, sac2 = 0;
      for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
        const b = window.biomeAt(x, y);
        if (b === B2.UNDERCAVE) cave++;
        if (b === B2.ROCK) rock2++;
        if (b === B2.PEAK) peak2++;
        if (b === B2.ENCHFOREST) ench2++;   // v19 Part E re-check, in this scope
        if (b === B2.SACMEADOW) sac2++;
      }
      console.log(`worldgen v18: undercave ${cave}, rock ${rock2}, peak ${peak2}`);
      results.push([`Underground Caves exist (${cave} tiles)`, cave > 0]);
      results.push([`Underground Caves stay a sparse pocket (${cave}/${cave + rock2 + peak2})`,
        cave < rock2]);
      results.push([`regular Rock still exists (${rock2})`, rock2 > 0]);
      results.push([`regular Peak still exists (${peak2})`, peak2 > 0]);
      // a cave tile must be WALKABLE — the whole point of the corrected Part B
      // is that it is an overworld tile you walk onto, not a separate space
      let caveWalkable = null;
      for (let y = 0; y < N2 && caveWalkable === null; y++) for (let x = 0; x < N2; x++) {
        if (window.biomeAt(x, y) === B2.UNDERCAVE) { caveWalkable = [x, y]; break; }
      }
      results.push(['a cave tile is walkable (not in BLOCKED)',
        !!caveWalkable && window.heightAt(caveWalkable[0], caveWalkable[1]) >= 0]);

      // ===== v19 PART E: the scale-up's own proof gates =====
      const H = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const SP = info.SPAWN, TW = info.TOWER, SR = info.SAFE_RADIUS;
      const VO = info.VOLCANO, MO = info.MOUNT, RU = info.RUIN;
      results.push([`N scaled to 240 (was 80)`, N2 === 240]);
      results.push([`SAFE_RADIUS scaled to 27 (was 9)`, SR === 27]);
      /* placeLandmarks() gives up after 12 attempts and ships whatever the
         last attempt produced, silently. These re-check the break conditions
         it was searching for, so an exhausted search is a FAIL, not a shrug. */
      console.log(`landmarks: VOLCANO ${VO.x},${VO.y} MOUNT ${MO.x},${MO.y} RUIN ${RU.x},${RU.y}`);
      console.log(`  V dTower ${H(VO,TW).toFixed(1)} dSpawn ${H(VO,SP).toFixed(1)} | ` +
                  `M dTower ${H(MO,TW).toFixed(1)} dSpawn ${H(MO,SP).toFixed(1)} dV ${H(MO,VO).toFixed(1)} | ` +
                  `R dTower ${H(RU,TW).toFixed(1)} dSpawn ${H(RU,SP).toFixed(1)} dV ${H(RU,VO).toFixed(1)} dM ${H(RU,MO).toFixed(1)}`);
      results.push([`VOLCANO placed clear of spawn (${H(VO,SP).toFixed(1)} > ${SR + 42})`,
        H(VO, SP) > SR + 42]);
      results.push([`MOUNT placed clear of spawn (${H(MO,SP).toFixed(1)} > ${SR + 36})`,
        H(MO, SP) > SR + 36]);
      results.push([`MOUNT placed clear of volcano (${H(MO,VO).toFixed(1)} > 78)`, H(MO, VO) > 78]);
      results.push([`RUIN placed clear of spawn (${H(RU,SP).toFixed(1)} > ${SR + 24})`,
        H(RU, SP) > SR + 24]);
      results.push([`RUIN placed clear of volcano (${H(RU,VO).toFixed(1)} > 42)`, H(RU, VO) > 42]);
      results.push([`RUIN placed clear of mount (${H(RU,MO).toFixed(1)} > 42)`, H(RU, MO) > 42]);
      // and none of them may sit on the clamp margin, which would mean the
      // search ran off the map rather than finding a spot inside it
      for (const [nm, L] of [['VOLCANO', VO], ['MOUNT', MO], ['RUIN', RU]]) {
        results.push([`${nm} is inside the clamp margin (36..${N2 - 36})`,
          L.x > 36 && L.x < N2 - 36 && L.y > 36 && L.y < N2 - 36]);
      }
      // the safe zone must still read as plain grass at the new radius
      let nonGrass = [];
      for (const [dx, dy] of [[0,0],[8,0],[-8,0],[0,8],[0,-8],[15,15],[-15,-15],
                              [SR-2,0],[0,SR-2],[-(SR-2),0],[0,-(SR-2)]]) {
        const tx = Math.round(SP.x + dx), ty = Math.round(SP.y + dy);
        if (window.biomeAt(tx, ty) !== B2.PLAINS) nonGrass.push(`${tx},${ty}`);
      }
      results.push([`safe zone is plain grass at radius ${SR} (${nonGrass.length} bad tiles)`,
        nonGrass.length === 0]);
      // all three rare biomes survived the scale-up — re-run in one place
      results.push([`all three rare biomes survived the scale-up ` +
        `(ench ${ench2}, sacred ${sac2}, cave ${cave})`, ench2 > 0 && sac2 > 0 && cave > 0]);
      // Part D actually applied: entity total should land near 3x, not 1x or 9x
      const ents = info.wildSpecies.length + info.mobKinds.length;
      console.log(`entities: ${ents} (v18 baseline in this seed: 36; target ~3x = ~108)`);
      results.push([`entity total is roughly 3x the old world (${ents}, want 72..160)`,
        ents >= 72 && ents <= 160]);
    } else {
      results.push(['debugWorldInfo exposes MOBS/WILD_SPECIES', false]);
    }

    // ===== v18 PART C: Glow Moth has NO combat code path, not just no stats =====
    // Driven through the real active-pet flow and real frames, not by poking
    // at the tables: the pet must never acquire combat state at all.
    if (window.setActivePet && window.debugWorldInfo && window.petInterposes) {
      const pump = (from) => {
        for (let f = from; f < from + 6; f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
        }
      };
      await window.setActivePet({ id: 'gm-test', species: 'glow_moth', pet_name: 'Test Moth' });
      pump(20);
      const gm = window.debugWorldInfo().pet;
      results.push(['glow_moth follows as a pet', !!gm && gm.sp === 'glow_moth']);
      results.push(['glow_moth never gains combat state',
        !!gm && gm.maxHp === undefined && gm.hp === undefined]);
      results.push(['glow_moth never lunges (no swing)', !!gm && !gm.swingT]);
      results.push(['glow_moth never interposes for its owner',
        window.petInterposes({ x: gm ? gm.x : 0, y: gm ? gm.y : 0, kind: 'goblin' },
                             { atkRange: 4 }) === false]);
      // ...and Glow Moth's ONE mechanic: it widens the local player's light
      if (window.collectLights) {
        const lit = window.collectLights();
        results.push(['glow_moth widens the player light to 215',
          lit.some(L => L.r === 215 && L.col.indexOf('244,232,160') >= 0)]);
        results.push(['glow_moth does NOT add a second light source',
          lit.filter(L => L.r === 215).length === 1]);
      }
      // contrast: a Rare combat pet DOES acquire state through the same path
      await window.setActivePet({ id: 'fd-test', species: 'fire_dragon', pet_name: 'Test Dragon' });
      pump(30);
      const fd = window.debugWorldInfo().pet;
      results.push(['fire_dragon follows as a pet', !!fd && fd.sp === 'fire_dragon']);
      // login above is Beastmaster: 55 * 1.2 = 66
      results.push(['fire_dragon DOES gain combat state (55 +20% BM = 66hp)',
        !!fd && fd.maxHp === 66]);
      if (window.collectLights) {
        results.push(['player light returns to 150 without the moth',
          window.collectLights().some(L => L.r === 150)]);
      }
      await window.setActivePet(null);
    } else {
      results.push(['setActivePet/petInterposes exist', false]);
    }

    let allOk = true;
    for (const [n, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n); if (!ok) allOk = false; }
    process.exit(allOk && !caught ? 0 : 1);
  } catch (e) {
    console.log('SIM ERROR:', e.stack || e);
    process.exit(1);
  }
})();
