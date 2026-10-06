# BUILD FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-10-06
**Target:** the spec `NEXT_BUILD.md` points at — README.md line 731,
"Confirmed, locked spec for a future version (World Encounters — Roaming
Boss & Bounty Board)".
**Status:** STOPPED before any code change. `runehaven.html` is
**unchanged** — not one byte — exactly as README step 5 requires for a RED
condition. No harness was run, because nothing was patched.

---

## The one thing blocking this build

**PART A requires inventing a creature the bible does not contain, and
simultaneously forbids the only creature that would satisfy it.**

PART A, quoted in full from the point that blocks:

> The Elder Drake stays exactly fixed at the Volcano, per the bible — this
> is **a new, additional Boss-tier creature** with no fixed home [...]

The bible names **exactly one** Boss-tier creature, on
`RUNEHAVEN_BIBLE.md` line 132, in the MOBS table:

```
Elder Drake — Volcano, World Boss — Boss tier — Dragonsteel, legendary loot
```

That is the complete list. There is no second Boss-tier entry anywhere in
the bible, and PART A's own first clause rules that one out by pinning it
to the Volcano.

So "a new, additional Boss-tier creature" cannot be sourced from the bible.
Building it means I choose its **name**, its **species/appearance**, and
its **place in the world's lore** — three things README step 3 lists as
bible-only ("Pets, mobs, biomes, lore, and events must come from the
bible"), and which README step 5 names verbatim as RED:

> **RED — always STOP, no exceptions, regardless of how small it looks:**
> [...] The spec would require inventing bible content — a pet, mob, biome,
> location, or lore element not in the bible. This is a creative integrity
> rule, not a bug-severity one, and severity never overrides it.

This is not a severity judgment or a tunable. HP, damage, wander speed and
loot would all be ordinary designed tunables and are not the problem — the
**creature itself** is.

### Why the "mark it non-canon" carve-out was not used

README step 3 ends with "never add a pet/mob/location the bible doesn't
list **without explicitly marking it non-canon**", which reads as a licence
to add one if it's labelled. README step 5 then lists inventing a mob as
flat RED with no carve-out. **These two rules genuinely conflict for this
spec**, and step 5 closes with the tiebreaker:

> **When genuinely unsure which zone something belongs in: treat it as
> RED.** A missed YELLOW just means an unnecessary night lost, which is
> recoverable. A wrongly-shipped RED is a broken or invented build in a
> real player's hands, which is not.

Two further facts pushed this the same way:

1. **There is no precedent for a non-canon creature in this project.** I
   checked every entry in `MOBS` (`runehaven.html` lines 2906–3178) and
   every creature name in the file. All fifteen — Elder Drake, Goblin,
   Bandit, Troll, Boar, Bear, Griffin, Phoenix, Dark Wraith, Sea Serpent,
   Adult Golem, Demon Knight, Basilisk, Salamander King, Golem Elder —
   are bible creatures. The only things ever flagged non-canon in this
   codebase are **items**: `divers_charm` (v21), `void_shard` (v32),
   `raw_meat`/`cooked_meat` (v58). Never a creature.
2. **v58 explicitly refused to do this.** Its own changelog entry
   (`runehaven-art-style/SKILL.md` line ~362) states the standard it held
   itself to: *"**No new mob, no new biome, no new gatherable node and no
   bible content was invented**"* — it added two loot items instead. PART A
   cannot be satisfied that way; a roaming boss has to be a creature.

A new Boss-tier mob is also not a quiet addition. It would be the second
world boss in a world the bible builds around having one, and the first
non-canon creature ever to enter the game.

---

## What is NOT blocked (verified present, so no one re-derives this)

I verified every system both parts lean on **before** stopping. The spec's
claims about existing infrastructure are all accurate, and PART B is
clean:

| Needed by | System | Verified at |
|---|---|---|
| A, B | Deterministic leash-bound idle wander | `runehaven.html:8140–8150` (amplitude scales off each creature's own `leashRadius`) |
| A | Boss bar UI | `runehaven.html:645` (`#hudBoss`), styling at 562–580 |
| A | Elder-tier music cue | `runehaven.html:19263` (`ELDER_MUSIC_URL`), triggered by `noteBossCombat()` at 19307 |
| A | Safe-zone test, for "never enters a Safe Zone" | `runehaven.html:9359` (`inSafeZone`) |
| B | Shared day counter other daily systems use | `runehaven.html:8383` (`worldDayNum()`) — already drives the Krakenling gate and the daily rare-spawn restock at 8449 |
| B | Safe hub to host the board | `BAZAAR` at `runehaven.html:1790`, confirmed inside a safe zone (`bazaarIsSafe`, line 2463) |
| B | Existing loot/reward patterns to reuse | every `loot:` table in `MOBS`, 2906–3178 |

**PART B — the rotating bounty board — has no blocker of any kind.** It
names an *existing* creature as the bounty, so it invents nothing. Every
piece it needs exists. I did not build it alone, because README step 5 says
for a RED case "leave `runehaven.html` unchanged", and `ROUTINE_PROMPT.txt`
forbids shipping "a broken or half-finished build". **Shipping half a
locked spec is your call to make, not mine** — see option 3 below.

---

## What I need from you to unblock this (please pick one)

I am deliberately **not** choosing between these. Each is a creative
decision about the world, which is yours.

1. **Name the creature in the bible.** Add a second Boss-tier line to the
   MOBS table in `RUNEHAVEN_BIBLE.md` — name, where it roams, what it
   drops. One line is enough; it makes PART A fully canon and I can build
   both parts as written. *(Cleanest option.)*
2. **Re-scope PART A onto something already canon.** Edit the README spec
   to point the roaming behaviour at a creature the bible already has. The
   closest canon fit is the **Unicorn Elder** — the bible already says it
   *"Spawns randomly anywhere in the world, no pattern or hint"*, which is
   genuinely the roaming-encounter idea. It is **not** Boss-tier, though,
   so PART A's boss framing (and its boss-bar/Elder-music reuse) would need
   rewording to match. There is precedent for this kind of correction:
   commit `684d342` revised the Matched-Tier Gear Bonus spec "to fit the
   real single-armor-slot structure".
3. **Explicitly authorise a non-canon creature**, invoking README step 3's
   carve-out over step 5's RED. If you want this, please say so in the
   README spec itself and give me at minimum its **name** — I will flag it
   non-canon in the file the way `void_shard` is, and design the stats as
   tunables. I will not pick the name myself.
4. **Split the spec.** Authorise PART B (bounty board) to ship on its own
   as its own version, leaving PART A queued until 1–3 is resolved. PART B
   is ready to build tonight on the evidence above.

While you're deciding: the conflict between README step 3's non-canon
carve-out and step 5's RED list is worth resolving in the README too,
since it will block the next creature-shaped spec the same way.

---

## Housekeeping

- `runehaven.html` — untouched.
- `runehaven-art-style/SKILL.md` — untouched (no changelog entry; nothing
  shipped).
- `NEXT_BUILD.md` — untouched, as instructed. It still points at World
  Encounters, so the next run will pick this spec up again the moment this
  file is cleared.
- No harness was run and no version number was claimed.
