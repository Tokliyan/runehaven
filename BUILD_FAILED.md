# BUILD FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-10-04
**Target:** `NEXT_BUILD.md` → README.md, "Confirmed, locked spec for a future
version (World Encounters — Roaming Boss & Bounty Board)" (README.md:731–759)
**Outcome:** STOPPED before any patch. `runehaven.html` is **unchanged** — not
one byte was edited, and no harness was run because there was nothing new to
test. `NEXT_BUILD.md` is also unchanged, as required.

---

## The blocker, in one sentence

**PART A asks for a second Boss-tier creature, and the bible only has one.**
Building it means inventing a mob the bible does not list, which the standard
process (README.md step 5) classifies as RED — "no exceptions, regardless of
how small it looks… severity never overrides it."

## Exactly what the spec asks for

README.md:737–741, verbatim:

> **PART A — a roaming world boss, separate from the Elder Drake.** The
> Elder Drake stays exactly fixed at the Volcano, per the bible — this is
> a new, additional Boss-tier creature with no fixed home…

Three words in there are each individually binding, and together they leave no
canon creature that fits:

- **"new"** — it cannot be a creature already in `runehaven.html`.
- **"additional Boss-tier"** — it must be Boss tier.
- **"separate from the Elder Drake"** — the one Boss-tier creature that exists
  is explicitly ruled out by the spec itself.

## Why no bible creature fills that hole

`RUNEHAVEN_BIBLE.md`'s MOBS table assigns exactly one creature the Boss tier:

> `Elder Drake — Volcano, World Boss — Boss tier — Dragonsteel, legendary loot`

Every other row in that table is Easy / Medium / Hard / Very Hard, and all of
them are already built and all of them have a fixed biome home. The file itself
says this in three separate places, each written by a previous build that
checked the same thing:

- `runehaven.html:2907` — *"the bible's only boss-tier creature"*
- `runehaven.html:6164` — *"the bible's only boss-tier creature"*
- `runehaven.html:19302` — *"The drake is the only thing in the world the bible
  calls boss-tier, and this is its bar."*

The two candidates worth ruling out explicitly, so the next run doesn't
re-derive them:

| Candidate | Why it does not fit |
|---|---|
| **Unicorn Elder** — the only creature the bible gives no fixed home ("Spawns randomly anywhere in the world, no pattern or hint") | Not new: it already exists (`unicornElderTile()`, `runehaven.html:5658`; `UNICORN_ELDER_LUCK`, `:5715`). Not Boss tier: it is an Elder **pet** you tame, and v52+53 PART G deliberately scoped `BOSS_KIND` to `elder_drake` alone, writing that *"a boss bar over a Unicorn Elder you are trying to tame would be exactly wrong"* (`:19300`). Using it would reverse a prior deliberate decision, not extend it. |
| **An "adult wild dragon"** — named in the bible's dragonsteel list ("Killing an adult wild dragon in the world") and absent from the file today | The bible gives adult dragons no tier, no stat line and no MOBS row — and it gives each dragon species a **fixed** canon home (Storm Dragon → Shattered Peaks, Shadow Dragon → Abyssal Hollow, Fire Dragon → lava caves, Water Dragon → underwater caves). Making one roam across biome boundaries contradicts the bible rather than following it, and picking which species, what tier, and what lets it leave its territory is three interdependent creative decisions, not tunables. |

## The two things that would also have to be invented downstream

Even if a creature identity were handed down, PART A still carries two
unspecified items that are lore, not tunables:

1. **Its loot.** The bible names exactly four sources of dragonsteel and this
   creature is not one of them. A Boss-tier creature that drops dragonsteel
   adds a fifth source (lore change); one that does not is a world boss worth
   less than a Demon Knight (`runehaven.html:3098`). Either way that is the
   owner's call, not a build's.
2. **Its art.** A new creature needs its own silhouette branch in `drawMob` and
   a `MOB_K` scale entry. The bible describes no such creature, so every visual
   decision — body plan, palette, size — would be invented whole.

## What is NOT blocked

So it is on record for whoever unblocks this:

- **PART B (the rotating bounty board) is clear and buildable as written.** It
  names an *existing* creature as the target, and the day counter it asks for
  already exists and is already shared by other daily systems
  (`worldDayNum()`, `runehaven.html:8383`; used by the rare-spawn day gate at
  `:8421`, the Blood Moon at `:8520`, the Krakenling gate at `:18810`). Its one
  open choice — Spawn or Bazaar — the spec itself hands to the build ("build's
  choice, either fits"), which is a textbook YELLOW, not a blocker.
- **The movement PART A wants also already exists**, exactly as the spec's own
  opening line says: the deterministic idle-wander is leash-bound per creature
  at `runehaven.html:8090–8145`, and widening a leash is a one-number change.

The mechanics are not the problem. **The missing creature is the whole
problem.**

## How to unblock this — any one of these is enough

1. **Name the creature in the bible** (preferred). Add one row to
   `RUNEHAVEN_BIBLE.md`'s MOBS table for a Boss-tier roaming creature — a name,
   the "no fixed home" line, and its drop. With that row present, PART A
   becomes mechanical: a `MOBS` entry on the Elder Drake's hand-placed
   singleton pattern, a very large `leashRadius`, a Safe-Zone exclusion, and
   `BOSS_KIND` widened from a constant to a two-entry set.
2. **Re-scope PART A onto a creature that already exists**, stating explicitly
   in the spec which one and that the "new" and "Boss-tier" wording is
   superseded — including, if it is the Unicorn Elder, an explicit instruction
   that it now gets a boss bar, since that reverses v52+53 PART G on purpose.
3. **Split the version**: say in README that PART B ships alone as its own
   version with PART A deferred. PART B would pass the full gauntlet on its
   own; it was only held back because the spec is written as one version and
   shipping half of it is the "half-finished build" the routine forbids.

Until one of those lands, every run will stop here for the same reason, so this
needs a human edit to README.md or RUNEHAVEN_BIBLE.md before the next attempt.
