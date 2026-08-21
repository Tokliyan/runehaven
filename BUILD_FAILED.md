# BUILD FAILED — v41 (World Expansion, N 240 -> 480)

**Date:** 2026-08-21
**Spec:** README.md, "Confirmed, locked spec for the next build (v41 — World Expansion)"
**Status:** STOPPED under README rule 5 (RED). `runehaven.html` is **unchanged** —
reverted to the v39 commit `cbf6475`. Nothing was shipped.

The v41 patch was written in full, it parses clean, and `run3` boots the new
480x480 world with `CAUGHT ERROR: none`. It was then reverted, because
**`run4` returns 24 `FAIL` lines and at least ten of them are real world-content
loss, not stale scale-bound pins** — and every available fix requires a decision
the spec explicitly forbids or does not make.

---

## What was applied (and verified) before the stop

Every value the spec names was confirmed present in the real file at exactly
the stated value before a line was written. The audit in the spec is accurate
on all fifteen of them:

| spec item | found in file | line |
|---|---|---|
| `N: 240` | ✅ 240 | 580 |
| `SAFE_RADIUS: 27` | ✅ 27 | 585 |
| `RUIN_SEP: 40` | ✅ 40 | 2200 |
| `RUIN_ZONE_SEP: 24` | ✅ 24 | 2202 |
| VOLCANO from TOWER `75` | ✅ 75 | 2127 |
| MOUNT from TOWER `72` | ✅ 72 | 2132 |
| BAZAAR from TOWER `48` | ✅ 48 | 2140 |
| ANCIENT from VOLCANO `22` | ✅ 22 | 2149 |
| COLOSSEUM from TOWER `60` | ✅ 60 | 2155 |
| DRAGON_ALTAR from TOWER `34` | ✅ `DRAGON_ALTAR_DIST = 34` | 1137 |
| PART C `BAZAAR_R 7` / `ANCIENT_R 4` / `COLOSSEUM_R 9` / `DRAGON_ALTAR_R 2.2` / `BASE_MIN_SEP 3` | ✅ all five | 1122–1136, 5566 |

All ten PART A/B patch anchors were confirmed **unique** (`grep -c` = 1 each)
before editing. All ten edits landed. The spec's headline noise finding is also
**confirmed true**: all six pocket fields really are `valueNoise(tx / 20, ...)`,
and elevation/clusters/height really are `/13`, `/9`, `/3.5` — none reference
`N`. That part of the audit holds.

---

## THE BLOCKER — PART B's list is not complete, and the omission deletes content

PART B says it is *"every constant that genuinely IS relative to a fixed point …
confirmed as the complete real list"*. It is not. The following are all
distances measured in tiles from a fixed world point — the same category as
every entry in PART B — and they appear in **neither** PART B **nor** PART C:

| constant | line | what it is |
|---|---|---|
| `dV < 27` | 2615 | the volcano cone radius (the whole VOLROCK band) |
| `dV < 7.5` | 2616 | the lava core radius |
| `if (b === B.PEAK && dV < 42)` | 2628 | the PEAK→ROCK buffer (the 2026-07-11 "no transition" fix) |
| `1 - dMount / 36` | 2270 | the mountain massif radius in `elevRaw()` |
| `1 - dTower / 120` | 2269 | the central land bump in `elevRaw()` |
| `RUIN_FOOT = 4.5` | 2203 | a Ruin cluster's carve footprint |
| `ZONE_R = 8` | 2201 | a Safe Zone's clearing **and** protected radius |
| `ZONE_SEP = 40` | 2201 | Zone-to-Zone — the third member of the trio whose other two (`RUIN_SEP`, `RUIN_ZONE_SEP`) **are** in PART B |

