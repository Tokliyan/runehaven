# RuneHaven Gauntlet — one long build session, many versions

> **NOT for the nightly build.** The nightly build follows NEXT_BUILD.md only and must ignore this file.
> Run this only when the owner (Harsh) explicitly starts a gauntlet session, by saying "run GAUNTLET.md" here or pasting it into Claude Code.

## Your job

You are building RuneHaven in one long, staged session. RuneHaven is a single-file 2D isometric persistent survival RPG (`runehaven.html`, Canvas 2D, Supabase). It is hosted on Render from `main`.

You work through the stages below in order. Each stage:

1. Builds and proves its version.
2. Merges to `main`, so Render deploys it.
3. Moves `NEXT_BUILD.md` forward, so the nightly build never redoes finished work.

If you run out of usage or time, stop at a stage boundary. Write `GAUNTLET_PROGRESS.md` saying exactly where you stopped. The next session resumes from it.

## The target level — what "done" means, and what it does not

**Target: a polished indie showcase in the art style the game already has.** Think Thronefall, Bad North, Islanders: flat-shaded, clean, moody lighting, lots of life on screen. It should feel finished and alive, and a stranger should say "this looks like a real game" from a screenshot or a 30-second clip.

Concretely, by the end:

- **Every screen has something moving and something worth looking at:**
  - wind in the trees and grass;
  - water ripples and shore foam;
  - fireflies, leaves, embers and ash in their biomes;
  - wildlife;
  - weather.
- **Every biome is visibly distinct**, with its own palette, props and particles. No large flat empty areas.
- **Landmarks read as hero set pieces** from a distance.
- **Lighting carries mood:**
  - a dawn and dusk glow;
  - real night with pools of light;
  - contact shadows under things;
  - caves that are dark with lit spots;
  - lava that glows.
- **Combat has juice:**
  - wind-up tells;
  - a hit flash and a tiny hit-stop;
  - small, tunable screen shake;
  - readable damage numbers;
  - death and loot moments that feel like events.
- **UI is one cohesive style,** never overlapping. It works with a keyboard and on a phone with touch.
- **It runs smoothly,** with the ground cached, and is secure enough for strangers (PINs hashed, players own their row).
- **The content queue is in:** World Encounters (the Elder Drake roams, a bounty board) and Real Stakes (weather, death weight, raid alerts).

**Not the target (do not attempt):**

