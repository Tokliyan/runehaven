# BUILD FAILED — 2026-10-11 (World Encounters — Roaming Boss & Bounty Board)

`runehaven.html` is **unchanged**. No patch was applied, no test was run against a
modified file, nothing was shipped. This is a RED stop under step 5 of the README's
standard process, and it needs **one creative decision from you**, not a code fix.

## What I was told to build

`NEXT_BUILD.md` says, verbatim:

> Build exactly per "Confirmed, locked spec for a future version — World Encounters —
> Roaming Boss & Bounty Board" in README.md.

That resolves to README.md line 731. I followed NEXT_BUILD.md as the sole authority on
what to build and did not edit it.

## What I did before stopping

- Read `runehaven-art-style/SKILL.md` **in full** (all 4,164 lines), per step 1.
- Read `RUNEHAVEN_BIBLE.md` in full.
- Read the whole locked spec and verified every claim it makes about the current file.
- Inspected `runehaven.html` for each system the spec says it reuses.

**Every premise the spec asserts about the existing file is true.** The spec is well
written and its reuse plan is sound. Confirmed live:

| Spec claims it reuses | Present in the file | Where |
| --- | --- | --- |
| Deterministic idle-wander, leash-bound to `leashRadius` | yes | `runehaven.html:8125`–`8149` (v30 patrol cycle keyed off `m.ph`) |
| Existing boss bar | yes | `#hudBoss` / `#bossBar`, markup `runehaven.html:645`–`647`, driven at `19340`–`19400` |
| Elder-tier music cue | yes | `ELDER_MUSIC_URL` + `elderMusicUntil`, `runehaven.html:12381`–`12391`, `19265`–`19279` |
| The day-counter other daily systems use | yes | `worldDayNum()` at `runehaven.html:8383`, 12 call sites |
| A Safe Zone predicate for the "never enters a Safe Zone" gate | yes | `inSafeZone()` at `runehaven.html:9359` |
| Existing loot/reward patterns, no new currency | yes | per-mob `loot: [{type, qty, chance}]` throughout `MOBS` |

`grep -c -i roaming` and `grep -c -i bounty` both return **0** — none of this is
half-built, so there is no partial state to reconcile.

## THE BLOCKER — PART A requires a creature the bible does not contain

PART A asks for, in its own words:

> this is **a new, additional Boss-tier creature** with no fixed home

The bible has exactly one Boss-tier creature, and it is the one PART A explicitly
excludes:

- `RUNEHAVEN_BIBLE.md:132` — `Elder Drake — Volcano, World Boss — Boss tier —
  Dragonsteel, legendary loot`. That is the **only** occurrence of "Boss tier" in the
  bible; the only other two mentions (`:31`, `:119`) are the same creature at the same
  fixed Volcano.
- The file already knows this. `runehaven.html:2906` opens the `MOBS` table with
  `the bible's only boss-tier creature` and `count:1` for `elder_drake`.
- PART A opens by ruling that creature out: *"The Elder Drake stays exactly fixed at the
  Volcano, per the bible."*

There is also no bible creature of **any** tier that could supply "no fixed home". Every
row of the bible's MOBS table and every row of its pet rarity table names a home biome.
The one bible line that reads like roaming — `Unicorn Elder — Spawns randomly anywhere in
the world, no pattern or hint` — is an Elder-tier **tameable pet**, is not Boss-tier, and
already ships as a single worldgen tile.

So building PART A means inventing a mob: its name, its identity, its lore, its loot, its
art. That is the RED clause in step 5 word for word:

> The spec would require inventing bible content — a pet, mob, biome, location, or lore
> element not in the bible. **This is a creative integrity rule, not a bug-severity one,
> and severity never overrides it.**

This is not a close call, and the project has answered it this way before. v32 declined
to invent a hostile for the Abyssal Hollow on exactly these grounds ("the bible names
none for the Hollow, so inventing one was declined"). Conversely, the Demon Knight (v48)
and the Basilisk (Dungeons PART D) were both built *because* the bible names them — their
in-file comments both open by quoting the bible row verbatim. A roaming world boss has no
such row to quote.

## Why PART B was not shipped on its own

PART B (the rotating bounty board) is genuinely buildable. It names only creatures that
already exist, it reuses `worldDayNum()` and existing loot, and the spec's "no new
currency" instruction keeps it inside the bible's `no currency system` rule. Its only open
questions are ordinary YELLOW tunables (Spawn vs Bazaar, which creature pool is eligible,
the size of the bonus, the board's own art).

It is not shipped because step 5 is explicit for a RED case: *"leave `runehaven.html`
unchanged."* Shipping half a locked spec on my own initiative would also be deciding what
to build, which tonight's instructions forbid. **If you want PART B alone, that is one
line in the spec or in NEXT_BUILD.md and the next run will ship it unblocked.**

## What unblocks this — pick one

1. **Split the spec.** Mark PART A deferred and let PART B ship by itself. Cheapest
   option; nothing else in the spec depends on PART A.
2. **Authorise a non-canon boss and give it an identity.** Say so explicitly in the spec
   and supply at minimum its **name**; the build can then flag it non-canon in the file
   exactly as `divers_charm` (v21) and `void_shard` (v32) are flagged, and design hp/dmg/
   loot/wander numbers as marked TUNABLEs around the Elder Drake's 900/28. Without a
   name from you, there is nothing to flag — the name *is* the invented content.
3. **Make it canon.** Add the creature to `RUNEHAVEN_BIBLE.md` (a MOBS row in the same
   shape as the others is enough), and PART A stops being an invention at all.
4. **Re-point PART A at a bible creature** and state which, accepting that it will
   contradict that creature's bible home and tier — the Demon Knight is the closest
   candidate (it is already stationed outside its bible home as a named, documented
   exception at `runehaven.html:3073`), but it is "Very Hard", not Boss tier.

One question that may already answer this: **`audio/` contains `roaming_pop.mp3`,
`roaming_siren.mp3`, `roaming_song.mp3` and `boss_tension.mp3`.** The "roaming" prefix
looks deliberate and predates this spec. SKILL.md records them as byte-identical
duplicates of `Pop.mp3` / `siren.mp3` / `song.mp3` / `tension.mp3` referenced nowhere in
the game, so I have treated them as unwired aliases and not as evidence of intent. If
they were named for this feature, the creature you had in mind may already have a name.

## For the next run

The blocker above **cannot be resolved by a code change** — it is a creative decision
that belongs to the project owner. If this file is still here and the spec has not been
amended, do not invent a fix and do not guess a creature: per tonight's own instructions,
update this file with what is still blocking and stop.
