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

## Confirmed, locked spec for the next build (v34 — Bases part 2: raiding & generation)

v33 shipped successfully — 628/628, base_pieces confirmed live. This is
everything v33 deliberately left out. Confirmed directly before writing
this: `base_pieces` currently has no `hp` column at all — `{kind, tier, x,
y, owner}` only, exactly as v33's own notes say. Quick Brace's current
code is a genuine no-op with a comment explicitly marking it as waiting
for this version. `dealHit()`/`mobHit()` are the real functions to model
piece-damage on, not something new.

**One design call made on your behalf, stated plainly rather than left
implicit:** attacking a base piece works through the same attack key as
everything else, no separate confirmation step — matches the bible's own
"anyone who finds your base can walk straight in" framing, which is about
low friction, not high friction.

**PART A — real HP per tier, matching the bible's own words:**
```js
const BASE_TIER_HP = { wood: 40, stone: 90, iron: 180, runic: 350, dragonsteel: 800 };
```
Wood "low durability" through Dragonsteel "near indestructible" — read
directly off the bible's own tier descriptions, not invented numbers.

**PART B — destruction, reusing the existing hit pattern, not a new one.**

New `baseHit(piece, dmg, opts)`, modeled directly on `dealHit()`/`mobHit()`
— same broadcast shape (`channel.send({ type: "broadcast", event:
"base_hit", ... })`), same sync discipline. Wire it into wherever the
player's attack currently resolves against `others`/`mobs`, adding
`base_pieces` as a third checkable target type. At 0 HP: destroy the
piece (remove from `base_pieces`, broadcast `base_destroy`), and if it was
a Storage Chest with contents, drop them via the existing `ground_items`
mechanic — reuse, not reinvent.

**PART C — the Generator finally produces something.**

New `last_collected` column (see Part E). Yield computed on demand, same
shape as `salamanderHappiness()` — never ticked every frame, only
evaluated when the owner interacts with it:
```js
function generatorYield(piece) {
  const hours = (Date.now() - generatorLastCollected(piece)) / 3600000;
  const rate = GENERATOR_RATE[piece.tier] * (piece.ownerIsArchitect ? 1.25 : 1);
  return Math.floor(Math.min(hours, GENERATOR_CAP_HOURS) * rate);
}
```
`GENERATOR_CAP_HOURS` (propose 24) stops a generator neglected for a week
from dumping a week's worth at once — caps the offline benefit without
requiring a server-side process, matching how `salamanderHappiness` also
never needed one.

**PART D — Quick Brace, redesigned to actually fit now that HP exists.**

The original "completes a placement instantly" never made sense — v33
placement was already instant, nothing to speed up. Replaced: **instantly
restores a nearby damaged base piece to full HP** — genuinely matches
"faster building" as emergency repair, and gives the ability real purpose
the moment someone is being raided. Two passive Architect bonuses, always
on, no ability needed: pieces they place get +20% max HP, generators they
place produce at 1.25x (the `ownerIsArchitect` multiplier shown above).
Finally gives "stronger structures" and "resource generation" real
mechanical meaning, not just the one active ability.

**PART E — the SQL this version needs. Flag this as clearly as v33's own
requirement, same shape of note:**
```sql
alter table base_pieces add column hp integer;
alter table base_pieces add column last_collected timestamptz;
```
Code must degrade gracefully if this has not been run yet — same pattern
`petLastFedAt()` already uses for `last_fed_at`: a piece with no `hp`
value falls back to its tier's full `BASE_TIER_HP` rather than treating
it as 0/destroyed, and a Generator with no `last_collected` falls back to
"now" rather than crediting years of imaginary production. Never allowed
to throw either way.

**PART F — proof gates, standard gauntlet plus:**
- Confirm a piece takes real damage through the standard attack path and
  is destroyed at 0 HP.
- Confirm a destroyed Storage Chest with contents drops them as real
  ground items, not silently deleted.
- Confirm generator yield is genuinely time-based (simulate an elapsed
  gap, confirm it scales) and respects the 24h cap.
- Confirm Quick Brace restores a damaged piece and does nothing if none
  is nearby — never throws either way.
- Confirm both Architect passive bonuses apply only to Architect-placed
  pieces, not universally.
- Confirm a piece with no `hp` column value behaves as full-HP, not
  destroyed, and a Generator with no `last_collected` value behaves as
  freshly collected, not backdated — both simulating the pre-migration
  database state.

**Explicitly not touched this version:** any UI marking whose base a
piece belongs to from outside it — still deliberately absent, matching
v33's own note that this is correct for now. Wall rotation.

**After v34 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
