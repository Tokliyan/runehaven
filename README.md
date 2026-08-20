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

## Confirmed, locked spec for the next build (v39 — the Elder trio + the secret event)

v38 shipped successfully. **This replaces the previous v39 attempt, which
correctly failed overnight** — its offline base-guardian subsystem for
Golem Elder expanded into a whole new discovery/authority layer with no
existing pattern to reuse, exactly the kind of thing the standard process
treats as RED rather than guess at. Read that failure report in full
before touching this again if it's ever revisited.

**The explicit call made here, not a silent judgment:** Golem Elder ships
as a normal fight-to-tame companion this version — same shape as Griffin,
`tameable: true`. The "ultimate base defender, stays at base while
offline" behavior from the bible is deferred to its own future version,
once the five real design questions the failure report raised (where it
stands at a base, what counts as a threat, guardian discovery across
clients, what happens if the base is destroyed while offline, idle-
guardian sync authority) are actually answered rather than assumed.

**Confirmed directly before writing this:** none of the three Elders
exist, no Golden Orb, no world-reset mechanism, `fightToTame: true` is
the real tame pattern, `combatMusicUntil` tracks active combat already.

**This spec must never be summarized, quoted, or referenced by anything
player-facing — not the Oracle, not a tooltip, not a loading tip. The
bible is explicit: discovery must be purely emergent.**

**PART A — Golem Elder, a normal companion this version.** Fight-to-tame
(`fightToTame: true`, same as Griffin), spawns at the single deepest tile
of any Ruin cluster — reuse the existing Ruin structure, gate to the
furthest-from-center tile within `RUINB`, not a new location system. No
offline-guardian behavior this version — it behaves exactly like any
other tamed companion once caught.

**PART B — Dragon Elder.** New item, `golden_orb`, a single guaranteed
drop from the Eternal Tower itself, reusing the existing gather-node
pattern, placed at the Tower's own coordinates, once per 48 real hours
across the whole server — a genuine expedition item, not farmable. New
fixed point, `DRAGON_ALTAR`, placed near TOWER the same deterministic way
every other landmark is. Carrying the orb to the altar and interacting
consumes it and tames a Dragon Elder on the spot.

**PART C — Unicorn Elder.** One single tile, chosen uniformly at random
across the ENTIRE map at worldgen from `hash2(worldSeed, 0, 99991)` — no
biome bias, no distance-from-spawn bias. Already confirmed the Oracle's
exclusion list names `unicorn_elder`, so this must never surface there.
Grants fast travel (a menu to the game's fixed landmark points — TOWER,
VOLCANO, BAZAAR, ANCIENT, COLOSSEUM, SHRINE) and a passive multiplier on
the owner's own rare-species presence rolls, same shape as
`bloodMoonActive()`'s boost, always-on for this one owner.

**PART D — the secret event. Every safeguard from the original spec,
unchanged.**

Trigger condition, ALL of the following, checked every frame:
1. A live, tamed Golem Elder and a live, tamed Dragon Elder exist
2. Both currently show `combatMusicUntil > now`
3. Within 3 tiles of each other
4. **All three hold continuously for 4 real seconds** — an accumulator
   that resets to zero the instant any condition breaks, never a counter
   that merely needs 4 seconds' worth of non-consecutive true frames.

On confirmed trigger: broadcast `world_reset_pending` once, a 10-second
countdown naming no cause a player could reverse-engineer, then generate
a new `worldSeed`, clear `base_pieces` server-side, clear all three Elder
ownership flags server-side. **The actual reset call is gated behind an
explicit admin-role check in addition to the trigger firing** — the
trigger arms it, an admin-tier rule executes it. Two keys, not one.

**PART E — proof gates, standard gauntlet plus:**
- Confirm Golem Elder tames and behaves exactly like any other companion
  — no guardian/offline logic anywhere in its code path.
- Confirm the Golden Orb has a real respawn floor.
- Confirm the Unicorn Elder's spawn tile is genuinely uniform-random in a
  seed sweep, not clustered near any landmark.
- Confirm the Oracle's hint pool still excludes all three by name.
- Confirm the trigger accumulator resets to zero the instant ANY one of
  the four conditions breaks, tested by breaking each individually.
- Confirm the actual reset call is unreachable without the admin-role
  gate, even with the trigger condition fully satisfied.
- Confirm nothing added this version appears in any player-facing text
  or the Oracle's hint pool.

**Explicitly not touched this version:** the offline base-guardian
behavior for Golem Elder — its own future version, once actually designed
rather than assumed.

**After v39 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
