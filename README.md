# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RUNEHAVEN_BIBLE.md` — full text now in this repo, read it
directly, do not assume or invent anything it doesn't state.

## Layout

```
runehaven.html              the game — currently v19 (v20 in progress)
runehaven-art-style/         SKILL.md — read this before ANY rendering change
debug/run2.js                quick login-screen smoke test
debug/run3.js                REQUIRED full-boot harness (real login, 5 frames)
debug/run4.js                wear-down/taming-gate simulation
debug/run5.js                exhaustive branch-coverage sweep (every class/
                              weapon/armor/species/mob-state combo, once each)
```

Run any harness with: `node debug/runN.js runehaven.html` (or just
`node debug/runN.js` from inside `debug/`, defaulting to `../runehaven.html`).

## The standard process (non-negotiable)

1. **Read `runehaven-art-style/SKILL.md` in full** before touching any
   rendering code, even a small tweak.
2. Apply changes as **surgical, targeted patches** — never a full rewrite of
   a working section. Before any find-and-replace, confirm the anchor string
   is unique in the file (`grep -c "anchor text" runehaven.html` must return
   exactly the number of intended edit sites). An over-broad replace has
   caused a real shipped bug before (v13).
3. **Never invent bible content.** Pets, mobs, biomes, lore, and events must
   come from the bible. If a build needs a value the bible doesn't specify
   (an HP number, a cooldown, a percentage), that's fine to design — but
   flag it as a tunable, and never add a pet/mob/location the bible doesn't
   list without explicitly marking it non-canon.
4. After patching, run in order and require ALL to pass before shipping:
   - `node -e` parse check (`new Function(scriptText)` must not throw)
   - a grep checklist confirming every intended change landed AND every
     prior feature is still present (preservation checks, not just new ones)
   - `node debug/run3.js runehaven.html` — must show `CAUGHT ERROR: none`
   - `node debug/run4.js runehaven.html` — all `PASS`, zero `FAIL`
   - `node debug/run5.js runehaven.html` — must show `CAUGHT: none`