- 3D, or photorealism;
- hand-painted sprite sheets;
- motion capture;
- voice acting;
- new recorded music (the owner's music is in `audio/`);
- real dedicated game servers;
- an App Store binary (that needs the owner's Mac, Xcode and an Apple developer account, and is a separate task).

Never "upgrade" the art direction away from the locked style in `runehaven-art-style/SKILL.md`.

## Resources

All of these are already in the repo or this environment:

- **`README.md`.** The standard process, steps 0–9. Follow it in full for every stage; it is non-negotiable. It also holds every locked spec in queue order.
- **`RUNEHAVEN_BIBLE.md`.** Canon. The owner's word beats the bible, and approved deviations are recorded in README specs. On 2026-10-13 the owner delegated open game decisions to the builder ("use your discretion to make the game as good as possible"). That covers judgement calls inside a spec, not inventing new bible content. Mark anything new as non-canon.
- **`runehaven-art-style/SKILL.md`.** Read it in full before any rendering change. Its MUST-NOT-REGRESS list is binding.
- **`.claude/skills/`:**
  - `doubt-driven-development`;
  - `gate-integrity`;
  - `supabase`;
  - `supabase-postgres-best-practices`.
- **Test gauntlet:** `npm ci`, then `node debug/run3.js runehaven.html`, `node debug/run4.js runehaven.html` and `node debug/run5.js runehaven.html`, run from `debug/`. run4 is long (about 20 minutes or more), so run it in the background and keep working.
- **Eyes:** `node debug/shot.js shots` uses Playwright and Chromium offline, with a stubbed Supabase. Use `Read` on the PNGs. Contact sheets help: stitch shots with PIL. Night is `worldEpoch = Date.now()/1000 - DAY_LENGTH*0.75`. Phone sizes are 844×390 and 390×844 with `hasTouch`.
- **Frame-rate probe:** count `requestAnimationFrame` calls over 3 s at the Colosseum and the Bazaar, as in the 2026-10-12 check (baseline 17.0 / 16.7 fps headless at 1280×720).
- **Delegation:** `.claude/skills/delegate/SKILL.md`. Send bulk reading and test-log trawls to `haiku` workers, single well-specified spec parts and screenshot scoring to `sonnet`, and adversarial diff reviews to `opus`. Workers never commit or push, and the main agent re-runs every gate itself.
- **Prior work:** `WORLD_CHECK_FIXES_blocked.patch` on branch `claude/stoic-tesla-22bq3v`.

## Hard rules (on top of the README)

1. **Never touch the live Supabase project.** Write SQL to `supabase_<stage>.sql` for the owner. No service_role key, ever.
2. **Never relax a gate.** Update gates when the spec changes the thing they measure, and say which spec line justifies it. The run4 PASS count only goes up.
3. **Push the harness files with every change.** Any change to `runehaven.html` ships with any `debug/run*.js` it needs, in the same commit.
4. **One stage, one commit to `main`:**
   - full gauntlet green;
   - visual check done;
   - changelog entry in the art-style skill;
   - `NEXT_BUILD.md` moved to the next unbuilt spec.

   Then push.
5. **Watch the clock.** If it's after 4:30am Sydney time, finish the current stage and stop, because the nightly build fires at about 5:06am. Leave `NEXT_BUILD.md` pointing at the next unbuilt spec.
6. **RED stops a stage, not the session.** Write the blocker into `GAUNTLET_PROGRESS.md` and skip only if later stages don't depend on it. Otherwise stop.

## Stages

### S0 — Baseline (about 20 min)
1. Run `npm ci` and the full gauntlet, and record the run4 PASS count.
2. Run `shot.js` and the frame-rate probe, and record both.
3. Save a "before" contact sheet: landmarks, biomes, caves, night, phone.

### S1 — World Check Fixes (finish it)
1. Apply the saved patch, then apply README's "OWNER DECISIONS (2026-10-13)" block exactly.
2. Run the full gauntlet and the visual check.
3. Merge.

### S2 — Showcase polish loop (the heart of this session)
Up to 4 rounds. Each round:

1. Shoot every landmark, every biome, both caves, spawn at night, a fight, and the phone layouts.
2. Score every shot 1–5 on this card:
   1. **Readability.** The player, enemies and items stand out from the ground.
   2. **Depth.** Shadows, contact shadows, rim light; nothing looks pasted on.
   3. **Palette harmony.** The biome looks like one place. No muddy or clashing colours.
   4. **Life.** At least 6 moving things on screen (wind, particles, critters, water).
   5. **Fill.** No flat empty patch bigger than about a quarter of the screen.
   6. **Transitions.** Biome edges, cliffs and coasts look intentional, not stair-step noise.
   7. **Water.** Shore foam, depth colour, ripples.
   8. **Night mood.** Readable darkness with clear light pools.
   9. **Landmark presence.** Recognisable at a glance from a distance.
   10. **UI.** Cohesive, legible, nothing overlapping or clipped.
3. Fix the 3 lowest-scoring problems with surgical, art-style-compliant changes.
4. Re-shoot and re-score. Write the before and after scores into the changelog.

**Stop when** every category averages 4 or more, or after 4 rounds.

**Rules for this stage:**
- Measured proxies beat opinion. Count moving entities per screen, measure overlap rects, count empty-area tiles. Add them as run4 gates, so the polish can't silently regress later.
- Performance must not drop more than 10% against S0 in this stage.

### S3 — Mobile & Touch
**DROPPED by owner, 2026-10-15** ("no need for mobile and touch, for now"). Skip it.
Build the README spec, plus its phone shots.

### S4 — Performance
Build the README spec, with the pixel-match and frame-rate gates. Re-measure S2's frame-rate floor.

### S5 — Account Security
**DROPPED by owner, 2026-10-15** ("no need for s5 account security"). Skip it; write no SQL.
Build the README spec: code, plus `supabase_s5.sql` containing the owner's numbered steps. Do not run the SQL.

### S6 — World Encounters
Build the README spec. PART A: the Elder Drake roams (owner decision).

### S7 — Real Stakes
Build the README spec.

### S8 — Feel pass
1. **Hit-stop:** 40–60 ms on heavy hits, tunable.
2. **Screen shake:** tunable, with an off switch in Settings.
3. **Sound effects:** synthesised with WebAudio for swing, hit, pickup, level-up and UI click, through the existing `AudioEngine` sfx gain. No new files.
4. **The first five minutes:** walk them as a new player with the tutorial. Fix anything confusing, and keep a list.

### S9 — Final
1. Run the full gauntlet and the full shot tour on desktop and phone.
2. Make "after" contact sheets.
3. Write `GAUNTLET_REPORT.md` covering:
   - what shipped per stage, with commit hashes;
   - the before and after scorecard;
   - frame rate before and after;
   - run4 PASS before and after;
   - what's left;
   - the owner's to-do list. (Owner, 2026-10-15: the iPhone test and App Store
     wrapper are not targets for a long time — leave them off; S5 is dropped, so
     there are no Supabase steps from this session.)

## Reporting

- Keep `GAUNTLET_PROGRESS.md` updated after every stage: what's done, what's next, and any blocker.
- Report to the Night Run per README step 9 at the end.
- The final message to the owner should be short, plain English: what's live now, what he must do, and what's next.
