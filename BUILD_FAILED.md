# BUILD FAILED — v49 (Feature-List Chunking & Spawn Density Rebalance)

**Date:** 2026-08-28
**Stopped under:** README "standard process" step 5, RED condition 1 —
*"Any test harness actually fails … or any `run4` line is `FAIL` … Never
overridden."*

`runehaven.html` is **unchanged**, exactly as the RED rule requires.

---

## The one-sentence blocker

**`node debug/run4.js runehaven.html` already reports 25 `FAIL`s against the
CURRENT, UNMODIFIED `runehaven.html`** — before a single line of v49 was
written — so the gate "zero errors/FAILs before shipping" cannot be met by
any build tonight, and clearing those 25 is a different job than the one
`NEXT_BUILD.md` points at.

```
run4 on committed runehaven.html (HEAD, no v49):   1135 PASS / 25 FAIL
run4 on the same file with v49 applied:            1119 PASS / 41 FAIL
   → of those 41, the SAME 25 fail either way. v49's chunking added ZERO.
   → the extra 16 are PART D's own count table (see "What v49 did" below).
run3 on committed runehaven.html:                  CAUGHT ERROR: none
run5 on committed runehaven.html:                  1084 draws, CAUGHT: none
```

So `run4` is the only failing harness, and it is failing on the world as it
was handed to me.

## What the 25 pre-existing failures actually are

Every one of them traces to the same root cause: **`debug/run4.js` still
describes the N = 2000 world, while `runehaven.html` has been N = 4000 since
Expansion 4 (v48).** The harness was never synced when the world doubled.
Corroborating evidence, since this is a strong claim:

- The harness's own comments say so in as many words — e.g. *"Expansion 3:
  ANCIENT is placed 182 from the Volcano (91 \* 2)"*, *"Expansion 2b: 27 ->
  82"* — those are N = 2000 numbers being asserted as literals.
- `run4`'s v46-C constant-list gate prints its whole expected list and reports
  **0 of 13** found, all of them N = 2000 doubles (`* 626`, `* 600`, `* 400`,
  `dTower / 1000`, `for (let r = 18; r < 162; r++)`, `DRAGON_ALTAR_DIST = 282`,
  …). The file has the N = 4000 versions of every one.
- Running this same `run4.js` against the v47 file (`18c2a23`, the last
  N = 2000 build) does **not** reproduce the 1160/0 its commit message claims
  either — it dies at `run4.js:1758` with
  `TypeError: Cannot read properties of null (reading 'onended')`. So the
  committed harness matches neither the world before Expansion 4 nor the world
  after it.

They fall into three kinds, and **the third kind is why I did not simply
re-record the numbers and carry on**:

**(1) Stale N = 2000 literals — 17 gates.** Mechanical to re-record once
someone decides that is the job:
`N scaled to 2000` · `SAFE_RADIUS scaled to 226` ·
`Ruin-to-Zone separation is 200` · `every other separation scaled correctly
(ruin 664, zone 664)` · `the Ruin footprint and Zone clearing scaled too` ·
`N is the scaled-up 2000` · `the safe zone radius is the scaled-up 226` ·
`the interior grid is the current 80x80` (it is 160 now) ·
`v46 C: the interior grid is untouched by the overworld expansion` ·
`v46 C: every scaled constant landed (0/13)` ·
`v46 C: the wild and mob spawn keepouts are named, not literals` ·
`v46 C: BREATH_MAX is deliberately NOT scaled` ·
`v46 D: it is a real canvas, ~10x10 tiles centred on the player (961 tiles)`
(v48 made the minimap 3x) · `Dark Forest band untouched (244534 tiles)`
(expects 56847) · `the Elder Drake spawned near the Volcano` (< 82, the ring
is 36..324 now) · `the Ancient Forge is near the Volcano` (< 190) ·
`it stands near the Tower the orb comes from` (< 290).

**(2) v48 content the harness has never been told about — 2 gates.**
`sea_serpent is the hardest ordinary mob in the world` and
`v47: the mob roster is exactly the old twelve plus the Adult Golem` — both
predate v48's Demon Knight. Whether the Demon Knight is *allowed* to out-HP
the Sea Serpent is a design answer someone has to give; the gate's own
comment is explicit that it was "updated, not relaxed" the last time, and
naming a third exception without being told to would be relaxing it.

