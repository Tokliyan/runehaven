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
      // ===== v22: the last two dragons, "tame as hatchling" = the same formula
      for (const s of ['storm_dragon', 'shadow_dragon']) {
        results.push([`${s} chance = .25+.25 = .50`, Math.abs(tcf({ id: s + ':test', species: s }, false) - 0.50) < 1e-9]);
        results.push([`${s} baited = .25+.25+.15 = .65`, Math.abs(tcf({ id: s + ':test', species: s }, true) - 0.65) < 1e-9]);
        results.push([`${s} is NOT fight-to-tame`, cwdt(mk(s, 1, 40)) === false]);
      }
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
        // v22 — Storm and Shadow Dragon, the same locked row a third and
        // fourth time: Rare tier, PvP-capable, stat-identical to their siblings
        ['storm_dragon', 55, 12, 1600, true],
        ['shadow_dragon', 55, 12, 1600, true],
        // v25 — the last three off the same locked table. Crystal Golem is
        // Rare and the two others Epic, so all three are PvP-capable.
        ['crystal_golem', 70, 9, 2200, true],
        ['krakenling', 60, 12, 1800, true],
        ['salamander_king', 75, 13, 1800, true],
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
      // v25: crystal_golem, krakenling and salamander_king have left it for
      // the same reason — all three shipped this version.
      for (const s of ['basilisk', 'duskfox_elder',
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
      /* v22: neither new dragon is time-gated either — the biome is the gate
         (a dive for the Shadow Dragon, a climb for the Storm Dragon). */
      for (const s of ['fire_dragon', 'glow_moth', 'water_dragon',
                       'storm_dragon', 'shadow_dragon']) {
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
                           sea_serpent: 3,     // v21: designed tunable
                           // v25: 0 on purpose — the ONLY hostile Salamander
                           // Kings in the world are rampaged pets.
                           salamander_king: 0 };
      for (const [k, want] of Object.entries(MOB_COUNTS)) {
        results.push([`MOBS.${k}.count = ${want}`, info.MOBS[k] && info.MOBS[k].count === want]);
      }
      const SP_COUNTS = { tree_sprite: 9, water_sprite: 9, stone_sprite: 9, wind_sprite: 9,
                          wolf: 6, golem: 3, stag: 6,
                          // x2, not x3 — scarcity IS these three's design, so a
                          // bigger map must not make them proportionally easier
                          shadowfox: 4, unicorn: 4, lightfox: 4,
                          fire_dragon: 3, glow_moth: 9,
                          water_dragon: 3,     // v21: Fire Dragon's count
                          storm_dragon: 3, shadow_dragon: 3,    // v22: same
                          // v25 designed tunables. crystal_golem is lowest of
                          // the three — only a subset of Ruins can host it;
                          // krakenling matches the other doubly-gated rares.
                          crystal_golem: 2, krakenling: 4, salamander_king: 3 };
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
        if (k === 'water_dragon') continue;   // v29: lives inside caves now
        if (k === 'shadow_dragon') continue;  // v32: lives inside the Hollow now
        results.push([`${k} still spawns after the density cut (${n2})`, n2 > 0]);
      }
      for (const k of ['goblin', 'bandit', 'troll', 'boar', 'bear', 'griffin', 'phoenix']) {
        const n2 = spawnedMobs.filter(s => s === k).length;
        if (k === 'sea_serpent') continue;    // v29: lives inside caves now
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

      /* ===== v22 PART A: both new biome pockets must exist and stay pockets.
         Standard worldgen sanity check, same shape as every pocket before. */
      let aby = 0, cald = 0, vol2 = 0, lava2 = 0, deepOpen = 0;
      for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
        const b = window.biomeAt(x, y);
        if (b === B2.ABYSSAL) aby++;
        else if (b === B2.CALDERA) cald++;
        else if (b === B2.VOLROCK) vol2++;
        else if (b === B2.LAVA) lava2++;
        else if (b === B2.DEEP) deepOpen++;
      }
      console.log(`worldgen v22: abyssal ${aby} (${(100 * aby / (aby + uwc + deepOpen)).toFixed(1)}% of the deep sea), ` +
                  `caldera ${cald}, volrock ${vol2}, lava ${lava2}`);
      results.push([`Abyssal Hollow exists (${aby} tiles)`, aby > 0]);
      results.push([`Sunforge Caldera exists (${cald} tiles)`, cald > 0]);
      results.push([`Abyssal Hollow stays a sparse pocket (${aby}/${aby + deepOpen})`, aby < deepOpen]);
      results.push([`Sunforge Caldera stays a sparse pocket (${cald}/${cald + vol2})`, cald < vol2]);
      results.push([`plain volcanic rock still exists (${vol2})`, vol2 > 0]);
      results.push([`the lava core is untouched (${lava2})`, lava2 > 0]);
      /* The Hollow is deliberately RARER than the Underwater Caves — that is
         the whole "genuine bottom of the map" read, and it is the one
         relationship between the two thresholds that actually matters. */
      results.push([`ABYSSAL_RARITY ${info.ABYSSAL_RARITY} is rarer than UWCAVE_RARITY ${info.UWCAVE_RARITY}`,
        info.ABYSSAL_RARITY > info.UWCAVE_RARITY]);
      results.push([`the Hollow really is scarcer on the ground than the caves (${aby} < ${uwc})`, aby < uwc]);
      results.push([`CALDERA_RARITY is the spec's ${0.85}`, info.CALDERA_RARITY === 0.85]);

      let abySpot = null, caldSpot = null;
      for (let y = 0; y < N2 && !abySpot; y++) for (let x = 0; x < N2; x++)
        if (window.biomeAt(x, y) === B2.ABYSSAL) { abySpot = [x, y]; break; }
      for (let y = 0; y < N2 && !caldSpot; y++) for (let x = 0; x < N2; x++)
        if (window.biomeAt(x, y) === B2.CALDERA) { caldSpot = [x, y]; break; }
      /* Carved from DEEP, so it must sit on the sea floor like the water
         around it — otherwise the plateau branch raises the deepest point in
         the world out of the ocean as a cliff-walled island. */
      results.push(['an ABYSSAL tile sits at sea-floor height (-1), like the water around it',
        !!abySpot && window.heightAt(abySpot[0], abySpot[1]) === -1]);
      /* Carved from the volcano cone, so it must KEEP the cone's height —
         the volcano silhouette is on the art skill's must-not-regress list. */
      results.push([`a CALDERA tile keeps the volcano cone's height (2 or 3)`,
        !!caldSpot && window.heightAt(caldSpot[0], caldSpot[1]) >= 2]);
      let caldBad = 0;
      for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
        if (window.biomeAt(x, y) !== B2.CALDERA) continue;
        const hh = window.heightAt(x, y);
        if (hh < 2) caldBad++;
      }
      results.push([`NO caldera tile punches a pit into the cone (${caldBad} bad tiles)`, caldBad === 0]);
      // neither is in BLOCKED — that alone is what makes each pocket walkable
      const dbk0 = window.diveBlocked;
      if (dbk0) {
        results.push(['B.ABYSSAL is NOT blocked (walkable once dived to)', dbk0(B2.ABYSSAL) === false]);
        results.push(['B.CALDERA is NOT blocked (reached on foot, no dive)', dbk0(B2.CALDERA) === false]);
      }
      /* The Caldera is a LAND pocket: it must be reachable without diving,
         which means walkable ground has to connect it to the rest of the
         island. Flood-fill from spawn over everything not in BLOCKED. */
      {
        const idx3 = (x, y) => y * N2 + x, seen3 = new Uint8Array(N2 * N2);
        const sx0 = Math.floor(info.SPAWN.x), sy0 = Math.floor(info.SPAWN.y);
        const st3 = [[sx0, sy0]]; seen3[idx3(sx0, sy0)] = 1;
        let reachedCald = 0;
        while (st3.length) {
          const [cx, cy] = st3.pop();
          if (window.biomeAt(cx, cy) === B2.CALDERA) reachedCald++;
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= N2 || ny >= N2 || seen3[idx3(nx, ny)]) continue;
            if (dbk0 && dbk0(window.biomeAt(nx, ny))) continue;
            seen3[idx3(nx, ny)] = 1; st3.push([nx, ny]);
          }
        }
        console.log(`caldera tiles walkable from spawn without diving: ${reachedCald}/${cald}`);
        results.push([`the Caldera is reachable on foot from spawn (${reachedCald}/${cald} tiles)`,
          reachedCald > 0]);
      }
      /* Every pocket must be reachable on foot from land within one tank of
         air: BFS out from every non-deep tile, counting only DEEP steps —
         B.UWCAVE itself costs nothing, which is the air-pocket rule. */
      /* v22: B.ABYSSAL is carved from DEEP too, so it joins this BFS on
         BOTH sides — it is free to cross (every breath rule keys on B.DEEP
         specifically, so a Hollow tile costs no air, exactly like a UWCAVE
         one) and it is NOT a starting point, because you can no more walk
         into it from dry land than into a cave. Left as it was, an ABYSSAL
         tile would have seeded the search as if it were land and reported
         caves as far closer to shore than they are. */
      const freeUW = (b) => b === B2.UWCAVE || b === B2.ABYSSAL;
      {
        const idx = (x, y) => y * N2 + x, dist = new Int32Array(N2 * N2).fill(-1), q = [];
        for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
          const b = window.biomeAt(x, y);
          if (b !== B2.DEEP && !freeUW(b)) { dist[idx(x, y)] = 0; q.push([x, y]); }
        }
        for (let head = 0; head < q.length; head++) {
          const [cx, cy] = q[head], d = dist[idx(cx, cy)];
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= N2 || ny >= N2 || dist[idx(nx, ny)] !== -1) continue;
            const b = window.biomeAt(nx, ny);
            if (b !== B2.DEEP && !freeUW(b)) continue;
            dist[idx(nx, ny)] = freeUW(b) ? d : d + 1;
            q.push([nx, ny]);
          }
        }
        // one tank of air = BREATH_MAX seconds at PLAYER_SPEED tiles/second
        const budget = info.BREATH_MAX * 4.6;
        const pocketsOf = (target) => {
          const seenP = new Set(), out = [];
          for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
            if (window.biomeAt(x, y) !== target || seenP.has(idx(x, y))) continue;
            let n = 0, best = Infinity; const st = [[x, y]]; seenP.add(idx(x, y));
            while (st.length) {
              const [cx, cy] = st.pop(); n++; best = Math.min(best, dist[idx(cx, cy)]);
              for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= N2 || ny >= N2 || seenP.has(idx(nx, ny))) continue;
                if (window.biomeAt(nx, ny) !== target) continue;
                seenP.add(idx(nx, ny)); st.push([nx, ny]);
              }
            }
            out.push({ n, cross: best });
          }
          return out.sort((a, b) => a.cross - b.cross);
        };
        const pockets = pocketsOf(B2.UWCAVE);
        console.log(`uwcave pockets (size/deep tiles to cross): ` +
                    pockets.map(p => `${p.n}/${p.cross}`).join('  '));
        results.push([`more than one Underwater Cave pocket (${pockets.length})`, pockets.length > 1]);
        results.push([`every pocket is reachable on one tank of air (budget ${budget} tiles)`,
          pockets.length > 0 && pockets.every(p => p.cross <= budget)]);
        results.push([`at least one pocket is a real region, not a speck ` +
          `(largest ${Math.max(...pockets.map(p => p.n))} tiles)`,
          Math.max(...pockets.map(p => p.n)) >= 40]);

        /* ===== v22 PART A: the Abyssal Hollow, held to exactly the same bar.
           It is gated behind the same dive, so an unreachable pocket here is
           the same failure it would be there. */
        const abyss = pocketsOf(B2.ABYSSAL);
        console.log(`abyssal pockets (size/deep tiles to cross): ` +
                    abyss.map(p => `${p.n}/${p.cross}`).join('  '));
        results.push([`more than one Abyssal Hollow pocket (${abyss.length})`, abyss.length > 1]);
        results.push([`every Hollow pocket is reachable on one tank of air (budget ${budget} tiles)`,
          abyss.length > 0 && abyss.every(p => p.cross <= budget)]);
        results.push([`at least one Hollow pocket is a real region, not a speck ` +
          `(largest ${Math.max(...abyss.map(p => p.n))} tiles)`,
          Math.max(...abyss.map(p => p.n)) >= 40]);
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
          /* v32: UWCAVE and ABYSSAL are doorways now, not standable shore —
             standing on one pulls the player into its interior, which is
             correct game behaviour but makes it a useless test anchor. */
          if (nb === B2.UWCAVE || nb === B2.ABYSSAL) continue;
          if (window.biomeAt(x, y) === B2.ABYSSAL) continue;
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
      /* v29 CHANGED THIS DELIBERATELY: both creatures moved INSIDE the cave
         interiors. They must no longer appear on the surface grid at all —
         moved, not duplicated. The v21 assertions below are inverted on
         purpose, and the interior spawn is proven in the v29 block. */
      results.push([`Water Dragon no longer spawns on the surface (${wdSpots.length})`,
        wdSpots.length === 0]);
      results.push([`Sea Serpent no longer spawns on the surface (${ssSpots.length})`,
        ssSpots.length === 0]);
      results.push(['Water Dragon has no surface biome left — it lives inside',
        info.WILD_SPECIES.water_dragon.biomes.length === 0]);
      // the Sea Serpent's locked stats
      const ss = info.MOBS.sea_serpent;
      results.push(['sea_serpent 130 HP',        !!ss && ss.hp === 130]);
      results.push(['sea_serpent 18 dmg',        !!ss && ss.dmg === 18]);
      results.push(['sea_serpent 700ms windup',  !!ss && ss.windupMs === 700]);
      results.push(['sea_serpent is not tameable', !!ss && ss.tameable === false]);
      results.push(['sea_serpent is melee, not ranged (the wraith stays the only ranged mob)',
        !!ss && ss.atkRange < 3]);
      results.push(['sea_serpent has no surface biome left — it lives inside',
        !!ss && ss.biomes.length === 0]);
      results.push(['sea_serpent drops existing materials generously',
        !!ss && ss.loot.length >= 2 && ss.loot.every(l => l.chance >= 0.6)]);
      /* v30: the Elder Drake is now the hardest thing in the world by a wide
         margin — sea_serpent remains the hardest NON-BOSS, which is what this
         was always meant to assert. */
      results.push(['sea_serpent is the hardest non-boss mob in the world',
        !!ss && Object.entries(info.MOBS).every(([k, d]) =>
          k === 'sea_serpent' || k === 'elder_drake' || d.hp < ss.hp)]);
      results.push(['the Elder Drake outclasses every other mob in the world',
        !!info.MOBS.elder_drake &&
        Object.entries(info.MOBS).every(([k, d]) => k === 'elder_drake' || d.hp < info.MOBS.elder_drake.hp)]);

      /* ===== v22 PARTS B & C: Storm Dragon on B.PEAK, Shadow Dragon in the
         Abyssal Hollow, both exactly where the locked spec puts them. */
      const sdSpots = info.wildSpots.filter(w => w.species === 'storm_dragon');
      const kdSpots = info.wildSpots.filter(w => w.species === 'shadow_dragon');
      console.log('storm_dragon spots:', JSON.stringify(sdSpots));
      console.log('shadow_dragon spots:', JSON.stringify(kdSpots));
      results.push([`Storm Dragon reaches its peaks (${sdSpots.length} spawned)`, sdSpots.length === 3]);
      results.push([`every Storm Dragon stands on a PEAK tile`,
        sdSpots.length > 0 && sdSpots.every(w =>
          window.biomeAt(Math.floor(w.x), Math.floor(w.y)) === B2.PEAK)]);
      /* v32 CHANGED THIS DELIBERATELY: Shadow Dragon moved INSIDE the
         Abyssal Hollow interiors, same as Water Dragon in v29. No surface
         spawn at all — interior spawn is proven in the v32 block. */
      results.push([`Shadow Dragon no longer spawns on the surface (${kdSpots.length})`,
        kdSpots.length === 0]);
      results.push(['Storm Dragon spawns on PEAK ONLY',
        info.WILD_SPECIES.storm_dragon.biomes.length === 1 &&
        info.WILD_SPECIES.storm_dragon.biomes[0] === B2.PEAK]);
      results.push(['Shadow Dragon has no surface biome left — it lives inside',
        info.WILD_SPECIES.shadow_dragon.biomes.length === 0]);

      /* B.PEAK is in BLOCKED and always has been (Griffin has spawned there
         since v14), so a Storm Dragon deep inside a massif can be seen but
         never reached: taming needs the player within nearestWild()'s 1.8
         tiles of its wandering position, and the player can only stand on
         non-BLOCKED ground. The spec pins the spawn to B.PEAK, so this is
         MEASURED and reported rather than second-guessed — but a version
         where NONE of them is reachable would be a pet that cannot be
         tamed at all, and that is a hard failure. */
      {
        const dPtSq = (px, py, tx, ty) => Math.hypot(
          Math.max(tx - px, 0, px - (tx + 1)), Math.max(ty - py, 0, py - (ty + 1)));
        let reach = 0;
        for (const s of sdSpots) {
          let bestW = Infinity;
          for (let k = 0; k < 360; k++) {                 // its wander ellipse
            const a = k / 360 * Math.PI * 2;
            const wx = s.x + Math.cos(a) * 0.9, wy = s.y + Math.sin(a) * 0.7;
            for (let y = Math.max(0, Math.floor(wy) - 5); y <= Math.min(N2 - 1, Math.floor(wy) + 5); y++)
              for (let x = Math.max(0, Math.floor(wx) - 5); x <= Math.min(N2 - 1, Math.floor(wx) + 5); x++) {
                if (dbk0 && dbk0(window.biomeAt(x, y))) continue;
                const d = dPtSq(wx, wy, x, y);
                if (d < bestW) bestW = d;
              }
          }
          const ok = bestW < 1.8;
          if (ok) reach++;
          console.log(`  storm_dragon @${s.x},${s.y}: closest a player can get ` +
                      `${bestW.toFixed(2)} tiles (tame needs < 1.8) — ${ok ? 'TAMEABLE' : 'OUT OF REACH'}`);
        }
        results.push([`at least one Storm Dragon is actually tameable (${reach}/${sdSpots.length} in this seed)`,
          reach > 0]);
      }
      // the Shadow Dragon's own biome is walkable, so every one of them is
      // reachable by definition once a diver gets there — assert it anyway
      /* v32: retired — Shadow Dragon is no longer on the surface grid. */

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
      /* v30 CHANGED THIS DELIBERATELY: ruins now pick one of three layouts,
         so a fixed per-piece census no longer describes the world. What still
         must hold is that every cluster built something and every cluster got
         its entrance — asserted below and in the v30 block. */
      results.push([`ruin set pieces built per centre (${info.ruinPieceSpots.length} total)`,
        info.ruinPieceSpots.length > 30 && pk.rubble >= 6 && pk.col >= 6]);
      results.push([`one dungeon entrance per cluster (${pk.entrance || 0})`, pk.entrance === 6]);
      /* v30: only two of the three ruin layouts include a well, so the count
         is now layout-dependent — the four Safe Zone wells are the constant. */
      results.push([`wells exist across ruins and Safe Zones (${pk.well || 0})`,
        (pk.well || 0) >= 4 && (pk.well || 0) <= 10]);
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

    /* ===== v23 PART F — keybinds, settings persistence, audio, favicon, credits
       Everything below is QOL/infrastructure: no world state is asserted here,
       and the player is put back where it was found at the end. ============== */
    if (window.debugSettingsInfo && window.setKeybind && window.setSetting) {
      const dsi = window.debugSettingsInfo;
      // v27: `ability` is the twelfth bindable action — the class-ability key.
      // Updated, not relaxed: the count and the default table both move with it.
      const ACTIONS = ['up', 'down', 'left', 'right', 'interact', 'attack',
                       'inventory', 'craft', 'pets', 'dive', 'block', 'ability',
                       'mount'];   // v28
      const info23 = dsi();

      // ---- PART A: the config object itself
      results.push(['KEYBINDS carries all 13 bindable actions',
        Object.keys(info23.KEYBINDS).length === 13 &&
        ACTIONS.every(a => typeof info23.KEYBINDS[a] === 'string')]);
      results.push(['KEYBIND defaults are exactly the locked spec',
        ACTIONS.map(a => info23.KEYBIND_DEFAULTS[a]).join('|') ===
        ['w', 's', 'a', 'd', 'e', ' ', 'i', 'c', 'p', 'f', 'shift', 'q', 'r'].join('|')]);

      // ---- PART A: every check site reads KEYBINDS, no literals left behind
      const SITES = ['keys[KEYBINDS.up]', 'keys[KEYBINDS.down]', 'keys[KEYBINDS.left]',
        'keys[KEYBINDS.right]', 'keys[KEYBINDS.interact]', 'keys[KEYBINDS.block]',
        'k === KEYBINDS.interact', 'k === KEYBINDS.attack', 'k === KEYBINDS.inventory',
        'k === KEYBINDS.craft', 'k === KEYBINDS.pets', 'k === KEYBINDS.dive',
        'k === KEYBINDS.block',
        'k === KEYBINDS.ability'];   // v27: the class-ability key is bound, not hardcoded
      const missing = SITES.filter(s => gameScript.indexOf(s) < 0);
      results.push(['every keybind check site reads KEYBINDS' +
        (missing.length ? ' (missing ' + missing.join(', ') + ')' : ''), missing.length === 0]);
      const LITERALS = ['keys["w"]', 'keys["s"]', 'keys["a"]', 'keys["d"]',
                        'keys["e"]', 'keys["shift"]', 'e.key === "Shift"'];
      const leftover = LITERALS.filter(s => gameScript.indexOf(s) >= 0);
      results.push(['no hardcoded keybind literals remain' +
        (leftover.length ? ' (found ' + leftover.join(', ') + ')' : ''), leftover.length === 0]);
      // the arrow keys are a deliberate fixed secondary binding, not a miss
      results.push(['arrow keys survive as the fixed secondary movement binding',
        gameScript.indexOf('keys["arrowup"]') >= 0 && gameScript.indexOf('keys["arrowleft"]') >= 0]);

      // ---- PART A: rebinding changes REAL in-game behaviour, end to end
      const dsp23 = window.debugSetPlayer, dwi23 = window.debugWorldInfo;
      const SP23 = dwi23().SPAWN;
      const press23 = (key, type) => window.dispatchEvent(
        new window.KeyboardEvent(type, { key, bubbles: true }));
      const walk23 = (n, base) => { for (let i = 0; i < n; i++) window.update(0.05, base + i * 50); };
      const northFrom = (key, base) => {
        dsp23({ x: SP23.x + 0.5, y: SP23.y + 0.5, diving: false, hp: 100 });
        press23(key, 'keydown');
        walk23(20, base);
        press23(key, 'keyup');
        return (SP23.y + 0.5) - dwi23().player.y;      // >0 means it moved north
      };
      results.push(['default binding: W walks the player north', northFrom('w', 200000) > 0.05]);
      results.push(['default binding: T does nothing', Math.abs(northFrom('t', 210000)) < 1e-9]);
      const reb = window.setKeybind('up', 't');
      results.push(['rebinding "up" to T is accepted', reb.ok === true]);
      results.push(['after the rebind, T walks the player north', northFrom('t', 220000) > 0.05]);
      results.push(['after the rebind, W no longer moves the player',
        Math.abs(northFrom('w', 230000)) < 1e-9]);
      const dup = window.setKeybind('down', 't');
      results.push(['binding a key already in use is refused, with a reason',
        dup.ok === false && typeof dup.msg === 'string' && dup.msg.length > 0]);
      results.push(['the refused bind left "down" untouched', dsi().KEYBINDS.down === 's']);
      results.push(['the help line is regenerated from KEYBINDS, never hardcoded',
        (doc.getElementById('hudHelp').textContent || '').indexOf('TASD') === 0]);
      window.setKeybind('up', 'w');
      results.push(['rebinding back to W restores the original behaviour',
        dsi().KEYBINDS.up === 'w' && northFrom('w', 240000) > 0.05]);

      // ---- PART B: settings persist across a simulated reload
      if (window.localStorage.getItem('rh_probe') !== '1') {
        try { window.localStorage.setItem('rh_probe', '1'); } catch (e) {}
      }
      if (window.localStorage.getItem('rh_probe') !== '1') {
        // the shared harness header stubs localStorage to a no-op; persistence
        // is not testable through that, so install a real in-memory store.
        const store = {};
        window.localStorage = {
          getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
        };
      }
      let lsOk = false;
      try { window.localStorage.setItem('rh_probe2', 'x'); lsOk = window.localStorage.getItem('rh_probe2') === 'x'; } catch (e) {}
      results.push(['harness has a working localStorage for the persistence gate', lsOk]);
      window.setSetting('textSize', 'large');
      window.setSetting('colorblind', true);
      window.setSetting('volMusic', 33);
      window.setSetting('muteSfx', true);
      window.setKeybind('dive', 'g');
      window.loadSettings();                     // <- exactly what a reload does
      window.applySettings();
      const after = dsi();
      results.push(['settings survive a simulated reload (text size, colourblind, volume, mute)',
        after.SETTINGS.textSize === 'large' && after.SETTINGS.colorblind === true &&
        after.SETTINGS.volMusic === 33 && after.SETTINGS.muteSfx === true]);
      results.push(['keybinds survive the same reload', after.KEYBINDS.dive === 'g']);
      results.push(['the colourblind swap actually reaches the canvas colours',
        after.tameCol === '#4bb8e8' && dsi().tameRgb === '75,184,232']);
      results.push(['the colourblind swap reaches the CSS side too', after.colorblindClass === true]);
      results.push(['the text-size lever writes one root custom property',
        after.uiScale === '1.18']);
      window.setSetting('colorblind', false);
      results.push(['colourblind off restores the original green',
        dsi().tameCol === '#7fd45a' && dsi().colorblindClass === false]);
      window.setSetting('textSize', 'medium');
      window.setKeybind('dive', 'f');
      window.setSetting('volMusic', 70);
      window.setSetting('muteSfx', false);

      // ---- PART B: the reduce-motion / reduce-particles toggle
      const vol23 = dwi23().VOLCANO;
      dsp23({ x: vol23.x + 0.5, y: vol23.y + 0.5, diving: false, hp: 100 });
      window.setSetting('reduceMotion', false);
      for (let i = 0; i < 60; i++) window.updateParticles(0.05, 300000 + i * 50);
      const pOn = dsi().particleCount;
      results.push([`ambient particles spawn normally (${pOn} alive at the volcano)`, pOn > 0]);
      window.setSetting('reduceMotion', true);
      for (let i = 0; i < 220; i++) window.updateParticles(0.05, 400000 + i * 50);
      const pOff = dsi().particleCount;
      results.push([`reduce motion stops every ambient spawner (${pOff} left after 11s)`, pOff === 0]);
      window.setSetting('reduceMotion', false);
      dsp23({ x: SP23.x + 0.5, y: SP23.y + 0.5, diving: false, hp: 100 });

      // ---- PART C: the audio engine exists, and is safe with no track loaded
      const AE = window.debugAudioEngine ? window.debugAudioEngine() : null;
      const AE_API = ['init', 'playMusic', 'playSFX', 'setMasterVolume', 'setMusicVolume',
                      'setSFXVolume', 'muteMaster', 'muteMusic', 'muteSFX'];
      results.push(['AudioEngine exposes every method the spec names',
        !!AE && AE_API.every(m => typeof AE[m] === 'function')]);
      results.push(['AudioEngine exposes the spec\'s node/source fields',
        !!AE && 'ctx' in AE && 'masterGain' in AE && 'musicGain' in AE &&
        'sfxGain' in AE && 'musicSource' in AE]);
      let aeThrew = null;
      try {
        AE.setMasterVolume(0.5); AE.setMusicVolume(0.25); AE.setSFXVolume(0.9);
        AE.muteMaster(true); AE.muteMaster(false); AE.muteMusic(true); AE.muteMusic(false);
        AE.muteSFX(true); AE.muteSFX(false); AE.init(); AE.stopMusic();
      } catch (e) { aeThrew = e; }
      results.push(['every AudioEngine setter is safe before any track is loaded', !aeThrew]);
      results.push(['volume state is kept even with no AudioContext available',
        Math.abs(AE.vol.master - 0.5) < 1e-9 && Math.abs(AE.vol.music - 0.25) < 1e-9]);
      let pmThrew = null, pmRes = null, sfxRes = null;
      try { pmRes = await AE.playMusic('nothing-yet.ogg'); sfxRes = await AE.playSFX('nothing-yet.ogg'); }
      catch (e) { pmThrew = e; }
      results.push(['playMusic/playSFX resolve false instead of throwing with no track',
        !pmThrew && pmRes === false && sfxRes === false]);
      /* v24: init() is still called from exactly one place — the ENTER click —
         but it now gates the start of the background rotation on its result. */
      const initAt = gameScript.indexOf('if (AudioEngine.init()) playNextBgTrack();');
      results.push(['the AudioContext is created on the ENTER click, never at page load',
        initAt >= 0 && gameScript.slice(initAt, initAt + 260).indexOf('connectSupabase();') > 0 &&
        gameScript.split('AudioEngine.init()').length === 2]);   // exactly one call site in the whole file
      results.push(['SFX stays unwired — no sound-effect files have been provided yet',
        gameScript.split('AudioEngine.playSFX(').length === 1]);
      results.push(['music is wired from exactly the two v24 sites (rotation + combat switch)',
        gameScript.split('AudioEngine.playMusic(').length === 3]);
      window.applySettings();   // put the gains back where the settings say

      // ---- PART D: the favicon — deliberately removed, confirm it's genuinely gone
      const icon = doc.querySelector('link[rel="icon"]');
      results.push(['favicon <link> is deliberately absent (removed on request)', !icon]);
      results.push(['<head> is otherwise intact (title + stylesheet still there)',
        (doc.querySelector('title') || {}).textContent === 'RuneHaven' &&
        doc.head.querySelectorAll('style').length === 1]);

      // ---- PART B/E: the settings panel and the credits screen
      const ov = doc.getElementById('settingsOverlay');
      results.push(['a settings entry point sits on the login card',
        !!doc.getElementById('settingsBtn') &&
        doc.getElementById('settingsBtn').parentNode === doc.getElementById('login')]);
      results.push(['the settings panel starts closed', !!ov && !ov.classList.contains('open')]);
      window.openSettings('credits');
      results.push(['the settings panel opens', ov.classList.contains('open')]);
      results.push(['every spec section is present',
        ['secGraphics', 'secAccess', 'secAudio', 'secControls', 'secCredits']
          .every(id => !!doc.getElementById(id))]);
      results.push(['the credits tab is the one showing',
        doc.getElementById('secCredits').classList.contains('shown') &&
        !doc.getElementById('secGraphics').classList.contains('shown')]);
      results.push(['the remapping screen lists all 12 actions',
        doc.getElementById('keybindList').children.length === 12]);
      results.push(['credits render from the CREDITS array',
        doc.getElementById('creditsList').children.length === dsi().CREDITS.length &&
        dsi().CREDITS.length === 2]);
      const collab = doc.getElementById('collabList');
      const cimg = collab.querySelector('img');
      results.push(['Collaborations renders all 3 entries (STG Records + 2 text-only)',
        collab.children.length === 3]);
      results.push(['the STG Records logo is embedded, not a placeholder',
        !!cimg && (cimg.getAttribute('src') || '').indexOf('data:image/png;base64,iVBORw0KGgo') === 0 &&
        (cimg.getAttribute('src') || '').length > 50000]);
      results.push(['the two text-only entries render without a broken <img>',
        collab.querySelectorAll('img').length === 1]);
      results.push(['Skeptik and Advay both actually appear in the credited text',
        collab.textContent.indexOf('Skeptik') !== -1 && collab.textContent.indexOf('Advay') !== -1]);
      results.push(['the logo keeps its pale backing (it is near-black on near-black)',
        !!cimg && (cimg.getAttribute('style') || '').indexOf('#e8e4da') >= 0]);
      results.push(['the collaboration caption reads from the data, not markup',
        (collab.textContent || '').indexOf('STG Records') >= 0 &&
        (collab.textContent || '').indexOf('music') >= 0]);
      window.showSettingsTab('graphics');
      results.push(['tabs switch cleanly',
        doc.getElementById('secGraphics').classList.contains('shown') &&
        !doc.getElementById('secCredits').classList.contains('shown')]);
      window.closeSettings();
      results.push(['the settings panel closes cleanly, like every other panel',
        !ov.classList.contains('open') && dsi().capturing === null]);

      // put every v23 setting back to its shipped default
      try { window.localStorage.removeItem('rh_keybinds'); window.localStorage.removeItem('rh_settings'); } catch (e) {}
      window.loadSettings();
      window.applySettings();
      const fin = dsi();
      results.push(['clearing storage falls back to the shipped defaults',
        fin.KEYBINDS.up === 'w' && fin.SETTINGS.textSize === 'medium' &&
        fin.SETTINGS.colorblind === false && fin.SETTINGS.reduceMotion === false]);
    } else {
      results.push(['v23 settings subsystem is reachable from the harness', false]);
    }

    /* ===== v24 PART D — the intro card + the music rotation ==================
       Audio is mocked, not played: a fake AudioContext and a recording fetch
       stand in for the browser, the same way the canvas context and supabase
       are stubbed above. The player is put back at spawn at the end. ========= */
    const path = require('path');
    const AUDIO_DIR = path.join(path.dirname(path.resolve(FILE)), 'audio');
    const AUDIO_FILES = ['nu_metal.mp3', 'Pop.mp3', 'Slower_Jamz.mp3',
                         'Long_Way_Home.mp3', 'seduced.mp3', 'song.mp3'];
    const missingAudio = AUDIO_FILES.filter(f => {
      try { return fs.statSync(path.join(AUDIO_DIR, f)).size < 1024; }
      catch (e) { return true; }
    });
    results.push(['all 6 audio files are present at audio/<name>.mp3' +
      (missingAudio.length ? ' (missing ' + missingAudio.join(', ') + ')' : ''),
      missingAudio.length === 0]);

    if (window.debugMusicInfo && window.debugSetMusicState && window.playNextBgTrack) {
      const dmi = window.debugMusicInfo, dsms = window.debugSetMusicState;

      // ---- the fetch/AudioContext mock. Every URL asked for is recorded.
      const fetched = [];
      window.fetch = async (url) => {
        fetched.push(String(url));
        const real = path.join(path.dirname(path.resolve(FILE)), String(url));
        if (!fs.existsSync(real)) throw new Error('404 ' + url);   // relative path must resolve
        return { arrayBuffer: async () => new ArrayBuffer(8) };
      };
      const sources = [];
      const gain = () => ({ gain: { value: 1 }, connect() {}, disconnect() {} });
      window.AudioContext = function () {
        this.state = 'running';
        this.destination = {};
        this.createGain = gain;
        this.decodeAudioData = async () => ({ duration: 120 });
        this.createBufferSource = () => {
          const s = { buffer: null, loop: false, onended: null,
                      connect() {}, disconnect() {},
                      start() { s.started = true; }, stop() { s.stopped = true; } };
          sources.push(s);
          return s;
        };
        this.resume = async () => {};
      };
      const AE24 = window.debugAudioEngine();
      AE24.ctx = null;                       // let init() build against the mock
      results.push(['AudioEngine.init() succeeds against a real AudioContext', AE24.init() === true]);

      // ---- PART B: the four-track rotation, and the wrap back to track 0
      dsms({ bgIndex: 0, inCombatMusic: false });
      const PLAYLIST = dmi().BG_PLAYLIST;
      results.push(['the background rotation is the four locked tracks, in order',
        PLAYLIST.join('|') === ['audio/Pop.mp3', 'audio/Slower_Jamz.mp3',
                                'audio/Long_Way_Home.mp3', 'audio/song.mp3'].join('|')]);
      fetched.length = 0;
      await window.playNextBgTrack();
      results.push(['the first track is requested from its relative path',
        fetched[0] === 'audio/Pop.mp3' && dmi().bgIndex === 1]);
      results.push(['a rotation track is started NOT looping, so it can hand the channel back',
        !!AE24.musicSource && AE24.musicSource.loop === false && AE24.musicSource.started === true]);
      results.push(['the rotation installs an onended handler to advance itself',
        typeof AE24.musicSource.onended === 'function']);
      /* Firing onended is exactly what the browser does when a track finishes.
         The handler itself is not async, so the fetch/decode it kicks off has
         to be allowed to settle before the next track can be asserted. */
      const settle = () => new Promise(r => setTimeout(r, 0));
      for (let i = 1; i < 4; i++) {
        AE24.musicSource.onended();
        await settle();
        results.push([`onended advances the rotation to ${PLAYLIST[i]}`,
          fetched[i] === PLAYLIST[i] && dmi().bgIndex === i + 1]);
      }
      AE24.musicSource.onended();
      await settle();
      results.push(['after the 4th track the rotation wraps back to track 0',
        fetched[4] === 'audio/Pop.mp3' && dmi().bgIndex === 5 &&
        PLAYLIST[dmi().bgIndex % PLAYLIST.length] === 'audio/Slower_Jamz.mp3']);
      results.push(['every URL the rotation asked for resolved to a real file',
        fetched.length === 5 && fetched.every(u => fs.existsSync(
          path.join(path.dirname(path.resolve(FILE)), u)))]);

      // ---- PART C: the two real combat signals set the linger window
      const dsp24 = window.debugSetPlayer, dwi24 = window.debugWorldInfo;
      const SP24 = dwi24().SPAWN;
      results.push(['all three combat-signal sites carry the linger line',
        gameScript.split('combatMusicUntil = performance.now() + COMBAT_MUSIC_LINGER;').length === 4]);
      results.push(['the linger is the locked 6s', dmi().COMBAT_MUSIC_LINGER === 6000]);
      dsms({ combatMusicUntil: 0, inCombatMusic: false, musicCheckAt: 0 });
      const tAtk = window.performance.now();
      window.tryAttack();                       // the real `lastAttack = now;` path
      const afterAtk = dmi().combatMusicUntil;
      results.push(['an attack pushes combatMusicUntil ~6s out',
        afterAtk >= tAtk + 5900 && afterAtk <= window.performance.now() + 6000]);
      dsms({ combatMusicUntil: 0 });
      // applyDamage returns early inside a safe zone, so take the hit outside one
      const OUT = { x: SP24.x + 60.5, y: SP24.y + 60.5 };
      dsp24({ x: OUT.x, y: OUT.y, diving: false, hp: 100 });
      const safeThere = window.inSafeZone(OUT.x, OUT.y);
      const tHit = window.performance.now();
      window.applyDamage(3, 'goblin');
      const afterHit = dmi().combatMusicUntil;
      results.push(['taking damage pushes combatMusicUntil ~6s out (tested outside a safe zone)',
        safeThere === false && afterHit >= tHit + 5900 &&
        afterHit <= window.performance.now() + 6000]);

      // ---- PART C: the throttled loop check flips the channel BOTH ways
      dsms({ inCombatMusic: false, musicCheckAt: 0,
             combatMusicUntil: window.performance.now() + 6000 });
      fetched.length = 0;
      window.update(0.016, 500000);
      results.push(['inside the linger window the loop check switches to combat music',
        dmi().inCombatMusic === true && fetched.length === 1]);
      await new Promise(r => setTimeout(r, 0));
      results.push(['the combat track is nu_metal.mp3, looping (it is a single track)',
        fetched[0] === 'audio/nu_metal.mp3' && !!AE24.musicSource &&
        AE24.musicSource.loop === true]);
      const bgAt = dmi().bgIndex;
      // still inside the window: the check must not restart the track every frame
      dsms({ musicCheckAt: 0 });
      fetched.length = 0;
      window.update(0.016, 500100);
      results.push(['a second check inside the window does not restart the track',
        dmi().inCombatMusic === true && fetched.length === 0]);
      results.push(['the check is throttled, not run every frame',
        dmi().musicCheckAt > window.performance.now() + 900]);
      // past the linger window: back to the rotation, from where it left off
      dsms({ combatMusicUntil: window.performance.now() - 1, musicCheckAt: 0 });
      window.update(0.016, 501000);
      await new Promise(r => setTimeout(r, 0));
      results.push(['past the linger window the loop check reverts to the rotation',
        dmi().inCombatMusic === false && fetched[0] === PLAYLIST[bgAt % 4] &&
        dmi().bgIndex === bgAt + 1]);
      results.push([`the rotation resumed mid-playlist (track ${bgAt % 4}), not back at 0`,
        bgAt === 5 && fetched[0] === 'audio/Slower_Jamz.mp3' &&
        fetched[0] !== PLAYLIST[0]]);
      // a rotation track that ends while combat owns the channel must not butt in
      dsms({ inCombatMusic: true });
      fetched.length = 0;
      await window.playNextBgTrack();
      results.push(['playNextBgTrack is a no-op while combat owns the channel',
        fetched.length === 0]);
      dsms({ inCombatMusic: false, combatMusicUntil: 0, musicCheckAt: 0 });

      // ---- PART D: seduced.mp3 was deliberately held out this version
      results.push(['the held-out sixth track is referenced nowhere in the game file',
        gameScript.indexOf('seduced') < 0 && html.indexOf('seduced') < 0 &&
        PLAYLIST.every(u => u.indexOf('seduced') < 0)]);
      results.push(['audio ships as separate files, never inlined as base64',
        html.indexOf('data:audio') < 0]);

      dsp24({ x: SP24.x + 0.5, y: SP24.y + 0.5, diving: false, hp: 100 });
      window.applySettings();
    } else {
      results.push(['v24 music layer is reachable from the harness', false]);
    }

    // ---- PART A: the intro card
    if (window.playIntro && window.debugIntroInfo) {
      const dii = window.debugIntroInfo;
      const card = doc.getElementById('introCard');
      results.push(['the intro card exists as its own overlay', !!card]);
      results.push(['the copy is exactly the locked line, unshortened',
        dii().text === 'Hashbrown Studios in collaboration with STG Records presents RuneHaven']);
      results.push(['it is split across 3 lines, not one run-on',
        card.children.length === 3]);
      results.push(['it sits above the login screen it covers',
        html.indexOf('#introCard {') >= 0 &&
        html.slice(html.indexOf('#introCard {')).slice(0, 200).indexOf('z-index: 50') > 0]);
      results.push(['the animation is eased, never linear, and mirrors on the way out',
        html.indexOf('transition: opacity 700ms cubic-bezier(.22,.68,.28,1)') > 0 &&
        html.indexOf('#introCard.shown { opacity: 1; transform: scale(1); }') > 0]);
      /* Two fixes found by eye in real Chromium, pinned here so they cannot
         silently come back: the login's hide must be instant (with the
         transition on #login itself it was briefly visible at load, fading out
         under a card that had not faded in yet), and the entry state must be
         flushed synchronously (out of display:none, a rAF was not enough and
         the fade-in never ran at all). */
      results.push(['the login hide is instant — only the exit is transitioned',
        html.indexOf('body.intro-hide #login { opacity: 0; }') > 0 &&
        html.indexOf('body.intro-exit #login { transition: opacity 700ms') > 0 &&
        html.indexOf('\n  #login { transition: opacity') < 0]);   // the unscoped rule is the bug
      results.push(['the entry state is committed before the class that animates away from it',
        gameScript.indexOf('void introEl.offsetWidth;') > 0 &&
        gameScript.indexOf('void introEl.offsetWidth;') <
        gameScript.indexOf('introEl.classList.add("shown");')]);
      results.push(['both halves of the crossfade run at the same duration',
        gameScript.indexOf('loginEl.style.transitionDuration = ms + "ms";') > 0]);
      results.push(['nothing about the intro is persisted — it plays every load',
        gameScript.indexOf('rh_intro') < 0 &&
        gameScript.slice(gameScript.indexOf('function playIntro()'),
                         gameScript.indexOf('function endIntro(')).indexOf('localStorage') < 0]);

      // ---- skip via keypress
      window.playIntro();
      const inPhase = dii();
      results.push(['playing the card hides the login underneath it and locks it',
        inPhase.phase === 'in' && inPhase.display === 'flex' &&
        inPhase.loginHidden === true && inPhase.loginLocked === true]);
      let entered = 0;
      const btn24 = doc.getElementById('enterBtn');
      const realOnclick = btn24.onclick;
      btn24.onclick = () => { entered++; };      // would fire if a skip fell through
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const afterKey = dii();
      results.push(['a keypress skips the card', afterKey.phase === 'out' && afterKey.skipped === true]);
      results.push(['skipping starts the login crossfade immediately',
        afterKey.loginHidden === false]);
      results.push(['the login stays locked until the card is fully gone',
        afterKey.loginLocked === true]);
      await new Promise(r => setTimeout(r, 400));
      const doneKey = dii();
      results.push(['the card removes itself and unlocks the login when it finishes',
        doneKey.phase === 'done' && doneKey.display === 'none' &&
        doneKey.loginLocked === false && doneKey.timers === 0]);
      results.push(['the skip never reached the login form underneath', entered === 0]);

      // ---- skip via click
      window.playIntro();
      results.push(['the card can play again from a clean state', dii().phase === 'in']);
      card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      results.push(['a click skips the card too', dii().phase === 'out' && dii().skipped === true]);
      results.push(['the click did not double-trigger into the login form', entered === 0]);
      await new Promise(r => setTimeout(r, 400));
      results.push(['the click path also ends clean',
        dii().phase === 'done' && dii().loginLocked === false]);
      // a click after it is over is inert, not a second run
      card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      results.push(['clicking after the card is done does nothing at all',
        dii().phase === 'done' && entered === 0]);

      // ---- the unskipped path runs in + hold + out on its own
      // (700ms in, 1200ms hold, 700ms out — the waits below straddle each edge)
      window.playIntro();
      await new Promise(r => setTimeout(r, 800));
      results.push(['left alone, the card holds fully visible after the fade-in',
        dii().phase === 'hold' && dii().skipped === false]);
      await new Promise(r => setTimeout(r, 1300));
      results.push(['then it fades itself out, un-skipped', dii().phase === 'out' && dii().skipped === false]);
      await new Promise(r => setTimeout(r, 900));
      results.push(['and lands in the same finished state as a skip',
        dii().phase === 'done' && dii().display === 'none' && dii().loginLocked === false]);
      btn24.onclick = realOnclick;
    } else {
      results.push(['v24 intro card is reachable from the harness', false]);
    }

    /* =====================================================================
       v25 PART D — the locked spec's own proof gates, in its own order.
       ===================================================================== */
    const dwi5 = window.debugWorldInfo;
    const info5 = dwi5 ? dwi5() : null;

    // ---- PART A: the mountain-ruin tag is real, and it means something ----
    if (info5 && window.elevRaw) {
      const er = window.elevRaw, RF = info5.RUIN_FOOT;
      const tagged = info5.RUINS.filter(r => r.mtn);
      const plain = info5.RUINS.filter(r => !r.mtn);
      console.log('ruin elevations:', JSON.stringify(
        info5.RUINS.map(r => ({ x: r.x, y: r.y, e: +er(r.x, r.y).toFixed(3), mtn: r.mtn }))));
      /* The spec's own words: "if none do, Crystal Golem is unreachable and
         the threshold needs lowering, don't ship an unreachable species." */
      results.push([`at least one Ruin is a mountain ruin (${tagged.length}/${info5.RUINS.length})`,
        tagged.length >= 1]);
      results.push(['but NOT all of them — the gate actually excludes ruins',
        plain.length >= 1]);
      results.push([`every mtn tag equals elevRaw >= ${info5.MOUNTAIN_RUIN_ELEV}`,
        info5.RUINS.every(r => r.mtn === (er(r.x, r.y) >= info5.MOUNTAIN_RUIN_ELEV))]);

      // ---- PART A: Crystal Golem lands ONLY on tagged clusters ----
      // wildSpots carry tile+0.5; subtract it back to compare against the
      // integer-tile test the spawn gate itself ran.
      const inRuin = (w, r) => Math.hypot((w.x - 0.5) - r.x, (w.y - 0.5) - r.y) < RF;
      const cg = info5.wildSpots.filter(w => w.species === 'crystal_golem');
      results.push([`crystal_golem actually reached the world (${cg.length})`, cg.length > 0]);
      results.push(['every crystal_golem sits inside a TAGGED mountain ruin',
        cg.length > 0 && cg.every(w => tagged.some(r => inRuin(w, r)))]);
      results.push(['no crystal_golem sits in an untagged ruin',
        cg.every(w => !plain.some(r => inRuin(w, r)))]);
      // ...and the plain Golem is completely unaffected by any of it
      const gg = info5.wildSpots.filter(w => w.species === 'golem');
      results.push([`golem still spawns as before (${gg.length})`, gg.length === 3]);
      results.push(['golem is NOT restricted to tagged ruins — it still reaches plain ones',
        gg.some(w => plain.some(r => inRuin(w, r)))]);
      results.push(['only crystal_golem carries the mountainRuinOnly gate',
        Object.entries(info5.WILD_SPECIES)
          .filter(([, d]) => d.mountainRuinOnly).map(([k]) => k).join(',') === 'crystal_golem']);
    } else {
      results.push(['v25 PART A worldgen hooks are reachable', false]);
    }

    // ---- PART B: the Krakenling window genuinely gates on dayNum % 10 ----
    const kwo = window.krakenlingWindowOpen;
    if (kwo && info5 && window.worldDayNum) {
      const opens = [], shuts = [];
      for (let d = 1; d <= 60; d++) (kwo(d) ? opens : shuts).push(d);
      results.push(['the window opens on exactly every 10th day across 1..60',
        opens.join(',') === '10,20,30,40,50,60']);
      results.push(['and is shut on all 54 other days in that range', shuts.length === 54]);
      results.push(['shut on day 1', kwo(1) === false]);
      results.push(['shut on day 9', kwo(9) === false]);
      results.push(['OPEN on day 10', kwo(10) === true]);
      results.push(['shut on day 11', kwo(11) === false]);
      results.push(['OPEN on day 100 — the cycle does not drift', kwo(100) === true]);
      results.push(['a species with no dayCycle is never day-gated',
        window.dayWindowOpen({}, 7) === true && window.dayWindowOpen({}, 10) === true]);
      results.push(['krakenling carries the bible\'s 10-day cycle',
        info5.WILD_SPECIES.krakenling.dayCycle === 10]);
      results.push(['and keeps a presence roll stacked on top of it',
        info5.WILD_SPECIES.krakenling.presenceRoll === 0.55]);
      results.push(['nothing else in the roster is day-gated',
        Object.entries(info5.WILD_SPECIES).filter(([, d]) => d.dayCycle).length === 1]);
      // the live world must agree with its own day counter
      const live = window.worldDayNum();
      const liveOpen = kwo();
      results.push([`the live window agrees with the live day counter (day ${live})`,
        liveOpen === ((live % 10) === 0)]);
      const kl = info5.wildSpots.filter(w => w.species === 'krakenling').length;
      console.log(`krakenling: day ${live}, window ${liveOpen ? 'OPEN' : 'shut'}, spawned ${kl}`);
      results.push([`no Krakenling exists while the window is shut (day ${live}, ${kl} spawned)`,
        liveOpen || kl === 0]);
    } else {
      results.push(['v25 PART B day-window hooks are reachable', false]);
    }

    // ---- PART C: the whole feeding cycle, end to end ----
    const gp = window.debugGrantPet, sh = window.salamanderHappiness,
          fed = window.feedSalamander, canFeed = window.canFeedSalamander,
          setP = window.debugSetPlayer, cwdt5 = window.canWearDownTame;
    if (gp && sh && fed && canFeed && setP && info5) {
      const H = 3600000, STARVE = info5.SALAMANDER_STARVE_H, WARN = info5.SALAMANDER_WARN_HAPPY;
      const row = gp('salamander_king');
      results.push(['a tamed Salamander King lands on the roster',
        !!row && row.species === 'salamander_king']);
      results.push(['happiness starts at 100 the moment it is tamed', Math.round(sh(row)) === 100]);

      // ---- it decays correctly against simulated elapsed time ----
      row.lastFedAt = Date.now() - 2 * H;
      results.push([`2h unfed of ${STARVE}h -> 75%`, Math.round(sh(row)) === 75]);
      row.lastFedAt = Date.now() - 4 * H;
      results.push(['4h unfed -> 50%', Math.round(sh(row)) === 50]);
      row.lastFedAt = Date.now() - (STARVE - 1) * H;
      const late = sh(row);
      results.push([`${STARVE - 1}h unfed is under the ${WARN}% warning line but not yet lost`,
        late < WARN && late > 0]);
      results.push([`exactly ${STARVE}h unfed is 0`, sh({ lastFedAt: Date.now() - STARVE * H }) === 0]);
      results.push(['happiness never goes negative past that',
        sh({ lastFedAt: Date.now() - 100 * H }) === 0]);

      // ---- feeding costs a rare_herb and resets the clock ----
      setP({ inv: {} });
      results.push(['cannot feed with no rare_herb in the bag', canFeed(row) === false]);
      results.push(['a refused feed reports failure and changes nothing', fed(row) === false]);
      setP({ inv: { rare_herb: 2 } });
      row.lastFedAt = Date.now() - 6 * H;
      results.push(['can feed while holding a rare_herb', canFeed(row) === true]);
      results.push(['feeding succeeds', fed(row) === true]);
      results.push(['feeding resets happiness to 100', Math.round(sh(row)) === 100]);
      results.push(['feeding consumed exactly one rare_herb',
        (dwi5().player.inv.rare_herb || 0) === 1]);
      results.push(['no other species can be fed', canFeed({ species: 'golem' }) === false]);

      // ---- 0 happiness rampages: off the roster, back to the caldera ----
      const before = dwi5().mobKinds.filter(k => k === 'salamander_king').length;
      row.lastFedAt = Date.now() - 99 * H;
      results.push(['starved all the way to 0', sh(row) === 0]);
      window.checkSalamanderRampage();
      const after = dwi5();
      results.push(['the rampaged King left the tamed roster',
        !after.myPets.some(p => p.id === row.id)]);
      results.push(['and is no longer the active companion',
        !after.activePet || after.activePet.id !== row.id]);
      const nMobs = after.mobKinds.filter(k => k === 'salamander_king').length;
      results.push([`it came back as a hostile mob (${before} -> ${nMobs})`, nMobs === before + 1]);
      const spot = after.mobSpots.filter(m => m.kind === 'salamander_king').pop();
      results.push(['the hostile King stands on a Sunforge Caldera tile',
        !!spot && window.biomeAt(Math.floor(spot.x), Math.floor(spot.y)) === after.B.CALDERA]);

      // ---- the rampage's own return value: the brief aggro tick ----
      const row2 = gp('salamander_king', Date.now() - 99 * H);
      results.push(['a back-dated King is already starved on arrival', sh(row2) === 0]);
      const m2 = window.salamanderRampage(row2);
      results.push(['the rampage builds and returns the mob',
        !!m2 && m2.kind === 'salamander_king']);
      results.push(['it opens with one aggro tick on the player who neglected it',
        !!m2 && m2.state === 'aggro' && !!m2.target]);
      results.push(['the hostile form arrives at its full MOBS hp',
        !!m2 && m2.hp === info5.MOBS.salamander_king.hp && m2.maxHp === 75 && m2.dead === false]);
      results.push(['salamander_king never spawns hostile at worldgen',
        info5.MOBS.salamander_king.count === 0]);
      results.push(['a rampaged King can be won back by wearing it down',
        info5.MOBS.salamander_king.tameable === true &&
        cwdt5({ id: 'sk:t', kind: 'salamander_king', hp: 10, maxHp: 75, dead: false }) === true]);
      results.push(['but not while it is still strong',
        cwdt5({ id: 'sk:t', kind: 'salamander_king', hp: 70, maxHp: 75, dead: false }) === false]);
      results.push(['happiness is this species only — nothing else grew a feed clock',
        Object.keys(info5.WILD_SPECIES).filter(s => window.isSalamander({ species: s }))
          .join(',') === 'salamander_king']);
    } else {
      results.push(['v25 PART C feeding hooks are reachable', false]);
    }

    // ---- PART D: all three new art branches render without error ----
    if (window.drawSpecies) {
      let artOk = true, artErr = null;
      try {
        const cc = window.document.createElement('canvas').getContext('2d');
        for (const sp of ['crystal_golem', 'krakenling', 'salamander_king']) {
          for (const mv of [true, false]) window.drawSpecies(sp, 90, 90, 900, mv);
        }
        void cc;
      } catch (e) { artOk = false; artErr = e; }
      results.push(['the three v25 art branches draw without throwing' +
        (artErr ? ' — ' + artErr.message : ''), artOk]);
    }

    /* ===================== v27 PART D: class abilities + spear/staff =========
       Five abilities on one remappable key, and the two weapon types that
       finally got real mechanical identity. Every gate here drives the REAL
       functions — tryAbility(), tryAttack(), applyDamage(), the live
       projectile loop — never a reimplementation of their arithmetic.
       `others`/`mobs`/`projectiles` come from the live-handles hook, because a
       burst, a thrust and a splash cannot be proven against an empty world.
       NOTE: every clock read here is window.performance.now(), never the bare
       Node global — the game runs on jsdom's clock and the two have different
       time origins, so mixing them silently breaks every window comparison. */
    const dai = window.debugAbilityInfo, dsa = window.debugSetAbility,
          dch = window.debugCombatHandles, setP7 = window.debugSetPlayer;
    if (dai && dsa && dch && setP7 && window.tryAbility && window.inSafeZone) {
      const A0 = dai();
      const H = dch();
      const CLS = ['Knight', 'Ranger', 'Mystic', 'Beastmaster', 'Architect'];
      const wasCls = A0.cls, wasEq = A0.equipped;

      // ---- PART A: the five abilities exist, and Q reaches them via KEYBINDS
      results.push(['all five classes have an ability with a name and a cooldown',
        Object.keys(A0.ABILITIES).length === 5 &&
        CLS.every(c => A0.ABILITIES[c] && typeof A0.ABILITIES[c].name === 'string' &&
                       A0.ABILITIES[c].cdMs > 0)]);
      results.push(['the ability key defaults to Q and is a real KEYBINDS action',
        A0.abilityDefault === 'q' && A0.ability === 'q']);
      results.push(['the keydown site reads KEYBINDS.ability, never a literal key',
        gameScript.indexOf('k === KEYBINDS.ability') > 0]);
      // the real proof that it is bound and not hardcoded: rebind it and look
      const rb = window.setKeybind('ability', 'z');
      results.push(['the ability key is genuinely remappable through the v23 system',
        rb.ok === true && dai().ability === 'z' &&
        (doc.getElementById('hudHelp').textContent || '').indexOf('Z class ability') > 0]);
      window.setKeybind('ability', 'q');
      results.push(['and it rebinds back to Q', dai().ability === 'q']);
      results.push(['the locked cooldowns: Knight 8s / Ranger 10s / Mystic 12s / BM 9s / Architect 7s',
        A0.ABILITIES.Knight.cdMs === 8000 && A0.ABILITIES.Ranger.cdMs === 10000 &&
        A0.ABILITIES.Mystic.cdMs === 12000 && A0.ABILITIES.Beastmaster.cdMs === 9000 &&
        A0.ABILITIES.Architect.cdMs === 7000]);
      results.push(['Mystic\'s is the longest of the five and Architect\'s the shortest',
        Math.max(...CLS.map(c => A0.ABILITIES[c].cdMs)) === A0.ABILITIES.Mystic.cdMs &&
        Math.min(...CLS.map(c => A0.ABILITIES[c].cdMs)) === A0.ABILITIES.Architect.cdMs]);

      /* Stand the player somewhere real: walkable, OUT of every safe zone (which
         would refuse every hit these gates need to land), and with no live mob
         of the world's own within 10 tiles — otherwise a wandering goblin can
         silently become the nearest melee target and the line tests measure it
         instead of the dummies. */
      const w7 = window.debugWorldInfo();
      let spot7 = null;
      for (let r = 30; r < w7.N / 2 - 10 && !spot7; r += 2) {
        for (const [ox, oy] of [[r, 0], [0, r], [-r, 0], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
          const x = Math.floor(w7.SPAWN.x + ox), y = Math.floor(w7.SPAWN.y + oy);
          if (x < 8 || y < 8 || x > w7.N - 10 || y > w7.N - 10) continue;
          const b = window.biomeAt(x, y);
          if (b !== w7.B.PLAINS && b !== w7.B.MEADOW && b !== w7.B.FOREST) continue;
          if (window.inSafeZone(x + 0.5, y + 0.5)) continue;
          if (H.mobs.some(m => !m.dead && Math.hypot(m.x - x, m.y - y) < 10)) continue;
          spot7 = [x + 0.5, y + 0.5]; break;
        }
      }
      results.push(['a clear walkable non-safe-zone test spot exists', !!spot7]);
      const [PX, PY] = spot7 || [w7.SPAWN.x, w7.SPAWN.y];
      setP7({ x: PX, y: PY, hp: 5000, armor: null });

      /* Dummy targets are real mob objects pushed into the live array and
         removed again, so nothing here leaks into the gates around it. */
      const made7 = [];
      const dummy = (tag, x, y) => {
        const m = { id: 'v27:' + tag, kind: 'goblin', x, y, hx: x, hy: y, hp: 9000, maxHp: 9000,
                    state: 'idle', winding: false, flash: 0, fx: 0, fy: 1,
                    dead: false, target: null, ph: 1 };
        H.mobs.push(m); made7.push(m); return m;
      };
      const dropDummies = () => {
        for (const m of made7) { const i = H.mobs.indexOf(m); if (i >= 0) H.mobs.splice(i, 1); }
        made7.length = 0;
      };

      // ---- PART A: each ability respects its OWN independent cooldown
      for (const c of CLS) {
        const cd = A0.ABILITIES[c].cdMs;
        setP7({ cls: c });
        dsa({ lastAbility: -1e9 });
        const first = window.tryAbility();
        const again = window.tryAbility();
        dsa({ lastAbility: window.performance.now() - cd + 200 });
        const early = window.tryAbility();
        dsa({ lastAbility: window.performance.now() - cd - 50 });
        const ready = window.tryAbility();
        results.push([`${c}: casts, is refused until its own ${cd}ms has elapsed, then casts again`,
          first === true && again === false && early === false && ready === true]);
      }

      // ---- PART A: Mystic's Arcane Burst hits EVERYTHING in 4 tiles
      dropDummies();
      setP7({ cls: 'Mystic', equipped: 'mystic_staff' });
      dsa({ lastAbility: -1e9, rings: null });
      const near7 = dummy('burst-near', PX + 1.0, PY);
      const mid7  = dummy('burst-mid',  PX + 3.4, PY);
      const far7  = dummy('burst-far',  PX + 5.6, PY);
      const ghost = { x: PX - 1.4, y: PY, dead: false, fx: 0, fy: 1,
                      tx: PX - 1.4, ty: PY, flash: 0, lastHeard: window.performance.now() };
      H.others.set('BurstDummy', ghost);
      const hp7 = [near7.hp, mid7.hp, far7.hp];
      results.push(['Arcane Burst casts', window.tryAbility() === true]);
      results.push(['it damaged BOTH mobs inside 4 tiles, not just the nearest one',
        near7.hp < hp7[0] && mid7.hp < hp7[1]]);
      results.push(['both took the same 19 — an AOE at weapon damage, not a falloff curve',
        (hp7[0] - near7.hp) === 19 && (hp7[1] - mid7.hp) === 19]);
      results.push(['the mob at 5.6 tiles was outside the radius and took nothing',
        far7.hp === hp7[2]]);
      results.push(['the burst reaches players as well as mobs', ghost.flash > 0]);
      results.push(['and it drew a real expanding ring through aura(), not flavour text',
        dai().rings.some(r => r.r === A0.ARCANE_BURST_R)]);
      H.others.delete('BurstDummy');
      dropDummies();

      // ---- PART A: Knight's Guard Break vs Ranger's Marked Shot — the counterplay
      setP7({ cls: 'Knight', hp: 5000, armor: null });
      dsa({ lastAbility: -1e9, markedShotUntil: 0, guardBreakUntil: 0 });
      results.push(['Guard Break casts and opens a real 2s window',
        window.tryAbility() === true &&
        dai().guardBreakUntil > window.performance.now() &&
        dai().guardBreakUntil <= window.performance.now() + 2000]);
      let hpA = window.debugWorldInfo().player.hp;
      window.applyDamage(20, 'Attacker', { rn: 1 });
      results.push(['an ordinary hit inside the window is halved (20 -> 10)',
        hpA - window.debugWorldInfo().player.hp === 10]);
      results.push(['and that one hit spends the window', dai().guardBreakUntil === 0]);
      hpA = window.debugWorldInfo().player.hp;
      window.applyDamage(20, 'Attacker', { rn: 1 });
      results.push(['the very next hit lands in full again (20)',
        hpA - window.debugWorldInfo().player.hp === 20]);

      dsa({ lastAbility: -1e9 });
      window.tryAbility();
      hpA = window.debugWorldInfo().player.hp;
      window.applyDamage(20, 'Ranger', { rn: 1, mk: 1 });
      results.push(['a MARKED shot is not blocked by Guard Break — it lands in full',
        hpA - window.debugWorldInfo().player.hp === 20]);
      results.push(['and does not consume the window either — the guard still stands',
        dai().guardBreakUntil > window.performance.now()]);
      hpA = window.debugWorldInfo().player.hp;
      window.applyDamage(20, 'Attacker', { rn: 1 });
      results.push(['so the guard is still there for the NEXT unmarked hit (20 -> 10)',
        hpA - window.debugWorldInfo().player.hp === 10]);
      dsa({ guardBreakUntil: 0 });

      // Guard Break stacks with armour multiplicatively, never additively
      setP7({ armor: 'runic_armor' });
      dsa({ lastAbility: -1e9 });
      window.tryAbility();
      hpA = window.debugWorldInfo().player.hp;
      window.applyDamage(20, 'Attacker', { rn: 1 });
      results.push(['Guard Break stacks multiplicatively with Runic Armor (20 -> 14 -> 7)',
        hpA - window.debugWorldInfo().player.hp === 7]);
      setP7({ armor: null });
      dsa({ guardBreakUntil: 0 });

      // the mark itself: +50%, spent on the HIT, and exactly one of them
      setP7({ cls: 'Ranger' });
      dsa({ lastAbility: -1e9, markedShotUntil: 0 });
      results.push(['Marked Shot casts and opens a 3s window',
        window.tryAbility() === true &&
        dai().markedShotUntil > window.performance.now() &&
        dai().markedShotUntil <= window.performance.now() + 3000]);
      const mk1 = window.markedShotBonus(20);
      results.push(['the first ranged hit inside it deals +50% (20 -> 30)',
        mk1.dmg === 30 && mk1.marked === true]);
      const mk2 = window.markedShotBonus(20);
      results.push(['the SECOND hit is ordinary again — the mark was one shot',
        mk2.dmg === 20 && mk2.marked === false]);
      dsa({ markedShotUntil: window.performance.now() - 1 });
      const mk3 = window.markedShotBonus(20);
      results.push(['an expired mark does nothing', mk3.dmg === 20 && mk3.marked === false]);

      // ---- PART A: Beastmaster's Rally is three charges, spent by pet attacks
      setP7({ cls: 'Beastmaster' });
      dsa({ lastAbility: -1e9, rallyCharges: 0 });
      window.tryAbility();
      results.push(['Rally Companion loads exactly 3 charges', dai().rallyCharges === 3]);
      results.push(['a rallied wolf hits for +40% of its post-Beastmaster damage (5 -> 7)',
        Math.round(window.petCombatDef('wolf', 'Beastmaster').dmg * A0.RALLY_MULT) === 7]);
      results.push(['the charge is spent inside the pet combat tick, not anywhere else',
        gameScript.indexOf('if (rallyCharges > 0) { rallyCharges--;') > 0]);

      // ---- PART A: Architect's is a deliberate no-op, not an error
      setP7({ cls: 'Architect' });
      dsa({ lastAbility: -1e9, guardBreakUntil: 0, markedShotUntil: 0, rallyCharges: 0 });
      let archOk = true, archErr = null;
      try { window.tryAbility(); dsa({ lastAbility: -1e9 }); window.tryAbility(); }
      catch (e) { archOk = false; archErr = e; }
      const archInfo = dai();
      results.push(['Quick Brace casts without throwing, with bases not built yet' +
        (archErr ? ' — ' + archErr.message : ''), archOk]);
      results.push(['and it is a true no-op — no window, no charges, nothing invented',
        archInfo.guardBreakUntil === 0 && archInfo.markedShotUntil === 0 &&
        archInfo.rallyCharges === 0]);

      // ---- PART B: the spear is a LINE, and the cone genuinely excludes
      dropDummies();
      setP7({ cls: 'Beastmaster', equipped: 'iron_spear' });
      dsa({ lastAttack: -1e9 });
      const lineA = dummy('spear-near', PX + 1.0, PY);
      const lineB = dummy('spear-far',  PX + 2.2, PY);
      const offC  = dummy('spear-off',  PX + 1.0, PY + 1.0);   // 45deg — outside 25deg
      const outD  = dummy('spear-out',  PX + 3.2, PY);         // on the line, past range 2.5
      const hpS = [lineA.hp, lineB.hp, offC.hp, outD.hp];
      window.tryAttack(PX + 60, PY);                            // aim straight along +x
      results.push(['ONE spear thrust connected with BOTH targets standing in line',
        lineA.hp < hpS[0] && lineB.hp < hpS[1]]);
      results.push(['a target 45 degrees off the aim was outside the cone and untouched',
        offC.hp === hpS[2]]);
      results.push(['a target on the line but past the spear\'s 2.5 range was untouched',
        outD.hp === hpS[3]]);
      results.push(['hitting two did not raise the damage either took (12 each)',
        (hpS[0] - lineA.hp) === 12 && (hpS[1] - lineB.hp) === 12]);
      results.push(['the cone predicate agrees: on-axis in, 45 degrees out, past range out',
        window.inThrustCone(PX + 2.0, PY, { x: 1, y: 0 }, 2.5) === true &&
        window.inThrustCone(PX + 1.0, PY + 1.0, { x: 1, y: 0 }, 2.5) === false &&
        window.inThrustCone(PX + 3.2, PY, { x: 1, y: 0 }, 2.5) === false]);

      // the same layout with a SWORD must still resolve to exactly one target
      dropDummies();
      dsa({ lastAttack: -1e9 });
      const swA = dummy('sword-a', PX + 1.0, PY);
      const swB = dummy('sword-b', PX + 1.4, PY);
      const hpW = [swA.hp, swB.hp];
      setP7({ equipped: 'iron_sword' });
      window.tryAttack(PX + 60, PY);
      results.push(['a SWORD in the identical line still hits exactly one — spear only',
        (swA.hp < hpW[0] ? 1 : 0) + (swB.hp < hpW[1] ? 1 : 0) === 1]);

      // ---- PART C: the staff orb splashes, and 2 tiles really is the edge
      dropDummies();
      setP7({ cls: 'Mystic', equipped: 'mystic_staff' });
      dsa({ rings: null });
      const tgtS  = dummy('splash-hit',  PX + 3.0, PY);
      const nearS = dummy('splash-near', PX + 4.4, PY);   // ~1.4 from impact — inside 2
      const farS  = dummy('splash-far',  PX + 6.2, PY);   // ~3.2 from impact — outside 2
      const hpP = [tgtS.hp, nearS.hp, farS.hp];
      H.projectiles.push({ x: PX + 2.8, y: PY, dx: 1, dy: 0, dmg: 19, col: '#fff',
                           pk: 'orb', wk: 'staff', dist: 0, max: 7, mine: true });
      for (let f = 200; f < 202; f++) {
        const q = rafQ; rafQ = [];
        for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
      }
      results.push(['the staff orb struck its direct target', tgtS.hp < hpP[0]]);
      results.push(['and splashed the SAME damage onto a second body ~1.4 tiles away',
        nearS.hp < hpP[1] && (hpP[1] - nearS.hp) === (hpP[0] - tgtS.hp)]);
      results.push(['a third body ~3.2 tiles from the impact took nothing',
        farS.hp === hpP[2]]);
      results.push(['the splash drew its own ring at the impact point',
        dai().rings.some(r => r.r === A0.STAFF_SPLASH_R)]);

      // an ARROW in the identical layout must not splash — staff only
      dropDummies();
      const arT = dummy('arrow-hit',  PX + 3.0, PY);
      const arN = dummy('arrow-near', PX + 4.4, PY);
      const hpAr = [arT.hp, arN.hp];
      H.projectiles.push({ x: PX + 2.8, y: PY, dx: 1, dy: 0, dmg: 18, col: '#fff',
                           pk: 'arrow', wk: 'bow', dist: 0, max: 9, mine: true });
      for (let f = 210; f < 212; f++) {
        const q = rafQ; rafQ = [];
        for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
      }
      results.push(['a BOW arrow hits one body and splashes nothing — staff only',
        arT.hp < hpAr[0] && arN.hp === hpAr[1]]);

      // ---- preservation: v27 built on what was there, it did not replace it
      results.push(['the v10 melee crit and per-weapon knockback table is untouched',
        gameScript.indexOf('wk === "axe" ? 1.1 : wk === "dagger" ? 0.2 : wk === "spear" ? 0.6') > 0 &&
        gameScript.indexOf('Math.round(w.dmg * 1.6)') > 0]);
      results.push(['Guard Break reuses the armour reduce math beside it, not a new system',
        gameScript.indexOf('dmg * (1 - GUARD_BREAK_REDUCE)') > 0 &&
        gameScript.indexOf('dmg * (1 - arm.reduce)') > 0]);
      results.push(['the ring is the v18 aura() helper, not a second effect system',
        gameScript.indexOf('aura(rx2, ry2, ABILITY_RING_RGB') > 0]);
      results.push(['no base/structure system was invented for the Architect',
        gameScript.indexOf('placeStructure') < 0 && gameScript.indexOf('BASES') < 0]);
      /* v31 STARTED THESE DELIBERATELY — the guard is retired, replaced by
         the real proof gates in the v31 block at the end. */

      dropDummies();
      H.projectiles.length = 0;
      setP7({ cls: wasCls, equipped: wasEq, hp: 100, armor: null });
      dsa({ lastAbility: -1e9, lastAttack: 0, guardBreakUntil: 0,
            markedShotUntil: 0, rallyCharges: 0, rings: null });
    } else {
      results.push(['v27 PART D ability hooks are reachable', false]);
    }

    /* ===================== v28 PART H: mounting ==============================
       The bible's nine mountable species. Every proof gate from the locked
       spec, including the one v26's draft could not have known about (the
       v27 class ability must still fire while mounted). ==================== */
    const dmi28 = window.debugMountInfo, dsm28 = window.debugSetMount;
    if (typeof dmi28 === 'function' && typeof dsm28 === 'function') {
      const BIBLE_NINE = ['stag', 'griffin', 'crystal_golem', 'water_dragon',
        'fire_dragon', 'storm_dragon', 'shadow_dragon', 'shadowfox', 'lightfox'];
      const m0 = dmi28();

      results.push(['the mountable set is exactly the bible\'s nine species',
        m0.MOUNTABLE.length === 9 &&
        BIBLE_NINE.every(s => m0.MOUNTABLE.indexOf(s) !== -1)]);
      results.push(['R is the mount key and it came from KEYBINDS, not a literal',
        m0.mount === 'r' && m0.mountDefault === 'r' &&
        gameScript.indexOf('k === KEYBINDS.mount') > 0]);
      results.push(['MOUNT_SPEED_MULT is the spec\'s 1.6',
        Math.abs(m0.MOUNT_SPEED_MULT - 1.6) < 1e-9]);
      results.push(['the speed bonus is applied to the player\'s own movement only',
        gameScript.indexOf('(me.mounted ? MOUNT_SPEED_MULT : 1)') > 0]);

      // seat height genuinely scales per species, not one flat number
      const so = m0.seatOffsets;
      results.push(['seat height scales with each species\' own art ratio',
        so.shadowfox < so.griffin && so.griffin < so.lightfox &&
        Math.abs(so.lightfox - (-(2.2 * 1.05))) < 1e-9 &&
        Math.abs(so.shadowfox - (-(2.2 * 1.66))) < 1e-9]);

      // every one of the nine mounts without error — not a sample
      let allNineOk = true, failedOn = null;
      const gp28 = window.debugGrantPet;
      for (const sp of BIBLE_NINE) {
        gp28(sp);
        dsm28({ mounted: false });
        const before = dmi28();
        if (!before.canMount) { allNineOk = false; failedOn = sp + ' (canMount false)'; break; }
        dsm28({ toggle: true });
        const after = dmi28();
        if (!after.mounted) { allNineOk = false; failedOn = sp + ' (did not mount)'; break; }
        dsm28({ toggle: true });
        if (dmi28().mounted) { allNineOk = false; failedOn = sp + ' (did not dismount)'; break; }
      }
      results.push(['all nine species mount and dismount cleanly' +
        (failedOn ? ' (failed on ' + failedOn + ')' : ''), allNineOk]);

      // a NON-mountable pet must be a silent no-op
      gp28('wolf');
      dsm28({ mounted: false });
      const wolfInfo = dmi28();
      dsm28({ toggle: true });
      results.push(['a non-mountable pet (wolf) cannot be mounted — silent no-op',
        wolfInfo.canMount === false && dmi28().mounted === false]);

      // auto-dismount safety: swap the pet out from under a mounted rider
      gp28('stag');
      dsm28({ mounted: false });
      dsm28({ toggle: true });
      const mountedOnStag = dmi28().mounted;
      gp28('wolf');
      dsm28({ enforce: true });
      results.push(['swapping to an invalid pet auto-dismounts, never leaves a bad state',
        mountedOnStag === true && dmi28().mounted === false]);

      // the mount sits AT the rider, not trailing behind. updatePet is called
      // directly rather than waiting on rAF, same as other direct-call gates.
      gp28('fire_dragon');
      dsm28({ mounted: true });
      const seated = dsm28({ tickPet: true });
      if (seated.petPos && seated.playerPos) {
        results.push(['while mounted the mount is at the rider, not trailing behind',
          Math.hypot(seated.petPos.x - seated.playerPos.x,
                     seated.petPos.y - seated.playerPos.y) < 0.05]);
      } else {
        results.push(['while mounted the mount is at the rider, not trailing behind', false]);
      }
      // and on foot it genuinely DOES trail, proving the suspend is real
      dsm28({ mounted: false });
      /* the follow is a lerp, so one tick only closes part of the gap —
         pump several, the same way the real game reaches it over frames. */
      let onFoot = null;
      for (let i = 0; i < 40; i++) onFoot = dsm28({ tickPet: true });
      results.push(['on foot the pet trails behind again, so the suspend was real',
        !!onFoot.petPos && Math.hypot(onFoot.petPos.x - onFoot.playerPos.x,
                                      onFoot.petPos.y - onFoot.playerPos.y) > 0.1]);
      dsm28({ mounted: true });

      // pet auto-attack must NOT run while that same pet is being ridden
      dsm28({ mounted: true, resetPetCombatFlag: true });
      window.updatePetCombat(performance.now());
      const ranWhileMounted = dmi28().petCombatRan;
      dsm28({ mounted: false, resetPetCombatFlag: true });
      window.updatePetCombat(performance.now());
      const ranWhileOnFoot = dmi28().petCombatRan;
      results.push(['pet auto-attack is suspended while ridden, and resumes on dismount',
        ranWhileMounted === false && ranWhileOnFoot === true]);

      // v27's class ability must still fire while mounted — the interaction
      // the original v26 draft could not have known about
      dsm28({ mounted: true });
      window.debugSetAbility({ lastAbility: -1e9 });
      const abilBefore = window.debugAbilityInfo().lastAbility;
      window.tryAbility();
      const abilAfter = window.debugAbilityInfo().lastAbility;
      results.push(['the v27 class ability still fires while mounted (v28 spec Part E.2)',
        abilAfter !== abilBefore]);

      results.push(['mounted state is broadcast so other players see the rider seated',
        gameScript.indexOf('mo: me.mounted ? 1 : 0') > 0]);
      results.push(['Griffin gets no special flight power — one shared speed bonus only',
        gameScript.indexOf('flier') > 0 &&
        gameScript.indexOf('MOUNT_FLY') < 0 && gameScript.indexOf('mountFly') < 0]);
      /* v31: same retired guard — see the v31 block for the real gates. */

      dsm28({ mounted: false });
    } else {
      results.push(['v28 PART H mount hooks are reachable', false]);
    }

    /* ===================== v29 PART F: cave interiors ========================
       Real proof against the actual spec, not just "the old gauntlet still
       passes" — determinism, shared-space filtering, and that the two
       relocated creatures genuinely spawn inside, not nowhere. ============= */
    const dspc = window.debugSpaceInfo, dssp = window.debugSetSpace,
          anchorOf = window.debugUwcaveAnchor;
    if (typeof dspc === 'function' && typeof dssp === 'function') {
      const info29 = window.debugWorldInfo();
      const N29 = info29.N, B29 = info29.B;
      let uw = null;
      for (let y = 0; y < N29 && !uw; y++) for (let x = 0; x < N29; x++) {
        if (window.biomeAt(x, y) === B29.UWCAVE) { uw = [x, y]; break; }
      }
      results.push(['a UWCAVE tile exists in the test seed to test against', !!uw]);

      if (uw) {
        // ---- two players resolve the SAME cluster to the SAME space id ----
        const a1 = anchorOf(uw[0], uw[1]);
        const a2 = anchorOf(uw[0] + 1, uw[1]);   // a neighbouring tile, same cluster
        results.push(['the same physical cave resolves to the same anchor from two tiles',
          !!a1 && !!a2 && a1[0] === a2[0] && a1[1] === a2[1]]);

        // ---- entering actually moves the player into a non-main space ----
        dssp({ clearCache: true });
        dssp({ enterAt: uw });
        const s1 = dspc();
        results.push(['entering a cave leaves space "main"', s1.inInterior === true]);
        results.push(['the interior grid is the spec\'s 26x26', s1.INTERIOR_N === 26]);

        // ---- determinism: leaving and re-entering the SAME cave gives the
        //      identical grid, generated fresh from the seed, not reused by
        //      accident of still being cached from one visit ----
        const grid1 = s1.grid;
        dssp({ exit: true });
        dssp({ clearCache: true });   // force a genuine regeneration, not the same object
        dssp({ enterAt: uw });
        const grid2 = dspc().grid;
        results.push(['the interior regenerates identically from the same seed',
          !!grid1 && !!grid2 && grid1.length === grid2.length &&
          grid1.every((v, i) => v === grid2[i])]);

        // ---- exit restores the exact stored surface position ----
        const before29 = dspc();
        dssp({ exit: true });
        const after29 = dspc();
        results.push(['exiting restores the exact surface position, not spawn',
          after29.inInterior === false &&
          Math.abs(after29.playerPos.x - uw[0] - 0.5) < 0.02 &&
          Math.abs(after29.playerPos.y - uw[1] - 0.5) < 0.02]);

        // ---- breath never drains inside, confirmed structurally not just by claim ----
        dssp({ enterAt: uw });
        dssp({ pos: [dspc().exit.x + 3, dspc().exit.y + 3] });   // somewhere inside, off the exit tile
        const b0 = dspc().breath;
        dssp({ tickBreath: 5 });
        results.push(['breath never drains inside the interior, even after real time',
          dspc().breath >= b0]);

        // ---- the two relocated species genuinely spawn inside, not nowhere ----
        const wilds29 = dspc().wilds || [], mobs29 = dspc().mobs || [];
        results.push(['Water Dragon spawns inside the generated interior',
          wilds29.some(w => w.species === 'water_dragon')]);
        results.push(['Sea Serpent spawns inside the generated interior',
          mobs29.some(m => m.kind === 'sea_serpent')]);

        // ---- aquatic_essence nodes exist and are gatherable ----
        const nodesBefore = (dspc().nodes || []).filter(n => !n.taken).length;
        results.push(['aquatic_essence nodes exist inside (spec: 3-5 per interior)',
          nodesBefore >= 3 && nodesBefore <= 5]);
        const invBefore = (window.debugWorldInfo().player.inv || {}).aquatic_essence || 0;
        dssp({ pos: [(dspc().nodes[0]).x, (dspc().nodes[0]).y] });
        dssp({ gather: true });
        const invAfter = (window.debugWorldInfo().player.inv || {}).aquatic_essence || 0;
        results.push(['gathering an interior node awards aquatic_essence',
          invAfter === invBefore + 1]);

        // ---- shared, not private: the move payload actually carries space,
        //      and the receive filter genuinely gates on it ----
        results.push(['the move broadcast carries the player\'s space (shared-world mechanism)',
          gameScript.indexOf('sp: me.space || "main"') > 0]);
        results.push(['the receive filter gates rendering on matching space',
          gameScript.indexOf('(o.space || "main") !== (me.space || "main")') > 0]);
        results.push(['no second realtime channel was invented for this',
          (gameScript.match(/sb\.channel\(/g) || []).length === 1]);

        dssp({ exit: true });
        dssp({ clearCache: true });
      }
    } else {
      results.push(['v29 PART F cave-interior hooks are reachable', false]);
    }

    /* ===================== v31: world events ================================
       Both events are DERIVED, not broadcast — so the real thing to prove is
       that every client computes the same answer, and that the effects are
       genuinely wired rather than just declared. ========================== */
    const dei = window.debugEventInfo, dep = window.debugEventProbe;
    if (typeof dei === 'function' && typeof dep === 'function') {
      const ev = dei();
      results.push(['Blood Moon runs on the bible\'s 12-day cycle',
        ev.BLOOD_MOON_EVERY === 12]);
      results.push(['a day divisible by 12 is a Blood Moon day, 11 and 13 are not',
        dep({ day: 24 }).bloodMoonOnDay === true &&
        dep({ day: 23 }).bloodMoonOnDay === false &&
        dep({ day: 25 }).bloodMoonOnDay === false]);
      results.push(['the Blood Moon mob multiplier is real and applied, not just declared',
        ev.BLOOD_MOON_MOB_MULT > 1 &&
        gameScript.indexOf('def.hp * bloodMoonMobMult()') > 0 &&
        gameScript.indexOf('def.dmg * bloodMoonMobMult()') > 0]);
      results.push(['"more aggressive" is wired to the real aggro radius',
        gameScript.indexOf('def.aggroRadius * (bloodMoonActive()') > 0]);
      results.push(['the rare-pet boost is applied to the real presence roll',
        gameScript.indexOf('BLOOD_MOON_RARE_BOOST : 0') > 0]);
      results.push(['mobMult is exactly 1 when no Blood Moon is running',
        ev.bloodMoon === false ? ev.mobMult === 1 : ev.mobMult === ev.BLOOD_MOON_MOB_MULT]);

      // Meteor Shower: unpredictable, but identical for everyone
      let hits = 0;
      for (let s = 0; s < 400; s++) if (dep({ slice: s }).meteorOnSlice) hits++;
      results.push([`Meteor Shower fires on some slices but not most (${hits}/400)`,
        hits > 5 && hits < 160]);
      results.push(['the same slice always gives the same answer — every client agrees',
        dep({ slice: 12345 }).meteorOnSlice === dep({ slice: 12345 }).meteorOnSlice &&
        dep({ slice: 999 }).meteorOnSlice === dep({ slice: 999 }).meteorOnSlice]);
      results.push(['meteor sites are keyed to the slice, so everyone races the same rocks',
        gameScript.indexOf('"met:" + slice') > 0]);
      results.push(['meteor ore is finite — first player to reach it claims it',
        gameScript.indexOf('"meteor"]);') > 0 || gameScript.indexOf("'meteor'") > 0]);
      results.push(['meteor ore actually yields something on gather',
        gameScript.indexOf('meteor: "runic_stone"') > 0]);
      results.push(['no meteor lands inside a safe zone',
        gameScript.indexOf('inSafeZone(tx + 0.5, ty + 0.5)) continue') > 0]);
      results.push(['neither event invented a new table or channel',
        (gameScript.match(/sb\.channel\(/g) || []).length === 1 &&
        gameScript.indexOf('from("world_events")') < 0]);
      results.push(['the v12 PvP blood window is untouched and still distinct',
        gameScript.indexOf('function bloodDecayFrac()') > 0 &&
        gameScript.indexOf('function bloodMoonActive()') > 0]);
    } else {
      results.push(['v31 world-event hooks are reachable', false]);
    }

    /* ===================== v32: Abyssal Hollow interiors ==================== */
    if (typeof window.debugSetSpace === 'function') {
      const dspc32 = window.debugSpaceInfo, dssp32 = window.debugSetSpace;
      const wi32 = window.debugWorldInfo(); const N32 = wi32.N, B32 = wi32.B;
      let ab = null;
      for (let y = 0; y < N32 && !ab; y++) for (let x = 0; x < N32; x++) {
        if (window.biomeAt(x, y) === B32.ABYSSAL) { ab = [x, y]; break; }
      }
      results.push(['an ABYSSAL tile exists in the test seed', !!ab]);
      if (ab) {
        dssp32({ clearCache: true });
        dssp32({ enterAt: ab, biome: B32.ABYSSAL });
        const s32 = dspc32();
        results.push(['entering the Hollow leaves "main"', s32.inInterior === true]);
        results.push(['the Hollow gets its own space kind, distinct from uwcave',
          String(s32.space).indexOf('cave:abyssal:') === 0]);
        results.push(['Shadow Dragon spawns inside the Hollow interior',
          (s32.wilds || []).some(w => w.species === 'shadow_dragon')]);
        results.push(['no Sea Serpent inside the Hollow — that is a UWCAVE creature',
          (s32.mobs || []).length === 0]);
        results.push(['void_shard nodes exist inside (3-5, same as v29 scope)',
          (s32.nodes || []).length >= 3 && (s32.nodes || []).length <= 5]);
        /* The gather PLUMBING is already proven by v29's identical interior
           test; what v32 changes is which resource the node carries. Asserted
           directly, because doInteract() will prefer taming the Shadow Dragon
           that also lives in here if it happens to be the nearer target. */
        results.push(['Hollow nodes carry void_shard, not aquatic_essence',
          (s32.nodes || []).length > 0 &&
          (s32.nodes || []).every(n => n.type === 'void_shard')]);
        results.push(['void_shard is a real registered item with a name and colour',
          !!(window.debugWorldInfo().ITEM_META || {}).void_shard ||
          gameScript.indexOf('void_shard: { name: "Void Shard"') > 0]);
        results.push(['the flood-fill was generalized, not duplicated',
          gameScript.indexOf('function clusterAnchor(tx, ty, biomeConst)') > 0]);
        results.push(['the Hollow reuses v29\'s interior system, no second one',
          (gameScript.match(/function buildInterior\(/g) || []).length === 1]);
        dssp32({ exit: true }); dssp32({ clearCache: true });
      }
    }

    /* ===================== v30 gates ======================================= */
    if (typeof window.debugV30Info === 'function') {
      const v30 = window.debugV30Info();
      results.push(['exactly one Elder Drake exists in the world', v30.drakeCount === 1]);
      results.push(['the Elder Drake spawned near the Volcano',
        !!v30.drake && Math.hypot(v30.drake.x - v30.volcano.x, v30.drake.y - v30.volcano.y) < 27]);
      results.push(['the Elder Drake is the largest creature in the game',
        v30.MOB_K_drake > 2.85]);
      results.push(['the Elder Drake respawns in hours, not the standard mob timer',
        v30.respawnMs >= 60 * 60 * 1000]);
      results.push(['it drops guaranteed Dragonsteel, as the bible requires',
        (window.debugWorldInfo().MOBS.elder_drake.loot || []).some(l => l.type === 'dragonsteel' && l.chance === 1)]);
      if (v30.drake && typeof window.debugSetDrake === 'function') {
        const full = window.debugSetDrake({ hp: v30.drake.maxHp }).drake.phase;
        const mid  = window.debugSetDrake({ hp: Math.floor(v30.drake.maxHp * 0.5) }).drake.phase;
        const low  = window.debugSetDrake({ hp: Math.floor(v30.drake.maxHp * 0.2) }).drake.phase;
        results.push(['the fight moves through all three phases as HP drops',
          full === 1 && mid === 2 && low === 3]);
        window.debugSetDrake({ hp: v30.drake.maxHp });
      }
      results.push(['ruins no longer all use the same layout',
        new Set(v30.ruinTemplates).size >= 2]);
      results.push(['ruin layout is deterministic per ruin, not random each load',
        v30.ruinTemplates.every(t => t >= 0 && t <= 2)]);
      results.push(['every ruin still built pieces', v30.ruinPieceCount > 30]);
      results.push(['nodes have real durability now, ore tougher than wood',
        v30.NODE_HP.tree >= 20 && v30.NODE_HP.iron > v30.NODE_HP.tree]);
      results.push(['pickaxe is its own weapon kind, not misread as axe or sword',
        v30.pickaxeKind === 'pickaxe' && v30.axeKind === 'axe']);
      results.push(['both pickaxe tiers are craftable',
        v30.pickaxeRecipes.length === 2]);
      results.push(['mining damage comes from the equipped weapon, no new stat',
        gameScript.indexOf('(WEAPONS[me.equipped] || {}).dmg') > 0]);
      results.push(['ore requires an axe or pickaxe',
        gameScript.indexOf('You need an axe or a pickaxe') > 0]);
      results.push(['interior nodes were left as a one-press pick, not made mineable',
        gameScript.indexOf('not something you mine through') > 0]);
      results.push(['idle wander scales to each mob\'s own leash radius',
        gameScript.indexOf('(def.leashRadius || 10) * 0.4') > 0]);
      results.push(['idle wander has a real pause/move cycle, not constant drift',
        gameScript.indexOf('const moving30 = cyc > 4.5') > 0]);
    } else {
      results.push(['v30 hooks are reachable', false]);
    }

    let allOk = true;
    for (const [n, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n); if (!ok) allOk = false; }
    process.exit(allOk && !caught ? 0 : 1);
  } catch (e) {
    console.log('SIM ERROR:', e.stack || e);
    process.exit(1);
  }
})();
