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

## S2 — Showcase polish loop: SHIPPED to `main` (4 rounds, the cap)
- **Round 1 SHIPPED** (2026-10-14, 6a2585c): nameplates drawn last + see-through player behind cover; Colosseum floor/columns/lintels; Ancient Forge furnace house; Shrine gate; leaves, butterflies, landmark smoke, flocks, crows, rabbits. 2.97 -> 3.28.
- **Rounds 2-4 SHIPPED** (2026-10-16): Volcano cone with lava moat and crack network, lava as its own night light, plated labels and mob tags, compass/minimap caption plates; Shrine braziers, Forge roof, foam off the land; team-colour ground discs under every actor, enemy tags kept off the player's body, continuous surf; tile seams closed by a cheap ground underlay (the round 3 pad cost 9-13% fps and was removed).
  - Score 3.28 -> 3.54 (r2) -> 3.57 (r3) -> **3.67** (r4). Weakest now: Readability 3.24, Transitions 3.27, Landmark 3.50. **The "every category >= 4" target was not met**; the stage stopped on its four-round cap.
  - run4 1840 -> **1870 PASS / 0 FAIL**; run3 clean; run5 CAUGHT none.
  - Frame rate vs S1 (interleaved, final build): Colosseum -4.5%, Bazaar -2.6%, Forge -1.7%, Spawn -1.2% — inside the 10% budget.
  - **Flagged:** LAVA_CRUST_SHARE moved 45% -> 66% for the Volcano's scored problem; README PART G calls it tunable but its gate text still says 45%.
  - Independent Opus review of the rounds 2-4 diff: 9 defects (none throw), 7 fixed with new gates (rim glow, cone sawtooth, foam on grass, stacked labels, per-frame allocations, underlay past the world edge, foam strings). Open: tag plate dims the "!" warning; riders get no disc. Report: `.temp/delegate/s2-r234-review.md`.

## Owner decisions (2026-10-15)
- **S3 Mobile & Touch: dropped for now.** **S5 Account Security: dropped for now** (no `supabase_s5.sql`). The iPhone test and App Store wrapper are not targets for a long time. Recorded in GAUNTLET.md and as DEFERRED notes in README (insert-only; specs untouched).
- `NEXT_BUILD.md` now points at **Performance — Ground Cache & Quiet HUD** (S4), the next unbuilt spec. Its ground cache should also make the seam underlay unnecessary.

## S4 — Performance (Ground Cache & Quiet HUD): BUILT, pending review
- Ground baked into 16x16 chunk canvases (LRU 48, 2 bakes/frame, direct fallback, cleared with tileCache); camera offset snapped to whole pixels so cached and direct ground are pixel-identical; HUD writes only on change; RENDER_SCALE 1 recorded; water/lava loop walks on-screen tiles only.
- Frame rate vs main: Colosseum +38%, Bazaar +43%, Ancient Forge +142%, Spawn +25%.
- run4 1870 -> **1886 PASS / 0 FAIL**; run3 clean; run5 CAUGHT none; new **run6** (Playwright): pixel match 0.000% at 4 views, frame rate on/off 1.32x / 1.25x.
- **Owner decision (2026-10-21):** frame-rate bar 1.2x, not 1.4x — even no ground at all reaches only 1.39-1.50x (S2's Colosseum pieces now dominate that frame). Recorded in README.
- `NEXT_BUILD.md` -> World Encounters (S6).

## Remaining stages
S6 World Encounters, S7 Real Stakes, S8 Feel pass, S9 Final report.