v19 — the version this one is modelled on — explicitly *did* scale this family.
Its changelog entry in `runehaven-art-style/SKILL.md` reads: *"Volcano and
mountain keep their silhouettes. Cone rim, lava core, the VOLROCK band and the
PEAK→ROCK buffer … all tripled together, so the landmark reads at the same
proportion of the world it always did rather than becoming a pinprick on a
bigger map."* v41 leaves them all fixed.

### The measured consequence

Booted the real file at N=480 (seed 123456789, the run3/run4/run5 seed) and
counted every tile. Most biomes grow ~4x with the map, as the spec predicts.
The landmark-geometry ones do not:

| biome | N=240 | N=480 | ratio |
|---|---|---|---|
| DEEP | 28305 | 120916 | 4.27x |
| FOREST | 4997 | 19792 | 3.96x |
| DARKFOREST | 763 | 4445 | 5.83x |
| **VOLROCK** | **1120** | **1070** | **0.96x** |
| **LAVA** | **163** | **124** | **0.76x** |
| **PEAK** | **464** | **1013** | **2.18x** |
| **RUINB** | **408** | **414** | **1.01x** |
| **CALDERA** | **175** | **0** | **0.00x** |

The volcano is now 1/4 of its former share of the world. The Sunforge Caldera
is carved out of VOLROCK by a `/20`-wavelength field — so with the VOLROCK
disc frozen at ~1000 tiles while the map quadruples, whether a caldera blob
happens to overlap the cone becomes a coin flip. **It came up empty.**

This is systematic, not one unlucky seed. Six seeds, same file, both scales:

```
                 N = 240 (shipped v39)          N = 480 (v41 patch)
seed         VOLROCK  CALDERA  mtnRuins     VOLROCK  CALDERA  mtnRuins
123456789       1120      175         1        1070        0         0
11111           1058        1         0        1364        0         1
22222           1769        0         0        1938        0         0
33333           1295      178         1         763        0         0
44444           1403      117         3         721        0         1
55555            694      121         0        1289       81         1
```

**Sunforge Caldera present in 4 of 6 seeds before the expansion, 1 of 6 after.**

### What that costs, in content

- **The Sunforge Caldera biome does not exist** in the world (0 tiles).
- **Salamander King: 3 -> 0.** It is CALDERA-gated. Its taming, its feeding
  clock, and its entire v25 rampage system are unreachable — six `run4` lines
  fail on this alone.
- **Crystal Golem: 2 -> 0.** Separate cause, same root: `PEAK` grows only 2.18x
  because the `dMount / 36` massif never scaled, so high ground is relatively
  scarcer and **0 of 6 Ruin clusters** clear `MOUNTAIN_RUIN_ELEV = 0.72`. The
  v25 comment on that constant says exactly this: *"if a future seed change
  left none qualifying, Crystal Golem would be unreachable."*

Three bible entries — one biome and two species — silently gone. That is
precisely the "do not ship anything broken" case.

---

## SECOND BLOCKER — PART E's pocket-proportion gate cannot be satisfied as written

PART E asks to *"measure each pocket's percentage of its parent terrain, and
confirm it matches the pre-expansion percentage within a small tolerance. This
is the proof that leaving the wavelengths alone actually worked as intended,
not just an assumption."*

Ran that proof. It fails, and not only because of the blocker above:

| pocket (% of its parent) | N=240 | N=480 |
|---|---|---|
| Enchanted Forest | 7.24% | 9.39% |
| **Sacred Meadow** | **3.97%** | **15.14%** |
| Underground Caves | 2.46% | 2.97% |
| Underwater Caves | 5.24% | 6.51% |
| Abyssal Hollow | 3.12% | 3.07% |
| **Sunforge Caldera** | **13.51%** | **0.00%** |

Abyssal Hollow is essentially exact (3.12 -> 3.07), which is the spec's thesis
working. But Sacred Meadow moves 3.8x — and the seed sweep shows why the gate
itself is the problem: **at the unchanged N=240, Sacred Meadow's share of
MEADOW swings from 0.13% to 31% across seeds** (0.13 / 1.66 / 3.97 / 9.48 /
28.0 / 30.9 on the six seeds above). For a small, patchy parent this ratio is a
high-variance per-seed draw, not a stable quantity. No tolerance small enough
to be meaningful can pass it at *either* scale.

