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
- Round 1 scoring of the S1 shots: **overall 2.97 / 5**.
  - Weakest categories: Landmark presence 2.17, Life 2.44, Readability 2.61.
  - Strongest: Night mood 3.50, Palette 3.42, UI 3.35.
- Round 1 targets: landmark set pieces (Colosseum, Ancient Forge, Shrine), ambient life (using the existing spawners), and readability (nameplates drawn last, see-through player when hidden).
