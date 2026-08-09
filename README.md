# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RUNEHAVEN_BIBLE.md` — full text now in this repo, read it
directly, do not assume or invent anything it doesn't state.

## Layout

```
runehaven.html              the game — currently v20
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

## Confirmed, locked spec for the next build (v20 rev2 — Ruins as repeatable structures + scattered Safe Zones)

v19 shipped successfully. A first v20 attempt correctly stopped RED on a
real geometric conflict, found by an exhaustive 57,600-tile scan across
five seeds — not a guess, measured. This section fixes exactly that,
carries forward everything the first attempt already verified working, and
adds two more real fixes it found along the way. Nothing else changes.

**What was already verified working — build it exactly as before, do not
re-derive or second-guess any of this:**
- `RUIN = {x,y}` becomes `RUINS = []`, six centres via the wilds/mobs
  hashed scattering pattern (`hash2(a, offset, worldSeed + seed) * N`) —
  NOT the angle-radius-from-Tower technique. Confirmed genuinely scattered
  on the harness seed, no clustering near the town centre.
- `buildRuinPieces()` → `buildRuinCluster(center)`, `const R = center;`
  replacing `const R = RUIN;` — the entire refactor, every other line
  already used `R.x + offset`. Append each cluster to the one shared
  `ruinPieces` array.
- The `RUINB` carve, the deliberate runic vein per cluster, and
  `debugWorldInfo()` all loop over `RUINS`.
- Golem and Bandit: zero changes, both already gate on `B.RUINB`.
- The dark archway/entrance decor piece (two jambs, a lintel, a flat
  near-black trapezoid mouth, ~2.5-3 tiles tall, darkened ruin stone) —
  already built, already verified drawing clean. Bible-supported
  ("dungeon entrances"), visual only.
- `OTHER_SAFE_ZONES = []`, same hashed scattering pattern, the existing
  `"well"` decor piece as the visual anchor, the radius-8 grass clearing,
  `inSafeZone()` extended to check SPAWN OR any zone in the array. No
  trading/currency mechanic, exactly as before.

**FIX 1 — the actual blocker: Ruin-to-Safe-Zone separation drops from 40
to 24.** 40 made 6 Ruins and 4 Safe Zones mutually impossible on this
island's real habitable area (confirmed by exhaustive scan). 24 comfortably
yields all 4 zones on every seed tested, with room to spare, while still
keeping a zone's centre roughly 20 tiles clear of a Ruin's actual 4.5-tile
footprint. Every OTHER separation value (zone-to-zone 40, zone-to-SPAWN/
TOWER/VOLCANO/MOUNT 40, Ruin's own separations from landmarks and from each
other) is UNCHANGED — this is the one number that was wrong.

**FIX 2 — land-fitness checks during placement must use `elevRaw()`, never
`biomeAt()`.** `placeLandmarks()` runs before `tileCache.clear()`, so any
`biomeAt()` call there permanently bakes a pre-Ruin/pre-Zone biome into the
cache for every tile it touches, and the later `RUINB` carve (or the Safe
Zone's grass flatten) then silently never appears on that tile. `elevRaw()`
is pure noise with no cache and is safe to call here. Land = `0.44 <= e <
0.84` (confirmed solid-ground band). Use this for BOTH Ruins and Safe Zones.

**FIX 3 — Ruin placement search: widen the budget past 60,000 candidates,
or stop re-seeding the hash stream on every placement attempt (pick
whichever is the smaller, more surgical change).** The exhaustive scan
confirmed a valid 6th Ruin spot always exists on every seed tested (true
max is 7-9 Ruins) — this was purely the search running out, not a real
placement conflict, so the fix is a search-budget/seeding issue only, not
another separation number.

**PART C — proof gates, same as before, with one correction:** the
`run4.js` assertion for the Dark Forest tile-band count must be
RE-MEASURED after this build, not reused from any earlier number (including
861, which was observed on the failed first attempt and is not necessarily
final now that FIX 1 changes how many Safe Zone clearings actually place).
Confirm all 6 Ruins place. Confirm all 4 Safe Zones place — this is now
the real test of whether Fix 1 actually resolved the conflict. Confirm
`B.RUINB` tiles and Golem/Bandit spawns near multiple Ruin clusters.
Confirm `inSafeZone()` protects a test point near each of the 4 zones.

**Explicitly not touched:** Underwater Caves, Water Dragon, Sea Serpent
(v21). Dungeons themselves, Grand Bazaar, any trading/currency mechanic,
mounting.

**After v20 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
