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

## Confirmed, locked spec for the next build (Pre-Launch QA Pass)

PIN Fixes shipped successfully — every roadmap item is now complete. This
is a genuine audit, not new content. Real bugs across this whole project
have consistently appeared at the SEAMS between systems, not inside any
one system in isolation — a new landmark that an older placement loop
never learned to avoid, a new item missing its counterpart in a sibling
table, a safe-zone override that never anticipated a specific biome. This
spec is structured around that actual pattern, not a generic sweep.

**PART A — cross-table completeness, checked programmatically, not by
eye.** For every entry in `WEAPONS`, confirm a matching `ITEM_META` entry
exists and a `RECIPES` entry can produce it (unless explicitly a
world-drop-only item — flag those separately, don't assume). For every
entry in `ARMORS`, confirm the reverse: every item with `armor: true` in
`ITEM_META` has a matching `ARMORS` entry (this exact class of bug shipped
once already — `dragonsteel_shield` — confirm nothing else has the same
gap). For every `MOBS`/`WILD_SPECIES` entry, confirm a drawing function
is actually reachable for its `kind`/`species` — a mob with stats but no
matching art branch would fail silently, not throw.

**PART B — every placement/exclusion loop, checked against every
landmark that exists now, not the landmark list at the time it was
written.** Ruin placement, Zone placement, Elder Drake's search, base
placement, and any other loop that excludes proximity to named landmarks
— confirm each one checks against the FULL current landmark set (Tower,
Volcano, Mount, Spawn, Bazaar, Ancient Forge, Colosseum, Dragon Altar,
Shrine), not whichever subset existed when that loop was first written.
This exact class of bug shipped twice already (Ruins missing the
Volcano/Mount exclusion at the new scale, Zones never checking the three
v37 landmarks at all) — treat finding a third instance as likely, not
unlikely.

**PART C — every biome-override guard, checked against what it actually
excludes.** The Safe Zone clearing bug (excluding PEAK via `BLOCKED.has`)
was a real, shipped bug for a long time before anything exposed it —
confirm every other biome-override check (Ruin carve, cliff-face
selection, any terrain force-override) makes the same distinction between
"genuinely impassable" (DEEP, LAVA) and "just a different, walkable
terrain type" (PEAK, ROCK) rather than treating them as one category by
habit.

**PART D — a real end-to-end new-player walkthrough**, run once fully
rather than tested system-by-system: create an account with a PIN, land
at spawn, complete or skip the tutorial, gather a resource, craft a basic
tool, tame a common species, build a Foundation and one other piece,
survive a day/night cycle, and confirm nothing in that ordinary sequence
throws or silently does nothing. This is the sequence an actual new
player takes Monday — confirm it as a whole, not as isolated features.

**PART E — a real stability check at N=1000, not the automated tests'
stubbed environment.** Confirm the viewport ground renderer (Expansion
2a) holds its per-frame tile-count bound at multiple camera positions
across the now much-larger map, not just the position it was originally
verified at.

**Proof gates:** every gap found in Parts A-C gets fixed with the same
"invariant survives, specific number/reference updates" discipline used
all session — not silently patched, not left as a note. Part D's
walkthrough is itself a proof gate: it either completes clean or the
build stops and reports exactly where it didn't. Standard gauntlet
throughout.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
