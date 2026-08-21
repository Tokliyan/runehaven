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

## Confirmed, locked spec for the next build (Rare Pet Population + Real Music)

Tuning/Polish shipped successfully. Confirmed live before writing this:
credits currently read "Harsh D", `BG_PLAYLIST` is `[Pop.mp3,
Slower_Jamz.mp3, Long_Way_Home.mp3, song.mp3]`, Skeptik's credit entry
already exists with role "Dev Team".

**PART A — real population cap + daily restock, not a % chance tweak.**
The ask is explicit: rare/epic species must not be encounterable "every
other step" — there should be a genuine world-wide LIMIT on how many of a
given rare species exist at once, replenished daily rather than always
freely spawnable. Add a `DAILY_RESTOCK` tier flag to Rare and Epic
species (Water/Fire/Storm/Shadow Dragon, Crystal Golem, Unicorn,
Shadowfox, Lightfox, Krakenling, Salamander King) — reuse `worldDayNum()`
(already exists, drives Blood Moon and Krakenling's own cycle) as the
restock clock. A tagged species' total live count across the whole world
is capped at its existing `count` value per the wild-spawn system already
in place; the restock is that this cap is evaluated fresh once per game
day rather than being a permanently-topped-up pool, so a fully-hunted
rare species is genuinely gone until the next day, not silently
respawning the moment a slot opens.

**PART B — mob size, broad pass, deliberately uneven.** Every pet and
mob's `SPECIES_K`/`MOB_K` increases — genuinely large/dangerous things
(Elder Drake, Sea Serpent, Troll, all four Dragons, both Golems) get 2x;
common/small things (Sprites, Wolf, Boar, Goblin) get 1.5x. Your explicit
discretion call on the split — use the existing established size
hierarchy (already-larger things get the larger multiplier) rather than
inventing a new ranking.

**PART C — real music, four tracks, real attribution.**
```
audio/boss_tension.mp3   - combat/boss track (Skeptik)
audio/roaming_song.mp3   - background rotation (Skeptik)
audio/roaming_pop.mp3    - background rotation (Skeptik)
audio/roaming_siren.mp3  - background rotation (Advay)
```
All four already pushed to the repo's `audio/` folder. Wire
`boss_tension.mp3` into the existing combat-music trigger (the same
`combatMusicUntil` system `nu_metal.mp3` already used) and the three
roaming tracks into `BG_PLAYLIST`, replacing its current contents —
reuse the existing rotation/crossfade system exactly as built, this is a
track-list swap, not a new audio system.

**PART D — credits.** `"Harsh D"` -> `"Harsh Devarajan"`. Add Advay's
attribution for `roaming_siren.mp3` alongside his existing "Dev Team"
credit entry (or a new line if a role split reads more clearly — your
call on exact wording, the attribution itself is not optional). Skeptik's
existing entry already covers his three tracks; no new entry needed for
him, this is additive to what exists.

**Explicitly not touched this version:** Basilisk (still genuinely
absent, tied to Dungeons — separate decision, not part of this build).

**Proof gates:** standard gauntlet, plus confirm the restock cap
genuinely blocks a rare species from spawning again mid-day once its cap
is hit in a simulated sweep, confirm size multipliers landed at the
correct 1.5x/2x split, confirm all four tracks are reachable and wired to
the correct trigger, confirm credits show the full name and both
composers.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