So the gate needs redefining — a many-seed mean, or a global-field coverage
measure rather than a per-parent ratio — and redefining a spec's own proof gate
is not a call to make silently at 2am.

---

## Full `run4` result: 717 PASS / 24 FAIL

**Real regressions (not fixable by updating an assertion):**

```
FAIL - Sunforge Caldera exists (0 tiles)
FAIL - a CALDERA tile keeps the volcano cone's height (2 or 3)
FAIL - the Caldera is reachable on foot from spawn (0/0 tiles)
FAIL - salamander_king still spawns after the density cut (0)
FAIL - it came back as a hostile mob (0 -> 0)
FAIL - the hostile King stands on a Sunforge Caldera tile
FAIL - the rampage builds and returns the mob
FAIL - it opens with one aggro tick on the player who neglected it
FAIL - the hostile form arrives at its full MOBS hp
FAIL - at least one Ruin is a mountain ruin (0/6)
FAIL - crystal_golem still spawns after the density cut (0)
FAIL - crystal_golem actually reached the world (0)
FAIL - every crystal_golem sits inside a TAGGED mountain ruin
FAIL - every pocket is reachable on one tank of air (budget 138 tiles)
FAIL - Bandit spawns near multiple Ruin clusters (1)
```

The last two are a separate, second-order consequence the spec also does not
cover: **entity counts and spawn search budgets were left alone** (correctly —
PART B does not list them and v19 handled them as its own explicit judgment
call). At 4x the area with unchanged counts, Bandits now reach only one Ruin
cluster, and Underwater Cave pockets go 21 -> 64 with the 138-tile air budget
unchanged, so at least one pocket is no longer reachable on one tank. v19's
precedent (scale search budgets by **area**, leave design counts alone) would
likely fix the first; the air-budget one is a genuine design question.

**Stale scale-bound pins — these are the legitimately-updatable kind, listed
so the next attempt knows the work is small:**

```
FAIL - Dark Forest band untouched (4445 tiles)          pinned at 763 -> 4445
FAIL - N scaled to 240 (was 80)                         -> 480
FAIL - SAFE_RADIUS scaled to 27 (was 9)                 -> 54
FAIL - Ruin-to-Zone separation is 24, not 40 (FIX 1)    -> 48
FAIL - every other separation unchanged (ruin 80, zone 40)
FAIL - the Ancient Forge is near the Volcano ...        distance pin -> 44
FAIL - it stands near the Tower the orb comes from      distance pin -> 68
FAIL - taking damage pushes combatMusicUntil ~6s out    test site now inside the bigger safe zone
FAIL - the burst reaches players as well as mobs        same — harness placement, not game logic
```

What DID work, unchanged, exactly as the spec predicted — worth keeping for the
next attempt: all six Ruins and all four Safe Zones place cleanly at the new
`RUIN_SEP 80` / `RUIN_ZONE_SEP 48`; every landmark places without overlapping
another at the new distances; the Elder Drake's `for (let r = 3; r < 26; r++)`
local search (PART D) still finds valid terrain and the drake spawns; the
Unicorn Elder's `hash2(...) * N * N` draw stays uniform with no bias (`hash2`
has 32-bit resolution against 230,400 tiles — ~18,600 hash values per tile, so
no quantisation); and Meteor Shower placement lands correctly across the full
new map (its `METEOR_COUNT * 40` sample budget is N-independent). PART A/B/C/D
are all fine. It is only the constants PART B **missed** that break it.

---

## Why this is RED and not a judgment call

Under README rule 5:

