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

## Confirmed, locked spec for the next build (Tuning/Polish)

Expansion 2b shipped successfully (N=1000, caves=50). This is the
deferred polish pass — bigger Elders, a grander Bazaar, player-to-player
teleport, cave and sand fixes, mob sizing, longbow range, and the actual
death-drop investigation.

**PART A — bigger Elders.** Confirmed live: `golem_elder: 2.10,
dragon_elder: 1.85, unicorn_elder: 1.45`. Increase each meaningfully —
propose `golem_elder: 2.70, dragon_elder: 2.40, unicorn_elder: 1.85` —
they should read as unmistakably larger than any of their base-tier
counterparts on sight, matching "Elder" as a real size tier, not just a
stat tier.

**PART B — a grander Bazaar.** Confirmed `drawBazaarEntity()`'s current
ring radius is 3.4 tiles with 6 stalls. Widen the ring (propose 5.5) and
the stall count (propose 8-10), and increase `BAZAAR_R` from 7 to ~10 to
match — this is a genuine footprint increase, not just more detail packed
into the same space. Re-verify the render-preview scale math the same
careful way art reference v4 did (measure the true unscaled footprint,
don't guess a scale factor) if this affects any existing reference
canvas.

**PART C — player-to-player teleport.** New mechanic, needs real design,
not just "add a button": propose a Fast Travel-style menu (`M`, already
bound) gets a second tab listing currently-online players by name;
selecting one teleports you to a point near them (propose 3-5 tiles away,
never on top of them), with a genuine cooldown (propose 60s) so it can't
be spammed for combat positioning. Confirm this cannot be used to bypass
Safe Zone or Colosseum boundaries in an exploitable way — landing near a
player who is inside one of those zones should not teleport you inside it
without meeting its own normal entry conditions.

**PART D — cave polish.** Bounded, not open-ended: reuse the exact
connectivity guarantee and 3D-wall techniques from the original cave
overhaul, now applied at the new `INTERIOR_N=50` scale — confirm ore vein
count and mob count scale with the larger area (already partly handled by
Expansion 2b's Part C, verify it reads as genuinely richer, not just
bigger-and-emptier).

**PART E — sand art.** Confirmed the two SAND palette shades are already
close (`#e6d5a0`/`#e4d39e}`), so the reported "line" most likely reads
from the coastline glow/cliff-face boundary where sand meets water or
higher terrain, not the checkerboard itself. Soften that specific
boundary treatment and add a subtle grain/speckle texture within sand
tiles themselves (matching the existing wear-detail technique already
used on cliffs). **This needs visual confirmation once built** — flag
clearly if the actual line turns out to be somewhere else.

**PART F — the death-drop investigation. Confirmed directly:
`dropAllItems()` genuinely clears `me.inv`/`equipped`/`armor` and creates
real ground-item drops — the underlying data is correct.** The real gap:
`enterDeath()` never calls `refreshPanels()`. If the Inventory panel
happens to be open at the moment of death, it keeps showing stale
pre-death contents until manually reopened — a real UI bug, not the data
bug it was reported as. Fix: call `refreshPanels()` inside `enterDeath()`.

**PART G — mob sizing, differentiated.** A broader pass across `MOB_K`/
`SPECIES_K`, genuinely uneven rather than a flat multiplier — propose
larger, more dangerous things (Troll, Sea Serpent, Elder Drake) get a
bigger relative bump than common ones (Goblin, Wolf), so size increases
reinforce the existing threat hierarchy rather than flattening it.

**PART H — longbow range.** Confirmed `runic_longbow` range is 11.
Increase to 14. Also confirmed `dragonsteel_bow` sits at 9.5 — LOWER than
the runic longbow's current 11, a real tier inconsistency. Raise it to at
least 15 so Dragonsteel stays strictly ahead of Runic on this stat too.

**Explicitly not part of this build:** art reference v4's full item/mob/
biome list — that's a documentation deliverable, handled separately from
game code, not a build spec item.

**Proof gates:** standard gauntlet, plus confirm each Elder's visual
scale increased, Bazaar footprint genuinely grew (not just visual detail
added), teleport respects Safe Zone/Colosseum entry rules, cave ore/mob
density scales with the new interior size, `refreshPanels()` is called in
`enterDeath()`, and both bow range changes are live.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
