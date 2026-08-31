# BUILD FAILED — v47 (Balance, Anti-Exploit & Economy)

**Date:** 2026-08-31
**Result:** STOPPED before any edit. `runehaven.html` is **unchanged** — no patch
was applied, no harness was run against a modified file, nothing was shipped.

Two parts of the locked v47 spec do not apply to the current state of
`runehaven.html`. Both are RED under README rule 5 ("the spec doesn't clearly
apply to the current state", and "when genuinely unsure which zone something
belongs in, treat it as RED"). Neither can be resolved without a design
decision that is yours to make, not mine to guess.

**The other six parts (B, D, E, F, G, H) are fine and ready to build exactly as
written** — every "confirmed live" value in each of them was verified true. See
the last section. One decision on each of A and C unblocks the whole version.

---

## BLOCKER 1 — PART A: the spec's words and its numbers point at two different fields

PART A is titled "**pet spawn rates**" and its clarifying sentence says "this is
about ordinary **world density**". Both of those mean the `count:` field.

But every number it cites as confirmed-live is the `base:` field, and `base:` is
**not a spawn rate — it is the tame-success chance**. It is read in exactly one
place in the entire file:

```
runehaven.html:1376  function tameChanceFor(w, baited) {
runehaven.html:1380    let c = sp.base;
```

`grep -n "\.base\b" runehaven.html` returns that single line. Nothing else in
the file reads it. World density is `count:` (integers: 9 / 6 / 3 / 4), and a
"+0.08–0.10" increase is not a meaningful operation on an integer population
count.

So the two readings are:

- **Reading 1 — `base:`** — matches the cited numbers and is the only reading
  the "+0.08–0.10" arithmetic actually fits. But it means v47 raises **how easy
  every pet is to tame**, which is not "spawn rates" and not "world density".
- **Reading 2 — `count:`** — matches the part's title and its stated intent, but
  contradicts every number the spec offers as evidence, and needs a completely
  different specification (how many more of each, per tier).

These are materially different balance changes. Reading 1 is also not
harmless: with Beastmaster (+0.25) and a shrine blessing (+0.20) already
stacking on top of `base`, pushing Common to 0.75 puts most ordinary tames hard
against the 0.95 clamp in `tameChanceFor()`.

### And the spec's "Confirmed live" figures for PART A are stale

Three of the four tiers do not match the live file. They describe the file as it
was **before the "Mob Rarity + Music" version re-priced it** — the same version
the spec elsewhere correctly says "stays exactly as built".

| Tier | Spec says "confirmed live" | Actually live now | Match? |
|---|---|---|---|
| Common | `0.65` | `0.65` (all five) | ✅ |
| Uncommon | `0.35–0.50` | `0.40–0.50` (wolf/golem 0.50, boar/stag 0.45, griffin 0.42, bear 0.40) | ❌ |
| Rare | `0.20–0.30` | `0.25–0.30` (six at 0.25, phoenix 0.30) | ❌ |
| Epic | `0.20–0.35` | `0.20` flat (all four) | ❌ |

The two stale endpoints are specifically the two values Mob Rarity PART B
deliberately moved, and the file says so in its own comments:

- `runehaven.html:2282` — "Griffin sat at **0.35** while every other Uncommon
  pet ran 0.40-0.50 … it was priced as a Rare. **0.42** is an exact fit inside
  its own tier's band."
- `runehaven.html:2289` — "Shadowfox is EPIC and every one of its tier-mates is
  on 0.20 exactly … **0.35** made the bible's rarest ordinary pet easier to keep
  than a Rare dragon. **0.20** is the exact Epic baseline."

The spec's `0.35` low end for Uncommon is pre-Mob-Rarity Griffin. Its `0.35`
high end for Epic is pre-Mob-Rarity Shadowfox. So PART A was written against an
older snapshot of this table, and I cannot tell from it whether the intent was
ever `base` at all.

### What I need from you

One line, either:

- **"PART A means `base:` (tame chance)"** — then say whether the increase
  should still apply to Griffin and Shadowfox, whose current values were set
  deliberately one version ago, or whether those two hold. I would otherwise
  apply a uniform +0.10 to all four tiers, which preserves relative ordering by
  construction (Common 0.75 / Uncommon 0.50–0.60 / Rare 0.35–0.40 / Epic 0.30),
  leaving Elders and the Duskfox Elder at 0.15 untouched as specified.
- **"PART A means `count:` (world density)"** — then it needs new numbers, since
  the ones in the spec are tame chances. Per-tier multipliers or explicit target
  counts would both work.

---

## BLOCKER 2 — PART C: "Adult Golem" does not exist in the game

PART C says: *"Confirmed live: Sea Serpent `hp:130`, **Adult Golem (check live
value at build time, not assumed)**."*

I checked, as instructed. **There is no Adult Golem.** `MOBS` contains exactly
twelve entries and none of them is one:

