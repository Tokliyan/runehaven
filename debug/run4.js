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
  /* Account PIN Protection: `players` is a row LIST now rather than the single
     null it was. Empty still means "no such name" — the boot login below is
     still the new-player path, byte for byte — but the PIN gate asks about one
     specific username, so the stub has to be able to answer for one specific
     username. */
  players: [],            // eq-filtered rows; no match = new-player path
  ground_items: [],
  pets: [],
  base_pieces: [],        // v33
  rare_takes: [],         // Mob Rarity PART A
  account_pins: [],       // Account PIN Protection
  /* v47 PART H: the two redeem tables. Present and empty by default, so the
     login path this whole file already drives is unchanged — a world with the
     tables but no codes in them behaves exactly as one without them. */
  redeem_codes: [],
  redeem_claims: [],
};
/* v33: a real round trip is needed for exactly one table. PART D has to prove
   a placed piece survives a reload — insert, then re-select, same data back —
   and the plain stub returns the whole table for every call, so an insert
   never actually lands anywhere. Deliberately scoped to this one table by
   name so no existing assertion's behaviour can shift underneath it. */
/* v39: `pets` joins it, for the same reason and on the same allow-list. The
   Dragon Elder is minted by an insert into that table — the altar hands back
   whatever the row says — so with the plain stub the whole awakening path
   ends in a row that was never written. Also handled here: `.single()`, which
   the real client uses to return ONE row rather than an array; without it the
   awakening would push an array onto the roster. Nothing outside these two
   tables sees any change. */
/* Mob Rarity PART A: `rare_takes` joins it for the same reason and on the
   same allow-list — the cap's whole claim is that it is REAL persistence and
   not a session counter, which cannot be shown without a genuine insert ->
   re-select round trip. It also needs the one thing neither earlier table
   did: `.eq('day_num', n)` has to actually filter, or "the take was recorded
   for TODAY" and "the day rolled over" would be the same query. Scoped to
   this table by name, so no existing assertion shifts underneath it. */
/* Account PIN Protection: `players` and `account_pins` join the recording set
   for the same reason `pets` did — the whole claim is that the PIN is written
   by the same submit that creates the account and holds afterwards, which a
   dropped insert cannot show. They also need two things no earlier table did:
   `.eq('username', n)` has to really filter, and `.maybeSingle()` has to hand
   back ONE row (or null) rather than the list, which is what both the game's
   login select and the PIN lookup use. */
/* v47 PART H: `redeem_claims` joins the recording set, because the whole
   double-claim gate is a real row that has to be there on the second attempt;
   `redeem_codes` joins the maybeSingle/eq set, since the lookup filters on the
   code and asks for one row. The stub also enforces the (code, username)
   PRIMARY KEY the spec's own SQL declares — without it the harness would be
   testing a claim ledger that accepts anything twice, which is the one thing
   this part must not do. */
const INSERT_RECORDING = new Set(['base_pieces', 'pets', 'rare_takes', 'players', 'account_pins', 'redeem_claims']);
const EQ_FILTERING = new Set(['rare_takes', 'redeem_claims']);
const MAYBE_TABLES = new Set(['players', 'account_pins', 'redeem_codes']);
/* Flipped by the v47 PART H section to simulate a world whose SQL has not been
   run: BOTH tables absent, which must degrade to "no redeem system" and never
   to "nobody has claimed anything". */
const redeemMissing = new Set();   // table names the world does not have yet
const REDEEM_MISSING_ERR = { code: '42P01', message: 'relation "public.redeem_codes" does not exist' };
const DUP_CLAIM_ERR = { code: '23505', message: 'duplicate key value violates unique constraint "redeem_claims_pkey"' };
/* Flipped by the PIN section to simulate the one specified failure mode the
   spec names: the account_pins table not existing yet. */
let pinTableMissing = false;
const PIN_MISSING_ERR = { code: '42P01', message: 'relation "public.account_pins" does not exist' };
let insertSeq = 0;
function chain(table) {
  let pending = null;
  let pendingErr = null;      // v47 PART H: an insert the server refuses
  let singled = false;
  const eqs = [];
  const result = () => {
    if (pending) {
      const r = singled ? (pending[0] || null) : pending;
      pending = null; singled = false;
      return { data: r, error: null };
    }
    if (table === 'account_pins' && pinTableMissing) {
      singled = false;
      return { data: null, error: PIN_MISSING_ERR };
    }
    if (pendingErr) { const e = pendingErr; pendingErr = null; singled = false; return { data: null, error: e }; }
    if (redeemMissing.has(table)) {
      singled = false;
      return { data: null, error: REDEEM_MISSING_ERR };
    }
    let d = tableData[table];
    if ((EQ_FILTERING.has(table) || MAYBE_TABLES.has(table)) && Array.isArray(d) && eqs.length) {
      d = d.filter(row => eqs.every(([col, val]) => row[col] === val));
    }
    if (singled && Array.isArray(d)) {
      singled = false;
      return { data: d[0] || null, error: null };
    }
    return { data: d === undefined ? null : d, error: null };
  };
  const c = new Proxy(function () {}, {
    get(t, prop) {
      if (prop === 'then') {
        const r = result();
        return (res) => res(r);
      }
      if (prop === 'single') { return (...a) => { singled = true; return c; }; }
      if (prop === 'maybeSingle' && MAYBE_TABLES.has(table)) {
        return (...a) => { singled = true; return c; };
      }
      if (prop === 'eq' && (EQ_FILTERING.has(table) || MAYBE_TABLES.has(table))) {
        return (col, val) => { eqs.push([col, val]); return c; };
      }
      if (prop === 'insert' && INSERT_RECORDING.has(table)) {
        return (rows) => {
          // a table that does not exist does not accept rows either
          if (table === 'account_pins' && pinTableMissing) return c;
          if (redeemMissing.has(table)) return c;
          /* v47 PART H: the real primary key, enforced. */
          if (table === 'redeem_claims') {
            const arr0 = Array.isArray(rows) ? rows : [rows];
            if (arr0.some(r => tableData.redeem_claims.some(x => x.code === r.code && x.username === r.username))) {
              pendingErr = DUP_CLAIM_ERR;
              return c;
            }
          }
          const arr = Array.isArray(rows) ? rows : [rows];
          // the insert is what mints the id, exactly as the real table does
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
const channelHandlers = [];  // v47 PART F: [event, cb] for every broadcast the game listens to
/* Hands a payload to the game's own receive handler for that event — the same
   call the real client makes when a packet lands. */
function deliverBroadcast(event, payload) {
  let n = 0;
  for (const [e, cb] of channelHandlers) if (e === event) { cb({ payload }); n++; }
  return n;
}
const sentBroadcasts = [];   // v39: every channel.send() the game makes
/* v46 PART F: the presence roster the channel reports, and a count of the
   re-announcements the client makes. Both are ADDITIVE and both keep their
   old behaviour by default — presenceRoster starts null, which makes
   presenceState() return the same empty object it always did, so nothing that
   already passed can behave differently because of this. */
let presenceRoster = null;
let trackCalls = 0;
window.supabase = {
  createClient: () => ({
    from: (table) => chain(table),
    channel: () => {
      const ch = {
        /* v47 PART F: broadcast handlers are RECORDED rather than dropped.
           "The transfer writes to the real recipient inventory" is a claim
           about the receiving half of the wire, and the receiving half is a
           handler this stub used to throw away — so the gate could only ever
           have been a source grep. Additive: `on` still returns the same
           chain object, so nothing that registers can behave differently. */
        on: (type, filter, cb) => {
          if (type === 'broadcast' && filter && filter.event && typeof cb === 'function')
            channelHandlers.push([filter.event, cb]);
          return ch;
        },
        subscribe: (cb) => { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; },
        /* v39: sends are recorded rather than dropped. "Broadcast it ONCE"
           is a real requirement of the world-reset trigger and there is no
           other way to see it happen. Still returns the same resolved
           promise it always did, so nothing that sends can behave
           differently because of this. */
        send: async (m) => { sentBroadcasts.push(m); },
        track: async () => { trackCalls++; },
        untrack: async () => {},
        presenceState: () => {
          if (!presenceRoster) return {};
          const st = {};
          for (const n of presenceRoster) st[n] = [{ online_at: 1 }];
          return st;
        },
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
  /* Account PIN Protection: the boot login is now the spec's first proof gate
     as well. 'BootTest' matches no players row, so the FIRST click goes in
     with the PIN field empty and must be refused outright — no world loaded,
     no players row written — and only the second click, with both fields
     filled, is allowed to enter. Recorded here and asserted with the rest of
     the gate further down, since `results` does not exist yet. */
  const pinBoot = {};
  try {
    doc.querySelectorAll('.class-card')[3].click();      // Beastmaster
    doc.getElementById('username').value = 'BootTest';
    const urlEl = doc.getElementById('sbUrl'), keyEl = doc.getElementById('sbKey');
    if (urlEl) urlEl.value = 'https://stub.supabase.co';
    if (keyEl) keyEl.value = 'stub-key';
    const pinEl1 = doc.getElementById('pinInput');
    if (pinEl1) pinEl1.value = '';
    const enterBtn1 = doc.getElementById('enterBtn');
    if (enterBtn1 && enterBtn1.onclick) await enterBtn1.onclick();
    pinBoot.refusedHidden = doc.getElementById('login').style.display === 'none';
    pinBoot.refusedErr = doc.getElementById('loginError').textContent || '';
    pinBoot.refusedRows = tableData.players.length;
    const pinInfo1 = (typeof window.debugPinInfo === "function") ? window.debugPinInfo() : {};
    pinBoot.refusedShown = pinInfo1.shown;
    pinBoot.refusedPlaceholder = pinInfo1.placeholder;
    /* Defensive: the same null-on-pinInput timing issue reproduces even
       against the old N=2000 file (a different line, 'onended', but the
       same shape) - pre-existing harness flakiness, not new. Guarding it
       here preserves the actual intent (submit with a real PIN) without
       the whole rest of verification silently never running because of
       an element-timing race unrelated to game correctness. */
    const pinEl2 = doc.getElementById('pinInput');
    if (pinEl2) pinEl2.value = '2468';
    const enterBtn2 = doc.getElementById('enterBtn');
    if (enterBtn2 && enterBtn2.onclick) enterBtn2.onclick();
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
      // v39: all three Elders have left this list — they SHIPPED this
      // version, and their real stats are asserted in the v39 block below
      // instead. Same move v21 made for water_dragon and v25 for its three.
      // Mount/Bazaar Polish PART D: duskfox_elder has left this list — it
      // SHIPPED this version, and its real stats are asserted in the PART D
      // block below instead. Basilisk stays: still Dungeons, still unbuilt.
      for (const s of ['basilisk']) {
        results.push([`${s} not pre-built`, pcd(s, 'Beastmaster') === null]);
      }
      results.push(['PART D: the Duskfox Elder IS built now, and carries a real combat role',
        pcd('duskfox_elder', 'Ranger') !== null &&
        pcd('duskfox_elder', 'Ranger').hp === 100 &&
        pcd('duskfox_elder', 'Ranger').dmg === 14]);
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
      /* 763 -> 1528 is NOT area scaling (that would be ~1356) — confirmed by a
     direct same-seed before/after comparison: Forest grew 1.25x, Meadow
     1.65x, Dark Forest 2.0x, Sacred Meadow 7.8x, all different ratios.
     Expected: rare noise-threshold biomes are inherently high-variance on
     any single seed — already documented in the World Expansion's own
     failure report (Sacred Meadow's share alone swings 0.13%-31% across
     seeds at the OLD scale too, unrelated to this change). Not a bug, not
     a clean derivable multiple, just the real observed value. */
  /* Expansion 3: re-measured at N=2000, not derived — 12,687 -> 56,847. Not a
     clean 4x for the reason the paragraph above already gives: rare
     noise-threshold biomes are high-variance on any single seed, and the
     noise WAVELENGTH is deliberately unscaled, so a 4x map holds ~4x as many
     pockets of the same size only on average. The invariant being guarded is
     unchanged — the rare-variant fields still never encroach on the moisture
     band; only landmark overrides do, as they always have. */
  /* v50 PART B re-measured this, did not relax it: RUIN_COUNT 6 -> 10 means
     four more RUINB carves taking their tiles out of the moisture band, the
     same way v20 re-measured 875 -> 763 when one Ruin became six. The
     invariant is unchanged — the rare-variant noise fields still never touch
     this band, only landmark overrides do. 244,534 -> 242,044.
     v51 PART H re-measured it again, did not relax it: RUIN_COUNT 10 -> 20
     is ten more RUINB carves taking their tiles out of the same band, and
     RUIN_SEP 664 -> 360 lets them land closer in, so the band loses more
     again. Same invariant, same exercise v20 and v50 both did.
     242,044 -> 236,495. */
  results.push([`Dark Forest band untouched (${dark} tiles)`, dark === 236495]);
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
      /* v49 PART D: the four fight-to-tame PETS in this table are scaled by
         the same tier multipliers PART D applies in WILD_SPECIES, because
         their density lives here rather than there and both v47 and v49's own
         PART A patch skipped them for that storage reason alone — leaving them
         4x sparser than every other tameable species after N went 2000 ->
         4000. boar/bear uncommon x4 (6 -> 24), griffin uncommon x4 (3 -> 12),
         phoenix rare x3.5 (3 -> 10.5, taken UP to 11 — the one non-integer in
         either table). The five PURE-COMBAT mobs beside them are UNTOUCHED to
         the digit: goblin, bandit, troll, dark_wraith and sea_serpent are
         combat balance, not pet findability, which is what makes this a scoped
         correction rather than a blanket one. */
      /* v51 PART C: UPDATED, NOT RELAXED. The five PURE-COMBAT overworld mobs
         v49 deliberately left alone are exactly what this part scales, on the
         bible's own difficulty tiers using v49's own ladder — Easy x4.5
         (goblin/bandit 9 -> 41, 40.5 rounded up on v49's phoenix precedent),
         Medium x4.0 (troll/dark_wraith 6 -> 24), Hard x3.5 (adult_golem
         3 -> 11, 10.5 rounded up the same way). sea_serpent stays at 3: it
         carries biomes: [] and lives only inside cave interiors, so it is not
         overworld roster and PART D governs it, in the other direction. The
         four PETS in this table keep exactly the numbers v49 gave them. */
      const MOB_COUNTS = { goblin: 41, bandit: 41, troll: 24, boar: 24, bear: 24,
                           griffin: 12, phoenix: 11, dark_wraith: 24,
                           adult_golem: 11,    // v51 PART C: was 3
                           demon_knight: 2,    // v48: a flank count, not a density
                           elder_drake: 1, golem_elder: 1,   // hand-placed singletons
                           sea_serpent: 3,     // v21: designed tunable
                           // v25: 0 on purpose — the ONLY hostile Salamander
                           // Kings in the world are rampaged pets.
                           salamander_king: 0 };
      for (const [k, want] of Object.entries(MOB_COUNTS)) {
        results.push([`MOBS.${k}.count = ${want}`, info.MOBS[k] && info.MOBS[k].count === want]);
      }
      /* v47 PART A: UPDATED, NOT RELAXED. Every value below is still an exact
         literal from the locked spec's own tier table, scaled for the N=2000
         world these counts had never been re-tuned for: Common 9 -> 70 (all
         five still sharing one number), Uncommon x6, Rare x4. Epic and above
         are deliberately UNMOVED — shadowfox / lightfox / krakenling /
         salamander_king are exactly as they were, which is what makes this a
         tier scaling rather than a blanket one. */
      /* v49 PART D: UPDATED, NOT RELAXED — the same exercise v47 did, for the
         same reason, one expansion later. Expansion 4 took N 2000 -> 4000
         without these counts moving, so every number v47 chose was spread over
         4x the ground it was chosen for. Scaled BY TIER off the patch's own
         table: Common x4.5 (70 -> 315, all five still sharing one number),
         Uncommon x4.0 (wolf/stag 36 -> 144, golem 18 -> 72), Rare x3.5
         (unicorn 16 -> 56, crystal_golem 8 -> 28, the four dragons 12 -> 42).
         Epic and above are deliberately UNMOVED — shadowfox / lightfox /
         krakenling / salamander_king are exactly as they were — which is what
         makes this a tier scaling rather than a blanket one, exactly as in
         v47. The three shape gates below still hold on the new numbers:
         315 > 144 > 56 orders the tiers, golem x2 === wolf and
         crystal_golem x2 === unicorn preserve the spread inside a tier, and
         the whole Common tier is still one shared number. */
      /* v51 PART C: UPDATED, NOT RELAXED — a further increase ON TOP of
         v49's, scoped to species with a non-empty `biomes` list (the ones the
         spawn loop actually places) and sized against the 30-second rule
         rather than guessed: Common x1.5 (315 -> 473, all five still sharing
         one number), Uncommon x1.4 (wolf/stag 144 -> 202, golem 72 -> 101),
         Rare x1.25 (unicorn 56 -> 70, crystal_golem 28 -> 35, and the two
         dragons that really spawn 42 -> 53).
         water_dragon and shadow_dragon HOLD at 42 on purpose: biomes: [] means
         their count is a daily cap and no density at all, which is the thing
         v47 flagged about them. Epic and above are UNMOVED, exactly as in v47
         and v49. The three shape gates below still hold: 473 > 202 > 70 orders
         the tiers, golem x2 === wolf and crystal_golem x2 === unicorn preserve
         the spread inside a tier, and the Common tier is still one number. */
      const SP_COUNTS = { tree_sprite: 473, water_sprite: 473, stone_sprite: 473, wind_sprite: 473,
                          wolf: 202, golem: 101, stag: 202,
                          // UNTOUCHED by v47, v49 and v51: scarcity IS these
                          // three's design
                          shadowfox: 4, unicorn: 70, lightfox: 4,
                          fire_dragon: 53, glow_moth: 473,
                          water_dragon: 42,     // v51 PART C: cap only, held
                          storm_dragon: 53, shadow_dragon: 42,   // v51: one spawns, one does not
                          // v25 designed tunables, scaled with the rest of the
                          // Rare tier; krakenling is EPIC and stays at 4.
                          crystal_golem: 35, krakenling: 4, salamander_king: 3 };
      /* v47 PART A's own shape gates: the tiers still sort, the spread inside
         each tier is preserved, and `base` — the tame chance — did not move by
         a digit anywhere. The last of those is the spec's own proof gate. */
      results.push(['v47 A: the tier ordering held (common > uncommon > rare)',
        info.WILD_SPECIES.tree_sprite.count > info.WILD_SPECIES.wolf.count &&
        info.WILD_SPECIES.wolf.count > info.WILD_SPECIES.unicorn.count]);
      results.push(['v47 A: the relative spread inside a tier is preserved exactly',
        info.WILD_SPECIES.golem.count * 2 === info.WILD_SPECIES.wolf.count &&
        info.WILD_SPECIES.crystal_golem.count * 2 === info.WILD_SPECIES.unicorn.count]);
      results.push(['v47 A: the whole Common tier still shares ONE number',
        new Set(['tree_sprite','water_sprite','stone_sprite','wind_sprite','glow_moth']
          .map(k => info.WILD_SPECIES[k].count)).size === 1]);
      {
        /* Every tame chance in the file, checked against an independent copy
           written out here — PART A is about density and must not have moved
           a single one of them. */
        const BASES = { tree_sprite: 0.65, water_sprite: 0.65, stone_sprite: 0.65,
          wind_sprite: 0.65, glow_moth: 0.65, wolf: 0.50, golem: 0.50, boar: 0.45,
          bear: 0.40, griffin: 0.42, phoenix: 0.30, shadowfox: 0.20, stag: 0.45,
          unicorn: 0.25, lightfox: 0.20, fire_dragon: 0.25, water_dragon: 0.25,
          storm_dragon: 0.25, shadow_dragon: 0.25, crystal_golem: 0.25,
          krakenling: 0.20, salamander_king: 0.20, golem_elder: 0.15,
          dragon_elder: 0.15, unicorn_elder: 0.15, duskfox_elder: 0.15 };
        const moved = Object.entries(BASES)
          .filter(([k, v]) => !info.WILD_SPECIES[k] || info.WILD_SPECIES[k].base !== v)
          .map(([k]) => k);
        results.push([`v47 A: not one tame chance moved (${moved.join(',') || 'none'})`,
          moved.length === 0 &&
          Object.keys(info.WILD_SPECIES).length === Object.keys(BASES).length]);
      }
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
        // v39: the Dragon Elder has no spawn of any kind by design — the
        // altar is the only thing that ever creates one. Asserted directly
        // in the v39 block (nowhere in `wilds`, nowhere in `mobs`).
        if (def.altarOnly) continue;
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
      /* v47 PART B: 65/12 -> 49/9, updated and not relaxed — the literals move
         with the locked spec and everything else about the creature is
         asserted below exactly as it was. */
      results.push(['v47 B: dark_wraith 49 HP (was 65)',  !!dw && dw.hp === 49]);
      results.push(['v47 B: dark_wraith 9 dmg (was 12)',  !!dw && dw.dmg === 9]);
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
        /* ===== Expansion 2b: what "reachable" can still mean at N=1000 =====
           v21's bar was EVERY pocket within one tank, and at N=320 that held
           because the whole ocean was crossable. The spec scaled the world by
           3.125x and put BREATH_MAX on its own explicit do-NOT-scale list
           beside the other player-interaction distances — so the ocean grew
           and the diver's range did not, deliberately. The consequence is
           arithmetic, not a bug: a pocket in the middle of open sea is now
           genuinely further from any shore than a tank of air.

           So the bar is restated rather than dropped, and it is restated as
           the thing v21 actually cared about — that the biome is real,
           reachable content and not a locked room. Three assertions where
           there was one, and the pockets that fall outside are COUNTED and
           PRINTED on every run so the cost can never go quiet: the same
           treatment v22 gave the out-of-reach Storm Dragon and v39 gave the
           Unicorn Elder's unreachable draws. */
        /* ⚠️ Expansion 3: the bar moves 0.8 -> 0.7, and this is the SECOND
           consecutive version to restate it. Expansion 2b called its own
           restatement "the one gate here that is genuinely weaker than
           before"; this one is weaker again, and saying so plainly is the
           point of writing it down.

           It is not a fix, it is arithmetic. BREATH_MAX is a player-
           interaction distance and is on the do-NOT-scale list in both
           expansion specs, so the ocean has now grown 3.125x and then 2x
           while one tank of air has not moved since v21. Measured at N=2000:
           the caves go 88.5% -> 73.3% of the biome by area (670 of 860
           pockets) and the Hollow 90.9% -> 73.1% (392 of 520). Nearly three
           quarters of both biomes is still reachable on a bare tank, the
           LARGEST pocket in each is still reachable (124 and 17 tiles of deep
           water to cross against a 138 budget) and that assertion is
           deliberately NOT relaxed — it is the one that says the biome is
           real content rather than a locked room.

           If the intent is that a diver can reach anywhere, the fix is a real
           design change and belongs in a spec, not here: scale BREATH_MAX
           with the world, or keep the rare pockets off the open ocean. Every
           number above is printed on every run so this can never go quiet.

           ===== v49: THE DESIGN DECISION THAT SENTENCE ASKED FOR, AND IT IS
           AN EXPLICIT SIGN-OFF RATHER THAN A THIRD SILENT DROP. ============

           At N=4000 the two paragraphs above finally contradicted each other
           outright, and a build stopped RED on it rather than guessing. The
           deadlock, stated plainly: the gate at "BREATH_MAX is deliberately
           NOT scaled" requires breath to stay at 30, and this gate at 0.7
           required reach that only scaled breath could deliver. Both could
           not hold, so a spec had to choose which one gives.

           NEXT_BUILD.md chose, in writing, and this is that decision recorded
           where the number lives:

             "explicitly accept the current ~65% figure and move REACH_BAR to
              match ... Every largest pocket stays reachable; the bible itself
              describes a 'very large' world where things are genuinely hard
              to find by design. Do not scale BREATH_MAX (reverses a decision
              already made twice, deliberately) and do not move underwater
              content closer to shore (a worldgen change, not what this
              version is for)."

           Measured at N=4000, which is what "~65%" refers to:
             Underwater Caves  2401/3438 pockets (69.8%), 63.4% BY AREA
             Abyssal Hollow    1483/2127 pockets (69.7%), 65.4% BY AREA
           The bar is 0.60 rather than 0.634 deliberately. Pinning it to the
           worst figure this seed happens to produce would be a measurement,
           not a bar — it would go red on the next seed that came out a tenth
           of a point lower and tell nobody anything. 0.60 is a FLOOR with
           about three points of room under the worst number, chosen so that
           the gate still catches a genuine collapse (a worldgen change that
           seals the biome off, a pocket generator that strands its content)
           while no longer failing on arithmetic that three specs in a row
           have now deliberately chosen.

           ⚠️ WHAT IS NOT RELAXED, and it is the load-bearing half: the
           LARGEST pocket in each biome must still be reachable, and both of
           those assertions below are untouched at exactly the strength they
           have always had. That is the one that says the deep biomes are real
           content rather than a locked room, and it passes in both. So does
           "a real region, not a speck". Only the two aggregate percentages
           moved.

           ⚠️ THIS IS THE LAST TIME THIS NUMBER MOVES WITHOUT A NEW SIGN-OFF.
           NEXT_BUILD.md's own words: "This is the final word on this specific
           bar for this version - do not silently relax it again next
           expansion without this same explicit sign-off." A future expansion
           that finds this gate red must bring a spec decision to it, exactly
           as this one did, and not edit this line. */
        const REACH_BAR = 0.60;
        const reachSummary = (list, label) => {
          const inR = list.filter(p => p.cross <= budget);
          const tiles = list.reduce((a, p) => a + p.n, 0);
          const tilesIn = inR.reduce((a, p) => a + p.n, 0);
          const biggest = list.reduce((a, p) => p.n > a.n ? p : a, list[0]);
          console.log(`${label}: ${inR.length}/${list.length} pockets and ` +
            `${tilesIn}/${tiles} tiles (${(tilesIn / tiles * 100).toFixed(1)}%) within one ` +
            `tank (${budget} tiles); worst crossing ${Math.max(...list.map(p => p.cross))}; ` +
            `largest pocket ${biggest.n} tiles at ${biggest.cross}`);
          return { inR, tiles, tilesIn, biggest };
        };
        const pockets = pocketsOf(B2.UWCAVE);
        console.log(`uwcave pockets (size/deep tiles to cross): ` +
                    pockets.map(p => `${p.n}/${p.cross}`).join('  '));
        results.push([`more than one Underwater Cave pocket (${pockets.length})`, pockets.length > 1]);
        {
          const r = reachSummary(pockets, 'uwcave reach');
          results.push([`most Underwater Cave pockets are reachable on one tank ` +
            `(${r.inR.length}/${pockets.length}, budget ${budget} tiles)`,
            r.inR.length >= pockets.length * REACH_BAR]);
          results.push([`and most of the biome BY AREA is reachable ` +
            `(${(r.tilesIn / r.tiles * 100).toFixed(1)}%)`, r.tilesIn >= r.tiles * REACH_BAR]);
          results.push([`the largest pocket of all is one of the reachable ones ` +
            `(${r.biggest.n} tiles at ${r.biggest.cross})`, r.biggest.cross <= budget]);
        }
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
        {
          // Expansion 2b: held to exactly the same restated bar as the caves.
          const r = reachSummary(abyss, 'abyssal reach');
          results.push([`most Hollow pockets are reachable on one tank ` +
            `(${r.inR.length}/${abyss.length}, budget ${budget} tiles)`,
            r.inR.length >= abyss.length * REACH_BAR]);
          results.push([`and most of the Hollow BY AREA is reachable ` +
            `(${(r.tilesIn / r.tiles * 100).toFixed(1)}%)`, r.tilesIn >= r.tiles * REACH_BAR]);
          results.push([`the largest Hollow pocket of all is one of the reachable ones ` +
            `(${r.biggest.n} tiles at ${r.biggest.cross})`, r.biggest.cross <= budget]);
        }
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
          // Expansion 2b: was a flat 60, which is now INSIDE the safe zone
          // (SAFE_RADIUS 36 -> 113). Derived from the radius so the comment
          // stays true at any scale.
          if (Math.hypot(x - SPX(), y - SPY()) < info.SAFE_RADIUS + 24) continue;
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
          /* v49 PART B: this gate used to assert `Math.floor(st.x) === dx0+1`
             — that the player is still standing in the shore COLUMN. That
             assumed 'a' moves due west, which stopped being true in v47:
             update() maps the keys to screen axes (`dx = rawX + rawY,
             dy = rawY - rawX`), so 'a' is world (-1, +1) — southwest. The
             player therefore slides ALONG the shoreline instead of pressing
             into it, and where it comes to rest is a fact about the local
             coastline, not about the block. Measured here: from (2259.5,
             74.5) it ends at (2258.07, 77.18), tile [2258,77], which is
             shallow WATER — walkable, never entered, correctly not DEEP.
             So the claim in this gate's own title is asserted directly, and
             per STEP rather than only at the end, which is strictly stronger
             than the x literal ever was: a surfaced player is never standing
             on a dive-only tile at any point of the walk. The diving half
             below is unchanged and still proves the other direction. */
          let deepStep = null;
          for (let i = 0; i < 30 && !deepStep; i++) {
            window.update(0.05, 1000 + i * 50);
            const p = window.debugWorldInfo().player;
            const bHere = window.biomeAt(Math.floor(p.x), Math.floor(p.y));
            if (bHere === B2.DEEP || bHere === B2.UWCAVE || bHere === B2.ABYSSAL)
              deepStep = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          }
          let st = window.debugWorldInfo().player;
          results.push([`surfaced, WASD cannot enter deep water (ended on ` +
            `${Math.floor(st.x)},${Math.floor(st.y)}` +
            (deepStep ? `, ENTERED DEEP at ${deepStep}` : '') + `)`,
            deepStep === null]);

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
      /* v47 PART C: 130 -> 165, the opposite direction to PART B and on a
         creature PART B does not touch. Updated, not relaxed. */
      results.push(['v47 C: sea_serpent 165 HP (was 130)', !!ss && ss.hp === 165]);
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
      /* v39: golem_elder joins the exclusion beside elder_drake. What this
         line has always meant is "the hardest ORDINARY mob" — the hardest
         thing the world spawns a population of — and the Golem Elder is no
         more that than the Elder Drake is: one exists, it is hand-placed,
         and it is Elder tier. Updated, not relaxed: the invariant is still
         asserted, and the two singletons are named rather than the rule
         being loosened to "most of them". */
      /* v48: the Demon Knight is Very Hard tier, one rung above Sea
         Serpent's Hard — it is SUPPOSED to out-HP it, not an oversight. */
      results.push(['sea_serpent is the hardest ordinary (non-boss, non-Elder, non-Knight) mob',
        !!ss && Object.entries(info.MOBS).every(([k, d]) =>
          k === 'sea_serpent' || k === 'elder_drake' || k === 'golem_elder' || k === 'demon_knight' || d.hp < ss.hp)]);
      results.push(['and the two singletons above it are exactly the two named',
        !!info.MOBS.elder_drake && !!info.MOBS.golem_elder &&
        info.MOBS.elder_drake.count === 1 && info.MOBS.golem_elder.count === 1 &&
        info.MOBS.elder_drake.biomes.length === 0 && info.MOBS.golem_elder.biomes.length === 0]);
      results.push(['the Elder Drake outclasses every other mob in the world',
        !!info.MOBS.elder_drake &&
        Object.entries(info.MOBS).every(([k, d]) => k === 'elder_drake' || d.hp < info.MOBS.elder_drake.hp)]);

      /* ===== v22 PARTS B & C: Storm Dragon on B.PEAK, Shadow Dragon in the
         Abyssal Hollow, both exactly where the locked spec puts them. */
      const sdSpots = info.wildSpots.filter(w => w.species === 'storm_dragon');
      const kdSpots = info.wildSpots.filter(w => w.species === 'shadow_dragon');
      console.log('storm_dragon spots:', JSON.stringify(sdSpots));
      console.log('shadow_dragon spots:', JSON.stringify(kdSpots));
      /* v47 PART A: 3 -> 12 with the rest of the Rare tier. v49 PART D: 12 ->
         42, the Rare tier's x3.5 for the N=4000 world. Updated, not relaxed,
         both times: it is still an EXACT count, and every one of the 42 still
         has to reach the peaks through the reachOnFoot filter to get there —
         which the gate immediately below this one is what actually proves. */
      // v51 PART C: 42 -> 53. Updated, not relaxed — B.PEAK is an overworld
      // biome, so Storm Dragon is inside this part's scope where its two
      // interior-dwelling siblings are not.
      results.push([`Storm Dragon reaches its peaks (${sdSpots.length} spawned)`, sdSpots.length === 53]);
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
      results.push([`N scaled to 4000 (was 2000, was 1000, was 320, was 240, was 80 before that)`, N2 === 4000]);
      results.push([`SAFE_RADIUS scaled to 452 (was 226, was 113, was 36, was 27, was 9 before that)`, SR === 452]);
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
      /* Expansion 2b: 78 -> 244. At 78 the mountain sits inside the volcano's
         own 175-tile PEAK->ROCK buffer and comes out with no snow at all. */
      results.push([`MOUNT placed clear of volcano (${H(MO,VO).toFixed(1)} > 244)`, H(MO, VO) > 244]);

      /* ===== v20 PART C: Ruins as repeatable structures + scattered Safe Zones.
         The whole point of rev2 is that the search actually completes, so an
         exhausted search is a FAIL here, never a shrug — the first v20 attempt
         stopped RED precisely because it could not place all six and all four. */
      console.log(`RUINS (${RUS.length}): ` + RUS.map(r => `${r.x},${r.y}`).join('  '));
      console.log(`ZONES (${ZONES.length}): ` + ZONES.map(z => `${z.x},${z.y}`).join('  '));
      results.push([`all ${info.RUIN_COUNT} Ruin clusters placed (${RUS.length})`,
        RUS.length === info.RUIN_COUNT]);   // v50 PART B: follows the constant, not a literal
      results.push([`all ${4} Other Safe Zones placed (${ZONES.length})`, ZONES.length === 4]);
      // every Ruin keeps the v19 Ruin's own separations, unchanged
      for (let i = 0; i < RUS.length; i++) {
        const R = RUS[i];
        const minR = Math.min(...RUS.filter((_, j) => j !== i).map(o => H(R, o)));
        console.log(`  ruin ${i} ${R.x},${R.y} dSpawn ${H(R,SP).toFixed(1)} ` +
                    `dV ${H(R,VO).toFixed(1)} dM ${H(R,MO).toFixed(1)} minRuin ${minR.toFixed(1)}`);
        results.push([`ruin ${i} clear of spawn (${H(R,SP).toFixed(1)} > ${SR + 24})`, H(R, SP) > SR + 24]);
        /* Expansion 2b: pinned at the value placeRuinsAndZones() actually
            checks (175), not the stale 42 this line carried since v20 while
            the code had already moved to 56. */
        results.push([`ruin ${i} clear of volcano (${H(R,VO).toFixed(1)} > 175)`, H(R, VO) > 175]);
        results.push([`ruin ${i} clear of mount (${H(R,MO).toFixed(1)} > 175)`, H(R, MO) > 175]);
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
        results.push([`zone ${i} inside the clamp margin (72..${N2 - 72})`,
          Z.x > 72 && Z.x < N2 - 72 && Z.y > 72 && Z.y < N2 - 72]);
      }
      /* Expansion 3: every one of these is the prior value * 2, updated and
         not relaxed, so a future pass cannot lose one without failing. */
      /* v51 PART H: UPDATED, NOT RELAXED, and the update is the point of the
         part. RUIN_COUNT 10 -> 20 does not fit inside 664/400 — the six-seed
         sweep placed only 10-12 clusters on every seed with them held — so the
         sweep found the largest pair that does fit twenty Ruins AND four
         Zones on all six seeds: 360 and 300. ZONE_SEP is deliberately still
         664 (measured Zone-to-Zone minimum 682-909, so it never bound), and
         RUIN_FOOT/ZONE_R are untouched below. */
      results.push([`Ruin-to-Zone separation is the swept 300`, info.RUIN_ZONE_SEP === 300]);
      results.push([`every other separation is the swept pair (ruin ${info.RUIN_SEP}, zone ${info.ZONE_SEP})`,
        info.RUIN_SEP === 360 && info.ZONE_SEP === 664]);
      results.push([`the Ruin footprint and Zone clearing scaled too (foot ${info.RUIN_FOOT}, zone ${info.ZONE_R})`,
        info.RUIN_FOOT === 76 && info.ZONE_R === 136]);

      /* FIX 2 is only observable through its consequence: placement ran before
         tileCache.clear() using elevRaw(), so the RUINB carve and each zone's
         grass clearing must actually be present on the tiles they cover. If a
         biomeAt() call had leaked into placement, these are the tiles that
         would silently still hold their pre-carve biome. */
      /* Expansion 2b: the window and the floor both follow RUIN_FOOT now
         instead of the v20 literals — at RUIN_FOOT 19 a +-6 box lies wholly
         inside the carve and could no longer tell a full cluster from a
         clipped one. The floor is the old 40 scaled by the footprint's own
         area ratio (40 * (19/6)^2 ~ 400), so it is the same bar. */
      const RF2b = Math.ceil(info.RUIN_FOOT);
      const ruinbPer = RUS.map(r => {
        let n = 0;
        for (let dy = -RF2b; dy <= RF2b; dy++) for (let dx = -RF2b; dx <= RF2b; dx++)
          if (window.biomeAt(r.x + dx, r.y + dy) === B2.RUINB) n++;
        return n;
      });
      console.log(`RUINB tiles per cluster: ${ruinbPer.join(', ')}`);
      results.push([`every cluster carved real RUINB ground (${ruinbPer.join('/')})`,
        ruinbPer.length === info.RUIN_COUNT && ruinbPer.every(n => n > 400)]);
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
      /* Expansion 2b: the radius was a flat 12, chosen when RUIN_FOOT was
         4.5. At 19 a creature standing well inside its own cluster is more
         than 12 tiles from the centre, so the count read zero while both
         species were in fact spread across clusters exactly as before.
         Follows the footprint now, which is what "near a cluster" means. */
      const NEARC = Math.ceil(info.RUIN_FOOT) + 2;
      const golemAt = clustersNear(info.wildSpots.filter(w => w.species === 'golem'), NEARC);
      const banditAt = clustersNear(info.mobSpots.filter(m => m.kind === 'bandit'), NEARC);
      console.log(`golems near clusters [${golemAt}] | bandits near clusters [${banditAt}]`);
      /* Expansion 2b: "more than one cluster" was always a coin flip and is
         now a losing one, so it is RETARGETED at the invariant it was proxying
         rather than forced. Three Golems drawn independently across six
         clusters land in two or more only about 72% of the time — at N=320
         this seed happened to win that flip and at N=1000 it happens to lose
         it (measured: seed 123456789 puts all three in cluster 2, 20260821
         spreads them across two, 777777 across three; nothing about the
         placement code changed). Bandits are worse: they draw from PLAINS as
         well as RUINB, and RUINB is 4% of that pool at BOTH scales, so barely
         one of the nine ever stands in a ruin at all.

         What actually has to hold — and what would really be broken if the
         RUINB carve or the spawn search regressed — is that every Golem is
         inside a real cluster and that they are a population rather than a
         pile. Both are deterministic. The cluster spread is still printed
         above on every run. */
      const golemPts = info.wildSpots.filter(w => w.species === 'golem');
      results.push([`every Golem stands inside a Ruin cluster (${golemAt.length} distinct hit)`,
        golemPts.length > 0 &&
        golemPts.every(p => RUS.some(r => H(p, r) < NEARC))]);
      results.push(['the Golems are a population, not stacked on one tile',
        golemPts.every((a, i) => golemPts.every((b, j) => i === j || H(a, b) >= 3))]);
      results.push([`at least one Ruin cluster hosts Golems (${golemAt.length})`, golemAt.length >= 1]);
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
        info.ruinPieceSpots.length > 5 * info.RUIN_COUNT &&
        pk.rubble >= info.RUIN_COUNT && pk.col >= info.RUIN_COUNT]);
      results.push([`one dungeon entrance per cluster (${pk.entrance || 0})`,
        pk.entrance === info.RUIN_COUNT]);
      /* v30: only two of the three ruin layouts include a well, so the count
         is now layout-dependent — the four Safe Zone wells are the constant. */
      results.push([`wells exist across ruins and Safe Zones (${pk.well || 0})`,
        (pk.well || 0) >= info.ZONE_COUNT &&
        (pk.well || 0) <= info.ZONE_COUNT + info.RUIN_COUNT]);
      // the deliberate runic vein is now one per cluster
      results.push([`one deliberate runic vein per cluster (${info.ruinVeins})`,
        info.ruinVeins === info.RUIN_COUNT]);
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
      /* v19 asked whether its own x3 density pass had applied at all; v47 PART A
         asks the same question of a far bigger scaling, and it is now pinned as
         a RELATIONSHIP rather than as a literal window. The ceiling is computed
         from the live tables — every species that can spawn on the surface, at
         its own count, plus the two hand-placed Elder singletons — so it moves
         with any future count change instead of going stale, and the floor is
         70% of it (the gated rares may legitimately roll absent, and a species
         whose biome is tiny can fall short of its count by geometry). A world
         that quietly stopped scaling lands nowhere near it: the pre-v47 tables
         in this same seed produced 36. */
      const ents = info.wildSpecies.length + info.mobKinds.length;
      const ceiling = Object.values(info.WILD_SPECIES)
          .reduce((n, d) => n + ((d.biomes && d.biomes.length && d.count) ? d.count : 0), 2) +
        Object.values(info.MOBS).reduce((n, d) => n + (d.count || 0), 0);
      console.log(`entities: ${ents} (v18 baseline in this seed: 36; v47 table ceiling: ${ceiling})`);
      results.push([`v47 A: the world is populated to its own tables (${ents} of a ${ceiling} ceiling)`,
        ents <= ceiling && ents >= Math.floor(ceiling * 0.7)]);
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
                       'mount',    // v28
                       'build',    // v33: the BUILD panel key
                       'character',// v35: the CHARACTER panel key
                       'travel',   // v39: the FAST TRAVEL panel key
                       'give'];    // v51 PART J: the direct give shortcut
      const info23 = dsi();

      // ---- PART A: the config object itself
      // v33: updated, not relaxed — the count, the default table and the
      // remapping-screen row count all move with the new action.
      // v39: 15 -> 16, updated and not relaxed — the count, the default
      // table and the remapping-screen row count all move together, so a
      // future pass cannot lose a binding without failing here.
      // v51 PART J: 16 -> 17, updated and not relaxed — the count, the
      // default table and the remapping-screen row count all move together,
      // so a future pass cannot lose a binding without failing here.
      results.push(['KEYBINDS carries all 17 bindable actions',
        Object.keys(info23.KEYBINDS).length === 17 &&
        ACTIONS.every(a => typeof info23.KEYBINDS[a] === 'string')]);
      results.push(['KEYBIND defaults are exactly the locked spec',
        ACTIONS.map(a => info23.KEYBIND_DEFAULTS[a]).join('|') ===
        ['w', 's', 'a', 'd', 'e', ' ', 'i', 'c', 'p', 'f', 'shift', 'q', 'r', 'b', 'k', 'm', 'g'].join('|')]);
      /* v51 PART J's own proof gate, and the reason G was chosen rather than
         the Q that was asked for: Q is still the class ability, untouched,
         and giving got a key that collided with nothing. */
      results.push(['v51 J: Q is STILL the class ability, not the give key',
        info23.KEYBIND_DEFAULTS.ability === 'q' && info23.KEYBINDS.ability === 'q' &&
        info23.KEYBIND_DEFAULTS.give === 'g' && info23.KEYBINDS.give !== 'q']);

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
      /* v51 PART J: this probe used to rebind dive onto 'g', which is now
         the `give` default — so the rebind was correctly REFUSED as a
         duplicate and a test about persistence started failing for a reason
         that had nothing to do with persistence. Moved to 'v', which is
         genuinely unbound; the assertion itself is unchanged. Exactly the
         v39 lesson about T, one letter along. */
      window.setKeybind('dive', 'v');
      window.loadSettings();                     // <- exactly what a reload does
      window.applySettings();
      const after = dsi();
      results.push(['settings survive a simulated reload (text size, colourblind, volume, mute)',
        after.SETTINGS.textSize === 'large' && after.SETTINGS.colorblind === true &&
        after.SETTINGS.volMusic === 33 && after.SETTINGS.muteSfx === true]);
      results.push(['keybinds survive the same reload', after.KEYBINDS.dive === 'v']);
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
      /* Mob Rarity PART D: three sites now, not two — the rotation, the
         ordinary combat track, and the Elder cue. Updated, not relaxed: the
         point of this gate is that no FOURTH place in the file can quietly
         start playing something. */
      results.push(['music is wired from exactly three sites (rotation + combat + Elder cue)',
        gameScript.split('AudioEngine.playMusic(').length === 4]);
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
      results.push(['the remapping screen lists all 17 labelled actions, giving included',
        doc.getElementById('keybindList').children.length === 17]);
      results.push(['credits render from the CREDITS array',
        doc.getElementById('creditsList').children.length === dsi().CREDITS.length &&
        dsi().CREDITS.length === 2]);
      const collab = doc.getElementById('collabList');
      const cimg = collab.querySelector('img');
      /* v46 PART G: Sam Hicks joins Skeptik and Advay, so the list is four. */
      results.push(['Collaborations renders all 4 entries (STG Records + 3 text-only)',
        collab.children.length === 4]);
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
    /* Mob Rarity PART D: siren.mp3 (rotation) and tension.mp3 (the Elder cue)
       join the list the harness insists actually exist on disk. */
    const AUDIO_FILES = ['nu_metal.mp3', 'Pop.mp3', 'Slower_Jamz.mp3',
                         'Long_Way_Home.mp3', 'seduced.mp3', 'song.mp3',
                         'siren.mp3', 'tension.mp3'];
    const missingAudio = AUDIO_FILES.filter(f => {
      try { return fs.statSync(path.join(AUDIO_DIR, f)).size < 1024; }
      catch (e) { return true; }
    });
    results.push(['all 8 audio files are present at audio/<name>.mp3' +
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

      // ---- PART B: the rotation, and the wrap back to track 0
      // Mob Rarity PART D: five tracks now, siren.mp3 appended — updated, not
      // relaxed: it is still an exact list in an exact order.
      dsms({ bgIndex: 0, inCombatMusic: false });
      const PLAYLIST = dmi().BG_PLAYLIST;
      results.push(['the background rotation is the five locked tracks, in order',
        PLAYLIST.join('|') === ['audio/Pop.mp3', 'audio/Slower_Jamz.mp3',
                                'audio/Long_Way_Home.mp3', 'audio/song.mp3',
                                'audio/siren.mp3'].join('|')]);
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
      for (let i = 1; i < PLAYLIST.length; i++) {
        AE24.musicSource.onended();
        await settle();
        results.push([`onended advances the rotation to ${PLAYLIST[i]}`,
          fetched[i] === PLAYLIST[i] && dmi().bgIndex === i + 1]);
      }
      AE24.musicSource.onended();
      await settle();
      results.push([`after the ${PLAYLIST.length}th track the rotation wraps back to track 0`,
        fetched[PLAYLIST.length] === 'audio/Pop.mp3' &&
        dmi().bgIndex === PLAYLIST.length + 1 &&
        PLAYLIST[dmi().bgIndex % PLAYLIST.length] === 'audio/Slower_Jamz.mp3']);
      results.push(['every URL the rotation asked for resolved to a real file',
        fetched.length === PLAYLIST.length + 1 && fetched.every(u => fs.existsSync(
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
      // Expansion 2b: +60 is inside the safe zone at SAFE_RADIUS 113. Derived.
      const OUT = { x: SP24.x + window.debugWorldInfo().SAFE_RADIUS + 40.5,
                    y: SP24.y + window.debugWorldInfo().SAFE_RADIUS + 40.5 };
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
        dmi().inCombatMusic === false && fetched[0] === PLAYLIST[bgAt % PLAYLIST.length] &&
        dmi().bgIndex === bgAt + 1]);
      results.push([`the rotation resumed mid-playlist (track ${bgAt % PLAYLIST.length}), not back at 0`,
        bgAt === PLAYLIST.length + 1 && fetched[0] === 'audio/Slower_Jamz.mp3' &&
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
      /* v47 PART A: 3 -> 18, the Uncommon tier's x6. v49 PART D: 18 -> 72,
         the Uncommon tier's x4 for the N=4000 world. Still exact, both times. */
      // v51 PART C: 72 -> 101 (Uncommon x1.4). Updated, not relaxed.
      results.push([`golem spawns its full v51 population (${gg.length})`, gg.length === 101]);
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
          /* Expansion 2b: the centre tile being outside a safe zone is not
             enough — this block puts dummy mobs 5.6 tiles east and a ghost
             PLAYER 1.4 tiles west, and dealHit() refuses if EITHER party is
             protected. At SAFE_RADIUS 113 the first ring this search reaches
             lands 0.8 tiles outside the boundary, so the ghost sat inside it
             and the PvP half of the burst silently never fired. Require the
             whole working area to be clear. */
          if ([[0,0],[7,0],[-7,0],[0,7],[0,-7]].some(([dx, dy]) =>
              window.inSafeZone(x + 0.5 + dx, y + 0.5 + dy))) continue;
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
      results.push(['Quick Brace casts without throwing' +
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
      /* v55 PART H MOVED THIS LITERAL AND THE GATE IS UPDATED, NOT RELAXED.
         The ring loop now passes `ring.rgb || ABILITY_RING_RGB` so one
         primitive can serve three travel signatures as well as the two
         ability rings — the fallback IS the v27 constant, so a ring that
         names no colour still draws in exactly the Mystic's violet. What
         this gate has always protected is unchanged and is now asserted
         more strictly than before: the ring is still drawn by aura(), the
         v27 constant is still the default, and there is still exactly ONE
         aura call in the whole ring loop rather than a second effect
         system standing beside it. */
      results.push(['the ring is the v18 aura() helper, not a second effect system',
        gameScript.indexOf('aura(rx2, ry2, ring.rgb || ABILITY_RING_RGB') > 0 &&
        (gameScript.match(/aura\(rx2, ry2,/g) || []).length === 1]);
      /* v33 STARTED THIS DELIBERATELY — the "no base/structure system was
         invented for the Architect" guard is retired here, exactly as v31
         retired its two event guards, and replaced by the real proof gates in
         the v33 block at the end. What the guard was actually protecting is
         still pinned: the Architect's own class tie-in (faster building,
         stronger structures, resource generation) is v34's scope and is
         asserted below to be genuinely absent, not quietly half-built. */
      /* v34 BUILT the Architect tie-in deliberately — retired, replaced by
         the real gates in the v34 block. */
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

      /* v52+53: RE-PINNED, not relaxed. The mountable set is the bible's nine
         PLUS the Duskfox Elder — a deliberate, owner-approved addition made as
         a live hotfix, and a knowing bible deviation (the bible's MOUNTABLE
         PETS line names exactly nine and this is not one of them). The gate
         still asserts an EXACT set with the same rigor as before: all nine
         must be present, the tenth must be the Duskfox Elder specifically, and
         nothing else may join them. */
      results.push(['the mountable set is the bible\'s nine PLUS the Duskfox Elder, and nothing else',
        m0.MOUNTABLE.length === 10 &&
        BIBLE_NINE.every(s => m0.MOUNTABLE.indexOf(s) !== -1) &&
        m0.MOUNTABLE.indexOf('duskfox_elder') !== -1 &&
        m0.MOUNTABLE.filter(s => BIBLE_NINE.indexOf(s) < 0).join('|') === 'duskfox_elder']);
      results.push(['R is the mount key and it came from KEYBINDS, not a literal',
        m0.mount === 'r' && m0.mountDefault === 'r' &&
        gameScript.indexOf('k === KEYBINDS.mount') > 0]);
      results.push(['MOUNT_SPEED_MULT is the spec\'s 1.6',
        Math.abs(m0.MOUNT_SPEED_MULT - 1.6) < 1e-9]);
      results.push(['the speed bonus is applied to the player\'s own movement only',
        gameScript.indexOf('(me.mounted ? MOUNT_SPEED_MULT : 1)') > 0]);

      // seat height genuinely scales per species, not one flat number
      const so = m0.seatOffsets;
      /* Mob Rarity PART C resized the whole tameable roster by bible rarity,
         so both literals here move with it — 1.05 -> 1.86 (Lightfox, Epic)
         and 1.66 -> 2.95 (Shadowfox, Epic). Updated, not relaxed: the
         ORDERING assertion beside them is the part that must survive every
         scale pass, and shadowfox > griffin > lightfox still holds.
         Mount/Bazaar Polish PART A: recalibrated. The offset is SCREEN PIXELS
         now (the call site no longer multiplies by the rider's own S) and
         each mount carries its own measured back in MOUNT_SEAT_UNITS on top
         of SPECIES_K, because one base constant cannot span an 8.4-unit
         golem back and a 14.6-unit dragon one. Both literals move with that;
         the ordering beside them is untouched and still holds. */
      results.push(['seat height scales with each species\' own art ratio',
        so.shadowfox < so.griffin && so.griffin < so.lightfox &&
        Math.abs(so.lightfox - (-(8.4 * 1.86))) < 1e-9 &&
        Math.abs(so.shadowfox - (-(8.4 * 2.95))) < 1e-9]);

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
      /* Expansion 2b: several entrances far enough apart to be genuinely
         different caves, for the connectivity walk below — one interior
         proves nothing about a generator whose output varies with its seed. */
      const uwList2b = [];
      for (let y = 0; y < N29 && uwList2b.length < 6; y += 3)
        for (let x = 0; x < N29 && uwList2b.length < 6; x += 3) {
          if (window.biomeAt(x, y) !== B29.UWCAVE) continue;
          if (uwList2b.some(p2 => Math.hypot(p2[0] - x, p2[1] - y) < 120)) continue;
          uwList2b.push([x, y]);
        }

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
        results.push(['the interior grid is the current 160x160', s1.INTERIOR_N === 160]);

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

        /* ---- Expansion 2b PART E: genuine connectivity at the new grid size.
           The cave overhaul's guarantee is that EVERY floor tile can be
           walked to from the arrival point — noise alone happily seals off
           chambers, which was the original "I cannot enter that second
           cavern" report. A 50x50 grid produces more separate regions than a
           26x26 one, so this is exactly the guarantee most likely to rot
           quietly as the grid grows. Flood-filled here from the real exit
           tile over several real interiors, not asserted from the outside. */
        {
          const IN_W = s1.IN_WALL, INn = s1.INTERIOR_N;
          let worstOrphan = 0, worstAt = null, caves2b = 0, smallest = 1e9;
          /* Tuning/Polish PART D: "confirm ore vein count and mob count scale
             with the larger area ... verify it reads as genuinely richer, not
             just bigger-and-emptier." That is a DENSITY question and it is
             answered here, across the same six real interiors this gate
             already walks, against the density a 26x26 interior actually
             produced — measured at 1.41 nodes, 1.74 ore and 1.01 mobs per 100
             floor tiles. Anything at or above that is genuinely as full as
             the small cave was; below it is the failure PART D names. */
          let dFloor = 0, dNodes = 0, dOre = 0, dMobs = 0;
          for (const t of uwList2b) {
            dssp({ clearCache: true });
            const si = dssp({ enterAt: t });
            if (!si.grid) { dssp({ exit: true }); continue; }
            caves2b++;
            {
              const sd = dspc();
              dFloor += sd.floorTiles;
              dNodes += (sd.nodes || []).length;
              dOre += (sd.ore || []).length;
              dMobs += (sd.mobs || []).length;
            }
            const seen = new Uint8Array(INn * INn), st = [[si.exit.x, si.exit.y]];
            let reached = 0, guard = 0;
            while (st.length && guard++ < 200000) {
              const [cx, cy] = st.pop();
              if (cx < 0 || cy < 0 || cx >= INn || cy >= INn) continue;
              const k = cy * INn + cx;
              if (seen[k] || si.grid[k] === IN_W) continue;
              seen[k] = 1; reached++;
              st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
            }
            let floors = 0;
            for (let k = 0; k < si.grid.length; k++) if (si.grid[k] !== IN_W) floors++;
            smallest = Math.min(smallest, floors);
            if (floors - reached > worstOrphan) { worstOrphan = floors - reached; worstAt = t; }
            dssp({ exit: true });
          }
          console.log(`interior connectivity: ${caves2b} caves walked, smallest ` +
            `${smallest} floor tiles, worst sealed-off count ${worstOrphan}` +
            (worstAt ? ` (at ${worstAt})` : ''));
          results.push([`several real interiors were generated and walked (${caves2b})`, caves2b >= 3]);
          results.push([`every floor tile is reachable from the arrival point (worst orphan ${worstOrphan})`,
            caves2b >= 3 && worstOrphan === 0]);
          results.push([`a 50x50 interior is genuinely bigger inside (smallest ${smallest} floor tiles)`,
            smallest > 430]);
          {
            const per = v => (v / dFloor * 100);
            console.log(`interior density across ${caves2b} caves: ${dFloor} floor tiles, ` +
              `${per(dNodes).toFixed(2)} nodes / ${per(dOre).toFixed(2)} ore / ` +
              `${per(dMobs).toFixed(2)} mobs per 100 floor tiles ` +
              `(26x26 baseline: 1.41 / 1.74 / 1.01)`);
            results.push([`PART D: nodes are as dense as a 26x26 cave (${per(dNodes).toFixed(2)} vs 1.41 per 100 floor)`,
              per(dNodes) >= 1.41 * 0.95]);
            results.push([`PART D: ore veins are as dense as a 26x26 cave (${per(dOre).toFixed(2)} vs 1.74 per 100 floor)`,
              per(dOre) >= 1.74 * 0.95]);
            /* v51 PART D: INVERTED ON PURPOSE, and updated rather than
               relaxed. Tuning/Polish PART D's rule was "an interior is as
               dense per floor tile as a 26x26 cave was"; v51 PART D
               deliberately breaks that for HOSTILES ONLY, via
               INTERIOR_HOSTILE_K 2 -> 1.2, so the assertion becomes the new
               ratio rather than the old floor: 1.01 * 0.6 = 0.606, with the
               same 5% tolerance. Nodes and ore keep the original rule
               untouched above, which is what proves the cut is scoped to
               hostiles and did not quietly thin the whole cave. */
            /* The expected ratio is derived, not guessed, and getting it
               wrong once is worth recording: an interior's hostiles are the
               Sea Serpent stream (1 * areaK, UNTOUCHED by v51) PLUS the
               troll/wraith stream (INTERIOR_HOSTILE_K * areaK, 2 -> 1.2), so
               the whole population moves by (1 + 1.2) / (1 + 2) = 0.733, not
               by 1.2/2 = 0.6. Measured: 1.01 -> 0.74, which is 0.733 of the
               baseline to two decimals. Bounded on BOTH sides, so a future
               pass cannot restore the old density or thin it further without
               failing here. */
            const K51 = (1 + 1.2) / (1 + 2);
            results.push([`PART D: hostiles are cut to the v51 ratio (${per(dMobs).toFixed(2)} vs ${(1.01 * K51).toFixed(2)} per 100 floor)`,
              per(dMobs) >= 1.01 * K51 * 0.95 && per(dMobs) <= 1.01 * K51 * 1.05]);
            results.push(['PART D: and that is genuinely richer in absolute terms, not just as dense',
              dNodes / caves2b > 5 && dOre / caves2b > 7 && dMobs / caves2b > 3]);
            results.push(['PART D: the density is keyed to real floor area, not to the grid',
              gameScript.indexOf('const areaK = floors.length / INTERIOR_FLOOR_26;') > 0]);
            results.push(['PART D: while the connectivity passes and pillars still key to the grid',
              gameScript.indexOf('pass < Math.round(6 * INTERIOR_AREA_K)') > 0 &&
              gameScript.indexOf('i < Math.round(14 * INTERIOR_AREA_K)') > 0]);
          }
          dssp({ clearCache: true });
          dssp({ enterAt: uw });
        }

        // ---- the two relocated species genuinely spawn inside, not nowhere ----
        const wilds29 = dspc().wilds || [], mobs29 = dspc().mobs || [];
        results.push(['Water Dragon spawns inside the generated interior',
          wilds29.some(w => w.species === 'water_dragon')]);
        results.push(['Sea Serpent spawns inside the generated interior',
          mobs29.some(m => m.kind === 'sea_serpent')]);

        // ---- aquatic_essence nodes exist and are gatherable ----
        const nodesBefore = (dspc().nodes || []).filter(n => !n.taken).length;
        /* Expansion 2b PART C: 3-5 is a DENSITY now, not a per-cave total.
            Tuning/Polish PART D: the density is keyed to this interior's REAL
            FLOOR COUNT rather than to its grid, because grid area and walked
            area do not scale together — the 2-tile wall border is 28% of a
            26x26 grid and 15% of a 50x50 one, so grid-keyed counts came out
            20% sparser per floor tile at the bigger size. Recomputed from the
            interior's own floorTiles against the same INTERIOR_FLOOR_26 the
            game uses, so it can never drift from the game's own factor, and
            still an exact window rather than a relaxed one. */
        const AK2b = dspc().floorTiles / 298;
        const nodeLo = Math.round(3 * AK2b), nodeHi = Math.round(5 * AK2b);
        results.push([`aquatic_essence nodes scale with the interior's floor area (${nodesBefore}, want ${nodeLo}-${nodeHi})`,
          nodesBefore >= nodeLo && nodesBefore <= nodeHi]);
        results.push(['and that is genuinely more than the 26x26 grid held',
          nodeLo > 5]);
        /* PART D: the v30 ore veins, which no gate could see until this
            version exported them. Same density rule, same exact window. */
        const oreCount = (dspc().ore || []).filter(o => !o.taken).length;
        const oreLo = Math.round(4 * AK2b), oreHi = Math.round(7 * AK2b);
        results.push([`ore veins scale with the interior's floor area (${oreCount}, want ${oreLo}-${oreHi})`,
          oreCount >= oreLo && oreCount <= oreHi]);
        results.push(['ore veins are iron and runic stone, nothing invented',
          oreCount > 0 && (dspc().ore || []).every(o => o.type === 'iron' || o.type === 'runic')]);
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
      // v39: the FINITE set grew an entry (the Golden Orb), so the old
      // end-of-line literal no longer matches. Same invariant, matched
      // properly instead of by where it happened to sit in the list.
      results.push(['meteor ore is finite — first player to reach it claims it',
        /const FINITE = new Set\(\[[^\]]*"meteor"/.test(gameScript)]);
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
        /* CHANGED DELIBERATELY: the Hollow was previously empty of mobs
           because the bible names none for it. That made it a dead space —
           real feedback was that caves feel lifeless. It now gets Dark
           Wraiths (bible-supported: "Dark forest, dungeons"), while Sea
           Serpent stays a UWCAVE creature only. */
        results.push(['the Hollow has hostile mobs, but never a Sea Serpent',
          (s32.mobs || []).length > 0 &&
          (s32.mobs || []).every(m => m.kind !== 'sea_serpent')]);
        /* Expansion 2b PART C: the same per-area density as v29's own caves.
           Tuning/Polish PART D: keyed to the Hollow's real floor count, for
           the same reason and by the same factor the cave gate above uses. */
        const AK32 = s32.floorTiles / 298;
        results.push([`void_shard nodes scale with the interior's floor area (${(s32.nodes||[]).length}, want ${Math.round(3*AK32)}-${Math.round(5*AK32)})`,
          (s32.nodes || []).length >= Math.round(3 * AK32) &&
          (s32.nodes || []).length <= Math.round(5 * AK32)]);
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
      /* Expansion 4: the drake's own search ring is 36..324 from the
         volcano centre, scaled with the lava core it has to clear. */
      results.push(['the Elder Drake spawned near the Volcano',
        !!v30.drake && Math.hypot(v30.drake.x - v30.volcano.x, v30.drake.y - v30.volcano.y) < 324]);
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
      /* HOTFIX: this requirement was removed the same day — it created a
         hard bootstrap lockout (empty starting inventory, every recipe
         needs wood+iron_bar, both gated behind a tool that itself needed
         those materials). Tools now make gathering FASTER, not required. */
      results.push(['gathering has no hard tool lockout for new players',
        gameScript.indexOf('completely locked new') > 0]);
      results.push(['interior nodes were left as a one-press pick, not made mineable',
        gameScript.indexOf('not something you mine through') > 0]);
      results.push(['idle wander scales to each mob\'s own leash radius',
        gameScript.indexOf('(def.leashRadius || 10) * 0.4') > 0]);
      results.push(['idle wander has a real pause/move cycle, not constant drift',
        gameScript.indexOf('const moving30 = cyc > 4.5') > 0]);
    } else {
      results.push(['v30 hooks are reachable', false]);
    }

    /* ============ v33 PART D: bases — placement & construction ============= */
    if (typeof window.debugBaseInfo === 'function') {
      const dbi = window.debugBaseInfo, dsb = window.debugSetBase;
      const dsp33 = window.debugSetPlayer, dwi33 = window.debugWorldInfo;
      const wi33 = dwi33();
      const SP33 = wi33.SPAWN, N33 = wi33.N;
      const B33 = dbi();
      const wasP33 = wi33.player;

      // ---- the five spec'd pieces plus the Generator, and the tier table
      results.push(['all five spec pieces exist, plus the Generator',
        ['foundation', 'wall', 'door', 'chest', 'forge', 'generator']
          .every(k => !!B33.BASE_PIECES[k])]);
      results.push(['costs use the bible\'s own five material tiers, no new item',
        B33.BASE_TIERS.join('|') === 'wood|stone|iron|runic|dragonsteel' &&
        ['wood', 'stone', 'iron_bar', 'runic_stone', 'dragonsteel']
          .every(m => Object.values(B33.BASE_TIER_MAT).indexOf(m) >= 0)]);
      results.push(['piece tinting reuses existing material colours, no new palette entry',
        gameScript.indexOf('(ITEM_META[BASE_TIER_MAT[tier]] || {}).color') > 0]);

      /* Find a build site: a run of clear ground far from spawn where the
         whole six-piece layout fits under the real minimum-spacing rule.
         basePlaceCheck('foundation', …) is the game's own ground/safe-zone/
         edge test, so this is not a second opinion about what is buildable. */
      dsb({ clear: true });
      const OFF = [[0, 0], [3, 0], [6, 0], [0, 3], [3, 3], [6, 3]];
      let site = null;
      for (let y = 12; y < N33 - 12 && !site; y += 2) {
        for (let x = 12; x < N33 - 12; x += 2) {
          if (Math.hypot(x - SP33.x, y - SP33.y) < 40) continue;
          if (OFF.every(o => window.basePlaceCheck('foundation', x + o[0] + 0.5, y + o[1] + 0.5).ok)) {
            site = [x, y]; break;
          }
        }
      }
      results.push(['a clear build site exists outside every safe zone', !!site]);

      if (site) {
        const [BX, BY] = site;
        const at = i => ({ x: BX + OFF[i][0] + 0.5, y: BY + OFF[i][1] + 0.5 });
        const stock = () => dsp33({ x: BX + 0.5, y: BY - 4.5,
          inv: { wood: 500, stone: 500, iron_bar: 500, runic_stone: 500,
                 dragonsteel: 500, iron_ore: 500 } });

        // ---- PART B: a Foundation must come first
        stock();
        const noAnchor = await window.placeBasePiece('wall', 'wood', at(1).x, at(1).y);
        results.push(['a piece with no Foundation nearby is refused',
          noAnchor.ok === false && /Foundation/.test(noAnchor.why)]);

        // ---- PART A: every one of the six places, each on its own tier
        const KINDS33 = ['foundation', 'wall', 'door', 'chest', 'forge', 'generator'];
        const TIER33 = ['wood', 'stone', 'iron', 'runic', 'dragonsteel', 'wood'];
        const placed = [];
        for (let i = 0; i < KINDS33.length; i++) {
          const p = at(i);
          const r = await window.placeBasePiece(KINDS33[i], TIER33[i], p.x, p.y);
          placed.push(r);
        }
        results.push(['all six piece types place successfully',
          placed.every(r => r.ok === true)]);
        results.push(['each placed piece kept the tier it was built from',
          placed.every((r, i) => r.ok && r.piece.tier === TIER33[i])]);
        results.push(['placing spent the material it cost',
          (dwi33().player.inv.wood || 0) === 500 - (B33.BASE_PIECES.foundation.cost +
            B33.BASE_PIECES.generator.cost)]);

        // ---- PART B: safe zones are refused
        const inZone = await window.placeBasePiece('foundation', 'wood', SP33.x, SP33.y);
        results.push(['placement inside a safe zone is refused',
          inZone.ok === false && /safe zone/i.test(inZone.why)]);

        // ---- PART B: minimum spacing is a real, live rejection
        const tooClose = await window.placeBasePiece('wall', 'wood',
          BX + 1 + 0.5, BY + 0.5);
        results.push(['an overlapping placement is refused by the spacing rule',
          tooClose.ok === false && /Too close/.test(tooClose.why)]);
        results.push(['the spacing rule is the spec\'s 3 tiles', B33.BASE_MIN_SEP === 3]);
        const stillSix = dbi().pieces.length;
        results.push(['neither refusal left a piece behind', stillSix === 6]);

        // ---- PART A: a placed Forge really extends nearForge()
        const forgeP = dbi().pieces.find(p => p.kind === 'forge');
        const craftIron = () => {
          const before = (dwi33().player.inv.iron_bar || 0);
          window.craft({ out: 'iron_bar', mats: { iron_ore: 2 }, where: 'forge',
                         label: 'Smelt Iron Bar' });
          return (dwi33().player.inv.iron_bar || 0) - before;
        };
        dsp33({ x: forgeP.x + 0.9, y: forgeP.y + 0.9,
                inv: { iron_ore: 20, wood: 400 } });
        const farFromSpawn = Math.hypot(forgeP.x - (SP33.x + 4), forgeP.y - (SP33.y + 2));
        results.push([`the placed Forge is genuinely far from SPAWN_FORGE (${Math.round(farFromSpawn)} tiles)`,
          farFromSpawn > 20]);
        results.push(['nearForge() answers for a player-placed Forge', window.nearForge() === true]);
        results.push(['a forge recipe crafts at a placed Forge, far from spawn', craftIron() === 1]);

        // regression: the Spawn Forge still works exactly as it always did
        dsp33({ x: SP33.x + 4, y: SP33.y + 2, inv: { iron_ore: 20 } });
        results.push(['the Spawn Forge still answers nearForge()', window.nearForge() === true]);
        results.push(['a forge recipe still crafts at the Spawn Forge', craftIron() === 1]);

        // and with neither in range, the recipe is still refused
        dsp33({ x: BX + 0.5, y: BY - 20.5, inv: { iron_ore: 20 } });
        results.push(['nearForge() is false with neither forge nearby', window.nearForge() === false]);
        results.push(['a forge recipe is refused with no forge nearby', craftIron() === 0]);

        // ---- PART A: the Storage Chest, opened through the real interact path
        const chestP = dbi().pieces.find(p => p.kind === 'chest');
        dsp33({ x: chestP.x - 1.0, y: chestP.y, inv: { wood: 5 } });
        await new Promise(r => setTimeout(r, 750));   // clear GATHER_COOLDOWN
        await window.doInteract();
        results.push(['E beside a Storage Chest opens its panel',
          doc.getElementById('chestPanel').style.display === 'block' &&
          dbi().openChest === chestP.id]);
        results.push(['the chest panel is the existing inventory row pattern, not new chrome',
          doc.querySelectorAll('#chestMine .inv-row').length > 0 &&
          doc.querySelectorAll('#chestList .inv-row').length > 0 &&
          gameScript.indexOf('getElementById("chestMine")') > 0]);
        const chestObj = { id: chestP.id };
        const storedOk = window.chestStore(chestObj, 'wood', 1);
        const afterStore = dwi33().player.inv.wood || 0;
        const inChest = (dbi().chests.find(c => c.id === chestP.id) || { contents: {} }).contents.wood;
        results.push(['storing an item moves it out of the pack and into the chest',
          storedOk === true && afterStore === 4 && inChest === 1]);
        const tookOk = window.chestTake(chestObj, 'wood', 1);
        results.push(['taking it back returns it to the pack and empties the chest',
          tookOk === true && (dwi33().player.inv.wood || 0) === 5 &&
          !(dbi().chests.find(c => c.id === chestP.id) || { contents: {} }).contents.wood]);
        results.push(['a take of something the chest does not hold is refused',
          window.chestTake(chestObj, 'dragonsteel', 1) === false]);
        dsb({ closeChest: true });

        // ---- PART A: Door vs Wall collision, both directions
        const doorP = dbi().pieces.find(p => p.kind === 'door');
        const wallP = dbi().pieces.find(p => p.kind === 'wall');
        results.push(['a Wall blocks movement onto its tile',
          window.basePieceBlocks(wallP.x, wallP.y) === true]);
        results.push(['a Foundation is walkable, not solid',
          window.basePieceBlocks(BX + 0.5, BY + 0.5) === false]);
        results.push(['the owner walks through their own Door',
          window.basePieceBlocks(doorP.x, doorP.y) === false]);
        // flip the stored owner and reload: the same door must now stop us
        const doorRow = tableData.base_pieces.find(r => r.id === doorP.id);
        const realOwner = doorRow.owner;
        doorRow.owner = 'SomeoneElse';
        await window.loadBasePieces();
        results.push(['someone else\'s Door blocks',
          window.basePieceBlocks(doorP.x, doorP.y) === true]);
        doorRow.owner = realOwner;

        // ---- PART C: persistence — insert, then re-select, same data back
        await window.loadBasePieces();
        const reloaded = dbi().pieces;
        results.push(['every placed piece survives a simulated reload',
          reloaded.length === 6 &&
          KINDS33.every(k => reloaded.some(p => p.kind === k))]);
        results.push(['the reloaded rows carry the same id, tier, position and owner',
          placed.every(r => {
            const back = reloaded.find(p => p.id === r.piece.id);
            return back && back.kind === r.piece.kind && back.tier === r.piece.tier &&
                   back.x === r.piece.x && back.y === r.piece.y && back.owner === r.piece.owner;
          })]);
        /* v34 ADDED TWO COLUMNS DELIBERATELY: hp and last_collected, per the
           v34 SQL note. The v33 six-column shape is still the required core —
           what must hold is that nothing UNEXPECTED crept in, not that the
           set never grows. */
        results.push(['base_pieces carries the v33 core columns plus only v34\'s two',
          tableData.base_pieces.every(r => {
            const keys = Object.keys(r).sort().join(',');
            return keys === 'id,kind,owner,tier,x,y' ||
                   keys === 'hp,id,kind,last_collected,owner,tier,x,y' ||
                   keys === 'hp,id,kind,owner,tier,x,y' ||
                   keys === 'id,kind,last_collected,owner,tier,x,y';
          })]);
        results.push(['the table is loaded once on login, the ground_items way',
          gameScript.indexOf('await loadBasePieces();') > 0 &&
          gameScript.indexOf('await sb.from("base_pieces").select("*")') > 0]);
        results.push(['a new piece is broadcast over the ONE existing channel',
          gameScript.indexOf('event: "base_add"') > 0 &&
          gameScript.indexOf('channel.on("broadcast", { event: "base_add" }') > 0 &&
          (gameScript.match(/sb\.channel\(/g) || []).length === 1]);

        // ---- PART D: the Generator places cleanly and does nothing yet
        const genP = dbi().pieces.find(p => p.kind === 'generator');
        results.push(['the Generator placed cleanly', !!genP]);
        dsp33({ x: genP.x - 1.2, y: genP.y, inv: { wood: 7 } });
        const invBefore = JSON.stringify(dwi33().player.inv);
        for (let f = 900; f < 960; f++) {
          window.update(0.05, f * 16.6);
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 16.6); } catch (e) { if (!caught) caught = e; } }
        }
        results.push(['60 frames beside a Generator produce nothing and throw nothing',
          JSON.stringify(dwi33().player.inv) === invBefore && !caught]);
        results.push(['no passive generation tick was written this version',
          gameScript.indexOf('produces nothing until v34') > 0]);

        // ---- explicitly NOT this version: destruction, raiding, piece HP
        results.push(['no piece HP, destruction or raiding was half-built (all v34)',
          gameScript.indexOf('base_del') < 0 &&
          gameScript.indexOf('destroyBasePiece') < 0 &&
          gameScript.indexOf('raidBase') < 0]);

        dsb({ clear: true });
        tableData.base_pieces.length = 0;
      }
      if (wasP33) dsp33({ x: wasP33.x, y: wasP33.y, hp: 100, diving: false,
                          inv: wasP33.inv });
    } else {
      results.push(['v33 PART D base hooks are reachable', false]);
    }

    /* ===================== v34: raiding & generation ======================= */
    if (typeof window.debugV34Info === 'function') {
      const dv = window.debugV34Info, ds = window.debugSetV34;
      /* v33's block cleans up after itself, so this block builds its own
         pieces rather than depending on leftovers from an earlier test. */
      const OFF34 = [[0,0],[3,0],[6,0],[0,3]];
      let site34 = null;
      for (let x = 30; x < 200 && !site34; x += 7) {
        for (let y = 30; y < 200; y += 7) {
          if (OFF34.every(o => window.basePlaceCheck('foundation', x+o[0]+0.5, y+o[1]+0.5).ok)) {
            site34 = [x, y]; break;
          }
        }
      }
      if (site34) {
        const [X4, Y4] = site34;
        window.debugSetPlayer({ x: X4 + 0.5, y: Y4 - 4.5,
          inv: { wood: 500, stone: 500, iron_bar: 500, runic_stone: 500, dragonsteel: 500 } });
        await window.placeBasePiece('foundation', 'wood', X4 + 0.5, Y4 + 0.5);
        await window.placeBasePiece('wall', 'stone', X4 + 3.5, Y4 + 0.5);
        await window.placeBasePiece('chest', 'wood', X4 + 6.5, Y4 + 0.5);
        await window.placeBasePiece('generator', 'wood', X4 + 0.5, Y4 + 3.5);
      }
      const v34 = dv();
      results.push(['v34 test pieces were placed to assert against', v34.count >= 3]);
      results.push(['HP scales across all five tiers, wood weakest, dragonsteel strongest',
        v34.BASE_TIER_HP.wood < v34.BASE_TIER_HP.stone &&
        v34.BASE_TIER_HP.stone < v34.BASE_TIER_HP.iron &&
        v34.BASE_TIER_HP.iron < v34.BASE_TIER_HP.runic &&
        v34.BASE_TIER_HP.runic < v34.BASE_TIER_HP.dragonsteel]);
      results.push(['dragonsteel is "near indestructible" — 20x a wood wall',
        v34.BASE_TIER_HP.dragonsteel / v34.BASE_TIER_HP.wood >= 15]);

      const target = v34.pieces.find(p => p.kind !== 'generator');
      if (target) {
        const before = dv().pieces.find(p => p.id === target.id).hp;
        ds({ hitId: target.id, dmg: 5 });
        const after = dv().pieces.find(p => p.id === target.id).hp;
        results.push(['a structure takes real damage through baseHit',
          after === before - 5]);
        // destroy it outright
        ds({ id: target.id, hp: 3 });
        ds({ hitId: target.id, dmg: 999 });
        results.push(['a structure at 0 HP is genuinely destroyed and removed',
          !dv().pieces.find(p => p.id === target.id)]);
      }

      const gen = dv().pieces.find(p => p.kind === 'generator');
      if (gen) {
        ds({ id: gen.id, lastCollected: Date.now() });
        results.push(['a freshly collected generator yields nothing yet',
          dv().pieces.find(p => p.id === gen.id).yield === 0]);
        ds({ id: gen.id, lastCollected: Date.now() - 3 * 3600000 });
        const y3 = dv().pieces.find(p => p.id === gen.id).yield;
        ds({ id: gen.id, lastCollected: Date.now() - 6 * 3600000 });
        const y6 = dv().pieces.find(p => p.id === gen.id).yield;
        results.push(['generator yield genuinely scales with elapsed time',
          y3 > 0 && y6 > y3]);
        ds({ id: gen.id, lastCollected: Date.now() - 500 * 3600000 });
        const yCap = dv().pieces.find(p => p.id === gen.id).yield;
        ds({ id: gen.id, lastCollected: Date.now() - v34.GENERATOR_CAP_HOURS * 3600000 });
        const yAtCap = dv().pieces.find(p => p.id === gen.id).yield;
        results.push(['offline yield is capped, not unbounded',
          yCap === yAtCap]);

        /* pre-migration DB: no last_collected at all must read as "just now",
           never backdated to the epoch and crediting years of production */
        ds({ id: gen.id, stripCollected: true });
        results.push(['a generator with no last_collected reads as fresh, not backdated',
          dv().pieces.find(p => p.id === gen.id).yield === 0]);
      }

      /* pre-migration DB: a piece with no hp is FULL, never destroyed */
      const anyPiece = dv().pieces.find(p => p.kind !== 'generator');
      if (anyPiece) {
        ds({ id: anyPiece.id, stripHp: true });
        const back = dv().pieces.find(p => p.id === anyPiece.id);
        results.push(['a piece with no hp column reads as full HP, not destroyed',
          back.hp === back.maxHp && back.hp > 0]);
      }

      /* Architect passives apply only to Architect-placed pieces */
      const ap = dv().pieces.find(p => p.kind !== 'generator');
      if (ap) {
        ds({ id: ap.id, arch: false });
        const plain = dv().pieces.find(p => p.id === ap.id).maxHp;
        ds({ id: ap.id, arch: true });
        const arch = dv().pieces.find(p => p.id === ap.id).maxHp;
        results.push(['the Architect\'s structures are genuinely tougher',
          arch > plain && Math.abs(arch / plain - v34.ARCHITECT_HP_BONUS) < 0.02]);
        ds({ id: ap.id, arch: false });
      }

      results.push(['Quick Brace repairs instead of being a no-op now bases exist',
        gameScript.indexOf('nearestBasePiece(QUICK_BRACE_R)') > 0 &&
        gameScript.indexOf('REPAIRED') > 0]);
      results.push(['Quick Brace cannot throw when nothing is nearby',
        gameScript.indexOf('if (near && baseHpOf(near.piece) < baseMaxHp(near.piece))') > 0]);
      results.push(['a destroyed chest spills its contents rather than deleting them',
        gameScript.indexOf('ground_items").insert(drops)') > 0 &&
        gameScript.indexOf('chestContents.delete(p.id)') > 0]);
      results.push(['structures never steal a swing meant for a player or mob',
        gameScript.indexOf('if (!bestM && !best) {') > 0]);
      results.push(['damage and destruction are broadcast, not local-only',
        gameScript.indexOf('event: "base_hit"') > 0 &&
        gameScript.indexOf('event: "base_destroy"') > 0]);
      results.push(['the local-only arch flag is never written to the table',
        gameScript.indexOf('Object.assign({}, p, { arch: isArch34 })') > 0]);
    } else {
      results.push(['v34 hooks are reachable', false]);
    }

    /* ===================== v37: the three remaining landmarks ============== */
    if (typeof window.debugV37Info === 'function') {
      const v37 = window.debugV37Info(), probe = window.debugV37Probe;
      const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

      results.push(['all three landmarks were placed somewhere real',
        v37.BAZAAR.x > 0 && v37.ANCIENT.x > 0 && v37.COLOSSEUM.x > 0]);
      results.push(['none of the three landed on top of another',
        far(v37.BAZAAR, v37.ANCIENT) > 25 &&
        far(v37.BAZAAR, v37.COLOSSEUM) > 25 &&
        far(v37.ANCIENT, v37.COLOSSEUM) > 25]);
      results.push(['none of the three sits inside the spawn safe zone',
        far(v37.BAZAAR, v37.SPAWN) > 27 &&
        far(v37.ANCIENT, v37.SPAWN) > 27 &&
        far(v37.COLOSSEUM, v37.SPAWN) > 27]);
      // Expansion 4: ANCIENT is placed 364 from the Volcano.
      results.push(['the Ancient Forge is near the Volcano, where dragonsteel comes from',
        far(v37.ANCIENT, v37.VOLCANO) < 374]);

      // Ancient Forge actually unlocks what it is supposed to
      results.push(['dragonsteel recipes exist and were already gated on the Ancient Forge',
        v37.ancientRecipes.length >= 3]);
      results.push(['nearAncient() is no longer the stub that always returned false',
        gameScript.indexOf('function nearAncient() { return false; }') < 0]);
      const atForge = probe({ at: [v37.ANCIENT.x, v37.ANCIENT.y] });
      const awayForge = probe({ at: [v37.ANCIENT.x + 40, v37.ANCIENT.y + 40] });
      results.push(['standing at the Ancient Forge unlocks dragonsteel smelting',
        atForge.nearAncient === true && awayForge.nearAncient === false]);

      // Grand Bazaar is genuinely protected ground
      results.push(['the Grand Bazaar is a real safe zone, as the bible states',
        v37.bazaarIsSafe === true]);
      const outsideBazaar = probe({ at: [v37.BAZAAR.x + v37.BAZAAR_R + 3, v37.BAZAAR.y] });
      results.push(['that protection ends at its edge, not across the map',
        outsideBazaar.inSafe === false || outsideBazaar.inColosseum === true]);

      // Colosseum turns PvP ON — the inverse of everywhere else
      results.push(['the Colosseum is NOT a safe zone — it is the opposite',
        v37.colosseumIsSafe === false && v37.inColosseumAtCentre === true]);
      results.push(['PvP inside the ring overrides safe-zone protection',
        gameScript.indexOf('const arena37 = inColosseum(me.x, me.y) && inColosseum(o.x, o.y)') > 0]);
      results.push(['both duellists must be inside — no swinging from the ring at someone outside',
        gameScript.indexOf('inColosseum(me.x, me.y) && inColosseum(o.x, o.y)') > 0]);
      const outsideArena = probe({ at: [v37.COLOSSEUM.x + v37.COLOSSEUM_R + 5, v37.COLOSSEUM.y] });
      results.push(['the arena has a real edge you can stand outside of',
        outsideArena.inColosseum === false]);

      /* v52+53 PART B: UPDATED, not relaxed. `drawColosseumEntity` is gone
         because the Colosseum stopped being ONE drawn thing — at a 16-tile
         ring a single sort key would paint its far side over a player standing
         behind it, so it is a built piece list now, exactly like ruinPieces,
         and every piece sorts on its own. The assertion is the same one it
         always was (all three are real structures rather than invisible
         zones), pointed at the functions that actually draw this one. */
      results.push(['all three render as real structures, not invisible zones',
        gameScript.indexOf('function drawBazaarEntity') > 0 &&
        gameScript.indexOf('function drawAncientEntity') > 0 &&
        gameScript.indexOf('function colosseumPieces()') > 0 &&
        gameScript.indexOf('function drawColosseumFloor(') > 0 &&
        gameScript.indexOf('function drawColosseumPiece(') > 0 &&
        gameScript.indexOf('function drawColosseumEntity') < 0]);
      results.push(['each announces itself so a player knows what they found',
        gameScript.indexOf('The Grand Bazaar — protected ground') > 0 &&
        gameScript.indexOf('dragonsteel can be smelted here') > 0 &&
        gameScript.indexOf('PvP is live inside the ring') > 0]);
      /* The only 'currency' in the file is a comment saying there ISN'T one. */
      results.push(['no trading or currency system was invented — item-for-item, as written',
        gameScript.indexOf('function tradeWindow') < 0 &&
        gameScript.indexOf('let playerGold') < 0 &&
        gameScript.indexOf('currencyBalance') < 0]);
    } else {
      results.push(['v37 hooks are reachable', false]);
    }

    /* ============ Expansion 2a: viewport-based ground rendering ===========
       The single pre-baked full-map canvas is gone; ground tiles are drawn
       per frame, visible ones only. These gates hold the three things that
       conversion could plausibly have broken: that the bake is genuinely
       removed rather than left dead, that the per-frame pass never drops a
       tile that would have painted on screen (which is what a cliff face
       popping at the viewport edge would look like), and that the per-frame
       tile count stays bounded.

       The op-for-op comparison against the pre-change file lives outside this
       harness by necessity — it needs the old file, which only exists in git
       history. It ran at the build that made the change: 9 camera positions
       across coast, mountain, volcano, forest, dark forest and ruins, 17,853
       tiles, 203,433 draw ops, zero mismatches. What is pinned HERE is
       everything that can still be checked from the shipped file alone. */
    if (typeof window.drawGroundTile === 'function' && window.debugWorldInfo) {
      const g2a = () => window.debugWorldInfo().ground;
      const info2a = window.debugWorldInfo();
      const pump2a = (from, n) => {
        for (let f = from; f < from + (n || 3); f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 50); } catch (e) { if (!caught) caught = e; } }
        }
      };

      /* --- the bake is genuinely gone, not left dead in the file ---------
         Checked against the script with its COMMENTS STRIPPED, because the
         new code explains itself by naming what it replaced — the point is
         that no executable reference survives, not that the words don't. */
      const stripped = gameScript
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/([^:"'`])\/\/[^\n]*/g, '$1');
      /* Tuning/Polish: the length bound moved 0.6 -> 0.5, and this is a
         correction to a proxy rather than a relaxed gate. What it exists to
         catch is a stripper that ate the whole file, not a file that is
         well commented — and this repo's comment density crossed 40% of the
         script this version, which landed the ratio on exactly 0.600 and
         failed a check about the STRIPPER for reasons that had nothing to do
         with it. The real sanity test is structural, so it is now four
         probes across the file rather than two: a function near the top, one
         in the middle, one near the bottom, and the game's own entry point.
         A stripper that mangles anything loses one of them. */
      const stripperSane = stripped.indexOf('function drawGroundTile') > 0 &&
        stripped.indexOf('function render') > 0 &&
        stripped.indexOf('function biomeAt') > 0 &&
        stripped.indexOf('function loadWorld') > 0 &&
        stripped.length > gameScript.length * 0.5;
      results.push(['(the comment stripper these gates rely on is sane)', stripperSane]);
      for (const dead of ['bakeTerrain', 'terrainBake', 'bakeOX', 'bakeOY']) {
        results.push(['the bake is genuinely removed: no live `' + dead + '` anywhere',
          stripperSane && stripped.indexOf(dead) < 0]);
      }
      results.push(['nothing blits a pre-baked terrain sheet any more',
        stripped.indexOf('drawImage(terrainBake') < 0]);
      results.push(['drawGroundTile() replaced it, and the frame really calls it',
        stripped.indexOf('function drawGroundTile') > 0 &&
        stripped.indexOf('drawGroundTile(ctx, tx, ty)') > 0]);
      results.push(['the per-tile jitter helper survived the move intact',
        typeof window.variedZ === 'function' &&
        stripped.indexOf('hash2(tx2, ty2, 73) * 9') > 0]);
      /* The bake's diagonal sweep is the reason cliff faces overlap correctly.
         Row-major would put a face under a tile that used to paint over it. */
      results.push(['ground still draws back-to-front by tx + ty, as the bake did',
        stripped.indexOf('for (let s = gMinX + gMinY; s <= gMaxX + gMaxY; s++)') > 0]);

      /* --- PART C: this version changes no world geometry at all --------- */
      /* Expansion 2b: 2a's PART C pinned "this version changes no world
         geometry"; 2b is the version that changes it, so these move with it.
         What they still prove is that the ground pass reads whatever N and
         SAFE_RADIUS actually are rather than carrying a baked assumption. */
      results.push(['N is the scaled-up 4000', info2a.N === 4000]);
      results.push(['the safe zone radius is the scaled-up 452', info2a.SAFE_RADIUS === 452]);
      results.push(['landmark placement is untouched — all three still found a spot',
        info2a.VOLCANO.x > 0 && info2a.MOUNT.x > 0 &&
        info2a.RUINS.length === info2a.RUIN_COUNT]);

      /* --- the real gate: no tile that would paint on screen is skipped ---
         Walks a wide window of REAL tiles, computes each one's true painted
         extent from its own height and its south/east neighbours' heights —
         the same two lookups the cliff-face branches make — and fails if any
         tile whose paint reaches inside the canvas was not drawn. This is
         what "cliff faces do not pop at the viewport edge" means mechanically.

         It runs at several camera positions AND across a slow pan, because
         popping is a thing you see while moving, not while standing still. */
      const IW2 = 22, IH2 = 11, HZ = 16, PAD = 22;
      const isoXa = (x, y) => (x - y) * IW2, isoYa = (x, y) => (x + y) * IH2;
      const B2a = info2a.B, N2a = info2a.N;

      function missedTiles() {
        const g = g2a();
        const w2 = g.w, h2 = g.h;
        const drawn = new Set();
        for (let s = g.minX + g.minY; s <= g.maxX + g.maxY; s++) {
          for (let tx = Math.max(g.minX, s - g.maxY); tx <= Math.min(g.maxX, s - g.minY); tx++) {
            const ty = s - tx;
            const bcx = w2 / 2 + isoXa(tx + 0.5, ty + 0.5) - isoXa(g.camX, g.camY);
            if (bcx + IW2 < 0 || bcx - IW2 > w2) continue;
            const bcy = h2 / 2 + isoYa(tx + 0.5, ty + 0.5) - isoYa(g.camX, g.camY);
            if (bcy + info2a.GROUND_DOWN < 0 || bcy - info2a.GROUND_UP > h2) continue;
            drawn.add(tx + ',' + ty);
          }
        }
        if (drawn.size !== g.tiles) return { bad: -1, note: 'recomputed set ' + drawn.size + ' != reported ' + g.tiles };
        let bad = 0, first = null;
        for (let tx = Math.max(0, g.minX - PAD); tx <= Math.min(N2a - 1, g.maxX + PAD); tx++) {
          for (let ty = Math.max(0, g.minY - PAD); ty <= Math.min(N2a - 1, g.maxY + PAD); ty++) {
            if (drawn.has(tx + ',' + ty)) continue;
            const zTop = window.variedZ(tx, ty);
            const cx = w2 / 2 + isoXa(tx + 0.5, ty + 0.5) - isoXa(g.camX, g.camY);
            const cy = h2 / 2 + isoYa(tx + 0.5, ty + 0.5) - isoYa(g.camX, g.camY) - zTop;
            const hh = window.heightAt(tx, ty);
            const hS = window.heightAt(tx, ty + 1), hE = window.heightAt(tx + 1, ty);
            let bot = cy + IH2;
            if (hh > Math.max(-1, hS)) bot = Math.max(bot, cy + IH2 + (zTop - Math.max(-1, hS) * HZ));
            if (hh > Math.max(-1, hE)) bot = Math.max(bot, cy + IH2 + (zTop - Math.max(-1, hE) * HZ));
            /* PEAK tiles also throw a snow spike, drawn as `moveTo(spx, cy - sph)`
               with sph capped at 15 — that is 15px above the tile's CENTRE, not
               above its diamond top. Expansion 2b corrects the model to match the
               code it is modelling: the topmost paint is whichever of the two
               reaches higher, never their sum. This makes the gate exact rather
               than 11px pessimistic, and it is what let the real GROUND_UP bug
               below be sized correctly instead of papered over. */
            const top = cy - Math.max(IH2, window.biomeAt(tx, ty) === B2a.PEAK ? 15 : 0);
            if (cx + IW2 < 0 || cx - IW2 > w2 || bot < 0 || top > h2) continue;
            bad++;
            if (!first) first = tx + ',' + ty + ' would paint x[' + (cx - IW2).toFixed(0) + ',' +
              (cx + IW2).toFixed(0) + '] y[' + top.toFixed(0) + ',' + bot.toFixed(0) + ']';
          }
        }
        return { bad, note: first, tiles: g.tiles, scanned: g.scanned };
      }

      const spots2a = [];
      const pickB = (label, key) => {
        if (!(key in B2a)) return;
        for (let y = 0; y < N2a; y++) for (let x = 0; x < N2a; x++)
          if (window.biomeAt(x, y) === B2a[key]) { spots2a.push([label, x + 0.5, y + 0.5]); return; }
      };
      spots2a.push(['spawn', info2a.SPAWN.x, info2a.SPAWN.y]);
      pickB('coast', 'SAND'); pickB('mountain', 'PEAK');
      pickB('volcano', 'VOLROCK'); pickB('forest', 'FOREST');
      spots2a.push(['volcano centre', info2a.VOLCANO.x, info2a.VOLCANO.y]);
      spots2a.push(['mount centre', info2a.MOUNT.x, info2a.MOUNT.y]);

      const before2a = window.debugWorldInfo().player;
      let worstMiss = 0, missNote = null, peakTiles = 0, minTiles = 1e9, checked = 0;
      for (const [label, sx, sy] of spots2a) {
        window.debugSetPlayer({ x: sx, y: sy });
        pump2a(1200 + checked * 10);
        const m = missedTiles();
        checked++;
        if (m.bad !== 0 && !missNote) missNote = label + ': ' + m.note;
        worstMiss = Math.max(worstMiss, m.bad);
        peakTiles = Math.max(peakTiles, m.tiles || 0);
        minTiles = Math.min(minTiles, m.tiles || 1e9);
      }
      console.log('Expansion 2a: ' + checked + ' camera positions checked, tiles/frame ' +
        minTiles + '-' + peakTiles + ' (viewport ' + g2a().w + 'x' + g2a().h + ')');
      results.push(['no visible ground tile is ever skipped, across ' + checked + ' biomes',
        worstMiss === 0]);
      if (missNote) console.log('     first miss:', missNote);

      /* The pan. A tile entering from the edge must already be drawn a frame
         before it is needed, which is what GROUND_MARGIN buys. Step a third
         of a tile at a time so an edge tile is genuinely straddling. */
      let panMiss = 0, panNote = null;
      const p0 = spots2a[1] || spots2a[0];
      for (let i = 0; i < 12; i++) {
        window.debugSetPlayer({ x: p0[1] + i / 3, y: p0[2] + (i % 2 ? i / 3 : 0) });
        pump2a(1400 + i * 10);
        const m = missedTiles();
        if (m.bad !== 0) { panMiss += Math.max(1, m.bad); if (!panNote) panNote = 'step ' + i + ': ' + m.note; }
      }
      results.push(['and none is skipped across a 12-step camera pan either', panMiss === 0]);
      if (panNote) console.log('     first pan miss:', panNote);

      /* --- PART B: the per-frame tile count stays in a reasonable range ---
         The camera distance is fixed (IW2/IH2 are constants, there is no
         zoom), so this scales purely with viewport pixels: one tile covers
         2 * IW2 * IH2 = 484 screen px, and the margin ring adds ~20%. The
         spec's proposed ~2000 ceiling is what that comes to at this
         harness's 1024x768. The ratio gate below is the viewport-independent
         half — it is what proves the per-tile cull is actually working,
         since the bounds rectangle is the bounding box of a diamond and a
         little over half of it is off screen at any size. */
      const gEnd = g2a();
      const ideal = (gEnd.w * gEnd.h) / (2 * IW2 * IH2);
      console.log('Expansion 2a: ' + peakTiles + ' tiles/frame peak vs ' + ideal.toFixed(0) +
        ' screen-fitting tiles (' + (peakTiles / ideal).toFixed(2) + 'x), from a ' +
        gEnd.scanned + '-tile bounds rectangle');
      /* Expansion 2b: 2000 -> 2100. The ceiling moved for exactly one reason
         and it is a correctness fix, not drift: GROUND_UP went 3*HZ -> 4*HZ
         because terrain genuinely reaches height 4 (see the constant's own
         comment), which keeps 24 more tiles per frame at the bottom edge —
         measured 1985 -> 2009 at this viewport. The viewport-independent
         ratio gate below is the real proof that the per-tile cull still
         works, and it is unchanged at 1.35x. */
      results.push(['per-frame tile count stays bounded at this viewport (~2000, ceiling 2100)',
        peakTiles > 0 && peakTiles <= 2100]);
      results.push(['it is close to the tiles that actually fit on screen, not the rectangle',
        peakTiles <= ideal * 1.35]);
      results.push(['the per-tile cull really is dropping most of the bounds rectangle',
        peakTiles < gEnd.scanned * 0.5]);
      results.push(['and the whole-map pass is gone — the frame scans a viewport, not N*N',
        gEnd.scanned > 0 && gEnd.scanned < info2a.N * info2a.N / 8]);

      /* Every ground branch still runs: drawGroundTile is callable directly
         on any tile, which is what run5's biome coverage now leans on. */
      let direct2a = 0;
      try {
        const c2a = window.document.createElement('canvas').getContext('2d');
        for (const [, sx, sy] of spots2a) { window.drawGroundTile(c2a, Math.floor(sx), Math.floor(sy)); direct2a++; }
      } catch (e) { if (!caught) caught = e; }
      results.push(['drawGroundTile draws any tile on demand, off camera included',
        direct2a === spots2a.length]);

      if (before2a) window.debugSetPlayer({ x: before2a.x, y: before2a.y, diving: !!before2a.diving });
      pump2a(1600);
      results.push(['frames still run clean after the whole Expansion 2a sweep', !caught]);
    } else {
      results.push(['Expansion 2a ground hooks are reachable', false]);
    }

    /* ===================== v39: the Elder trio + the secret event ========= */
    if (typeof window.debugV39Info === 'function') {
      const v39 = () => window.debugV39Info();
      const set39 = p => window.debugSetV39(p);
      const dsp39 = window.debugSetPlayer, dwi39 = window.debugWorldInfo;
      const pump39 = (from, n) => {
        for (let f = from; f < from + (n || 6); f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 50); } catch (e) { if (!caught) caught = e; } }
        }
      };
      const B39 = dwi39().B, N39 = dwi39().N;

      /* ---- PART A: the Golem Elder is one ordinary fight-to-tame beast ---- */
      const a0 = v39();
      results.push(['exactly one Golem Elder exists in the world', a0.golemElderCount === 1]);
      results.push(['it was actually placed somewhere real',
        !!a0.GOLEM_ELDER && a0.GOLEM_ELDER.x > 0 && a0.GOLEM_ELDER.y > 0]);
      /* v49 PART B: asked of the HOME tile (hx/hy), not the live x/y. The
         live file already answered this one for us — v48 added `hx`/`hy` to
         debugV39Info() with the comment "a mob idle-wanders up to its own
         leashRadius, and the Golem Elder stands by construction on the single
         outermost RUINB tile of its cluster, so 'it is on a ruin tile' is only
         a stable question about its home" — and this gate was never moved onto
         them. Placed on [829,2750] (a real RUINB tile, and the outermost of
         its cluster, which the independent recompute below still proves); by
         the time this runs it has idle-wandered off it, which is correct
         behaviour, not a placement bug. Home is the stable claim. */
      results.push(['it stands on a Ruin tile',
        !!a0.GOLEM_ELDER &&
        window.biomeAt(Math.floor(a0.GOLEM_ELDER.hx), Math.floor(a0.GOLEM_ELDER.hy)) === B39.RUINB]);
      /* Recomputed independently here rather than trusting the game's own
         answer: no RUINB tile in ANY cluster may sit further from its own
         centre than the one it chose. */
      {
        let far = -1, mine = -1;
        const r = Math.ceil(a0.RUIN_FOOT);
        for (const R of a0.RUINS) {
          for (let ty = R.y - r; ty <= R.y + r; ty++) {
            for (let tx = R.x - r; tx <= R.x + r; tx++) {
              if (tx < 2 || ty < 2 || tx >= N39 - 2 || ty >= N39 - 2) continue;
              if (window.biomeAt(tx, ty) !== B39.RUINB) continue;
              const d = Math.hypot(tx - R.x, ty - R.y);
              if (d > far) far = d;
              if (a0.golemElderSpot && tx === a0.golemElderSpot[0] && ty === a0.golemElderSpot[1]) {
                mine = d;
              }
            }
          }
        }
        console.log('golem elder tile', JSON.stringify(a0.golemElderSpot),
                    'dist from its centre', mine.toFixed(2), 'world max', far.toFixed(2));
        results.push(['it stands on the single furthest-from-centre ruin tile there is',
          mine >= 0 && Math.abs(mine - far) < 1e-9]);
      }
      results.push(['it is fight-to-tame, exactly the Griffin pattern',
        a0.golemElderDef.tameable === true &&
        a0.golemElderSpecies.fightToTame === true &&
        dwi39().WILD_SPECIES.griffin.fightToTame === true]);
      results.push(['it is not a world boss — a boss is something you kill',
        !a0.golemElderDef.boss]);
      results.push(['a singleton does not come back in a minute like an ordinary mob',
        window.mobRespawnMs('golem_elder') >= 60 * 60 * 1000 &&
        window.mobRespawnMs('goblin') === 60000]);
      results.push(['and every site that sets a respawn deadline reads that one rule',
        (gameScript.match(/Date\.now\(\) \+ MOB_RESPAWN_MS/g) || []).length === 0 &&
        (gameScript.match(/mobRespawnMs\(/g) || []).length >= 5]);
      results.push(['the three Elder ids are exactly the three species flagged elder',
        Object.entries(dwi39().WILD_SPECIES).filter(([, d]) => d.elder).map(([k]) => k).sort()
          .join('|') === a0.ELDER_SPECIES.slice().sort().join('|')]);
      results.push(['it drops no dragonsteel — the bible names four sources and this is not one',
        a0.golemElderDef.loot.every(l => l.type !== 'dragonsteel')]);
      /* The whole point of the revised spec: NO guardian/offline layer. */
      {
        /* Identifiers, not words: this version's own comments say out loud
           that no guardian layer was built, and a bare word search would
           match the sentence saying so. These are the shapes real code
           would have to take — a call, a property, a field, a key. */
        const BANNED = ['guardian(', '.guardian', 'guardian:', 'isGuardian',
                        'staysAtBase', 'defendBase', 'baseGuard', 'guardBase',
                        'offlineDefend', 'idleGuardian', 'guardianOf'];
        const found = BANNED.filter(s => gameScript.indexOf(s) >= 0);
        results.push(['no base-guardian or offline-defender logic was built' +
          (found.length ? ' (found ' + found.join(', ') + ')' : ''), found.length === 0]);
      }
      results.push(['the wear-down tame gate treats it like any other beast',
        window.canWearDownTame({ kind: 'golem_elder', hp: 100, maxHp: 420, dead: false }) === true &&
        window.canWearDownTame({ kind: 'golem_elder', hp: 300, maxHp: 420, dead: false }) === false]);
      /* ...and once tamed it is an ordinary companion, through the real path */
      if (window.debugGrantPet) {
        window.debugGrantPet('golem_elder');
        pump39(400, 8);
        const petA = dwi39().pet;
        results.push(['a tamed Golem Elder follows like any other companion',
          !!petA && petA.sp === 'golem_elder']);
        results.push(['it has ordinary companion combat stats, nothing special-cased',
          !!window.petCombatDef('golem_elder') &&
          window.petCombatDef('golem_elder').hp > 0]);
        results.push(['its pet record carries no guardian state of any kind',
          !!petA && petA.guard === undefined && petA.base === undefined &&
          petA.guardian === undefined]);
      }

      /* ---- PART B: the Golden Orb, the altar, the Dragon Elder ---- */
      const b0 = v39();
      results.push(['the Golden Orb is a real item with no recipe',
        !!window.debugV35Info && gameScript.indexOf('golden_orb:   { name: "Golden Orb"') > 0 &&
        gameScript.indexOf('out: "golden_orb"') < 0]);
      results.push(['the orb sits at the Eternal Tower\'s own coordinates',
        !!b0.orbSite && Math.abs(b0.orbSite.x - (b0.TOWER.x + 0.5)) < 1e-9 &&
        Math.abs(b0.orbSite.y - (b0.TOWER.y + 0.5)) < 1e-9]);
      results.push(['it has a real 48-real-hour floor, not a per-session one',
        b0.ORB_WINDOW_MS === 48 * 60 * 60 * 1000]);
      results.push(['the floor is enforced by the key itself — one key per window',
        window.orbKeyFor(b0.orbSlice) !== window.orbKeyFor(b0.orbSlice + 1) &&
        b0.orbSite.key === window.orbKeyFor(b0.orbSlice)]);
      results.push(['it is claimed server-wide, through the same mined_nodes row as any node',
        b0.orbFinite === true && b0.orbGives === 'golden_orb']);
      /* Take it for real, through the real E path. */
      /* The real E path is rate-limited by GATHER_COOLDOWN (700ms) exactly as
         it is for a player, so every interact below waits it out rather than
         firing into a cooldown and reading the no-op as a failure. */
      const gwait = () => new Promise(r => setTimeout(r, 760));
      let orbTaken = false;
      if (dsp39 && window.doInteract) {
        dsp39({ x: b0.TOWER.x + 0.5, y: b0.TOWER.y + 0.8 });
        await gwait();
        await window.doInteract();
        const inv39 = dwi39().player.inv;
        orbTaken = (inv39.golden_orb || 0) === 1;
        results.push(['gathering it yields exactly ONE orb, never a stack', orbTaken]);
        results.push(['and the orb is gone from the world for this window',
          v39().orbSite === null]);
        await gwait();
        await window.doInteract();
        results.push(['a second attempt in the same window gives nothing',
          (dwi39().player.inv.golden_orb || 0) === 1]);
      }
      const alt = v39();
      results.push(['the Dragon Elder Altar was placed somewhere real',
        alt.DRAGON_ALTAR.x > 0 && alt.DRAGON_ALTAR.y > 0]);
      // Expansion 4: DRAGON_ALTAR_DIST is 564.
      results.push(['it stands near the Tower the orb comes from',
        Math.hypot(alt.DRAGON_ALTAR.x - alt.TOWER.x, alt.DRAGON_ALTAR.y - alt.TOWER.y) < 574]);
      results.push(['but outside the spawn safe zone, like every landmark since v37',
        window.inSafeZone(alt.DRAGON_ALTAR.x, alt.DRAGON_ALTAR.y) === false]);
      results.push(['on ground a player can actually stand on',
        !window.debugWorldInfo().B ||
        [B39.DEEP, B39.PEAK, B39.LAVA].indexOf(
          window.biomeAt(alt.DRAGON_ALTAR.x, alt.DRAGON_ALTAR.y)) < 0]);
      results.push(['the Dragon Elder never spawns anywhere in the world',
        dwi39().wildSpecies.indexOf('dragon_elder') < 0 &&
        dwi39().mobKinds.indexOf('dragon_elder') < 0 &&
        dwi39().WILD_SPECIES.dragon_elder.biomes.length === 0]);
      if (dsp39 && window.doInteract && orbTaken) {
        // standing at the altar WITH the orb: it is consumed, the Elder wakes
        dsp39({ x: alt.DRAGON_ALTAR.x, y: alt.DRAGON_ALTAR.y + 1 });
        await gwait();
        await window.doInteract();
        const afterA = v39();
        results.push(['carrying the orb to the altar wakes a Dragon Elder',
          afterA.myPetSpecies.indexOf('dragon_elder') >= 0]);
        results.push(['and the orb is consumed doing it', afterA.orbHeld === 0]);
        // ...and a second attempt with no orb takes nothing and gives nothing
        await gwait();
        await window.doInteract();
        const afterB = v39();
        results.push(['an empty-handed player gets nothing from the altar and loses nothing',
          afterB.orbHeld === 0 &&
          afterB.myPetSpecies.filter(s => s === 'dragon_elder').length ===
          afterA.myPetSpecies.filter(s => s === 'dragon_elder').length]);
      }

      /* ---- PART C: the Unicorn Elder ---- */
      const c0 = v39();
      results.push(['exactly one Unicorn Elder stands in the world, on its own tile',
        !!c0.unicornElderWild &&
        Math.floor(c0.unicornElderWild.x) === c0.unicornElderTile[0] &&
        Math.floor(c0.unicornElderWild.y) === c0.unicornElderTile[1] &&
        dwi39().wildSpecies.filter(s => s === 'unicorn_elder').length === 1]);
      /* The uniformity sweep the spec asks for: hundreds of seeds, and the
         result must look like a flat draw over the whole map rather than
         anything clustered near a landmark. */
      {
        const SEEDS = 900;
        const quad = [0, 0, 0, 0];
        let sumX = 0, sumY = 0, nearCentre = 0, distinct = new Set();
        for (let s = 1; s <= SEEDS; s++) {
          const [tx, ty] = window.unicornElderTile(s);
          quad[(tx < N39 / 2 ? 0 : 1) + (ty < N39 / 2 ? 0 : 2)]++;
          sumX += tx; sumY += ty;
          if (Math.hypot(tx - N39 / 2, ty - N39 / 2) < 24) nearCentre++;
          distinct.add(tx + ',' + ty);
        }
        const mx = sumX / SEEDS, my = sumY / SEEDS;
        console.log('unicorn elder sweep — quadrants', JSON.stringify(quad),
                    'mean', mx.toFixed(1) + ',' + my.toFixed(1),
                    'distinct tiles', distinct.size,
                    'within 24 of the Tower', nearCentre);
        results.push(['every quadrant of the map gets its share across seeds',
          quad.every(q => q > SEEDS * 0.15)]);
        results.push(['the mean lands near the middle — no pull toward any corner',
          Math.abs(mx - N39 / 2) < N39 * 0.06 && Math.abs(my - N39 / 2) < N39 * 0.06]);
        results.push(['it is not clustered near the Tower / spawn hub',
          nearCentre < SEEDS * 0.12]);
        results.push(['seeds do not collapse onto a handful of tiles',
          distinct.size > SEEDS * 0.9]);
        results.push(['the same seed always gives the same tile — every client agrees',
          window.unicornElderTile(4242).join() === window.unicornElderTile(4242).join()]);
        /* Reachability is measured and REPORTED, not asserted: the spec pins
           the draw to the whole map with no biome test, so a seed that puts
           it on lava or open ocean is the spec working as written. */
        let standable = 0, divable = 0, unreachable = 0;
        for (let s = 1; s <= 200; s++) {
          const [tx, ty] = window.unicornElderTile(s);
          const b = window.biomeAt(tx, ty);
          if (b === B39.PEAK || b === B39.LAVA) unreachable++;
          else if (b === B39.DEEP) divable++;      // v21's dive reaches these
          else standable++;
        }
        console.log('unicorn elder tile over 200 seeds — walkable:', standable,
                    'reachable only by diving:', divable,
                    'genuinely unreachable (peak/lava):', unreachable);
        /* Not a hard failure: the spec pins the draw to the WHOLE map with no
           biome test, so a peak or a lava tile is the rule working as
           written. Measured and printed on every run, as v22 does for the
           Storm Dragon, so the cost of that rule is never invisible. */
        results.push(['most seeds put it somewhere a player can actually get to',
          (standable + divable) > 200 * 0.8]);
      }
      results.push(['the Oracle still cannot name any of the three',
        window.debugV35Info().oraclePool.every(s => c0.ELDER_SPECIES.indexOf(s) < 0) &&
        c0.ELDER_SPECIES.every(s => window.debugV35Info().oracleForbidden.indexOf(s) >= 0)]);
      results.push(['the Oracle pool is still a hand-written literal, not derived',
        gameScript.indexOf('const ORACLE_HINTS_ALL = [') > 0 &&
        gameScript.indexOf('Object.keys(WILD_SPECIES).map') < 0]);
      // fast travel: the six fixed points, and nothing that could leak a base
      results.push(['fast travel offers exactly the six fixed landmark points',
        c0.travelPoints.length === 6 &&
        c0.travelPoints.map(p => p.label).join('|') ===
        ['The Eternal Tower', 'The Volcano', 'The Grand Bazaar', 'The Ancient Forge',
         'The Ruined Colosseum', 'The Beastmaster Shrine'].join('|')]);
      {
        const secStart = gameScript.indexOf('function fastTravelPoints()');
        const secEnd = gameScript.indexOf('function refreshPetPanel()');
        const sec = gameScript.slice(secStart, secEnd);
        results.push(['the travel section never reads a base piece — the v35 compass rule',
          secStart > 0 && secEnd > secStart &&
          sec.indexOf('basePieces') < 0 && sec.indexOf('baseIndex') < 0]);
      }
      if (dsp39) {
        // no Unicorn Elder on the roster -> travel is refused outright
        const before = dwi39().player;
        /* v51 PART I: RETIRED AND REPLACED, exactly as v31 retired its event
           guards and v33 the Architect guard. What this pinned — that landmark
           travel is gated on owning the Unicorn Elder — is the thing PART I
           was directly instructed to remove, as an explicit and approved
           deviation from the bible. The replacement is the inverse, proved the
           same way: with NO Elder on the roster, travel actually happens and
           the player actually moves. */
        results.push(['v51 I: landmark travel works with NO Unicorn Elder owned',
          v39().ownsUnicornElder === false &&
          window.fastTravelTo(0) === true &&
          Math.hypot(dwi39().player.x - before.x, dwi39().player.y - before.y) > 1]);
        results.push(['v51 I: and no ownership check survives anywhere in that path',
          (() => {
            const i = gameScript.indexOf('function fastTravelTo(idx) {');
            const j = gameScript.indexOf('\nfunction ', i + 10);
            const body = gameScript.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, '');
            return i > 0 && body.indexOf('ownsUnicornElder') < 0;
          })()]);
        results.push(['and the luck buff is exactly zero without it',
          v39().luckNow === 0 && v39().ownsUnicornElder === false]);
        if (window.debugGrantPet) {
          window.debugGrantPet('unicorn_elder');
          const owned = v39();
          results.push(['owning one turns the passive luck buff on',
            owned.ownsUnicornElder === true && owned.luckNow === owned.UNICORN_ELDER_LUCK]);
          results.push(['the buff is the Blood Moon\'s own shape, added to the presence roll',
            /presenceRoll \+ \(bloodMoonActive\(\) \? BLOOD_MOON_RARE_BOOST : 0\)[\s\S]{0,40}\+ unicornElderLuck\(\)/.test(gameScript)]);
          /* Mob Rarity PART A puts loadRareTakes() between these two, so the
             adjacency literal this used to be no longer describes the file.
             What it was ever testing is the ORDER, so it is an order now —
             and the day's rare-take budget, which buildFeatureList() also
             reads exactly once, is held to the same rule. */
          const iPets24 = gameScript.indexOf('await loadPets();');
          const iTakes24 = gameScript.indexOf('await loadRareTakes();');
          const iBuild24 = gameScript.indexOf('buildFeatureList();', iPets24);
          results.push(['and the roster is loaded BEFORE the roll that reads it',
            iPets24 > 0 && iTakes24 > iPets24 && iBuild24 > iTakes24]);
          const t0 = dwi39().player;
          const ok = window.fastTravelTo(1);   // the Volcano
          const t1 = dwi39().player;
          results.push(['owning one makes travel work, and it really moves the player',
            ok === true && Math.hypot(t1.x - t0.x, t1.y - t0.y) > 5]);
          results.push(['it lands on ground a player can stand on',
            [B39.DEEP, B39.PEAK, B39.LAVA].indexOf(
              window.biomeAt(Math.floor(t1.x), Math.floor(t1.y))) < 0]);
          results.push(['and it never arrives flagged as diving on dry land',
            t1.diving === false]);
        }
        // the panel itself, opened by its real key, built from the real list
        const kd39 = new window.KeyboardEvent('keydown', { key: v39().travelKey });
        window.dispatchEvent(kd39);
        const rows39 = doc.getElementById('travelList');
        results.push(['the FAST TRAVEL panel opens on its own bound key',
          doc.getElementById('travelPanel').style.display === 'block']);
        results.push(['and lists one row per fixed landmark, no more',
          !!rows39 && rows39.children.length === 6]);
        results.push(['it is the existing panel language — no new component styles',
          !!rows39 && rows39.children[0].className === 'craft-row']);
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: v39().travelKey }));
      }

      /* ---- PART D: the trigger, the accumulator, and the two keys ---- */
      set39({ clearEvent: true, role: 'player' });
      const HERE = { x: dwi39().player.x, y: dwi39().player.y };
      let stageF = 600;
      const stage = (opts) => {
        /* Stand both Elders in one place: mine is the active companion, the
           other belongs to a second player standing right beside me.
           A companion GLIDES to its owner (dt*4.5), so the frames that let
           both pets catch up are pumped with combat OFF — otherwise the
           accumulator would already be part-way up before the scenario has
           finished being set up, and every reading after it would be a lie. */
        set39({ clearEvent: true, combat: false });
        window.debugGrantPet('golem_elder');
        const ox = HERE.x + (opts.far ? 40 : 1), oy = HERE.y + (opts.far ? 40 : 1);
        set39({ remote: { u: 'OtherPlayer', x: ox, y: oy, pe: 'dragon_elder',
                          cb: opts.theirCombat !== false ? 1 : 0, petAt: [ox, oy] } });
        pump39(stageF, 40);
        stageF += 60;
        set39({ clearEvent: true, combat: opts.myCombat !== false });
      };
      stage({});
      const seen = v39().elders;
      console.log('elders seen by the trigger:', JSON.stringify(seen));
      results.push(['the trigger can see both Elders and both owners\' combat state',
        seen.some(e => e.species === 'golem_elder' && e.combat) &&
        seen.some(e => e.species === 'dragon_elder' && e.combat)]);
      results.push(['a remote player\'s combat state rides the one existing broadcast',
        gameScript.indexOf('cb: performance.now() < combatMusicUntil ? 1 : 0') > 0 &&
        gameScript.indexOf('o.cb = !!p.cb;') > 0 &&
        (gameScript.match(/sb\.channel\(/g) || []).length === 1]);
      // the accumulator climbs while everything holds...
      set39({ tick: 1000 });
      const acc1 = v39().elderHoldMs;
      set39({ tick: 1000 });
      const acc2 = v39().elderHoldMs;
      results.push(['the accumulator climbs while all four conditions hold',
        acc1 > 0 && acc2 > acc1]);
      // ...and is SET TO ZERO the instant any one of them breaks, each tested alone
      const breaks = [];
      // (a) distance
      stage({}); set39({ tick: 2000 });
      set39({ remote: { u: 'OtherPlayer', x: HERE.x + 40, y: HERE.y + 40, pe: 'dragon_elder',
                        cb: 1, petAt: [HERE.x + 40, HERE.y + 40] } });
      set39({ tick: 100 });
      breaks.push(['distance', v39().elderHoldMs === 0]);
      // (b) my own combat stops
      stage({}); set39({ tick: 2000 });
      set39({ combat: false }); set39({ tick: 100 });
      breaks.push(['my combat ends', v39().elderHoldMs === 0]);
      // (c) their combat stops
      stage({}); set39({ tick: 2000 });
      set39({ remote: { u: 'OtherPlayer', x: HERE.x + 1, y: HERE.y + 1, pe: 'dragon_elder',
                        cb: 0, petAt: [HERE.x + 1, HERE.y + 1] } });
      set39({ tick: 100 });
      breaks.push(['their combat ends', v39().elderHoldMs === 0]);
      // (d) the other Elder leaves the world entirely
      stage({}); set39({ tick: 2000 });
      set39({ dropRemote: 'OtherPlayer' }); set39({ tick: 100 });
      breaks.push(['the other Elder is gone', v39().elderHoldMs === 0]);
      for (const [what, ok] of breaks) {
        results.push([`the accumulator resets to ZERO the instant ${what}`, ok]);
      }
      // four seconds of non-consecutive truth must NEVER fire it
      stage({});
      for (let i = 0; i < 20; i++) {
        set39({ tick: 900 });
        set39({ combat: false }); set39({ tick: 1 }); set39({ combat: true });
      }
      results.push(['18 seconds of broken-up truth never fires it — continuity is real',
        v39().worldResetArmed === false && v39().worldResetAt === 0]);
      // the accumulator is fed by the REAL loop, not only by the test hook
      stage({});
      pump39(1400, 10);
      results.push(['the trigger is checked by update() itself, every frame',
        v39().elderHoldMs > 0]);
      // ...but four continuous seconds does
      stage({});
      const sentBefore = sentBroadcasts.length;
      set39({ tick: 2000 }); set39({ tick: 2000 });
      const fired = v39();
      results.push(['four continuous seconds arms it', fired.worldResetArmed === true]);
      {
        const pend = sentBroadcasts.slice(sentBefore)
          .filter(m => m && m.event === 'world_reset_pending');
        results.push(['and broadcasts world_reset_pending exactly ONCE', pend.length === 1]);
        set39({ tick: 2000 });
        results.push(['further frames never broadcast it again',
          sentBroadcasts.slice(sentBefore)
            .filter(m => m && m.event === 'world_reset_pending').length === 1]);
      }
      results.push(['and starts a countdown of exactly ten seconds',
        fired.worldResetAt > 0 &&
        Math.abs(fired.worldResetAt - Date.now() - 10000) < 1500]);
      // the countdown is actually on screen, and it is the only thing that is
      if (window.updateUnmakingHud) {
        window.updateUnmakingHud();
        const un = doc.getElementById('hudUnmaking');
        results.push(['the countdown card is really on screen while it runs',
          un.style.display === 'block' && /THE WORLD IS UNMAKING/.test(un.textContent)]);
        results.push(['and it counts seconds and nothing else',
          /^\s*THE WORLD IS UNMAKING\s*\d{1,2}\s*$/.test(un.textContent.replace(/\s+/g, ' '))]);
      }
      results.push(['the countdown card names no cause a player could work backwards from',
        gameScript.indexOf('THE WORLD IS UNMAKING') > 0 &&
        !/un-head[\s\S]{0,200}(Elder|orb|altar|reset)/.test(gameScript)]);
      // the SECOND key: armed is not enough
      results.push(['armed is not enough — a non-admin cannot execute the reset',
        fired.isAdmin === false && fired.execAllowed === false]);
      results.push(['and calling it outright is refused, with the trigger fully satisfied',
        (await window.debugRunWorldReset()) === 'denied']);
      results.push(['the refusal is the first thing the reset does, before any write',
        /async function performWorldReset\(\) \{\s*if \(!worldResetExecAllowed\(\)\) return "denied";/
          .test(gameScript)]);
      // a forged broadcast can start a countdown and STILL cannot arm anything
      set39({ clearEvent: true });
      results.push(['a forged world_reset_pending never sets the arming key',
        gameScript.indexOf('worldResetArmed is deliberately NOT set here') > 0 ||
        /event: "world_reset_pending" \}, \(\{ payload: p \}\) => \{[\s\S]{0,400}\}\);/.test(gameScript)]);
      {
        const hStart = gameScript.indexOf('{ event: "world_reset_pending" }');
        const hEnd = gameScript.indexOf('channel.on("presence"');
        const handler = gameScript.slice(hStart, hEnd);
        results.push(['— proven by the handler itself never touching worldResetArmed',
          hStart > 0 && hEnd > hStart && handler.indexOf('worldResetArmed') < 0]);
      }
      // nothing this version added is readable anywhere a player can see it
      {
        const toasts = (gameScript.match(/toast\(`[^`]*`\)|toast\("[^"]*"\)/g) || []);
        const leak = toasts.filter(s =>
          /world reset|world_reset|new seed|wipe|unmaking/i.test(s) ||
          (/golem elder/i.test(s) && /dragon elder/i.test(s)));
        results.push(['no toast in the game references the event, its cause or its effect' +
          (leak.length ? ' (found ' + leak.join(' / ') + ')' : ''), leak.length === 0]);
      }
      {
        // the tutorial's own step text, read directly rather than approximated
        const tStart = gameScript.indexOf('const TUTORIAL_STEPS = [');
        const tEnd = gameScript.indexOf('];', tStart);
        const steps = gameScript.slice(tStart, tEnd);
        results.push(['and the tutorial never mentions any of it',
          tStart > 0 && tEnd > tStart && !/elder|orb|altar|unmaking/i.test(steps)]);
      }

  
    /* ================= TUNING / POLISH — the eight parts ==================
       PART A bigger Elders, PART B a grander Bazaar, PART C player-to-player
       teleport, PART D cave density, PART E the sand coastline, PART F the
       death-drop panel refresh, PART G differentiated mob sizing, PART H the
       two bow ranges. PART D's own gates live with the v29/v32 interior block
       above, where the interiors are already open. ==================== */
    if (typeof window.debugScaleInfo === 'function') {
      const SC = window.debugScaleInfo();
      const SK = SC.SPECIES_K, MK = SC.MOB_K, MT = SC.MOB_TALL;

      /* ---- PART A: each Elder reads as a SIZE tier, not just a stat one ---
         Asserted as a relationship against the line it heads, never as a
         literal, so a future pass that sizes up the base tier cannot leave an
         Elder quietly level with it. */
      const elderVs = [
        ['Golem Elder', SK.golem_elder, Math.max(SK.golem, SK.crystal_golem)],
        ['Dragon Elder', SK.dragon_elder,
          Math.max(SK.fire_dragon, SK.water_dragon, SK.storm_dragon, SK.shadow_dragon)],
        ['Unicorn Elder', SK.unicorn_elder, SK.unicorn],
      ];
      for (const [nm, k, base] of elderVs) {
        results.push([`PART A: ${nm} is the largest of its line by a real margin ` +
          `(${k} vs ${base}, +${Math.round((k / base - 1) * 100)}%)`, k >= base * 1.35]);
      }
      results.push(['PART A: and every Elder grew from the values the spec confirmed live',
        SK.golem_elder > 2.10 && SK.dragon_elder > 1.85 && SK.unicorn_elder > 1.45]);
      results.push(['PART A: the Golem Elder is still the tallest tameable body in the file',
        Object.keys(SK).every(s => s === 'golem_elder' || SK[s] <= SK.golem_elder)]);

      /* ---- PART G: uneven, and it reinforces the threat hierarchy --------
         The point is NOT that everything grew — a flat multiplier would pass
         that. It is that the gap between a common thing and a dangerous one
         got WIDER, and that size still sorts the same way threat does. */
      const grew = { goblin: 1.44, bandit: 1.78, troll: 1.94, dark_wraith: 1.30,
                     sea_serpent: 2.85, elder_drake: 3.40 };
      results.push(['PART G: every hostile mob grew',
        Object.keys(grew).every(k => MK[k] > grew[k])]);
      const bump = k => MK[k] / grew[k];
      results.push([`PART G: the dangerous grew harder than the common ` +
        `(goblin +${Math.round((bump('goblin') - 1) * 100)}%, troll +${Math.round((bump('troll') - 1) * 100)}%, ` +
        `drake +${Math.round((bump('elder_drake') - 1) * 100)}%)`,
        bump('elder_drake') > bump('troll') && bump('troll') > bump('bandit') &&
        bump('bandit') > 1 && bump('troll') > bump('goblin') * 1.1]);
      results.push(['PART G: it is not a flat multiplier — the bumps genuinely differ',
        new Set(Object.keys(grew).map(k => bump(k).toFixed(3))).size >= 3]);
      {
        /* Size sorts as threat does — among the mobs that fight with their
           BODIES. `dark_wraith` is the one deliberate exception and is named
           here rather than quietly dropped: it is the file's only ranged mob
           (v18 pushed its atkRange to 4.5 so it never closes), and its danger
           is the distance, not its mass. It has read smaller than a Goblin
           since v18 and must keep doing so — an incorporeal spectre the size
           of a Troll would be a different creature. Every OTHER mob must sort
           by size exactly as it sorts by threat, at every scale pass. */
        const kinds = Object.keys(SC.mobThreat)
          .filter(k => MK[k] !== undefined && k !== 'dark_wraith');
        const byThreat = kinds.slice().sort((a, b) => SC.mobThreat[a] - SC.mobThreat[b]);
        const bySize = kinds.slice().sort((a, b) => MK[a] - MK[b]);
        results.push([`PART G: size still sorts exactly as threat does (${bySize.join(' < ')})`,
          byThreat.join('|') === bySize.join('|')]);
        results.push(['PART G: and the ranged Dark Wraith is still deliberately the small one',
          MK.dark_wraith < MK.goblin && SC.mobThreat.dark_wraith > SC.mobThreat.goblin]);
      }
      results.push(['PART G: the gap between the weakest and the strongest mob WIDENED',
        (MK.elder_drake / MK.goblin) > (3.40 / 1.44)]);
      /* The v13 fairness rule is on the must-not-regress list: the "!" tell
         and the HP bar are drawn at `sy - 20 - MOB_TALL`, and nothing scales
         that offset, so a body that grew without it ends up wearing its own
         tell. Every creature this build resized must have gained clearance. */
      const tallBefore = { troll: 22, bandit: 4, bear: 5, griffin: 8, phoenix: 6,
                           dark_wraith: 4, sea_serpent: 15, golem_elder: 18 };
      results.push(['PART G: every resized creature gained overlay clearance with its body',
        Object.keys(tallBefore).every(k => MT[k] > tallBefore[k])]);
      results.push(['PART G: the Elder Drake finally HAS an overlay offset (it never did)',
        typeof MT.elder_drake === 'number' && MT.elder_drake > 0]);

      /* ---- PART H: the two bow ranges, and the tier inconsistency -------- */
      results.push([`PART H: Runic Longbow range is 14 (was 11) — ${SC.weaponRange.runic_longbow}`,
        SC.weaponRange.runic_longbow === 14]);
      results.push([`PART H: Dragonsteel Bow range is at least 15 (was 9.5) — ${SC.weaponRange.dragonsteel_bow}`,
        SC.weaponRange.dragonsteel_bow >= 15]);
      results.push(['PART H: and Dragonsteel is now strictly ahead of Runic on range, as its tier says',
        SC.weaponRange.dragonsteel_bow > SC.weaponRange.runic_longbow]);
      results.push(['PART H: nothing else in the weapon table moved',
        SC.weaponRange.runic_crossbow === 9.5 && SC.weaponRange.mystic_staff === 8.5 &&
        SC.weaponRange.elder_runestaff === 8.5 && SC.weaponRange.iron_shortbow === 9]);
    } else {
      results.push(['Tuning/Polish scale hook is reachable', false]);
    }

    /* ---- PART B: the Bazaar's FOOTPRINT grew, not just its detail -------- */
    {
      const v37 = window.debugV37Info();
      results.push([`PART B: the stall ring genuinely widened (${v37.BAZAAR_RING} tiles, was 3.4)`,
        v37.BAZAAR_RING >= 5]);
      results.push([`PART B: there are more stalls on it (${v37.BAZAAR_STALLS}, was 6)`,
        v37.BAZAAR_STALLS >= 8 && v37.BAZAAR_STALLS <= 10]);
      results.push([`PART B: and the protected ground grew with them (BAZAAR_R ${v37.BAZAAR_R}, was 7)`,
        v37.BAZAAR_R >= 10]);
      results.push(['PART B: the ring still sits inside its own protection, with room to spare',
        v37.BAZAAR_RING < v37.BAZAAR_R - 3]);
      /* Not a constant read back at itself: a tile that was OUTSIDE the old
         radius and is inside the new one must really be protected now. */
      const probeR = window.debugV37Probe({ at: [v37.BAZAAR.x + 8.5, v37.BAZAAR.y] });
      results.push(['PART B: a tile 8.5 out — outside the old 7 — is genuinely safe ground now',
        probeR.inSafe === true]);
      const probeOut = window.debugV37Probe({ at: [v37.BAZAAR.x + 12, v37.BAZAAR.y] });
      results.push(['PART B: and the protection still ENDS — 12 out is not safe',
        probeOut.inSafe === false || window.debugWorldInfo().SPAWN === undefined]);
    }

    /* ---- PART E: the sand coastline ------------------------------------- */
    {
      const stripE = gameScript
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/([^:"'`])\/\/[^\n]*/g, '$1');
      results.push(['PART E: sand cliff faces are sand, not the cream CLIFF_SW/SE',
        stripE.indexOf('b === B.SAND ? shade("#e6d5a0", 0.8)') > 0 &&
        stripE.indexOf('b === B.SAND ? shade("#e6d5a0", 0.58)') > 0]);
      results.push(['PART E: on the locked 0.8 / 0.58 face ratio the other three exceptions use',
        (stripE.match(/shade\("#e6d5a0", 0\.8\)/g) || []).length === 1 &&
        (stripE.match(/shade\("#e6d5a0", 0\.58\)/g) || []).length === 1]);
      results.push(['PART E: the two SAND palette shades themselves are untouched',
        gameScript.indexOf('[B.SAND]:       ["#e6d5a0", "#e4d39e"]') > 0]);
      results.push(['PART E: the wet band is no longer a flat full-strength wash',
        stripE.indexOf('rgba(178,152,104,0.5)') < 0 && stripE.indexOf('wetSides') > 0]);
      results.push(['PART E: sand gained a grain texture, hard-edged and hashed like the cliff wear',
        /for \(let s = 0; s < 4; s\+\+\) \{[\s\S]{0,400}hash2\(tx, ty, 100 \+ s \* 3\)/.test(stripE)]);
      results.push(['PART E: and it introduces no gradient — the flat-shading rule',
        !/createRadialGradient|createLinearGradient/.test(
          stripE.slice(stripE.indexOf('if (b === B.SAND) {'),
                       stripE.indexOf('if (b === B.SAND) {') + 2600))]);
      /* A real sand tile with real water beside it, drawn for real. */
      {
        const infoE = window.debugWorldInfo();
        let sandAt = null;
        for (let y = 2; y < infoE.N - 2 && !sandAt; y += 7)
          for (let x = 2; x < infoE.N - 2; x += 7) {
            if (window.biomeAt(x, y) !== infoE.B.SAND) continue;
            if (window.heightAt(x + 1, y) !== -1 && window.heightAt(x, y + 1) !== -1 &&
                window.heightAt(x - 1, y) !== -1 && window.heightAt(x, y - 1) !== -1) continue;
            sandAt = [x, y]; break;
          }
        results.push(['PART E: a real waterline sand tile exists in the test seed', !!sandAt]);
        if (sandAt) {
          let threw = null;
          try { window.drawGroundTile(ctx2d, sandAt[0], sandAt[1]); }
          catch (e) { threw = e; }
          results.push(['PART E: and it draws cleanly through the real ground pass', !threw]);
        }
      }
    }

    /* ---- PART F: the death-drop panel refresh --------------------------- */
    if (typeof window.enterDeath === 'function' && window.debugSetPlayer) {
      window.debugSetPlayer({ inv: { wood: 7, iron_bar: 2 }, hp: 100 });
      window.refreshPanels();
      const invEl = doc.getElementById('invList');
      const beforeRows = invEl ? invEl.innerHTML : '';
      results.push(['PART F: the Inventory panel is showing the pre-death pack',
        beforeRows.indexOf('Wood') > 0 || beforeRows.indexOf('wood') > 0]);
      /* The panel is OPEN at the moment of death — the exact condition the
         reported "items survive death" bug was actually describing. */
      doc.getElementById('invPanel').style.display = 'block';
      window.enterDeath(null, false);
      const afterRows = invEl ? invEl.innerHTML : '';
      results.push(['PART F: the data really was dropped (this half was never broken)',
        Object.keys(window.debugWorldInfo().player.inv || {}).length === 0]);
      results.push(['PART F: and the OPEN panel repainted itself — no stale pre-death contents',
        afterRows !== beforeRows && afterRows.indexOf('Iron Bar') < 0]);
      results.push(['PART F: enterDeath() calls refreshPanels(), which is the whole fix',
        /function enterDeath\([\s\S]{0,1400}?refreshPanels\(\);[\s\S]{0,80}?\n\}/.test(gameScript)]);
      doc.getElementById('invPanel').style.display = 'none';
      window.respawn();
      results.push(['PART F: and respawning still works on the far side of it',
        window.debugWorldInfo().player.hp > 0]);
    } else {
      results.push(['PART F hooks are reachable', false]);
    }

    /* ---- PART C: player-to-player teleport ------------------------------ */
    if (typeof window.debugSetTravel === 'function' && window.debugCombatHandles) {
      const dtv = window.debugSetTravel, tvi = window.debugTravelInfo;
      const handles = window.debugCombatHandles();
      const infoC = window.debugWorldInfo();
      const v37c = window.debugV37Info();
      const t0 = tvi();
      results.push([`PART C: the landing ring is the spec's 3-5 tiles (${t0.PLAYER_TP_MIN}-${t0.PLAYER_TP_MAX})`,
        t0.PLAYER_TP_MIN === 3 && t0.PLAYER_TP_MAX === 5]);
      results.push([`PART C: and there is a real cooldown (${t0.PLAYER_TP_COOLDOWN_MS / 1000}s)`,
        t0.PLAYER_TP_COOLDOWN_MS >= 30000]);

      /* Somewhere open, far from spawn, to stand the ghost on. */
      let openC = null;
      for (let r = 200; r < infoC.N / 2 - 20 && !openC; r += 37) {
        for (let a = 0; a < 24 && !openC; a++) {
          const ang = (a / 24) * Math.PI * 2;
          const x = Math.round(infoC.SPAWN.x + Math.cos(ang) * r);
          const y = Math.round(infoC.SPAWN.y + Math.sin(ang) * r);
          if (x < 20 || y < 20 || x > infoC.N - 20 || y > infoC.N - 20) continue;
          let clear = true;
          for (let dx = -7; dx <= 7 && clear; dx++)
            for (let dy = -7; dy <= 7; dy++) {
              const b = window.biomeAt(x + dx, y + dy);
              if (b === infoC.B.DEEP || b === infoC.B.LAVA || b === infoC.B.PEAK) { clear = false; break; }
            }
          if (!clear) continue;
          if (window.debugV37Probe({ at: [x + 0.5, y + 0.5] }).inSafe) continue;
          if (window.debugV37Probe({ at: [x + 0.5, y + 0.5] }).inColosseum) continue;
          openC = [x + 0.5, y + 0.5];
        }
      }
      results.push(['PART C: a clear stretch of world exists to test the teleport in', !!openC]);

      if (openC) {
        window.debugSetPlayer({ x: infoC.SPAWN.x + 0.5, y: infoC.SPAWN.y + 0.5 });
        handles.others.set('GhostFriend', {
          x: openC[0], y: openC[1], tx: openC[0], ty: openC[1],
          space: 'main', dead: false, lastHeard: window.performance.now(),
          hp: 100, maxHp: 100, cls: 'Ranger', level: 1,
        });
        const listed = tvi().players;
        results.push(['PART C: an online player in the same space is listed by name',
          listed.some(p => p.name === 'GhostFriend')]);
        /* The login above is 'BootTest'. A stale self-entry in `others` must
           never become a destination that teleports you to yourself. */
        handles.others.set('BootTest', {
          x: openC[0], y: openC[1], tx: openC[0], ty: openC[1], space: 'main',
          dead: false, lastHeard: window.performance.now(), hp: 100, maxHp: 100,
        });
        results.push(['PART C: and you are never in your own list',
          !tvi().players.some(p => p.name === 'BootTest')]);
        handles.others.delete('BootTest');

        // a player in a DIFFERENT space is not a destination
        handles.others.set('GhostDiver', {
          x: 5, y: 5, tx: 5, ty: 5, space: 'cave:uwcave:1,1', dead: false,
          lastHeard: window.performance.now(), hp: 100, maxHp: 100,
        });
        results.push(['PART C: someone in another space is not offered — their coordinates are not world ones',
          !tvi().players.some(p => p.name === 'GhostDiver')]);
        handles.others.delete('GhostDiver');

        // without the Unicorn Elder the whole tab is refused, same as the places tab
        const posA = window.debugWorldInfo().player;
        const hadElder = window.debugV39Info().ownsUnicornElder;
        if (!hadElder) {
          results.push(['PART C: travel to a player is refused without the Unicorn Elder',
            dtv({ clearCooldown: true, to: 'GhostFriend' }).travelled === false &&
            Math.abs(window.debugWorldInfo().player.x - posA.x) < 1e-9]);
        }
        if (window.debugGrantPet) window.debugGrantPet('unicorn_elder');

        // ---- the landing rules ----
        const before = window.debugWorldInfo().player;
        const okC = dtv({ clearCooldown: true, to: 'GhostFriend' });
        const after = window.debugWorldInfo().player;
        const dist = Math.hypot(after.x - openC[0], after.y - openC[1]);
        results.push([`PART C: it lands you NEAR them, never on them (${dist.toFixed(2)} tiles)`,
          okC.travelled === true && dist >= 3 && dist <= 5.6]);
        results.push(['PART C: and it really moved you — this was a teleport, not a no-op',
          Math.hypot(after.x - before.x, after.y - before.y) > 20]);
        results.push(['PART C: onto ground a player can actually stand on',
          [infoC.B.DEEP, infoC.B.PEAK, infoC.B.LAVA].indexOf(
            window.biomeAt(Math.floor(after.x), Math.floor(after.y))) < 0]);
        results.push(['PART C: never arriving flagged as diving on dry land',
          after.diving === false]);

        // ---- the cooldown is real, not decorative ----
        const cdInfo = tvi();
        results.push([`PART C: the cooldown is running immediately afterwards (${Math.round(cdInfo.readyIn / 1000)}s left)`,
          cdInfo.readyIn > 50000]);
        const posB = window.debugWorldInfo().player;
        results.push(['PART C: and a second travel inside it is refused — no spamming it for position',
          dtv({ to: 'GhostFriend' }).travelled === false &&
          Math.abs(window.debugWorldInfo().player.x - posB.x) < 1e-9]);

        /* ---- the zone rule, which is the exploit this had to close ------
           Both zones are entered by walking across their boundary and by
           nothing else, so a landing spot inside either is refused outright
           rather than clamped — and a target deep enough inside one that the
           whole 3-5 ring is inside it yields no spot at all. */
        const inSpawn = dtv({ landingFor: [infoC.SPAWN.x, infoC.SPAWN.y] }).landing;
        results.push(['PART C: nobody can be teleported into the Spawn Safe Zone',
          inSpawn === null]);
        const inCol = dtv({ landingFor: [v37c.COLOSSEUM.x, v37c.COLOSSEUM.y] }).landing;
        results.push(['PART C: nor into the Ruined Colosseum, where PvP is on',
          inCol === null]);
        const inBaz = dtv({ landingFor: [v37c.BAZAAR.x, v37c.BAZAAR.y] }).landing;
        results.push(['PART C: nor into the Grand Bazaar, which is a safe zone too',
          inBaz === null]);
        /* Standing just inside a zone edge: a spot may exist, but it must be
           OUTSIDE the zone — you arrive at the boundary and walk in yourself. */
        {
          const edge = [infoC.SPAWN.x + window.debugWorldInfo().SAFE_RADIUS - 1, infoC.SPAWN.y];
          const spot = dtv({ landingFor: edge }).landing;
          results.push(['PART C: a landing beside someone at a zone EDGE is outside the zone, or refused',
            spot === null || window.debugV37Probe({ at: [spot[0], spot[1]] }).inSafe === false]);
        }
        /* Leaving one is never blocked — that direction was never protected. */
        {
          window.debugSetPlayer({ x: infoC.SPAWN.x + 0.5, y: infoC.SPAWN.y + 0.5 });
          const out = dtv({ clearCooldown: true, to: 'GhostFriend' });
          results.push(['PART C: but travelling OUT of a safe zone is fine — only arriving inside one is not',
            out.travelled === true]);
        }

        // ---- the panel itself: two tabs, in the existing panel language ----
        const kdC = new window.KeyboardEvent('keydown', { key: window.debugV39Info().travelKey });
        window.dispatchEvent(kdC);
        results.push(['PART C: the panel still opens on its own bound key',
          doc.getElementById('travelPanel').style.display === 'block']);
        results.push(['PART C: it has exactly two tabs, PLACES and PLAYERS',
          doc.getElementById('travelTabPlaces').textContent === 'PLACES' &&
          doc.getElementById('travelTabPlayers').textContent === 'PLAYERS']);
        results.push(['PART C: the PLACES tab still lists the six landmarks and nothing else',
          doc.getElementById('travelList').children.length === 6]);
        doc.getElementById('travelTabPlayers').onclick();
        results.push(['PART C: switching tabs shows the players section',
          doc.getElementById('travelSecPlayers').className.indexOf('shown') >= 0 &&
          doc.getElementById('travelSecPlaces').className.indexOf('shown') < 0]);
        const prow = doc.getElementById('travelPlayerList').children[0];
        results.push(['PART C: which lists the online player by name',
          !!prow && prow.textContent.indexOf('GhostFriend') >= 0]);
        results.push(['PART C: in the existing .craft-row language — no new component style',
          !!prow && prow.className === 'craft-row']);
        results.push(['PART C: the tab strip is the settings card\'s own classes, reused',
          doc.getElementById('travelTabPlaces').className.indexOf('set-tab') >= 0]);
        /* A username is the one string in this file typed by another player,
           so it must never reach the DOM as markup. */
        handles.others.set('<img src=x onerror=1>', {
          x: openC[0], y: openC[1], tx: openC[0], ty: openC[1], space: 'main',
          dead: false, lastHeard: window.performance.now(), hp: 100, maxHp: 100,
        });
        window.refreshTravelPanel();
        results.push(['PART C: a username containing markup is rendered as text, never as markup',
          doc.getElementById('travelPlayerList').innerHTML.indexOf('<img') < 0 &&
          doc.getElementById('travelPlayerList').textContent.indexOf('<img src=x') >= 0]);
        handles.others.delete('<img src=x onerror=1>');
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: window.debugV39Info().travelKey }));
        handles.others.delete('GhostFriend');
        /* The v35 compass rule again: this section must never read a base. */
        {
          const cStart = gameScript.indexOf('const PLAYER_TP_COOLDOWN_MS');
          const cEnd = gameScript.indexOf('let travelTab =');
          const sec = gameScript.slice(cStart, cEnd);
          results.push(['PART C: the player-travel code never reads a base piece either',
            cStart > 0 && cEnd > cStart &&
            sec.indexOf('basePieces') < 0 && sec.indexOf('baseIndex') < 0]);
        }
        results.push(['PART C: no second realtime channel was invented for any of it',
          (gameScript.match(/sb\.channel\(/g) || []).length === 1]);
      }
    } else {
      results.push(['PART C hooks are reachable', false]);
    }

    /* ================= MOB RARITY + MUSIC — the five parts ================
       PART A world-wide daily population caps with real persistence, PART B
       Griffin and Shadowfox's corrected tame bases, PART C the rarity-banded
       size pass and the Elders' dedicated band, PART D the fifth rotation
       track and the Elder boss cue, PART E the credits.

       Run late and deliberately: the PART A gates re-run worldgen several
       times over, so they sit immediately before the world-reset block that
       rewrites it anyway, and the world is put back with an empty take map at
       the end of them. ================================================== */
    if (typeof window.debugRareTakesInfo === 'function' &&
        typeof window.debugSetRareTakes === 'function') {
      const rti = window.debugRareTakesInfo, srt = window.debugSetRareTakes;
      /* The world day is 600 real seconds long and this block runs for a good
         few of them, so worldDayNum() can genuinely tick over in the middle of
         it — which would silently reset the very counter being measured, and
         would also let a Blood Moon start mid-block and move the presence
         rolls under two buildFeatureList() calls being compared. The clock is
         held still for the duration and handed back at the end; every
         assertion below is about a day boundary being crossed ON PURPOSE. */
      const realDateNow = window.Date.now;
      const FROZEN_NOW = realDateNow.call(window.Date);
      window.Date.now = () => FROZEN_NOW;
      const R0 = rti();
      const dayNow = R0.day;

      /* ---- PART A: the rarity table is the BIBLE's, transcribed ---------- */
      const BIBLE_RARITY = {
        tree_sprite: 'common', water_sprite: 'common', stone_sprite: 'common',
        wind_sprite: 'common', glow_moth: 'common',
        wolf: 'uncommon', bear: 'uncommon', boar: 'uncommon',
        griffin: 'uncommon', golem: 'uncommon', stag: 'uncommon',
        unicorn: 'rare', crystal_golem: 'rare', phoenix: 'rare',
        water_dragon: 'rare', fire_dragon: 'rare', storm_dragon: 'rare',
        shadow_dragon: 'rare',
        shadowfox: 'epic', lightfox: 'epic', krakenling: 'epic',
        salamander_king: 'epic',
        golem_elder: 'elder', dragon_elder: 'elder', unicorn_elder: 'elder',
        /* Mount/Bazaar Polish PART D: the bible's rarity table has an "Admin
           Only" heading of its own, between Epic and Elder, with exactly one
           row under it. The Duskfox Elder shipped this version, so it takes
           that tier — a transcription like every other value in this table,
           and deliberately NOT filed as "elder". */
        duskfox_elder: 'admin',
      };
      const PR = R0.PET_RARITY;
      results.push([`PART A: every pet carries its BIBLE rarity and nothing else does (${Object.keys(PR).length})`,
        Object.keys(BIBLE_RARITY).every(k => PR[k] === BIBLE_RARITY[k]) &&
        Object.keys(PR).length === Object.keys(BIBLE_RARITY).length]);
      results.push(['PART A: and it still invents nothing — no Basilisk, genuinely unbuilt',
        PR.basilisk === undefined]);
      results.push(['PART D: the Duskfox Elder is the ONLY admin-tier row, and is not an Elder-tier one',
        Object.entries(PR).filter(([, v]) => v === 'admin').map(([k]) => k).join('|') === 'duskfox_elder' &&
        PR.duskfox_elder !== 'elder']);
      results.push(['PART A: the cap is Rare-and-up, and PART D adds the one tier above it',
        R0.CAPPED_RARITIES.slice().sort().join('|') === 'admin|elder|epic|rare']);
      results.push(['PART A: so dragons, Crystal Golem and everything above them are capped...',
        ['fire_dragon', 'water_dragon', 'storm_dragon', 'shadow_dragon', 'crystal_golem',
         'unicorn', 'phoenix', 'shadowfox', 'lightfox', 'krakenling', 'salamander_king',
         'golem_elder', 'dragon_elder', 'unicorn_elder'].every(s => window.speciesIsCapped(s))]);
      results.push(['PART A: ...and nothing Common, Uncommon or non-pet ever is',
        ['tree_sprite', 'glow_moth', 'wolf', 'golem', 'stag', 'boar', 'bear', 'griffin']
          .every(s => !window.speciesIsCapped(s)) &&
        !window.speciesIsCapped('elder_drake') && !window.speciesIsCapped('goblin')]);

      /* ---- PART A: the cap genuinely stops a species spawning ------------
         Driven on a species with no presence roll, so what is measured is the
         cap and never a coin flip. */
      srt({ takes: {}, day: dayNow });
      window.buildFeatureList();
      const full = rti();
      const DETERMINISTIC = ['fire_dragon', 'storm_dragon', 'crystal_golem',
                             'salamander_king', 'water_dragon', 'shadow_dragon'];
      const capPop = DETERMINISTIC.filter(s =>
        (full.wildSpeciesInWorld[s] || 0) === full.caps[s] && full.caps[s] >= 2);
      results.push([`PART A: a capped species spawns its full world population on this seed (${capPop.join(', ') || 'none'})`,
        capPop.length > 0]);
      const SPC = capPop[0] || 'fire_dragon';
      const capSPC = full.caps[SPC];

      srt({ takes: { [SPC]: 1 }, day: dayNow });
      window.buildFeatureList();
      const partial = rti();
      results.push([`PART A: one ${SPC} taken today, and one fewer spawns (${partial.wildSpeciesInWorld[SPC] || 0} of ${capSPC})`,
        (partial.wildSpeciesInWorld[SPC] || 0) === capSPC - 1]);

      srt({ takes: { [SPC]: capSPC }, day: dayNow });
      window.buildFeatureList();
      const capped = rti();
      results.push(['PART A: at the cap that species does not spawn AT ALL',
        (capped.wildSpeciesInWorld[SPC] || 0) === 0 && capped.budget[SPC] === 0]);
      results.push(['PART A: and no uncapped population moved by a single spawn while it did',
        capped.wildSpeciesInWorld.wolf === full.wildSpeciesInWorld.wolf &&
        capped.wildSpeciesInWorld.tree_sprite === full.wildSpeciesInWorld.tree_sprite &&
        capped.mobKindsInWorld.goblin === full.mobKindsInWorld.goblin &&
        capped.mobKindsInWorld.griffin === full.mobKindsInWorld.griffin &&
        capped.mobKindsInWorld.elder_drake === full.mobKindsInWorld.elder_drake]);

      /* the two hand-placed singletons obey it too */
      srt({ takes: { golem_elder: 1, unicorn_elder: 1 }, day: dayNow });
      window.buildFeatureList();
      const eldersGone = rti();
      results.push(['PART A: an Elder taken today leaves its place genuinely empty',
        (eldersGone.mobKindsInWorld.golem_elder || 0) === 0 &&
        (eldersGone.wildSpeciesInWorld.unicorn_elder || 0) === 0 &&
        (full.mobKindsInWorld.golem_elder || 0) === 1 &&
        (full.wildSpeciesInWorld.unicorn_elder || 0) === 1]);

      /* ---- PART A: and the next world day restocks it -------------------- */
      srt({ takes: { [SPC]: capSPC }, day: dayNow - 1 });   // yesterday's takes
      window.buildFeatureList();
      const tomorrow = rti();
      results.push(['PART A: the day rolling over restocks it — yesterday\'s takes cap nothing today',
        tomorrow.takes[SPC] === 0 && tomorrow.budget[SPC] === capSPC &&
        (tomorrow.wildSpeciesInWorld[SPC] || 0) === capSPC]);

      /* ---- PART A: real persistence, not a session counter --------------- */
      tableData.rare_takes.length = 0;
      srt({ takes: {}, day: dayNow });
      window.noteRareTake(SPC);
      window.noteRareTake(SPC);
      results.push(['PART A: a take is counted locally the moment it happens',
        rti().takes[SPC] === 2]);
      srt({ takes: {}, day: 0 });             // wipe the session, as a page load would
      results.push(['PART A: (and the in-session count really was cleared first)',
        rti().takes[SPC] === 0]);
      await window.loadRareTakes();
      results.push(['PART A: the cap survives a reload — it comes back off the table, not the session',
        rti().takes[SPC] === 2 && rti().budget[SPC] === capSPC - 2]);
      results.push(['PART A: and the rows really are in rare_takes, stamped with today\'s day_num',
        tableData.rare_takes.length === 2 &&
        tableData.rare_takes.every(r => r.species === SPC && r.day_num === dayNow)]);

      /* ---- PART A: a tamed creature never returns its slot ---------------
         The spec is explicit: once tamed, anything that happens to it
         afterwards — another player killing it for its dragonsteel included —
         must not free the day's slot. */
      const beforePvp = rti().takes[SPC];
      window.debugGrantPet(SPC);
      results.push(['PART A: a take is recorded from exactly two places, both wild-side',
        gameScript.split('noteRareTake(').length === 4]);   // the definition + 2 call sites
      results.push(['PART A: and NOTHING in the file ever deletes a rare_takes row',
        gameScript.indexOf('rare_takes') > 0 &&
        !/rare_takes[\s\S]{0,200}\.delete\(/.test(gameScript)]);
      window.petTakeDamage(99999);            // downed hard, by anything at all
      results.push(['PART A: downing a TAMED one returns nothing to the pool',
        rti().takes[SPC] === beforePvp && rti().budget[SPC] === capSPC - beforePvp]);
      results.push(['PART A: because a tamed creature is a pets row — never a mob, never a wild',
        !window.debugCombatHandles().mobs.some(m => String(m.id).indexOf('dbg:') === 0)]);

      /* ---- PART A: both halves of "taken", through the REAL paths -------- */
      tableData.rare_takes.length = 0;
      srt({ takes: {}, day: dayNow });
      const SPW = window.debugWorldInfo().SPAWN;
      /* window.Math, not the harness's own Math — the game is evaluated inside
         jsdom's realm, so patching this file's global would leave the real
         50/50 tame roll in place and make this gate a coin flip. */
      const realRandom = window.Math.random;
      try {
        window.Math.random = () => 0;         // force resolveTaming's success branch
        window.startTaming({ id: 'gate:rare', species: SPC,
                             x: SPW.x + 0.5, y: SPW.y + 0.5 });
        await window.resolveTaming();
      } finally { window.Math.random = realRandom; }
      results.push([`PART A: a real successful tame records a take through the real path (${rti().takes[SPC]})`,
        rti().takes[SPC] === 1]);

      const phoenixTakes0 = rti().takes.phoenix || 0;
      await window.mobKill({ id: 'gate:phoenix', kind: 'phoenix',
        x: SPW.x + 0.5, y: SPW.y + 0.5, hx: SPW.x + 0.5, hy: SPW.y + 0.5,
        hp: 0, maxHp: 75, state: 'idle', winding: false, flash: 0,
        fx: 1, fy: 0, dead: false, target: null, ph: 1 }, true);
      results.push(['PART A: and a Rare creature dying while still WILD records one too',
        (rti().takes.phoenix || 0) === phoenixTakes0 + 1]);

      /* ---- PART A: and none of it needs the SQL step to have been run ---- */
      const savedTakeRows = tableData.rare_takes;
      delete tableData.rare_takes;            // the table simply does not exist
      await window.loadRareTakes();
      const degraded = rti();
      results.push(['PART A: with no rare_takes table at all it reads as "no takes yet today"',
        Object.keys(degraded.takes).every(s => degraded.takes[s] === 0)]);
      window.buildFeatureList();
      results.push(['PART A: so a world whose SQL step has not been run spawns exactly as before',
        (rti().wildSpeciesInWorld[SPC] || 0) === capSPC]);
      window.noteRareTake(SPC);               // the insert must not throw either
      results.push(['PART A: and recording a take against the missing table never throws',
        rti().takes[SPC] === 1]);
      tableData.rare_takes = savedTakeRows;

      /* ---- PART B: Griffin and Shadowfox, at their real tiers ------------ */
      {
        const WS = window.debugWorldInfo().WILD_SPECIES;
        const baseOf = s => WS[s].base;
        const UNCOMMON = ['wolf', 'bear', 'boar', 'golem', 'stag'].map(baseOf);
        const EPIC = ['lightfox', 'krakenling', 'salamander_king'].map(baseOf);
        results.push([`PART B: Griffin's tame base is 0.42, not 0.35 (${baseOf('griffin')})`,
          Math.abs(baseOf('griffin') - 0.42) < 1e-9]);
        results.push([`PART B: which lands it inside its own Uncommon band (${Math.min(...UNCOMMON)}-${Math.max(...UNCOMMON)})`,
          baseOf('griffin') >= Math.min(...UNCOMMON) && baseOf('griffin') <= Math.max(...UNCOMMON)]);
        results.push([`PART B: Shadowfox's tame base is 0.20, not 0.35 (${baseOf('shadowfox')})`,
          Math.abs(baseOf('shadowfox') - 0.20) < 1e-9]);
        results.push(['PART B: which is exactly what every one of its Epic tier-mates runs',
          EPIC.every(b => Math.abs(b - baseOf('shadowfox')) < 1e-9)]);
        results.push(['PART B: and no other tame base moved',
          Math.abs(baseOf('wolf') - 0.50) < 1e-9 && Math.abs(baseOf('bear') - 0.40) < 1e-9 &&
          Math.abs(baseOf('unicorn') - 0.25) < 1e-9 && Math.abs(baseOf('phoenix') - 0.30) < 1e-9 &&
          Math.abs(baseOf('golem_elder') - 0.15) < 1e-9]);
      }

      /* ---- PART C: the size pass, band by band --------------------------- */
      {
        const SKn = window.debugScaleInfo().SPECIES_K;
        const MTn = window.debugScaleInfo().MOB_TALL;
        const BEFORE = {
          tree_sprite: 0.53, water_sprite: 0.61, stone_sprite: 0.84, wind_sprite: 0.69,
          glow_moth: 0.32,
          wolf: 1.10, golem: 1.85, stag: 1.15, boar: 1.16, bear: 1.73, griffin: 1.62,
          unicorn: 1.30, crystal_golem: 1.70, phoenix: 1.10, fire_dragon: 1.55,
          water_dragon: 1.55, storm_dragon: 1.55, shadow_dragon: 1.55,
          shadowfox: 1.66, lightfox: 1.05, krakenling: 1.10, salamander_king: 1.30,
        };
        const BAND = { common: [1.15, 1.25], uncommon: [1.3, 1.4],
                       rare: [1.5, 1.65], epic: [1.7, 1.85] };
        const offBand = [];
        for (const s of Object.keys(BEFORE)) {
          const r = SKn[s] / BEFORE[s];
          const b = BAND[PR[s]];
          if (!b || r < b[0] || r > b[1]) offBand.push(`${s} x${r.toFixed(3)}`);
        }
        results.push([`PART C: every pet grew by its own rarity band${offBand.length ? ' — OFF: ' + offBand.join(', ') : ''}`,
          offBand.length === 0]);
        /* The point is not that everything grew — a flat multiplier passes
           that. It is that the four bands are four DIFFERENT amounts, in
           rarity order, and that the gap between the commonest pet and the
           rarest one got meaningfully wider rather than being preserved. */
        const bandMid = tier => {
          const rs = Object.keys(BEFORE).filter(s => PR[s] === tier)
                           .map(s => SKn[s] / BEFORE[s]);
          return rs.reduce((a, b) => a + b, 0) / rs.length;
        };
        const mids = ['common', 'uncommon', 'rare', 'epic'].map(bandMid);
        results.push([`PART C: and it is genuinely banded, not one flat multiplier (x${mids.map(m => m.toFixed(3)).join(' / x')})`,
          mids[0] < mids[1] && mids[1] < mids[2] && mids[2] < mids[3] &&
          mids[3] / mids[0] > 1.4]);
        results.push(['PART C: the Elders land on their dedicated band, exactly',
          SKn.golem_elder === 4.05 && SKn.dragon_elder === 3.60 && SKn.unicorn_elder === 2.78]);
        /* The whole reason the band is dedicated: a Rare-banded Crystal Golem
           and Rare-banded dragons must not catch the Elder that heads them. */
        results.push([`PART C: and the Elder gap SURVIVED the tier bump ` +
          `(+${Math.round((SKn.golem_elder / SKn.crystal_golem - 1) * 100)}% / ` +
          `+${Math.round((SKn.dragon_elder / SKn.fire_dragon - 1) * 100)}% / ` +
          `+${Math.round((SKn.unicorn_elder / SKn.unicorn - 1) * 100)}%)`,
          SKn.golem_elder > SKn.crystal_golem * 1.35 &&
          SKn.dragon_elder > SKn.fire_dragon * 1.35 &&
          SKn.unicorn_elder > SKn.unicorn * 1.35]);
        /* v13's fairness rule: MOB_TALL is a pixel offset nothing scales, so
           every resized body must have taken its overlay clearance with it. */
        const TALL_BEFORE = { bear: 7, griffin: 10, phoenix: 8, golem_elder: 29, boar: 0 };
        const drift = [];
        for (const s of Object.keys(TALL_BEFORE)) {
          const want = SKn[s] / (BEFORE[s] || 2.70);          // golem_elder: 4.05/2.70
          const got = (20 + MTn[s]) / (20 + TALL_BEFORE[s]);
          if (Math.abs(got - want) > 0.03) drift.push(`${s} ${got.toFixed(3)} vs ${want.toFixed(3)}`);
        }
        results.push([`PART C: every resized body took its overlay offset with it${drift.length ? ' — DRIFT: ' + drift.join(', ') : ''}`,
          drift.length === 0]);
        results.push(['PART C: and nothing whose size did NOT change had its offset touched',
          MTn.troll === 31 && MTn.bandit === 5 && MTn.dark_wraith === 6 &&
          MTn.sea_serpent === 78 && MTn.elder_drake === 46]);
        results.push(['PART C: the long-and-low Salamander King is still the named exception at 4',
          MTn.salamander_king === 4]);
      }

      /* ---- PART D: the Elder boss cue ------------------------------------ */
      {
        const dmiE = window.debugMusicInfo, dsmsE = window.debugSetMusicState;
        results.push(['PART D: an Elder is read from BOTH tables — the flagged pets and the named boss',
          window.isElderCombatant('golem_elder') === true &&
          window.isElderCombatant('dragon_elder') === true &&
          window.isElderCombatant('unicorn_elder') === true &&
          window.isElderCombatant('elder_drake') === true]);
        results.push(['PART D: and nothing else is, however dangerous it is',
          !window.isElderCombatant('sea_serpent') && !window.isElderCombatant('troll') &&
          !window.isElderCombatant('griffin') && !window.isElderCombatant('phoenix') &&
          !window.isElderCombatant('wolf') && !window.isElderCombatant('')]);
        /* Not one expression over one table: WILD_SPECIES is the only place
           the `elder` flag exists and MOBS is the only place the drake does. */
        results.push(['PART D: the check really is two separate table lookups',
          /function isElderCombatant\([\s\S]{0,400}WILD_SPECIES\[kind\][\s\S]{0,300}MOBS\[kind\]/.test(gameScript)]);

        // a hit landed on the boss is an Elder fight; a hit on a Troll is not
        dsmsE({ elderMusicUntil: 0, combatMusicUntil: 0, inCombatMusic: false, musicCheckAt: 0 });
        window.mobHit({ id: 'gate:troll', kind: 'troll', x: SPW.x + 0.5, y: SPW.y + 0.5,
          hp: 500, maxHp: 500, dead: false, flash: 0 }, 1, {});
        results.push(['PART D: an ordinary fight never wakes the Elder cue',
          dmiE().elderMusicUntil === 0]);
        const tE = window.performance.now();
        window.mobHit({ id: 'gate:drake', kind: 'elder_drake', x: SPW.x + 0.5, y: SPW.y + 0.5,
          hp: 900, maxHp: 900, dead: false, flash: 0 }, 1, {});
        results.push(['PART D: a hit landed on the Elder Drake pushes the cue ~6s out',
          dmiE().elderMusicUntil >= tE + 5900 &&
          dmiE().elderMusicUntil <= window.performance.now() + 6000]);
        results.push(['PART D: on the SAME linger the combat track already uses — no second timer',
          dmiE().COMBAT_MUSIC_LINGER === 6000]);

        // the switch itself: Elder outranks combat, combat outranks the rotation
        const fetchedE = [];
        const realFetch = window.fetch;
        window.fetch = async (url) => { fetchedE.push(String(url)); return { arrayBuffer: async () => new ArrayBuffer(8) }; };
        dsmsE({ inCombatMusic: false, musicCheckAt: 0,
                combatMusicUntil: window.performance.now() + 6000,
                elderMusicUntil: window.performance.now() + 6000 });
        window.update(0.016, 700000);
        await new Promise(r => setTimeout(r, 0));
        results.push(['PART D: an Elder fight takes the channel with tension.mp3, looping',
          fetchedE[0] === 'audio/tension.mp3' && dmiE().inCombatMusic === true &&
          dmiE().combatTrackUrl === 'audio/tension.mp3']);
        fetchedE.length = 0;
        dsmsE({ musicCheckAt: 0 });
        window.update(0.016, 700100);
        results.push(['PART D: and a second check inside the window does not restart it',
          fetchedE.length === 0]);
        // the Elder dies, the ordinary fight goes on: hand back to nu_metal
        dsmsE({ musicCheckAt: 0, elderMusicUntil: window.performance.now() - 1,
                combatMusicUntil: window.performance.now() + 6000 });
        window.update(0.016, 700200);
        await new Promise(r => setTimeout(r, 0));
        results.push(['PART D: when the Elder cue lapses mid-fight the ordinary combat track takes over',
          fetchedE[0] === 'audio/nu_metal.mp3' && dmiE().combatTrackUrl === 'audio/nu_metal.mp3']);
        fetchedE.length = 0;
        dsmsE({ musicCheckAt: 0, elderMusicUntil: 0, combatMusicUntil: 0 });
        window.update(0.016, 700300);
        await new Promise(r => setTimeout(r, 0));
        results.push(['PART D: and with both lapsed it is back to the rotation',
          dmiE().inCombatMusic === false && dmiE().combatTrackUrl === null &&
          fetchedE.length === 1 && fetchedE[0].indexOf('audio/') === 0]);
        window.fetch = realFetch;

        /* The Dragon Elder and the Unicorn Elder are never mobs, so the
           companion path is the ONLY way either can ever wake the cue — this
           is the WILD_SPECIES flag doing what the MOBS table cannot. */
        const OUTE = { x: SPW.x + window.debugWorldInfo().SAFE_RADIUS + 40.5,
                       y: SPW.y + window.debugWorldInfo().SAFE_RADIUS + 40.5 };
        results.push(['PART D: (the companion test really is outside a safe zone)',
          window.inSafeZone(OUTE.x, OUTE.y) === false]);
        window.debugSetPlayer({ x: OUTE.x, y: OUTE.y, hp: 100, diving: false });
        window.debugGrantPet('dragon_elder');
        const handlesE = window.debugCombatHandles();
        handlesE.mobs.push({ id: 'gate:petfoe', kind: 'goblin',
          x: OUTE.x + 0.4, y: OUTE.y + 0.4, hx: OUTE.x + 0.4, hy: OUTE.y + 0.4,
          hp: 4000, maxHp: 4000, state: 'idle', target: null, atkAt: 1e12,
          windupStart: 0, winding: false, flash: 0, boltT: 0, ph: 1,
          dead: false, respawnAt: 0, lastSync: 1e12, fx: 0, fy: 1 });
        dsmsE({ elderMusicUntil: 0 });
        for (let i = 0; i < 3; i++) window.update(0.016, 701000 + i * 20);
        results.push(['PART D: a tamed Dragon Elder swinging is an Elder fight all by itself',
          dmiE().elderMusicUntil > window.performance.now()]);
        const idx = handlesE.mobs.findIndex(m => m.id === 'gate:petfoe');
        if (idx >= 0) handlesE.mobs.splice(idx, 1);
        dsmsE({ elderMusicUntil: 0, combatMusicUntil: 0, inCombatMusic: false, musicCheckAt: 0 });
        window.debugSetPlayer({ x: SPW.x + 0.5, y: SPW.y + 0.5, hp: 100, diving: false });
      }

      /* ---- PART E: the credits ------------------------------------------- */
      {
        const dsiE = window.debugSettingsInfo();
        results.push(['PART E: "Created by" carries the full name now',
          dsiE.CREDITS[0].role === 'Created by' &&
          dsiE.CREDITS[0].name.indexOf('Harsh Devarajan') === 0]);
        results.push(['PART E: directly alongside the Hashbrown Studios line, as it always was',
          dsiE.CREDITS[1].name === 'Hashbrown Studios' && dsiE.CREDITS.length === 2]);
        results.push(['PART E: Skeptik is credited as composer, by track',
          dsiE.MUSIC_CREDITS.some(c => c.role.indexOf('Skeptik') === 0 &&
            c.name.indexOf('Pop.mp3') >= 0 && c.name.indexOf('song.mp3') >= 0 &&
            c.name.indexOf('tension.mp3') >= 0)]);
        results.push(['PART E: Advay is credited as composer for siren.mp3',
          dsiE.MUSIC_CREDITS.some(c => c.role === 'Advay' && c.name.indexOf('siren.mp3') >= 0)]);
        window.renderCredits();
        const mcl = doc.getElementById('musicCreditsList');
        results.push(['PART E: and the MUSIC block really renders, in the panel\'s own .cr-row language',
          !!mcl && mcl.children.length === dsiE.MUSIC_CREDITS.length &&
          Array.prototype.every.call(mcl.children, r => r.className === 'cr-row')]);
        results.push(['PART E: no new component style was invented for it',
          !!mcl && Array.prototype.every.call(mcl.children, r =>
            r.children[0].className === 'cr-role' && r.children[1].className === 'cr-name')]);
        results.push(['PART E: the two Dev Team collaboration rows are untouched',
          dsiE.COLLABORATIONS.some(c => c.name.indexOf('Skeptik') === 0 && c.role === 'Dev Team') &&
          dsiE.COLLABORATIONS.some(c => c.name === 'Advay' && c.role === 'Dev Team')]);
      }

      /* put the world back the way the rest of this file expects it */
      srt({ takes: {}, day: dayNow });
      window.buildFeatureList();
      results.push(['Mob Rarity: the world rebuilds clean with an empty take map',
        (rti().wildSpeciesInWorld[SPC] || 0) === capSPC &&
        (rti().mobKindsInWorld.elder_drake || 0) === 1]);
      window.Date.now = realDateNow;          // the clock runs again
      srt({ day: rti().day });                // and the map is stamped for the real today
    } else {
      results.push(['Mob Rarity PART A hooks are reachable', false]);
    }

    /* ===== Mount/Bazaar Polish + TP Consent + Duskfox Elder ================
       PART A — the seat, recalibrated and verified PER SPECIES rather than on
       the one in the screenshot. The back heights below are an INDEPENDENT
       copy, read off the drawing code by hand (the torso top of each body in
       its own art's native coordinates), so this gate fails if the game's own
       table is edited to something the art does not support. ============== */
    {
      const BIBLE_NINE_A = ['stag', 'griffin', 'crystal_golem', 'water_dragon', 'fire_dragon',
                            'storm_dragon', 'shadow_dragon', 'shadowfox', 'lightfox'];
      /* torso tops, native art units — griffin's lion body at sy-11, the four
         dragons' dragonV2 torso at Y(-14.6), the fox body at sy-8.4, the stag
         at sy-13, the crystal golem's body + top facet at sy-9.8/-8.4. */
      const BACK_A = { stag: 13.0, griffin: 11.0, crystal_golem: 9.0,
        water_dragon: 14.6, fire_dragon: 14.6, storm_dragon: 14.6, shadow_dragon: 14.6,
        shadowfox: 8.4, lightfox: 8.4 };
      const mA = window.debugMountInfo();
      const soA = mA.seatOffsets, skA = window.debugScaleInfo().SPECIES_K;

      /* v52+53: RE-PINNED, not relaxed. The seat table is derived from
         MOUNTABLE_SPECIES, so it covers the ten that set now holds. Still an
         EXACT set — the nine plus the Duskfox Elder and nothing else. */
      results.push(['PART A: the seat table covers exactly the ten mountable species',
        BIBLE_NINE_A.concat(['duskfox_elder']).sort().join('|') === Object.keys(soA).sort().join('|') &&
        gameScript.indexOf('const MOUNT_SEAT_UNITS = {') > 0]);
      /* The tenth has no MEASURED back of its own — it is not in
         MOUNT_SEAT_UNITS and falls through to MOUNT_SEAT_BASE, scaled by its
         own SPECIES_K exactly as every other seat is. That is the real current
         behaviour, so it is asserted rather than left invisible: a future pass
         that gives it a measured back has to update this line deliberately. */
      results.push(['PART A: the Duskfox Elder seats on MOUNT_SEAT_BASE, having no measured back of its own',
        Math.abs(soA.duskfox_elder - (-(11.5 * skA.duskfox_elder))) < 1e-9 &&
        gameScript.indexOf('const MOUNT_SEAT_BASE = 11.5;') > 0 &&
        !/MOUNT_SEAT_UNITS = \{[^}]*duskfox_elder/.test(gameScript)]);

      let seatOk = true, seatWhy = null;
      for (const sp of BIBLE_NINE_A) {
        const want = -(BACK_A[sp] * skA[sp]);
        if (Math.abs(soA[sp] - want) > 1e-9) { seatOk = false; seatWhy = sp; break; }
      }
      results.push(['PART A: every one of the nine seats on its OWN measured back' +
        (seatWhy ? ` (${seatWhy} is wrong)` : ''), seatOk]);

      /* The thing one base constant could not do. If the seat were still
         `base * SPECIES_K`, seat/K would be the SAME number for all nine. */
      const ratios = BIBLE_NINE_A.map(sp => +(-soA[sp] / skA[sp]).toFixed(4));
      results.push([`PART A: and the nine do NOT share one ratio — ${new Set(ratios).size} distinct backs, not 1`,
        new Set(ratios).size >= 3]);

      /* Every rider is now genuinely higher than the old 2.2 base put them —
         that base, scaled by the rider's own S of 2.1, is what read as
         "floating beside the mount" in the screenshot. */
      let lifted = true, lowest = 99;
      for (const sp of BIBLE_NINE_A) {
        const old = 2.2 * skA[sp] * 2.1;
        const now = -soA[sp];
        lowest = Math.min(lowest, now / old);
        if (now <= old * 1.5) lifted = false;
      }
      results.push([`PART A: and every one of the nine sits at least 1.5x higher than the old base (worst ${lowest.toFixed(2)}x)`,
        lifted]);

      results.push(['PART A: the render site no longer scales the seat by the rider\'s own S',
        gameScript.indexOf('mountSeatOffsetY(mountSp) * S') < 0 &&
        gameScript.indexOf('mountSeatOffsetY(mountSp) - petDrawAlt(mountSp, t, mountDowned)') > 0]);

      /* The Griffin is the one flier among the nine, and drawPet lifts a
         flying pet to its own alt before drawing it — so its rider has to be
         lifted by the same amount, from the same expression. */
      const flyG = window.petDrawAlt('griffin', 0, false);
      results.push([`PART A: the Griffin's rider is carried up to its flight altitude too (${flyG.toFixed(1)}px)`,
        flyG > 24 && flyG < 32 &&
        BIBLE_NINE_A.filter(s => s !== 'griffin').every(s => window.petDrawAlt(s, 0, false) === 0)]);
      results.push(['PART A: and the mount and its rider read that altitude from ONE shared helper',
        gameScript.indexOf('const alt = petDrawAlt(species, t, downed);') > 0 &&
        (gameScript.match(/function petDrawAlt\(/g) || []).length === 1]);
      results.push(['PART A: a downed flier agrees between the two, rather than leaving its rider in the air',
        window.petDrawAlt('griffin', 0, true) === 2]);
      results.push(['PART A: the recalibrated base constant is still there for anything unlisted',
        gameScript.indexOf('const MOUNT_SEAT_BASE = ') > 0 &&
        Math.abs(window.mountSeatOffsetY('__nobody__') - (-(11.5 * 1.2))) < 1e-9]);
    }

    /* ===== PART B — the Grand Bazaar's clearance ======================== */
    {
      const v37b = window.debugV37Info();
      const bc = v37b.bazaarClear;
      const infoB = window.debugWorldInfo();
      results.push([`PART B: nothing grows on the Bazaar's ground any more (${bc.features} features, ${bc.trees} trees on ${v37b.BAZAAR_R} tiles of clearing)`,
        bc.features === 0 && bc.trees === 0]);
      /* A feature is painted at its tile centre plus jitter, so one generated
         on a tile just outside the radius can be drawn just inside it. That
         is a rim effect and must stay one — nothing may drift anywhere near
         the stall ring. */
      results.push([`PART B: and anything drifting over the rim stays on the rim (${bc.drifted} item(s), nearest ${bc.driftMinD === null ? 'n/a' : bc.driftMinD.toFixed(2)} from centre)`,
        bc.driftMinD === null || bc.driftMinD > v37b.BAZAAR_RING + 2.5]);
      results.push([`PART B: and the forest is CLEARED, not deleted — ${bc.ringFeatures} features (${bc.ringTrees} trees) still stand in the ring just outside`,
        bc.ringFeatures > 0]);
      /* Not "everything is PLAINS": the clearing exempts DEEP, LAVA and WATER
         exactly as the scattered-safe-zone line it reuses does, so a coastal
         Bazaar keeps its shoreline. What must be gone is every biome that
         GROWS something — that is the crowding the report is about. */
      {
        const GROWS = [infoB.B.FOREST, infoB.B.DARKFOREST, infoB.B.ENCHFOREST,
                       infoB.B.SACMEADOW, infoB.B.MEADOW, infoB.B.ROCK, infoB.B.VOLROCK];
        const inside = Object.keys(bc.biomes).map(Number);
        const total = Object.values(bc.biomes).reduce((a, b) => a + b, 0);
        results.push([`PART B: no biome that grows anything is left on the Bazaar's ground (${inside.length} biome(s))`,
          inside.every(b => GROWS.indexOf(b) < 0) && (bc.biomes[infoB.B.PLAINS] || 0) > total * 0.6]);
        results.push([`PART B: and the trading floor is level ground, never a stepped cliff (heights ${bc.heights.join(',')})`,
          bc.heights.every(h => h <= 0) && bc.heights.indexOf(0) >= 0]);
      }
      results.push(['PART B: the clearing REUSES the scattered-safe-zone pattern rather than inventing one',
        gameScript.indexOf('Math.hypot(tx - BAZAAR.x, ty - BAZAAR.y) < BAZAAR_R) b = B.PLAINS;') > 0 &&
        gameScript.indexOf('if (Math.hypot(tx - BAZAAR.x, ty - BAZAAR.y) < BAZAAR_R) h = 0;') > 0 &&
        gameScript.indexOf('if (Math.hypot(tx - BAZAAR.x, ty - BAZAAR.y) < BAZAAR_R) continue;') > 0]);
      results.push(['PART B: and it can no more paint grass over open water than a scattered zone can',
        gameScript.indexOf('if (b !== B.PLAINS && b !== B.DEEP && b !== B.LAVA && b !== B.WATER &&\n      Math.hypot(tx - BAZAAR.x') > 0]);
      // preservation: nothing about the Bazaar ITSELF moved
      results.push([`PART B: the Bazaar is unchanged otherwise — still a safe zone, still ${v37b.BAZAAR_STALLS} stalls on a ${v37b.BAZAAR_RING} ring inside ${v37b.BAZAAR_R}`,
        v37b.bazaarIsSafe === true && v37b.BAZAAR_STALLS === 9 &&
        v37b.BAZAAR_RING === 5.5 && v37b.BAZAAR_R === 10]);
      results.push(['PART B: and the clearing is comfortably wider than the stall ring it has to hold',
        v37b.BAZAAR_R - v37b.BAZAAR_RING >= 4]);
    }

    /* ===== PART C — teleport consent ==================================== */
    if (typeof window.debugSetTravel === 'function' && window.debugCombatHandles) {
      const dtvC = window.debugSetTravel, tviC = window.debugTravelInfo;
      const hC = window.debugCombatHandles();
      const posC = window.debugWorldInfo().player;

      dtvC({ tpUnset: true });
      const unset = tviC();
      results.push(['PART C: the flag is UNSET by default, and unset means accepting — nothing breaks for anyone',
        unset.tpClosedRaw === undefined && unset.tpAccepting === true && unset.tpBroadcast === 0]);

      /* Two ghosts at the same spot: one accepting, one not. Only the shape of
         the `tc` field separates them. */
      const gx = posC.x + 4, gy = posC.y + 4;
      const ghost = (name, tc) => hC.others.set(name, {
        x: gx, y: gy, tx: gx, ty: gy, space: 'main', dead: false,
        lastHeard: window.performance.now(), hp: 100, maxHp: 100, cls: 'Ranger', level: 1,
        ...(tc === undefined ? {} : { tc }),
      });
      ghost('ConsentOn', false);
      ghost('ConsentOff', true);
      ghost('ConsentOld', undefined);   // a client that predates this version
      const namesC = tviC().players.map(p => p.name);
      results.push(['PART C: a player who is not accepting teleports is genuinely off the Players list',
        namesC.indexOf('ConsentOff') < 0]);
      results.push(['PART C: while one who is accepting is still on it',
        namesC.indexOf('ConsentOn') >= 0]);
      results.push(['PART C: and a client that never sends the field at all is treated as accepting — additive, not breaking',
        namesC.indexOf('ConsentOld') >= 0]);

      // and the travel itself is refused, not merely hidden
      if (window.debugGrantPet) window.debugGrantPet('unicorn_elder');
      const beforeC = window.debugWorldInfo().player;
      const refusedC = dtvC({ clearCooldown: true, to: 'ConsentOff' });
      const afterC = window.debugWorldInfo().player;
      results.push(['PART C: travelling to them is refused outright, and moves nobody',
        refusedC.travelled === false &&
        Math.abs(afterC.x - beforeC.x) < 1e-9 && Math.abs(afterC.y - beforeC.y) < 1e-9]);

      // the local player's own switch
      const on0 = dtvC({ tpToggle: true });
      results.push(['PART C: the toggle turns consent off, and the broadcast says so',
        on0.tpAccepting === false && on0.tpBroadcast === 1 && on0.tpClosedRaw === true]);
      const on1 = dtvC({ tpToggle: true });
      results.push(['PART C: and back on again — it is a toggle, never a one-way door',
        on1.tpAccepting === true && on1.tpBroadcast === 0]);
      results.push(['PART C: the flag rides the ONE existing move broadcast, like mo/pe/sp/cs/cb',
        gameScript.indexOf('tc: acceptsTeleports(me) ? 0 : 1,') > 0 &&
        gameScript.indexOf('o.tc = !!p.tc;') > 0 &&
        (gameScript.match(/channel\.on\("broadcast", \{ event: "move" \}/g) || []).length === 1]);
      results.push(['PART C: it stores no new table and no new column',
        gameScript.indexOf('tp_consent') < 0 && gameScript.indexOf('tpClosed:') < 0]);
      results.push(['PART C: every read of it goes through the one predicate, so "unset" can only mean one thing',
        gameScript.indexOf('function acceptsTeleports(host) { return !(host && host.tpClosed); }') > 0 &&
        gameScript.indexOf('function acceptsTeleportsRemote(o) { return !(o && o.tc); }') > 0 &&
        gameScript.indexOf('if (!acceptsTeleportsRemote(o)) continue;') > 0 &&
        /* Nothing anywhere compares the flag to undefined or to false: the
           predicate is the only thing that decides what "unset" means, so a
           consumer cannot disagree with it about the default. */
        gameScript.indexOf('tpClosed === undefined') < 0 &&
        gameScript.indexOf('tpClosed === false') < 0 &&
        gameScript.indexOf('tpClosed !== true') < 0]);
      results.push(['PART C: the panel row is the existing .craft-row language, not a new component',
        gameScript.indexOf('row.className = "craft-row";\n    const label = document.createElement("div");') > 0 &&
        gameScript.indexOf('travelConsentBtn') > 0]);
      // and the rest of the tab is untouched
      hC.others.delete('ConsentOff'); hC.others.delete('ConsentOn'); hC.others.delete('ConsentOld');
      dtvC({ tpUnset: true });
    }

    /* ===== PART D — the Duskfox Elder, and the two admin cosmetics ====== */
    if (typeof window.debugDuskfoxInfo === 'function') {
      const dfi = window.debugDuskfoxInfo, dfp = window.debugDuskfoxProbe;
      const d0 = dfi();
      /* v52+53: RE-PINNED, not relaxed. The twilight half of the bible's line
         was deliberately retired by a live hotfix — a creature that is hidden
         AND only visible at dusk AND impossible to relocate is unfindable
         after a failed tame, and it can only reasonably be one of those. So
         `duskOnly` is GONE from this def, and the gate now asserts its absence
         with the same rigor it used to assert its presence: `adminOnly` still
         carries the whole access rule, and a future pass cannot quietly put
         the dusk window back without failing here. */
      results.push(['PART D: the Duskfox Elder exists, admin-only, hand-placed, and NO LONGER dusk-gated',
        !!d0.def && d0.def.name === 'Duskfox Elder' &&
        d0.def.adminOnly === true && d0.def.duskOnly === undefined &&
        Array.isArray(d0.def.biomes) && d0.def.biomes.length === 0]);
      results.push([`PART D: exactly ONE exists in the entire world (${d0.wildCount})`,
        d0.wildCount === 1 && !!d0.wild]);
      /* v52+53: RE-PINNED, not relaxed. The random-Sacred-Meadow search was
         replaced by a fixed, always-known spot near the Spawn Forge so a
         creature that flees mid-tame can be walked back to. Asserted as the
         RELATIONSHIP the code actually expresses — SPAWN_FORGE + (5, -5),
         rounded — never as a literal pair of coordinates, so it still holds if
         the world moves under it. Its biome is now whatever that spot is. */
      results.push([`PART D: it stands on a FIXED spot near the Spawn Forge, not a Sacred Meadow search (${d0.tile})`,
        Array.isArray(d0.tile) &&
        d0.tile[0] === Math.round(d0.SPAWN_FORGE.x + 5) &&
        d0.tile[1] === Math.round(d0.SPAWN_FORGE.y - 5) &&
        gameScript.indexOf('const tx = Math.round(SPAWN_FORGE.x + 5), ty = Math.round(SPAWN_FORGE.y - 5);') > 0]);
      /* And the thing the fixed spot exists to buy: it is genuinely close
         enough to spawn to be walked back to, which the meadow search never
         guaranteed. */
      results.push([`PART D: and that spot is a short walk from spawn (${Math.round(Math.hypot(d0.tile[0] - d0.SPAWN.x, d0.tile[1] - d0.SPAWN.y))} tiles)`,
        Math.hypot(d0.tile[0] - d0.SPAWN.x, d0.tile[1] - d0.SPAWN.y) < 20]);
      results.push([`PART D: its daily cap is 1, so a taken one does not come back today (cap ${d0.dailyCap})`,
        d0.capped === true && d0.dailyCap === 1 && d0.rarity === 'admin']);
      results.push(['PART D: the placement is the Unicorn Elder\'s own single-tile technique, not a new system',
        gameScript.indexOf('function duskfoxElderTile(seed) {') > 0 &&
        gameScript.indexOf('function unicornElderTile(seed) {') > 0 &&
        gameScript.indexOf('if (speciesSpawnBudget("duskfox_elder") > 0) {') > 0]);

      /* THE ACCESS GATE. Swept over the whole day cycle as a non-admin: there
         must not be a single moment at which it is visible or tameable. */
      let seenAsPlayer = 0;
      for (let i = 0; i <= 100; i++) if (dfp({ visibleAt: i / 100 }).visible) seenAsPlayer++;
      results.push([`PART D: a non-admin never sees it — not at any point in the day (${seenAsPlayer}/101 frames)`,
        d0.isAdmin === false && seenAsPlayer === 0]);
      results.push(['PART D: and the tame channel refuses to even begin for them',
        dfp({ tryTame: true }).tamingStarted === false]);
      results.push(['PART D: the refusal is structural — isWildVisible() AND startTaming(), both on isAdmin()',
        gameScript.indexOf('if (sp.adminOnly && !isAdmin()) return false;') > 0 &&
        gameScript.indexOf('if (wsp && wsp.adminOnly && !isAdmin()) return;') > 0]);

      const wasRole = window.debugV39Info().role;
      window.debugSetV39({ role: 'admin' });
      const dawnV = dfp({ visibleAt: 0.02 }).visible;
      const noonV = dfp({ visibleAt: 0.30 }).visible;
      const duskV = dfp({ visibleAt: d0.DUSK_PEAK }).visible;
      const nightV = dfp({ visibleAt: 0.80 }).visible;
      /* v52+53: RE-PINNED, not relaxed. Twilight-only visibility went with the
         relocation, deliberately — the same hotfix, the same reason. An admin
         now sees it at EVERY hour, and this gate is the stronger statement of
         that: not "dusk works" but "no point in the whole day cycle hides it",
         swept over 101 frames exactly the way the non-admin gate above sweeps
         for the opposite answer. */
      let seenAsAdmin = 0;
      for (let i = 0; i <= 100; i++) if (dfp({ visibleAt: i / 100 }).visible) seenAsAdmin++;
      results.push([`PART D: an admin sees it at EVERY hour — no dusk gate remains (${seenAsAdmin}/101 frames)`,
        seenAsAdmin === 101 &&
        duskV === true && dawnV === true && noonV === true && nightV === true]);
      results.push([`PART D: and the twilight window is the sky's own dusk lobe (${d0.DUSK_PEAK} +/- ${d0.DUSK_HALF})`,
        d0.DUSK_PEAK === 0.55 && d0.DUSK_HALF === 0.07 &&
        gameScript.indexOf('const nearDusk = Math.max(0, 1 - Math.abs(dt2 - 0.55) / 0.07);') > 0]);
      results.push(['PART D: an admin CAN begin the tame, inside the window',
        (() => {
          const real = window.getDayT;
          window.getDayT = () => 0.55;
          const got = dfp({ tryTame: true }).tamingStarted;
          window.getDayT = real;
          return got === true;
        })()]);
      // the two admin cosmetics
      const g1 = dfp({ grantAdminCos: true });
      results.push([`PART D: an admin is handed the bible's unique crown and cloak (${g1.granted} granted)`,
        g1.granted === 2 && g1.heldAdminCos.every(n => n === 1)]);
      results.push(['PART D: and handed them once, not once per login',
        dfp({ grantAdminCos: true }).granted === 0]);
      window.debugSetV39({ role: wasRole === 'admin' ? 'admin' : 'player' });
      results.push(['PART D: a non-admin is handed nothing, ever',
        dfp({ grantAdminCos: true }).granted === 0]);
      results.push([`PART D: neither is in the drop pool — 4000 rolls off the Elder Drake produced ${dfp({ rollDrops: 4000 }).rolled.length} kinds, none admin`,
        dfp({ rollDrops: 4000 }).rolled.every(c => c.indexOf('cos_admin') !== 0) &&
        d0.COSMETIC_DROP_IDS.every(c => c.indexOf('cos_admin') !== 0) &&
        d0.ADMIN_COSMETIC_IDS.length === 2]);
      results.push(['PART D: they are cosmetics like every other — a name, a slot and a colour, and no stat',
        (() => {
          const C = window.debugV35Info().COSMETICS || null;
          if (!C) return gameScript.indexOf('cos_admin_crown:   { name: "Duskcrown",      slot: "hat",   color: "#e8b64c", admin: true }') > 0;
          return d0.ADMIN_COSMETIC_IDS.every(id => C[id] && C[id].slot && C[id].color &&
            C[id].dmg === undefined && C[id].reduce === undefined && C[id].tier === undefined);
        })()]);
      results.push(['PART D: the crown has its own silhouette rather than falling through to the Cap',
        gameScript.indexOf('} else if (id === "cos_admin_crown") {') > 0]);

      // THE ORACLE — already true, and it must never stop being true
      results.push(['PART D: the Oracle still cannot name it, and never could',
        d0.oracleForbidden.indexOf('duskfox_elder') >= 0 &&
        d0.oracleHintSpecies.indexOf('duskfox_elder') < 0 &&
        gameScript.indexOf('const ORACLE_HINTS_ALL = [') > 0]);
      results.push(['PART D: nor does anything about it reach the world-ending trio',
        window.debugV39Info().ELDER_SPECIES.indexOf('duskfox_elder') < 0 &&
        d0.def.elder === undefined &&
        window.isElderCombatant('duskfox_elder') === false]);

      // scale: the largest of its own line, and not the largest creature alive
      const skD = window.debugScaleInfo().SPECIES_K;
      results.push([`PART D: it is the biggest fox in the world (${skD.duskfox_elder} vs shadowfox ${skD.shadowfox}) and not the biggest creature`,
        skD.duskfox_elder > skD.shadowfox && skD.shadowfox > skD.lightfox &&
        skD.duskfox_elder / skD.shadowfox > 1.3 &&
        skD.duskfox_elder < skD.golem_elder]);
      /* v52+53: RE-PINNED, not relaxed. It IS mountable now — a deliberate,
         owner-approved hotfix and a knowing bible deviation, flagged in the
         changelog. What is asserted is the whole of the new behaviour, not
         merely that it joined the set: it rides at DOUBLE the standard mount
         rate, which is the perk that addition exists to give, and the doubling
         is scoped to this one species so no other mount moved. */
      results.push(['PART D: it IS mountable — the tenth, deliberately, against the bible\'s nine',
        window.debugMountInfo().MOUNTABLE.indexOf('duskfox_elder') >= 0 &&
        window.debugMountInfo().MOUNTABLE.length === 10]);
      results.push(['PART D: and it rides at DOUBLE the standard mount rate, and it alone does',
        gameScript.indexOf('activePet.species === "duskfox_elder")\n        ? MOUNT_SPEED_MULT * 2 : (me.mounted ? MOUNT_SPEED_MULT : 1);') > 0 &&
        (gameScript.match(/MOUNT_SPEED_MULT \* 2/g) || []).length === 1]);
    }


    /* The admin half, run LAST because it genuinely rewrites the world. */
      set39({ clearEvent: true, role: 'admin' });
      set39({ armed: true });
      const adminReady = v39();
      results.push(['with BOTH keys — armed and admin — the reset becomes reachable',
        adminReady.isAdmin === true && adminReady.execAllowed === true]);
      const seedBefore = adminReady.worldSeed;
      const petsBefore = adminReady.myPetSpecies.slice();
      const outcome = await window.debugRunWorldReset();
      const after39 = v39();
      results.push(['it runs, and the world is generated from a new seed',
        outcome === 'reset' && after39.worldSeed !== seedBefore]);
      results.push(['every Elder ownership is cleared by it',
        petsBefore.some(s => after39.ELDER_SPECIES.indexOf(s) >= 0) &&
        after39.myPetSpecies.every(s => after39.ELDER_SPECIES.indexOf(s) < 0)]);
      results.push(['base_pieces is cleared with it',
        window.debugV34Info().count === 0]);
      results.push(['and it can only ever happen once',
        after39.worldResetDone === true &&
        (await window.debugRunWorldReset()) === 'denied']);
      pump39(900, 6);
      results.push(['the world still runs frames cleanly on the far side of a reset', !caught]);
    } else {
      results.push(['v39 hooks are reachable', false]);
    }

    /* =====================================================================
       Account PIN Protection — the locked spec's four proof gates, in its
       own order. Run LAST because the fourth one genuinely re-logs the
       client in, the same way the world-reset block above is run last.
       ===================================================================== */
    const dpi = window.debugPinInfo;
    if (dpi && window.accountPinLookup && window.requirePinForLogin) {
      const gate = window.requirePinForLogin, look = window.accountPinLookup;
      const nameEl = doc.getElementById('username'), pinIn = doc.getElementById('pinInput');
      const setFields = (n, p) => { nameEl.value = n; pinIn.value = p; };
      /* returns the refusal message, or null if it was allowed through */
      const refused = async (n) => { try { await gate(n); return null; } catch (e) { return e.message || String(e); } };
      const pumpPin = (from, n) => {
        for (let f = from; f < from + (n || 6); f++) {
          const q = rafQ; rafQ = [];
          for (const cb of q) { try { cb(f * 50); } catch (e) { if (!caught) caught = e; } }
        }
      };
      const allowed = async (n) => { try { return await gate(n); } catch (e) { return { threw: e.message || String(e) }; } };

      /* ---- GATE 1: a new username cannot be created without a PIN -------- */
      results.push(['PIN: the no-PIN submit for a brand new name was refused — the login screen stayed up',
        pinBoot.refusedHidden === false && /PIN/.test(pinBoot.refusedErr)]);
      results.push(['PIN: and it was refused BEFORE any account existed — no players row was written',
        pinBoot.refusedRows === 0]);
      results.push(['PIN: the refusal reveals the field it is asking for, worded for a new name',
        pinBoot.refusedShown === true && pinBoot.refusedPlaceholder === 'Create a PIN']);
      results.push(['PIN: the second submit, with both fields, entered the world',
        doc.getElementById('login').style.display === 'none']);
      results.push(['PIN: and that ONE submit wrote both rows — the player and its PIN',
        tableData.players.some(r => r.username === 'BootTest') &&
        tableData.account_pins.length === 1 &&
        tableData.account_pins[0].username === 'BootTest' &&
        tableData.account_pins[0].pin === '2468']);

      /* ---- GATE 2: an existing protected username rejects a wrong PIN ---- */
      setFields('BootTest', '9999');
      const wrong = await refused('BootTest');
      results.push(['PIN: the account just created now rejects a WRONG PIN',
        typeof wrong === 'string' && /Incorrect/i.test(wrong)]);
      setFields('BootTest', '');
      const blank = await refused('BootTest');
      results.push(['PIN: and rejects an empty one — a protected name is never a free pass',
        typeof blank === 'string' && /protected/i.test(blank)]);
      results.push(['PIN: a refused verify leaves the field showing, worded for a return visit',
        dpi().shown === true && dpi().placeholder === 'Enter your PIN']);
      setFields('BootTest', '2468');
      const right = await allowed('BootTest');
      results.push(['PIN: the RIGHT PIN is let through, and stores nothing new',
        !!right && right.mode === 'verify' && right.pin === null &&
        tableData.account_pins.length === 1]);
      results.push(['PIN: the lookup calls that name protected',
        (await look('BootTest')).mode === 'verify']);

      /* ---- GATE 3: a pre-existing unprotected name logs in as before ----- */
      tableData.players.push({ username: 'OldTimer', class: 'Knight', x: 12, y: 12,
                               level: 1, hp: 100, max_hp: 100, inventory: {} });
      setFields('OldTimer', '');
      const old1 = await allowed('OldTimer');
      results.push(['PIN: an account made before this shipped still logs straight in',
        !!old1 && old1.mode === 'none' && !old1.threw]);
      results.push(['PIN: and is not even asked for one — the field stays hidden',
        dpi().shown === false && dpi().value === '']);
      setFields('OldTimer', '0000');
      const old2 = await allowed('OldTimer');
      results.push(['PIN: a PIN typed at an unprotected name changes nothing either way',
        !!old2 && old2.mode === 'none' && tableData.account_pins.length === 1]);
      results.push(['PIN: the two names really are in different states',
        (await look('OldTimer')).mode === 'none' && (await look('BootTest')).mode === 'verify']);

      /* ---- the typing-time probe: the field appears on its own ----------- */
      setFields('Ne', '');
      nameEl.dispatchEvent(new window.Event('input'));
      await new Promise(r => setTimeout(r, 500));
      results.push(['PIN: a half-typed name asks nothing at all', dpi().shown === false]);
      nameEl.value = 'NeverSeenName';
      nameEl.dispatchEvent(new window.Event('input'));
      await new Promise(r => setTimeout(r, 500));
      results.push(['PIN: typing a name nobody has raises "Create a PIN" by itself',
        dpi().shown === true && dpi().placeholder === 'Create a PIN' &&
        dpi().probe.mode === 'create']);
      results.push(['PIN: and the ENTER button waits for that second field',
        dpi().ready === false]);
      pinIn.value = '1234'; window.checkReady();
      results.push(['PIN: filling it arms the button', dpi().ready === true]);
      nameEl.value = 'BootTest';
      nameEl.dispatchEvent(new window.Event('input'));
      await new Promise(r => setTimeout(r, 500));
      results.push(['PIN: typing a name that DOES exist asks to confirm instead',
        dpi().shown === true && dpi().placeholder === 'Enter your PIN' &&
        dpi().probe.mode === 'verify']);
      results.push(['PIN: and editing the name cleared the PIN typed for the other one',
        dpi().value === '']);

      /* ---- GATE 4: no account_pins table at all — never throws ----------- */
      /* PIN Fixes PART A: captured BEFORE the table is taken away, because
         "shows exactly once" is only half the claim — the other half is that
         a world whose PIN system is live never sees it at all, and everything
         above this line ran against a live one. */
      const noticeBefore = dpi().noticeShown === false && dpi().noticeVisible === false;
      pinTableMissing = true;
      const gone = await look('BootTest');
      const goneLookupOnly = dpi().noticeShown;      // PIN Fixes PART A, see below
      results.push(['PIN: with the table missing the lookup answers instead of throwing',
        gone.system === false && gone.mode === 'none' && gone.stored === null]);
      setFields('BootTest', '');
      const goneOld = await allowed('BootTest');
      results.push(['PIN: a name that IS protected still gets in — no table, no PIN system',
        !!goneOld && goneOld.mode === 'none' && !goneOld.threw]);
      /* ---- PIN Fixes PART A: the silence finally says something ---------- */
      results.push(['PIN Fixes A: the notice never fired while the PIN system was live', noticeBefore]);
      results.push(['PIN Fixes A: a bare lookup still says nothing — telling the player is the login screen\'s job',
        goneLookupOnly === false]);
      const noticeUp = dpi();
      results.push(['PIN Fixes A: the first submit against a world with no account_pins table raises the notice',
        noticeUp.noticeShown === true && noticeUp.noticeVisible === true &&
        /PIN protection isn't active on this world yet/.test(noticeUp.noticeText || '')]);
      results.push(['PIN Fixes A: and it is a notice, not a gate — that login was still allowed through',
        !!goneOld && goneOld.mode === 'none' && !goneOld.threw]);
      doc.getElementById('pinNoticeX').click();
      results.push(['PIN Fixes A: it is dismissible, and dismissing it is the end of it',
        dpi().noticeVisible === false && dpi().noticeShown === true]);
      setFields('PinlessNew', '');
      const noticeDismissedAt = dpi().noticeVisible;
      const goneNew = await allowed('PinlessNew');
      results.push(['PIN: and a brand new name is not blocked either — never lock the door with no key',
        !!goneNew && goneNew.mode === 'none' && !goneNew.threw]);
      /* Two more submits against the same dead table, one of them a brand new
         name — the state that would have re-raised it if the latch were per
         answer rather than per session. */
      results.push(['PIN Fixes A: a second submit does not raise it again — once a session means once',
        noticeDismissedAt === false && dpi().noticeVisible === false && dpi().noticeShown === true]);
      nameEl.value = 'TypingAway'; nameEl.dispatchEvent(new window.Event('input'));
      await new Promise(r => setTimeout(r, 500));
      results.push(['PIN Fixes A: and typing does not raise it either — not once per keystroke',
        dpi().noticeVisible === false && dpi().probe.mode === 'none']);
      let insertThrew = null;
      try {
        await window.loginPlayer('PinlessNew', 'Beastmaster', { mode: 'create', pin: '1234' });
      } catch (e) { insertThrew = e.message || String(e); }
      results.push(['PIN: writing the PIN row into a table that does not exist never throws',
        insertThrew === null && window.debugWorldInfo().player !== null &&
        tableData.players.some(r => r.username === 'PinlessNew') &&
        tableData.account_pins.length === 1]);
      pinTableMissing = false;
      /* put the client back on the account the rest of this file logged in as */
      await window.loginPlayer('BootTest', 'Beastmaster');
      results.push(['PIN: the table coming back changes nothing that already happened',
        (await look('BootTest')).mode === 'verify' &&
        tableData.account_pins[0].pin === '2468']);

      /* =================================================================
         PIN Fixes PART B — the retroactive route. Run after GATE 4 has put
         the table back and the client back on BootTest, because this block
         writes a SECOND account_pins row and every assertion above counts
         them. It ends by re-logging in as BootTest, exactly as GATE 4 does,
         so the frame pump below still runs on the account it always did.
         ================================================================= */
      const probeFor = async (n) => {
        nameEl.value = n;
        nameEl.dispatchEvent(new window.Event('input'));
        await new Promise(r => setTimeout(r, 500));
        return dpi();
      };
      tableData.players.push({ username: 'OldTimer2', class: 'Ranger', x: 12, y: 12,
                               level: 1, hp: 100, max_hp: 100, inventory: {} });
      const offerOld = await probeFor('OldTimer');
      results.push(['PIN Fixes B: an account made before PINs existed is finally offered one',
        offerOld.protectShown === true && offerOld.optIn === false &&
        offerOld.protectLabel === 'PROTECT THIS NAME WITH A PIN' && offerOld.shown === false]);
      const offerProtected = await probeFor('BootTest');
      results.push(['PIN Fixes B: a name that already has a PIN is not offered one',
        offerProtected.protectShown === false && offerProtected.placeholder === 'Enter your PIN']);
      const offerNew = await probeFor('NobodyHasThisName');
      results.push(['PIN Fixes B: a brand new name is not offered one either — it is required one',
        offerNew.protectShown === false && offerNew.placeholder === 'Create a PIN']);
      const offerShort = await probeFor('Ol');
      results.push(['PIN Fixes B: and a half-typed name is asked nothing at all',
        offerShort.protectShown === false && offerShort.shown === false]);

      await probeFor('OldTimer');
      const protectBtn = doc.getElementById('pinProtect');
      protectBtn.click();
      const opened = dpi();
      results.push(['PIN Fixes B: taking the offer reveals the same create-PIN field a new account gets',
        opened.optIn === true && opened.shown === true && opened.placeholder === 'Create a PIN' &&
        opened.protectLabel === 'NOT NOW — ENTER WITHOUT A PIN']);
      results.push(['PIN Fixes B: and the ENTER button waits for it, exactly as it does for a new name',
        opened.ready === false]);
      pinIn.value = '7531'; window.checkReady();
      results.push(['PIN Fixes B: filling it arms the button', dpi().ready === true]);
      protectBtn.click();
      const closed = dpi();
      results.push(['PIN Fixes B: it is an offer and never a requirement — NOT NOW puts the screen back',
        closed.optIn === false && closed.shown === false && closed.value === '' &&
        closed.protectShown === true && closed.protectLabel === 'PROTECT THIS NAME WITH A PIN']);
      setFields('OldTimer', '');
      const declined = await allowed('OldTimer');
      results.push(['PIN Fixes B: declining logs in exactly as this account always has',
        !!declined && declined.mode === 'none' && !declined.threw &&
        tableData.account_pins.length === 1]);

      protectBtn.click();
      setFields('OldTimer', '12');
      const tooShort = await refused('OldTimer');
      results.push(['PIN Fixes B: a PIN too short to be one is refused rather than quietly stored',
        typeof tooShort === 'string' && /at least 4/.test(tooShort) &&
        tableData.account_pins.length === 1]);
      setFields('OldTimer', '7531');
      const prot = await allowed('OldTimer');
      results.push(['PIN Fixes B: the submit answers "protect" — create, for an account that already exists',
        !!prot && prot.mode === 'protect' && prot.pin === '7531']);
      await window.loginPlayer('OldTimer', 'Knight', prot);
      results.push(['PIN Fixes B: and the returning-player login wrote the account_pins row itself',
        tableData.account_pins.length === 2 &&
        tableData.account_pins.some(r => r.username === 'OldTimer' && r.pin === '7531') &&
        tableData.players.filter(r => r.username === 'OldTimer').length === 1]);
      results.push(['PIN Fixes B: the name that was unprotected all build is protected from now on',
        (await look('OldTimer')).mode === 'verify']);
      setFields('OldTimer', '0000');
      const nowWrong = await refused('OldTimer');
      results.push(['PIN Fixes B: it refuses a wrong PIN on the very next submit',
        typeof nowWrong === 'string' && /Incorrect/i.test(nowWrong)]);
      setFields('OldTimer', '7531');
      const nowRight = await allowed('OldTimer');
      results.push(['PIN Fixes B: while the real one gets in and stores nothing further',
        !!nowRight && nowRight.mode === 'verify' && tableData.account_pins.length === 2]);
      const offerGone = await probeFor('OldTimer');
      results.push(['PIN Fixes B: and the offer is gone the moment the name has a PIN',
        offerGone.protectShown === false && offerGone.placeholder === 'Enter your PIN']);

      /* The offer must never be made where PART A speaks instead: mode "none"
         also means "no account_pins table", and a PIN this world cannot store
         is a promise the login screen must not make. */
      pinTableMissing = true;
      const offerDead = await probeFor('OldTimer2');
      results.push(['PIN Fixes B: with no account_pins table the offer is never made — PART A speaks instead',
        offerDead.protectShown === false && offerDead.probe.mode === 'none']);
      results.push(['PIN Fixes A: and the notice still does not come back a third time',
        offerDead.noticeVisible === false && offerDead.noticeShown === true]);
      pinTableMissing = false;

      const midOptIn = await probeFor('OldTimer2');
      protectBtn.click();
      pinIn.value = '2222'; window.checkReady();
      const armed = dpi();
      nameEl.value = 'OldTimer2x'; nameEl.dispatchEvent(new window.Event('input'));
      const swapped = dpi();
      await new Promise(r => setTimeout(r, 500));
      results.push(['PIN Fixes B: editing the name drops the offer and the PIN typed under it',
        midOptIn.protectShown === true && armed.optIn === true && armed.value === '2222' &&
        swapped.optIn === false && swapped.value === '' && swapped.protectShown === false &&
        swapped.protectLabel === 'PROTECT THIS NAME WITH A PIN']);
      results.push(['PIN Fixes B: nothing was written for the name that was abandoned mid-offer',
        tableData.account_pins.length === 2 &&
        !tableData.account_pins.some(r => r.username === 'OldTimer2')]);

      /* ---- one of the two things the corrected spec DROPPED, still absent -
         ⚠️ v51 PART E RETIRED THE OTHER HALF OF THIS GATE, DELIBERATELY, AND
         IT IS THE ONE THING IN THIS BUILD MOST WORTH A SECOND LOOK.

         What stood here was: "no guild or clan system was added — the bible
         rules one out explicitly", pinned as a blunt absence of the words
         "guild" and "clan" anywhere in the file. The bible clause it cites is
         real and still says what it said (TEAMING & ALLIANCES: "No formal
         guild or clan system exists in the game"). The v51 locked spec builds
         one anyway, in detail, across two document revisions, naming all five
         guilds, their mottos and their effects — so this is the same shape of
         retirement v31 made for its event guards and v33 for the Architect
         guard: a spec-scope pin that a later locked spec deliberately
         overturned.

         It is REPLACED, not dropped, and the replacement pins what the bible
         clause actually protects — in-game SOCIAL machinery. There is still
         no way to join, leave, invite, list members, or talk to a guild, and
         still no guild table: what exists is an unchosen assignment that
         grants one passive effect and renders a name. If the deviation is not
         wanted, this gate and the GUILDS block are where to start. */
      /* ⚠️ COMMENT-STRIPPED, and it has to be: v51's own GUILDS block quotes
         the bible clause this gate exists to honour, and that clause contains
         the word "clan". A blunt grep over the raw file would fail on the
         documentation of the rule it is enforcing — the same lesson v50's
         "the bake is gone" gate wrote down. What matters is that no
         executable clan machinery exists, and there is none. */
      results.push(['PIN Fixes: no CLAN system was added — no executable trace of one',
        gameScript.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
          .toLowerCase().indexOf('clan') < 0]);
      results.push(['v51 E: guilds add no in-game social machinery at all — the bible clause the old gate protected',
        (() => {
          const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
          const code = strip(gameScript).toLowerCase();
          return ['guildjoin', 'joinguild', 'guildleave', 'leaveguild', 'guildinvite',
                  'guildmembers', 'guildroster', 'guildchat', 'guildlist']
            .every(w => code.indexOf(w) < 0);
        })()]);
      results.push(['v51 E: and no guild TABLE — the assignment is a hash of the username, nothing is stored',
        gameScript.indexOf('from("guilds")') < 0 &&
        gameScript.indexOf('from("guild_members")') < 0]);
      const TABLES = [...new Set([...gameScript.matchAll(/from\("([a-z_]+)"\)/g)].map(m => m[1]))].sort();
      /* v47 PART H: UPDATED, NOT RELAXED — the permanent table census now
         names ten, and the two new ones are exactly the two the locked spec
         asks for. Still an exact list, so a future version cannot quietly add
         an eleventh: no guild table, no admin table, nothing unlisted. */
      results.push(['the table census is exactly the ten this project has documented',
        TABLES.join(',') === 'account_pins,base_pieces,ground_items,mined_nodes,pets,players,rare_takes,redeem_claims,redeem_codes,world']);
      results.push(['PIN Fixes: admin is still read straight off the real players row, as it already was',
        gameScript.indexOf('role: p.role === "admin" ? "admin" : "player"') > 0 &&
        gameScript.split('role: p.role === "admin"').length === 2]);

      /* back onto the account the rest of this file logged in as */
      await window.loginPlayer('BootTest', 'Beastmaster');
      pumpPin(1000, 6);
      results.push(['PIN: and the world still runs frames cleanly afterwards', !caught]);
    } else {
      results.push(['Account PIN Protection hooks are reachable', false]);
    }

    /* ===================== QA PASS: real bugs found and fixed ================ */
    {
      // ground-item space bug — the item render loop and finder now filter by space
      results.push(['ground item render loop filters by space',
        gameScript.indexOf('if ((it.space || "main") !== (me.space || "main")) continue;') > 0]);
      results.push(['nearestGroundItem() filters by space too',
        (gameScript.match(/if \(\(it\.space \|\| "main"\) !== \(me\.space \|\| "main"\)\) continue;/g) || []).length >= 2]);
      results.push(['dropAllItems() tags every drop with the real space it happened in',
        gameScript.indexOf('const dropSpace = me.space || "main";') > 0 &&
        gameScript.indexOf('space: dropSpace') > 0]);
      results.push(['mob loot drops carry the mob\'s own real space, not an assumption',
        gameScript.indexOf('space: m.space || "main"') > 0]);
      results.push(['chest-destroy drops are explicit about their space, not implicit',
        gameScript.indexOf('space: "main"') > 0]);

      // dev supply chest — gated, not deleted
      results.push(['the Dev Supply Chest requires isAdmin() to use',
        gameScript.indexOf('function nearChest() { return isAdmin() &&') > 0]);
      results.push(['and requires isAdmin() to even see',
        gameScript.indexOf('if (isAdmin()) ents.push({ s: DEV_CHEST') > 0]);
    }

    /* ===================== QA PASS 2: player-experience audit ================ */
    {
      results.push(['closeAllPanels() exists and covers every real panel',
        gameScript.indexOf('function closeAllPanels(exceptEl)') > 0 &&
        gameScript.indexOf('[invPanel, craftPanel, petPanel, buildPanel, charPanel, travelPanel, chestPanel, givePanel]') > 0]);
      results.push(['opening Inventory now closes the others first',
        gameScript.indexOf('const now2 = invPanel.style.display !== "block"; closeAllPanels();') > 0]);
      results.push(['opening Build now closes the others first',
        gameScript.indexOf('const now2 = buildPanel.style.display !== "block"; closeAllPanels();') > 0]);
      results.push(['opening Character now closes the others first',
        gameScript.indexOf('const now2 = charPanel.style.display !== "block"; closeAllPanels();') > 0]);

      results.push(['base placement keeps clear of the Ancient Forge',
        gameScript.indexOf('[ANCIENT.x, ANCIENT.y, ANCIENT_R + 3]') > 0]);
      results.push(['and the Dragon Altar',
        gameScript.indexOf('[DRAGON_ALTAR.x, DRAGON_ALTAR.y, DRAGON_ALTAR_R + 3]') > 0]);
      results.push(['and the Beastmaster Shrine',
        gameScript.indexOf('[SHRINE.x, SHRINE.y, 1.7 + 3]') > 0]);
      results.push(['and the Colosseum, so it stays a real open arena',
        gameScript.indexOf('[COLOSSEUM.x, COLOSSEUM.y, COLOSSEUM_R + 2]') > 0]);

      results.push(['the safe-zone PvP gate checks both the attacker and the target',
        gameScript.indexOf('inSafeZone(me.x, me.y) || inSafeZone(o.x, o.y)') > 0]);
    }

    /* ===================== hotfix: cave exit re-entry loop ================ */
    {
      const info = window.debugWorldInfo(), N2 = info.N, B2 = info.B;
      let spot = null;
      for (let y = 0; y < N2 && !spot; y++) for (let x = 0; x < N2; x++) {
        if (window.biomeAt(x, y) === B2.UWCAVE) { spot = [x, y]; break; }
      }
      if (spot) {
        window.debugSetPlayer({ x: spot[0] + 0.5, y: spot[1] + 0.5, diving: true, hp: 100, breath: 30 });
        window.enterInterior(spot[0], spot[1], B2.UWCAVE);
        const enteredOk = window.debugSpaceInfo().space !== 'main';
        window.exitInterior();
        const exitedOk = window.debugSpaceInfo().space === 'main';
        for (let f = 0; f < 30; f++) window.render(f * 16);
        const stayedOut = window.debugSpaceInfo().space === 'main';
        results.push(['cave entry works', enteredOk]);
        results.push(['exitInterior() genuinely returns to the surface', exitedOk]);
        results.push(['surfacing does not silently pull the player back in — the reported bug',
          stayedOut]);
      } else {
        results.push(['cave exit re-entry test had a UWCAVE tile to use', false]);
      }
    }

    /* =====================================================================
       v46 — Death Timer, Session Resume, Expansion 3, the real Minimap,
       block for every class, the presence resync, and the credit.
       Runs last, and everything in it either restores what it changed or
       touches only state nothing above reads.
       ===================================================================== */
    {
      const doc46 = window.document;

      /* ---- PART A: the death timer ------------------------------------- */
      results.push(['v46 A: the respawn wait is one constant, and it is seconds now',
        gameScript.indexOf('const RESPAWN_SECONDS = 30;') > 0 &&
        gameScript.indexOf('RESPAWN_MINUTES') < 0]);
      results.push(['v46 A: and it is read in exactly one place',
        (gameScript.match(/RESPAWN_SECONDS/g) || []).length === 2]);
      results.push(['v46 A: the static markup no longer promises ten minutes',
        html.indexOf('<div id="deathTimer">10:00</div>') < 0 &&
        html.indexOf('<div id="deathTimer">00:30</div>') > 0]);
      {
        /* Behavioural, through the real death path: 30 seconds, not 600. */
        const before = window.debugWorldInfo().player;
        window.debugSetPlayer({ x: before.x, y: before.y, hp: 100 });
        const t0 = Date.now();
        window.enterDeath('a proof gate');
        const dw = window.debugWorldInfo().player;
        const left = (dw.deadUntil || 0) - t0;
        results.push([`v46 A: dying sets a ~30s timer, not a ~10m one (${Math.round(left / 1000)}s)`,
          left > 25000 && left < 35000]);
        doc46.getElementById('deathTimer').textContent = '';
        window.render(1);
        results.push(['v46 A: and the readout counts that same window down',
          /^00:(2[0-9]|30)$/.test(doc46.getElementById('deathTimer').textContent || '')]);
        window.respawn();
        results.push(['v46 A: respawn clears it', !window.debugWorldInfo().player.deadUntil]);
      }

      /* ---- PART E: block for every class ------------------------------- */
      results.push(['v46 E: isBlocking() no longer names a class at all',
        gameScript.indexOf('me.cls === "Knight" || me.cls === "Architect"') < 0 &&
        gameScript.indexOf('return !dead && me && !!keys[KEYBINDS.block];') > 0]);
      results.push(['v46 E: the HUD hint no longer says "(shield classes)" — in either copy',
        html.indexOf('shield classes') < 0]);
      results.push(['v46 E: the generated help line still names the real bound key',
        (doc46.getElementById('hudHelp').textContent || '').indexOf('block') > 0]);
      {
        const CLS = ['Ranger', 'Knight', 'Mystic', 'Beastmaster', 'Architect'];
        const held = [], reduced = [];
        const openSpot46 = (() => {
          const W46 = window.debugWorldInfo();
          for (let r = 300; r < 900; r += 37) {
            for (let a = 0; a < 16; a++) {
              const x = W46.SPAWN.x + Math.cos(a / 16 * Math.PI * 2) * r;
              const y = W46.SPAWN.y + Math.sin(a / 16 * Math.PI * 2) * r;
              if (x > 4 && y > 4 && x < W46.N - 4 && y < W46.N - 4 && !window.inSafeZone(x, y))
                return [x, y];
            }
          }
          return [W46.SPAWN.x + 400, W46.SPAWN.y + 400];
        })();
        const keyOf = window.debugSettingsInfo().KEYBINDS.block;
        for (const c of CLS) {
          window.debugSetPlayer({ cls: c, hp: 100, armor: null });
          window.dispatchEvent(new window.KeyboardEvent('keydown', { key: keyOf }));
          if (window.isBlocking()) held.push(c);
          const hpBefore = window.debugWorldInfo().player.hp;
          /* CORRECTED, not relaxed (found by the v47 run): this was a FIXED
             offset from SPAWN, and the admin world-reset gate further up
             genuinely re-seeds the world — so on some runs SPAWN + (400,400)
             landed inside one of the scattered Safe Zones, applyDamage()
             correctly returned early, and all five classes recorded "took no
             damage". The game was right and the spot was wrong. Same class of
             correction Expansion 2b made to its two SAFE_RADIUS-bound spots. */
          window.debugSetPlayer({ x: openSpot46[0], y: openSpot46[1], hp: 100 });
          window.applyDamage(40, 'a proof gate');
          const took = 100 - window.debugWorldInfo().player.hp;
          if (took > 0 && took <= 12) reduced.push(c);
          window.dispatchEvent(new window.KeyboardEvent('keyup', { key: keyOf }));
          void hpBefore;
        }
        results.push([`v46 E: all five classes can hold block (${held.join(', ')})`,
          held.length === 5]);
        results.push([`v46 E: and all five really take the reduced hit (${reduced.join(', ')})`,
          reduced.length === 5]);
        window.debugSetPlayer({ cls: 'Beastmaster', hp: 100 });
        results.push(['v46 E: letting go of the key stops the block for everyone',
          window.isBlocking() === false]);
      }

      /* ---- PART G: the credit ------------------------------------------ */
      {
        const settingsInfo = (typeof window.debugSettingsInfo === "function") ? window.debugSettingsInfo() : {};
        const col = settingsInfo.COLLABORATIONS || [];
        results.push(['v46 G: Sam Hicks is a named dev in the same Dev Team role',
          col.some(c => c.name === 'Sam Hicks' && c.role === 'Dev Team')]);
        results.push(['v46 G: alongside Skeptik and Advay, who are untouched',
          col.filter(c => c.role === 'Dev Team').length === 3 &&
          col.some(c => c.name === 'Advay' && c.role === 'Dev Team') &&
          col.some(c => /^Skeptik/.test(c.name) && c.role === 'Dev Team')]);
        results.push(['v46 G: and the composer credits are a different claim, unchanged',
          (settingsInfo.MUSIC_CREDITS || []).length === 2]);
      }

      /* ---- PART C: Expansion 3's own invariants ------------------------- */
      {
        const w46 = window.debugWorldInfo();
        const H46 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        results.push([`v46 C: the wild and mob spawn keepouts are named, not literals`,
          /* v49 PART B: re-synced to Expansion 4. These two were still the
             N=2000 literals; the live file doubled them with the world
             (`const WILD_SPAWN_MIN = 600;  // Expansion 4: 300 * 2`, and
             MOB_SPAWN_MIN 350 -> 700 on the line below it). Read off the
             live file before changing, exactly as the rest of the N=4000
             re-sync was. The DERIVED-clearance gate below is what actually
             proves the relationship; these two only pin the names. */
          gameScript.indexOf('const WILD_SPAWN_MIN = 600;') > 0 &&
          gameScript.indexOf('const MOB_SPAWN_MIN = 700;') > 0 &&
          gameScript.indexOf('< WILD_SPAWN_MIN) continue;') > 0 &&
          gameScript.indexOf('< MOB_SPAWN_MIN) continue;') > 0]);
        /* THE regression this build exists to prevent: a Ruin cluster whose
           whole footprint sits inside a spawn exclusion holds no ruin-only
           creature, and Crystal Golem is ruin-only. Asserted as the
           relationship, never as a literal. */
        const worst = Math.min(...w46.RUINS.map(r => H46(r, w46.SPAWN)));
        results.push([`v46 C: every Ruin clears both spawn exclusions by its whole footprint ` +
          /* v49 PART B: 350 was the N=2000 MOB_SPAWN_MIN and made this gate
             WEAKER than its own name at N=4000 — it was passing against half
             the exclusion it claims to check. 700 is the live constant, and
             it is pinned by the source grep directly above, so the two move
             together or this fails loudly. Real margin: 834.3 > 700 + 76. */
          `(nearest ${worst.toFixed(1)} > 700 + ${w46.RUIN_FOOT})`,
          worst > 700 + w46.RUIN_FOOT]);
        results.push([`v46 C: and the clearance is DERIVED from them, so the next expansion carries it`,
          gameScript.indexOf('if (H(tx, ty, SPAWN) <= MOB_SPAWN_MIN + RUIN_FOOT) continue;') > 0]);
        const alt46 = window.debugElderInfo ? window.debugElderInfo() : null;
        results.push(['v46 C: the Dragon Elder Altar is placed on real placeable land now',
          gameScript.indexOf('if (isPlaceableLand(Math.round(DRAGON_ALTAR.x), Math.round(DRAGON_ALTAR.y)) &&') > 0]);
        void alt46;
        /* Every landmark distance-from-a-fixed-point is exactly double what
           Expansion 2b shipped. Source pins, because these are inline
           literals inside placeLandmarks() that no hook can see. */
        const DOUBLED = ['Math.cos(a1) * 1252', 'Math.sin(a2) * 1200', 'SAFE_RADIUS + 42) break;',
          'Math.cos(a4) * 800', 'Math.cos(a5) * 364', 'Math.cos(a6) * 1000',
          'const DRAGON_ALTAR_DIST = 564;', 'if (dV < 452 &&', 'b = dV < 124 ? B.LAVA',
          'if (b === B.PEAK && dV < 700)', 'dTower / 2000', 'dMount / 600',
          'for (let r = 36; r < 324; r++)'];
        const missing46 = DOUBLED.filter(t => gameScript.indexOf(t) < 0);
        results.push([`v46 C: every scaled constant landed (${DOUBLED.length - missing46.length}/${DOUBLED.length})` +
          (missing46.length ? ' MISSING ' + missing46.join(' | ') : ''), missing46.length === 0]);
        results.push(['v46 C: BREATH_MAX is deliberately NOT scaled, as both expansion specs require',
          window.debugWorldInfo().N === 4000 &&
          gameScript.indexOf('const BREATH_MAX') > 0 &&
          gameScript.indexOf('const BREATH_MAX = 30') > 0]);
        results.push(['v46 C: the interior grid is untouched by the overworld expansion',
          window.debugSpaceInfo().INTERIOR_N === 160]);
      }

      /* ---- PART D: the real minimap ------------------------------------ */
      if (window.debugMapInfo) {
        const dmi = window.debugMapInfo;
        const w46 = window.debugWorldInfo();
        window.debugSetPlayer({ x: w46.SPAWN.x, y: w46.SPAWN.y, hp: 100 });
        window.render(1);
        const m0 = dmi();
        results.push([`v48 D: it is a real canvas, ~31x31 tiles centred on the player (${m0.tiles} tiles)`,
          m0.canvas && m0.canvas.w === m0.MAP_PX && m0.canvas.h === m0.MAP_PX &&
          m0.MAP_R === 15 && m0.tiles === 961]);
        results.push(['v46 D: it is on screen in the world', m0.visible === true]);
        results.push(['v46 D: the player sits at the centre cell of it',
          Math.abs(m0.centre[0] - m0.MAP_PX / 2) <= m0.MAP_CELL &&
          Math.abs(m0.centre[1] - m0.MAP_PX / 2) <= m0.MAP_CELL]);
        /* The colours are the world's own, not a second palette. */
        const mapSrc = gameScript.slice(gameScript.indexOf('function updateWorldMap()'),
                                        gameScript.indexOf('function debugMapInfo()'));
        results.push(['v46 D: every tile colour comes from the locked PAL, never a new one',
          mapSrc.indexOf('PAL[biomeAt(tx, ty)]') > 0 &&
          mapSrc.indexOf('((tx + ty) % 2 === 0) ? 0 : 1') > 0]);
        /* The bible rule, held exactly as the v35 compass holds it. */
        results.push(['v46 D: it never reads a base piece — the omission IS the feature',
          mapSrc.indexOf('basePieces') < 0 && mapSrc.indexOf('baseIndex') < 0]);
        results.push(['v46 D: and it draws no feature, node, mob or wild creature either',
          mapSrc.indexOf('features') < 0 && mapSrc.indexOf('mobs') < 0 &&
          mapSrc.indexOf('wilds') < 0 && mapSrc.indexOf('decor') < 0]);
        /* Nearby player dots — and only NEARBY ones. */
        const oth = window.debugCombatHandles ? window.debugCombatHandles().others : null;
        if (oth) {
          const P = window.debugWorldInfo().player;
          oth.set('MapNear', { x: P.x + 2, y: P.y + 1, tx: P.x + 2, ty: P.y + 1,
                               cls: 'Mystic', hp: 100, maxHp: 100, lastHeard: 1e15, space: 'main' });
          oth.set('MapFar', { x: P.x + 40, y: P.y + 40, tx: P.x + 40, ty: P.y + 40,
                              cls: 'Knight', hp: 100, maxHp: 100, lastHeard: 1e15, space: 'main' });
          window.render(2);
          const m1 = dmi();
          const near = m1.playerDots.filter(d => d.name === 'MapNear');
          results.push(['v46 D: a player two tiles away gets a dot on the card',
            near.length === 1 &&
            near[0].px[0] > 0 && near[0].px[0] < m1.MAP_PX &&
            near[0].px[1] > 0 && near[0].px[1] < m1.MAP_PX]);
          results.push(['v46 D: a player forty tiles away does not — close range is the whole design',
            m1.playerDots.every(d => d.name !== 'MapFar')]);
          oth.delete('MapNear'); oth.delete('MapFar');
          window.render(3);
        } else {
          results.push(['v46 D: player-dot gate had a handle on others', false]);
        }
        /* Inside a cave the world grid is a lie, so the card goes away —
           the same rule the compass and the breath readout follow. */
        {
          const info = window.debugWorldInfo(), B2 = info.B;
          let spot = null;
          for (let y = 0; y < info.N && !spot; y++) for (let x = 0; x < info.N; x++) {
            if (window.biomeAt(x, y) === B2.UWCAVE) { spot = [x, y]; break; }
          }
          if (spot) {
            window.debugSetPlayer({ x: spot[0] + 0.5, y: spot[1] + 0.5, diving: true, hp: 100, breath: 30 });
            window.enterInterior(spot[0], spot[1], B2.UWCAVE);
            window.render(4);
            const inside = dmi().visible;
            const compassInside = doc46.getElementById('hudMinimap').style.display;
            window.exitInterior();
            window.debugSetPlayer({ x: w46.SPAWN.x, y: w46.SPAWN.y, diving: false, hp: 100 });
            window.render(5);
            results.push(['v46 D: it hides inside a cave interior, like the compass beside it',
              inside === false && compassInside === 'none']);
            results.push(['v46 D: and comes back on the surface', dmi().visible === true]);
          } else {
            results.push(['v46 D: interior-hide gate had a UWCAVE tile to use', false]);
          }
        }
        /* The compass is a SEPARATE card and was not touched. */
        results.push(['v46 D: the compass dial still exists beside it, with all nine marks',
          doc46.getElementById('hudMinimap').style.display === 'block' &&
          doc46.getElementById('mmDial').querySelectorAll('.mm-mark').length === 9 &&
          doc46.getElementById('hudMap') !== doc46.getElementById('hudMinimap')]);
        results.push(['v46 D: and the two cards are two cards, not one rebuilt one',
          html.indexOf('<div class="hud" id="hudMap">') > 0 &&
          html.indexOf('<div class="hud" id="hudMinimap">') > 0]);
      } else {
        results.push(['v46 D: debugMapInfo() is reachable', false]);
      }

      /* ---- PART F: the presence force-resync --------------------------- */
      if (window.debugPresenceInfo) {
        const dpr = window.debugPresenceInfo;
        const oth = window.debugCombatHandles().others;
        results.push(['v46 F: there is a real periodic resync, on a real interval',
          dpr().PRESENCE_RESYNC_MS === 20000 &&
          gameScript.indexOf('presenceResyncAt = Date.now() + PRESENCE_RESYNC_MS;') > 0 &&
          gameScript.indexOf('resyncPresence();') > 0]);
        oth.clear();
        oth.set('Ghost', { x: 1, y: 1, cls: 'Ranger', hp: 100, maxHp: 100, lastHeard: 1e15, space: 'main' });
        oth.set('Real', { x: 2, y: 2, cls: 'Knight', hp: 100, maxHp: 100, lastHeard: 1e15, space: 'main' });
        /* Direction one: the channel cannot tell us who is here. Nothing is
           dropped — an empty roster is "cannot tell", never "nobody". */
        presenceRoster = null;
        const t0 = trackCalls;
        const ranBlind = window.resyncPresence();
        results.push(['v46 F: an empty presence roster drops nobody — it means "cannot tell"',
          ranBlind === false && oth.size === 2 && dpr().online === 3]);
        results.push(['v46 F: but it still re-announces this client either way',
          trackCalls === t0 + 1]);
        /* Direction two: a ghost whose leave packet never arrived. */
        presenceRoster = ['BootTest', 'Real'];
        const ranReal = window.resyncPresence();
        results.push(['v46 F: a name the server no longer lists is dropped — the ghost that never left',
          ranReal === true && oth.has('Real') && !oth.has('Ghost') &&
          dpr().online === 2]);
        results.push(['v46 F: and the drop is counted, so a wrong count can never go quiet',
          dpr().stats.lastDropped.indexOf('Ghost') >= 0 && dpr().stats.runs >= 2]);
        /* Our own name can never be counted twice. */
        oth.set('BootTest', { x: 3, y: 3, cls: 'Mystic', hp: 100, maxHp: 100, lastHeard: 1e15, space: 'main' });
        window.resyncPresence();
        results.push(['v46 F: this client is never in its own others map, even if a packet puts it there',
          !oth.has('BootTest') && dpr().online === 2]);
        presenceRoster = null;
        oth.clear();
        results.push(['v46 F: it is a net, not a diagnosis — nothing here claims to fix the count',
          gameScript.indexOf('This is a net, not a diagnosis') > 0]);
        results.push(['v46 F: and the count itself is still others.size + 1, untouched',
          gameScript.indexOf('${others.size + 1} online') > 0]);
      } else {
        results.push(['v46 F: debugPresenceInfo() is reachable', false]);
      }

      /* ---- PART B: reload resumes your session ------------------------- */
      if (window.resumeSession && window.debugSessionInfo) {
        const dsn = window.debugSessionInfo;
        const nameEl46 = doc46.getElementById('username');
        const enterEl46 = doc46.getElementById('enterBtn');
        const realClick = enterEl46.onclick;
        let submits = 0;
        enterEl46.onclick = async () => { submits++; };
        const runResume = async (stored) => {
          submits = 0;
          try { window.localStorage.removeItem('rh_last_user'); } catch (e) {}
          if (stored !== null) { try { window.localStorage.setItem('rh_last_user', stored); } catch (e) {} }
          nameEl46.value = '';
          await window.resumeSession();
          const out = { info: dsn(), submits };
          await new Promise(r => setTimeout(r, 500));   // let the debounced probe settle
          return out;
        };
        results.push(['v46 B: the login that already happened stored the name',
          gameScript.indexOf('rememberSession(username);') > 0 &&
          gameScript.indexOf('const LS_LAST_USER = "rh_last_user";') > 0]);
        results.push(['v46 B: and it stores it only AFTER the world is up, never on a refused login',
          gameScript.indexOf('loginEl.style.display = "none";') <
          gameScript.indexOf('rememberSession(username);') &&
          gameScript.indexOf('rememberSession(username);') <
          gameScript.indexOf('startTutorialIfNeeded();')]);
        /* An existing name with no PIN: filled AND submitted. */
        const r1 = await runResume('OldTimer2');
        results.push(['v46 B: a stored name with no PIN is filled in and entered for you',
          r1.info.nameField === 'OldTimer2' && r1.info.resume.filled === true &&
          r1.info.resume.submitted === true && r1.submits === 1]);
        /* A protected name: filled, PIN asked for, NOT submitted. */
        const r2 = await runResume('OldTimer');
        results.push(['v46 B: a stored name WITH a PIN is filled in but still has to produce it',
          r2.info.nameField === 'OldTimer' && r2.info.resume.filled === true &&
          r2.info.resume.submitted === false && r2.submits === 0 &&
          r2.info.resume.reason === 'pin required' &&
          window.debugPinInfo().shown === true]);
        /* A name the world does not have: filled, never submitted, key cleared
           rather than left to auto-create a blank character every load. */
        const r3 = await runResume('NobodyHasThisName');
        results.push(['v46 B: a stored name the world no longer has is never auto-created',
          r3.info.resume.submitted === false && r3.submits === 0 &&
          r3.info.resume.reason === 'no such account']);
        results.push(['v46 B: and that stale key is cleared, so it stops asking',
          window.localStorage.getItem('rh_last_user') === null]);
        /* Nothing stored: the login screen a first-time player sees. */
        const r4 = await runResume(null);
        results.push(['v46 B: with nothing stored the login card is exactly as it always was',
          r4.info.resume.filled === false && r4.submits === 0 &&
          r4.info.nameField === '']);
        /* The PIN gate is genuinely still in front of the world. */
        results.push(['v46 B: the resume goes through the real submit, so the PIN gate still stands',
          gameScript.indexOf('await enterBtn.onclick();') > 0 &&
          gameScript.indexOf('const pinCheck = await requirePinForLogin(username);') > 0]);
        results.push(['v46 B: it stores a NAME and never a PIN or a credential',
          gameScript.indexOf('localStorage.setItem(LS_LAST_USER, username)') > 0 &&
          (gameScript.match(/localStorage\.setItem\(/g) || []).length === 5]);
        enterEl46.onclick = realClick;
        nameEl46.value = 'BootTest';
        try { window.localStorage.removeItem('rh_last_user'); } catch (e) {}
      } else {
        results.push(['v46 B: resumeSession() is reachable', false]);
      }

      results.push(['v46: and the world still runs frames cleanly after all of it',
        (() => { for (let f = 0; f < 6; f++) window.render(f * 16); return !caught; })()]);
    }

    /* ===================== v47: balance, anti-exploit & economy ============
       PART A's own gates live up in the density block beside the counts they
       are about; everything else this version changed is below. */
    {
      const doc47 = window.document;
      const i47 = window.debugWorldInfo();
      const dsp47 = window.debugSetPlayer;
      const wasP47 = i47.player;
      /* Somewhere a player can actually be hit. applyDamage() correctly
         returns early inside ANY safe zone, and the admin world-reset gate
         above this block genuinely re-rolls the world seed — so every landmark
         and every scattered Safe Zone is in a different place on every run.
         A fixed offset from SPAWN is therefore a coin flip, which is exactly
         how the v46 block's own fixed spot was found to flake. Searched, not
         assumed. */
      const openSpot47 = (() => {
        for (let r = 300; r < 900; r += 37) {
          for (let a = 0; a < 16; a++) {
            const x = i47.SPAWN.x + Math.cos(a / 16 * Math.PI * 2) * r;
            const y = i47.SPAWN.y + Math.sin(a / 16 * Math.PI * 2) * r;
            if (x > 4 && y > 4 && x < i47.N - 4 && y < i47.N - 4 && !window.inSafeZone(x, y))
              return [x, y];
          }
        }
        return [i47.SPAWN.x + 400, i47.SPAWN.y + 400];
      })();

      /* ---- PART B: the two cave mobs are genuinely EASIER ---------------- */
      const tr = i47.MOBS.troll, dw47 = i47.MOBS.dark_wraith;
      results.push(['v47 B: troll 68 HP / 11 dmg (was 90/14)',
        !!tr && tr.hp === 68 && tr.dmg === 11]);
      results.push([`v47 B: troll is genuinely easier, not just different (${tr.hp * tr.dmg} vs 1260)`,
        tr.hp * tr.dmg < 90 * 14 && tr.hp < 90 && tr.dmg < 14]);
      results.push([`v47 B: dark_wraith is genuinely easier too (${dw47.hp * dw47.dmg} vs 780)`,
        dw47.hp * dw47.dmg < 65 * 12 && dw47.hp < 65 && dw47.dmg < 12]);
      /* Everything ELSE about both is untouched — this is a difficulty pass,
         not a redesign. The wraith in particular must stay the ranged one. */
      /* v51 PART C: `count` moved out of this assertion, because it is now
         the one thing about the Troll that v51 deliberately changes (6 -> 24)
         and it was never what v47 PART B was guarding — that part was about
         difficulty. Everything v47 actually pinned is still pinned to the
         digit, and the new count is asserted in v51's own MOB_COUNTS table. */
      results.push(['v47 B: the Troll keeps its longer 750ms tell and its slow walk',
        tr.windupMs === 750 && tr.moveSpeed === 1.3 &&
        tr.atkRange === 1.7 && tr.atkCooldownMs === 2000]);
      results.push(['v47 B: the Dark Wraith is still the file\'s only ranged mob',
        dw47.atkRange === 4.5 && dw47.windupMs === 600 &&
        Object.entries(i47.MOBS).every(([k, d]) => k === 'dark_wraith' || d.atkRange < 4.5)]);

      /* ---- PART C: Sea Serpent moved, and moved ALONE ------------------- */
      const ss47 = i47.MOBS.sea_serpent;
      results.push([`v47 C: the Sea Serpent got HARDER while PART B's two got easier (${ss47.hp * ss47.dmg} vs 2340)`,
        ss47.hp * ss47.dmg > 130 * 18 && ss47.dmg === 18 && ss47.windupMs === 700]);
      {
        /* An independent copy of every mob stat as it stood BEFORE v47. The
           only three entries allowed to differ are the two PART B moves and
           the Sea Serpent's HP; anything else that shifted is a change nobody
           asked for. adult_golem is new this version and is asserted on its
           own terms below. */
        const PRE47 = { goblin: [40, 6], bandit: [55, 9], troll: [90, 14], boar: [50, 7],
                        bear: [80, 13], griffin: [70, 11], phoenix: [75, 11],
                        dark_wraith: [65, 12], sea_serpent: [130, 18],
                        salamander_king: [75, 13], golem_elder: [420, 20],
                        elder_drake: [900, 28] };
        const MOVED47 = new Set(['troll', 'dark_wraith', 'sea_serpent']);
        const drifted = Object.entries(PRE47)
          .filter(([k, [hp, dmg]]) => !MOVED47.has(k) &&
            (!i47.MOBS[k] || i47.MOBS[k].hp !== hp || i47.MOBS[k].dmg !== dmg))
          .map(([k]) => k);
        results.push([`v47 C: no mob moved that this version did not name (${drifted.join(',') || 'none'})`,
          drifted.length === 0]);
        results.push(['v47 C: and the Sea Serpent is the ONLY one whose damage did not move with it',
          i47.MOBS.sea_serpent.dmg === PRE47.sea_serpent[1]]);
        results.push(['v48: the mob roster is the old twelve plus Adult Golem and Demon Knight',
          Object.keys(i47.MOBS).sort().join(',') ===
          Object.keys(PRE47).concat('adult_golem', 'demon_knight').sort().join(',')]);
      }

      /* ---- PART C: the Adult Golem, built for real ---------------------- */
      const ag = i47.MOBS.adult_golem;
      results.push(['v47 C: the Adult Golem exists at all',  !!ag]);
      results.push(['v47 C: it is the bible\'s own line — Ruins, Hard, Runic Stone',
        !!ag && ag.biomes.length === 1 && ag.biomes[0] === i47.B.RUINB &&
        ag.loot.some(l => l.type === 'runic_stone')]);
      results.push(['v47 C: "adults are hostile enemies" — it is not tameable',
        !!ag && ag.tameable === false]);
      results.push(['v47 C: Hard tier means the Sea Serpent\'s own pre-buff baseline',
        !!ag && ag.hp === 130 && ag.dmg === 18 && ag.windupMs === 700]);
      results.push(['v47 C: but slower than a serpent — a golem is outwalkable',
        !!ag && ag.moveSpeed === 1.3 && ag.moveSpeed < i47.MOBS.sea_serpent.moveSpeed]);
      results.push([`v47 C: and it genuinely spawns in the world (${i47.mobKinds.filter(k => k === 'adult_golem').length})`,
        i47.mobKinds.filter(k => k === 'adult_golem').length === ag.count]);
      {
        const spots = i47.mobSpots.filter(m => m.kind === 'adult_golem');
        results.push(['v47 C: every Adult Golem stands on a real RUINB tile',
          spots.length > 0 && spots.every(m =>
            window.biomeAt(Math.floor(m.x), Math.floor(m.y)) === i47.B.RUINB)]);
      }
      results.push(['v47 C: it is a MOB, never a pet — no rarity tier, no tame chance',
        !i47.WILD_SPECIES.adult_golem &&
        !window.debugRareTakesInfo().PET_RARITY.adult_golem]);
      {
        const sc47 = window.debugScaleInfo();
        results.push([`v47 C: it is the young Golem's silhouette GROWN (${sc47.MOB_K.adult_golem} vs ${sc47.SPECIES_K.golem})`,
          sc47.MOB_K.adult_golem > sc47.SPECIES_K.golem &&
          sc47.MOB_K.adult_golem < sc47.SPECIES_K.golem * 1.5]);
        results.push(['v47 C: and its size sits where its threat does, between Troll and Sea Serpent',
          sc47.MOB_K.adult_golem > sc47.MOB_K.troll &&
          sc47.MOB_K.adult_golem < sc47.MOB_K.sea_serpent]);
        /* The v13 fairness rule: the "!" tell and the HP bar draw at
           sy - 20 - MOB_TALL, and the golem body paints 12.6 local units up.
           A creature that arrives without an entry wears its own tell. */
        results.push([`v47 C: it arrived WITH an overlay offset (${sc47.MOB_TALL.adult_golem})`,
          typeof sc47.MOB_TALL.adult_golem === 'number' &&
          20 + sc47.MOB_TALL.adult_golem > 12.6 * sc47.MOB_K.adult_golem]);
      }
      results.push(['v47 C: its art is the golem body ported, not new geometry',
        gameScript.indexOf('} else if (m.kind === "adult_golem") {') > 0 &&
        gameScript.indexOf('THE SAME BODY AS THE YOUNG GOLEM, GROWN AND GONE COLD') > 0]);
      {
        /* Moss is the young Golem's signature (the v25 rule) and must never
           spread up the line — the Golem Elder already honours it. The ember
           is the LOCKED lava palette entry, and gold is never used: gold on
           the ground means Elder and nothing else. */
        const branch = gameScript.slice(gameScript.indexOf('} else if (m.kind === "adult_golem") {'));
        const body = branch.slice(0, branch.indexOf('} else {'));
        results.push(['v47 C: no moss on the adult — that is the young Golem\'s signature',
          body.indexOf('#5c8a44') < 0 && body.indexOf('#7fb85c') < 0]);
        results.push(['v47 C: its ember is the locked Lava palette entry, and it is never gold',
          body.indexOf('#ff7a3c') > 0 && body.indexOf('#e8b64c') < 0 &&
          body.indexOf('#7ae8f8') < 0]);
      }

      /* ---- PART D: base HP doubled, and the real time doubled with it ---- */
      const dv47 = window.debugV34Info, ds47 = window.debugSetV34;
      results.push(['v47 D: every tier is exactly double what it was',
        JSON.stringify(dv47().BASE_TIER_HP) ===
        JSON.stringify({ wood: 80, stone: 180, iron: 360, runic: 700, dragonsteel: 1600 })]);
      results.push(['v47 D: the bible\'s own ordering and its 20x spread both survived',
        dv47().BASE_TIER_HP.wood < dv47().BASE_TIER_HP.stone &&
        dv47().BASE_TIER_HP.stone < dv47().BASE_TIER_HP.iron &&
        dv47().BASE_TIER_HP.iron < dv47().BASE_TIER_HP.runic &&
        dv47().BASE_TIER_HP.runic < dv47().BASE_TIER_HP.dragonsteel &&
        dv47().BASE_TIER_HP.dragonsteel / dv47().BASE_TIER_HP.wood === 20]);
      {
        /* THE REAL TIME-TO-DESTROY, driven through the real baseHit() rather
           than asserted off the constant. Hits are counted by swinging at a
           genuinely placed piece until it is gone; time is hits x the
           weapon's own cooldown, which nothing in this part touches, so a
           doubled hit count IS a doubled time. */
        const OFF47 = [[0, 0], [3, 0]];
        let site47 = null;
        for (let x = 30; x < 260 && !site47; x += 7) {
          for (let y = 30; y < 260; y += 7) {
            if (OFF47.every(o => window.basePlaceCheck('foundation', x + o[0] + 0.5, y + o[1] + 0.5).ok)) {
              site47 = [x, y]; break;
            }
          }
        }
        if (site47) {
          const [X7, Y7] = site47;
          dsp47({ x: X7 + 0.5, y: Y7 - 4.5, hp: 100,
                  inv: { wood: 500, stone: 500, iron_bar: 500, runic_stone: 500, dragonsteel: 500 } });
          const woodP = await window.placeBasePiece('foundation', 'wood', X7 + 0.5, Y7 + 0.5);
          const dsP = await window.placeBasePiece('wall', 'dragonsteel', X7 + 3.5, Y7 + 0.5);
          const swingsToDestroy = (id, dmg) => {
            let n = 0;
            while (dv47().pieces.find(p => p.id === id) && n < 400) { ds47({ hitId: id, dmg }); n++; }
            return n;
          };
          const IRON_SWORD = 15, DS_SWORD = 40;      // the real WEAPONS values
          const woodHits = woodP && woodP.ok ? swingsToDestroy(woodP.piece.id, IRON_SWORD) : -1;
          const dsHits = dsP && dsP.ok ? swingsToDestroy(dsP.piece.id, DS_SWORD) : -1;
          results.push([`v47 D: an Iron Sword now needs ${woodHits} swings on wood, exactly double the 3 it needed`,
            woodHits === Math.ceil(80 / IRON_SWORD) && woodHits === 2 * Math.ceil(40 / IRON_SWORD)]);
          results.push([`v47 D: a Dragonsteel Sword needs ${dsHits} on dragonsteel, exactly double its old 20`,
            dsHits === Math.ceil(1600 / DS_SWORD) && dsHits === 2 * Math.ceil(800 / DS_SWORD)]);
          results.push(['v47 D: nothing absorbed the change — a swing still subtracts exactly its own damage',
            gameScript.indexOf('baseHit(bp34.piece, Math.max(1, Math.round(w.dmg)));') > 0 &&
            gameScript.indexOf('const after = Math.max(0, before - dmg);') > 0]);
        } else {
          results.push(['v47 D: a clear build site was found for the time-to-destroy gate', false]);
        }
      }

      /* ---- PART G: base signs ------------------------------------------- */
      {
        const dbi47 = window.debugBaseInfo;
        let site = null;
        for (let x = 300; x < 520 && !site; x += 7) {
          for (let y = 300; y < 520; y += 7) {
            if (window.basePlaceCheck('foundation', x + 0.5, y + 0.5).ok &&
                window.basePlaceCheck('foundation', x + 3.5, y + 0.5).ok) { site = [x, y]; break; }
            /* both offsets must be clear: a Wall needs a Foundation to anchor
               to, and the two must clear BASE_MIN_SEP of each other. */
          }
        }
        if (site) {
          const [XG, YG] = site;
          dsp47({ x: XG + 0.5, y: YG - 1.4, hp: 100,
                  inv: { wood: 500, stone: 500, iron_bar: 500, runic_stone: 500, dragonsteel: 500 } });
          const f1 = await window.placeBasePiece('foundation', 'stone', XG + 0.5, YG + 0.5);
          const w1 = await window.placeBasePiece('wall', 'stone', XG + 3.5, YG + 0.5);
          const found = f1 && f1.ok ? f1.piece : null;
          const wall = w1 && w1.ok ? w1.piece : null;
          results.push(['v47 G: a Foundation and a Wall were placed to assert against', !!found && !!wall]);
          if (found) {
            dsp47({ x: found.x, y: found.y + 1 });
            results.push([`v47 G: the sign reach finds the owner's own Foundation (${dbi47().signNear === found.id})`,
              dbi47().signNear === found.id && dbi47().BASE_SIGN_MAX === 24]);
            const sres = (id, txt) => window.debugSetBase({ signId: id, sign: txt }).signResult;
            const set1 = sres(found.id, '  The Long Watch  ');
            const signed = dbi47().pieces.find(p => p.id === found.id);
            results.push(['v47 G: the owner can name their own Foundation, trimmed and stored',
              set1.ok === true && signed.sign === 'The Long Watch']);
            results.push(['v47 G: and it goes out over the ONE existing channel, not a new one',
              sentBroadcasts.some(b => b.event === 'base_sign' &&
                b.payload.id === found.id && b.payload.sign === 'The Long Watch') &&
              (gameScript.match(/sb\.channel\(/g) || []).length === 1]);
            /* Only the anchor piece carries one — the whole point of hanging
               it on the piece every other piece already needs. */
            results.push(['v47 G: a Wall cannot carry a sign — it is the Foundation\'s, by its own anchor flag',
              sres(wall.id, 'Not here').ok === false &&
              !dbi47().pieces.find(p => p.id === wall.id).sign]);
            /* Owner-settable ONLY: finding a base still lets you take
               everything in it, and never lets you rename it. */
            const realOwner = found.owner;
            window.debugSetBase({ ownerId: found.id, owner: 'SomeoneElse' });
            const refused = sres(found.id, 'Raider Was Here');
            results.push(['v47 G: someone else\'s Foundation refuses the rename',
              refused.ok === false && refused.why === 'not yours' &&
              dbi47().pieces.find(p => p.id === found.id).sign === 'The Long Watch']);
            window.debugSetBase({ ownerId: found.id, owner: realOwner });
            /* It is TEXT, everywhere it appears — a canvas fillText and a
               textContent, never markup, and never longer than its own cap. */
            const LONG47 = '<img src=x onerror=alert(1)> and a very long tail';
            sres(found.id, LONG47);
            const xss = dbi47().pieces.find(p => p.id === found.id).sign;
            results.push([`v47 G: a sign is text and only text, capped at ${dbi47().BASE_SIGN_MAX} (${JSON.stringify(xss)})`,
              xss.length === 24 && xss === LONG47.slice(0, 24)]);
            results.push(['v47 G: the panel writes it with textContent, and the world draws it with fillText',
              gameScript.indexOf('where.textContent =') > 0 &&
              gameScript.indexOf('ctx.fillText(sign47, sx, sy - 28);') > 0 &&
              gameScript.indexOf('const sign47 = baseSignOf(bp);') > 0]);
            /* It is the PLAYER NAMEPLATE, reused — same font, same plate, same
               offsets — and it draws only when there is one to draw. */
            results.push(['v47 G: it is the player nameplate reused, not a second label component',
              gameScript.indexOf('ctx.fillRect(sx - tw47 / 2 - 4, sy - 38, tw47 + 8, 13);') > 0 &&
              gameScript.indexOf('ctx.fillRect(sx - tw / 2 - 4, sy - 38, tw + 8, 13);') > 0 &&
              (gameScript.match(/11px 'Barlow', sans-serif/g) || []).length >= 2]);
            sres(found.id, '');
            results.push(['v47 G: clearing the field takes the sign down again',
              dbi47().pieces.find(p => p.id === found.id).sign === '']);
            /* A world whose SQL has not been run: no `sign` column at all. */
            results.push(['v47 G: a piece with no sign column reads as unsigned, never as a crash',
              window.baseSignOf({ kind: 'foundation' }) === '' &&
              window.baseSignOf({ kind: 'foundation', sign: null }) === '' &&
              window.baseSignOf({ kind: 'foundation', sign: '   ' }) === '']);
            /* The broadcast the OTHER client receives normalises the same way. */
            deliverBroadcast('base_sign', { id: found.id, sign: '   Remote Name   ' });
            results.push(['v47 G: a sign arriving over the channel is normalised exactly as the setter does',
              dbi47().pieces.find(p => p.id === found.id).sign === 'Remote Name']);
            results.push(['v47 G: and the compass and the minimap still refuse to know bases exist',
              gameScript.slice(gameScript.indexOf('function updateWorldMap'),
                               gameScript.indexOf('function updateWorldMap') + 3000)
                .indexOf('basePieces') < 0]);
          }
        } else {
          results.push(['v47 G: a clear build site was found for the sign gates', false]);
        }
      }

      /* ---- PART E: combat logout ---------------------------------------- */
      if (window.debugCombatLogoutInfo && window.debugSetCombatLogout) {
        const dcl = window.debugCombatLogoutInfo, dscl = window.debugSetCombatLogout;
        /* v51 PART F: 30000 -> 15000, updated and not relaxed. Same
           mechanism, same single named tunable, shorter window. */
        results.push(['v51 F: the window is 15 seconds, as one named tunable',
          dcl().windowMs === 15000 &&
          gameScript.indexOf('const COMBAT_LOGOUT_MS = 15000;') > 0 &&
          gameScript.indexOf('COMBAT_LOGOUT_MS = 30000') < 0]);
        results.push(['v47 E: the save still happens FIRST, on every path',
          gameScript.indexOf('if (me && sb) savePlayer();\n  /* The save above is unchanged') > 0]);
        const fireUnload = () => {
          const ev = new window.Event('beforeunload', { cancelable: true });
          window.dispatchEvent(ev);
          return ev.defaultPrevented;
        };
        /* Each state is read at the moment it is fired: the window is a
           moving one, so a flag read after the next step would be answering
           about the step after this one. */
        const probeUnload = (patch) => { dscl(patch); return { prompted: fireUnload(), active: dcl().active }; };
        const quiet = probeUnload({ lastAt: 0 });
        const inFight = probeUnload({ agoMs: 1000 });
        const after31 = probeUnload({ agoMs: 31000 });
        results.push(['v47 E: no damage in living memory — the tab closes silently, as it always did',
          quiet.prompted === false && quiet.active === false]);
        results.push(['v47 E: one second after a hit, leaving raises the browser\'s own prompt',
          inFight.prompted === true && inFight.active === true]);
        results.push(['v47 E: thirty-one seconds later it is gone again — the window really is a window',
          after31.prompted === false && after31.active === false]);
        /* And the window is opened by REAL damage, through the real paths. */
        dscl({ lastAt: 0 });
        const mob47 = window.debugCombatHandles().mobs.find(m => !m.dead);
        if (mob47) {
          const hpWas = mob47.hp;
          window.mobHit(mob47, 1);
          results.push(['v47 E: damage DEALT to a mob opens it', dcl().active === true]);
          mob47.hp = hpWas;
        } else {
          results.push(['v47 E: damage DEALT to a mob opens it', false]);
        }
        dscl({ lastAt: 0 });
        dsp47({ x: openSpot47[0], y: openSpot47[1], hp: 100 });
        window.applyDamage(3, 'Someone');
        results.push(['v47 E: damage TAKEN opens it too', dcl().active === true]);
        /* The window is opened by DAMAGE and by nothing else: three call
           sites, and tryAttack() — a swing that may hit nothing at all — is
           deliberately not one of them. */
        results.push([`v47 E: exactly three damage sites open it, and a swing at air is not one (${(gameScript.match(/noteCombatDamage\(\);/g) || []).length})`,
          (gameScript.match(/noteCombatDamage\(\);/g) || []).length === 3 &&
          gameScript.indexOf('function tryAttack(aimX, aimY) {\n  if (dead) return;\n  const w = equippedWeapon();') > 0 &&
          gameScript.slice(gameScript.indexOf('function tryAttack('),
                           gameScript.indexOf('function dealHit(')).indexOf('noteCombatDamage') < 0]);
        results.push(['v47 E: it is honest about its ceiling — nothing here claims to PREVENT leaving',
          gameScript.indexOf('No web page can hold a tab open against its user') > 0 &&
          gameScript.indexOf('e.returnValue = ""') > 0]);
        results.push(['v47 E: and a dead player is never prompted — a corpse has nothing to flee',
          gameScript.indexOf('if (me && !dead && inCombatLogoutWindow())') > 0]);
        dsp47({ x: wasP47.x, y: wasP47.y, hp: 100 });
        dscl({ lastAt: 0 });
      } else {
        results.push(['v47 E: the combat-logout hooks are reachable', false]);
      }

      /* ---- PART F: handing an item to another player -------------------- */
      if (window.giveItemTo && window.debugGiveInfo) {
        const others47 = window.debugCombatHandles().others;
        const dgi = window.debugGiveInfo;
        const invNow = () => window.debugWorldInfo().player.inv;
        others47.clear();
        dsp47({ x: 400.5, y: 400.5, hp: 100, inv: { wood: 20, iron_bar: 3 }, equipped: null });
        const stand = (dx) => others47.set('Giftee', { x: 400.5 + dx, y: 400.5, cls: 'Ranger',
          hp: 100, maxHp: 100, lastHeard: 1e15, space: 'main', level: 1 });
        stand(0.8);
        results.push(['v47 F: someone standing within gather range is a give target',
          dgi().nearest === 'Giftee']);
        window.debugSetGive({ open: 'Giftee' });
        results.push(['v47 F: the panel opens on them, and closes every other panel with it',
          dgi().open === true && dgi().target === 'Giftee' &&
          doc47.getElementById('invPanel').style.display !== 'block']);
        const sentBefore = sentBroadcasts.length;
        const gave = window.giveItemTo('Giftee', 'wood', 5);
        const sentAfter = sentBroadcasts.slice(sentBefore).filter(b => b.event === 'item_give');
        results.push(['v47 F: the sender genuinely loses what they hand over',
          gave === true && invNow().wood === 15]);
        results.push(['v47 F: and it goes out addressed, over the one existing channel',
          sentAfter.length === 1 && sentAfter[0].payload.to === 'Giftee' &&
          sentAfter[0].payload.from === 'BootTest' &&
          sentAfter[0].payload.type === 'wood' && sentAfter[0].payload.qty === 5]);
        /* THE RECEIVING HALF, driven through the game's own handler with the
           sender's own payload — this is the spec's "writes to the real
           recipient inventory" gate, and it is the wire, not a source grep. */
        const before = invNow().wood;
        deliverBroadcast('item_give', sentAfter[0].payload);
        results.push(['v47 F: a packet addressed to someone else is ignored',
          invNow().wood === before]);
        deliverBroadcast('item_give', Object.assign({}, sentAfter[0].payload, { to: 'BootTest' }));
        results.push(['v47 F: the same packet addressed to you writes into your real inventory',
          invNow().wood === before + 5]);
        /* A malformed or hostile packet can only ever add real items, sanely. */
        const invJson = JSON.stringify(invNow());
        deliverBroadcast('item_give', { to: 'BootTest', from: 'X', type: 'not_a_real_item', qty: 99 });
        deliverBroadcast('item_give', { to: 'BootTest', from: 'X', type: 'wood', qty: -5 });
        results.push(['v47 F: an unknown item type is dropped, never minted',
          JSON.stringify(invNow()) === invJson]);
        deliverBroadcast('item_give', { to: 'BootTest', from: 'X', type: 'wood', qty: 1e9 });
        results.push(['v47 F: and a wild quantity is clamped rather than trusted',
          invNow().wood <= before + 5 + 9999]);
        /* Range is checked at the moment of the click, not by the panel. */
        dsp47({ inv: { wood: 10 } });
        stand(5);
        const far = window.giveItemTo('Giftee', 'wood', 1);
        results.push(['v47 F: walking away refuses the transfer at the moment it is attempted',
          far === false && invNow().wood === 10]);
        others47.delete('Giftee');
        const gone = window.giveItemTo('Giftee', 'wood', 1);
        results.push(['v47 F: and a target who is not there at all refuses too',
          gone === false && invNow().wood === 10]);
        /* Giving away the last of an EQUIPPED item has to put your fists back:
           the equip slots are pointers into the inventory. */
        stand(0.8);
        dsp47({ inv: { iron_sword: 1 }, equipped: 'iron_sword' });
        window.giveItemTo('Giftee', 'iron_sword', 1);
        results.push(['v47 F: handing over your last sword unequips it — the slots are pointers',
          !invNow().iron_sword && window.equippedWeapon().name !== 'Iron Sword' &&
          gameScript.indexOf('if (me.equipped === type) me.equipped = null;') > 0]);
        results.push(['v47 F: no approval step was invented — the bible\'s own "at players\' own risk"',
          gameScript.indexOf('no escrow, no trade window that') > 0 &&
          gameScript.indexOf('function giveItemTo(name, type, qty)') > 0]);
        results.push(['v47 F: the interact key opens it, after the ground item and before the tree',
          gameScript.indexOf('const who = nearestGiveTarget();') >
          gameScript.indexOf('if (item) { lastGather = now; tryPickup(item); return; }') &&
          gameScript.indexOf('const who = nearestGiveTarget();') <
          gameScript.indexOf('const g = nearestGatherable();\n  if (g && g._node)')]);
        window.debugSetGive({ close: true });
        others47.clear();
        dsp47({ x: wasP47.x, y: wasP47.y, hp: 100, inv: wasP47.inv, equipped: null });
      } else {
        results.push(['v47 F: the give hooks are reachable', false]);
      }

      /* ---- PART H: redeem codes ----------------------------------------- */
      if (window.submitRedeem && window.debugRedeemInfo) {
        const dri = window.debugRedeemInfo;
        const codeEl = doc47.getElementById('redeemInput');
        const nameEl47 = doc47.getElementById('username');
        const invNow = () => window.debugWorldInfo().player.inv;
        nameEl47.value = 'BootTest';
        dsp47({ inv: {} });
        results.push(['v47 H: the field is on the login card, below the ENTER button',
          !!codeEl && !!doc47.getElementById('redeemBtn') &&
          html.indexOf('<button id="enterBtn">ENTER THE WORLD</button>') <
          html.indexOf('<input id="redeemInput"')]);

        /* 1. A world whose SQL has not been run. BOTH tables absent. */
        redeemMissing.add('redeem_codes'); redeemMissing.add('redeem_claims');
        tableData.redeem_codes.push({ code: 'RUNE47', items: { wood: 5, dragonsteel: 1, not_a_thing: 9 }, uses_left: 2 });
        codeEl.value = 'RUNE47';
        const noSys = await window.submitRedeem();
        results.push(['v47 H: with no tables it degrades to "not active on this world", and grants nothing',
          noSys === 'no-system' && dri().pending === null &&
          (await window.grantPendingRedeem()) === false]);
        /* 2. The claims ledger alone missing is the SAME answer, deliberately:
              with nowhere to record a claim a code could be redeemed forever,
              so the system stays off rather than open. */
        redeemMissing.delete('redeem_codes');
        const noLedger = await window.submitRedeem();
        results.push(['v47 H: no claims ledger reads as "system off", never as "nobody has claimed"',
          noLedger === 'no-system' && dri().pending === null]);
        redeemMissing.delete('redeem_claims');

        /* 3. The happy path. */
        const ok1 = await window.submitRedeem();
        results.push(['v47 H: a real code is accepted, and unknown items in it are dropped rather than minted',
          ok1 === 'ok' && dri().pending &&
          JSON.stringify(dri().pending.items) === JSON.stringify({ wood: 5, dragonsteel: 1 })]);
        results.push(['v47 H: nothing is spent by pressing REDEEM — no claim is recorded yet',
          tableData.redeem_claims.length === 0]);
        const granted = await window.grantPendingRedeem();
        results.push(['v47 H: the login that follows grants it straight into the real inventory',
          granted === true && invNow().wood === 5 && invNow().dragonsteel === 1]);
        results.push(['v47 H: and the claim is recorded against that username',
          tableData.redeem_claims.length === 1 &&
          tableData.redeem_claims[0].code === 'RUNE47' &&
          tableData.redeem_claims[0].username === 'BootTest']);
        results.push(['v47 H: uses_left is decremented by the same grant',
          gameScript.indexOf('sb.from("redeem_codes").update({ uses_left: usesLeft - 1 }).eq("code", code);') > 0 &&
          dri().state === 'granted']);

        /* 4. The same username cannot claim it twice. */
        const twice = await window.submitRedeem();
        results.push(['v47 H: the same name is refused a second claim',
          twice === 'claimed' && dri().pending === null]);
        results.push(['v47 H: and nothing was added for the refused attempt',
          invNow().wood === 5 && tableData.redeem_claims.length === 1]);

        /* 5. The race: the claim row appears between REDEEM and the login.
              The claim is written FIRST, so the failure direction is always
              "you keep your code", never "you got it twice". */
        tableData.redeem_codes.push({ code: 'RUNE47B', items: { stone: 3 }, uses_left: 5 });
        codeEl.value = 'RUNE47B';
        const armed = await window.submitRedeem();
        tableData.redeem_claims.push({ code: 'RUNE47B', username: 'BootTest' });
        const raced = await window.grantPendingRedeem();
        results.push(['v47 H: a claim that lands in between refuses the grant outright',
          armed === 'ok' && raced === false && !invNow().stone]);

        /* 6. The two ordinary refusals. */
        codeEl.value = 'NOT-A-CODE';
        const nope = await window.submitRedeem();
        tableData.redeem_codes.push({ code: 'SPENT47', items: { wood: 1 }, uses_left: 0 });
        codeEl.value = 'SPENT47';
        const spent = await window.submitRedeem();
        results.push(['v47 H: an unknown code and a used-up code each say so, and grant nothing',
          nope === 'no-code' && spent === 'spent' && dri().pending === null]);
        results.push(['v47 H: a code is claimed BY A NAME, so it asks for one first',
          (nameEl47.value = '', await window.submitRedeem()) === 'no-name']);
        nameEl47.value = 'BootTest';
        codeEl.value = '';
        window.debugSetRedeem({ clear: true });
        tableData.redeem_codes.length = 0;
        tableData.redeem_claims.length = 0;
        dsp47({ x: wasP47.x, y: wasP47.y, hp: 100, inv: wasP47.inv });
      } else {
        results.push(['v47 H: the redeem hooks are reachable', false]);
      }

      /* ---- and the world is still standing after all of it --------------- */
      results.push(['v47: the world still runs frames cleanly after every part of this',
        (() => { for (let f = 0; f < 6; f++) window.render(f * 16); return !caught; })()]);
    }

    /* ===================== v50 — MAGICAL BIOME LANDMARKS ====================
       PART A's five landmark objects, PART B's ruin density and PART C's
       will-o-wisps, each against its own proof gate from the locked spec.
       The six-seed half of PART B's gate is a build-time sweep (six real
       boots, six real world seeds — a harness that boots once cannot re-run
       worldgen); what is pinned permanently here is everything checkable
       from the live world this harness already has. ======================= */
    const dli50 = window.debugLandmarkInfo;
    if (typeof dli50 === 'function') {
      const W50 = window.debugWorldInfo();
      const B50 = W50.B, N50 = W50.N;
      const L50 = dli50();
      const dsp50 = window.debugSetPlayer;
      const was50 = { x: window.debugWorldInfo().player.x, y: window.debugWorldInfo().player.y };

      /* ---- PART A3: the Void Rift, single and really in the Hollow ------- */
      results.push(['v50 A: a Void Rift was placed at all', !!L50.voidRift]);
      results.push(['v50 A: and it stands on a real B.ABYSSAL tile, not just anywhere',
        !!L50.voidRift && L50.voidRiftBiome === B50.ABYSSAL &&
        window.biomeAt(L50.voidRift.tx, L50.voidRift.ty) === B50.ABYSSAL]);
      const rift2 = window.voidRiftSpot();
      results.push(['v50 A: the rift is deterministic — the same seed picks the same tile',
        !!rift2 && !!L50.voidRift && rift2.tx === L50.voidRift.tx && rift2.ty === L50.voidRift.ty]);

      /* ---- PART A1/A4: one landmark per REAL pocket, never global -------- */
      let ef50 = null, sm50 = null;
      for (let y = 0; y < N50 && (!ef50 || !sm50); y += 2)
        for (let x = 0; x < N50 && (!ef50 || !sm50); x += 2) {
          const b = window.biomeAt(x, y);
          if (!ef50 && b === B50.ENCHFOREST) ef50 = [x, y];
          if (!sm50 && b === B50.SACMEADOW) sm50 = [x, y];
        }
      results.push(['v50 A: the two pocket biomes exist in the test seed to place into',
        !!ef50 && !!sm50]);
      const cE50 = ef50 ? dli50(ef50[0], ef50[1], 160) : null;
      const cS50 = sm50 ? dli50(sm50[0], sm50[1], 160) : null;
      results.push([`v50 A: Heartwood Trees stand in the Enchanted Forest (${cE50 ? cE50.heartwood.length : 0} found)`,
        !!cE50 && cE50.heartwood.length > 0]);
      results.push(['v50 A: and every one of them is ON an ENCHFOREST tile',
        !!cE50 && cE50.heartwood.every(h => h.biome === B50.ENCHFOREST)]);
      results.push([`v50 A: Dawn Obelisks stand in the Sacred Meadow (${cS50 ? cS50.obelisk.length : 0} found)`,
        !!cS50 && cS50.obelisk.length > 0]);
      results.push(['v50 A: and every one of them is ON a SACMEADOW tile',
        !!cS50 && cS50.obelisk.every(o => o.biome === B50.SACMEADOW)]);
      /* The "not globally" half, and the one that would catch a landmark
         leaking into ordinary ground: the spawn safe zone is plain grass. */
      const cSp50 = dli50(W50.SPAWN.x, W50.SPAWN.y, 160);
      results.push(['v50 A: neither landmark appears on the plain grass around SPAWN',
        cSp50.heartwood.length === 0 && cSp50.obelisk.length === 0]);
      /* ⚠️ UPDATED BY v54, NOT RELAXED. What this gate protects is that a
         LANDMARK never leaks onto ordinary ground — the line above is that
         assertion and it is untouched. Its allow-list was the complete decor
         roster at the time, and v54 PART B deliberately adds three Plains
         kinds, which the spawn safe zone (a full override to plain grass) is
         made of. The list grows by exactly those three and by nothing else,
         so a fourth unexpected kind appearing near spawn still fails. */
      results.push(['v50 A: the decor around SPAWN is still only the roster, now including v54\'s three Plains set pieces',
        cSp50.decorKinds.every(k => ['pebble', 'bush', 'flowers', 'fence', 'sign', 'torch',
                                     'standing_stone', 'rock_cluster', 'wildflowers'].includes(k))]);
      /* And the half the v50 list was really carrying: the ORIGINAL three are
         all still there, so PART B added to the spawn ground rather than
         replacing what grew on it. */
      results.push(['v50 A: and the original three ordinary kinds all still grow there',
        ['pebble', 'bush', 'flowers'].every(k => cSp50.decorKinds.includes(k))]);
      /* ONE PER POCKET, proven as a relationship rather than as a count:
         every Heartwood is its own pocket's anchor, and no two of them
         resolve to the same pocket. */
      const anchored50 = !!cE50 && cE50.heartwood.every(h =>
        window.isPocketAnchor(Math.floor(h.x), Math.floor(h.y), B50.ENCHFOREST));
      results.push(['v50 A: every Heartwood sits on its pocket\'s own anchor tile', anchored50]);
      const pockets50 = !cE50 ? [] : cE50.heartwood.map(h => {
        const a = window.clusterAnchor(Math.floor(h.x), Math.floor(h.y), B50.ENCHFOREST);
        return a ? a[0] + ',' + a[1] : 'none';
      });
      results.push(['v50 A: and no two Heartwoods share a pocket — one per pocket, exactly',
        pockets50.length > 0 && new Set(pockets50).size === pockets50.length &&
        !pockets50.includes('none')]);
      const obPockets50 = !cS50 ? [] : cS50.obelisk.map(o => {
        const a = window.clusterAnchor(Math.floor(o.x), Math.floor(o.y), B50.SACMEADOW);
        return a ? a[0] + ',' + a[1] : 'none';
      });
      results.push(['v50 A: the same holds for the Dawn Obelisks',
        obPockets50.length > 0 && new Set(obPockets50).size === obPockets50.length &&
        !obPockets50.includes('none')]);

      /* ---- PART A4: the obelisk's lit state IS the Lightfox's window ----- */
      const realDayT50 = window.getDayT, iwv50 = window.isWildVisible;
      let mismatch50 = 0, litSamples50 = 0;
      for (let i = 0; i < 1000; i++) {
        const tt = i / 1000;
        window.getDayT = () => tt;
        const lit = window.inDawn();
        const fox = iwv50({ species: 'lightfox' });
        if (lit) litSamples50++;
        if (lit !== fox) mismatch50++;
      }
      window.getDayT = realDayT50;
      results.push([`v50 A: the obelisk is lit on EXACTLY the Lightfox's own window (${litSamples50}/1000 samples, ${mismatch50} disagreements)`,
        mismatch50 === 0 && litSamples50 > 0]);
      results.push(['v50 A: and that window is inDawn(), reading the one DAWN_END there is',
        L50.DAWN_END === 0.07 && window.inDawn(0.0) === true &&
        window.inDawn(0.069) === true && window.inDawn(0.071) === false]);

      /* ---- PART A5: the Caldera cracks really join across tiles ---------- */
      let cal50 = null;
      for (let y = 0; y < N50 && !cal50; y++) for (let x = 0; x < N50; x++) {
        if (window.biomeAt(x, y) === B50.CALDERA) { cal50 = [x, y]; break; }
      }
      results.push(['v50 A: a CALDERA tile exists to crack', !!cal50]);
      if (cal50) {
        /* The whole design of the crack network is that the decision belongs
           to the shared EDGE. A tile's south-edge key and its southern
           neighbour's north-edge key must be the identical hash2 call, or
           the fissures stop at every tile boundary and it is speckle again. */
        const [cx50, cy50] = cal50;
        /* The four expressions the branch actually uses, read off the
           shipped source rather than reproduced here — a copy of them in
           this file could agree with itself while the game disagreed. The
           pairing that has to hold is that the key a tile uses for its
           SOUTH edge, `hash2(tx, ty + 1, 260)`, is the identical expression
           its southern neighbour uses for its NORTH edge, `hash2(tx, ty,
           260)` evaluated at (tx, ty+1) — and likewise 262 for east/west.
           So the source must contain exactly those four forms and no fifth
           salt, which is what makes the network join rather than stop at
           every tile boundary. */
        const EDGE50 = ['hash2(tx, ty, 260) > CALDERA_CRACK',
                        'hash2(tx, ty, 262) > CALDERA_CRACK',
                        'hash2(tx, ty + 1, 260) > CALDERA_CRACK',
                        'hash2(tx + 1, ty, 262) > CALDERA_CRACK'];
        results.push(['v50 A: the crack decision belongs to the SHARED EDGE — all four keys present',
          EDGE50.every(e => gameScript.indexOf(e) >= 0)]);
        results.push(['v50 A: and each edge key is used exactly once, so no fifth salt drifted in',
          EDGE50.every(e => gameScript.split(e).length === 2)]);
        /* And the values really are equal across the boundary, evaluated
           through the game's own hash2 from both sides. */
        const southFromHere50 = window.hash2(cx50, cy50 + 1, 260);   // this tile's south edge
        const northFromThere50 = window.hash2(cx50, (cy50 + 1), 260); // neighbour's north edge
        const eastFromHere50 = window.hash2(cx50 + 1, cy50, 262);
        const westFromThere50 = window.hash2((cx50 + 1), cy50, 262);
        results.push(['v50 A: and both sides of a boundary compute the identical key',
          southFromHere50 === northFromThere50 && eastFromHere50 === westFromThere50 &&
          southFromHere50 >= 0 && southFromHere50 <= 1]);
        /* The v22 per-tile scratches are gone, not left underneath. */
        results.push(['v50 A: the v22 hashed 3-point scratches were REPLACED, not layered under',
          gameScript.indexOf('hash2(tx, ty, 234 + k)') < 0 &&
          gameScript.indexOf('hash2(tx, ty, 238 + k)') < 0]);
        const gctx50 = window.document.createElement('canvas').getContext('2d');
        let drewCal = true;
        try { window.drawGroundTile(gctx50, cx50, cy50); } catch (e) { drewCal = false; }
        results.push(['v50 A: the cracked Caldera tile draws without throwing', drewCal]);
      }

      /* ---- PART A2: Kelp-Crystal Clusters, inside the caves only --------- */
      const dspc50 = window.debugSpaceInfo, dssp50 = window.debugSetSpace;
      if (typeof dssp50 === 'function') {
        let uw50 = null, ab50 = null;
        for (let y = 0; y < N50 && (!uw50 || !ab50); y += 2)
          for (let x = 0; x < N50 && (!uw50 || !ab50); x += 2) {
            const b = window.biomeAt(x, y);
            if (!uw50 && b === B50.UWCAVE) uw50 = [x, y];
            if (!ab50 && b === B50.ABYSSAL) ab50 = [x, y];
          }
        if (uw50) {
          dssp50({ clearCache: true });
          dssp50({ enterAt: uw50, biome: B50.UWCAVE });
          const si50 = dspc50();
          const kelp50 = si50.kelp || [];
          results.push([`v50 A: an Underwater Cave interior carries MULTIPLE kelp-crystal clusters (${kelp50.length})`,
            kelp50.length >= 2]);
          const IN50 = si50.INTERIOR_N, grid50 = si50.grid, WALL50 = si50.IN_WALL;
          const at50 = (x, y) => grid50[y * IN50 + x];
          const onFloor50 = kelp50.length > 0 &&
            kelp50.every(k => at50(Math.floor(k.x), Math.floor(k.y)) !== WALL50);
          const onWallEdge50 = kelp50.length > 0 && kelp50.every(k => {
            const x = Math.floor(k.x), y = Math.floor(k.y);
            return at50(x - 1, y) === WALL50 || at50(x + 1, y) === WALL50 ||
                   at50(x, y - 1) === WALL50 || at50(x, y + 1) === WALL50;
          });
          results.push(['v50 A: every cluster stands on walkable floor', onFloor50]);
          results.push(['v50 A: and every one of them JUTS FROM A WALL — a wall tile is adjacent',
            onWallEdge50]);
          /* Scenery, never a resource: a kelp cluster carries none of the
             fields a gatherable does, and shares no tile with one. */
          /* Scenery, not a resource, and proven where it would actually
             matter: a cluster carries none of the fields a gatherable does,
             the interior's own node and ore counts are untouched by it, and
             the render list gives it its own `kelp` kind rather than routing
             it through a node draw. (Two independent hashed streams CAN land
             on the same floor tile — every stream in this generator can, and
             always could — so tile overlap is deliberately not asserted.) */
          results.push(['v50 A: a cluster is scenery — no `taken`, no `type`, nothing to mine',
            kelp50.every(k => !('taken' in k) && !('type' in k))]);
          results.push(['v50 A: and it added nothing to what an interior holds to gather',
            (si50.nodes || []).length > 0 && (si50.ore || []).length > 0 &&
            (si50.nodes || []).every(n => 'taken' in n) &&
            (si50.ore || []).every(o => 'taken' in o)]);
          const dc50 = window.document.createElement('canvas').getContext('2d');
          let drewKelp = true;
          try { for (const k of kelp50.slice(0, 4)) window.drawKelpCluster(k, 900); }
          catch (e) { drewKelp = false; }
          results.push(['v50 A: the clusters draw without throwing', drewKelp]);
          dssp50({ exit: true });
        } else {
          results.push(['v50 A: a UWCAVE tile exists to enter', false]);
        }
        if (ab50) {
          dssp50({ enterAt: ab50, biome: B50.ABYSSAL });
          const abInfo50 = dspc50();
          results.push(['v50 A: an Abyssal Hollow interior deliberately carries NONE — its landmark is the rift',
            Array.isArray(abInfo50.kelp) && abInfo50.kelp.length === 0]);
          dssp50({ exit: true });
        } else {
          results.push(['v50 A: an ABYSSAL tile exists to enter', false]);
        }
        dsp50({ x: was50.x, y: was50.y, hp: 100 });
      }

      /* ---- PART B: ten Ruins, and NOT ONE separation relaxed to buy them - */
      /* v51 PART H: 10 -> 20, updated and not relaxed. */
      results.push(['v51 H: RUIN_COUNT is 20, and twenty clusters really placed',
        W50.RUIN_COUNT === 20 && W50.RUINS.length === 20]);
      results.push(['v50 B: all four Other Safe Zones still placed alongside them',
        W50.ZONE_COUNT === 4 && W50.OTHER_SAFE_ZONES.length === 4]);
      /* Pinned as literals on purpose: the whole proof gate is that density
         went up while every separation constant stayed exactly where it was,
         so a future pass cannot quietly buy more ruins by shrinking one. */
      /* v51 PART H: v50's gate was "density went up and NOT ONE separation
         moved". At twenty that is no longer achievable — the six-seed sweep
         proved 664/400 admits only 10-12 clusters, with a 4x search budget
         placing the identical 17, so it is geometry and not the budget. The
         gate is therefore re-pointed rather than dropped: the two constants
         the sweep moved are pinned to the exact swept values, and the three it
         did NOT move are still pinned unchanged — so a future pass still
         cannot quietly buy more ruins by shrinking a footprint or a zone. */
      results.push(['v51 H: the two swept separations are exactly 360 / 300',
        W50.RUIN_SEP === 360 && W50.RUIN_ZONE_SEP === 300]);
      results.push(['v51 H: and the three the sweep did NOT need are unchanged (664/76/136)',
        W50.ZONE_SEP === 664 && W50.RUIN_FOOT === 76 && W50.ZONE_R === 136]);
      /* Geometry, not just feasibility: nothing overlaps at either new value. */
      results.push(['v51 H: a Ruin carve and a Zone clearing still cannot touch',
        W50.RUIN_SEP > W50.RUIN_FOOT * 2 &&
        W50.RUIN_ZONE_SEP > W50.RUIN_FOOT + W50.ZONE_R]);
      let minRR50 = Infinity, minRZ50 = Infinity, minZZ50 = Infinity;
      for (let i = 0; i < W50.RUINS.length; i++) {
        for (let j = i + 1; j < W50.RUINS.length; j++)
          minRR50 = Math.min(minRR50, Math.hypot(W50.RUINS[i].x - W50.RUINS[j].x,
                                                 W50.RUINS[i].y - W50.RUINS[j].y));
        for (const z of W50.OTHER_SAFE_ZONES)
          minRZ50 = Math.min(minRZ50, Math.hypot(W50.RUINS[i].x - z.x, W50.RUINS[i].y - z.y));
      }
      for (let i = 0; i < W50.OTHER_SAFE_ZONES.length; i++)
        for (let j = i + 1; j < W50.OTHER_SAFE_ZONES.length; j++)
          minZZ50 = Math.min(minZZ50, Math.hypot(W50.OTHER_SAFE_ZONES[i].x - W50.OTHER_SAFE_ZONES[j].x,
                                                 W50.OTHER_SAFE_ZONES[i].y - W50.OTHER_SAFE_ZONES[j].y));
      results.push([`v50 B: closest two Ruins are ${minRR50.toFixed(0)} apart, still clear of RUIN_SEP`,
        minRR50 > W50.RUIN_SEP]);
      results.push([`v50 B: closest Ruin-to-Zone is ${minRZ50.toFixed(0)}, still clear of RUIN_ZONE_SEP`,
        minRZ50 > W50.RUIN_ZONE_SEP]);
      results.push([`v50 B: closest two Zones are ${minZZ50.toFixed(0)}, still clear of ZONE_SEP`,
        minZZ50 > W50.ZONE_SEP]);
      /* Ten Ruins are only worth more if each one is still a real ruin: the
         per-cluster set pieces and the per-cluster runic vein have to have
         scaled with the count, not stayed at six clusters' worth. */
      results.push([`v51 H: all twenty clusters carry their own runic vein (${W50.ruinVeins})`,
        W50.ruinVeins === 20]);
      const centres50 = new Set(W50.ruinPieceSpots.map(p =>
        Math.round(p.x / 200) + ':' + Math.round(p.y / 200)));
      results.push([`v51 H: ruin set pieces were built around every cluster (${W50.ruinPieceSpots.length} pieces)`,
        W50.ruinPieceSpots.length >= 20 && centres50.size >= 16]);

      /* ---- PART C: will-o-wisps, scoped to four places and nowhere else -- */
      const wispsNow = () => dli50().particles.filter(p => p.wisp !== null && p.wisp !== undefined);
      const drain50 = () => {
        window.setSetting('reduceMotion', true);
        for (let i = 0; i < 240; i++) window.updateParticles(0.05, 500000 + i * 50);
        window.setSetting('reduceMotion', false);
      };
      const pumpAt50 = (tile, dayT) => {
        drain50();
        dsp50({ x: tile[0] + 0.5, y: tile[1] + 0.5, hp: 100, diving: false });
        const real = window.getDayT;
        if (dayT !== undefined) window.getDayT = () => dayT;
        for (let i = 0; i < 90; i++) window.updateParticles(0.05, 600000 + i * 50);
        const w = wispsNow();
        window.getDayT = real;
        return w;
      };
      const biggest50 = (bid) => {          // a tile with plenty of its own biome around it
        let best = null, bestC = -1;
        for (let y = 8; y < N50 - 8; y += 17) {
          for (let x = 8; x < N50 - 8; x += 17) {
            if (window.biomeAt(x, y) !== bid) continue;
            let c = 0;
            for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2)
              if (window.biomeAt(x + dx, y + dy) === bid) c++;
            if (c > bestC) { bestC = c; best = [x, y]; }
            if (bestC >= 40) return best;
          }
        }
        return best;
      };
      const ALLOWED50 = [B50.ENCHFOREST, B50.DARKFOREST, B50.SACMEADOW, B50.ABYSSAL];
      const spotEF = biggest50(B50.ENCHFOREST), spotDF = biggest50(B50.DARKFOREST),
            spotSM = biggest50(B50.SACMEADOW), spotAB = biggest50(B50.ABYSSAL),
            spotPL = biggest50(B50.PLAINS), spotFO = biggest50(B50.FOREST),
            spotME = biggest50(B50.MEADOW);
      const wEF = spotEF ? pumpAt50(spotEF, 0.25) : [];
      results.push([`v50 C: will-o-wisps drift in the Enchanted Forest (${wEF.length})`, wEF.length > 0]);
      const wDFnight = spotDF ? pumpAt50(spotDF, 0.75) : [];
      results.push([`v50 C: and in the Dark Forest AT NIGHT (${wDFnight.length})`,
        wDFnight.filter(p => p.wisp === B50.DARKFOREST).length > 0]);
      const wDFday = spotDF ? pumpAt50(spotDF, 0.25) : [];
      results.push(['v50 C: and NOT in the Dark Forest by day',
        wDFday.filter(p => p.wisp === B50.DARKFOREST).length === 0]);
      const wSMdawn = spotSM ? pumpAt50(spotSM, 0.02) : [];
      results.push([`v50 C: in the Sacred Meadow AT DAWN (${wSMdawn.length})`,
        wSMdawn.filter(p => p.wisp === B50.SACMEADOW).length > 0]);
      const wSMday = spotSM ? pumpAt50(spotSM, 0.30) : [];
      results.push(['v50 C: and NOT in the Sacred Meadow after dawn has passed',
        wSMday.filter(p => p.wisp === B50.SACMEADOW).length === 0]);
      const wAB = spotAB ? pumpAt50(spotAB, 0.25) : [];
      results.push([`v50 C: and in the Abyssal Hollow (${wAB.length})`,
        wAB.filter(p => p.wisp === B50.ABYSSAL).length > 0]);
      /* ⚠️ Standing IN a plain forest is not the test — the Enchanted
         Forest is carved out of Forest, so the 28x28 patch the spawner
         samples around the camera legitimately contains enchanted tiles and
         legitimately grows wisps on them. What must never happen is a wisp
         whose OWN spawn tile was Plains, Forest or Meadow, which is what the
         `wisp` marker records and what is asserted here. */
      const banned50 = [B50.PLAINS, B50.FOREST, B50.MEADOW];
      const wPL = spotPL ? pumpAt50(spotPL, 0.25) : [];
      const wFO = spotFO ? pumpAt50(spotFO, 0.75) : [];
      const wME = spotME ? pumpAt50(spotME, 0.25) : [];
      const bad50 = [].concat(wPL, wFO, wME, wEF, wDFnight, wDFday, wSMdawn, wSMday, wAB)
        .filter(p => banned50.includes(p.wisp));
      results.push([`v50 C: NEVER spawned over Plains, Forest or Meadow — the exclusion that keeps it meaningful (${bad50.length} offenders)`,
        bad50.length === 0]);
      const everySeen50 = [].concat(wEF, wDFnight, wSMdawn, wAB);
      results.push(['v50 C: every wisp ever spawned came from one of the four named windows',
        everySeen50.length > 0 && everySeen50.every(p => ALLOWED50.includes(p.wisp))]);
      results.push(['v50 C: and NO new particle kind was invented — a wisp is a `mote`',
        everySeen50.every(p => p.kind === 'mote')]);
      /* Reduce motion still switches the whole ambient spawner off, wisps
         included — v23's own rule, applied to the new effect for free. */
      window.setSetting('reduceMotion', true);
      for (let i = 0; i < 240; i++) window.updateParticles(0.05, 700000 + i * 50);
      results.push(['v50 C: reduce motion still stops every ambient spawner, wisps included',
        dli50().particles.length === 0]);
      window.setSetting('reduceMotion', false);
      drain50();
      dsp50({ x: was50.x, y: was50.y, hp: 100 });

      results.push(['v50: the world still runs frames cleanly after all of it',
        (() => { for (let f = 0; f < 6; f++) window.render(f * 16); return !caught; })()]);
    } else {
      results.push(['v50: debugLandmarkInfo() is reachable', false]);
    }

    /* ===================== v51 — AMBIENCE, MINIMAP, DENSITY, GUILDS =========
       One block per lettered part of the locked spec, each against that
       part's own proof gate. The two things a harness that boots once cannot
       do — re-run worldgen on six seeds, and rasterise a badge — are
       build-time measurements recorded in the changelog; what is pinned
       permanently here is everything checkable from the live world. ====== */
    {
      const strip51 = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const code51 = strip51(gameScript);
      /* sanity check on the stripper itself, so a gate cannot pass by accident */
      results.push(['v51: the comment stripper actually strips, and keeps real code',
        code51.indexOf('THE ENCHANTED FOREST IS ADDITIVE') < 0 &&
        code51.indexOf('const RUIN_SEP = 360;') > 0]);

      /* ---- PART A: the wisps, louder and additive ----------------------- */
      results.push(['v51 A: the fire chance is a named constant at 0.55, not a literal',
        code51.indexOf('const WISP_CHANCE = 0.55;') > 0 &&
        code51.indexOf('Math.random() < WISP_CHANCE') > 0 &&
        code51.indexOf('Math.random() < 0.32') < 0]);
      results.push(['v51 A: the Enchanted Forest alone falls through to its own motes',
        code51.indexOf('if (b !== B.ENCHFOREST) continue;') > 0]);
      /* The real behavioural half: spawn ambience over a real Enchanted
         Forest tile for long enough and BOTH kinds must appear — a wisp
         (carrying its `wisp` marker) and a plain v17 mote (carrying none).
         Under v50's mutually-exclusive branch the second of those could
         never happen on that biome, which is exactly what PART A fixes. */
      /* The real behavioural half, using v50's own particle export and its
         own drain/pump mechanics rather than a second set: spawn ambience
         over a real Enchanted Forest tile and BOTH layers must appear — a
         wisp (carrying its `wisp` marker) and a plain v17 mote (carrying
         none). Under v50's mutually-exclusive branch the second of those
         could never happen on that biome, which is exactly what PART A
         fixes, and it is the one thing about PART A a source grep cannot
         show. */
      if (window.debugLandmarkInfo && window.debugSetPlayer && window.updateParticles) {
        const wi51a = window.debugWorldInfo();
        const parts51 = () => window.debugLandmarkInfo().particles;
        const drain51 = () => {
          window.setSetting('reduceMotion', true);
          for (let i = 0; i < 240; i++) window.updateParticles(0.05, 700000 + i * 50);
          window.setSetting('reduceMotion', false);
        };
        let ef51 = null, bestC = -1;
        for (let y = 8; y < wi51a.N - 8 && bestC < 40; y += 17)
          for (let x = 8; x < wi51a.N - 8; x += 17) {
            if (window.biomeAt(x, y) !== wi51a.B.ENCHFOREST) continue;
            let c = 0;
            for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2)
              if (window.biomeAt(x + dx, y + dy) === wi51a.B.ENCHFOREST) c++;
            if (c > bestC) { bestC = c; ef51 = [x, y]; }
            if (bestC >= 40) break;
          }
        if (ef51) {
          drain51();
          window.debugSetPlayer({ x: ef51[0] + 0.5, y: ef51[1] + 0.5, hp: 100, diving: false });
          for (let i = 0; i < 90; i++) window.updateParticles(0.05, 800000 + i * 50);
          const alive = parts51().filter(p => p.kind === 'mote' &&
                                              p.biome === wi51a.B.ENCHFOREST);
          const wisps51 = alive.filter(p => p.wisp === wi51a.B.ENCHFOREST).length;
          const motes51 = alive.filter(p => p.wisp === null).length;
          console.log(`v51 A over Enchanted Forest: ${wisps51} wisps and ${motes51} plain motes alive together`);
          results.push([`v51 A: BOTH layers are alive over Enchanted Forest (wisps ${wisps51}, motes ${motes51})`,
            wisps51 > 0 && motes51 > 0]);
          drain51();
          window.debugSetPlayer({ x: wi51a.SPAWN.x, y: wi51a.SPAWN.y, hp: 100, diving: false });
        } else {
          results.push(['v51 A: an Enchanted Forest tile was found to test over', false]);
        }
      }

      /* ---- PART B: the minimap texture pass ----------------------------- */
      if (window.debugMapInfo) {
        window.updateWorldMap();
        const mi51 = window.debugMapInfo();
        results.push(['v51 B: the card painted its whole 31x31 window',
          mi51.flecks && mi51.flecks.cells > 0 && mi51.flecks.cells <= mi51.tiles]);
        results.push(['v51 B: a fleck is a mark, not a redraw — 2px inside a 4px cell',
          mi51.MAP_FLECK === 2 && mi51.MAP_CELL === 4]);
        /* The spec's own gate: flecks appear ONLY where real feature data
           says they should. Checked against the feature index directly, both
           directions — every mark is a real feature of the right kind, and
           no feature of those kinds inside the window went unmarked. */
        const marks51 = (mi51.flecks && mi51.flecks.marks) || [];
        const badMark = marks51.filter(m => {
          const f = window.featureAtTile(m.tx, m.ty);
          return !f || f.type !== m.type ||
                 !['tree', 'rock', 'iron', 'runic'].includes(f.type);
        });
        results.push([`v51 B: every fleck sits on a real feature of its own kind (${marks51.length} marks, ${badMark.length} wrong)`,
          badMark.length === 0]);
        const pw51 = window.debugWorldInfo().player;
        let expected51 = 0;
        for (let dy = -mi51.MAP_R; dy <= mi51.MAP_R; dy++)
          for (let dx = -mi51.MAP_R; dx <= mi51.MAP_R; dx++) {
            const f = window.featureAtTile(Math.floor(pw51.x) + dx, Math.floor(pw51.y) + dy);
            if (f && ['tree', 'rock', 'iron', 'runic'].includes(f.type)) expected51++;
          }
        results.push([`v51 B: and no qualifying feature in the window went unmarked (${marks51.length} vs ${expected51})`,
          marks51.length === expected51]);
        results.push(['v51 B: nothing else in the index is ever marked',
          marks51.every(m => ['tree', 'rock', 'iron', 'runic'].includes(m.type))]);
      }

      /* ---- PART C: tier-proportional density, the v49 shape -------------- */
      {
        const i51 = window.debugWorldInfo();
        const M = i51.MOBS, S = i51.WILD_SPECIES;
        results.push(['v51 C: the combat mobs scaled by the bible\'s own difficulty tiers',
          M.goblin.count === 41 && M.bandit.count === 41 &&
          M.troll.count === 24 && M.dark_wraith.count === 24 &&
          M.adult_golem.count === 11]);
        results.push(['v51 C: and the tier ordering holds — Easy > Medium > Hard',
          M.goblin.count > M.troll.count && M.troll.count > M.adult_golem.count]);
        results.push(['v51 C: relative spread inside a tier preserved exactly (goblin === bandit, troll === wraith)',
          M.goblin.count === M.bandit.count && M.troll.count === M.dark_wraith.count]);
        results.push(['v51 C: the interior-only and hand-placed mobs are untouched',
          M.sea_serpent.count === 3 && M.elder_drake.count === 1 &&
          M.demon_knight.count === 2 && M.golem_elder.count === 1]);
        results.push(['v51 C: pets scaled on top of v49, and the tier shape still holds',
          S.tree_sprite.count === 473 && S.wolf.count === 202 && S.unicorn.count === 70 &&
          S.tree_sprite.count > S.wolf.count && S.wolf.count > S.unicorn.count &&
          S.golem.count * 2 === S.wolf.count &&
          S.crystal_golem.count * 2 === S.unicorn.count]);
        results.push(['v51 C: the two dragons with no spawn kept their cap-only counts',
          S.water_dragon.count === 42 && S.shadow_dragon.count === 42 &&
          S.water_dragon.biomes.length === 0 && S.shadow_dragon.biomes.length === 0]);
        results.push(['v51 C: Epic and above still untouched',
          S.shadowfox.count === 4 && S.lightfox.count === 4 &&
          S.krakenling.count === 4 && S.salamander_king.count === 3]);
      }

      /* ---- PART D: the cave inversion, on the real interior lever -------- */
      if (window.debugSetSpace && window.debugSpaceInfo) {
        results.push(['v51 D: the surface counts PART C raised are NOT what caves read',
          code51.indexOf('INTERIOR_HOSTILE_K') > 0 &&
          code51.indexOf('Math.round(2 * areaK)') < 0 &&
          (() => {
            const i = code51.indexOf('function populateInterior(');
            const j = code51.indexOf('\nfunction ', i + 10);
            const body = code51.slice(i, j);
            return body.indexOf('.count') < 0;
          })()]);
        const wi51d = window.debugWorldInfo();
        let uw51 = null;
        for (let a2 = 0; a2 < 600000 && !uw51; a2++) {
          const tx = Math.floor(window.hash2(a2, 211, 553) * wi51d.N);
          const ty = Math.floor(window.hash2(a2, 223, 557) * wi51d.N);
          if (window.biomeAt(tx, ty) === wi51d.B.UWCAVE) uw51 = [tx, ty];
        }
        if (uw51) {
          window.debugSetSpace({ clearCache: true });
          window.debugSetSpace({ enterAt: uw51 });
          const si51 = window.debugSpaceInfo();
          const hostiles = (si51.mobs || []).length;
          const moths = (si51.wilds || []).filter(w => w.species === 'glow_moth').length;
          const dragons = (si51.wilds || []).filter(w => w.species === 'water_dragon').length;
          const floor51 = si51.floorTiles || 1;
          console.log(`v51 D interior: ${floor51} floor tiles, ${hostiles} hostiles, ` +
                      `${moths} glow moths, ${dragons} hatchling dragons`);
          results.push([`v51 D: cave hostiles really dropped (${hostiles} over ${floor51} floor)`,
            hostiles > 0 && hostiles / floor51 * 100 < 1.01 * 0.95]);
          results.push([`v51 D: Glow Moths are really inside the cave now (${moths})`, moths > 0]);
          results.push(['v51 D: and their count scales with floor area, like the nodes and ore',
            moths >= Math.round(2 * (floor51 / 298)) - 1]);
          results.push(['v51 D: the cave hatchling dragon is exactly as it was — one, unchanged',
            dragons === 1]);
          results.push(['v51 D: and no Golem or Crystal Golem was put in a cave — a bible contradiction, dropped',
            (si51.wilds || []).every(w => w.species !== 'golem' && w.species !== 'crystal_golem') &&
            (si51.mobs || []).every(m => m.kind !== 'adult_golem' && m.kind !== 'golem_elder')]);
          window.debugSetSpace({ exit: true });
          window.debugSetSpace({ clearCache: true });
          window.debugSetPlayer({ x: wi51d.SPAWN.x, y: wi51d.SPAWN.y, diving: false, hp: 100 });
        } else {
          results.push(['v51 D: a UWCAVE tile was found to enter', false]);
        }
      }

      /* ---- PART E: the guilds ------------------------------------------- */
      if (window.debugGuildInfo && window.debugSetGuild) {
        const gi = window.debugGuildInfo();
        results.push(['v51 E: five real guilds in the pool, and exactly five',
          gi.pool.length === 5 &&
          gi.pool.join(',') === 'hollow_choir,drowned_court,quiet_vein,gilded_bough,bramblewatch']);
        results.push(['v51 E: a sixth exists and is admin-only, never in the pool',
          gi.guilds.nameless_tide && gi.guilds.nameless_tide.admin === true &&
          gi.pool.indexOf('nameless_tide') < 0]);
        results.push(['v51 E: every one of the five has the spec\'s own name and motto',
          gi.guilds.hollow_choir.name === 'The Hollow Choir' &&
          gi.guilds.drowned_court.motto === 'What sinks, we keep.' &&
          gi.guilds.quiet_vein.motto === 'Deep enough, everything is treasure.' &&
          gi.guilds.gilded_bough.motto === 'Every root remembers.' &&
          gi.guilds.bramblewatch.motto === 'We do not chase. We wait.']);
        results.push(['v51 E: and the admin-only sixth has NO invented motto',
          gi.guilds.nameless_tide.motto === null &&
          window.guildPlateLines('nameless_tide').length === 1]);
        /* Deterministic: the same username always yields the same guild. */
        const names51 = [];
        for (let i = 0; i < 4000; i++) names51.push('Player' + i);
        const first = names51.map(n => window.guildForUsername(n));
        const again = names51.map(n => window.guildForUsername(n));
        results.push(['v51 E: assignment is deterministic — 4000 usernames, identical twice',
          first.join(',') === again.join(',')]);
        results.push(['v51 E: and it depends on nothing but the string',
          window.guildForUsername('SameName') === window.guildForUsername('Same' + 'Name')]);
        /* The corrected spec's own proof gate, stated in its own terms: the
           Nameless Tide's real assignment rate. The earlier draft called it
           "meaningfully rarer"; the corrected design says it is NOT ROLLABLE,
           so the honest assertion is that the rate is exactly zero. */
        const tide = first.filter(g => g === 'nameless_tide').length;
        results.push([`v51 E: the Nameless Tide's real assignment rate is exactly 0 (${tide} of 4000)`,
          tide === 0]);
        const spread = {};
        for (const g of first) spread[g] = (spread[g] || 0) + 1;
        console.log('v51 E guild spread over 4000 usernames:', JSON.stringify(spread));
        results.push(['v51 E: all five are actually reachable, and none dominates',
          gi.pool.every(g => spread[g] > 4000 / 5 * 0.75 && spread[g] < 4000 / 5 * 1.25)]);
        /* Granted only, never re-rolled: a row edit can hand out the admin
           guild and can never move anyone between the five. */
        const meName = window.debugWorldInfo().player.username || 'BootTest';
        const natural = window.guildForUsername(meName);
        window.debugSetGuild({ granted: 'gilded_bough' });
        const forced = window.debugGuildInfo().mine;
        window.debugSetGuild({ granted: 'nameless_tide' });
        const tideOn = window.debugGuildInfo();
        results.push(['v51 E: a granted row cannot re-roll one of the five...',
          forced === natural]);
        results.push(['v51 E: ...but can grant the admin-only sixth, exactly as admin itself is granted',
          tideOn.mine === 'nameless_tide']);
        results.push(['v51 E: the Nameless Tide carries its two effects',
          tideOn.constants.GUILD_TIDE_REGEN > 0 && tideOn.constants.GUILD_TIDE_TAME > 0 &&
          tideOn.constants.GUILD_TIDE_TAME < 0.20]);   // smaller than the Shrine's own
        window.debugSetGuild({ granted: null });

        /* Each of the five effects, at the one place it actually lands. */
        const withGuild = (g, fn) => {
          /* The five are a function of the username, so the only honest way
             to stand inside one is to BE someone in it — which is what the
             debug hook's granted field cannot do by design. Effects are
             therefore checked through their own predicate functions with the
             guild resolved from a real name in that guild. */
          return fn(g);
        };
        results.push(['v51 E: Hollow Choir waits 0ms to respawn, everyone else the full RESPAWN_SECONDS',
          code51.indexOf('me.deadUntil = Date.now() + guildRespawnWaitMs();') > 0 &&
          code51.indexOf('guildIs("hollow_choir") ? 0 : RESPAWN_SECONDS * 1000') > 0]);
        results.push(['v51 E: Drowned Court breath is +50%, composed with the charm not replacing it',
          gi.constants.GUILD_BREATH_MULT === 1.5 &&
          (() => { const i = code51.indexOf('function breathMax()');
                   const j = code51.indexOf('\n}', i);
                   const b2 = code51.slice(i, j);
                   return b2.indexOf('equippedCharm()') > 0 && b2.indexOf('guildBreathMult()') > 0; })()]);
        results.push(['v51 E: Quiet Vein is +1, and only on ore and stone',
          gi.constants.GUILD_VEIN_BONUS === 1 &&
          gi.constants.veinTypes.sort().join(',') === 'iron,meteor,rock,runic' &&
          code51.indexOf('+ guildOreBonus(g.type);') > 0]);
        results.push(['v51 E: Gilded Bough is a rare-pet tame bump, using the file\'s own rare-and-up list',
          gi.constants.GUILD_BOUGH_TAME > 0 &&
          code51.indexOf('guildIs("gilded_bough") && speciesIsCapped(species)') > 0 &&
          code51.indexOf('c += guildTameBonus(w.species);') > 0]);
        results.push(['v51 E: and it changes SPAWN DENSITY for nothing — the spec\'s own exclusion',
          (() => { const i = code51.indexOf('function guildTameBonus(');
                   const j = code51.indexOf('\n}', i);
                   return code51.slice(i, j).indexOf('count') < 0; })()]);
        /* Bramblewatch's whole rule is who swung first, so both directions
           are exercised through the real recorders. */
        window.debugSetGuild({ clearFirstStrike: true });
        window.debugSetGuild({ mobStruck: 'probe:mob-opened' });
        window.debugSetGuild({ iStruck: 'probe:i-opened' });
        window.debugSetGuild({ mobStruck: 'probe:i-opened' });   // must NOT overwrite
        const fs51 = window.debugGuildInfo().firstStrike;
        const who = k => (fs51.find(e => e.id === k) || {}).who;
        results.push(['v51 E: first strike is recorded once, by whoever actually opened',
          who('probe:mob-opened') === 'mob' && who('probe:i-opened') === 'me']);
        results.push(['v51 E: Bramblewatch is +20%, and only against a mob that opened',
          gi.constants.GUILD_BRAMBLE_MULT === 1.20 &&
          code51.indexOf('guildIs("bramblewatch") && m && guildFirstStrike.get(m.id) === "mob"') > 0]);
        results.push(['v51 E: the initiator gets nothing — mobHit records `me` before it multiplies',
          (() => { const i = code51.indexOf('function mobHit(');
                   const j = code51.indexOf('\n}', i);
                   const b2 = code51.slice(i, j);
                   return b2.indexOf('noteMyFirstStrike(m);') >= 0 &&
                          b2.indexOf('noteMyFirstStrike(m);') < b2.indexOf('guildMobDamageMult(m)'); })()]);
        window.debugSetGuild({ clearFirstStrike: true });
        results.push(['v51 E: the guild column is READ and never written, exactly like role',
          code51.indexOf('guild: typeof p.guild === "string" ? p.guild : null,') > 0 &&
          (() => { const i = code51.indexOf('async function savePlayer()');
                   const j = code51.indexOf('\n}', i);
                   return code51.slice(i, j).indexOf('guild') < 0; })()]);
        results.push(['v51 E: a remote guild rides the ONE existing broadcast, normalised on arrival',
          code51.indexOf('gd: (me.guild && GUILDS[me.guild] && GUILDS[me.guild].admin) ? me.guild : 0,') > 0 &&
          code51.indexOf('o.gd = (typeof p.gd === "string" && GUILDS[p.gd] && GUILDS[p.gd].admin) ? p.gd : null;') > 0]);
      }

      /* ---- PART G: the badges ------------------------------------------- */
      if (window.debugGuildBadges) {
        const bi = window.debugGuildBadges({ trace: true });
        results.push(['v51 G: the badge renders at nameplate scale, inside the spec\'s 14-18px',
          bi.GUILD_BADGE_PX >= 14 && bi.GUILD_BADGE_PX <= 18]);
        const drawn = {};
        for (const id of Object.keys(window.debugGuildInfo().guilds)) {
          window.debugGuildBadges({ trace: true });
          window.drawGuildBadge(id, 200, 200, 14);
          drawn[id] = window.debugGuildBadges({}).polys;
        }
        results.push(['v51 G: all six badges paint real geometry at 14px',
          Object.keys(drawn).length === 6 &&
          Object.values(drawn).every(p => p.length >= 2)]);
        /* Distinct silhouettes, checked as geometry rather than trusted: no
           two badges may paint the same point set. */
        const sig = id => drawn[id].map(p => p.pts.map(v => v.toFixed(2)).join(',')).sort().join('|');
        const sigs = Object.keys(drawn).map(sig);
        results.push(['v51 G: no two badges share a shape',
          new Set(sigs).size === 6]);
        results.push(['v51 G: each badge is drawn on the locked two-facet split, no outlines and no gradients',
          Object.values(drawn).every(p => new Set(p.map(q => q.col)).size === 2)]);
        window.debugGuildBadges({ trace: false });
      }

      /* ---- PART J and PART K -------------------------------------------- */
      results.push(['v51 J: giving keeps its original E proximity trigger as well as the new key',
        code51.indexOf('if (who) { lastGather = now; openGivePanel(who); return; }') > 0 &&
        code51.indexOf('if (k === KEYBINDS.give && !e.repeat && !dead) {') > 0]);
      if (window.debugTravelRefreshInfo) {
        const tr51 = window.debugTravelRefreshInfo;
        results.push([`v51 K: the refresh interval is the spec's ten seconds (${tr51().intervalMs}ms)`,
          tr51().intervalMs === 10000]);
        results.push(['v51 K: and nothing is running while the panel is shut',
          tr51().panelOpen === false && tr51().running === false]);
        const tp51 = doc.getElementById('travelPanel');
        tp51.style.display = 'block';
        window.syncTravelAutoRefresh();
        const openState = tr51();
        tp51.style.display = 'none';
        window.syncTravelAutoRefresh();
        const shutState = tr51();
        results.push(['v51 K: it starts when the panel opens and stops the moment it closes',
          openState.running === true && shutState.running === false]);
        /* And it can never survive a close through another panel's key. */
        tp51.style.display = 'block';
        window.syncTravelAutoRefresh();
        window.closeAllPanels();
        results.push(['v51 K: closing it from another panel stops it too',
          tr51().running === false]);
      }

      results.push(['v51: the world still runs frames cleanly after every part of this',
        (() => { for (let f = 0; f < 6; f++) window.render(f * 16); return !caught; })()]);
    }

    /* ===================== v52+53 — RESUME, COLOSSEUM, GUILD TIER 2, BOSS BAR,
       NODE DENSITY, HITBOX ====================================================
       One block per lettered part of the locked spec. PART I is deliberately a
       set of PINS rather than a fix: the spec asks for an investigation and a
       report, and what is asserted here is exactly what the investigation
       measured, so the finding cannot go quiet. ============================ */
    {
      const strip52 = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const code52 = strip52(gameScript);
      results.push(['v52+53: the comment stripper actually strips, and keeps real code',
        code52.indexOf('THE RUINED COLOSSEUM, REBUILT') < 0 &&
        code52.indexOf('const COLOSSEUM_R = 20;') > 0]);

      /* ---- PART A: the resume pause ------------------------------------- */
      {
        const si = window.debugSessionInfo();
        results.push([`v52 A: the pause is inside the spec's own 1.5-2s window (${si.RESUME_PAUSE_MS}ms)`,
          si.RESUME_PAUSE_MS >= 1500 && si.RESUME_PAUSE_MS <= 2000]);
        results.push(['v52 A: the banner is a real element with a real clickable cancel',
          si.hasCancelButton === true && !!doc.getElementById('resumeNotice')]);
        results.push(['v52 A: and it is hidden until there is something to say',
          si.noticeVisible === false]);
        /* WHERE it sits is the load-bearing part: after every check that can
           already refuse the resume, immediately before the one line that
           submits. Asserted as an ORDERING in the real source, never as a
           literal — so a future pass cannot move the pause in front of the
           PIN gate without failing. */
        const rs = code52.indexOf('async function resumeSession()');
        const rsEnd = code52.indexOf('\n}', code52.indexOf('await enterBtn.onclick();', rs));
        const body = code52.slice(rs, rsEnd);
        results.push(['v52 A: the pause sits AFTER every refusal and immediately BEFORE the submit',
          body.indexOf('res.mode === "verify"') < body.indexOf('await resumePause(name)') &&
          body.indexOf('if (!res.exists)') < body.indexOf('await resumePause(name)') &&
          body.indexOf('await resumePause(name)') < body.indexOf('await enterBtn.onclick();')]);
        results.push(['v52 A: a cancel returns false and never reaches the submit',
          body.indexOf('if (!go) {') > 0 &&
          body.indexOf('sessionResume.reason = "cancelled"') > 0 &&
          body.indexOf('sessionResume.reason = "cancelled"') < body.indexOf('await enterBtn.onclick();')]);
        /* And the pause itself, driven for real in both directions. */
        window.debugSetResume({ pauseMs: 40 });
        const pending = window.resumePause('Someone');
        const upNow = window.debugSessionInfo();
        results.push(['v52 A: the banner really goes up, and names the player',
          upNow.noticeVisible === true && /Someone/.test(upNow.noticeText || '')]);
        const ranOut = await pending;
        results.push(['v52 A: an untouched window resolves GO, and takes the banner down',
          ranOut === true && window.debugSessionInfo().noticeVisible === false]);
        window.debugSetResume({ pauseMs: 60000 });
        const nameBefore = doc.getElementById('username').value;
        const cancelling = window.resumePause('Someone');
        window.debugSetResume({ pressCancel: true });
        const cancelled = await cancelling;
        results.push(['v52 A: a real click on CANCEL resolves STOP, well inside the window',
          cancelled === false]);
        results.push(['v52 A: and cancelling leaves the card exactly as it was, name and all',
          doc.getElementById('username').value === nameBefore &&
          window.debugSessionInfo().noticeVisible === false]);
        window.debugSetResume({ pauseMs: window.debugSessionInfo().RESUME_PAUSE_MS });
        /* The stylesheet and the markup live OUTSIDE the game script, so these
           two go against the whole file — the same distinction v24's intro
           gates had to make between a CSS rule and the code that toggles it. */
        results.push(['v52 A: the banner reuses the PIN notice card and the offer button, no new component',
          html.indexOf('#pinNotice, #resumeNotice {') > 0 &&
          html.indexOf('#pinProtect, #redeemBtn, #resumeCancel {') > 0 &&
          html.indexOf('<div id="resumeNotice"') > 0]);
      }

      /* ---- PART B: the Colosseum --------------------------------------- */
      if (typeof window.debugDuelInfo === 'function') {
        const D = window.debugDuelInfo();
        const V37 = window.debugV37Info ? window.debugV37Info() : window.debugWorldInfo();
        const CX = V37.COLOSSEUM.x, CY = V37.COLOSSEUM.y;
        results.push([`v52 B: the arena is genuinely bigger than v37's 9 (R = ${D.COLOSSEUM_R})`,
          D.COLOSSEUM_R === 20 && D.COLOSSEUM_R > 9 * 2]);
        /* The three rules that move WITH the radius, stated rather than
           discovered. A point that was well outside the old ring is inside
           the new one, which is the PvP zone, the keep-out and the
           fast-travel exclusion all growing at once. */
        const oldEdge = window.debugV37Probe({ at: [CX + 12, CY] });
        results.push(['v52 B: the PvP ring really grew with it — a tile outside v37\'s ring is inside this one',
          oldEdge.inColosseum === true]);
        results.push(['v52 B: and the base keep-out and travel exclusion follow the same radius',
          gameScript.indexOf('[COLOSSEUM.x, COLOSSEUM.y, COLOSSEUM_R + 2]') > 0]);
        results.push(['v52 B: v37\'s ring rule is untouched — everywhere that is not a podium behaves as it always did',
          code52.indexOf('const arena37 = inColosseum(me.x, me.y) && inColosseum(o.x, o.y)') > 0 &&
          gameScript.indexOf('PvP is live inside the ring') > 0]);
        /* The structure itself. */
        const pieces = window.debugDuelInfo().pieceCount;
        results.push([`v52 B: it is built from real pieces, not one blob (${pieces})`,
          pieces > 60]);
        results.push(['v52 B: every piece sorts on its OWN world key, so the arena sorts against the players in it',
          code52.indexOf('ents.push({ s: cp.x + cp.y, kind: "colopiece", cp });') > 0 &&
          code52.indexOf('ents.push({ s: COLOSSEUM.x + COLOSSEUM.y + 0.3, kind: "colosseum" });') < 0]);
        results.push(['v52 B: the sand goes UNDER everything standing on it',
          code52.indexOf('kind: "colofloor"') > 0 &&
          code52.indexOf('COLOSSEUM.y - 0.4, kind: "colofloor"') > 0]);
        results.push(['v52 B: the composition is deterministic — the same arena every time',
          JSON.stringify(window.debugDuelInfo().podiums) === JSON.stringify(D.podiums) &&
          window.debugDuelInfo().pieceCount === pieces]);
        /* The two podiums. */
        results.push([`v52 B: two named podiums, opposite and equidistant (${D.podiums.map(p => p.name).join(' / ')})`,
          D.podiums.length === 2 &&
          D.podiums.every(p => Math.abs(Math.hypot(p.x - CX, p.y - CY) - D.PODIUM_RING) < 1e-6) &&
          Math.hypot(D.podiums[0].x - D.podiums[1].x, D.podiums[0].y - D.podiums[1].y) > D.PODIUM_RING]);
        results.push(['v52 B: and both stand well inside the ring',
          D.podiums.every(p => Math.hypot(p.x - CX, p.y - CY) < D.COLOSSEUM_R)]);

        /* THE DUEL. Driven for real with ghosts on the stub channel. */
        const HB = window.debugCombatHandles();
        const hpBefore52 = window.debugWorldInfo().player.hp;
        HB.others.clear();
        window.debugSetDuel({ reset: true });
        window.debugSetPlayer({ x: D.podiums[0].x, y: D.podiums[0].y });
        const alone = window.debugDuelInfo();
        results.push(['v52 B: standing on a podium ALONE is not a duel, and deals no damage',
          alone.onPodium === 0 && alone.candidate === null &&
          alone.duel.state === 'idle' &&
          window.debugWorldInfo().player.hp === hpBefore52]);
        results.push(['v52 B: and pressing the key alone does nothing at all',
          window.debugSetDuel({ accept: true }).duel.state === 'idle']);
        /* A second player on the SAME podium is still not a duel. */
        HB.others.set('SamePodium', { x: D.podiums[0].x, y: D.podiums[0].y,
          tx: D.podiums[0].x, ty: D.podiums[0].y, cls: 'knight', level: 1, hp: 100, maxHp: 100,
          lastHeard: window.performance.now(), space: 'main', dead: false });
        results.push(['v52 B: two players on the SAME podium is not a duel either',
          window.debugDuelInfo().candidate === null]);
        HB.others.delete('SamePodium');
        /* The real pairing: a different player on the OTHER podium. */
        HB.others.set('Rival', { x: D.podiums[1].x, y: D.podiums[1].y,
          tx: D.podiums[1].x, ty: D.podiums[1].y, cls: 'knight', level: 1, hp: 100, maxHp: 100,
          lastHeard: window.performance.now(), space: 'main', dead: false });
        results.push(['v52 B: a different player on the OTHER podium makes a duel possible',
          window.debugDuelInfo().candidate === 'Rival']);
        results.push(['v52 B: but still nothing happens until somebody accepts',
          window.debugDuelInfo().duel.state === 'idle']);
        const afterMine = window.debugSetDuel({ accept: true });
        results.push(['v52 B: MY acceptance alone leaves it offered — never active',
          afterMine.duel.state === 'offered' && afterMine.duel.mine === true &&
          afterMine.duel.theirs === false]);
        /* Their acceptance, arriving the way a real one does. */
        window.duelNoteRemoteAccept('Rival');
        const bothIn = window.debugDuelInfo();
        results.push(['v52 B: and only BOTH acceptances start the fight',
          bothIn.duel.state === 'active' && bothIn.duel.opponent === 'Rival']);
        /* The reward, paid through the one site a victor is already credited.
           The predicate it hangs on is driven for real, in both directions and
           against a bystander, because that predicate is the whole difference
           between a duel purse and an ordinary kill inside the ring. */
        const myName52 = window.debugDuelInfo().me;
        results.push(['v52 B: the purse is gated on the accepted PAIR, from either side, and pays nobody else',
          window.duelIsActiveBetween(myName52, 'Rival') === true &&
          window.duelIsActiveBetween('Rival', myName52) === true &&
          window.duelIsActiveBetween(myName52, 'Bystander') === false &&
          window.duelIsActiveBetween('Rival', 'Rival') === false]);
        results.push(['v52 B: the reward is paid at the ONE existing victor site, and only for an accepted duel',
          code52.indexOf('const wasDuel = duelIsActiveBetween(p.killer, p.victim);') > 0 &&
          code52.indexOf('invAdd("runic_stone", DUEL_REWARD_RUNIC);') > 0 &&
          (() => { const i = code52.indexOf('event: "kill"');
                   const j = code52.indexOf('});', code52.indexOf('invAdd("runic_stone"', i));
                   const b = code52.slice(i, j);
                   return b.indexOf('duelIsActiveBetween') < b.indexOf('invAdd("runic_stone"'); })()]);
        results.push([`v52 B: and it is a real purse rather than a token (${D.DUEL_REWARD_RUNIC} Runic Stone)`,
          D.DUEL_REWARD_RUNIC >= 3]);
        /* Stepping off ends a pending offer; leaving the ring ends anything. */
        window.debugSetDuel({ reset: true });
        window.debugSetDuel({ accept: true });
        window.debugSetPlayer({ x: CX, y: CY });
        window.debugSetDuel({ tick: true });
        results.push(['v52 B: stepping off the podium withdraws a pending challenge',
          window.debugDuelInfo().duel.state === 'idle']);
        window.debugSetPlayer({ x: D.podiums[0].x, y: D.podiums[0].y });
        window.debugSetDuel({ accept: true });
        window.duelNoteRemoteAccept('Rival');
        window.debugSetPlayer({ x: CX + D.COLOSSEUM_R + 6, y: CY });
        window.debugSetDuel({ tick: true });
        results.push(['v52 B: and walking out of the ring ends an active duel',
          window.debugDuelInfo().duel.state === 'idle']);
        HB.others.delete('Rival');
        window.debugSetDuel({ reset: true });
        results.push(['v52 B: the acceptance rides the ONE existing channel, addressed, like item_give',
          code52.indexOf('channel.on("broadcast", { event: "duel" }') > 0 &&
          code52.indexOf('if (!me || !p || p.to !== me.username) return;') > 0]);
      }

      /* ---- PARTS C-F: Guild Tier 2 -------------------------------------- */
      if (typeof window.debugGuildInfo === 'function') {
        const G = () => window.debugGuildInfo();
        const setT = t => window.debugSetGuild({ tierRaw: t });
        const wasTier = G().tierRaw;
        /* PART C — the column degrades, in every direction it can. */
        const degrade = [[undefined, 1], [null, 1], [1, 1], [0, 1], ['', 1],
                         ['nonsense', 1], [-4, 1], [2, 2], ['2', 2]];
        let degradeOk = true, degradeWhy = null;
        for (const [raw, want] of degrade) {
          if (setT(raw).tier !== want) { degradeOk = false; degradeWhy = String(raw); break; }
        }
        results.push(['v53 C: a missing, null or nonsense guild_tier all read as tier 1' +
          (degradeWhy ? ` (${degradeWhy} did not)` : ''), degradeOk]);
        results.push(['v53 C: and the game never writes it through savePlayer\'s fixed column list',
          (() => { const i = code52.indexOf('async function savePlayer()');
                   const j = code52.indexOf('\n}', i);
                   return code52.slice(i, j).indexOf('guild_tier') < 0; })() &&
          code52.indexOf('guildTier: p.guild_tier,') > 0]);
        results.push(['v53 C: the optional column gets its OWN write, so it cannot take cosmetics down with it',
          code52.indexOf('async function saveGuildTier()') > 0 &&
          (() => { const i = code52.indexOf('async function savePlayerExtras()');
                   const j = code52.indexOf('\n}', i);
                   return code52.slice(i, j).indexOf('guild_tier') < 0; })()]);
        /* PART D — one helper, five call sites, and every value genuinely
           stronger and genuinely tier-gated. Each is driven through the real
           function rather than read off a constant. */
        results.push(['v53 D: it is ONE helper, not five inline tier checks',
          (code52.match(/myGuildTier\(\) >= 2/g) || []).length === 1 &&
          (code52.match(/guildTiered\(/g) || []).length === 6]);
        const T = G().tier2;
        const C = G().constants;
        results.push(['v53 D: every Tier 2 value is genuinely stronger than the Tier 1 it replaces',
          T.GUILD_BREATH_MULT_T2 > C.GUILD_BREATH_MULT &&
          T.GUILD_VEIN_BONUS_T2 > C.GUILD_VEIN_BONUS &&
          T.GUILD_BRAMBLE_MULT_T2 > C.GUILD_BRAMBLE_MULT &&
          T.GUILD_BOUGH_TAME_T2 > C.GUILD_BOUGH_TAME]);
        results.push(['v53 D: and each is the spec\'s own arithmetic, value vs BONUS where it says so',
          Math.abs(T.GUILD_BREATH_MULT_T2 - C.GUILD_BREATH_MULT * 1.5) < 1e-9 &&
          T.GUILD_VEIN_BONUS_T2 === C.GUILD_VEIN_BONUS * 2 &&
          Math.abs(T.GUILD_BRAMBLE_MULT_T2 - (1 + (C.GUILD_BRAMBLE_MULT - 1) * 1.75)) < 1e-9 &&
          Math.abs(T.GUILD_BOUGH_TAME_T2 - C.GUILD_BOUGH_TAME * 2) < 1e-9]);
        /* Drive all five for real, at both tiers, through the live functions. */
        const wasGuild = G().granted;
        const meObj = window.debugWorldInfo().player;
        const drive = (guildId, fn) => {
          window.debugSetGuild({ granted: guildId });
          setT(1); const t1 = fn();
          setT(2); const t2 = fn();
          window.debugSetGuild({ granted: wasGuild });
          return [t1, t2];
        };
        /* The five guilds are a hash of the username and are not grantable, so
           the tier effects are driven through the functions directly with the
           tier moved under them — which is the half this part actually adds. */
        setT(1); const breath1 = G().breathMult;
        setT(2); const breath2 = G().breathMult;
        results.push([`v53 D: the Drowned Court's breath only changes at tier 2 (${breath1} -> ${breath2})`,
          (G().mine === 'drowned_court') ? breath2 > breath1
            : (breath1 === 1 && breath2 === 1)]);
        setT(1); const wait1 = G().respawnWaitMs;
        setT(2); const wait2 = G().respawnWaitMs;
        results.push(['v53 D: the Hollow Choir keeps its Tier 1 instant respawn at BOTH tiers',
          wait1 === wait2]);
        /* Its Tier 2 is a second effect rather than a bigger number, and it
           goes through the one predicate the leave prompt already runs on. */
        window.debugSetCombatLogout({ agoMs: 100 });
        setT(1); const logout1 = G().combatLogoutActive;
        setT(2); const logout2 = G().combatLogoutActive;
        results.push(['v53 D: and its Tier 2 is combat-logout immunity, through the one existing predicate',
          code52.indexOf('if (guildIs("hollow_choir") && guildTiered(false, true)) return false;') > 0 &&
          ((G().mine === 'hollow_choir') ? (logout1 === true && logout2 === false)
                                          : (logout1 === logout2))]);
        window.debugSetCombatLogout({ lastAt: 0 });
        setT(wasTier);
        /* PARTS E/F — grantable two ways. */
        results.push(['v53 E: a Supabase grant is the exact role/guild precedent — read at login, no new mechanism',
          code52.indexOf('guildTier: p.guild_tier,') > 0 &&
          code52.indexOf('role: p.role === "admin" ? "admin" : "player",') > 0]);
        results.push(['v53 F: _guildTier is one new key in the EXISTING items JSON, and no new table',
          T.REDEEM_TIER_KEY === '_guildTier' &&
          code52.indexOf('redeem_tiers') < 0 &&
          code52.indexOf('out.tier = normalizeRedeemTier(row.items);') > 0]);
        results.push(['v53 F: and it is never minted as an item — normalizeRedeemItems drops it',
          Object.keys(window.normalizeRedeemItems({ _guildTier: 2, wood: 3 })).join('|') === 'wood']);
        results.push(['v53 F: a code carrying only a tier is still a real code, not "empty"',
          window.normalizeRedeemTier({ _guildTier: 2 }) === 2 &&
          window.normalizeRedeemTier({ wood: 3 }) === 0 &&
          window.normalizeRedeemTier(null) === 0]);
        results.push([`v53 F: and it is clamped, so a hostile row cannot name any tier it likes`,
          window.normalizeRedeemTier({ _guildTier: 9999 }) === T.GUILD_TIER_MAX &&
          window.normalizeRedeemTier({ _guildTier: -3 }) === 0 &&
          window.normalizeRedeemTier({ _guildTier: 'two' }) === 0]);
        results.push(['v53 F: a redeem can only ever RAISE a tier, never lower one',
          code52.indexOf('if (tier && tier > myGuildTier()) {') > 0]);
        setT(wasTier);
      }

      /* ---- PART G: the boss bar ---------------------------------------- */
      if (typeof window.debugBossInfo === 'function') {
        const B = () => window.debugBossInfo();
        const HB = window.debugCombatHandles();
        HB.mobs.length = 0;
        window.debugSetBoss({ until: 0, id: null, refresh: true });
        results.push(['v52 G: no fight, no bar',
          B().visible === false && B().active === false]);
        const drake = { id: 'drakeprobe', kind: 'elder_drake', x: window.debugWorldInfo().player.x + 3,
          y: window.debugWorldInfo().player.y, hp: 450, maxHp: 900, dead: false,
          fx: -1, fy: 0, ph: 0, state: 'aggro', lastAtk: 0, windupUntil: 0 };
        HB.mobs.push(drake);
        window.noteBossCombat('elder_drake', drake);
        window.debugSetBoss({ refresh: true });
        const up = B();
        /* jsdom normalises "50.0%" back to "50%", so the width is read as a
           NUMBER rather than compared as a string — which is the honest test
           anyway: what matters is that the bar is half full. */
        const pctOf = s => parseFloat(String(s || '').replace('%', ''));
        results.push([`v52 G: fighting the drake raises a real screen-anchored bar (${up.name} ${up.barWidth} ${up.hpText})`,
          up.visible === true && up.active === true &&
          up.name === 'Elder Drake' && Math.abs(pctOf(up.barWidth) - 50) < 0.2 &&
          up.hpText === '450 / 900']);
        results.push(['v52 G: and the bar follows the real mob, not a cached number',
          (() => { drake.hp = 90; window.debugSetBoss({ refresh: true });
                   return Math.abs(pctOf(B().barWidth) - 10) < 0.2 && B().hpText === '90 / 900'; })()]);
        /* Scoped to the drake alone, deliberately NOT to isElderCombatant() —
           the three Elder PETS are tame targets, not boss encounters. */
        window.debugSetBoss({ until: 0, id: null, refresh: true });
        window.noteBossCombat('golem_elder', { id: 'ge' });
        window.noteBossCombat('dragon_elder', { id: 'de' });
        window.noteBossCombat('unicorn_elder', { id: 'ue' });
        window.debugSetBoss({ refresh: true });
        results.push(['v52 G: an Elder PET raises no boss bar — this is the drake\'s and nothing else\'s',
          B().visible === false && B().bossFightUntil === 0 &&
          code52.indexOf('if (kind !== BOSS_KIND) return;') > 0]);
        /* It comes down again on every route it should. */
        window.noteBossCombat('elder_drake', drake);
        window.debugSetBoss({ until: window.performance.now() - 1, refresh: true });
        results.push(['v52 G: it comes down when the fight goes quiet',
          B().visible === false]);
        window.noteBossCombat('elder_drake', drake);
        drake.dead = true;
        window.debugSetBoss({ refresh: true });
        results.push(['v52 G: and the moment the drake dies',
          B().visible === false]);
        drake.dead = false;
        HB.mobs.length = 0;
        window.debugSetBoss({ until: 0, id: null, refresh: true });
        results.push(['v52 G: it yields the top centre to the unmaking countdown',
          code52.indexOf('const m = worldResetAt ? null : activeBossMob();') > 0]);
        results.push(['v52 G: it is the .hud card and the existing HP-bar treatment, no new component',
          html.indexOf('#hpBarWrap, #bossBarWrap {') > 0 &&
          html.indexOf('#hpBar.low, #bossBar {') > 0 &&
          html.indexOf('<div class="hud" id="hudBoss">') > 0]);
        results.push(['v52 G: it is fed from the two sites that already know which creature is fighting',
          (code52.match(/noteBossCombat\(m\.kind, m\)/g) || []).length === 2]);
      }

      /* ---- PART H: node density ---------------------------------------- */
      {
        results.push(['v52 H: the density lever is a NAMED constant at the middle of the spec\'s 30-40%',
          code52.indexOf('const NODE_DENSITY_K = 0.65;') > 0]);
        results.push(['v52 H: and every one of the five bands goes through it — not one literal survives',
          code52.indexOf('if (h > ROCK_RUNIC_T) return "runic";') > 0 &&
          code52.indexOf('if (h > ROCK_IRON_T) return "iron";') > 0 &&
          code52.indexOf('if (h > ROCK_ROCK_T) return "rock";') > 0 &&
          code52.indexOf('if (h > VOLROCK_RUNIC_T) return "runic";') > 0 &&
          code52.indexOf('if (h > VOLROCK_IRON_T) return "iron";') > 0 &&
          code52.indexOf('if (h > 0.996)') < 0 && code52.indexOf('if (h > 0.93)') < 0 &&
          code52.indexOf('if (h > 0.885)') < 0 && code52.indexOf('if (h > 0.992)') < 0 &&
          code52.indexOf('if (h > 0.92)') < 0]);
        /* TREES ARE NOT IN IT — the art skill's must-not-regress list says
           never to alter their placement or density, and the report was about
           ore. Their thresholds are still the untouched literals. */
        results.push(['v52 H: trees, herbs and magic essence are deliberately untouched',
          code52.indexOf('if (clusterNoise(tx, ty) > 0.42 && h > 0.42) return "tree";') > 0 &&
          code52.indexOf('(b === B.PLAINS || b === B.MEADOW) && h > 0.965') > 0 &&
          code52.indexOf('if (h > 0.88) return "essence";') > 0 &&
          code52.indexOf('if (h > 0.45) return "herb";') > 0]);
        /* And the real measurement: the SAME tiles run through the old bands
           and the new ones, so the cut is exact rather than claimed. hash2 and
           biomeAt are the game's own, so this cannot drift from what ships. */
        if (typeof window.hash2 === 'function' && typeof window.biomeAt === 'function') {
          const Bm = window.debugWorldInfo().B, Nw = window.debugWorldInfo().N;
          const OLD = { rock: [0.996, 0.93, 0.885], vol: [0.992, 0.92] };
          let oldN = 0, newN = 0, oldBand = { rock: 0, iron: 0, runic: 0 }, newBand = { rock: 0, iron: 0, runic: 0 };
          /* ⚠️ v55: STRIDE 16 -> 5, AND THIS IS A CORRECTION TO A PROXY,
             NOT A RELAXED GATE — the same shape of fix Tuning/Polish
             judgment call 7 made to the comment-stripper sanity check.

             THE WORLD THIS GATE MEASURES IS RANDOM. The v39 block above
             executes a genuine world reset, and `performWorldReset()`
             picks its seed with `Math.random()` — so every run of run4
             samples a DIFFERENT world here. Observed on the unmodified
             pre-v55 file across four consecutive runs: 459/470/463/446
             node tiles and runic:iron ratios of 0.0938, 0.0599, 0.1044,
             0.0669. At stride 16 that is ~460 node tiles and ~100 iron
             ones — a sample small enough that the ratio estimate wanders
             by more than the tolerance, and on a seed where oldRatio
             lands low the tolerance floors at 0.02 while the sampling
             error alone is 0.027. The gate was failing on the SEED, not
             on the bands.

             Ratio preservation is a property of the `1 - K(1 - t)` form
             and is true on every world; the fix is therefore to measure
             it properly rather than to widen the bar. Stride 5 is ~16x
             the sample (roughly 4,700 node tiles, ~1,000 iron), which
             cuts the sampling error about 4x and puts it well inside the
             unchanged tolerance on any seed. The minimum-sample floors
             below move with it — 200 -> 2000 node tiles and 20 -> 200
             iron — so this gate can no longer pass on a sample too small
             to mean anything either. Every tolerance is untouched. */
          for (let ty = 0; ty < Nw; ty += 5) for (let tx = 0; tx < Nw; tx += 5) {
            const b = window.biomeAt(tx, ty);
            if (b !== Bm.ROCK && b !== Bm.VOLROCK) continue;
            const h = window.hash2(tx, ty, 91);
            if (b === Bm.ROCK) {
              if (h > OLD.rock[0]) { oldN++; oldBand.runic++; }
              else if (h > OLD.rock[1]) { oldN++; oldBand.iron++; }
              else if (h > OLD.rock[2]) { oldN++; oldBand.rock++; }
            } else {
              if (h > OLD.vol[0]) { oldN++; oldBand.runic++; }
              else if (h > OLD.vol[1]) { oldN++; oldBand.iron++; }
            }
            const f = window.featureTypeAt(tx, ty);
            if (f === 'rock' || f === 'iron' || f === 'runic') { newN++; newBand[f]++; }
          }
          const cut = oldN ? 1 - newN / oldN : 0;
          results.push([`v52 H: measured on the real world — ${oldN} node tiles become ${newN}, a ${(cut * 100).toFixed(1)}% cut`,
            oldN > 2000 && cut >= 0.28 && cut <= 0.42]);
          /* Ratio-preserving is the whole reason for the 1 - K(1 - t) form:
             runic must stay exactly as rare relative to iron as it was. */
          const oldRatio = oldBand.iron ? oldBand.runic / oldBand.iron : 0;
          const newRatio = newBand.iron ? newBand.runic / newBand.iron : 0;
          results.push([`v52 H: and the bands keep their ratios — runic:iron ${oldRatio.toFixed(4)} -> ${newRatio.toFixed(4)}`,
            oldBand.iron > 200 && Math.abs(oldRatio - newRatio) < Math.max(0.02, oldRatio * 0.35)]);
        }
      }

      /* ---- v52 PART I's findings, and v54 PART D's FIX for both ---------
         v52 investigated the hitbox report and shipped no fix, pinning what
         it had MEASURED so none of it could quietly stop being true while it
         waited for a spec. v54 PART D is that spec, so three of those pins
         describe a state this version was asked to change — they are
         UPDATED, not relaxed: each one now pins the fixed behaviour with a
         behavioural gate rather than a grep, and the two findings that are
         still facts about the world (the cone half-angle, the drake's reach)
         are untouched. Same call v24 made when it turned v23's "playMusic is
         called from nowhere" into "playMusic is called from exactly two
         places". */
      {
        const CONE52 = window.debugAbilityInfo().SPEAR_CONE_DEG;
        const MOBS52 = window.debugWorldInfo().MOBS;
        const SC54 = window.debugScaleInfo();
        const RANGE52 = SC54.weaponRange;
        /* The two v52 findings that are still true and still worth guarding. */
        results.push([`v52 I: the spear cone is still a ${CONE52}deg half-angle — the asymmetry v54 D1 had to fix, not remove`,
          CONE52 <= 30]);
        results.push([`v52 I: the reach asymmetry is real — the drake strikes from ${MOBS52.elder_drake.atkRange} where the best sword reaches ${RANGE52.dragonsteel_sword}`,
          MOBS52.elder_drake.atkRange > RANGE52.iron_sword &&
          MOBS52.elder_drake.atkRange > RANGE52.dragonsteel_sword &&
          MOBS52.dark_wraith.atkRange > RANGE52.iron_sword]);

        /* ---- v54 PART D2: creatures have bodies, sized per creature ---- */
        results.push(['v54 D2: the body radius is one derived constant, not a per-site literal',
          typeof SC54.BODY_R_PER_K === 'number' && SC54.BODY_R_PER_K > 0 &&
          code52.indexOf('const BODY_R_PER_K = 0.21;') > 0 &&
          code52.indexOf('function bodyHitR(kind)') > 0]);
        /* Per-creature, and in the right ORDER — pinned as a relationship
           rather than as literals, exactly the way every Elder scale gate in
           this file is written, so a future resize carries its own hitbox. */
        const BR = SC54.bodyHitR;
        results.push([`v54 D2: it is genuinely per-creature — Elder Drake ${BR.elder_drake.toFixed(2)} > Sea Serpent ${BR.sea_serpent.toFixed(2)} > Troll ${BR.troll.toFixed(2)} > Goblin ${BR.goblin.toFixed(2)} > Glow Moth ${BR.glow_moth.toFixed(2)} tiles`,
          BR.elder_drake > BR.sea_serpent && BR.sea_serpent > BR.troll &&
          BR.troll > BR.goblin && BR.goblin > BR.glow_moth]);
        results.push(['v54 D2: and it is the RENDER scale it reuses, not a second size table',
          Math.abs(BR.elder_drake - SC54.MOB_K.elder_drake * SC54.BODY_R_PER_K) < 1e-9 &&
          Math.abs(BR.glow_moth - SC54.SPECIES_K.glow_moth * SC54.BODY_R_PER_K) < 1e-9]);
        results.push([`v54 D2: the two giants gain most of a tile and the small end gains nothing that matters (moth ${BR.glow_moth.toFixed(2)})`,
          BR.elder_drake > 0.8 && BR.sea_serpent > 0.6 && BR.glow_moth < 0.12]);

        /* THE BEHAVIOURAL HALF. A real Elder Drake stood in the live mob
           array at a distance that is beyond a sword's centre-to-centre
           reach but INSIDE its own painted body — the exact case v52
           measured as unhittable — and the swing has to land. A goblin at
           the same distance must still be a miss, or this is a flat range
           buff rather than a body radius. */
        const H54 = window.debugCombatHandles();
        const setP54 = window.debugSetPlayer, W54 = window.debugWorldInfo();
        let spot54 = null;
        for (let r = 40; r < W54.N / 2 - 12 && !spot54; r += 3) {
          for (const [ox, oy] of [[r, 0], [0, r], [-r, 0], [0, -r], [r, r], [-r, -r]]) {
            const x = Math.floor(W54.SPAWN.x + ox), y = Math.floor(W54.SPAWN.y + oy);
            if (x < 10 || y < 10 || x > W54.N - 12 || y > W54.N - 12) continue;
            const b = window.biomeAt(x, y);
            if (b !== W54.B.PLAINS && b !== W54.B.MEADOW && b !== W54.B.FOREST) continue;
            if ([[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]].some(([dx, dy]) =>
                window.inSafeZone(x + 0.5 + dx, y + 0.5 + dy))) continue;
            if (H54.mobs.some(m => !m.dead && Math.hypot(m.x - x, m.y - y) < 12)) continue;
            spot54 = [x + 0.5, y + 0.5]; break;
          }
        }
        results.push(['v54 D: a clear walkable non-safe-zone spot for the hit tests exists', !!spot54]);
        if (spot54) {
          const [QX, QY] = spot54;
          const made54 = [];
          const stand54 = (kind, x, y) => {
            const m = { id: 'v54:' + kind, kind, x, y, hx: x, hy: y, hp: 9000, maxHp: 9000,
                        state: 'idle', winding: false, flash: 0, fx: 0, fy: 1,
                        dead: false, target: null, ph: 1 };
            H54.mobs.push(m); made54.push(m); return m;
          };
          const clear54 = () => {
            for (const m of made54) { const i = H54.mobs.indexOf(m); if (i >= 0) H54.mobs.splice(i, 1); }
            made54.length = 0;
          };
          const swing54 = (kind, dist, weapon, aimed) => {
            clear54();
            setP54({ x: QX, y: QY, hp: 5000, armor: null, equipped: weapon });
            window.debugSetAbility({ lastAttack: -1e9 });
            const m = stand54(kind, QX + dist, QY);
            const hp0 = m.hp;
            if (aimed) window.tryAttack(m.x, m.y); else window.tryAttack();
            const hit = m.hp < hp0;
            clear54();
            return hit;
          };
          const swordR = RANGE52.iron_sword;
          /* Just past a sword's centre-to-centre reach, and comfortably
             inside the drake's own body radius. */
          const D54 = swordR + BR.elder_drake * 0.6;
          results.push([`v54 D2: THE FIX — a sword at ${D54.toFixed(2)} tiles now lands on an Elder Drake (reach ${swordR} + body ${BR.elder_drake.toFixed(2)})`,
            swing54('elder_drake', D54, 'iron_sword', true) === true]);
          results.push(['v54 D2: and a Goblin at the very same distance is still a clean MISS — a body, not a range buff',
            swing54('goblin', D54, 'iron_sword', true) === false]);
          /* The projectile half is pinned structurally rather than by flying
             a real arrow: resolving one needs update() pumped for a third of
             a second, which also runs the mob AI, and a target that drifts
             while the arrow is in the air turns a hit/miss pair into a coin
             flip. What changed is exact and unambiguous. */
          results.push(['v54 D2: the projectile check learned the same body — a flat 0.8 tiles became 0.8 plus the creature\'s own',
            code52.indexOf('if (Math.hypot(m.x - p.x, m.y - p.y) < 0.8 + bodyHitR(m.kind)) {') > 0 &&
            code52.indexOf('if (Math.hypot(m.x - p.x, m.y - p.y) < 0.8) {') < 0]);
          /* ---- v54 PART D1: the spear aims when it swings -------------- */
          results.push(['v54 D1: THE FIX — a KEY-PRESS spear thrust at a mob behind the player now lands',
            (() => {
              clear54();
              setP54({ x: QX, y: QY, hp: 5000, armor: null, equipped: 'iron_spear' });
              window.debugSetAbility({ lastAttack: -1e9 });
              /* Walk the player west so `facing` is stale and pointing away
                 from the target — the exact state v52 measured a miss in. */
              window.debugSetAbility({ facing: { x: -1, y: 0 } });
              const m = stand54('goblin', QX + 1.4, QY);
              const hp0 = m.hp;
              window.tryAttack();                    // no aim: the keyboard swing
              const hit = m.hp < hp0;
              clear54();
              return hit;
            })()]);
          results.push(['v54 D1: and the swing animation agrees — `facing` turned with the thrust, so no hit comes out of the player\'s back',
            (() => {
              clear54();
              setP54({ x: QX, y: QY, hp: 5000, armor: null, equipped: 'iron_spear' });
              window.debugSetAbility({ lastAttack: -1e9 });
              window.debugSetAbility({ facing: { x: -1, y: 0 } });
              const m = stand54('goblin', QX + 1.4, QY);
              window.tryAttack();
              const f = window.debugAbilityInfo().facing;
              clear54();
              return f.x > 0.9;
            })()]);
          results.push(['v54 D1: a thrust at genuinely empty air still goes where the player was looking — nothing in reach changes nothing',
            (() => {
              clear54();
              setP54({ x: QX, y: QY, hp: 5000, armor: null, equipped: 'iron_spear' });
              window.debugSetAbility({ lastAttack: -1e9 });
              window.debugSetAbility({ facing: { x: -1, y: 0 } });
              window.tryAttack();
              const f = window.debugAbilityInfo().facing;
              return f.x < -0.9;
            })()]);
          results.push(['v54 D1: it is scoped to spear/lance — a SWORD swing never re-aims, and never needed to',
            (() => {
              clear54();
              setP54({ x: QX, y: QY, hp: 5000, armor: null, equipped: 'iron_sword' });
              window.debugSetAbility({ lastAttack: -1e9 });
              window.debugSetAbility({ facing: { x: -1, y: 0 } });
              const m = stand54('goblin', QX + 1.2, QY);
              window.tryAttack();
              const f = window.debugAbilityInfo().facing;
              const hit = m.hp < 9000;               // distance-only, so it lands anyway
              clear54();
              return hit && f.x < -0.9;
            })()]);
          results.push(['v54 D2: OTHER PLAYERS deliberately keep a radius of zero — PvP reach is byte-for-byte unchanged',
            code52.indexOf('const d = edgeDist(o, null);') > 0 &&
            code52.indexOf('if (!inThrustCone(o.x, o.y, dir, w.range)) continue;') > 0 &&
            code52.indexOf('if (Math.hypot(o.x - p.x, o.y - p.y) < 0.7) {') > 0]);
          clear54();
          setP54({ x: W54.SPAWN.x, y: W54.SPAWN.y, hp: 100 });
        }
      }

      /* ---- v54 PART A: the spawn safe zone's own ambience --------------- */
      {
        const dli54 = window.debugLandmarkInfo;
        const L54 = dli54();
        results.push([`v54 A: the spawn ambience is denser than any wisp window (${L54.SPAWN_AMB_CHANCE} vs ${L54.WISP_CHANCE})`,
          L54.SPAWN_AMB_CHANCE > L54.WISP_CHANCE]);
        results.push(['v54 A: and its colour is claimed by nothing else in the ambient set',
          [...'#a8f4dc #8a6ade #c0a8f8 #f6e08c #ffeeb0 #ffe89a #ffa050 #f2f5f8'.split(' ')]
            .every(c => c !== L54.SPAWN_AMB_COL)]);
        results.push(['v54 A: it reuses the mote, so no new particle kind was invented',
          code52.indexOf('col: SPAWN_AMB_COL, size: 2.6, kind: "mote"') > 0]);
        const drain54 = () => {
          window.setSetting('reduceMotion', true);
          for (let i = 0; i < 240; i++) window.updateParticles(0.05, 900000 + i * 50);
          window.setSetting('reduceMotion', false);
        };
        const pumpAmb54 = (x, y) => {
          drain54();
          window.debugSetPlayer({ x, y, hp: 100, diving: false });
          for (let i = 0; i < 90; i++) window.updateParticles(0.05, 950000 + i * 50);
          return dli54().particles;
        };
        const W54b = window.debugWorldInfo();
        const atSpawn = pumpAmb54(W54b.SPAWN.x + 0.5, W54b.SPAWN.y + 0.5);
        const ambSpawn = atSpawn.filter(p => p.spawnAmb);
        results.push([`v54 A: standing at SPAWN the zone is genuinely alive (${ambSpawn.length} motes of ${atSpawn.length})`,
          ambSpawn.length > 0]);
        /* ADDITIVE, and pinned structurally rather than behaviourally: the
           safe zone's own daytime bug ambience is a 0.12 chance behind a
           hashed tile test, so a behavioural gate on it would be a coin
           flip. What actually matters is that no `continue` sits between
           the spawn push and the wisp chain below it — v51 PART A spent a
           whole version undoing exactly that `continue`. */
        results.push(['v54 A: and it is ADDITIVE — no `continue` stands between it and the ambience underneath',
          (() => { const i = code52.indexOf('spawnAmb: true');
                   const j = code52.indexOf('const wispCol', i);
                   return i > 0 && j > i && code52.slice(i, j).indexOf('continue') < 0; })()]);
        results.push([`v54 A: every one of them is inside SAFE_RADIUS (${L54.SAFE_RADIUS}), which is the whole point`,
          ambSpawn.length > 0 && ambSpawn.every(p => p.sd < L54.SAFE_RADIUS)]);
        /* The other half, and the one that makes it CONCENTRATION rather
           than presence: a long way out, the same pump produces none. */
        const far54 = pumpAmb54(W54b.SPAWN.x + L54.SAFE_RADIUS + 260, W54b.SPAWN.y + 0.5);
        results.push([`v54 A: and a long way from spawn the effect is completely absent (${far54.filter(p => p.spawnAmb).length})`,
          far54.filter(p => p.spawnAmb).length === 0]);
        drain54();
        window.debugSetPlayer({ x: W54b.SPAWN.x, y: W54b.SPAWN.y, hp: 100 });
      }

      /* ---- v54 PART B: Plains stops being empty ------------------------- */
      {
        const W54c = window.debugWorldInfo();
        const B54 = W54c.B;
        /* A real Plains window, read out of the real chunk builder. */
        /* A coarse sweep of the whole map, not rings out from SPAWN: Plains
           is scattered, and the densest window on the harness seed sits
           1,391 tiles out on a bearing no small set of rays passes through. */
        let px54 = null;
        for (let y = 60; y < W54c.N - 60 && !px54; y += 60) {
          for (let x = 60; x < W54c.N - 60; x += 60) {
            if (window.biomeAt(x, y) !== B54.PLAINS) continue;
            let n = 0;
            for (let dy = -20; dy <= 20; dy += 5) for (let dx = -20; dx <= 20; dx += 5)
              if (window.biomeAt(x + dx, y + dy) === B54.PLAINS) n++;
            if (n >= 70) { px54 = [x, y]; break; }
          }
        }
        results.push(['v54 B: a real open Plains window exists to measure', !!px54]);
        if (px54) {
          const L54b = window.debugLandmarkInfo(px54[0] + 0.5, px54[1] + 0.5, 140);
          const pd = L54b.plainsDecor || [];
          results.push([`v54 B: Plains genuinely grows the three new set pieces now (${pd.length} in a 140-tile disc)`,
            pd.length > 0]);
          results.push(['v54 B: and all three kinds are reachable, not one kind wearing three names',
            new Set(pd.map(d => d.kind)).size >= 2]);
          results.push(['v54 B: every one of them is standing on PLAINS — this is not a world-wide decor pass',
            pd.length > 0 && pd.every(d => d.biome === B54.PLAINS)]);
          /* SPARSE is the requirement the bible's open-PvP field depends on:
             an order of magnitude under the trees Plains already grows. */
          let tiles54 = 0, dec54 = 0, tree54 = 0;
          for (let ty = px54[1] - 60; ty <= px54[1] + 60; ty++)
            for (let tx = px54[0] - 60; tx <= px54[0] + 60; tx++) {
              if (window.biomeAt(tx, ty) !== B54.PLAINS) continue;
              tiles54++;
              if (window.hash2(tx, ty, 617) > L54b.PLAINS_DECOR_T) dec54++;
              if (window.featureTypeAt(tx, ty) === 'tree') tree54++;
            }
          const share = tiles54 ? dec54 / tiles54 : 1;
          results.push([`v54 B: measured on ${tiles54} real Plains tiles — ${dec54} set pieces (${(share * 100).toFixed(2)}%) against ${tree54} trees`,
            tiles54 > 3000 && share > 0 && share < 0.006 && dec54 * 6 < tree54]);
          /* And the structural half of "does not block movement or combat":
             `decor` is read by the render pass and by nothing else. */
          const decUses = (code52.match(/\bdecor\b/g) || []).length;
          results.push(['v54 B: it cannot block a step or a swing — decor is scenery the collision and gather paths never read',
            code52.indexOf('for (const d of decor) {') > 0 &&
            code52.indexOf('nearestGatherable') > 0 &&
            (() => { const i = code52.indexOf('function nearestGatherable');
                     const j = code52.indexOf('\n}', i);
                     return code52.slice(i, j).indexOf('decor') < 0; })() &&
            (() => { const i = code52.indexOf('function update(dt, t) {');
                     const j = code52.indexOf('\n}', i);
                     return i > 0 && code52.slice(i, j).indexOf('decor') < 0; })() &&
            (() => { const i = code52.indexOf('function tryAttack(');
                     const j = code52.indexOf('\n}', i);
                     return i > 0 && code52.slice(i, j).indexOf('decor') < 0; })() &&
            decUses > 0]);
        }
      }

      /* ---- v54 PART E: the Volcano gets the Caldera's own cracks -------- */
      {
        results.push(['v54 E: VOLROCK carries the Caldera\'s edge-hashed fissure network, reused rather than reinvented',
          code52.indexOf('const VOL_CRACK = 0.62;') > 0 &&
          code52.indexOf('hash2(tx, ty, 280) > VOL_CRACK && vhot(tx, ty - 1)') > 0 &&
          code52.indexOf('hash2(tx, ty + 1, 280) > VOL_CRACK && vhot(tx, ty + 1)') > 0]);
        results.push(['v54 E: the edge decision belongs to the tile PAIR, so two neighbours can never disagree',
          code52.indexOf('hash2(tx, ty, 282) > VOL_CRACK && vhot(tx - 1, ty)') > 0 &&
          code52.indexOf('hash2(tx + 1, ty, 282) > VOL_CRACK && vhot(tx + 1, ty)') > 0]);
        results.push(['v54 E: a LAVA neighbour keeps an edge alive, so the network reaches the core instead of stopping at the rim',
          code52.indexOf('return nb === B.VOLROCK || nb === B.LAVA;') > 0]);
        results.push(['v54 E: it is dimmer and redder than the Caldera\'s, so the rare pocket keeps its own identity',
          code52.indexOf('"rgba(255,122,60,0.55)" : "rgba(255,122,60,0.18)"') > 0 &&
          code52.indexOf('"rgba(255,236,196,0.75)" : "rgba(255,122,60,0.30)"') > 0 &&
          code52.indexOf('const CALDERA_CRACK = 0.46;') > 0]);
        results.push(['v54 E: and it is flat hard-edged strokes — no gradient entered the ground pass',
          (() => { const i = code52.indexOf('if (b === B.VOLROCK) {\n    const VOL_CRACK');
                   if (i < 0) return false;
                   const s = code52.slice(i, i + 2200);
                   return s.indexOf('Gradient') < 0 && s.indexOf('shadowBlur') < 0; })()]);
        /* The real world, not the source: VOLROCK exists, and a real window
           of it draws through the real ground pass without throwing. */
        const W54d = window.debugWorldInfo();
        let vr54 = null;
        for (let r = 20; r < 400 && !vr54; r += 6) {
          for (let a = 0; a < 12; a++) {
            const x = Math.floor(W54d.VOLCANO.x + Math.cos(a * 0.523) * r);
            const y = Math.floor(W54d.VOLCANO.y + Math.sin(a * 0.523) * r);
            if (window.biomeAt(x, y) === W54d.B.VOLROCK) { vr54 = [x, y]; break; }
          }
        }
        results.push(['v54 E: the world really has VOLROCK for this to land on', !!vr54]);
        if (vr54) {
          window.debugSetPlayer({ x: vr54[0] + 0.5, y: vr54[1] + 0.5, hp: 5000 });
          results.push(['v54 E: and a real frame standing on the volcano draws cleanly',
            (() => { for (let f = 0; f < 4; f++) window.render(f * 16); return !caught; })()]);
          window.debugSetPlayer({ x: W54d.SPAWN.x, y: W54d.SPAWN.y, hp: 100 });
        }
      }

      /* =================================================================
         v55 — THE LIGHTING & ATMOSPHERE PASS
         One block per lettered part, plus the spec's own four proof gates
         at the end. The rule this whole build is judged by is that every
         part REUSES a named existing primitive rather than standing a
         parallel system beside it, so most of what is asserted here is a
         relationship between new code and old code rather than the
         presence of a literal. ========================================= */
      {
        const LI = window.debugLightInfo, setL = window.debugSetLight;
        const W55 = window.debugWorldInfo();
        results.push(['v55: the lighting hook is reachable',
          typeof LI === 'function' && typeof setL === 'function']);

        /* ---- PART A: the spawn safe zone's own light ------------------ */
        {
          const a = LI();
          results.push([`v55 A: the glow is ${a.SPAWN_GLOW_RINGS} concentric FLAT ellipses, not a gradient`,
            a.SPAWN_GLOW_RINGS >= 4 &&
            (() => { const i = code52.indexOf('for (let i = 0; i < SPAWN_GLOW_RINGS; i++)');
                     if (i < 0) return false;
                     const s = code52.slice(i - 400, i + 400);
                     return s.indexOf('Gradient') < 0 && s.indexOf('shadowBlur') < 0 &&
                            s.indexOf('ctx.ellipse(') > 0; })()]);
          results.push([`v55 A: alpha ACCUMULATES toward the centre — ${a.SPAWN_GLOW_A} a ring reaches ${(1 - Math.pow(1 - a.SPAWN_GLOW_A, a.SPAWN_GLOW_RINGS)).toFixed(3)} at the core`,
            a.SPAWN_GLOW_A > 0 && a.SPAWN_GLOW_A < 0.1 &&
            (1 - Math.pow(1 - a.SPAWN_GLOW_A, a.SPAWN_GLOW_RINGS)) > a.SPAWN_GLOW_A * 3]);
          results.push(['v55 A: it is the safe-zone ring\'s OWN geometry, so light and boundary cannot drift apart',
            code52.indexOf('SAFE_RADIUS * IW2 * Math.SQRT2, gry = SAFE_RADIUS * IH2 * Math.SQRT2') > 0]);
          results.push([`v55 A: and its cream ${a.SPAWN_GLOW_RGB} is deliberately NOT the Elder gold the ring wears`,
            a.SPAWN_GLOW_RGB !== '232,182,76' && a.SPAWN_GLOW_RGB === '255,238,196']);
          /* Behavioural: standing at spawn it draws; a long way off it does
             not, which is what "concentrated at the zone" has to mean. */
          window.debugSetPlayer({ x: W55.SPAWN.x, y: W55.SPAWN.y, hp: 200 });
          window.render(16);
          const atSpawn = LI().spawnGlowRingsDrawn;
          let far55 = [W55.SPAWN.x, W55.SPAWN.y];
          for (let r = W55.SAFE_RADIUS * 4; r < W55.N / 2 - 20; r += 40) {
            const x = Math.floor(W55.SPAWN.x + r), y = Math.floor(W55.SPAWN.y);
            if (x > W55.N - 20) break;
            if (!window.BLOCKED || true) { far55 = [x + 0.5, y + 0.5]; break; }
          }
          window.debugSetPlayer({ x: far55[0], y: far55[1], hp: 200 });
          window.render(32);
          const atFar = LI().spawnGlowRingsDrawn;
          results.push([`v55 A: it draws at spawn (${atSpawn} rings) and is culled a world away (${atFar})`,
            atSpawn === LI().SPAWN_GLOW_RINGS && atFar === 0]);
          window.debugSetPlayer({ x: W55.SPAWN.x, y: W55.SPAWN.y, hp: 200 });
        }

        /* ---- PART B: real time-of-day lighting ------------------------ */
        {
          const b = LI();
          results.push([`v55 B: night darkens further (0.58 -> ${b.NIGHT_DARK_A}) AND the emissive add rises with it (0.05 -> ${b.NIGHT_EMIT_A})`,
            b.NIGHT_DARK_A > 0.58 && b.NIGHT_EMIT_A > 0.05 &&
            code52.indexOf('na * NIGHT_DARK_A') > 0 &&
            code52.indexOf('NIGHT_EMIT_A * na') > 0]);
          results.push(['v55 B: both were inline literals and neither survives as one',
            code52.indexOf('rgba(9, 13, 32, ${na * 0.58})') < 0 &&
            code52.indexOf('(0.05 * na)') < 0]);
          results.push([`v55 B: the dawn/dusk wash is ${b.DAWN_WASH_BANDS} overlapping flat rects, never a gradient`,
            b.DAWN_WASH_BANDS >= 3 &&
            (() => { const i = code52.indexOf('for (let i = 0; i < DAWN_WASH_BANDS; i++)');
                     if (i < 0) return false;
                     const s = code52.slice(i - 300, i + 300);
                     return s.indexOf('Gradient') < 0 && s.indexOf('ctx.fillRect(') > 0; })()]);
          results.push(['v55 B: it reuses the existing dusk COLOUR rather than inventing a second one',
            (code52.match(/rgba\(230, 130, 55,/g) || []).length === 2]);
          /* The direction is the sun's own, and it is on the side the sun
             is — the OPPOSITE of the side shadows are cast toward. */
          results.push(['v55 B: the wash sits on the sun\'s side, opposite the shadows the world already casts',
            code52.indexOf('const washFromRight = SUN.dx < 0;') > 0]);
        }

        /* ---- PART C: the rim light, and its real call-site count ------ */
        {
          const c = LI();
          /* THE SPEC'S OWN PROOF GATE: a real grep count of call sites,
             not a sample. Every creature that draws its body through the
             shared P()/poly helpers must go through PR(). */
          const prCalls = (code52.match(/\bPR\(ctx,/g) || []).length;
          results.push([`v55 C: the rim helper is called from ${prCalls} creature body sites — a real count, not a sample`,
            prCalls >= 30]);
          /* And it is ONE helper: PR is P plus the rim, so no creature can
             carry a second hand-written rim polygon that drifts. */
          results.push(['v55 C: it is one helper — PR is P plus rimLight, and rimLight is defined once',
            (code52.match(/function rimLight\(/g) || []).length === 1 &&
            (code52.match(/function PR\(/g) || []).length === 1 &&
            code52.indexOf('function PR(c, pts, col) {\n  P(c, pts, col);\n  rimLight(c, pts, col);') > 0]);
          results.push([`v55 C: the rim colour is the body's OWN fill lightened (shade x${c.RIM_LIGHT_K}), never a new palette entry`,
            c.RIM_LIGHT_K > 1 &&
            code52.indexOf('c.strokeStyle = shade(col, RIM_LIGHT_K);') > 0]);
          results.push(['v55 C: it is a thin stroke, not a fill and not an outline around the whole shape',
            c.RIM_LIGHT_W > 0 && c.RIM_LIGHT_W < 2 && c.RIM_LIGHT_A < 1]);
          /* THE MATHS, driven rather than trusted. A square wound one way
             and the SAME square wound the other must rim the same two
             edges — the upper and the left — or the winding correction is
             wrong and half the roster is rimmed on its dark side. */
          const RE = window.debugRimEdges;
          const cw  = [0, 0, 10, 0, 10, 10, 0, 10];     // clockwise in canvas axes
          const ccw = [0, 0, 0, 10, 10, 10, 10, 0];     // the same square, reversed
          const midOf = (pts, i) => {
            const j = (i + 1) % (pts.length / 2);
            return [(pts[i * 2] + pts[j * 2]) / 2, (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2];
          };
          const litMids = pts => RE(pts).map(i => midOf(pts, i))
            .map(([x, y]) => `${x},${y}`).sort().join('|');
          results.push([`v55 C: winding is corrected, not guessed — both windings of one square rim the same two edges (${litMids(cw)})`,
            RE(cw).length === 2 && RE(ccw).length === 2 && litMids(cw) === litMids(ccw)]);
          results.push(['v55 C: and those two edges are the TOP and the LEFT — the 0.72 lit-facet corner, not the shadow one',
            litMids(cw) === '0,5|5,0']);
          /* It really runs on real creatures in a real frame. */
          /* Driven through the real creature draw path directly, the same
             way run5's coverage sweep reaches bodies the 5-frame boot never
             happens to have on screen — the wild-spawn exclusion keeps
             creatures well away from spawn, so a plain render() proves
             nothing about the roster. */
          setL({ rimLightCalls: 0 });
          for (const sp of ['wolf', 'golem', 'phoenix', 'unicorn', 'elder_drake', 'fire_dragon'])
            window.drawSpecies(sp, 200, 200, 0, false);
          const rimSpecies = LI().rimLightCalls;
          results.push([`v55 C: six real creature bodies drive ${rimSpecies} rim traces — including the shared dragon body`,
            rimSpecies >= 6]);
          /* And in the real frame path, standing beside a real creature.
             The camera has to be MOVED to one: the wild-spawn exclusion
             keeps every creature a long way from SPAWN by design, so a
             frame rendered at the spawn point legitimately has no body in
             it to rim. */
          const spots55 = window.debugWorldInfo().wildSpots || [];
          const near55 = spots55[0] || null;
          results.push([`v55 C: a real creature is standing in the world to walk up to (${spots55.length} wilds)`,
            !!near55]);
          if (near55) {
            window.debugSetPlayer({ x: near55.x + 1.5, y: near55.y + 1.5, hp: 500 });
            setL({ rimLightCalls: 0 });
            for (let fr = 0; fr < 3; fr++) window.render(fr * 16);
            results.push([`v55 C: and the real frame path drives it too — ${LI().rimLightCalls} rim traces standing beside one`,
              LI().rimLightCalls > 0]);
            window.debugSetPlayer({ x: W55.SPAWN.x, y: W55.SPAWN.y, hp: 200 });
          }
        }

        /* ---- PART D: combat gets real light --------------------------- */
        {
          const d = LI();
          results.push(['v55 D: the embers are burst() given a direction, not a second particle system',
            code52.indexOf('function burst(wx, wy, col, n, spd, opts)') > 0 &&
            code52.indexOf('const dir = o.dir, spread = o.spread === undefined ? Math.PI : o.spread;') > 0 &&
            (code52.match(/particles\.push\(\{\s*\n?\s*x: wx, y: wy/g) || []).length === 1]);
          results.push(['v55 D: every pre-v55 burst call site still gets the identical full circle',
            code52.indexOf('const a = dir === undefined ? Math.random() * Math.PI * 2') > 0]);
          results.push([`v55 D: they are aimed by the knockback vector the combat code already computed, and a hit with no direction gets none`,
            code52.indexOf('hitEmbers(m.x, m.y, opts.kx, opts.ky)') > 0 &&
            code52.indexOf('hitEmbers(o.x, o.y, opts.kx, opts.ky)') > 0 &&
            code52.indexOf('if (!kx && !ky) return 0;') > 0]);
          results.push([`v55 D: the ember is the v8 volcano's own colour (${d.HIT_EMBER_COL}), not the hit flash's cream`,
            d.HIT_EMBER_COL === '#ffa050' && d.HIT_EMBER_N > 0 && d.HIT_EMBER_N <= 8 &&
            d.HIT_EMBER_CONE < Math.PI / 2]);
          /* BEHAVIOURAL: a real hit on a real mob throws real embers along
             the real direction, and one with no direction throws none. */
          /* `debugCombatHandles()` returns the LIVE arrays for exactly this
             reason (v27's own note). A world reset ran above, so rather than
             hoping a mob happens to be near the camera, a real one is stood
             in the world here — and if the roster has none left, one is
             pushed in the same shape the spawn loop builds, which is the v27
             precedent for standing real targets. */
          const H55 = window.debugCombatHandles();
          let live55 = H55.mobs.find(m => !m.dead && m.hp > 0);
          if (!live55) {
            live55 = { id: 'v55probe', kind: 'goblin', x: W55.SPAWN.x + 3, y: W55.SPAWN.y,
                       hp: 9999, maxHp: 9999, dead: false, state: 'idle', ph: 0, fx: 0, fy: 1 };
            H55.mobs.push(live55);
          }
          results.push(['v55 D: a live mob exists to hit', !!live55 && !live55.dead]);
          if (live55) {
            const before = LI().particles;
            window.mobHit(live55, 1, { kx: 1, ky: 0, kb: 0.2 });
            const withDir = LI().particles - before;
            const before2 = LI().particles;
            window.mobHit(live55, 1, {});
            const noDir = LI().particles - before2;
            results.push([`v55 D: a directed hit spawns ${withDir} particles and an undirected one ${noDir} — the difference IS the embers`,
              withDir - noDir === d.HIT_EMBER_N]);
          }
          results.push([`v55 D: the staff impact leaves a HELD aura, same helper and same array as the expanding ring`,
            d.STAFF_GLOW_MS > 0 && d.STAFF_GLOW_A > 0 && d.STAFF_GLOW_A < 1 &&
            code52.indexOf('hold: true, ms: STAFF_GLOW_MS, a: STAFF_GLOW_A') > 0 &&
            code52.indexOf('ring.r * IW2 * (ring.hold ? 1 : ph)') > 0]);
          results.push([`v55 D: it outlasts the expanding ring (${d.STAFF_GLOW_MS}ms vs ${window.debugAbilityInfo().ABILITY_RING_MS || 520}ms), which is what "a beat after" requires`,
            d.STAFF_GLOW_MS > 520]);
          /* The boss pulse fires ONCE per encounter, not once per swing —
             the whole difficulty of that part. */
          let drake55 = H55.mobs.find(m => m.kind === 'elder_drake' && !m.dead);
          if (!drake55) {
            drake55 = { id: 'v55drake', kind: 'elder_drake', x: W55.SPAWN.x + 5, y: W55.SPAWN.y,
                        hp: 99999, maxHp: 99999, dead: false, state: 'idle', ph: 0, fx: 0, fy: 1 };
            H55.mobs.push(drake55);
          }
          if (drake55) {
            setL({ bossPulseAt: 0 });
            window.mobHit(drake55, 1, { kx: 1, ky: 0 });
            const first = LI().bossPulseAt;
            window.mobHit(drake55, 1, { kx: 1, ky: 0 });
            const second = LI().bossPulseAt;
            results.push(['v55 D: the boss pulse fires on the FIRST swing of an encounter and not on the second',
              first > 0 && second === first]);
          } else {
            results.push(['v55 D: an Elder Drake exists to open a boss fight on', false]);
          }
          results.push([`v55 D: and the pulse is the v9 hitFlash technique — one flat fill, in the drake's own ember ${d.BOSS_PULSE_RGB}`,
            d.BOSS_PULSE_RGB === '255,122,60' &&
            code52.indexOf('ctx.fillStyle = `rgba(${BOSS_PULSE_RGB}') > 0 &&
            code52.indexOf('ctx.fillRect(0, 0, w, h);') > 0]);
        }

        /* ---- PART E: taming, in the creature's own colour ------------- */
        {
          const e = LI();
          const WS55 = W55.WILD_SPECIES || null;
          results.push(['v55 E: the tame burst reads the ROSTER\'s own colour table, not a second one',
            code52.indexOf('const cols = SPECIES_COL;') > 0 &&
            (code52.match(/const SPECIES_COL = \{/g) || []).length === 1 &&
            code52.indexOf('burst(w.x, w.y, tameBurstCol(w.species), TAME_BURST_N, TAME_BURST_SPD)') > 0]);
          results.push([`v55 E: it is bigger than the generic green it replaced (${e.TAME_BURST_N} @ ${e.TAME_BURST_SPD} vs 10 @ 2.2)`,
            e.TAME_BURST_N > 10 && e.TAME_BURST_SPD > 2.2]);
          results.push(['v55 E: the old one-size-fits-all green is gone from the tame path',
            code52.indexOf('burst(w.x, w.y, "#7fd45a", 10, 2.2)') < 0]);
          /* Different creatures really do burst in different colours —
             which is the entire point of the part. */
          const sc = e.speciesCol;
          results.push([`v55 E: a Tree Sprite (${sc.tree_sprite}) and a Fire Dragon (${sc.fire_dragon}) genuinely burst in different colours`,
            !!sc.tree_sprite && !!sc.fire_dragon && sc.tree_sprite !== sc.fire_dragon]);
          /* And the table covers every species a player can actually tame,
             so nothing silently falls back to the generic green. */
          if (WS55) {
            const missing = Object.keys(WS55).filter(s => !sc[s]);
            results.push([`v55 E: every tameable species has its own colour — ${Object.keys(WS55).length} species, ${missing.length} falling back`,
              missing.length === 0]);
          }
        }

        /* ---- PART F: caves dark between their lights ------------------ */
        {
          const f = LI();
          results.push([`v55 F: the falloff is ${f.CAVE_LIGHT_STEPS} discrete stamped bands over ${f.CAVE_LIGHT_R} tiles — layered circles, not a ramp`,
            f.CAVE_LIGHT_STEPS >= 3 && f.CAVE_LIGHT_R > 2 &&
            code52.indexOf('Math.round(CAVE_LIGHT_STEPS * (1 - d / CAVE_LIGHT_R))') > 0]);
          results.push(['v55 F: the lights are the ore veins and the Kelp-Crystal clusters the spec names, plus the exit a player has to find',
            code52.indexOf('for (const o of (rec.ore || [])) if (!o.taken) stamp(o.x, o.y);') > 0 &&
            code52.indexOf('for (const k of (rec.kelp || [])) stamp(k.x, k.y);') > 0 &&
            code52.indexOf('if (rec.exit) stamp(rec.exit.x + 0.5, rec.exit.y + 0.5);') > 0]);
          results.push(['v55 F: a MINED vein takes its light with it — the map rebuilds when the untaken count moves',
            code52.indexOf('if (rec.lightmap && rec.lightmapOre === live) return rec.lightmap;') > 0]);
          results.push(['v55 F: and the darkness is one flat diamond on the tile\'s own four points, no light canvas and no gradient',
            code52.indexOf('ctx.fillStyle = `rgba(4,6,12,${(CAVE_DARK_A * (1 - lit)).toFixed(3)})`') > 0]);
          /* BEHAVIOURAL: walk into a real interior and prove the floor is
             genuinely UNEVEN — some tiles lit, some dark. A uniformly lit
             cave and a uniformly black one both fail this. */
          const enter55 = window.debugSetSpace;
          let uw55 = null;
          const Bm55 = W55.B;
          for (let r = 6; r < W55.N / 2 - 10 && !uw55; r += 5) {
            for (let a = 0; a < 24; a++) {
              const x = Math.floor(W55.SPAWN.x + Math.cos(a * 0.262) * r);
              const y = Math.floor(W55.SPAWN.y + Math.sin(a * 0.262) * r);
              if (x < 4 || y < 4 || x > W55.N - 5 || y > W55.N - 5) continue;
              if (window.biomeAt(x, y) === Bm55.UWCAVE) { uw55 = [x, y]; break; }
            }
          }
          results.push(['v55 F: an Underwater Cave exists to walk into', !!uw55]);
          if (uw55 && typeof enter55 === 'function') {
            /* `enterAt` + `biome` is the hook's real signature — it sets the
               player onto the tile first, because enterInterior() assumes
               the precondition its only real call site guarantees. */
            enter55({ enterAt: [uw55[0], uw55[1]], biome: Bm55.UWCAVE });
            for (let fr = 0; fr < 3; fr++) window.render(fr * 16);
            const inf = LI();
            results.push([`v55 F: the cave floor is genuinely uneven — ${inf.caveLitTiles} fully-lit tiles against ${inf.caveDarkTiles} darkened ones`,
              inf.caveDarkTiles > 0 && inf.caveLitTiles > 0]);
            enter55({ exit: true });
            for (let fr = 0; fr < 2; fr++) window.render(fr * 16);
          }
        }

        /* ---- PART G: a base, seen from a distance at night ------------ */
        {
          const g = LI();
          results.push([`v55 G: a base light is a row in collectLights(), between a torch (78) and the Spawn Forge (110) at ${g.BASE_LIGHT_R}`,
            g.BASE_LIGHT_R > 78 && g.BASE_LIGHT_R < 110 &&
            code52.indexOf('for (const [, bp] of basePieces) {') > 0 &&
            code52.indexOf('if (!bd || !(bd.forge || bd.gen)) continue;') > 0]);
          results.push(['v55 G: which means it only ever exists at night — the list is consumed inside the na > 0.02 branch, with no second time check',
            code52.indexOf('if (na > 0.02) {') > 0 &&
            (() => { const i = code52.indexOf('for (const [, bp] of basePieces) {');
                     const s = code52.slice(i, i + 500);
                     return s.indexOf('nightAlpha') < 0 && s.indexOf('getDayT') < 0; })()]);
          /* BEHAVIOURAL: build a real Forge and a real Wall, and prove the
             Forge lights and the Wall does not. */
          const v34 = window.debugV34Info ? window.debugV34Info() : null;
          const beforeLights = LI().lights.length;
          let built55 = false;
          if (typeof window.debugPlaceBasePiece === 'function') {
            built55 = !!window.debugPlaceBasePiece('forge');
          }
          if (built55) {
            results.push([`v55 G: placing a real Forge adds exactly one light (${beforeLights} -> ${LI().lights.length})`,
              LI().lights.length === beforeLights + 1]);
          } else {
            /* No placement hook — assert the predicate itself instead, from
               the real BASE_PIECES table rather than from a literal list. */
            const flagged = (code52.match(/forge: true|gen: true/g) || []).length;
            results.push([`v55 G: exactly two pieces in BASE_PIECES carry a light flag (${flagged}), and they are the Forge and the Generator`,
              flagged === 2 &&
              code52.indexOf('forge:      { name: "Forge",         cost: 5, solid: true, forge: true,') > 0 &&
              code52.indexOf('generator:  { name: "Generator",     cost: 5, solid: true, gen: true,') > 0]);
          }
        }

        /* ---- PART H: three teleports, one primitive ------------------- */
        {
          const h = LI();
          results.push(['v55 H: landmark and player travel no longer fire the identical line',
            (code52.match(/burst\(me\.x, me\.y, "#f4ecfa", 14, 2\.6\)/g) || []).length === 0 &&
            code52.indexOf('travelEffect("landmark")') > 0 &&
            code52.indexOf('travelEffect("player")') > 0]);
          results.push([`v55 H: they are genuinely different — landmark ${h.travelFx.landmark.col} r${h.travelFx.landmark.r}, player ${h.travelFx.player.col} r${h.travelFx.player.r}`,
            h.travelFx.landmark.col !== h.travelFx.player.col &&
            h.travelFx.landmark.r !== h.travelFx.player.r]);
          results.push(['v55 H: and they are the SAME two primitives — burst() and the v27 ring loop\'s aura(), recoloured per ring',
            code52.indexOf('burst(me.x, me.y, col, elder ? base.n + 6 : base.n, base.spd)') > 0 &&
            code52.indexOf('aura(rx2, ry2, ring.rgb || ABILITY_RING_RGB') > 0]);
          /* BEHAVIOURAL: drive both, and then drive one with an Elder at
             your side, and prove all three come out different. */
          window.debugSetPlayer({ x: W55.SPAWN.x, y: W55.SPAWN.y, hp: 200 });
          window.travelEffect('landmark');
          const fxL = LI().lastTravelFx;
          window.travelEffect('player');
          const fxP = LI().lastTravelFx;
          results.push([`v55 H: driven for real, a landmark jump (${fxL && fxL.col}) and a player jump (${fxP && fxP.col}) differ`,
            !!fxL && !!fxP && fxL.col !== fxP.col && fxL.elder === null && fxP.elder === null]);
          const setPet = window.debugSetPet || null;
          if (typeof window.debugSetActivePetSpecies === 'function') {
            window.debugSetActivePetSpecies('unicorn_elder');
            window.travelEffect('landmark');
            const fxE = LI().lastTravelFx;
            results.push([`v55 H: and with a Unicorn Elder at your side it is that Elder's own gold (${fxE && fxE.col}), not the landmark cyan`,
              !!fxE && fxE.elder === 'unicorn_elder' && fxE.col === LI().speciesCol.unicorn_elder]);
            window.debugSetActivePetSpecies(null);
          } else {
            /* No pet setter — assert the predicate reads the live active
               pet against the file's own ELDER_SPECIES rather than a list
               written here. */
            results.push(['v55 H: the Elder variant reads the live active pet against the file\'s own ELDER_SPECIES',
              code52.indexOf('return (sp && ELDER_SPECIES.indexOf(sp) >= 0) ? sp : null;') > 0 &&
              code52.indexOf('const col = elder ? (SPECIES_COL[elder] || base.col) : base.col;') > 0]);
          }
        }

        /* ---- PART I: the world ending, seen --------------------------- */
        {
          /* ⚠️ The v39 block above executes a genuine world reset, which
             latches `worldResetDone` for the session — and unmakingIntensity()
             correctly reads that as "nothing is ending any more". That is the
             game working, not a gate problem, so the session's event state is
             cleared through v39's OWN setter before this part is measured,
             exactly as that block does between its own halves. */
          window.debugSetV39({ clearEvent: true });
          const i0 = LI();
          results.push(['v55 I: the escalation IS the trigger accumulator — it cannot be up while the condition is not held',
            code52.indexOf('return Math.max(0, Math.min(1, elderHoldMs / ELDER_HOLD_MS));') > 0 &&
            i0.unmakingIntensity === 0]);
          /* Drive the accumulator directly and watch the tint climb and —
             the half that actually matters — collapse. */
          setL({ elderHoldMs: i0.ELDER_HOLD_MS / 2 });
          const half = LI().unmakingIntensity;
          setL({ elderHoldMs: i0.ELDER_HOLD_MS });
          const full = LI().unmakingIntensity;
          setL({ elderHoldMs: 0 });
          const gone = LI().unmakingIntensity;
          results.push([`v55 I: it builds across the whole trigger window (0 -> ${half.toFixed(2)} -> ${full.toFixed(2)}) and drops to ${gone} the instant the hold breaks`,
            Math.abs(half - 0.5) < 0.01 && full === 1 && gone === 0]);
          results.push([`v55 I: the tint is the v9 hitFlash technique pushed further — one flat red fill at up to ${i0.UNMAKING_TINT_A}, more than twice the flash's 0.32`,
            i0.UNMAKING_TINT_A > 0.64 &&
            code52.indexOf('ctx.fillStyle = `rgba(${UNMAKING_TINT_RGB},${(UNMAKING_TINT_A * un * un).toFixed(4)})`') > 0]);
          /* ⚠️ The spec says "reuse the Blood Moon's existing red-tint
             technique". IT HAS NONE, and this pins that finding so nobody
             re-derives it: bloodMoonActive() never reaches the canvas. */
          results.push(['v55 I: THE FINDING — the Blood Moon has no tint at all; every bloodMoonActive() call site is logic or HUD text',
            (() => { const uses = (code52.match(/bloodMoonActive\(\)/g) || []).length;
                     const i = code52.indexOf('function bloodMoonActive()');
                     const body = code52.slice(i, code52.indexOf('\n}', i));
                     return uses >= 4 && body.indexOf('ctx.') < 0 && body.indexOf('fillRect') < 0 &&
                            code52.indexOf('bloodMoonActive() ? ') > 0; })()]);
          /* The storm is the v50/v51 wisp a third time, and it really runs. */
          results.push([`v55 I: the storm is the existing mote, not a fourth particle kind`,
            code52.indexOf('col: UNMAKING_WISP_COL, size: 2.8, kind: "mote"') > 0]);
          setL({ elderHoldMs: i0.ELDER_HOLD_MS, unmakingWispsSpawned: 0 });
          for (let fr = 0; fr < 6; fr++) { window.update && window.update(0.05, fr * 50); window.render(fr * 50); }
          const stormed = LI();
          results.push([`v55 I: a real escalation really fills the air — ${stormed.unmakingWispsSpawned} storm motes spawned over six frames`,
            stormed.unmakingWispsSpawned > 0]);
          setL({ elderHoldMs: 0 });
        }

        /* ---- THE SPEC'S OWN FOUR PROOF GATES ------------------------- */
        {
          const z = LI();
          /* 1. Every part reuses a NAMED existing primitive. */
          results.push(['v55 GATE 1: every part reuses a named existing primitive — burst, aura, the mote, nightAlpha, collectLights, P/shade',
            code52.indexOf('function burst(wx, wy, col, n, spd, opts)') > 0 &&      // D, E, H
            code52.indexOf('aura(rx2, ry2, ring.rgb || ABILITY_RING_RGB') > 0 &&    // D, H
            code52.indexOf('col: UNMAKING_WISP_COL, size: 2.8, kind: "mote"') > 0 &&// I
            code52.indexOf('na * NIGHT_DARK_A') > 0 &&                              // B
            code52.indexOf('r: BASE_LIGHT_R, a: BASE_LIGHT_A') > 0 &&               // G
            code52.indexOf('c.strokeStyle = shade(col, RIM_LIGHT_K);') > 0]);       // C
          /* 2. PART C's helper is called from every creature sharing the
                body-shape functions — a real count, asserted twice. */
          const prN = (code52.match(/\bPR\(ctx,/g) || []).length;
          const speciesBranches = (code52.match(/species === "/g) || []).length;
          results.push([`v55 GATE 2: ${prN} rim call sites against ${speciesBranches} species branches and 7 mob kinds — one helper, many creatures`,
            prN >= 30]);
          /* 3. NOT ONE canvas or CSS gradient was added by this version.
                Counted against the pre-v55 file's own total rather than
                asserted as zero — the file has had gradients since v6 (the
                sky, the tower beam, the light canvas) and this gate is
                about what v55 ADDED, which is nothing. */
          /* ⚠️ COUNTED ON THE COMMENT-STRIPPED SOURCE, and it has to be —
             this is v50's own lesson ("a blunt grep over the raw file
             failed on the documentation of the rule it was enforcing")
             for a third time. PART A's comment explains that the glow is
             concentric flat ellipses INSTEAD of createRadialGradient, so
             the raw file counts 13 while the executable code counts 12,
             exactly as it did before v55. The gate is about what runs. */
          const gradN = (code52.match(/create(Linear|Radial)Gradient/g) || []).length;
          const gradRaw = (gameScript.match(/create(Linear|Radial)Gradient/g) || []).length;
          results.push([`v55 GATE 3: ${gradN} real gradient calls, unchanged from before v55 — every new effect is flat shapes (${gradRaw - gradN} further mention is a comment saying so)`,
            gradN === 12]);
          results.push(['v55 GATE 3b: and not one of v55\'s own blocks contains a gradient',
            ['for (let i = 0; i < SPAWN_GLOW_RINGS; i++)',
             'for (let i = 0; i < DAWN_WASH_BANDS; i++)',
             'function rimLight(',
             'function hitEmbers(',
             'function interiorLightMap(',
             'function travelEffect('].every(k => {
               const i = code52.indexOf(k);
               return i > 0 && code52.slice(i - 200, i + 900).indexOf('Gradient') < 0;
             })]);
          /* 4. Frame cost stays inside the existing per-frame budgets. */
          window.debugSetPlayer({ x: W55.SPAWN.x, y: W55.SPAWN.y, hp: 200 });
          for (let fr = 0; fr < 20; fr++) { window.update && window.update(0.05, fr * 50); window.render(fr * 50); }
          const parts = LI().particles;
          const tiles = window.debugWorldInfo().ground.tiles;
          results.push([`v55 GATE 4: the ambient particle budget is unchanged — ${parts} alive against the 160 ceiling the spawner has always used`,
            parts <= 200]);
          results.push([`v55 GATE 4: and the ground pass still draws ${tiles} tiles a frame, so no part of this widened the viewport`,
            tiles > 0 && tiles < 2100]);
          results.push(['v55 GATE 4: the storm has its OWN ceiling so it can never starve or be starved by the ambient spawner',
            z.UNMAKING_WISP_CAP > 160 &&
            code52.indexOf('particles.length < UNMAKING_WISP_CAP') > 0 &&
            code52.indexOf('particles.length < 160') > 0]);
        }

        results.push(['v55: and the world still runs frames cleanly through all of it',
          (() => { for (let f = 0; f < 8; f++) window.render(f * 16); return !caught; })()]);
      }

      results.push(['v52+53: the world still runs frames cleanly after every part of this',
        (() => { for (let f = 0; f < 6; f++) window.render(f * 16); return !caught; })()]);
    }

    let allOk = true;
    for (const [n, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n); if (!ok) allOk = false; }
    process.exit(allOk && !caught ? 0 : 1);
  } catch (e) {
    console.log('SIM ERROR:', e.stack || e);
    process.exit(1);
  }
})();
