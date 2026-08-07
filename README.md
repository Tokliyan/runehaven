# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RuneHaven_Bible.docx`
(not included here yet — add it to this repo before relying on any automated
build to check bible-fidelity claims itself).

## Layout

```
runehaven.html              the game — currently v16
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

## Confirmed, locked spec for the next build (v20 — Ruins as repeatable structures + scattered Safe Zones)

v19 shipped successfully — genuinely clean, 151/151 in run4, verified
independently. This section replaces the v19 entry as the current locked
target.

NOTE on numbering: an earlier draft of the v19 spec's closing note called
the next version "v20 — Underwater Caves." That was superseded later in
planning — this section (Ruins + Safe Zones) is the real v20. Underwater
Caves is v21. If you see the old reference anywhere, ignore it; this
section is authoritative.

**Everything below was checked directly against the live, post-v19 code
before being written — every number here matches what's actually in
`runehaven.html` right now, not an assumption.**

**PART A — Ruins become plural, scattered structures, not one fixed
placement.**

Current state (confirmed): `RUIN = { x, y }` is a single point, placed once
via angle+radius from TOWER (radius 57) with separation checks (`SAFE_RADIUS
+ 24` from SPAWN, `42` from VOLCANO, `42` from MOUNT). `buildRuinPieces()`
already builds every decor piece relative to `const R = RUIN;` — offsets
only, nothing else hardcoded. `RUINB` tiles get carved within 4.5 tiles of
the single `RUIN` point. Golem and Bandit are gated to the `B.RUINB` tile
type itself, not distance from `RUIN` — confirmed directly, zero changes
needed to either species.

**The change:**
1. `RUIN = {x,y}` becomes `RUINS = []`, an array.
2. Do NOT reuse the angle-radius-from-Tower technique for placing the six
   — that technique is for exactly one instance at a controlled distance.
   Instead reuse the wilds/mobs scattering pattern (search `let spSeed = 0`
   to find it) — hashed candidate tiles across the whole map via
   `hash2(a, offset, worldSeed + seed) * N`, with a search budget, checking
   separation against everything already placed. This is what makes Ruins
   actually scatter like the wilds do, not cluster near the town center.
3. Target: **6 Ruins total.** Each instance must maintain the SAME
   separation buffers the single Ruin already used — `SAFE_RADIUS + 24` from
   SPAWN, `42` from VOLCANO, `42` from MOUNT, `42` from TOWER — plus a NEW
   minimum separation of `45` between any two Ruin centers, so the six don't
   cluster together.
4. Rename `buildRuinPieces()` to `buildRuinCluster(center)`, replace
   `const R = RUIN;` with `const R = center;` (this is the entire
   refactor — every other line already uses `R.x + offset` and needs no
   change). Call it once per entry in `RUINS`, appending each cluster's
   pieces to the same shared `ruinPieces` array — every other system that
   reads `ruinPieces` (rendering, mining, interaction) needs no changes,
   since it's still just one flat array.
5. The `RUINB` tile-carving check (`Math.hypot(tx - RUIN.x, ...) < 4.5`)
   must loop over all entries in `RUINS`, not the single point.
6. Add ONE new small decorative piece to each ruin cluster — a dark
   archway/entrance marker, visual only, hinting at the bible's "dungeon
   entrances" without building Dungeons yet (same pattern as v18's cave
   entrances existing before their interiors mattered). Keep it simple:
   a dark trapezoid or arch shape in the existing ruin-stone palette,
   roughly 2-3 tiles tall, placed at one edge of the cluster.

**PART B — Other Safe Zones: scattered, minimal, explicitly not a
trading system.**

Bible: "Other Safe Zones — Scattered neutral trading and resting areas."
Currently `inSafeZone(x, y)` is a single-point check against `SPAWN` only.

**The change:**
1. New array, e.g. `OTHER_SAFE_ZONES = []`, populated via the SAME
   wilds-style scattering technique as Part A.
2. Target: **4 zones total**, deliberately rarer than the 6 Ruins.
   Minimum separation of `40` from each other, from SPAWN, and from every
   Ruin and major landmark.
3. Extend `inSafeZone(x, y)` to return true if the point is within
   `SAFE_RADIUS` of SPAWN **or** within a smaller radius (propose `8`,
   tunable) of any `OTHER_SAFE_ZONES` entry.
4. Visual treatment: reuse the existing `"well"` decor piece (already has
   its own art — search `k: "well"` and `p.k === "well"` to confirm before
   using it) as a visual anchor at each zone's center, plus a small
   flattened-grass clearing using the same flatten technique already
   applied around SPAWN, just at the smaller radius from step 3.
5. **Explicitly do NOT build any trading/currency/barter mechanic.** No
   currency system exists in the game, and the bible's actual trading hub
   is the separate Grand Bazaar landmark (its own later version). These are
   "resting areas" functionally this version — protection plus a visual
   anchor, nothing more. Do not invent an item-exchange UI to satisfy the
   word "trading" in the bible quote.

**PART C — proof gates, standard gauntlet plus:**
- Confirm all 6 `RUINS` entries actually placed (none exhausted their
  search budget without finding a valid spot).
- Confirm `B.RUINB` tiles exist near every one of the 6 clusters in the
  test seed, not just one.
- Confirm Golem and/or Bandit actually spawn near at least 2 different
  Ruin clusters in the test seed — a real multi-instance check, not just
  "the biome tile exists."
- Confirm all 4 `OTHER_SAFE_ZONES` entries placed successfully.
- Confirm `inSafeZone()` correctly protects a test point near each of the
  4 scattered zones, not just near SPAWN.
- Extend `run5.js` coverage to include the new ruin-entrance decor piece
  and the well-anchor rendering at a scattered safe zone.

**Explicitly not touched this version:** Underwater Caves, Water Dragon,
Sea Serpent (v21). Dungeons themselves — the entrance markers added here
are decoration only, no interior, no Demon Knight, nothing functional yet.
Grand Bazaar and any trading/currency mechanic. Mounting.

**After v20 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target, exactly as before.
