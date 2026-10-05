# BUILD FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-10-05
**Spec attempted:** `NEXT_BUILD.md` → README.md §"Confirmed, locked spec for a
future version (World Encounters — Roaming Boss & Bounty Board)" (README.md:731)
**Classified:** RED, per README.md standard process step 5.
**`runehaven.html` is UNCHANGED.** Nothing was patched, nothing shipped. The
last shipped version remains v59 (Matched-Tier Gear Bonus).

PART B of this spec is NOT blocked and is ready to build (details at the
bottom). It was deliberately not shipped alone, because step 5 requires
leaving `runehaven.html` unchanged on a RED and not shipping a half-finished
version. Splitting the spec is a call for the project owner, not this build.

---

## BLOCKER 1 — PART A requires inventing a mob the bible does not list (hard RED)

PART A asks for "a new, additional Boss-tier creature with no fixed home",
explicitly separate from the Elder Drake.

**The bible lists exactly one Boss-tier creature.** `RUNEHAVEN_BIBLE.md`
§MOBS ends with: `Elder Drake — Volcano, World Boss — Boss tier — Dragonsteel,
legendary loot`. It is the only "Boss tier" row in the table, and the bible
pins it to the Volcano. The codebase already states this twice, as settled
fact, in comments written by earlier builds:

- `runehaven.html:2907` — "the bible's **only** boss-tier creature"
- `runehaven.html:19302` — "The drake is the only thing in the world the bible
  calls boss-tier, and this is its bar."

So a second Boss-tier creature cannot be sourced from the bible. Building
PART A means inventing a creature outright: its name, its lore, its
appearance/render treatment, its biome behaviour, its HP/damage/aggro
numbers, and its loot table. Those are not tunables sitting on top of a
canon creature — there is no canon creature underneath them.

Step 5 RED, verbatim: *"The spec would require inventing bible content — a
pet, mob, biome, location, or lore element not in the bible. This is a
creative integrity rule, not a bug-severity one, and severity never
overrides it."*

### No canon creature can stand in for it — both candidates were checked

