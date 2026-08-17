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

## Confirmed, locked spec for the next build (v28 — full mounting, all 9 bible species)

v27 shipped successfully — 528/528 in run4, landed directly on main. This
section replaces the v27 entry as the current locked target.

**This spec was re-verified from scratch against the real current file,
not resubmitted from the earlier v26 draft that never actually built.**
Everything below was checked directly against `runehaven.html` as it
stands after v27, including one new interaction v27 introduced that the
earlier draft couldn't have accounted for.

**Confirmed fresh:** zero mounting code exists anywhere. `R` is genuinely
still unbound — `KEYBIND_DEFAULTS` now has 12 entries after v27 added
`ability: "q"`, and `r` was never touched by that change. `PLAYER_SPEED =
4.6`, camera still just tracks `cam.x = me.x; cam.y = me.y;` directly, no
camera changes needed. `updatePet()` still makes the active companion
trail the player every frame — exactly what needs suspending while that
same pet is being ridden.

**PART A — the mountable set, exactly the bible's nine.**

```js
const MOUNTABLE_SPECIES = new Set(["stag", "griffin", "crystal_golem",
  "water_dragon", "fire_dragon", "storm_dragon", "shadow_dragon",
  "shadowfox", "lightfox"]);
```

**PART B — mount/dismount, `R`, new player state `me.mounted`.**

Pressing `R`: if `activePet` exists, its species is in
`MOUNTABLE_SPECIES`, and `me.mounted` is false, set it true. If already
true, `R` dismounts regardless of current pet. If neither condition holds,
no-op, no error.

Auto-dismount safety: if `activePet` becomes null or changes species while
mounted, clear `me.mounted` in the same place that change happens.

**PART C — speed bonus.**

```js
const MOUNT_SPEED_MULT = 1.6;   // TUNABLE
```
Multiply the player's own movement by this while `me.mounted` is true.
Touch nothing else's speed.

**PART D — rendering: suspend the trailing pet, seat the player on it.**

While mounted, skip `updatePet()`'s normal trailing-follow branch for the
active pet — position it at `h.x, h.y` directly instead. Seat offset scales
with the real `SPECIES_K` values (confirmed fresh): shadowfox 1.66 (still
the largest of the nine), crystal_golem 1.50, griffin 1.26, the four
dragons 1.30 each, stag 1.15, lightfox 1.05 (smallest).

```js
function mountSeatOffsetY(species) {
  return -(2.2 * (SPECIES_K[species] || 1.2));   // TUNABLE base of 2.2
}
```
Draw the mount's existing `drawSpecies` body first (no new art — all nine
already exist), then the player offset upward by
`mountSeatOffsetY(activePet's species)`.

**PART E — three deliberate scope boundaries, stated explicitly:**
1. **Combat works fully while mounted, no restriction.**
2. **The class ability from v27 (`Q`, tracked via `lastAbility`) also works
   fully while mounted — same reasoning as combat, this is new territory
   v27 introduced that didn't exist when mounting was first designed, and
   it should follow the identical rule rather than being silently
   forgotten or arbitrarily blocked.**
3. **Griffin's flight grants no special movement or terrain-crossing power
   while mounted.** Confirmed the only `flier: true` species among the
   nine — every mount gives the same speed benefit and nothing else.
   Building real flight traversal is its own version's worth of scope, not
   this one's.

**PART F — pet auto-attack is suspended while mounted**, resuming
immediately on dismount, same reasoning as before: a mount lunging at
something mid-ride doesn't make sense and isn't bible-required.

**PART G — proof gates, standard gauntlet plus:**
- Confirm `R` mounts only for the nine, no-ops otherwise.
- Confirm dismounting restores normal pet-trailing immediately.
- Confirm the auto-dismount safety fires on active-pet change.
- Confirm speed is genuinely `PLAYER_SPEED * 1.6` while mounted, normal
  immediately after.
- Confirm the class ability (`Q`) still fires correctly while mounted —
  new check this version, didn't exist before v27.
- Confirm pet auto-attack doesn't fire for a currently-ridden mount, and
  resumes immediately on dismount.
- Confirm all nine species mount without error, not just a sample.

**Explicitly not touched this version:** Blood Moon, Meteor Shower (v29).
Bases. Any per-species mount ability beyond the shared speed bonus.

**After v28 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.

---

## DRAFT — staged for review only, NOT the active build target (v29 — real cave interiors, Underwater Caves as the proof of concept)

**This is not what `NEXT_BUILD.md` points at.** v28 (mounting) is still
the active locked spec above, still unbuilt as of this push. This section
is here for review only — it becomes the real target only once explicitly
confirmed, and only after v28 is verified actually built first, not
assumed. This is a genuinely large, foundational system —
scoped deliberately to ONE biome first. Abyssal Hollow gets the same
system reused, not redesigned, once this is proven. This also lays real
groundwork for Dungeons later, which need the identical "enter, arrive
somewhere separate" pattern — do not build anything here that's specific
to water and can't be reused.

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
the move broadcast payload: `sp: me.space`. On the receiving end (`channel.on("broadcast", { event: "move" }, ...)`), only render/collide
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

**PART D — the creatures move in, they don't duplicate.**

Remove `water_dragon` and `sea_serpent` from the main-grid `wilds.push()`
spawn path for `B.UWCAVE` tiles entirely — they no longer spawn on the
surface. Instead, spawn both inside the generated interior the first time
it's created, using their existing stats and art completely unchanged.
This is a move, not new content.

**PART E — the resource this biome was always supposed to have.**

New gatherable item, `aquatic_essence` (the bible's own words: "rare
aquatic resources"), placed as real nodes inside the interior alongside
the creatures — 3-5 per interior, propose reusing the existing gather-node
interaction pattern. This is the fix for the gap confirmed a few messages
back: the bible promised this and nothing was ever built for it. No new
crafting recipe this version — the resource existing and being gatherable
is the whole scope here, what it crafts into can come later once there's
an actual reason to build one.

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
  cluster twice (simulated) produces identical interior tiles both times.
- Confirm Water Dragon and Sea Serpent no longer spawn via the main-grid
  `wilds` path for any `B.UWCAVE` tile.
- Confirm both species DO spawn inside a freshly-generated interior.
- Confirm `aquatic_essence` nodes exist and are gatherable inside.
- Confirm exiting restores the exact stored surface position.
- Confirm breath does not drain at any point while `me.space !== "main"`.

**Explicitly not touched this version:** Abyssal Hollow (v30 or later,
same system reused). Blood Moon, Meteor Shower (pushed back one slot).
Dungeons themselves — this version builds the pattern they'll need, not
Dungeons.

**After v29 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
