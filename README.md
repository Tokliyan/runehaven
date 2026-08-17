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

## Confirmed, locked spec for the next build (v29 — real cave interiors, Underwater Caves as the proof of concept)

v28 (mounting) shipped successfully. This section replaces it as the
current locked target. This is a genuinely large, foundational system —
scoped deliberately to ONE biome first. Abyssal Hollow gets the same
system reused, not redesigned, once this is proven. This also lays real
groundwork for Dungeons later, which need the identical "enter, arrive
somewhere separate" pattern — do not build anything here that is specific
to water and cannot be reused.

**Confirmed directly before writing this spec:** one shared Supabase
channel handles all sync (`channel.send({ type: "broadcast", event:
"move", ...})`), payload currently has these short-named fields: `u, x, y,
c, l, h, m, t, d, wk, at, pe`. Breath already stops draining the instant
`here === B.UWCAVE` (confirmed: drain condition is specifically `here ===
B.DEEP`, so any non-DEEP tile including UWCAVE already halts it) — this is
the exact existing moment to hook the space-transition into, not a new
detection. `wilds.push({ id: sp + ":" + tx + "," + ty, species: sp, x: tx
+ 0.5, y: ty + 0.5, ph })` is the real spawn call for every wild species
including `water_dragon`, currently placed directly on the main grid.

**PART A — the space system itself.**

New player state: `me.space` (string, default `"main"`). Add one field to
the move broadcast payload: `sp: me.space`. On the receiving end
(`channel.on("broadcast", { event: "move" }, ...)`), only render/collide
with another player if `p.sp === me.space` — this is the entire
multiplayer mechanism. No new channel, no new sync system.

**PART B — entry trigger, reusing the exact existing moment.**

The instant a diving player's current tile biome becomes `B.UWCAVE`
(exactly where breath already stops draining today), instead of just
continuing to stand on that tile: identify which connected UWCAVE cluster
they touched (flood-fill from that tile, same technique already used to
verify pocket counts in past worldgen sanity checks), take that cluster's
lowest-`(tx,ty)` tile as its anchor point, and transition `me.space` to
`"cave:uwcave:" + anchorX + "," + anchorY`. Store the player's surface
position and the anchor before transitioning, so exit can restore both.

**PART C — the interior itself, reusing the main world's own generation
technique at a smaller scale.**

A 26x26 tile interior grid, generated on first entry from a seed derived
from the cluster's anchor point plus `worldSeed` (deterministic — every
player who ever enters that same physical cave gets the identical
interior, every time, with nothing stored server-side). Reuse
`valueNoise()` and the same cave-tone palette already established for
`B.UWCAVE`'s surface rendering — real rock walls forming tunnels and
chambers, not open water. One tile marked as the exit point, placed near
the generated entrance corner.

While `me.space !== "main"`: redirect the tile-lookup and camera-following
that currently point at the main world's grid to this interior grid
instead. `cam.x = me.x; cam.y = me.y;` — same tracking, same code, just
operating on interior-local coordinates. Breath does not drain at all
while inside (already true structurally, since interior tiles are never
`B.DEEP`).

**PART D — the creatures move in, they do not duplicate.**

Remove `water_dragon` and `sea_serpent` from the main-grid `wilds.push()`
spawn path for `B.UWCAVE` tiles entirely — they no longer spawn on the
surface. Instead, spawn both inside the generated interior the first time
it is created, using their existing stats and art completely unchanged.
This is a move, not new content.

**PART E — the resource this biome was always supposed to have.**

New gatherable item, `aquatic_essence` (the bible's own words: "rare
aquatic resources"), placed as real nodes inside the interior alongside
the creatures — 3 to 5 per interior, propose reusing the existing
gather-node interaction pattern. No new crafting recipe this version — the
resource existing and being gatherable is the whole scope here.

**PART F — exit.**

Walking onto the interior's marked exit tile: transition `me.space` back
to `"main"`, restore the player's stored surface position (the same
`(tx,ty)` where they originally touched the `B.UWCAVE` tile, or the
nearest non-blocked tile if that spot is somehow occupied).

**PART G — proof gates, standard gauntlet plus:**
- Confirm two simulated players entering the SAME cluster's anchor point
  both land in `me.space` values that match each other exactly.
- Confirm a simulated player in `"main"` and one in a cave `space` do NOT
  render or collide with each other.
- Confirm the interior is generated deterministically — entering the same
  cluster twice produces identical interior tiles both times.
- Confirm Water Dragon and Sea Serpent no longer spawn via the main-grid
  `wilds` path for any `B.UWCAVE` tile.
- Confirm both species DO spawn inside a freshly-generated interior.
- Confirm `aquatic_essence` nodes exist and are gatherable inside.
- Confirm exiting restores the exact stored surface position.
- Confirm breath does not drain at any point while `me.space !== "main"`.

**Explicitly not touched this version:** Abyssal Hollow (same system
reused later). Blood Moon, Meteor Shower. Dungeons themselves — this
version builds the pattern they will need, not Dungeons. Mounting — this
version does not include mounting, that ships separately.

**After v29 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
