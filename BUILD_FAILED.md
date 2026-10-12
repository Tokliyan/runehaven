# BUILD FAILED — World Check Fixes (Landmarks, Compass, Caves, Lava & Dark Forest)

**Date:** 2026-10-12 · **Branch:** `claude/stoic-tesla-22bq3v` · **Status: RED, stopped before shipping.**

`runehaven.html` and `debug/` are back at HEAD and unchanged, exactly as the
standard process's step 5 requires.

**The whole build was written and it passes everything.** All ten parts (A–J)
were implemented, all of the spec's own proof gates were written and pass, and
the full gauntlet is green: run3 `CAUGHT ERROR: none`, **run4 1775 PASS / 0
FAIL** (1718 before, +57 new gates), run5 `CAUGHT: none` at 1366 coverage
draws. The screenshots look good. It is NOT a broken build.

It is stopped because the fresh-context doubt pass (step 0b) found that the
spec, implemented exactly as written, **regresses four separate items on the
art-style skill's own MUST-NOT-REGRESS list** (`runehaven-art-style/SKILL.md`,
the 2026-07-11 v6 review line), and three of those cannot be fixed without
making design decisions the locked spec explicitly forbids this build from
making. Every number below was re-measured in the real game, not taken from
the reviewer's word.

The complete work is saved as **`WORLD_CHECK_FIXES_blocked.patch`** (1,343
lines, `git apply` it) so tonight is not lost. Once you decide the four
questions at the bottom, it is a short night's work to finish.

---

## What blocks it

### 1. The arena lands on the mountain, and PART B then flattens it

PART A's land test is `elevRaw >= 0.42` with **no upper bound**. `biomeAt`
bands put 0.72–0.86 at ROCK and `>= 0.86` at PEAK, and `elevRaw` adds
`max(0, 1 - dMount/600) * 0.55` — so the most reliable way for all ~1,662
tiles of the `COLOSSEUM_R + 3` disc to clear 0.42 is to sit on Mount
Dragonspire. Because the loop no longer stops at the first candidate that
clears the separations but keeps hunting for a 100%-land one, that bias
becomes the selection rule.

**Measured in the game over 40 seeds: 22 of 40 (55%) put the arena on ground
that is more than half ROCK/PEAK band, and 11 of 40 (27.5%) on ground more
than half PEAK.** Worked examples: seed 285117085 — mean elevation 0.991,
98.7% PEAK, 254 tiles from MOUNT. Seed 71279272 — mean 0.975, 85.9% PEAK.

PART B's `h = 0` line then sits *after* the Mount boost in `rawHeight()` and
overrides it, so on those seeds a **46-tile-wide flat grass disc is punched
into the snow massif**. `SKILL.md`'s v6 line reads "MUST NOT regress: …
mountain/volcano separation", and the file's own CALDERA comment states the
rule directly: "the volcano silhouette is on the skill's must-not-regress
list … not a hole in the mountain."

The harness seed is one of the lucky ones (43% rock, 2.9% peak, 2,196 tiles
from MOUNT), which is why the pre-build measurement never saw this. **The live
world's seed is not the harness seed, so I cannot tell you whether the live
arena would land on the mountain — it is roughly a one-in-four chance.**

I cannot fix this inside the spec. The spec states the predicate as
`elevRaw >= 0.42` and says in PART A "The existing distance rules stay exactly
as they are", which rules out both an elevation ceiling and a COLOSSEUM↔MOUNT
separation.

### 2. The arena clearing paints over the hand-composed Ruin

`placeRuinsAndZones()` checks ruin candidates against SPAWN, VOLCANO, MOUNT
and other ruins — **not** against the Colosseum. (The *zone* loop was hotfixed
for exactly this in v41: "this loop never checked separation against the
Bazaar, Ancient Forge, or Colosseum… shifted landmark positions finally
triggered it on a real seed." The ruins loop never was.) `B.RUINB` is not in
the four guards the spec says to copy verbatim, so the clearing turns a
Ruin's carved floor to grass and the flatten drops it to `h = 0`.

**Measured: 2 of 40 seeds (5%) have a Ruin centre within `RUIN_FOOT + 23` of
the chosen Colosseum.** `SKILL.md`: "hand-composed ruin (user declared it DONE
— never alter its composition)". And note the compounding — PART A moving the
landmarks is precisely the "shifted landmark positions" trigger that bit this
file once already.

### 3. The arena fills with bushes, pebbles and flowers

This one surprised me and it is the clearest proof that the spec's PART C does
not do what PART C wants. `featureTypeAt()` returning `null` does not stop
`buildFeatureChunk()` — it **falls through** to the decor branch. The Bazaar
is clean because it has a separate `continue` at the top of that tile loop
*and* its own keepout in the PLAINS-decor loop. The Colosseum is in neither,
and PART B has just turned all ~1,662 tiles into `B.PLAINS`, which is exactly
the biome those two generators grow on.

**Measured on the harness seed with the build applied: 151 decor objects
standing inside the arena — 49 bushes, 55 pebbles, 47 flowers — against 1
inside the Bazaar.** Plus 9 features drawn inside the radius by jitter drift
from tiles just outside it. `SKILL.md` MUST NOT regress: "decor density". The
spec's own words, "Nothing else about the Colosseum changes", are not true as
written.

**This one I can fix without touching the spec** — it is the Bazaar's existing
keepout added to the same two decor branches — and the patch does not yet do
it, because it only matters alongside the decisions above.

### 4. PART H alters tree placement and density, which the same list forbids