**Unicorn Elder — checked, does not fit.** It is the only creature in the
bible that roams with no fixed location ("Spawns randomly anywhere in the
world, no pattern or hint"), so it is the obvious candidate. It is not
usable here:

- The bible makes it an **Elder-tier tameable pet** that grants fast travel
  and a passive luck buff — not a boss, and not a kill target.
- It is **already shipped and working** as a hold-E tame at a hashed tile:
  `unicornElderTile()` (`runehaven.html:5658`), placed at `:6266`–`:6283`,
  luck buff at `:5707`–`:5719`. Converting it into a roaming boss would
  break a live feature.
- The existing boss-bar code **explicitly rules this out by name**, as a
  deliberate decision: *"a boss bar over a Unicorn Elder you are trying to
  tame would be exactly wrong"* (`runehaven.html:19301`). Overriding that
  would be reversing a prior build's reasoned call on no authority.
- It is Elder-tier, not Boss-tier, so it does not satisfy the spec as written
  either.

**"Adult wild dragon" — checked, does not fit.** The bible names it only as a
dragonsteel source (§DRAGONSTEEL), never in the MOBS table at any tier, and
it has no implementation (`grep -c adult_dragon runehaven.html` → 0). Giving
it Boss-tier stats and a boss bar is the same invention as blocker 1, and the
bible ties each dragon species to a specific biome, so it is not homeless
either.

**This is the decisive blocker and it is not a judgment call.** Picking either
substitute would mean guessing at the spec's intent against its own explicit
wording ("Boss-tier", "new, additional"), which step 5 forbids.

---

## BLOCKER 2 — PART A's stated premise does not hold against the live code

Independent of blocker 1, and worth recording because it changes what PART A
actually costs to build.

The spec opens: *"Confirmed live: deterministic idle-wander logic already
exists, leash-bound to each creature's own `leashRadius`. This spec extends
that proven pattern rather than building new movement logic."*

The first sentence is true. **The second is not.** The live idle-wander
(`runehaven.html:8138`–`8148`) is a bounded sinusoidal oscillation around a
**fixed home point** `(m.hx, m.hy)` — the tile the mob was placed on —
with amplitude hard-capped at `min(leashRadius * 0.4, 4)` tiles. The state
machine at `:8133` reclassifies anything past that as `"leash"` and walks it
straight back to `(m.hx, m.hy)`.

A creature with "no fixed home... moving slowly across biome boundaries over
real time" is therefore **not** this pattern with a bigger `leashRadius`. The
pattern is defined by the fixed home it orbits; there is no mechanism anywhere
in the file for a home point to migrate. PART A needs genuinely new movement
logic, and that logic needs these decisions, none of which the spec specifies:

1. How the home point migrates — path, heading, how a new destination is chosen.
2. Migration speed, in tiles per real hour, and whether it moves while unobserved.
3. Pathing for a creature with `biomes: []` and no fixed home: the file's
   terrain gating assumes a creature placed in legal terrain and kept there by
   its leash. Crossing biome boundaries means deciding water, cliff and
   impassable-tile behaviour for a creature that has no biome list.
4. Safe-Zone exclusion. `inSafeZone()` exists (`:9359`) and the proof gate
   requires the boss never enter one, but a wanderer with no home has no
   placement-time check to lean on — this needs a live, per-step exclusion,
   including the case where it would be boxed in.
5. **Cross-client agreement, which is the real one.** The file's own sync
   record (`:7948`) reads: *"idle wander is deterministic per client; engaged
   mobs are simulated locally... the CLOSEST player periodically broadcasts
   authoritative pos/hp."* Per-client determinism works today precisely
   because every client derives wander from a shared fixed home plus a clock.
   A boss whose position is the thing players track, with "real, findable
   coordinates at any moment (no teleporting...)" and no fixed home, must have
   one position every client agrees on with no player necessarily nearby to be
   the authority. That is a new sync problem, not a reuse of the existing one.

That is step 5's *"spec assumes an entire system exists that doesn't, AND
building it properly needs 3+ genuinely unspecified, interdependent decisions
with real gameplay consequences"* — a second, independent RED.

### One further item, minor and not itself a blocker

`BOSS_KIND` is a single hardcoded string constant, `"elder_drake"`
(`runehaven.html:19284`), and `activeBossMob()` filters on
`x.kind === BOSS_KIND`. "Reuses the existing boss-bar" requires widening that
to a set. On its own that is a routine YELLOW — but note that the surrounding
comment documents the single-kind scoping as deliberate, so whoever does it
should rewrite that comment rather than quietly contradict it.

---

## What is needed to unblock PART A

Any ONE of these clears blocker 1. Blocker 2 then still needs answering, but
it is ordinary design work once there is a real creature to build.

- **Add the creature to `RUNEHAVEN_BIBLE.md`** — a Boss-tier row in §MOBS
  with name, territory (or explicit "roams, no fixed territory"), difficulty
  and loot, plus whatever lore it should carry. This is the clean fix: it
  makes the creature canon and PART A becomes a normal build.
- **Or state in the README spec that this boss is explicitly non-canon**,
  and name it. Step 3 permits a non-bible mob when it is *"explicitly
  marked non-canon"* — but that marking has to come from the spec or the
  owner, not be self-authorised by a build.
- **Or re-scope PART A onto the Elder Drake** — e.g. the drake leaving the
  Volcano under some condition. This needs confirming against the bible's
  Volcano pinning and the spec's own "The Elder Drake stays exactly fixed at
  the Volcano, per the bible", so it would be a spec change, not a reading.

Also worth deciding at the same time: whether PART A's roaming boss is meant
to be killable-only, or tameable, since that determines whether it belongs in
`MOBS` or `WILD_SPECIES` and whether the boss bar applies at all.

---

## PART B is ready to build (not blocked)

Recorded so no time is re-spent confirming it. Every system PART B says it
reuses is live:

- **Shared day counter:** `worldDayNum()` (`runehaven.html:8383`). Already the
  counter behind the Blood Moon (`BLOOD_MOON_EVERY`, `:8511`) and the
  Krakenling 10-day window (`dayWindowOpen()`, `:8565`), and already surfaced
  to the player as "Day N" (`:18810`). This is exactly the spec's "same
  day-counter other daily systems already use".
- **Safe hub for the board:** both Spawn and the Grand Bazaar exist, and
  `inSafeZone()` (`:9359`) is available to gate the interaction point.
- **Reward:** existing loot tables throughout `MOBS`/`WILD_SPECIES`, so no new
  currency is needed, per the spec.
- **No invented content:** the bounty names an *existing* creature, so
  step 3 is satisfied.

The only open question on PART B is a YELLOW (the size of the bonus reward),
not a RED.
