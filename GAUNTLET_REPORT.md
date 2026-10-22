# Gauntlet report — RuneHaven (2026-10-13 → 2026-10-23)

Started 2026-10-13 from v59 (`abe73f4`). All work is on `main`. The "after" contact sheet is `docs/gauntlet-after.jpg`: 23 shots from the tour plus the new title, character select and Settings. The RT pass (below) came after it.

## What shipped, by stage

| Stage | What | Commit |
|---|---|---|
| S1 World Check Fixes | Compass labels never overlap. The help panel no longer covers UI. A denser Dark Forest with clearings. Landmarks re-placed. | `59183a1` |
| S2 Showcase polish (4 rounds) | Name plates drawn last. A see-through player behind cover. Colosseum, Ancient Forge, Shrine gate. The Volcano cone and a glowing lava moat. Ambient life. Actor discs. Continuous surf. Tile seams closed. | `6a2585c`, `ea609c1` |
| S3 Mobile & Touch | **Dropped** by the owner (2026-10-15). | — |
| S4 Performance | A ground chunk cache, a whole-pixel camera, and a HUD that writes only on change. | `6be5dbd` |
| S5 Account Security | **Dropped** by the owner (2026-10-15). | — |
| S6 World Encounters | The Elder Drake roams on a shared deterministic route. A Bounty Board at Spawn. | `78881fc` |
| S7 Real Stakes | Shared weather (rain, fog, ashfall, snow). A death recap, a PACK mark and a pile beacon. Raid alerts and a login summary. Fixed a dupe: equipped gear dropped twice. | `0f078d6` |
| S8 Feel pass | Hit-stop. Screen shake with an off switch. WebAudio SFX. The first five minutes: new players now start at the Tutorial Grounds. | `6cc03fc` |
| Owner add-on: Front Page Rework | "The Reforging Update": the title screen, character select cards, a Thronefall-style Settings page, and a painted backdrop. | `0682024` |
| Owner add-on: RT pass (2026-10-23) | Readability, Transitions and Landmarks. Interlocking biome borders with foot shadows and edge props. A pulsing, backlit player disc, a bigger player, and glinting loot. A rebuilt Bazaar (tents, banner pole, bunting). Colosseum banners and a champion statue. A Volcano smoke plume and second lava flow. An Ancient Forge yard. Landmark night lights. | `gauntlet/rt-pass` merge |

## Numbers, before → after

| | Before (v59) | After (`main`) |
|---|---|---|
| run4 gates | 1718 PASS / 0 FAIL | **2067 PASS / 0 FAIL** (2039 before the RT pass) |
| run3 / run5 | clean / CAUGHT none | clean / CAUGHT none |
| run6 (new in S4) | — | pixel match 0.000% at 4 views; ground cache 1.43–1.52x on vs off after the RT pass |
| Visual scorecard (S2 card, 1–5) | 2.97 | **3.67** (scored at S2 round 4; later stages were not re-scored) |

**Frame rate.** Measured headless at 1280×720, before and after interleaved in one run, 3 reps of 3 s each:

| | Before | After | Change |
|---|---|---|---|
| Spawn | 24.4 | 29.3 | +20% |
| Colosseum | 14.4 | 29.2 | +103% |
| Bazaar | 17.5 | 24.3 | +39% |

## What's left (known, not fixed)

**Visual target.** "Every category ≥ 4" was not met; S2 stopped at its 4-round cap with Readability 3.24, Transitions 3.27 and Landmark 3.50 as the weakest.

The RT pass was scored separately: a fresh Sonnet scorer, the same card, 18 tour shots, before vs after (stricter than the S2 scorer, so compare within this pair only):

| | Before | After |
|---|---|---|
| Readability | 2.6 | 2.9 |
| Transitions | 2.7 | 3.0 |
| Landmark | 3.1 | 3.5 |
| Overall | 3.1 | 3.3 |

The pulsing ring and backlight were added after that score. Still open, according to the scorer:
- Volcano basalt cracks everywhere (the `VOL_CRACK` strings are pinned).
- Cave interiors are untouched.
- Sawtooth coasts.
- Bazaar labels collide with the UI.

**Decorative only:** the Colosseum statue has no collision (it stands where you land).

**Front page.** The backdrop is painted key art, not the live world. The world is only generated inside ENTER (a flagged judgment call).

**First five minutes**, listed rather than fixed:
- The signpost text sits under the Spawn Forge label.
- The inventory panel covers the day card's last line.
- Toasts share one slot.
- Worldgen trees can grow on the Tutorial Grounds.

**Small limits:**
- The PACK mark doesn't survive a reload.
- Swing and flash animations keep moving through the 50 ms hit-stop.
- From S2: a mob tag plate dims its "!" warning, and riders get no ground disc.
- The Volcano crust share is 66% (the spec text says 45%); this awaits an owner decision.

**Dropped:** S3 Mobile & Touch, S5 Account Security, the iPhone / App Store wrapper.

## Owner to-do

1. **Release:** publish `main` the usual way, then check the title screen once on the live site. The blackletter font only loads with internet.
2. **Nightly build:** `NEXT_BUILD.md` says nothing to build. Point it at the next spec when you have one. The "RuneHaven Version Build" scheduled task could not be paused from this session, so pause or edit it yourself if needed.
3. **Decide:** Volcano crust 66% vs 45%; whether to fix the listed first-five-minutes items; and when to revisit S3 or S5.
