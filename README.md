# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RUNEHAVEN_BIBLE.md` — full text now in this repo, read it
directly, do not assume or invent anything it doesn't state.

## Layout

```
runehaven.html              the game — currently v19 (v20 in progress)
runehaven-art-style/         SKILL.md — read this before ANY rendering change
debug/run2.js                quick login-screen smoke test
debug/run3.js                REQUIRED full-boot harness (real login, 5 frames)
debug/run4.js                wear-down/taming-gate simulation
debug/run5.js                exhaustive branch-coverage sweep (every class/
                              weapon/armor/species/mob-state combo, once each)
```

Run any harness with: `node debug/runN.js runehaven.html` (or just
`node debug/runN.js` from inside `debug/`, defaulting to `../runehaven.html`).

## The standard process (non-negotiable)

1. **Read `runehaven-art-style/SKILL.md` in full** before touching any
   rendering code, even a small tweak.
2. Apply changes as **surgical, targeted patches** — never a full rewrite of
   a working section. Before any find-and-replace, confirm the anchor string
   is unique in the file (`grep -c "anchor text" runehaven.html` must return
   exactly the number of intended edit sites). An over-broad replace has
   caused a real shipped bug before (v13).
3. **Never invent bible content.** Pets, mobs, biomes, lore, and events must
   come from the bible. If a build needs a value the bible doesn't specify
   (an HP number, a cooldown, a percentage), that's fine to design — but
   flag it as a tunable, and never add a pet/mob/location the bible doesn't
   list without explicitly marking it non-canon.
4. After patching, run in order and require ALL to pass before shipping:
   - `node -e` parse check (`new Function(scriptText)` must not throw)
   - a grep checklist confirming every intended change landed AND every
     prior feature is still present (preservation checks, not just new ones)
   - `node debug/run3.js runehaven.html` — must show `CAUGHT ERROR: none`
   - `node debug/run4.js runehaven.html` — all `PASS`, zero `FAIL`
   - `node debug/run5.js runehaven.html` — must show `CAUGHT: none`
