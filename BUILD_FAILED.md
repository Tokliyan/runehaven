# BUILD FAILED — v20 (Ruins as repeatable structures + scattered Safe Zones)

**Date:** 2026-08-08
**Result:** RED — stopped, nothing shipped. `runehaven.html` is byte-for-byte
unchanged (reverted after the blocker was proven). `run3.js` re-verified clean
on the reverted file.

## The blocker, in one line

**Part A's 6 Ruins and Part B's 4 Safe Zones cannot both exist.** Part B's
locked "minimum separation of 40 ... from every Ruin" means six radius-40
exclusion discs, and six of those blanket essentially the whole island. On the
harnesses' own test seed the maximum number of Safe Zones that can be placed
*at all* is **3**, not 4 — and that is with the loosest possible land test.

This is not a search-budget problem and not a tuning miss. It was measured by
**exhaustive scan of all 57,600 tiles**, not by the hashed search, so it is the
true geometric maximum, not what one placement algorithm happened to find.

## The measurement

Exhaustive scan, spec constraints exactly as written (candidate must clear:
40 from SPAWN/TOWER/VOLCANO/MOUNT, 40 from every Ruin, 40 from every other
zone, inside the existing 36-tile clamp margin), then greedy max independent
set over every qualifying tile:

| land test on the zone centre | qualifying tiles | max zones placeable |
|---|---|---|
| none at all (allows open ocean) | 918 | 7 — but only **3 on land** |
| centre tile only | 119 | **3** |
| centre + ring at r=2 | 68 | **2** |
| centre + ring at r=3 | 55 | **2** |
| centre + ring at r=4 | 47 | **2** |
| centre + ring at r=6 (matches the radius-8 clearing) | 35 | **1** |

Spec asks for 4. The best case is 3, and that best case is a zone whose
centre is on land but whose radius-8 grass clearing hangs off a coastline or a
cliff. A land test strict enough to actually keep the clearing on solid ground
gives 1–2.

Across five seeds (loosest land test, so these are upper bounds):

```
seed 123456789 (the harness seed): max 3 zones
seed 42:                           max 4 zones
seed 987654321:                    max 5 zones
seed 5150:                         max 4 zones
seed 777001:                       max 4 zones
```

Even the seeds that reach 4 only do so with the ocean-tolerant test, and the
one seed every proof gate actually runs against tops out at 3. Part C's
"Confirm all 4 `OTHER_SAFE_ZONES` entries placed successfully" cannot pass.

Reversing the order (place the 4 zones first, then the Ruins) just moves the
failure: only **3 of the 6 Ruins** then fit. The two targets are competing for
the same land, and 40 is simply too large a buffer for ten scattered points on
a 240×240 island whose habitable disc is roughly 90 tiles in radius.

## Why this is RED and not a YELLOW judgment call

`40` is not an uncertain tunable I was left to pick — the spec states it, and
**no value at or above it works**. Fixing it means overriding a locked number,
and there are at least four defensible ways to do that, each changing how the
world actually reads:

1. cut the Ruin↔Zone separation (24 gets 7 zones, 30 gets 3 — see below);
2. cut the zone target from 4 to 3 (or 2);
3. cut the Ruin count from 6;
4. shrink the zone-to-zone separation below 40.

Picking among those is a design decision, not a tunable. Per README ("when
genuinely unsure which zone something belongs in: treat it as RED"), I stopped
rather than guess.

For whoever decides: measured max zones vs. the Ruin↔Zone separation, harness
seed, with the strict r=6 land test / the looser r=4 test:

```
sep 40 -> 1 / 2 zones
sep 30 -> 3 / 5 zones
sep 24 -> 7 / 8 zones
sep 20 -> 8 / 7 zones
```

**A Ruin↔Zone separation of 24 comfortably yields 4 zones on every seed tested,
with room to spare, and still keeps a Safe Zone ~20 tiles clear of a Ruin's
4.5-tile footprint.** That looks like the cheapest single-number fix, but it is
your call, not mine — say the word in `README.md` and v20 ships in one pass.

## What was verified as working before the stop

Part A is sound as specified and was fully implemented and observed working —
it is only being reverted because the spec is one locked unit and Part B cannot
follow it. Recorded here so tomorrow does not re-derive it:

- `RUIN = {x,y}` → `RUINS = []`, six centres placed by the wilds/mobs hashed
  scattering pattern (`hash2(a, offset, worldSeed + seed) * N`), **not** the
  angle-radius-from-Tower technique. On the harness seed all six placed:
  `(58,72) (107,48) (181,99) (81,197) (165,164) (129,193)` — genuinely
  scattered, no clustering at the town centre.
- Land test during placement must use `elevRaw()`, **not** `biomeAt()`.
  `placeLandmarks()` runs before `tileCache.clear()`, so any `biomeAt()` call
  there bakes a pre-Ruin biome into the cache for every tile it touches and the
  `RUINB` carve then never appears. `elevRaw()` is pure noise with no cache.
  Band `0.44 ≤ e < 0.84` is solid ground.
- `buildRuinPieces()` → `buildRuinCluster(center)` with `const R = center;` is
  the entire refactor, exactly as the spec said — every other line already used
  `R.x + offset`. Clusters append to the one shared flat `ruinPieces` array, so
  rendering, depth sort and interaction needed no change whatsoever.
- The `RUINB` carve, the deliberate runic vein (`RUIN.x, RUIN.y - 1`, one per
  cluster now), and `debugWorldInfo()` all loop over `RUINS`.
- Golem and Bandit needed zero changes, exactly as the spec predicted — both
  gate on the `B.RUINB` tile type. `run4` showed 3 golems and 9 bandits
  spawning across the six clusters.
- The new dark archway/entrance decor piece (`k: "arch"` — two jambs, a lintel,
  and a flat near-black trapezoid mouth, ~2.5–3 tiles tall in a darkened ruin
  stone) drew clean through `run3`. Bible-supported: "Ruins — young golems,
  rare loot, dungeon entrances". Visual only; no interior, no Demon Knight.

### One more thing the next session will hit

The Ruin placement search found 6/6 on seeds 123456789 and 5150, but only
**5/6** on seeds 42, 987654321 and 777001 — with a 60,000-candidate budget.
That one *is* just a search issue, not a spec conflict: the exhaustive maximum
is 7–9 Ruins on every seed tested, so a valid sixth spot always exists. Widen
the budget or stop re-seeding the hash stream on each placement.

### Also expect this pinned assertion to move

`debug/run4.js` pins `Dark Forest band untouched (dark === 875)`. With v20's
carves it measured **861**, and the drop is fully accounted for: 9 Dark Forest
tiles absorbed by the six Ruin carves and 5 by a Safe Zone clearing
(875 − 9 − 5 = 861), verified by re-running with only those two overrides
removed. The pin is worldgen-bound and legitimately moves — but the final
number depends on how many zones ship, so re-measure rather than reusing 861.

## Standard-process checks actually run

- `new Function(scriptText)` parse check — **passed** (on the v20 work).
- `node debug/run3.js runehaven.html` — **passed**, `CAUGHT ERROR: none`, both
  on the v20 work and again on the reverted file.
- `node debug/run4.js` — reached the v19 Part E landmark block and failed there
  on `info.RUIN` (now `RUINS`); the harness update was pending the Part B
  resolution and was never written, since Part C's 4-zone gate cannot pass.
- `node debug/run5.js` — not run; no point gating a build that stops at Part B.

`NEXT_BUILD.md` was not touched.
