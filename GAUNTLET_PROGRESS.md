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

## S4 — Performance (Ground Cache & Quiet HUD): SHIPPED to `main`
- Ground baked into 16x16 chunk canvases (LRU 48, 2 bakes/frame, direct fallback, cleared with tileCache); camera offset snapped to whole pixels so cached and direct ground are pixel-identical; HUD writes only on change; RENDER_SCALE 1 recorded; water/lava loop walks on-screen tiles only.
- Frame rate vs main: Colosseum +38%, Bazaar +43%, Ancient Forge +142%, Spawn +25%.
- run4 1870 -> **1888 PASS / 0 FAIL**; run3 clean; run5 CAUGHT none; new **run6** (Playwright): pixel match 0.000% at 4 views, frame rate on/off 1.34x / 1.30x.
- Independent Opus review: no correctness defects; fixed the >48-visible-chunk thrash (1440p/4K) and canvas-failure storm, and strengthened five gates. Open: at 1440p 7 of 55 chunks still draw directly (raise GC_MAX if big screens matter).
- **Owner decision (2026-10-21):** frame-rate bar 1.2x, not 1.4x — drawing no ground at all measured 1.39-1.69x across runs, so 1.4x is at or past the ceiling on some runs; the rest of the gap is chunk blits + the seam underlay. Recorded in README.
- `NEXT_BUILD.md` -> World Encounters (S6).

