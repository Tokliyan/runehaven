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

## Confirmed, locked spec for the next build (v35 — Systems: minimap, tutorial, reclassing, cosmetics, Oracle)

v34 shipped successfully. Five smaller, mostly independent systems — the
lowest individual risk of anything left on the roadmap, confirmed none of
this exists yet. Grand Bazaar, The Ancient Forge, and Ruined Colosseum
remain genuinely unscheduled — explicitly not this version, need their
own slot, not silently folded in here.

**PART A — Minimap.** Bible: "Shows general direction only, does not
reveal exact base locations." A small fixed corner panel — direction
indicators toward TOWER, VOLCANO, and SPAWN only (fixed landmarks, always
knowable), not a coordinate map and not showing any `base_pieces` position
at all — the omission is the whole point, not an oversight.

**PART B — Tutorial Grounds.** Bible: "A small guided area within the
Spawn Safe Zone teaching movement, basic combat, and pet taming." A short
scripted sequence shown once on first login only (persisted flag on the
player row, same shape as any other one-time state) — move here, hit this
target dummy, tame this placeholder Wolf. Skippable at any point.

**PART C — Reclassing.** Bible: "resets all XP and levels but keeps
inventory, base and pets." Confirmed directly: leveling is a single
counter (`me.level += 1` on a kill), no separate XP field to reset.
Reclassing sets `me.level = 1` and `me.cls` to the new class, and touches
NOTHING else — `me.inv`, `basePieces` owned by the player, and the pet
roster all stay exactly as they are. A confirmation prompt first, since
this is a real, irreversible reset.

**PART D — Cosmetics.** Bible: hats, cloaks, weapon skins, pet
accessories, "earned through gameplay only, never purchased." Confirmed
no stubs exist yet. Purely visual layer on top of existing render
functions — no new stats anywhere, ever, on any cosmetic item. Award
sources reuse what already exists (a rare drop chance on strong mob kills,
matching how loot already works) rather than inventing a new currency or
shop system.

**PART E — The Oracle.** Bible: "NPC that hints at rare pet spawn
locations, cannot hint at Elder Trio locations." A fixed NPC near spawn,
interact to get a hint pointing at one rare/epic species' general biome
(not exact coordinates — matches the Minimap's own "general direction
only" philosophy). Hard-coded exclusion list covering all three Elder
species and the secret event — this must never be data-driven from a
list that could accidentally include them later, the exclusion is
structural, not configurable.

**PART F — proof gates, standard gauntlet plus:**
- Confirm the Minimap only ever displays TOWER/VOLCANO/SPAWN directions —
  never a base_pieces coordinate, tested explicitly.
- Confirm Tutorial Grounds shows once per player, never again after.
- Confirm reclassing resets level and class, and confirm inventory/base/
  pets are byte-identical before and after.
- Confirm no cosmetic item ever appears in any weapon/armor stat table.
- Confirm the Oracle's hint pool structurally excludes all three Elder
  species by name, not by a list that merely doesn't currently include them.

**Explicitly not touched this version:** Grand Bazaar, The Ancient Forge,
Ruined Colosseum — all three still need their own version. The Elder
trio itself and the secret event (v36).

**After v35 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
