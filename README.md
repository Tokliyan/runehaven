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

## Confirmed, locked spec for the next build (Expansion 2b — the real scale-up)

Expansion 2a shipped successfully — viewport rendering confirmed, memory
problem retired. This is the actual scale-up it was the prerequisite for.

**Confirmed live before writing this: N=320, INTERIOR_N=26.** Reusing the
exact constant list World Expansion (240->320) already found and proved
correct — not re-discovering it, just rescaling it to the new ratio
(1000/320 = 3.125x). That version's own hard-won lesson stands: leave
every biome rarity threshold and noise wavelength untouched, they scale
proportionally on their own.

**PART A — the scale.** `N: 320 -> 1000`.

**PART B — every constant relative to a fixed point, scaled by 3.125x,
reusing the exact list already proven complete:**
```
SAFE_RADIUS:      36  -> 113
RUIN_SEP:         53  -> 166
RUIN_ZONE_SEP:    32  -> 100
RUIN_FOOT:        6   -> 19
ZONE_R:           11  -> 34
ZONE_SEP:         53  -> 166
VOLCANO from TOWER: 100 -> 313
MOUNT from TOWER:   96  -> 300
BAZAAR from TOWER:  64  -> 200
ANCIENT from VOLCANO: 29 -> 91
COLOSSEUM from TOWER: 80 -> 250
DRAGON_ALTAR from TOWER: 45 -> 141
Volcano cone (dV):  36  -> 113
Lava core:          10  -> 31
PEAK->ROCK buffer:  56  -> 175
elevRaw dTower divisor: 160 -> 500
elevRaw dMount divisor: 48  -> 150
Ruin/Zone exclusion from Volcano/Mount: 56 -> 175
inBounds edge margin: 48 -> 150
Spawn-exclusion checks (wilds/mobs): 48/56 -> 150/175
```
Confirmed NOT to scale (player-interaction distances, unchanged from
World Expansion's own list): `BAZAAR_R`, `ANCIENT_R`, `COLOSSEUM_R`,
`DRAGON_ALTAR_R`, `BASE_MIN_SEP`.

**PART C — cave interiors, genuinely bigger.** `INTERIOR_N: 26 -> 50`.
Confirmed independent of `N` — interiors are their own generated grid,
untouched by anything in Part B. Node/mob/ore counts inside scale with
the interior's own area, not left at their 26x26-tuned absolute counts —
reuse the existing per-interior density logic, just against the new grid
size.

**PART D — sized for real concurrency, not just bigger for its own
sake.** Confirm a 1000x1000 world with the new Safe Zone/Ruin/Zone
separations genuinely supports the six Ruins and four Safe Zones (reuse
v20's exhaustive placement-scan technique) with real room for ~50
concurrent players to each find their own space — not just technically
placeable, actually spread out.

**PART E — proof gates, standard gauntlet plus:**
- Confirm N=1000, no leftover reference to 320 anywhere.
- Confirm six-seed sweep (reuse World Expansion's own reseed-and-rebuild
  hook) for Sunforge Caldera and mountain-ruin presence — same rigor,
  don't skip it because the constant list is reused.
- Confirm all landmarks place without overlap at the new distances.
- Confirm INTERIOR_N=50 caves generate with genuine connectivity (reuse
  Expansion 1's flood-fill connectivity fix and guarantee) — this must
  not regress just because the grid got bigger.
- Confirm interior node/mob/ore density scales with the new interior
  area, not left at 26x26-tuned absolute counts.
- Confirm Expansion 2a's viewport tile-count assertion still holds at the
  new N — this is the proof that 2a's work actually paid off here.

**Explicitly not touched this version:** any biome rarity threshold, any
noise wavelength, the rendering technique itself (2a's job, already
done).

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