`SKILL.md`: "organic tree clustering (user likes it — **never alter
placement/density**)". The file quotes that line verbatim ~45 lines above the
branch PART H changes. PART H is a deliberate, measured instruction in your
own locked spec with a numeric target, so I read it as you changing your mind
for one biome — but it is a direct hit on that line and you should know it was
taken knowingly, not missed.

It also works differently from how it reads. `P(clusterNoise > 0.42) = 0.624`
against `P(> 0.30) = 0.795`, so the clump gate's rejected area falls from 37.6%
to 20.5% — **the clearings shrink by about 45%** and the uniform per-tile hash
does proportionally more of the placing. The target is met (DARKFOREST 56.0%,
Forest 36.7%, +19.3 points) but what you get is a 56% near-uniform scatter
rather than a denser *forest with clearings*.

---

## What I need from you (four decisions, then it ships)

1. **May the land test get an upper bound?** Reusing the band already in the
   file — `isPlaceableLand()`'s `e >= 0.44 && e < 0.84`, documented there as
   "above SAND (0.42) and below PEAK (0.86), with margin", and already used by
   the Dragon Altar in the same function — kills blockers 1 outright and is
   reuse rather than invention. It will move the landmarks again.
2. **May `COLOSSEUM` get a MOUNT separation** in its attempt loop, the way it
   already has one for VOLCANO? If so, what distance?
3. **May `B.RUINB` (and `VOLROCK`/`CALDERA`) join the clearing's guard set**,
   so the arena never paints over a Ruin or the volcanic band? Same question
   for the Bazaar's line, which has the same hole but is kept safe only by its
   larger separation.
4. **Confirm PART H is intended** against "never alter placement/density", and
   say whether you want the clearings kept — lowering only `clusterNoise` and
   leaving `h` at 0.42 would raise density while preserving the clump
   structure, if that is closer to what you pictured.

Answer these in README's spec section (or just in `NEXT_BUILD.md`) and the
next run applies the patch, makes those four changes, and re-runs the
gauntlet.

---

## Two smaller things also worth fixing when it resumes

- `landmarkLandFrac` is module-level, never reset, and both writes are
  conditional — so if a seed ever found no candidate clearing the separations,
  the harness hook would report the **previous** world's fraction. 0 of 1,500
  seeds hit it, so it is latent, not live, but it is a free fix.
- Three radius claims in the new comments are wrong: `LANDMARK_KEEPOUT` is
  `COLOSSEUM_R + 2`, `inColosseum()` (the PvP rule) is bare `COLOSSEUM_R`, and
  the sand floor is drawn at `COLOSSEUM_R * COLOSSEUM_WALL_RING` ≈ 8.4 tiles.
  The clearing at `COLOSSEUM_R + 3` is larger than every other Colosseum
  radius in the file, so it leaves ~6.6 tiles of flat grass outside the
  outermost columns with a cliff at its rim — which is also why PART A tests
  1,662 tiles where ~845 would do, raising the high-ground bias in blocker 1
  for nothing.

---

## For the record — what did work, and is in the patch

Everything here passed its gate and looks right on screen:

- **PART A** does fix the real bug. The Ancient Forge was measured on `B.DEEP`
  with 93 DEEP / 8 WATER / 5 SHALLOW tiles around it — a box floating in open
  sea that you had to swim to, to smelt the only dragonsteel in the world. It
  now stands on solid volcanic rock on the volcano's flank, 364 tiles from the
  crater as always. 100% land on all 5 swept seeds, no fallback.
- **PART D** (compass): zero intersecting label pairs over 20 standing points,
  all 9 dots always present, nearest landmark never loses its label. The
  "ARENA/SHRINE/SPAWN as one blob" problem is gone.
- **PART E** (help panel): both cards lift and return pixel-exact.
- **PART F** (caves): flat near-black backdrop, the sky block does not run
  inside an interior, v55 darkness untouched.
- **PART G** (lava): 45.0% crust / 19.8% venting measured over the real core,
  no gradient added, no new palette entry.
- **PART I**: identical wild set both orderings, `isWildVisible` calls 3,094 → 3.
- **PART J**: all four new shots produced, and `shot.js` now exits 0 with
  "skipped" when Playwright is missing.
- **Gate integrity**: 1718 → 1775 PASS, no silenced gates, no weakened
  tunables, parse floor held, no swallowed errors, no secrets. The one
  existing constant that moved (`Dark Forest band untouched`, 236,495 →
  235,008) was re-measured and its cause traced to the moved Safe Zone, in the
  same way v20, v50 and v51 each re-measured it.
- **Doubt pass**: fresh-context adversarial reviewer, which ported the noise
  functions to Node and swept 1,500 seeds. Cross-model skipped:
  non-interactive context. 14 findings — 4 actionable-and-unfixable-in-spec
  (above), 4 actionable-and-cheap (fixed or listed above), 6 noise/nits.

---

## ⚠️ The Night Run report did not get through

Step 9's POST to `https://jarvis-aio.onrender.com/api/nightrun/report` was
attempted twice, 30s apart, and both times returned **HTTP 500
`{"error":"NIGHT_RUN_TOKEN is not set on the server"}`**. `NIGHT_RUN_TOKEN` IS
set in this environment (48 chars) and was sent — the variable is missing on
the server side, not here.

That matters more than usual: step 9 exists precisely because "BUILD_FAILED.md
on a side branch is invisible to him (14 straight RED nights, 28 Sep–11 Oct,
never reached him)". Tonight's stop reached you only by push notification. **If
the server config is not fixed, every future night's report — green or red —
will silently fail the same way.**