**(3) Gates that may be catching something genuinely broken — 6 lines, and
these are the reason this is a STOP rather than a re-record.** I cannot tell
from here whether each is a stale literal or a real Expansion 4 regression,
and guessing either way is exactly what the RED rule forbids:

- `most Underwater Cave pockets are reachable on one tank (2401/3438)` +
  `most of the biome BY AREA is reachable (63.4%)` +
  the same pair for the Abyssal Hollow (`1483/2127`, `65.4%`).
  **This is the exact thing `SKILL.md`'s v46 judgment call 6 said would
  happen and said must not be silently re-tuned again:** *"this one is weaker
  again and saying so plainly is the point … If the intent is that a diver can
  reach anywhere, the fix is a real design change and belongs in a spec: scale
  `BREATH_MAX` with the world, or keep the rare pockets off the open ocean."*
  The bar has already been lowered 0.8 → 0.7 once. It is now at ~0.63–0.65.
  Lowering it a third time is a design decision, not a build step.
- `surfaced, WASD cannot enter deep water (stopped at x 2258.07)`. If this is
  real, a player who is not diving can walk into the deep sea — a movement
  gate, not a constant. It may equally be that the test's tile-pair search
  picks an unsuitable shoreline at N = 4000. **Not diagnosed.**
- `it stands on a Ruin tile` — the Golem Elder's tile is not reporting
  `B.RUINB`. `golemElderSpot()` only ever returns a RUINB tile, so either the
  world moved under it or the hook is reading a different position than the
  one the gate assumes. **Not diagnosed.**

## Why this is RED and not YELLOW

README step 5 lists exactly one YELLOW shape that could plausibly apply here
("a single tunable number or threshold is uncertain"), and kind (3) above is
not that: the dive-reachability bar is a threshold that `SKILL.md` has already
ruled belongs in a spec, and the other two are undiagnosed behaviour, not
tunables. The step also says, in as many words: **"When genuinely unsure which
zone something belongs in: treat it as RED."**

Fixing these is also not something tonight's prompt permits me to choose: it
says *"Never decide what to build next on your own — only ever follow what
`NEXT_BUILD.md` currently says."* `NEXT_BUILD.md` says v49.

---

## What v49 itself did — it is finished, verified, and NOT shipped

This is recorded so the rebuild is mechanical rather than a fresh design.
The complete diff is saved beside this file as **`BUILD_FAILED_v49.patch`**
(310 insertions / 38 deletions, against `ae3f277`). **Do not apply it until
the blocker above is cleared** — it is evidence, not a pending change.

### PART A/B/C — chunked feature loading (measured, not assumed)

Same jsdom boot, same seed (123456789), same machine, `heapUsed` after a
forced GC:

| | login | heap after login |
|---|---|---|
| v47, N = 2000 (`18c2a23`) — the "pre-Expansion-4" target | **8.05 s** | **215.3 MB** |
| HEAD today, N = 4000 (the regression) | **37.67 s** | **717.3 MB** |
| HEAD + v49 | **5.99 s** | **165.8 MB** |

Tiles scanned at login: **16,000,000 → 102,400** (25 chunks of 64x64).
`run3`'s own login timer agrees: 37.6 s → 5.2 s. `run5` is byte-identical at
**1084 draws, CAUGHT: none** — the world draws exactly as it did, which is the
point.

Phase profile of the remaining 6 s, so nobody re-derives it: the chunk window
is **131 ms**. The rest is the *wild spawn search* (5.7 s), the dock scan
(0.5 s) and the mob search (0.4 s) — none of which is the eager N² feature
pass this spec names, and all of which were already inside the 8.05 s target.
That search loop is the obvious next thing to look at if login is ever
squeezed further.

Design as built:
- `FEATURE_CHUNK = 64` (the spec's proposal, kept).
- `FEATURE_LOAD_R = 2` — a 5x5 window. **⚠️ The spec's two proposals disagree:
  "3 chunks" is a 49-chunk window, and "a 9-chunk window" is a radius of 1.**
  The tie-break used is the spec's own instruction to verify against the real
  visible radius: the frame's four-corner `screenToWorld()` bounds reach
  `w/(4·IW2) + h/(4·IH2)` tiles either side of the camera (46 at 1920x1080, 62
  at 2560x1440), and a player on a chunk edge gets only `r` whole chunks of
  cover, so 2 → 128 tiles guaranteed. `featureWindowRadius()` widens it for a
  viewport large enough to need more rather than dropping trees off the edge.
  A gate measured 128 against the frame's own reported radius (38.2 at the
  harness viewport) rather than trusting the arithmetic.
