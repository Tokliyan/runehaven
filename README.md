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

## Confirmed, locked spec for the next build (v26 — full mounting, all 9 bible species)

v25 shipped successfully — 476/476 in run4, landed directly on main. This
section replaces the v25 entry as the current locked target.

This version is mounting ONLY. Blood Moon and Meteor Shower move to v27 —
checked directly against the live code before writing this: the existing
gatherable system (`featureTypeAt`) is baked into world generation once, not
designed for something to spawn and despawn live during play, which is
exactly what Meteor Shower needs. That's real new infrastructure and
deserves its own version, same reasoning as every prior split.

**Confirmed directly before writing this spec:** zero mounting
infrastructure exists anywhere in the file. `R` is confirmed unbound —
`KEYBIND_DEFAULTS` currently uses w/s/a/d/e/space/i/c/p/f/shift, nothing
else. `PLAYER_SPEED = 4.6`. The camera already just tracks `me.x, me.y`
directly (`cam.x = me.x; cam.y = me.y;`) — no camera changes needed at all,
mounting doesn't touch it. `updatePet()` is the function that currently
makes the active companion trail behind the player every frame — this is
exactly what needs to be suspended while that same pet is being ridden.

**PART A — the mountable set, exactly the bible's nine, no more.**

```js
const MOUNTABLE_SPECIES = new Set(["stag", "griffin", "crystal_golem",
  "water_dragon", "fire_dragon", "storm_dragon", "shadow_dragon",
  "shadowfox", "lightfox"]);
```
Confirmed against the bible's own "Mountable Pets" line — do not add or
remove anything from this set.

**PART B — mount/dismount, `R`, new player state `me.mounted`.**

Pressing `R`: if `activePet` exists and `MOUNTABLE_SPECIES.has(activePet's
species)` and `me.mounted` is currently false, set `me.mounted = true`. If
`me.mounted` is already true, set it false (dismount), regardless of what
the active pet currently is. If neither condition holds (no eligible pet),
`R` does nothing — no error, no toast spam, just a no-op.

Auto-dismount safety: if `activePet` becomes null or changes species while
`me.mounted` is true (pet swapped via the companion panel, pet removed,
etc.), clear `me.mounted` back to false in the same place that change
happens. Never leave `me.mounted` true while pointing at a pet that no
longer qualifies.

**PART C — speed bonus.**

```js
const MOUNT_SPEED_MULT = 1.6;   // TUNABLE
```
Wherever `PLAYER_SPEED` is currently used for the player's own movement
(not pets, not mobs), multiply by `MOUNT_SPEED_MULT` when `me.mounted` is
true. Do not touch `PLAYER_SPEED` itself or any other entity's speed.

**PART D — rendering: suspend the trailing pet, seat the player on it
instead.**

While `me.mounted` is true, do NOT call the normal trailing-follow branch
of `updatePet()` for the active pet — the mount should sit at/near the
player's own position, not trail behind at the usual offset distance.
Simplest correct approach: early-return from `updatePet()` when the pet
being updated is the current mount, and instead position it directly at
`h.x, h.y` (no lerp-toward-behind-the-player logic at all while mounted).

Seat offset — scales with the mount's actual size, not a flat number for
every species. Reuse the real `SPECIES_K` values already in the file
(confirmed): shadowfox 1.66 (the largest of the nine, bigger than every
dragon in this game's own art), crystal_golem 1.50, griffin 1.26, the four
dragons 1.30 each, stag 1.15, lightfox 1.05 (the smallest).

```js
function mountSeatOffsetY(species) {
  return -(2.2 * (SPECIES_K[species] || 1.2));   // TUNABLE base of 2.2
}
```
Draw the mount's body first (its existing `drawSpecies` branch, unchanged
— no new art needed, all nine already exist), then draw the player sprite
offset upward by `mountSeatOffsetY(activePet's species)` from the mount's
position. Do not draw the player at their normal ground-level offset while
mounted.

**PART E — two deliberate scope boundaries, stated explicitly so nothing
gets invented at build time:**
1. **Combat works fully while mounted, no restriction.** The bible doesn't
   say otherwise, and inventing a "can't fight while riding" rule would be
   unstated scope, not a real requirement.
2. **Griffin's flight does not grant any special movement or terrain-
   crossing power while mounted.** Confirmed Griffin is the only `flier:
   true` species among the nine — every mount gives the exact same
   `MOUNT_SPEED_MULT` benefit and nothing else. Building real flight-based
   traversal is comparable in scope to the v21 dive mechanic and is
   explicitly not this version's job.

**PART F — pet auto-attack is suspended while mounted.**

The active pet's combat-assist behavior (auto-attacking nearby threats)
should not fire while that same pet is currently being ridden — a mount
lunging at something mid-ride doesn't make sense and isn't something the
bible asks for. Resume normal pet-combat behavior immediately on dismount.

**PART G — proof gates, standard gauntlet plus:**
- Confirm `R` correctly mounts only when the active pet is one of the nine,
  and does nothing otherwise.
- Confirm dismounting via `R` a second time restores normal pet-trailing
  behavior immediately.
- Confirm the auto-dismount safety fires if the active pet changes while
  mounted.
- Confirm movement speed is genuinely `PLAYER_SPEED * 1.6` while mounted
  and back to normal immediately on dismount.
- Confirm pet auto-attack genuinely does not fire for a mount currently
  being ridden, and does fire again immediately after dismounting.
- Confirm all nine species can each be mounted without error in the test
  harness — not just one or two as a sample.

**Explicitly not touched this version:** Blood Moon, Meteor Shower (v27).
Bases. Any per-species mount ability beyond the shared speed bonus.

**After v26 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
