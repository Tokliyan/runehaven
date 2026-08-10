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
      // ===== v21: the Water Dragon, "tame as hatchling" = the same passive formula
      const wdC = tcf({ id: 'water_dragon:test', species: 'water_dragon' }, false);
      results.push(['water_dragon chance = .25+.25 = .50', Math.abs(wdC - 0.50) < 1e-9]);
      const wdBaitC = tcf({ id: 'water_dragon:test', species: 'water_dragon' }, true);
      results.push(['water_dragon baited = .25+.25+.15 = .65', Math.abs(wdBaitC - 0.65) < 1e-9]);
      results.push(['water_dragon is NOT fight-to-tame', cwdt(mk('water_dragon', 1, 40)) === false]);
      // the Sea Serpent is kill-for-loot — its tame gate must never open either
      results.push(['sea_serpent gate CLOSED at 1hp', cwdt(mk('sea_serpent', 1, 130)) === false]);
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
        // v21 — Water Dragon, locked from the same v16 table and identical
        ['water_dragon', 55, 12, 1600, true],
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
      // v21: water_dragon has left this list — it SHIPPED, and is asserted at
      // its locked stats in TBL above instead.
      for (const s of ['crystal_golem', 'basilisk',
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
      // v21: the Water Dragon joins them — the dive is its gate, not the clock
      for (const s of ['fire_dragon', 'glow_moth', 'water_dragon']) {
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
         1-tile band; at N=240 the same moisture logic produces 875.
         v20: RE-MEASURED, deliberately not carried over. Six Ruin clusters
         (not one) now carve RUINB over the moisture band, and four Safe Zone
         clearings flatten more of it to grass, so 875 -> 763 on this seed.
         The invariant being guarded is unchanged: the rare-variant NOISE
         fields still never touch this band — only the landmark overrides,
         which have always won over it, take tiles from it. */
      results.push([`Dark Forest band untouched (${dark} tiles)`, dark === 763]);
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
                           griffin: 3, phoenix: 3, dark_wraith: 6,
                           sea_serpent: 3 };   // v21: designed tunable
      for (const [k, want] of Object.entries(MOB_COUNTS)) {
        results.push([`MOBS.${k}.count = ${want}`, info.MOBS[k] && info.MOBS[k].count === want]);
      }
      const SP_COUNTS = { tree_sprite: 9, water_sprite: 9, stone_sprite: 9, wind_sprite: 9,
                          wolf: 6, golem: 3, stag: 6,
                          // x2, not x3 — scarcity IS these three's design, so a
                          // bigger map must not make them proportionally easier
                          shadowfox: 4, unicorn: 4, lightfox: 4,
                          fire_dragon: 3, glow_moth: 9,
                          water_dragon: 3 };   // v21: Fire Dragon's count
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

      /* ===== v21 PART B: Underwater Caves — carved from DEEP, still a pocket.
         An unreachable cave here is worse than a merely rare one anywhere
         else, since the dive mechanic already gates it, so the count is a
         hard assertion and the reachability of the pockets is measured. */
      let uwc = 0, deepN = 0;
      for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
        const b = window.biomeAt(x, y);
        if (b === B2.UWCAVE) uwc++;
        else if (b === B2.DEEP) deepN++;
      }
      console.log(`worldgen v21: uwcave ${uwc}, open deep ${deepN}, ` +
                  `${(100 * uwc / (uwc + deepN)).toFixed(1)}% of the deep sea`);
      results.push([`Underwater Caves exist (${uwc} tiles)`, uwc > 0]);
      results.push([`Underwater Caves stay a sparse pocket (${uwc}/${uwc + deepN})`, uwc < deepN]);
      results.push([`open deep water still exists (${deepN})`, deepN > 0]);
      let uwSpot = null;
      for (let y = 0; y < N2 && !uwSpot; y++) for (let x = 0; x < N2; x++) {
        if (window.biomeAt(x, y) === B2.UWCAVE) { uwSpot = [x, y]; break; }
      }
      results.push(['a UWCAVE tile sits at sea-floor height, like the water around it',
        !!uwSpot && window.heightAt(uwSpot[0], uwSpot[1]) === -1]);
      /* Every pocket must be reachable on foot from land within one tank of
         air: BFS out from every non-deep tile, counting only DEEP steps —
         B.UWCAVE itself costs nothing, which is the air-pocket rule. */
      {
        const idx = (x, y) => y * N2 + x, dist = new Int32Array(N2 * N2).fill(-1), q = [];
        for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
          const b = window.biomeAt(x, y);
          if (b !== B2.DEEP && b !== B2.UWCAVE) { dist[idx(x, y)] = 0; q.push([x, y]); }
        }
        for (let head = 0; head < q.length; head++) {
          const [cx, cy] = q[head], d = dist[idx(cx, cy)];
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= N2 || ny >= N2 || dist[idx(nx, ny)] !== -1) continue;
            const b = window.biomeAt(nx, ny);
            if (b !== B2.DEEP && b !== B2.UWCAVE) continue;
            dist[idx(nx, ny)] = b === B2.UWCAVE ? d : d + 1;
            q.push([nx, ny]);
          }
        }
        const seenP = new Set(), pockets = [];
        for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
          if (window.biomeAt(x, y) !== B2.UWCAVE || seenP.has(idx(x, y))) continue;
          let n = 0, best = Infinity; const st = [[x, y]]; seenP.add(idx(x, y));
          while (st.length) {
            const [cx, cy] = st.pop(); n++; best = Math.min(best, dist[idx(cx, cy)]);
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= N2 || ny >= N2 || seenP.has(idx(nx, ny))) continue;
              if (window.biomeAt(nx, ny) !== B2.UWCAVE) continue;
              seenP.add(idx(nx, ny)); st.push([nx, ny]);
            }
          }
          pockets.push({ n, cross: best });
        }
        pockets.sort((a, b) => a.cross - b.cross);
        // one tank of air = BREATH_MAX seconds at PLAYER_SPEED tiles/second
        const budget = info.BREATH_MAX * 4.6;
        console.log(`uwcave pockets (size/deep tiles to cross): ` +
                    pockets.map(p => `${p.n}/${p.cross}`).join('  '));
        results.push([`more than one Underwater Cave pocket (${pockets.length})`, pockets.length > 1]);
        results.push([`every pocket is reachable on one tank of air (budget ${budget} tiles)`,
          pockets.length > 0 && pockets.every(p => p.cross <= budget)]);
        results.push([`at least one pocket is a real region, not a speck ` +
          `(largest ${Math.max(...pockets.map(p => p.n))} tiles)`,
          Math.max(...pockets.map(p => p.n)) >= 40]);
      }

      /* ===== v21 PART A: the dive gate itself. This is the ONLY relaxation of
         BLOCKED in the file, and it must be a deep-water exception, never a
         general noclip — so peaks and lava are asserted to stay shut. */
      const dsp = window.debugSetPlayer, dbk = window.diveBlocked;
      const SPX = () => info.SPAWN.x, SPY = () => info.SPAWN.y;
      if (dsp && dbk) {
        dsp({ diving: false });
        results.push(['surfaced: B.DEEP is blocked',        dbk(B2.DEEP) === true]);
        results.push(['surfaced: B.UWCAVE is NOT blocked',  dbk(B2.UWCAVE) === false]);
        dsp({ diving: true });
        results.push(['diving: B.DEEP opens',               dbk(B2.DEEP) === false]);
        results.push(['diving: B.PEAK STAYS blocked',       dbk(B2.PEAK) === true]);
        results.push(['diving: B.LAVA STAYS blocked',       dbk(B2.LAVA) === true]);
        results.push(['diving: B.UWCAVE still walkable',    dbk(B2.UWCAVE) === false]);
        results.push(['diving: plain ground never became blocked', dbk(B2.PLAINS) === false]);
        dsp({ diving: false });

        /* ...and the same thing end to end, through the REAL movement handler:
           real key events, real update() ticks, a real DEEP tile. */
        let edge = null;   // a walkable tile with open deep water to its west
        for (let y = 4; y < N2 - 4 && !edge; y++) for (let x = 4; x < N2 - 4; x++) {
          if (window.biomeAt(x, y) !== B2.DEEP) continue;
          const nb = window.biomeAt(x + 1, y);
          if (nb === B2.DEEP || nb === B2.PEAK || nb === B2.LAVA) continue;
          if (Math.hypot(x - SPX(), y - SPY()) < 60) continue;   // well outside any safe zone
          edge = [x, y]; break;
        }
        if (edge) {
          const [dx0, dy0] = edge;
          const press = (key, type) => window.dispatchEvent(
            new window.KeyboardEvent(type, { key, bubbles: true }));
          const walkWest = (steps) => { for (let i = 0; i < steps; i++) window.update(0.05, 1000 + i * 50); };
          console.log(`dive test edge: deep tile ${dx0},${dy0}, shore tile ${dx0 + 1},${dy0}`);

          dsp({ x: dx0 + 1.5, y: dy0 + 0.5, diving: false, breath: info.BREATH_MAX, hp: 100 });
          press('a', 'keydown');
          walkWest(30);
          let st = window.debugWorldInfo().player;
          results.push([`surfaced, WASD cannot enter deep water (stopped at x ${st.x.toFixed(2)})`,
            Math.floor(st.x) === dx0 + 1]);

          dsp({ diving: true });
          walkWest(30);
          st = window.debugWorldInfo().player;
          press('a', 'keyup');
          const landedOn = window.biomeAt(Math.floor(st.x), Math.floor(st.y));
          results.push([`diving, WASD DOES enter deep water (walked to x ${st.x.toFixed(2)})`,
            Math.floor(st.x) <= dx0 && (landedOn === B2.DEEP || landedOn === B2.UWCAVE)]);

          // ===== the F toggle, including the refusal that prevents a softlock
          dsp({ x: dx0 + 0.5, y: dy0 + 0.5, diving: true });
          press('f', 'keydown'); press('f', 'keyup');
          results.push(['F cannot surface you while you stand on deep water',
            window.debugWorldInfo().player.diving === true]);
          dsp({ x: dx0 + 1.5, y: dy0 + 0.5, diving: true });
          press('f', 'keydown'); press('f', 'keyup');
          results.push(['F surfaces you once you are off deep water',
            window.debugWorldInfo().player.diving === false]);
          press('f', 'keydown'); press('f', 'keyup');
          results.push(['F dives again from dry land',
            window.debugWorldInfo().player.diving === true]);
          dsp({ diving: false });

          // ===== breath: drains ONLY while diving on B.DEEP
          const ub = window.updateBreath;
          if (ub) {
            dsp({ x: dx0 + 0.5, y: dy0 + 0.5, diving: true, breath: 30, hp: 100, charm: null });
            ub(1);
            results.push([`breath drains 1/s diving on deep water ` +
              `(${window.debugWorldInfo().player.breath})`,
              Math.abs(window.debugWorldInfo().player.breath - 29) < 1e-6]);
            if (uwSpot) {
              dsp({ x: uwSpot[0] + 0.5, y: uwSpot[1] + 0.5, diving: true, breath: 20 });
              ub(1); ub(1); ub(1);
              results.push([`breath HOLDS on a UWCAVE tile — the cave is an air pocket ` +
                `(${window.debugWorldInfo().player.breath})`,
                Math.abs(window.debugWorldInfo().player.breath - 20) < 1e-6]);
            }
            dsp({ x: SPX(), y: SPY(), diving: false, breath: 10 });
            ub(1);
            results.push([`breath regenerates 4/s on land ` +
              `(${window.debugWorldInfo().player.breath})`,
              Math.abs(window.debugWorldInfo().player.breath - 14) < 1e-6]);
            dsp({ breath: 29 });
            ub(1);
            results.push(['breath never exceeds maxBreath',
              window.debugWorldInfo().player.breath === info.BREATH_MAX]);

            // ===== zero breath: damage through the EXISTING applyDamage path
            dsp({ x: dx0 + 0.5, y: dy0 + 0.5, diving: true, breath: 0, hp: 100, charm: null });
            ub(1);
            const hp1 = window.debugWorldInfo().player.hp;
            results.push([`out of air costs ${info.DROWN_DPS} hp/s (100 -> ${hp1})`,
              hp1 === 100 - info.DROWN_DPS]);
            ub(0.4); ub(0.4);   // 0.8s banked — not a whole second yet
            const hpPart = window.debugWorldInfo().player.hp;
            results.push([`drowning does NOT tick per frame (still ${hpPart} after 0.8s more)`,
              hpPart === hp1]);
            ub(0.4);            // 1.2s banked — exactly one more tick
            const hp2 = window.debugWorldInfo().player.hp;
            results.push([`drowning ticks once per whole second (${hp2})`,
              hp2 === 100 - info.DROWN_DPS * 2]);
            dsp({ x: SPX() + 40, y: SPY(), diving: false, breath: 0, hp: 100 });
            ub(1);
            results.push(['no drowning damage once out of the deep',
              window.debugWorldInfo().player.hp === 100]);
          } else {
            results.push(['updateBreath exists', false]);
          }
        } else {
          results.push(['found a shore tile beside deep water to test the dive gate', false]);
        }
        dsp({ x: SPX(), y: SPY(), diving: false, breath: info.BREATH_MAX, hp: 100, charm: null });
      } else {
        results.push(['debugSetPlayer/diveBlocked exist', false]);
      }

      /* ===== v21 PART C: the Diver's Charm, crafted through the REAL recipe
         table and the real craft panel — not by poking at constants. */
      if (window.refreshPanels && dsp) {
        dsp({ x: SPX() + 4, y: SPY() + 2, charm: null });   // stand at the Spawn Forge
        const invBefore = window.debugWorldInfo().player.inv;
        window.invAdd('iron_bar', 2);
        window.invAdd('wood', 3);
        window.refreshPanels();
        const rows = [...doc.querySelectorAll('#craftList .craft-row')];
        const row = rows.find(r => r.textContent.includes("Diver's Charm"));
        results.push(['a Diver\'s Charm recipe exists at the forge', !!row]);
        results.push(['it costs Iron Bar x2 + Wood x3',
          !!row && row.querySelector('.mats').textContent === 'Iron Bar ×2, Wood ×3']);
        const btn = row && row.querySelector('button');
        results.push(['it is craftable with exactly those materials in hand',
          !!btn && !btn.disabled]);
        if (btn) btn.onclick();
        const after = window.debugWorldInfo().player.inv;
        results.push([`crafting yields a Diver's Charm (${JSON.stringify(after)})`,
          after.divers_charm === 1]);
        results.push(['crafting spends exactly the 2 bars and 3 wood it charged for',
          (after.iron_bar || 0) === (invBefore.iron_bar || 0) &&
          (after.wood || 0) === (invBefore.wood || 0)]);
        // equipping it, through the same inventory row a player would click
        window.refreshPanels();
        const crow = doc.querySelector('#invList [data-c="divers_charm"]');
        results.push(['the charm gets its own equip row', !!crow]);
        if (crow) crow.onclick();
        results.push(['equipping the charm raises maxBreath 30 -> 50',
          window.debugWorldInfo().player.maxBreath === info.BREATH_CHARM_MAX]);
        // ...and it heals while diving, which nothing else in the game does
        if (window.updateBreath && uwSpot) {
          dsp({ x: uwSpot[0] + 0.5, y: uwSpot[1] + 0.5, diving: true, hp: 50, breath: 50 });
          window.updateBreath(1);
          results.push([`the charm regenerates ${info.CHARMS.divers_charm.diveRegen} hp/s while diving ` +
            `(${window.debugWorldInfo().player.hp})`,
            Math.abs(window.debugWorldInfo().player.hp - 51.5) < 1e-6]);
          dsp({ diving: false, hp: 50 });
          window.updateBreath(1);
          results.push(['the charm does NOT heal you on dry land',
            window.debugWorldInfo().player.hp === 50]);
        }
        // unequip and leave the world as we found it
        window.refreshPanels();
        const crow2 = doc.querySelector('#invList [data-c="divers_charm"]');
        if (crow2) crow2.onclick();
        results.push(['unequipping drops maxBreath back to 30',
          window.debugWorldInfo().player.maxBreath === info.BREATH_MAX]);
        dsp({ x: SPX(), y: SPY(), diving: false, breath: info.BREATH_MAX, hp: 100, charm: null });
      }

      /* ===== v21 PARTS D & E: both new creatures live on B.UWCAVE tiles ===== */
      const wdSpots = info.wildSpots.filter(w => w.species === 'water_dragon');
      const ssSpots = info.mobSpots.filter(m => m.kind === 'sea_serpent');
      console.log('water_dragon spots:', JSON.stringify(wdSpots));
      console.log('sea_serpent spots:', JSON.stringify(ssSpots));
      results.push([`Water Dragon reaches its Underwater Caves (${wdSpots.length} spawned)`,
        wdSpots.length === 3]);
      results.push([`every Water Dragon stands on a UWCAVE tile`,
        wdSpots.length > 0 && wdSpots.every(w =>
          window.biomeAt(Math.floor(w.x), Math.floor(w.y)) === B2.UWCAVE)]);
      results.push([`Sea Serpent reaches its Underwater Caves (${ssSpots.length} spawned)`,
        ssSpots.length === 3]);
      results.push([`every Sea Serpent stands on a UWCAVE tile`,
        ssSpots.length > 0 && ssSpots.every(m =>
          window.biomeAt(Math.floor(m.x), Math.floor(m.y)) === B2.UWCAVE)]);
      results.push(['Water Dragon spawns in Underwater Caves ONLY',
        info.WILD_SPECIES.water_dragon.biomes.length === 1 &&
        info.WILD_SPECIES.water_dragon.biomes[0] === B2.UWCAVE]);
      // the Sea Serpent's locked stats
      const ss = info.MOBS.sea_serpent;
      results.push(['sea_serpent 130 HP',        !!ss && ss.hp === 130]);
      results.push(['sea_serpent 18 dmg',        !!ss && ss.dmg === 18]);
      results.push(['sea_serpent 700ms windup',  !!ss && ss.windupMs === 700]);
      results.push(['sea_serpent is not tameable', !!ss && ss.tameable === false]);
      results.push(['sea_serpent is melee, not ranged (the wraith stays the only ranged mob)',
        !!ss && ss.atkRange < 3]);
      results.push(['sea_serpent spawns in Underwater Caves ONLY',
        !!ss && ss.biomes.length === 1 && ss.biomes[0] === B2.UWCAVE]);
      results.push(['sea_serpent drops existing materials generously',
        !!ss && ss.loot.length >= 2 && ss.loot.every(l => l.chance >= 0.6)]);
      results.push(['sea_serpent is the hardest non-boss mob in the world',
        !!ss && Object.entries(info.MOBS).every(([k, d]) => k === 'sea_serpent' || d.hp < ss.hp)]);

      // ===== v19 PART E: the scale-up's own proof gates =====
      const H = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const SP = info.SPAWN, TW = info.TOWER, SR = info.SAFE_RADIUS;
      const VO = info.VOLCANO, MO = info.MOUNT;
      const RUS = info.RUINS, ZONES = info.OTHER_SAFE_ZONES;
      results.push([`N scaled to 240 (was 80)`, N2 === 240]);
      results.push([`SAFE_RADIUS scaled to 27 (was 9)`, SR === 27]);
      /* placeLandmarks() gives up after 12 attempts and ships whatever the
         last attempt produced, silently. These re-check the break conditions
         it was searching for, so an exhausted search is a FAIL, not a shrug. */
      console.log(`landmarks: VOLCANO ${VO.x},${VO.y} MOUNT ${MO.x},${MO.y}`);
      console.log(`  V dTower ${H(VO,TW).toFixed(1)} dSpawn ${H(VO,SP).toFixed(1)} | ` +
                  `M dTower ${H(MO,TW).toFixed(1)} dSpawn ${H(MO,SP).toFixed(1)} dV ${H(MO,VO).toFixed(1)}`);
      results.push([`VOLCANO placed clear of spawn (${H(VO,SP).toFixed(1)} > ${SR + 42})`,
        H(VO, SP) > SR + 42]);
      results.push([`MOUNT placed clear of spawn (${H(MO,SP).toFixed(1)} > ${SR + 36})`,
        H(MO, SP) > SR + 36]);
      results.push([`MOUNT placed clear of volcano (${H(MO,VO).toFixed(1)} > 78)`, H(MO, VO) > 78]);

      /* ===== v20 PART C: Ruins as repeatable structures + scattered Safe Zones.
         The whole point of rev2 is that the search actually completes, so an
         exhausted search is a FAIL here, never a shrug — the first v20 attempt
         stopped RED precisely because it could not place all six and all four. */
      console.log(`RUINS (${RUS.length}): ` + RUS.map(r => `${r.x},${r.y}`).join('  '));
      console.log(`ZONES (${ZONES.length}): ` + ZONES.map(z => `${z.x},${z.y}`).join('  '));
      results.push([`all ${6} Ruin clusters placed (${RUS.length})`, RUS.length === 6]);
      results.push([`all ${4} Other Safe Zones placed (${ZONES.length})`, ZONES.length === 4]);
      // every Ruin keeps the v19 Ruin's own separations, unchanged
      for (let i = 0; i < RUS.length; i++) {
        const R = RUS[i];
        const minR = Math.min(...RUS.filter((_, j) => j !== i).map(o => H(R, o)));
        console.log(`  ruin ${i} ${R.x},${R.y} dSpawn ${H(R,SP).toFixed(1)} ` +
                    `dV ${H(R,VO).toFixed(1)} dM ${H(R,MO).toFixed(1)} minRuin ${minR.toFixed(1)}`);
        results.push([`ruin ${i} clear of spawn (${H(R,SP).toFixed(1)} > ${SR + 24})`, H(R, SP) > SR + 24]);
        results.push([`ruin ${i} clear of volcano (${H(R,VO).toFixed(1)} > 42)`, H(R, VO) > 42]);
        results.push([`ruin ${i} clear of mount (${H(R,MO).toFixed(1)} > 42)`, H(R, MO) > 42]);
        results.push([`ruin ${i} clear of other ruins (${minR.toFixed(1)} > ${info.RUIN_SEP})`,
          minR > info.RUIN_SEP]);
        results.push([`ruin ${i} inside the clamp margin (36..${N2 - 36})`,
          R.x > 36 && R.x < N2 - 36 && R.y > 36 && R.y < N2 - 36]);
      }
      /* FIX 1: Ruin-to-Zone is 24, not 40. Every OTHER separation is unchanged,
         so they are all re-asserted above and below at their own values. */
      for (let i = 0; i < ZONES.length; i++) {
        const Z = ZONES[i];
        const minZ = ZONES.length > 1
          ? Math.min(...ZONES.filter((_, j) => j !== i).map(o => H(Z, o))) : Infinity;
        const minR = Math.min(...RUS.map(r => H(Z, r)));
        console.log(`  zone ${i} ${Z.x},${Z.y} dSpawn ${H(Z,SP).toFixed(1)} dTower ${H(Z,TW).toFixed(1)} ` +
                    `dV ${H(Z,VO).toFixed(1)} dM ${H(Z,MO).toFixed(1)} minZone ${minZ.toFixed(1)} minRuin ${minR.toFixed(1)}`);
        for (const [nm, L] of [['spawn', SP], ['tower', TW], ['volcano', VO], ['mount', MO]]) {
          results.push([`zone ${i} clear of ${nm} (${H(Z,L).toFixed(1)} > ${info.ZONE_SEP})`,
            H(Z, L) > info.ZONE_SEP]);
        }
        results.push([`zone ${i} clear of other zones (${minZ.toFixed(1)} > ${info.ZONE_SEP})`,
          minZ > info.ZONE_SEP]);
        results.push([`zone ${i} clear of every ruin (${minR.toFixed(1)} > ${info.RUIN_ZONE_SEP})`,
          minR > info.RUIN_ZONE_SEP]);
        results.push([`zone ${i} inside the clamp margin (36..${N2 - 36})`,
          Z.x > 36 && Z.x < N2 - 36 && Z.y > 36 && Z.y < N2 - 36]);
      }
      results.push([`Ruin-to-Zone separation is 24, not 40 (FIX 1)`, info.RUIN_ZONE_SEP === 24]);
      results.push([`every other separation unchanged (ruin ${info.RUIN_SEP}, zone ${info.ZONE_SEP})`,
        info.RUIN_SEP === 40 && info.ZONE_SEP === 40]);

      /* FIX 2 is only observable through its consequence: placement ran before
         tileCache.clear() using elevRaw(), so the RUINB carve and each zone's
         grass clearing must actually be present on the tiles they cover. If a
         biomeAt() call had leaked into placement, these are the tiles that
         would silently still hold their pre-carve biome. */
      const ruinbPer = RUS.map(r => {
        let n = 0;
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++)
          if (window.biomeAt(r.x + dx, r.y + dy) === B2.RUINB) n++;
        return n;
      });
      console.log(`RUINB tiles per cluster: ${ruinbPer.join(', ')}`);
      results.push([`every cluster carved real RUINB ground (${ruinbPer.join('/')})`,
        ruinbPer.length === 6 && ruinbPer.every(n => n > 40)]);
      results.push([`every ruin centre is a RUINB tile (FIX 2 — no stale cache)`,
        RUS.every(r => window.biomeAt(r.x, r.y) === B2.RUINB)]);
      results.push([`every zone centre is plain grass (FIX 2 — no stale cache)`,
        ZONES.every(z => window.biomeAt(z.x, z.y) === B2.PLAINS)]);
      /* The clearing is guarded like the Ruin carve, so it never paints grass
         onto water or a blocked tile — a coastal zone keeps its shoreline. */
      const clearingBad = ZONES.map(z => {
        let bad = 0;
        for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
          if (Math.hypot(dx, dy) >= info.ZONE_R) continue;
          const b = window.biomeAt(z.x + dx, z.y + dy);
          if (b !== B2.PLAINS && b !== B2.DEEP && b !== B2.WATER && b !== B2.SHALLOW) bad++;
        }
        return bad;
      });
      results.push([`zone clearings are grass except where they meet water (${clearingBad.join('/')})`,
        clearingBad.every(n => n === 0)]);

      // Golem (RUINB-only) and Bandit must reach more than one cluster
      const clustersNear = (pts, rad) => {
        const set = new Set();
        for (const p of pts) RUS.forEach((r, i) => { if (H(p, r) < rad) set.add(i); });
        return [...set].sort((a, b) => a - b);
      };
      const golemAt = clustersNear(info.wildSpots.filter(w => w.species === 'golem'), 12);
      const banditAt = clustersNear(info.mobSpots.filter(m => m.kind === 'bandit'), 12);
      console.log(`golems near clusters [${golemAt}] | bandits near clusters [${banditAt}]`);
      results.push([`Golem spawns near multiple Ruin clusters (${golemAt.length})`, golemAt.length >= 2]);
      results.push([`Bandit spawns near multiple Ruin clusters (${banditAt.length})`, banditAt.length >= 2]);
      // preservation: both still gate on RUINB exactly as they did in v19
      results.push(['Golem still gates on RUINB only',
        info.WILD_SPECIES.golem.biomes.length === 1 && info.WILD_SPECIES.golem.biomes[0] === B2.RUINB]);
      results.push(['Bandit still gates on PLAINS + RUINB',
        info.MOBS.bandit.biomes.includes(B2.RUINB) && info.MOBS.bandit.biomes.includes(B2.PLAINS)]);

      // inSafeZone() protects a point inside each zone, and stops at its edge
      results.push([`inSafeZone protects a point near each of the ${ZONES.length} zones`,
        ZONES.every(z => window.inSafeZone(z.x, z.y) && window.inSafeZone(z.x + 3, z.y - 3))]);
      results.push([`inSafeZone stops at each zone's edge`,
        ZONES.every(z => !window.inSafeZone(z.x + info.ZONE_R + 2, z.y))]);
      results.push(['inSafeZone still protects the Spawn zone', window.inSafeZone(SP.x, SP.y)]);
      results.push(['inSafeZone is false out in the open world',
        !window.inSafeZone(RUS[0].x, RUS[0].y)]);

      // one cluster's worth of set pieces per centre, plus one well per zone
      const pk = info.ruinPieceSpots.reduce((a, p) => (a[p.k] = (a[p.k] || 0) + 1, a), {});
      console.log('ruin set pieces:', JSON.stringify(pk));
      results.push([`ruin set pieces built per centre (${info.ruinPieceSpots.length} total)`,
        pk.wallX === 36 && pk.wallY === 6 && pk.col === 18 && pk.lintelY === 6 &&
        pk.fallen === 6 && pk.rubble === 12]);
      results.push([`one dungeon entrance per cluster (${pk.entrance || 0})`, pk.entrance === 6]);
      results.push([`one well per cluster plus one per Safe Zone (${pk.well || 0})`, pk.well === 10]);
      // the deliberate runic vein is now one per cluster
      results.push([`one deliberate runic vein per cluster (${info.ruinVeins})`, info.ruinVeins === 6]);
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