1. **"Any test harness actually fails … the mechanical, objective signal that
   something is genuinely broken. Never overridden."** — `run4` has 24 `FAIL`
   lines, ten-plus of them real content loss.
2. Every remedy needs a decision the spec forbids or does not make, and they
   interlock:
   - Scale the volcano cone / lava core / PEAK buffer / mountain massif /
     `RUIN_FOOT` / `ZONE_R` / `ZONE_SEP`? PART B states its list is complete.
     Adding seven entries to a locked list changes the world silhouette, the
     ore band's size, the RUINB area and the safe-zone footprint — that is a
     design decision, not a tunable.
   - Lower `CALDERA_RARITY` so the Caldera survives a smaller cone? The spec
     says in bold: **"Do not touch … `CALDERA_RARITY`."**
   - Lower `MOUNTAIN_RUIN_ELEV` so Crystal Golem is obtainable? Not mentioned
     anywhere in the spec, and it decides whether a bible species exists.
   - Redefine PART E's proof gate so it is satisfiable? That is the spec's own
     proof, not mine to relax.

   Three-plus genuinely unspecified, interdependent decisions with real
   gameplay consequences — the fourth RED bullet, and a case where any guess is
   a design decision rather than a tunable.
3. Rule 5's tie-breaker: *"When genuinely unsure which zone something belongs
   in: treat it as RED."*

---

## What the next spec needs to say (one short revision unblocks this)

The patch itself is trivial and already proven to apply cleanly. What is
missing is one paragraph of decisions:

1. **Extend PART B** with the landmark-geometry constants, or state explicitly
   that the volcano and mountain are *meant* to become 1/4-relative-size
   features on the bigger map (a defensible choice — but it must be a choice,
   and it contradicts v19's recorded must-not-regress note on their
   silhouettes). Suggested if scaling: `dV < 27 -> 54`, `dV < 7.5 -> 15`,
   `PEAK buffer 42 -> 84`, `dMount / 36 -> / 72`, `dTower / 120 -> / 240`,
   `RUIN_FOOT 4.5 -> 9`, `ZONE_R 8 -> 16`, `ZONE_SEP 40 -> 80`. (Note that
   `ZONE_R` doubles the *protected* radius too, which is why it needs saying
   out loud rather than being folded in silently.)
2. **Say what happens to spawn search budgets** (v19 scaled them by area:
   wilds 4000 -> 36000, mobs 600 -> 5400 — the same rule gives 144000 / 21600
   here) and whether entity counts stay put. Leaving counts alone is what v19
   chose deliberately; it just needs restating so it is not read as an
   oversight.
3. **Say what happens to the underwater air budget** now that UWCAVE pockets
   go 21 -> 64 and at least one is no longer reachable on one tank.
4. **Restate PART E's pocket gate** as something the worldgen can actually
   pass — a mean across many seeds, or a global coverage measure — since the
   per-parent ratio is a high-variance per-seed draw at the *current* N too.
5. **Confirm the terrain bake is acceptable at this scale.** `bakeTerrain()`
   paints the entire map into one offscreen canvas: at N=480 that is
   **21164 x 10694 px, ~226 Mpx, ~900 MB** of backing store, up from v19's
   already-flagged 10604 x 5414 (~219 MB). Inside desktop Chrome's ~268 Mpx
   canvas-area cap, but with very little headroom and past what several
   browsers will allocate. Chunking the bake is a rendering-architecture
   decision, so it is flagged here rather than attempted. This did not block
   the build (the harness stubs the painting) but it is the thing most likely
   to break in a real browser at N=480.

---

## Reproduce

```bash
npm ci                                  # jsdom is not vendored in this repo
node debug/run3.js runehaven.html       # clean at N=480 — booting is not the problem
node debug/run4.js runehaven.html       # 717 PASS / 24 FAIL at N=480
```

`NEXT_BUILD.md` was **not** edited — it still points at the v41 spec, so a
revised v41 will be picked up automatically on the next run.