5. **When something is unclear or unspecified, classify it before deciding
   what to do — RED always stops, YELLOW ships with a flagged note.**

   **RED — always STOP, no exceptions, regardless of how small it looks:**
   - Any test harness actually fails (`run3`/`run4`/`run5` catch a real
     error, or any `run4` line is `FAIL`) — this is the mechanical,
     objective signal that something is genuinely broken. Never overridden.
   - A patch anchor isn't unique.
   - The spec would require inventing bible content — a pet, mob, biome,
     location, or lore element not in the bible. This is a creative
     integrity rule, not a bug-severity one, and severity never overrides it.
   - The spec assumes an entire system exists that doesn't, AND building it
     properly needs 3+ genuinely unspecified, interdependent decisions with
     real gameplay consequences (a whole consumable-item framework, a whole
     new traversal/instance architecture — the kind of thing where any
     guess is really a design decision, not a tunable).

   For any RED case: do not guess, do not "fix forward" with invented
   content, do not ship a broken build. Write `BUILD_FAILED.md` at the repo
   root explaining exactly what's blocking and why, leave `runehaven.html`
   unchanged.

   **YELLOW — make the reasonable call, ship it, flag it clearly:**
   - A single tunable number or threshold is uncertain, but any reasonable
     value in a normal range keeps the game working (a rarity threshold, a
     cooldown, a light radius, a stat number within the established range
     for its rarity tier).
   - A minor naming or implementation choice where multiple options all
     work equally well (matching an existing code convention, e.g. an
     abbreviated enum name).
   - A visual/polish detail that doesn't affect functionality (an overlay
     offset, a minor color choice within an already-approved palette).
   - An implementation detail the spec left slightly underspecified, but
     where only one interpretation is actually sensible given everything
     else in the spec.

   For any YELLOW case: make the call, implement it, ship normally through
   the full gate above — but add a `## JUDGMENT CALLS THIS VERSION` section
   to the changelog entry in `SKILL.md` (or a top-level note in the commit
   message if it's not rendering-related) listing every one, in plain
   language, so it's easy to spot and revise the next morning. A version
   that shipped with flagged judgment calls is a complete, done version —
   not a partial one. The judgment calls are refinements to consider, not
   unfinished work.

   **When genuinely unsure which zone something belongs in: treat it as
   RED.** A missed YELLOW just means an unnecessary night lost, which is
   recoverable. A wrongly-shipped RED is a broken or invented build in a
   real player's hands, which is not.
6. On success: update `runehaven-art-style/SKILL.md` with a new dated
   changelog entry (rendering-scope changes only — mechanics/balance live in
   this README or commit messages, not the skill).
7. Extend `debug/run5.js`'s coverage lists with any new species/mobs/weapon
   kinds/classes added in this build, so future runs keep covering them.
8. **If the full gate passed cleanly** (every check above green, nothing
   flagged RED): attempt to push the final commit directly onto `main`,
   not just your own branch, as the very last step. If your environment
   does not permit a direct push to `main`, that's fine — land on the
   usual branch as before, no error, a human will sync it. This is a
   nice-to-have, never a requirement — never fail a build or treat a
   blocked push to `main` as a RED condition.

## Confirmed, locked spec for the next build (Mob Rarity + Music)

Tuning/Polish shipped successfully. Confirmed live: `BG_PLAYLIST` currently
holds Pop/Slower_Jamz/Long_Way_Home/song. `audio/tension.mp3` and
`audio/siren.mp3` are already pushed to the repo, ready to wire in.
Credits currently read `{ role: "Created by", name: "Harsh D and the
RuneHaven development team" }`, Skeptik and Advay both listed as "Dev
Team".

**PART A — real population caps with daily restock, not probability
tuning.** The actual ask: rare species (propose the Rare tier and up —
dragons, Crystal Golem, and above) should be genuinely scarce at any
moment, not just individually unlikely per spawn roll. Add a per-species
world-population cap for this tier, reusing the exact `worldDayNum()`
counter Krakenling and Blood Moon already key off — once a species hits
its cap for the day (tamed or killed), no more of that species spawns
until the next day boundary, when the pool refills. This is a genuine new
mechanic layered on top of the existing `count`/`base` system, not a
replacement for it — the existing density logic still governs where and
how they spawn within whatever the day's remaining allotment is.

**PART B — Griffin and Shadowfox, corrected against their real tiers.**
Confirmed directly: Griffin (Uncommon) sits at `base: 0.35`, its own
tier-mates run 0.40-0.50 — raise to 0.42. Shadowfox (Epic) sits at
`base: 0.35` while its real tier-mates (Lightfox, Krakenling) run 0.20,
despite ALREADY carrying extra restrictions (night-only, a presence roll)
those don't compound as heavily — lower to 0.20, matching its actual
tier. Basilisk remains genuinely unbuilt — tied to Dungeons, which do not
exist — not part of this version, an honest scope gap, not a bug to fix
here.

**PART C — every pet gets bigger, discretion applied by tier, not a flat
multiplier.** Common: 1.15-1.25x. Uncommon: 1.3-1.4x. Rare: 1.5-1.65x.
Epic: 1.7-1.85x. Elders were already increased in Tuning/Polish — a
smaller additional bump only (propose 1.1x on top of their current
value), not a second full pass.

**PART D — the real music.** Two tracks are genuinely new
(`tension.mp3`, `siren.mp3`); Pop/song are confirmed byte-identical to
what's already wired in, no changes needed there. Add `siren.mp3` to
`BG_PLAYLIST` as a fifth roaming track. Add `tension.mp3` as a real boss
track — reuse the exact `combatMusicUntil`/`COMBAT_MUSIC_LINGER`
mechanism already built for `nu_metal.mp3`, but scoped specifically to
Elder Drake and Elder-tier fights (`m.kind === "elder_drake" || def.elder`)
rather than all combat, so it reads as a distinct "this is a real boss"
cue rather than replacing the existing regular-combat track.

**PART E — credits.** Skeptik's role stays "Dev Team" but gets explicit
composer credit for `Pop.mp3`, `song.mp3`, and `tension.mp3`. Advay's
entry gets explicit composer credit for `siren.mp3`. Update `"Created by"`
name from `"Harsh D"` to the full `"Harsh Devarajan"`, and ensure it
appears directly alongside the existing "Hashbrown Studios" line rather
than only in the separate "Created by" row.

**Proof gates:** standard gauntlet plus confirm the daily population cap
genuinely blocks a capped species from spawning again until
`worldDayNum()` advances, confirm Griffin/Shadowfox's new base values are
live, confirm every tier's size multiplier landed within its proposed
range, confirm both new tracks are reachable and correctly scoped
(`siren.mp3` in rotation, `tension.mp3` only on Elder-tier combat), and
confirm the credits/name updates are live.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
