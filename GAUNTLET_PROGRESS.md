# Gauntlet progress

Session started 2026-10-13 17:32 Sydney, by the owner ("start the gauntlet now, go until usage ends").

## Baseline (S0)
- `runehaven.html` was unchanged since v59, so the 2026-10-12 full check is the baseline:
  - run3 clean;
  - run4 1718 PASS / 0 FAIL;
  - run5 CAUGHT none;
  - frame rate (headless 1280×720) 28.3 at Spawn, 17.0 at the Colosseum, 16.7 at the Bazaar.
- "Before" contact sheets are in the session scratchpad (not committed).

## S1 — World Check Fixes: SHIPPED to `main`
- Built from last night's saved patch plus README's OWNER DECISIONS (2026-10-13), then two fresh-context doubt cycles (Opus reviewer), with every finding classified and fixed.
- Gates: run3 clean, run4 **1800 PASS / 0 FAIL**, run5 CAUGHT none. The visual check passed; the real-browser help overlap check found no overlaps.
- **Judgment call (flagged):** Dark Forest follows owner decision 4's *aim* ("denser WITH clearings"). The mechanism it named was measured doing the opposite.
- **YELLOW:** the live world moves. The Ancient Forge and Colosseum move on almost every seed, the Safe Zones move on most seeds, and a few Ruins move.
- Night Run report (README step 9) was skipped: `NIGHT_RUN_TOKEN` is not set in this session.
- `NEXT_BUILD.md` now points at Mobile & Touch, so the nightly build won't redo this work.

## S2 — Showcase polish loop: IN PROGRESS
- **Round 1 SHIPPED to `main`** (2026-10-14): nameplates drawn last + see-through player behind cover; Colosseum floor/columns/lintels; Ancient Forge furnace house; Shrine gate; leaves, butterflies, landmark smoke, flocks, crows, rabbits at world scale.
  - Score 2.97 -> **3.28** (Landmark 2.17 -> 3.00, Readability 2.61 -> 2.95, Life 2.44 -> 2.62).
  - run4 1800 -> **1840 PASS / 0 FAIL**; frame rate within budget (Colosseum -7%, Bazaar -3% vs main).
- Round 2 targets (lowest now: Life 2.62, Readability 2.95, Landmark 3.00): make the life cues big enough to see in a still and let the tour reach steady state; the Volcano (orange carpet, no cone, no night glow); actor labels in fights; COMPASS/MINIMAP caption plates.
- Note: the 5:06am nightly on 2026-10-14 ran but pushed no branch, so nothing clashes with this work.
