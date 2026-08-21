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

## Confirmed, locked spec for the next build (v41 — World Expansion)

v39 shipped successfully. This is the highest-risk version on the
remaining roadmap — comparable to v19's original scale-up, now touching
more systems than v19 ever had to. Full constant audit done before
writing a line of this spec, not assumed.

**The single most important finding, confirmed directly against the real
file: every biome-pocket and terrain-shaping noise call uses a fixed
wavelength divisor (`/20` for all six pockets, `/13`/`/9`/`/3.5` for
elevation/clusters/height) — none reference `N`.** Left untouched, a
bigger map gets proportionally more of everything at the same per-pocket
size and the same relative coverage automatically. **Do not touch
`ENCH_RARITY`, `SACRED_RARITY`, `UNDERCAVE_RARITY`, `UWCAVE_RARITY`,
`ABYSSAL_RARITY`, `CALDERA_RARITY`, or any `valueNoise(tx/N, ty/N, ...)`
wavelength divisor anywhere.** Confirmed these need zero changes — this
is the majority of what made v19 hard, and it's already solved by how the
noise system was built.

**PART A — the new scale.** `N: 240 -> 480`. Doubling, not repeating
v19's full 3x — this version already touches more surface area than v19
did, and a more conservative multiplier is the right tradeoff against a
first-attempt failure on the riskiest version left.

**PART B — every constant that genuinely IS relative to a fixed point,
scaled by the same 2x factor, confirmed as the complete real list:**
```
SAFE_RADIUS:      27  -> 54
RUIN_SEP:         40  -> 80
RUIN_ZONE_SEP:    24  -> 48
VOLCANO from TOWER: 75  -> 150
MOUNT from TOWER:   72  -> 144
BAZAAR from TOWER:  48  -> 96
ANCIENT from VOLCANO: 22 -> 44
COLOSSEUM from TOWER: 60 -> 120
DRAGON_ALTAR from TOWER: 34 -> 68
```

**PART C — explicitly, confirmed, must NOT scale — these are
player-interaction distances, not world geography, and touching them
would be a real regression:**
```
BAZAAR_R = 7          ANCIENT_R = 4
COLOSSEUM_R = 9        DRAGON_ALTAR_R = 2.2
BASE_MIN_SEP = 3
```
These represent "how close does a player need to stand" — identical
regardless of map size. Confirmed by name in the real file before writing
this list, not inferred.

**PART D — Elder Drake's local search.** `for (let r = 3; r < 26; r++)`
searches near VOLCANO for valid terrain — VOLCANO's own position already
scales correctly via Part B, so this local radius likely needs no change,
but confirm directly: run the search against the new N=480 world and
verify it still finds a valid VOLROCK/ROCK/CALDERA tile. If it doesn't,
widen the bound — do not assume without checking.

**PART E — proof gates, standard gauntlet plus:**
- Confirm `N === 480` and no leftover reference to the old value anywhere.
- Confirm all six Ruins and four Safe Zones can still be placed at the
  new scale with the new separation — reuse the exact exhaustive
  placement-scan technique v20 originally used to prove this, don't
  assume proportional scaling preserves feasibility without checking.
- Confirm every landmark (Tower, Volcano, Mount, Bazaar, Ancient Forge,
  Colosseum, Dragon Altar, Shrine) places without overlapping any other,
  at the new distances.
- Confirm biome-pocket proportions are genuinely unchanged — bake a test
  seed at the new N, measure each pocket's percentage of its parent
  terrain, and confirm it matches the pre-expansion percentage within a
  small tolerance. This is the proof that leaving the wavelengths alone
  actually worked as intended, not just an assumption.
- Confirm the Elder Drake still spawns successfully in a swept test.
- Confirm the Unicorn Elder's uniform-random tile selection still covers
  the full new map with no bias — it already scales automatically via
  `hash2(...) * N`, confirm this rather than assume.
- Confirm Meteor Shower site placement (`hash2(...) * N`) still lands
  correctly across the full new map.

**Explicitly not touched this version:** any biome rarity threshold, any
noise wavelength, any player-interaction-scale radius, cave interiors
(their own separate 26x26 grids, entirely unaffected by N).

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated with the
next target.