5. **When something is unclear or unspecified, classify it before deciding
   what to do — RED always stops, YELLOW ships with a flagged note.**

   **RED — always STOP, no exceptions, regardless of how small it looks:**
   - Any test harness actually fails (`run3`/`run4`/`run5` catch a real
     error, or any `run4` line is `FAIL`) — this is the mechanical,
     objective signal that something is genuinely broken. Never overridden.
   - A patch anchor isn't unique.
   - The spec would require inventing bible content — a pet, mob, biome,
     location, or lore element not in the bible. This is a creative
     integrity rule, not a bug-severity one, and severity never overrides it.
   - The spec assumes an entire system exists that doesn't, AND building it
     properly needs 3+ genuinely unspecified, interdependent decisions with
     real gameplay consequences (a whole consumable-item framework, a whole
     new traversal/instance architecture — the kind of thing where any
     guess is really a design decision, not a tunable).

   For any RED case: do not guess, do not "fix forward" with invented
   content, do not ship a broken build. Write `BUILD_FAILED.md` at the repo
   root explaining exactly what's blocking and why, leave `runehaven.html`
   unchanged.

   **YELLOW — make the reasonable call, ship it, flag it clearly:**
   - A single tunable number or threshold is uncertain, but any reasonable
     value in a normal range keeps the game working (a rarity threshold, a
     cooldown, a light radius, a stat number within the established range
     for its rarity tier).
   - A minor naming or implementation choice where multiple options all
     work equally well (matching an existing code convention, e.g. an
     abbreviated enum name).
   - A visual/polish detail that doesn't affect functionality (an overlay
     offset, a minor color choice within an already-approved palette).
   - An implementation detail the spec left slightly underspecified, but
     where only one interpretation is actually sensible given everything
     else in the spec.

   For any YELLOW case: make the call, implement it, ship normally through
   the full gate above — but add a `## JUDGMENT CALLS THIS VERSION` section
   to the changelog entry in `SKILL.md` (or a top-level note in the commit
   message if it's not rendering-related) listing every one, in plain
   language, so it's easy to spot and revise the next morning. A version
   that shipped with flagged judgment calls is a complete, done version —
   not a partial one. The judgment calls are refinements to consider, not
   unfinished work.

   **When genuinely unsure which zone something belongs in: treat it as
   RED.** A missed YELLOW just means an unnecessary night lost, which is
   recoverable. A wrongly-shipped RED is a broken or invented build in a
   real player's hands, which is not.
6. On success: update `runehaven-art-style/SKILL.md` with a new dated
   changelog entry (rendering-scope changes only — mechanics/balance live in
   this README or commit messages, not the skill).
7. Extend `debug/run5.js`'s coverage lists with any new species/mobs/weapon
   kinds/classes added in this build, so future runs keep covering them.
8. **If the full gate passed cleanly** (every check above green, nothing
   flagged RED): attempt to push the final commit directly onto `main`,
   not just your own branch, as the very last step. If your environment
   does not permit a direct push to `main`, that's fine — land on the
   usual branch as before, no error, a human will sync it. This is a
   nice-to-have, never a requirement — never fail a build or treat a
   blocked push to `main` as a RED condition.

## Confirmed, locked spec for the next build (v21 — Underwater Caves, real dive mechanic, Water Dragon, Sea Serpent)

v20 shipped successfully — 223/223 in run4, verified independently. This
section replaces the v20 entry as the current locked target. This is the
version that was deferred from the original v18 attempt specifically to
design the dive mechanic properly instead of assuming it existed. It is
designed here in full, checked line-by-line against the live code.

**Two pieces of genuinely good news, confirmed directly before writing
this:** `dragonV2()` and `DRAGON_PAL` (including the `water` palette) are
already live in the file — Fire Dragon already uses this shared function.
Water Dragon needs ONE new line, not new art. And only `B.DEEP` is actually
blocked (`const BLOCKED = new Set([B.DEEP, B.PEAK, B.LAVA])`) — regular
`B.WATER` is already freely walkable, confirmed directly.

**PART A — the dive/breath mechanic itself, fully specified.**

New player state: `me.diving` (boolean, off by default) and `me.breath` /
`me.maxBreath` (seconds, default max 30).

Toggle key: **`F`** — confirmed free, not bound to anything else (search
`keys["` to verify the current bindings before adding this).

The exact movement change, at the real location (search
`if (!BLOCKED.has(biomeAt(Math.floor(nx), Math.floor(me.y)))) me.x = nx;`
inside the WASD movement handler): when `me.diving` is true, treat
`B.DEEP` as NOT blocked for this specific check only — i.e. the movement
gate becomes `if (me.diving || !BLOCKED.has(...)) me.x = nx;` (same pattern
for the y-axis line directly below it). `B.PEAK` and `B.LAVA` stay blocked
regardless of diving state — this is specifically a deep-water exception,
not a general noclip.

Breath drains at 1/second while `me.diving` is true AND the player is
standing on `B.DEEP`. While diving but standing on any non-`B.DEEP` tile
(including the new cave-pocket tiles from Part B), breath does NOT drain —
this is what makes the cave interior a safe "air pocket" once reached, only
the open deep water in between costs breath.

At `me.breath <= 0`: apply periodic damage (reuse the existing damage-
application pattern already used elsewhere for damage-over-time — same
general shape as the existing poison/DoT handling) rather than instant
death — roughly 5 damage per second while breath is empty, until the
player either reaches non-`B.DEEP` ground or dies normally through existing
death handling. Do not invent a separate "drowning death" system — route
through whatever already handles player HP reaching 0.

When not diving (`me.diving` false) and on land: breath regenerates back to
`maxBreath` at roughly 4/second, standard recovery convention, no new
pattern needed.

Pressing `F` toggles `me.diving`. Toggling off while still on `B.DEEP`
should be blocked (auto-refuse, or immediately push the player to the
nearest non-blocked tile) — surfacing off deep water with diving off would
just re-trigger the normal BLOCKED check and softlock movement, so handle
this explicitly rather than let it happen by accident.

**PART B — Underwater Caves, using the exact same proven technique as
Enchanted Forest / Sacred Meadow / Underground Caves.**

New biome value, e.g. `B.UWCAVE`, added to the `B` enum. Carved from
`B.DEEP` tiles specifically (not `B.WATER` — this preserves the bible's
"deep underwater caves" framing and keeps the mechanic meaningfully gated
behind the one tile type that's actually blocked) using a THIRD independent
noise field, same pattern as `ENCH_RARITY`/`SACRED_RARITY`/
`UNDERCAVE_RARITY` — own seed offset, own rarity constant (propose
`UWCAVE_RARITY = 0.82`, tunable). Do NOT add `B.UWCAVE` to `BLOCKED` — this
alone makes the cave pocket itself walkable, exactly like every prior
biome-pocket. Surrounding regular `B.DEEP` tiles remain blocked as always,
which is what makes Part A's dive toggle necessary to ever reach one.

Visual: dark, cave-toned but with an underwater tint — desaturated blue-grey
rock, sparse bioluminescent accents (reuse the particle/glow language
already established for Enchanted Forest's motes, shifted toward blue).

Run the same worldgen sanity check pattern as every prior biome-pocket
version: confirm at least one `B.UWCAVE` tile exists in the test seed. If
none appear, the rarity threshold is wrong — fix it, don't ship an
unreachable biome (this one especially — combined with Part A's gating, an
unreachable cave here is a bigger loss than a merely-rare one elsewhere).

**PART C — the breath-extension item.**

Name: **Diver's Charm**. Craftable at a player's base forge (existing
crafting pattern, no new system) from common, already-existing materials —
propose `iron_bar x2 + wood x3`, so a new player can craft a basic one
before ever finding anything inside the caves — no bootstrapping problem.
Effect while equipped: `maxBreath` becomes 50 instead of 30, and while
diving, slowly regenerate HP (reuse the existing safe-zone regen pattern's
shape, ~1.5/second) rather than only losing it. This is a real, meaningful
upgrade, not a marginal one, matching how much risk deep water represents.

**PART D — Water Dragon (pet, Rare, tame as hatchling).**

Add a `water_dragon` branch to `drawSpecies` calling
`dragonV2(sx, sy, DRAGON_PAL.water, t, "water")` — this is the entire art
requirement, confirmed both already exist and are already proven working
via Fire Dragon's identical branch.

Stats — already locked from the original v16 table, unchanged: 55 HP / 12
dmg / 1.6s cooldown / PvP-capable (Rare rarity, matches Unicorn's gating
pattern). Tame base chance: 0.25, matching Fire Dragon's. Spawn location:
`B.UWCAVE` tiles specifically. Add `water_dragon: 1.30` to `SPECIES_K`
(identical to Fire Dragon's entry).

Mount status: on the bible's mountable list, DEFERRED same as every other
species so far — no riding code, inherits the speed bonus whenever full
mounting ships.

**PART E — Sea Serpent (mob, Hard, kill-for-loot).**

Art already designed, ported, and independently verified executing clean
before this spec was written — insert exactly as given, do not redraw:

```js
else if (kind === "sea_serpent") {
else if (kind === "sea_serpent") {
    const w1 = Math.sin(t / 420) * 1.6, w2 = Math.sin(t / 420 + 1.2) * 1.6;
    P(ctx, [sx - 22, sy, sx - 19, sy - 6 + w1, sx - 13, sy - 6.4 + w1, sx - 10, sy], "#2f7c8c");
    P(ctx, [sx - 19, sy - 6 + w1, sx - 13, sy - 6.4 + w1, sx - 14, sy - 2], "#1e5a68");
    P(ctx, [sx - 9, sy, sx - 6, sy - 7 + w2, sx + 1, sy - 7.4 + w2, sx + 4, sy], "#3f9aa8");
    P(ctx, [sx - 6, sy - 7 + w2, sx + 1, sy - 7.4 + w2, sx - 1, sy - 2], "#25687a");
    SCL(ctx, sx - 20, sy - 5.4 + w1, 8, 4, "#25687a", 2.2);
    SCL(ctx, sx - 7, sy - 6.4 + w2, 9, 4.6, "#2a7284", 2.2);
    for (let i = 0; i < 3; i++) {
      P(ctx, [sx - 18 + i * 2.6, sy - 6 + w1, sx - 19 + i * 2.6, sy - 10.4 + w1, sx - 16 + i * 2.6, sy - 6.2 + w1], "#9fe0ec");
    }
    for (let i = 0; i < 3; i++) {
      P(ctx, [sx - 5 + i * 2.6, sy - 7 + w2, sx - 6 + i * 2.6, sy - 11.6 + w2, sx - 3 + i * 2.6, sy - 7.2 + w2], "#9fe0ec");
    }
    P(ctx, [sx - 23, sy - 1.4, sx - 29.4, sy - 5.4 + Math.sin(t / 380) * 2, sx - 22.4, sy - 5], "#2f7c8c");
    P(ctx, [sx - 29.4, sy - 5.4 + Math.sin(t / 380) * 2, sx - 33.4, sy - 2 + Math.sin(t / 380) * 2, sx - 30, sy - 9 + Math.sin(t / 380) * 2], "#9fe0ec");
    P(ctx, [sx + 1.4, sy - 7, sx + 3.4, sy - 19.4, sx + 7, sy - 19, sx + 5.4, sy - 6.4], "#3f9aa8");
    P(ctx, [sx + 5.4, sy - 19, sx + 7, sy - 19, sx + 6.4, sy - 6.6], "#25687a");
    for (let i = 0; i < 4; i++) {
      P(ctx, [sx + 3.2 - i * 0.2, sy - 17.4 + i * 2.6, sx + 1.4 - i * 0.2, sy - 19.4 + i * 2.6, sx + 3.6 - i * 0.2, sy - 15.4 + i * 2.6], "#9fe0ec");
    }
    P(ctx, [sx + 3.2, sy - 19.8, sx + 11, sy - 21.2, sx + 11.4, sy - 15.6, sx + 3.4, sy - 14.8], "#4aa8b6");
    P(ctx, [sx + 11, sy - 21.2, sx + 11.4, sy - 15.6, sx + 7, sy - 15.4], "#25687a");
    P(ctx, [sx + 11.2, sy - 20.2, sx + 16.4, sy - 18.2, sx + 11.4, sy - 16.2], "#3f9aa8");
    ctx.fillStyle = "#f4f0e0";
    for (let i = 0; i < 4; i++) ctx.fillRect(sx + 12 + i * 1.3, sy - 17.2, 0.8, 1.4);
    P(ctx, [sx + 3.8, sy - 21, sx + 9.6, sy - 22.2, sx + 9.2, sy - 20, sx + 4, sy - 19.4], "#67c2d0");
    EY(ctx, sx + 8.4, sy - 19.8, 1.5, "#eafcff", "#0e3a44");
    P(ctx, [sx + 4, sy - 22, sx + 2.2, sy - 27.4, sx + 6, sy - 22.6], "#9fe0ec");
    P(ctx, [sx + 6, sy - 22.6, sx + 7.4, sy - 28.4, sx + 9.4, sy - 22], "#bfeef6");
    P(ctx, [sx + 9.4, sy - 22, sx + 12, sy - 26.4, sx + 11.4, sy - 21], "#9fe0ec");
    for (let i = 0; i < 3; i++) {
      const ph = (t / 900 + i * 0.34) % 1;
      ctx.strokeStyle = `rgba(200,240,250,${0.5 * (1 - ph)})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx + 14 + i * 3, sy - 22 - ph * 10, 1.4, 0, Math.PI * 2); ctx.stroke();
    }
}

}
```

Stats: 130 HP / 18 dmg / 700ms windup, standard melee-range mob framework
(same shape as every mob since v13 — hp/dmg/atkRange/atkCooldownMs/
windupMs/aggroRadius/leashRadius/moveSpeed/count/tameable:false/loot).
Spawn location: `B.UWCAVE` tiles. Loot: reuse existing materials
(iron_bar/runic_stone) at a generous rate — the bible's "rare aquatic
loot" has no dedicated item yet, and inventing one isn't this version's
job. Add `sea_serpent: 2.60` to `MOB_K` and `sea_serpent: 15` to
`MOB_TALL` (large, low-profile body — tune the overlay offset against how
it actually renders, this is a starting estimate).

**PART F — proof gates, standard gauntlet plus:**
- Worldgen sanity check: confirm `B.UWCAVE` tiles exist in the test seed.
- Confirm the dive toggle actually works end-to-end in the harness: player
  can enter `B.DEEP` while `me.diving` is true and cannot while false;
  breath drains only while diving on `B.DEEP`; breath stops draining on
  `B.UWCAVE`; damage applies at zero breath using the existing damage path,
  not a new one.
- Confirm Water Dragon and Sea Serpent both spawn on `B.UWCAVE` tiles in
  the test seed and both render without error.
- Confirm the Diver's Charm crafts from the stated materials and correctly
  changes `maxBreath` and applies regen while equipped and diving.
- Extend `run5.js` coverage for both new species and the dive-state render
  (player sprite/UI while `me.diving` is true, if any visual change is
  added — a small tint or bubble-particle cue is reasonable, YELLOW-zone,
  not required).

**Explicitly not touched this version:** Dungeons, Storm/Shadow Dragons
(their palette data is already pre-staged in `DRAGON_PAL`, same as before),
mounting, Grand Bazaar, a dedicated aquatic loot item.

**After v21 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