```
elder_drake, goblin, bandit, troll, boar, bear, griffin,
phoenix, dark_wraith, sea_serpent, salamander_king, golem_elder
```

The string "Adult" appears in `runehaven.html` in exactly two places, both
comments, never as a creature (`runehaven.html:2224`, `runehaven.html:2361`).

The bible does list it (`MOBS`: "Adult Golem — Ruins — Hard — Runic stone"), and
the wild `golem` entry is the *young* one the bible describes as "found young in
ruins only, adults are hostile enemies" — so the adult form is genuinely
unbuilt, not renamed. `golem_elder` is a different creature (the Elder-tier
singleton, hp 420) and is not it.

### Why I did not just build one

Creating it is not a balance change — it is a new mob: ten unspecified stats
(`hp`, `dmg`, `atkRange`, `atkCooldownMs`, `windupMs`, `aggroRadius`,
`leashRadius`, `moveSpeed`, `count`, `loot`), a spawn placement rule, a
`MOB_K` / `MOB_TALL` entry, an art route, and `run5` coverage. A version whose
scope is "increase this creature's health by ~25%" is the wrong place to
introduce a creature, and the spec gave no numbers to introduce it with.

### Why I did not just skip it and ship Sea Serpent alone

PART C's own proof gate is *"confirm Troll/Dark Wraith are genuinely easier
while **Sea Serpent/Adult Golem** are genuinely harder — not the same creatures
moving both directions."* Half of that gate cannot pass. PART C is also the
counterweight that stops PART B from being a flat difficulty reduction, and
Sea Serpent alone (one creature, living only inside cave interiors) is a
noticeably smaller counterweight than the spec intends.

### What I need from you

One line, either:

- **"Sea Serpent only for PART C"** — I ship `hp:130 → 165` and nothing else,
  and PART C's proof gate drops its Adult Golem half.
- **"Also raise <named live creature> by ~25%"** — the live candidates that are
  tougher, are not Troll or Dark Wraith, and are not cave-interior mobs, are:
  Elder Drake (hp 900, boss), Golem Elder (hp 420, Elder singleton),
  Bear (80), Phoenix (75), Griffin (70).
- **"Build the Adult Golem properly"** — then it is its own version with its own
  spec, not a line item inside v47's PART C.

---

## Everything else in v47 is verified and ready

I checked every other "confirmed live" claim in the spec against the file before
stopping. All of them are true. These need no decision from you — they are
blocked only because A and C are:

- **PART B** ✅ Troll `hp:90, dmg:14` (`runehaven.html:2159`), Dark Wraith
  `hp:65, dmg:12` (`runehaven.html:2182`), and both really are placed inside
  cave interiors (`runehaven.html:3228`, `mkInteriorMob`). Targets 68/11 and
  49/9 are a clean edit.
- **PART C (Sea Serpent half)** ✅ `hp:130` at `runehaven.html:2197`.
- **PART D** ✅ `BASE_TIER_HP = { wood:40, stone:90, iron:180, runic:350,
  dragonsteel:800 }` at `runehaven.html:7038`, exactly as the spec states. The
  "harder to penetrate" half is checkable: a swing deals the equipped weapon's
  own `dmg` on that weapon's own `cd` (`runehaven.html:6340` →
  `baseHit()` at `runehaven.html:7135`), with no other scaling in the path, so
  doubled HP does translate to doubled hits and doubled real time. That is
  provable with the math, as the spec asks.
- **PART E** ✅ `beforeunload` really does only call `savePlayer()` and nothing
  else (`runehaven.html:6194`). The three sites that already stamp combat exist
  (`runehaven.html:6297`, `6597`, `8228`), though `COMBAT_MUSIC_LINGER` is 6s,
  so the 30s window needs its own timestamp rather than reusing
  `combatMusicUntil`.
- **PART F** ✅ Every mechanism it names exists: `GATHER_RANGE`
  (`runehaven.html:716`), `invAdd` (`runehaven.html:6199`), `invRemove`,
  `doInteract()` (`runehaven.html:6801`), and the single broadcast channel.
- **PART G** ✅ The player name/level tag is one reusable call site
  (`runehaven.html:11939`, ``const label = `${name}  Lv ${p.level || 1}` ``),
  and Foundation pieces persist through `base_pieces`
  (`runehaven.html:7204`/`7301`). A `sign` column would follow the same
  degrade-gracefully discipline v34's `hp` and `last_collected` already use.
- **PART H** ✅ The login screen and its ENTER button are where the spec expects
  (`runehaven.html:476`, `runehaven.html:4960`), and the codebase's
  missing-table fallback pattern is well established.

---

## Process note

No harness was run, because nothing was changed — `run3` / `run4` / `run5`
against an unmodified file would only re-confirm the last shipped version. The
gate was never reached. `NEXT_BUILD.md` has not been touched and still points at
v47.

**Next session:** if this file still exists, the job is only to fix what it
describes — the two decisions above — and then build v47 in full.