## S6 — World Encounters (Roaming Boss & Bounty Board): SHIPPED to `main`
- **The Elder Drake roams** (approved bible deviation, owner 2026-10-12): `drakeRoamHome(now)` — 20-min straight legs to hashed targets within 900 tiles of the Volcano, pure in clock + seed (no network), never within 30 tiles of any Safe Zone or the Colosseum. Home = that path every frame; flies; respawns on the path; `worldBossPos()` hook. Demon Knights, loot, 6 h respawn, boss bar, music unchanged.
- **Bounty Board** at Spawn: one creature per in-game day (never twice running), slay or tame it for +2 Runic Stone once a day (claim persisted in the cosmetics jsonb, no SQL); also tells you where the Drake was last seen, in the compass dial's own directions.
- run4 1888 -> **1924 PASS / 0 FAIL** (36 S6 gates, mutation-checked); run3 clean; run5 CAUGHT none; run6 all PASS (pixel match 0.000% x4; frame rate 1.27x Colosseum, 1.27x Bazaar).
- Process: Opus built and decided; Haiku mapped the code; Sonnet wrote the gates; one Opus review at the end — 3 bugs + 6 risks found and fixed (stale mob_sync pinning the Drake, clients disagreeing mid-fight, bounty repeats, reload double-claim, never-spawning Salamander King in the pool, idle/leash flicker, stuck at zone edges, tame across a day rollover).
- **Owner decisions (2026-10-22):** (1) fights move with the Drake — the home keeps flying during a fight (spec's "current home"), no freeze. (2) bounty reward stays at 2 Runic Stone per in-game day.
- `NEXT_BUILD.md` -> Real Stakes (S7).

## S7 — Real Stakes (Weather, Death Weight & Raid Alerts): SHIPPED to `main`
- **Weather:** shared by computation (seed x 5-min slot x 256-tile region), type by biome: Rain (mob aggro -25%), Fog (aggro -40%, dark overlay, far name plates hidden), Ashfall (1 dmg / 4 s unless Fireward Draught; never in safe zones; not treated as combat), Snow (-15% on foot). Flat particle layer capped at 160, off under Reduce motion; "· Rain" on the day card; none indoors. Clear measured 77% of samples (spec >= 55%).
- **Death:** overlay lists exactly what dropped; your PACK on compass + minimap for 10 min or until picked up (yours only); a light column over the pile for 2 min for everyone. **Fixed a dupe bug:** equipped weapon/armour dropped twice on every death.
- **Raids:** "Your base is under attack!" (max every 20 s), RAID compass mark 60 s, combat music; login summary of damaged/destroyed pieces since your last session on this device.
- run4 1924 -> **1987 PASS / 0 FAIL** (63 S7 gates, 10 mutations each caught); run3 clean; run5 CAUGHT none; run6 all PASS (pixel 0.000% x4; frame rate 1.36x Colosseum, 1.29x Bazaar).
- Spec-ordered gate count changes: combat-music sites 3 -> 4, localStorage.setItem 5 -> 6 (reasons written in the gates). Two landmark-count gates now clear the transient PACK/RAID marks first (setup, not relaxation).
- Independent Opus review: 2 bugs fixed (false "damaged" for Architect/braced pieces; a failed base read reported the whole base destroyed) + 7 risks fixed. Known limit: the PACK mark does not survive a page reload.
- `NEXT_BUILD.md` -> nothing to build (every locked README spec has shipped; S8/S9 are gauntlet-session work).

## S8 — Feel pass: SHIPPED to `main`
- **Hit-stop** 50 ms on heavy hits (crit, kill blow, >= 1.5x weapon damage, or a hit taken >= 30% max hp), >= 350 ms apart, wall-clock mob wind-ups/taming pushed by the freeze; **screen shake** tunable with a Settings off switch; **WebAudio-synthesised SFX** (swing, hit, heavy, hurt, pickup, level-up, UI click) through the sfx gain, no files.
- **First five minutes** walked as a new account with real key presses: fixed new players spawning up to ~450 tiles from the Tutorial Grounds, a start spot next to trees / the forge prompt, no next goal after the tutorial (now points at the Bounty Board), silent first gather and dummy strike. Listed (not fixed): signpost text under the Spawn Forge label, inventory panel over the day card's last line, toasts overwriting each other, worldgen trees on the Grounds.
- run4 1987 -> **2015 PASS** (28 S8 gates, 22 mutations each caught); one v58 gate made deterministic (S7 weather held clear during its one-tick speed measurement).
- Independent Opus review: 2 bugs + 8 risks fixed (see the changelog).

## Front Page Rework ("The Reforging Update"): SHIPPED to `main` (owner add-on, 2026-10-22 evening)
- Title screen (logo, italic menu with gold "– Play –", update banner, world status, What's new), character select with tooltip-style class cards and round badges, Thronefall-style full-screen Settings with square checkboxes; Grenze Gotisch + Cormorant Garamond; `--menu-*` tokens; menu layer only.
- **YELLOW judgment call:** the backdrop is painted key art in the locked flat-shaded style (ridges, the Eternal Tower, moon, motes), not the live world — the world is only generated inside ENTER, so a live render before login could break login.
- run4 2015 -> **2039 PASS / 0 FAIL** (24 front-page gates, 14 mutations each caught); v46 B setItem count 6 -> 7 with its reason. Two older gates were made deterministic (world-reset countdown bracketed by the arm time; S7 goblin probe chosen outside safe zones).
- Independent Opus review: 4 bugs fixed (unready ENTER clickable; Esc didn't close Settings; Enter during the intro pressed Play; the setItem count) + risks fixed.
- The 5am "RuneHaven Version Build" task: NEXT_BUILD says nothing to build (it could not be paused from this session).

## S9 — Final report: DONE (2026-10-23)
- `GAUNTLET_REPORT.md` + `docs/gauntlet-after.jpg`. Gauntlet results reused from the final front-page verification on the same game code (run4 2039/0, run3/5 clean, run6 pass); frame rate re-measured before vs after, interleaved.

## Owner add-on: RT pass (Readability, Transitions, Landmarks): SHIPPED to `main` (2026-10-23)
- **Transitions:** interlocking biome seams, foot shadows and edge props, all inside the cached tile diamond.
- **Readability:** a value-jump actor disc, a pulsing "me" ring and backlight, player scale 2.4, and glinting loot.
- **Landmarks:**
  - Bazaar tents and a banner pole, with each stall sorting on its own.
  - Colosseum banners and a statue.
  - A Volcano plume and second flow.
  - The Forge yard.
  - Night lights.
- **Scores** (Sonnet, before → after): Readability 2.6 → 2.9, Transitions 2.7 → 3.0, Landmark 3.1 → 3.5, Overall 3.1 → 3.3.
- **Tests:** run4 2039 → **2067 PASS / 0 FAIL**, with 28 gates and 11 mutations caught. run3 and run5 are clean. run6 pixel match is 0.000%, and the cache is 1.43x/1.52x.
- **Opus review:** 8 findings. Fixed:
  - Stall sorting.
  - View cull.
  - Occluders.
  - Seam props poking outside the diamond.
  - A duplicate crater light.
  - Brazier placement, and a decoy anvil.
  - Bunting on the front stalls.
  
  The statue has no collision; that's by design.

## Living World session 1 (camera zoom & device pixels): SHIPPED to `main` (2026-10-24)
- **Zoom:** 1.6x by default, scroll or pinch from 1.0 to 2.2 (eased, quantised, saved). Retina-sharp, with the backing store at devicePixelRatio (capped at 2), and camera look-ahead.
- **Ground cache:** baked at the view scale (capped at 3.2) within a 40 Mpx budget. It is pixel-exact at 1x, 1.6x, 2.2x and on Retina (worst case 0.008%).
- **Screen-size items:** nameplates, labels, shake, weather and the tower arrow stay screen-size.
- **Frame rate at the Bazaar:**

  | Zoom | fps |
  |---|---|
  | 1.0x | 46.8 |
  | 1.6x | 59.2 |
  | 2.2x | 60.1 |

  Zooming in is cheaper.
- **Tests:**
  - run4 went from 2067 to **2133 PASS / 0 FAIL** with 66 S1 gates; 20 mutations were each caught.
  - 7 calibrated legacy gates were updated with written reasons: the 2a and S4 blocks now run at 1:1, the setItem count went from 7 to 8, the help count from 10 to 11, the bake signature changed, and DPR replaces CSS pixels.
  - run6 has 18 PASS, including Retina.
- **Opus review:** 9 findings, all fixed. The biggest was Retina memory at 2.2x.
- **Flake to watch:** the S7 "walking player really is slower" gate once measured 1645 tiles moved (a teleport mid-walk). It passed on rerun, and the cause hasn't been found yet.

## Living World session 3 (creatures that live): SHIPPED to `main` (2026-10-25)
- All 15 mobs and every pet / wild species are forged with family motion (idle, beat, move, attack, hurt, death; happy / sit / alert / ride for pets), per-species life beats and the pixel finish (heroes too). See the art-style skill's 2026-10-25 entry.
- One Opus review (6 must-fix, 12 should-fix) — all must-fix and most should-fix applied; the weapon-rig depth and remote pet attacks are noted as limits.
- Gates: run4 "Living World S3" A–F (10 gates); run6 "Living World S3 forge" (1)–(3). Legacy gates changed with written reasons: S2 A (SS 4 -> 2), S2 B (forgeGrid pins for 0.625), run6 S2 forge (4) bake limit 4 -> 6 ms.

## Living World session 2 (pixel-art characters that act): SHIPPED to `main` (2026-10-24)
- **Pixel Forge (owner D1 "B+"):** procedural hero bodies are baked at 4×, box-filtered to a whole-backing-pixel art grid, reduced to at most 40 colours, LRU-cached, and drawn crisp and snapped. Wide boxes are used for actions.
- **Pose rig:** arm pivots, lean, squash/stretch, lunge footwork, body drive, and a weapon grip that follows the arm with the blade at its own angle; smears on forward swings, dust, hit flash and cast sparks.
- **States:**
  - idle (24 frames at 200 ms) and walk (8);
  - an attack per weapon kind (8 frames: sword, axe, pickaxe, dagger, spear, bow, crossbow, staff, fists);
  - cast; gather (chop with an axe shown, mine with a pickaxe, pick up);
  - hurt, block, tame, ride, death fall;
  - emotes on X: wave, cheer, sit.
- **Network:** the state rides the move broadcast (`an`), so friends see each other act.
- **Owner bug fix:** the game no longer auto-enters on load. The title greets a returning player by name.
- **Tests:**
  - run4 went from 2133 to 2168+ with 35 S2 gates; 7 mutations were each caught.
  - Legacy gates updated with written reasons: keybinds 17 → 18, help entries 11 → 12, the v46 resume claim inverted by the owner fix, disc-before-sprite order, and the hero leg pair plus lunge offsets.
  - run6 adds 4 S2 gates: at most 40 colours with only alpha 0/255, no sprite clipped across 1752 bakes, a quiet cache when standing still, and an average bake under 4 ms.
- **Opus review:** 10 findings, all fixed. They included weapons clipped on strike frames, remote poses that never cleared, cache thrash while zooming, and a single bake failure switching the forge off.
- **Flakes to watch:**
  - The S2 C ambient-life "3 kinds in the dark forest" gate once saw only 2, because firefly/mote spawns are random.
  - The S7 walking-speed gate (noted in session 1).

## Remaining stages
None — the gauntlet is complete.