- The double loop is `buildFeatureList()`'s own body **moved** into
  `buildFeatureChunk(cx, cy)` — bounds and push targets changed, nothing else,
  the same kind of move Expansion 2a made. `features` / `featureIndex` /
  `decor` keep their exact shape, so the render loop, `nearestGatherable()`
  and every other reader are untouched.
- Persistence is unchanged and that is the load-bearing half: `minedNodes`
  lives outside the chunks, is never evicted, and the builder skips a FINITE
  key that is in it — the same line the eager pass used. `removeFeature()`
  gained one thing: it now also splices the object out of its own cached
  chunk, or a window rebuild would stand a mined node back up.
- `updateFeatureChunks()` runs first in `update()` (a no-op until a boundary
  is crossed) and on `debugSetPlayer` teleports. Inside a cave interior the
  window holds at `me.surfaceReturn`, because interior coordinates are not
  world coordinates.
- Two debug hooks had to stop assuming the whole world is resident:
  `debugWorldInfo().ruinVeins` and `debugV37Info().bazaarClear` now ask
  `featureAtTile()` / `featureCensus()`, which read the cache when a chunk is
  loaded and compute-and-discard when it is not — same builder, same answer,
  and asking does not pull those chunks into memory.

### PART D — density, measured against the current map

Centred on the 4.0 that restores exactly v47's density, spread in v47's own
tier order: **Common x4.5, Uncommon x4.0, Rare x3.5.** Epic and above
untouched (4/4/4/3), no `base` moved, `MOBS` untouched.
Real spawned counts at N = 4000 against v47's at N = 2000:

```
tree/water/stone/wind_sprite, glow_moth  315 vs  70   density x1.13
wolf 145, stag 144, golem 72              vs 36/36/18  density x1.00-1.01
crystal_golem 28, fire/storm_dragon 42    vs  8/12     density x0.87-0.88
```

i.e. the walk to the nearest one is 6 % shorter for Common, unchanged for
Uncommon, 7 % longer for Rare. Relative spread inside each tier is exact
(golem still half of wolf, crystal_golem still half of unicorn, Common still
one shared number).

**⚠️ Two things a reviewer should look at before this ships:**
1. `speciesDailyCap()` reads `count`, so a Rare species' daily world cap
   scales with it again (Unicorn 16 → 56). v47 flagged this; it is four times
   bigger now.
2. The fight-to-tame pets (Boar, Bear, Griffin, Phoenix) take their density
   from `MOBS.count`, which v47 did not touch and this did not either — so
   those four are still 4x sparser than at N = 2000. That is a spec's call.

### v49's own proof gates

A purpose-built verification harness drove all of the spec's proof gates
against the real file through the real login path: **26 PASS / 0 FAIL**,
including a gather standing exactly on a chunk seam picking the genuinely
nearest node on either side (5/5 offsets, both chunks resident), and a node
taken for real through `doInteract()` staying gone after its chunk was
evicted and reloaded.

---

## What tomorrow's session should do

**Fix the harness, not the game.** In order:

1. Re-record the 17 stale N = 2000 literals in `debug/run4.js` as their
   N = 4000 values, reading each from the file rather than doubling by hand.
2. Decide the two v48 questions (kind 2): may the Demon Knight out-HP the Sea
   Serpent, and should it join the named mob roster?
3. **Diagnose, do not re-record**, the three of kind (3). The dive
   reachability bar in particular is a design decision that `SKILL.md` has
   already said belongs in a spec — do not lower it a third time without one.
4. Only once `run4` is 0 FAIL on the unmodified file: re-apply
   `BUILD_FAILED_v49.patch`, update `run4.js`'s `SP_COUNTS` table and the two
   exact-population gates (`Storm Dragon reaches its peaks`,
   `golem spawns its full v47 population`) to PART D's new counts, re-run the
   full gauntlet, and ship v49 with the changelog entry it has earned.
