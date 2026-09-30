# BUILD_FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-09-30
**Spec attempted:** `README.md:731` — "Confirmed, locked spec for a future
version (World Encounters — Roaming Boss & Bounty Board)", as pointed at by
`NEXT_BUILD.md`.
**Outcome:** STOPPED before any patch. `runehaven.html` is **unchanged** —
verified clean, nothing was edited, no test gate was run because nothing was
built.
**Classification:** RED, under `README.md:60` — *"The spec would require
inventing bible content — a pet, mob, biome, location, or lore element not in
the bible. This is a creative integrity rule, not a bug-severity one, and
severity never overrides it."*

---

## The single thing that blocks this build

**PART A requires a Boss-tier creature that does not exist in the bible, and
the spec never names it.**

PART A asks for "a new, additional Boss-tier creature with no fixed home",
explicitly "separate from the Elder Drake". Checked against the bible
directly:

- `RUNEHAVEN_BIBLE.md:123-132` — the `## MOBS` section is a closed,
  enumerated list of **eight** creatures. Exactly **one** is Boss tier:
  `Elder Drake — Volcano, World Boss — Boss tier — Dragonsteel, legendary
  loot`. There is no second boss, and no roaming creature of any tier.
- The file already says this out loud. `runehaven.html:2907` comments the
  Elder Drake as *"the bible's only boss-tier creature"*, and
  `runehaven.html:19304` hard-codes `const BOSS_KIND = "elder_drake"`.
- Every mob kind currently in `MOBS` (`elder_drake`, `goblin`, `bandit`,
  `troll`, `boar`, `bear`, `griffin`, `phoenix`, `dark_wraith`,
  `sea_serpent`, `adult_golem`, `demon_knight`, `basilisk`,
  `salamander_king`, `golem_elder`) maps to a bible-named creature. **No
  non-canon mob has ever been added to this project.**

So building PART A means inventing, from nothing: a name, a species, an
appearance to render, and its place in the world's lore. The spec does not
supply any of them. That is not a tunable — it is the creative decision the
rule reserves for you.

### Why I did not just mark it non-canon and ship

`README.md:48-49` does allow adding content "explicitly marking it
non-canon", and there is real precedent for that — `divers_charm` (v21),
`void_shard` (v32), `raw_meat` (v58). But every one of those is an **item**,
and the v58 changelog entry (`runehaven-art-style/SKILL.md:361-365`) makes
the boundary explicit about what it deliberately would not do:

> "**No new mob, no new biome, no new gatherable node and no bible content
> was invented** — two items were added and both are flagged non-canon in
> the file"

v58 went out of its way to route around adding a mob. A brand-new Boss-tier
creature is several orders of magnitude past a flagged loot line: it is a
named world landmark-scale entity that every player will see, chase and talk
about. Per `README.md:104-107` — *"When genuinely unsure which zone
something belongs in: treat it as RED"* — that is where this lands.

### The knock-on bible conflict, which is not just a naming gap

A Boss-tier creature forces a loot decision that collides with a closed
bible list. `RUNEHAVEN_BIBLE.md:115-120` states dragonsteel is **"Only
obtained by"** four specific things:

1. Killing an adult wild dragon in the world
2. Killing a Demon Knight in a dungeon
3. Defeating the Elder Drake world boss at the volcano
4. Killing another player's tamed dragon

The bible's only other Boss/Very-Hard creatures (Elder Drake, Demon Knight)
both drop dragonsteel. So a new roaming boss either **drops dragonsteel and
breaks that closed list**, or **doesn't and isn't really boss tier**. Either
way it is your call, not mine.

---

## One decision unblocks this, and there is a canon-grounded candidate

If you want the fastest path: the closest thing the bible already contains is
**an adult wild dragon**. `RUNEHAVEN_BIBLE.md:117` names it as a real world
creature, it already drops dragonsteel legitimately (so the closed list above
stays intact), it is not currently implemented as a mob at all (confirmed: no
`adult_dragon` anywhere in `runehaven.html`), and there is exact precedent for
promoting an adult form into a hostile mob — `Adult Golem` exists purely from
the bible's "adults are hostile enemies" line.

**The one thing that still needs you:** the bible pins each dragon species to
a territory (Shattered Peaks = Storm Dragon, Abyssal Hollow = Shadow Dragon,
lava caves = Fire Dragon, underwater caves = Water Dragon). PART A wants "no
fixed home ... moving slowly across biome boundaries", which contradicts
those territory lines. I will not overrule the bible on my own.

A single sentence from you resolves it, e.g. *"use an Adult Storm Dragon,
roaming is fine, it leaves the Peaks"* — or name a different creature
outright. With that, this build is straightforward.

---

## Everything else in the spec is already verified ready

To be clear that only PART A is blocked, I confirmed the rest live before
stopping:

- **PART A's stated premise holds.** Deterministic leash-bound idle wander
  exists exactly as the spec says (`leashRadius` on every mob def,
  `runehaven.html:2565`), so the wander extension really is an extension of
  proven logic, not new movement code.
- **The boss bar and Elder-tier music cue exist and are reusable** — though
  note `BOSS_KIND` (`runehaven.html:19304`) is a single string, not a set, so
  it needs generalising to carry two bosses. That is ordinary mechanical work,
  **not** a blocker.
- **The Safe-Zone proof gate is trivially satisfiable** — `inSafeZone(x, y)`
  already exists and is already used for exactly this kind of exclusion
  (`runehaven.html:8549`).
- **PART B (the rotating bounty board) is fully buildable today and is not
  blocked by anything.** It needs no invented content: it names *"one
  existing creature"*, and the day counter it asks to reuse is
  `worldDayNum()` (`runehaven.html:8383`), already shared by the Krakenling
  gate and the rare-node restock. Spawn and the Bazaar both exist as safe
  hubs, and existing loot/reward patterns cover the bonus.

**PART B was deliberately not shipped on its own.** `README.md:69-71`
requires a RED to leave `runehaven.html` untouched, so shipping half the spec
would violate the process. It is ready to go in the same build the moment
PART A's creature is named.

---

## What the next session should do

1. Read this file and the answer to the question above.
2. If the creature is named: build PART A **and** PART B together as one
   version, full standard process, then delete this file.
3. If it is still unnamed: **do not guess.** Stop again and say so here.

`NEXT_BUILD.md` was not edited, per the standing rule.
