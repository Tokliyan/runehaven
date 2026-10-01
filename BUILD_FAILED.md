# BUILD FAILED — 2026-10-01 — World Encounters (Roaming Boss & Bounty Board)

`NEXT_BUILD.md` points at README.md:731, **"Confirmed, locked spec for a
future version (World Encounters — Roaming Boss & Bounty Board)"**. The build
stopped before `runehaven.html` was touched. **`runehaven.html` is byte-for-byte
unchanged, and so is every other file except this one.**

The stop is a **RED** under the README's own step 5, bullet 3:

> The spec would require inventing bible content — a pet, mob, biome,
> location, or lore element not in the bible. This is a creative integrity
> rule, not a bug-severity one, and severity never overrides it.

---

## THE BLOCKER — PART A asks for a second Boss-tier creature, and the bible has only one

PART A, verbatim:

> **PART A — a roaming world boss, separate from the Elder Drake.** The
> Elder Drake stays exactly fixed at the Volcano, per the bible — this is
> **a new, additional Boss-tier creature with no fixed home** […]

`RUNEHAVEN_BIBLE.md`'s `## MOBS` section lists eight creatures and exactly
one at Boss tier:

```
Goblin        — Forests, plains        — Easy
Bandit        — Plains, ruins          — Easy
Troll         — Mountains              — Medium
Dark Wraith   — Dark forest, dungeons  — Medium
Adult Golem   — Ruins                  — Hard
Sea Serpent   — Underwater             — Hard
Demon Knight  — Deep dungeons          — Very Hard
Elder Drake   — Volcano, World Boss    — Boss tier
```

The spec rules the Elder Drake out by name in its own first sentence. So the
creature PART A asks for is **a mob the bible does not contain**, and there is
no unbuilt bible creature left to be it. Checked directly rather than assumed:

- **All eight bible mobs are already implemented.** `MOBS` holds 15 keys —
  the eight above plus the four pets stored there (`boar`, `bear`, `griffin`,
  `phoenix`), `golem_elder`, `salamander_king` and `basilisk`.
- **Every pet in the bible's full rarity table is already implemented.**
  `WILD_SPECIES` holds 27 keys, covering all four sprites, `glow_moth`, the
  six Uncommon, all eight Rare (`basilisk` included, shipped by the Dungeons
  build), all four Epic, `duskfox_elder` and all three Elders.
- **The file itself states the position twice, in its own words**, which is
  why this is not a reading I arrived at alone:
  - `runehaven.html:2907` — *"v30: the bible's only boss-tier creature."*
  - `runehaven.html:19302` — *"The drake is the only thing in the world the
    bible calls boss-tier, and this is its bar."*

### Why this is not a YELLOW tunable

The spec names no species, no silhouette, no stats, no loot, no home biome
and no tier relationship to the drake for this creature — it describes only
its *behaviour* (unleashed, slow, cross-biome, always really there). Building
it would mean inventing, as interdependent decisions and not as tunables:

1. **What the creature is** — its identity, name and art. This is the
   never-invent rule squarely: a mob, not a cooldown.
2. **Where it sits against the Elder Drake** — the drake is 900 hp / 28 dmg
   and the game's documented ceiling. A second Boss-tier creature either
   matches it, undercuts it, or exceeds it, and each answer changes what
   "Boss tier" means in this game.
3. **What it drops** — the bible's dragonsteel list is closed and explicit
   (adult wild dragon, Demon Knight, Elder Drake, another player's tamed
   dragon). A new boss either joins that list, which contradicts a closed
   bible list, or is a Boss-tier fight paying less than a Very Hard one.

That is also the shape of step 5's fourth RED bullet — three genuinely
unspecified, interdependent decisions with real gameplay consequences, where
any guess is a design decision rather than a tunable.

### The one near-miss I considered and rejected

The bible's dragonsteel section names **"an adult wild dragon in the world"**,
and that is genuinely unbuilt — the Mob Rarity changelog entry already flags
it ("There is no wild dragon mob … and no kill path for a companion at all").
It is the only bible-adjacent candidate for a roaming boss, and I did not take
it, for two reasons:

- The bible gives adult wild dragons **no tier, no stats, no home and no
  roaming behaviour** — they appear only as a dragonsteel source. Calling one
  "Boss tier" and sending it wandering is my decision, not the bible's.
- **The spec does not ask for it.** It asks for "a new, additional Boss-tier
  creature", and choosing which creature that is would be deciding what to
  build. That is exactly what this run is instructed never to do.

**If the adult wild dragon IS what was meant, this is a one-line answer and
the build is otherwise ready to go** — see below.

---

## Everything else in the spec checks out — the infrastructure premises are all true

Verified directly against the current file, so none of this needs re-checking
next time:

