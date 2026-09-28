# BUILD FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-09-28
**Target:** `NEXT_BUILD.md` → README.md line 731, "Confirmed, locked spec for a
future version (World Encounters — Roaming Boss & Bounty Board)"
**Outcome:** STOPPED before any patch. `runehaven.html` is **unchanged** — no
partial build, no half-shipped PART B, nothing to revert.
**Classification:** RED, under the standard process rule 5, first bullet of the
RED list: *"The spec would require inventing bible content — a pet, mob, biome,
location, or lore element not in the bible."*

---

## What blocks it: PART A has no creature to be about

PART A asks for:

> "a new, additional Boss-tier creature with no fixed home"

The bible's `## MOBS` table lists eight creatures and exactly **one** at Boss
tier:

```
Elder Drake — Volcano, World Boss — Boss tier — Dragonsteel, legendary loot
```

The spec then rules that one out itself: *"The Elder Drake stays exactly fixed
at the Volcano, per the bible."* So PART A cannot be built from anything the
bible names — it requires minting a **new named mob**: a name, its lore, its
sprite, its stat block, and its place in the world's fiction. That is bible
content, and inventing it is the RED case verbatim.

`runehaven.html` already states the same fact in its own code, at line 2907,
written when the Elder Drake was added in v30:

```js
/* v30: the bible's only boss-tier creature. count:1 because it is a named
   world boss, not a spawned population ... */
```

### There is no bible-legal substitute — all four candidates checked

| Candidate | Why it can't be PART A's boss |
|---|---|
| **Elder Drake** | Excluded by the spec's own sentence; bible pins it to the Volcano |
| **Unicorn Elder** | Does roam ("spawns randomly anywhere in the world"), but the bible lists it as an **Elder-tier tameable pet**, not a Boss-tier mob. It is already implemented that way (`WILD_SPECIES.unicorn_elder`, `hp: 90`, tameable, grants fast travel + luck buff). Reclassifying it as a world boss would contradict the bible and the spec's own "Boss-tier creature" wording |
| **Demon Knight** | Bible tier "Very Hard", not Boss; bible pins it to deep dungeons |
| **Golem Elder / Sea Serpent / Adult Golem** | None is Boss tier; each is bible-pinned to deepest ruins / underwater / ruins respectively |

This is not a severity judgement or a tunable I could pick a reasonable value
for. Rule 5 is explicit that the creative-integrity rule is *"not a bug-severity
one, and severity never overrides it."*

### Why this isn't the "flag it non-canon" path either

Rule 3 permits a non-canon addition *marked as such*, and the project has used
that door before — but only ever for **items**: `divers_charm` (v21),
`void_shard` (v32), `raw_meat` (v58). The v58 changelog entry in `SKILL.md`
states the line the project has held to, in its own words:

> "**No new mob, no new biome, no new gatherable node and no bible content was
> invented** — two items were added and both are flagged non-canon in the file"

A boss-tier creature is a mob, on the far side of that line — and a named world
boss is the single most lore-visible thing in the game. Per rule 5's closing
instruction (*"When genuinely unsure which zone something belongs in: treat it
as RED"*), it stops.

---

## What is NOT blocked — everything else the spec assumes is real

Verified directly against the current file, so none of this needs re-checking
next run:

- **Idle-wander / leash logic** — exists as the spec says, `leashRadius` on
  every creature in `MOBS`.
- **Boss bar** — exists: `#bossBarWrap` / `#bossBar` (markup line 647, styles
  line 215, driver line 19352), added in v52+53 PART G. Reusable as-is.
- **Elder-tier music cue** — exists: `ELDER_MUSIC_URL = "audio/tension.mp3"`
  (line 19263), with `elderMusicUntil` gating at line 12381. Reusable as-is.
- **Shared day counter for PART B** — exists: `worldDayNum()` (line 8383),
  already shared by the Krakenling 10-day window, the Blood Moon cycle
  (`BLOOD_MOON_EVERY`) and the rare-stock day reset. Exactly the "same
  day-counter other daily systems already use" the spec asks for.
- **Safe-zone geometry for PART B's interaction point** — exists: `BAZAAR`,
  `BAZAAR_R`, `OTHER_SAFE_ZONES`, plus the Spawn safe zone.
- **Loot / reward patterns to reuse** — exist: per-mob `loot` tables with
  `{type, qty, chance}`, and `rollCosmeticDrop()`.

**PART B (the rotating bounty board) is buildable today, on its own, with zero
invented content** — it names *existing* creatures as bounty targets, which is
the opposite of the PART A problem.

It was not built tonight because the spec is one locked version covering both
parts, and shipping half of it is the "half-finished build" the routine prompt
forbids. That is a deliberate choice, not an oversight — say the word and PART B
alone is a clean night's work.

---

## Baseline health — the tree is fine, the stop is purely spec-side

Run against the untouched `runehaven.html` so it's on record that nothing is
broken here:

- `node debug/run3.js runehaven.html` → **`CAUGHT ERROR: none`** ✅
- `node debug/run4.js runehaven.html` → **1718 `PASS` lines, zero `FAIL`** ✅
- `node debug/run5.js runehaven.html` → **`coverage draws: 1361 — CAUGHT: none`** ✅

---

## What would unblock this — your call, not mine

Any **one** of these turns it green. I am deliberately not picking:

1. **Name the creature in the bible.** Add the roaming Boss-tier mob to
   `RUNEHAVEN_BIBLE.md`'s `## MOBS` table (name, home-less roaming behaviour,
   loot tier). One line there and PART A is fully specified — the wander logic,
   boss bar and music cue are all already waiting for it.
2. **Split the spec.** Amend the README spec to "PART B only" and I'll ship the
   bounty board on the next run with no bible change at all.
3. **Point PART A at something that already exists**, if the intent was always
   an existing creature rather than a new one — but note that the only roaming
   candidate, the Unicorn Elder, is a tameable pet in the bible and reworking it
   into a world boss is itself a bible change, so this still needs your sign-off
   in writing.

Whichever you choose, the fix lives in `README.md` / `RUNEHAVEN_BIBLE.md`.
`NEXT_BUILD.md` was not touched, per the standing rule that builds never edit it.

## Not the blockers, for the record

These were all reachable as normal YELLOW tunables and would have shipped with a
flagged note if PART A had a creature to attach them to: the roaming boss's wander
speed, its effective unleashed radius, the safe-zone exclusion margin, the bounty's
bonus-reward size, and whether the board sits at Spawn or the Bazaar (the spec
leaves that to the build's choice, and both fit).
