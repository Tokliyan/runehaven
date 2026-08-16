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

## Confirmed, locked spec for the next build (v27 — class abilities + real weapon-type identity)

v26 shipped successfully. This section replaces it as the current locked
target. Not new content — five classes and two weapon types get real
mechanical identity for the first time, on top of what already exists.

**Correction against an earlier assumption, confirmed directly in
`tryAttack()` before writing this:** melee combat already has real per-
weapon-type identity — a universal backstab crit (1.6x, checked via facing
dot-product) and per-type knockback weight (`axe` heaviest at 1.1, `spear`
0.6, `sword` 0.55, `dagger` lightest at 0.2). Do not touch or duplicate any
of this. The genuine gaps, checked directly: `CLASSES` is confirmed to be
color palette plus flavor text only, no mechanic. Spears hit exactly one
target despite their reach. Staves fire a single-target projectile despite
"area damage" being their class's own stated description.

**PART A — five class abilities, one each, reusing infrastructure that
already exists rather than inventing new systems.**

Trigger key: propose `Q` — confirmed unbound (current `KEYBIND_DEFAULTS`
uses w/s/a/d/e/space/i/c/p/f/shift/r only). Add `ability: "q"` to
`KEYBIND_DEFAULTS` and route it through `KEYBINDS` exactly like every
other action, so it inherits full remapping support automatically.

Each ability has its own cooldown, tracked the same way `lastAttack`
already is (a single timestamp per player, checked against `now -
lastAbility < cooldownMs`).

- **Knight — Guard Break.** 8s cooldown. For 2s, the Knight's next hit
  taken is reduced 50% (reuse the existing armor `reduce` stat's math,
  stack multiplicatively). A defensive, frontline-appropriate power spike,
  not damage — matches "melee tank, frontline fighter" directly.
- **Ranger — Marked Shot.** 10s cooldown. The Ranger's next ranged hit
  within 3s deals +50% damage and cannot be blocked by the Knight's Guard
  Break window above (explicitly the counterplay pair between these two).
- **Mystic — Arcane Burst.** 12s cooldown, the highest of the five —
  matches "area damage" being the most powerful single moment. On cast,
  reuse the existing `aura(sx, sy, col, rx, t, o)` function (present since
  v18, used for dragon effects) to draw a real expanding ring, and apply
  `dealHit`/`mobHit` to every player/mob within a 4-tile radius of the
  Mystic's position at cast time. This is a genuine AOE, not flavor text.
- **Beastmaster — Rally Companion.** 9s cooldown. The active companion's
  next 3 attacks deal +40% damage. Directly reinforces "pet stat buffs"
  without touching taming odds or any system outside combat.
- **Architect — Quick Brace.** 7s cooldown, the shortest — matches
  "faster building" being a utility-speed identity, not a combat one. If
  cast while actively placing a structure (once bases exist — until then,
  this ability is inert and does nothing, which is fine, not a bug),
  instantly completes that placement. Until bases ship, this ability
  simply has no effect when cast — do not invent a temporary substitute
  effect for it.

**PART B — Spear: real line-hit, not just reach.**

In `tryAttack()`'s melee branch, when `wk === "spear"`: instead of hitting
only the single nearest target within range, hit every player AND mob
whose position falls within `w.range` along the aim direction, in a narrow
cone (propose 25 degrees half-angle, tunable) — not everything in a circle,
a genuine line/thrust. Apply the same crit/knockback logic per-target as
already exists, just looped instead of single-target. Damage does not
increase for hitting multiple targets — this is reach and positioning
value, not a damage multiplier.

**PART C — Staff: real splash, not single-target.**

Confirmed: staff attacks already fire a projectile (`pk = "orb"`). On that
projectile's impact (wherever `updateProjectiles` currently resolves a hit
and calls `dealHit`/`mobHit`), when the projectile's weapon kind is
`"staff"`, apply the same damage to every other player/mob within a 2-tile
radius of the impact point, not just the one it directly struck. This
finally makes "Magic attacks, buffs, area damage" true for the class most
associated with it.

**PART D — proof gates, standard gauntlet plus:**
- Confirm all five abilities exist, are bound to `Q` through the real
  `KEYBINDS` system (not hardcoded), and each respects its own independent
  cooldown.
- Confirm Mystic's Arcane Burst genuinely hits multiple targets in a
  simulated multi-target scenario, not just the nearest one.
- Confirm Knight's Guard Break and Ranger's Marked Shot correctly resolve
  against each other when both are active at once (the explicit
  counterplay case).
- Confirm Spear's line-hit genuinely connects with 2+ targets in a
  straight line and misses a target clearly outside the cone angle.
- Confirm Staff splash genuinely damages a second nearby target on impact
  and does not affect a target outside the 2-tile radius.
- Confirm Architect's ability is a safe no-op right now, not an error,
  given bases don't exist yet.

**Explicitly not touched this version:** Blood Moon, Meteor Shower (still
next, v28 now). Bases. Any weapon besides Spear and Staff — Sword, Axe,
Dagger, Bow, and Crossbow already have real identity via the existing
crit/knockback system and don't need new mechanics invented for them here.

**After v27 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
