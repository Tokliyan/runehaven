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

v38 shipped successfully (built under that label — content was the
originally-queued v35 spec, built after v37 landed ahead of it; see that
changelog entry for why). This is the real next version. Confirmed
directly before writing this: none of the three Elders exist, no Golden
Orb, no world-reset mechanism, `fightToTame: true` is the real existing
tame pattern (Griffin/Boar/Bear), and `combatMusicUntil` already tracks
"actively fighting right now" — reuse it, do not build a second detector.

**This spec must never be summarized, quoted, or referenced by anything
player-facing — not the Oracle, not a tooltip, not a loading tip. The
bible is explicit: discovery must be purely emergent.**

**PART A — Golem Elder.** Fight-to-tame (`fightToTame: true`, same as
Griffin), spawns in the deepest tile of any Ruin cluster — reuse the
existing Ruin structure, gate to the single furthest-from-center tile
within `RUINB`, not a new location system. "Ultimate base defender, stays
at base while offline": when assigned to guard a specific `base_pieces`
owner, it is simulated by whichever nearby player's client is currently
closest — the exact same authority pattern `mob_sync` already uses for
regular mobs, applied to a companion instead of a wild spawn. No new
sync mechanism.

**PART B — Dragon Elder.** New item, `golden_orb`, a single guaranteed
drop from the Eternal Tower itself — reuse the existing gather-node
pattern, placed at the Tower's own coordinates, very low respawn
frequency (propose once per 48 real hours across the whole server, a
genuine expedition item, not a farmable one). New fixed point,
`DRAGON_ALTAR`, placed near TOWER the same deterministic way every other
landmark is. Carrying the orb to the altar and interacting consumes it
and tames a Dragon Elder on the spot — no combat required, matching the
bible's "bring it to awaken" framing exactly.

**PART C — Unicorn Elder.** One single tile, chosen uniformly at random
across the ENTIRE map at worldgen time from `hash2(worldSeed, 0, 99991)`
— no biome bias, no distance-from-spawn bias, nothing that could function
as a hint. Confirmed this must never appear in any hint system, including
the Oracle's — already true, since Oracle's exclusion list already names
`unicorn_elder`. Grants: fast travel (teleport to any of the game's fixed
landmark points — TOWER, VOLCANO, BAZAAR, ANCIENT, COLOSSEUM, SHRINE — a
menu, not a click-anywhere system) and a passive multiplier on the
player's own rare-species presence rolls, same shape as the existing
`bloodMoonActive()` presence boost, just always-on for this one owner
rather than event-gated.

**PART D — the secret event. Build every safeguard explicitly, do not
treat "hard to trigger" as automatic.**

Trigger condition, ALL of the following, checked every frame, not once:
1. A live, tamed Golem Elder and a live, tamed Dragon Elder (same owner
   or different owners, the bible does not require it be the same player)
2. Both currently show `combatMusicUntil > now` — genuinely, actively
   fighting, not just standing near a fight
3. Within 3 tiles of each other
4. **All three conditions hold continuously for 4 real seconds** — a
   single frame of overlap must not fire this. Track an accumulator that
   resets to zero the instant any condition breaks, not a counter that
   merely needs to reach 4 seconds' worth of true frames non-consecutively.

On confirmed trigger: broadcast a `world_reset_pending` event ONCE (guard
against every client independently trying to fire it), a 10-second
visible countdown naming no cause a player could reverse-engineer into a
trigger condition, then: generate a new `worldSeed`, clear `base_pieces`
server-side for every owner, and clear all three Elder ownership flags
server-side. This is the single most consequential action in the entire
game — the actual reset call must be gated behind an explicit admin-role
check in addition to the trigger firing, so a bug in the trigger logic
alone cannot wipe a live server; the trigger arms it, an admin-tier
server rule executes it. Flag this explicitly as a deliberate two-key
safeguard, not indecision about the design.

**PART E — proof gates, standard gauntlet plus:**
- Confirm the Golem Elder spawns only in the single deepest Ruin tile per
  cluster, not scattered generally through `RUINB`.
- Confirm the Golden Orb has a real respawn floor and cannot be farmed
  repeatedly in a short window.
- Confirm the Unicorn Elder's spawn tile is genuinely uniform-random
  across the whole map in a seed sweep, not clustered near any landmark.
- Confirm the Oracle's hint pool still structurally excludes all three
  by name (already true, must not regress).
- Confirm the trigger accumulator resets to zero the instant ANY one of
  the four conditions breaks, tested by breaking each condition
  individually mid-count.
- Confirm the actual reset call is unreachable without the admin-role
  gate, even with the trigger condition fully satisfied — this is the
  single most important gate in this entire proof section.
- Confirm nothing added this version appears in any player-facing text,
  tooltip, or the Oracle's hint pool.

**After v39 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