| Spec claim | Status |
|---|---|
| "deterministic idle-wander logic already exists, leash-bound to each creature's own `leashRadius`" | **True.** 22 `leashRadius` sites; the v30 patrol cycle keyed off `m.ph` is present and intact. |
| "Reuses the existing boss-bar … from prior versions" | **Present.** `#hudBoss` / `#bossBarWrap`, markup at `runehaven.html:645`. ⚠️ It is hard-scoped by `const BOSS_KIND = "elder_drake"` with a documented deliberate reason (it must not match the three Elder *pets*). Widening it to a second boss is a small, real change — a constant becoming a set — not a rebuild. |
| "and Elder-tier music cue" | **Present.** `ELDER_MUSIC_URL` + `combatTrackUrl`, the switch at `runehaven.html:12384`. |
| PART B "tied to the same day-counter other daily systems already use" | **True.** `worldDayNum()` at `runehaven.html:8383`, already shared by the rare-takes daily cap, the Blood Moon and the Krakenling window. |
| PART B "reuse existing loot/reward patterns rather than a new currency" | **True.** Every `MOBS[*].loot` row is `{type, qty, chance}`; no currency exists to avoid. |
| PART B "a new interaction point at Spawn or the Bazaar" | **Both hubs exist.** Spawn already carries the Forge, Shrine, Oracle and Tutorial props; the Grand Bazaar is a real safe zone with nine stalls. |
| "confirm it never enters a Safe Zone" | **Checkable today.** `inSafeZone()` at `runehaven.html:9359`, `inColosseum()` at `9377`. |

No `roaming` or `bounty` identifier exists anywhere in `runehaven.html`
(0 occurrences), so nothing was half-built by a previous run and there is no
partial state to clean up.

Baseline harness state, for the record — the repo is healthy and this stop is
a spec problem, not a broken build: **`run3` clean (`CAUGHT ERROR: none`)**
and **`run4` clean, zero `FAIL` lines**, both run against the untouched
`runehaven.html`. `run5` was not run, because no patch was applied and the
shipping gate was never the thing in question.

---

## WHAT WOULD UNBLOCK THIS — one decision, and it is yours, not a build's

**Name the creature.** That is the whole blocker. Everything PART A asks for
behaviourally is buildable on existing machinery once it has an identity.
Any one of these resolves it:

1. **"The roaming boss is the adult wild dragon"** — the bible already names
   it as a dragonsteel source, which settles the loot question (item 3 above)
   straight out of the bible, and the four existing `dragonV2` palettes mean
   it needs no new art. If you want this, say which palette(s) and whether it
   outranks or sits under the drake's 900/28, and the rest is a normal build.
2. **Name a new creature explicitly and mark it non-canon**, the way
   `void_shard` (v32) and `divers_charm` (v21) are flagged in the file. The
   never-invent rule stops a build inventing a mob on its own; it does not
   stop you adding one deliberately. A name, a rough size and a line about
   what it looks like is enough.
3. **Re-scope PART A onto an existing creature** — e.g. make it an
   explicitly-marked bible deviation that one existing Boss/Very Hard
   creature roams. Please mark it as a deviation in the spec text if so, the
   way v51 PART I marked its own; v51 PART E's unmarked deviation is the
   precedent worth not repeating.

## PART B is independently buildable, and I deliberately did not ship it alone

**PART B — the rotating bounty board — has no dependency on PART A.** It
names "one existing creature as today's bounty", and every mechanism it needs
is confirmed present in the table above. It could ship on its own in a night.

I did not ship it, because splitting a locked two-part spec is a scoping
decision that belongs to you, and this run is instructed to build exactly
what `NEXT_BUILD.md` points at and nothing else. **If you want PART B alone,
say so and it goes in as a complete version** — the spec text does not need
rewriting for that, only a line in `NEXT_BUILD.md`.

One secondary question to rule on while you are deciding, flagged rather than
answered: **a "bounty board" is not in the bible's `## LANDMARK STRUCTURES`
list either.** I read it as a prop and a mechanic rather than a *location* —
the same category the Diver's Charm was placed in when v21 flagged it — so I
do not think it is RED on its own. But it is adjacent enough that it is worth
one word from you rather than a build's assumption.

---

## Minor housekeeping observation (no action taken)

`ROUTINE_PROMPT.txt` at the repo root still says **"Build RuneHaven v16"** and
describes the v16 locked spec. v59 has shipped. The scheduled prompt this run
actually received is the current one and correctly defers to `NEXT_BUILD.md`,
so nothing was blocked by this — but the stale file is a live trip hazard for
anyone reading the repo to work out what tonight's job is. Left untouched
deliberately: it is not `NEXT_BUILD.md`, but it is not mine to rewrite either.

`NEXT_BUILD.md` was not edited. `runehaven.html`,
`runehaven-art-style/SKILL.md`, `README.md`, `RUNEHAVEN_BIBLE.md` and
`debug/` are all unchanged.
