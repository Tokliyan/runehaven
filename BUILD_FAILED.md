# BUILD FAILED — v39 (the Elder trio + the secret event)

Overnight run 2026-08-20. Following the standard process's "When genuinely
unsure which zone something belongs in: treat it as RED" rule. Nothing was
committed; `runehaven.html` is unchanged.

The spec is well-specified for most of its scope (elder mob data, the
Dragon Elder orb→altar ceremony, the Unicorn Elder's random tile and
teleport menu, the trigger accumulator, the countdown broadcast, the
admin-role gate, the Oracle exclusion preservation). But PART A's core
promise — "Ultimate base defender, stays at base while offline ...
simulated by whichever nearby player's client is currently closest — the
exact same authority pattern mob_sync already uses for regular mobs,
applied to a companion instead of a wild spawn" — expands into a whole
new subsystem that no existing pattern in the file actually implements,
and building it correctly requires several interdependent design
decisions with real gameplay consequences.

Concretely, the spec assumes a pattern that does not exist yet:

1. **`mob_sync` today runs on the WILD hostile-mobs population that lives
   in `mobs = []`, seeded by worldgen from `MOBS` defs on every client
   deterministically.** Every client independently builds the same mob
   list from the seed, then closest-client authority reconciles positions
   via `mob_sync`. There is no discovery step — the population is
   implicit in the seed.

   A tamed Golem Elder guardian at some other player's base is NOT in
   any client's `MOBS`-seeded population. There is no shared seed for
   "tamed elders guarding bases" — the state lives in the `pets` (or a
   new) table. So every online client would need to actively QUERY the
   database for active `golem_elder` rows across all players on every
   world load, materialise them into the local `mobs` array with owner
   tags, and keep that list in sync as elders are tamed / owners log
   off / bases are destroyed / a raid kills the guardian. That discovery
   layer is genuinely new — mob_sync does not do it, and the spec asserts
   "No new sync mechanism", which reads as "we shouldn't invent one".

2. **Where at the base does the guardian stand?** Owners have between
   1 and many `base_pieces`. Options are all real design choices, none
   dominant: the centroid of all pieces (a wall run stretched across a
   valley gives a nonsensical "centroid"); the first-placed Foundation
   (persistence order is not stored); the nearest Foundation to the
   Storage Chest (assumes a chest); the newest piece (churns constantly).
   The choice materially changes what "at base" means for a raider.

3. **What is the guardian's aggro rule?** "Ultimate base defender"
   suggests attacking raiders, but the file has no concept of "raider"
   distinct from "any non-owner player." Attacking any non-owner within
   range means a friend visiting the base gets killed; only attacking
   players who have damaged a base piece requires new bookkeeping
   (per-guardian threat table synchronised across clients). Neither is
   a tunable.

4. **When the base is empty (or destroyed while owner is offline),
   what does the guardian do?** Return to its taming ruin? Follow a
   surviving base_piece? Disappear from the world? Persist at last
   known coordinates? Each answer changes how the mechanic reads.

5. **Cross-client authority handoff for a guardian without a wild-mob
   home:** mob_sync's authority is "target === me" — the client whose
   player the mob is aggroed at broadcasts. An idle guardian has no
   target, so the current heuristic never picks an authority for it.
   The spec's "nearest online client" phrasing implies a new authority
   rule for idle-guardian ownership — a real change to the sync layer,
   not a reuse of the existing one.

None of these are tunables (a number to pick and flag); each is a design
decision with cascading gameplay consequences. Together they are the RED
condition's own example — "a whole new traversal/instance architecture —
the kind of thing where any guess is really a design decision, not a
tunable."

There is also a secondary concern that reinforces treating this as RED:
the reset call in PART D irreversibly wipes every player's `base_pieces`
and rerolls `worldSeed`. The spec's two-key safeguard (trigger arms,
admin executes) mitigates but does not eliminate the risk of a subtle
bug — for example, if the trigger's continuity accumulator is wrong in
a way that makes a bare-minimum overlap fire it, and an admin client
happens to be online near the fight, the reset fires for real. Shipping
that gate under uncertainty about the guardian pattern that produces the
elders in the first place is exactly the "wrongly-shipped RED" case the
standard process warns about.

## What would unblock this

A follow-up spec that pins these five decisions explicitly:

- Where the guardian stands at a base (one rule, exact).
- Which players it treats as threats (any non-owner in radius vs.
  damaged-a-piece-recently vs. some other rule).
- How the guardian population is discovered by other clients (one query,
  one refresh cadence) and represented in `mobs`.
- What happens when the base is destroyed while the owner is offline.
- How idle-guardian sync authority is decided when no client's player is
  targeted.

Everything else in the spec (parts B, C, D, E) is buildable as written
once PART A's guardian subsystem is nailed down. If shipping v39 without
PART A's offline-guardian behaviour is acceptable — treating the tamed
Golem Elder as a normal fight-to-tame companion (Griffin's shape) for now,
with the offline defender flow deferred to a later version — that's an
equally valid unblock, but it needs to be an explicit call, not a
judgment I make silently under a JUDGMENT CALL heading.

No files were changed. `NEXT_BUILD.md` still points at the v39 spec and
was not edited. The routine will re-run tomorrow; whoever updates
`NEXT_BUILD.md` or the spec next should delete this file.
