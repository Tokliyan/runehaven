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

## Confirmed, locked spec for the next build (v33 — Bases part 1: placement & construction)

v32 shipped successfully. This is the first of two base-building versions
— placement and construction only. Raiding, destruction, and passive
generation are v34, deliberately separate, matching how every other large
system this project has built got split by concern rather than attempted
whole.

**Confirmed directly before writing this spec:** exactly one Forge exists
right now, `SPAWN_FORGE`, fixed next to spawn — `nearForge()` gates all
`where: "forge"` recipes on proximity to that single point. `ground_items`
is the existing Supabase persistence pattern (`sb.from("ground_items")
.select()/.insert()`) — base pieces reuse this exact shape, not a new one.
Material items (`iron_bar`, `runic_stone`, `dragonsteel`, etc.) already
exist and already have real colors — reuse them for piece tinting, don't
invent new palette entries.

**PART A — five placeable pieces, using the bible's existing five material
tiers for cost and eventual (v34) durability:**
- **Foundation** — required first, anchors everything else nearby
- **Wall** — the actual barrier; HP-per-tier is v34's job, not this one
- **Door** — passable by the owner, blocks others (basic collision only
  this version — real access-control logic is v34, once raiding exists)
- **Storage Chest** — a simple inventory container, reuse the existing
  inventory panel UI pattern rather than building a new one
- **Forge** — extends `nearForge()` to also check distance to any player-
  placed forge, not just `SPAWN_FORGE`. This alone makes crafting possible
  away from spawn for the first time.

Generator (the piece that will passively produce resources) is placeable
this version too, but produces nothing yet — the actual generation tick is
explicitly v34's scope, matching the "build the access point before the
system" pattern already used for cave entrances and dungeon-flavor decor.

**PART B — placement.**

Outside safe zones only (reuse `inSafeZone()`, already exists). Reasonable
spacing between structures (propose 3 tiles minimum between any two player
pieces) so bases can't be crammed edge-to-edge — pure placement-time check,
not worldgen, so this runs live as the player builds, not once at world
creation.

**PART C — persistence.**

New Supabase table, `base_pieces` — same shape as `ground_items`: id, kind,
tier, x, y, owner. Loaded once on login (same pattern as `ground_items`'
initial select), inserted on placement, broadcast to other clients over
the existing channel so a base appears for everyone the moment it's built,
not just its owner.

**PART D — proof gates, standard gauntlet plus:**
- Confirm all five piece types can be placed and reject placement inside
  a safe zone.
- Confirm the minimum-spacing check actually rejects an overlapping
  placement attempt.
- Confirm a player-placed Forge genuinely extends `nearForge()` — craft
  succeeds near a placed Forge far from spawn, still succeeds near
  `SPAWN_FORGE` too (regression check), still fails with neither nearby.
- Confirm Storage Chest opens the existing inventory-style panel and
  correctly stores/retrieves an item.
- Confirm placed pieces persist through a simulated reload (insert, then
  re-select, same data comes back).
- Confirm the Generator piece places cleanly and does nothing yet — no
  resource tick, no error either.

**Explicitly not touched this version:** destruction, raiding, HP on any
piece, actual passive generation, the Architect class tie-in (needs
destruction/generation to exist first) — all v34.

**After v33 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
