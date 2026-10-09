# BUILD FAILED — 2026-10-09 (World Encounters — Roaming Boss & Bounty Board)

`NEXT_BUILD.md` points at README's **"Confirmed, locked spec for a future
version (World Encounters — Roaming Boss & Bounty Board)"** (README line 731).

**Nothing was built. `runehaven.html` is byte-for-byte unchanged, and so are
`runehaven-art-style/SKILL.md`, `debug/*` and `NEXT_BUILD.md`.** The whole
build stopped before the first patch, on the standard process's own RED rule.

Steps completed before stopping: `runehaven-art-style/SKILL.md` read in full
(all 4,164 lines), `RUNEHAVEN_BIBLE.md` read in full, the spec section read in
full, and every claim either part of it makes about the current file verified
directly against `runehaven.html`.

---

## THE BLOCKER — PART A requires inventing a Boss-tier mob the bible does not list

PART A asks for, in its own words:

> a new, additional Boss-tier creature with no fixed home

**The bible names exactly one Boss-tier creature, and PART A explicitly rules
it out.** `RUNEHAVEN_BIBLE.md`'s MOBS section lists eight mobs with a
difficulty tier each:

```
Goblin        Easy        Bandit       Easy
Troll         Medium      Dark Wraith  Medium
Adult Golem   Hard        Sea Serpent  Hard
Demon Knight  Very Hard
Elder Drake   Boss tier   <- the only one, and PART A says it stays at the Volcano
```

Verified against the live file as well: `MOBS` (runehaven.html:2906) holds
fifteen entries — `elder_drake`, `goblin`, `bandit`, `boar`, `bear`,
`griffin`, `phoenix`, `troll`, `dark_wraith`, `sea_serpent`, `adult_golem`,
`demon_knight`, `basilisk`, `salamander_king`, `golem_elder` — **every one of
them a creature the bible names**, and `elder_drake` is the only one whose own
comment calls it boss tier ("the bible's only boss-tier creature", line 2907).

So building PART A means inventing a creature: a name, a species, a
silhouette, a palette, a stat block and a reason it is wandering the world.
That lands squarely on the standard process's RED list (README step 5):

> **RED — always STOP, no exceptions** ... The spec would require inventing
> bible content — a pet, mob, biome, location, or lore element not in the
> bible. **This is a creative integrity rule, not a bug-severity one, and
> severity never overrides it.**

### Why this was not treated as a YELLOW judgment call

Three readings were checked, and all three are blocked:

1. **Invent a new boss and mark it non-canon.** Step 3's tail clause allows
   non-canon *additions* — but step 5 names a mob not in the bible as RED
   outright, and says severity never overrides it. Where the two touch, the
   explicit RED list wins, and step 5's own tiebreaker ("when genuinely unsure
   which zone something belongs in: treat it as RED") points the same way.
   The project's own precedents agree, in both directions: v21 shipped the
   Diver's Charm and wrote down why it was allowed — *"It is an **item**, not a
   pet/mob/biome/location, so it is not the kind of thing the never-invent rule
   forbids"* — and v32 **declined to invent a Hollow mob** for exactly this
   reason (*"the bible names none for the Hollow, so inventing one was
   declined"*). A boss creature is on the forbidden side of that line, not the
   `void_shard` / `raw_meat` side.
2. **Promote an existing creature to the roaming boss.** The nearest candidate
   is `demon_knight` (Very Hard, 280hp/26dmg) and the next is `basilisk`. Both
   contradict PART A on two counts at once: neither is Boss tier, and the bible
   gives each a fixed home ("Deep dungeons"), which is the one thing a roaming
   boss must not have. Re-tiering a bible creature and moving it out of its
   bible home is a design decision with real gameplay consequences, not a
   tunable.
3. **A second, roaming Elder Drake.** Directly contradicted by the spec's own
   first sentence — "separate from the Elder Drake" and "The Elder Drake stays
   exactly fixed at the Volcano, per the bible."

### What would unblock PART A

One decision from the owner, and it is a content decision, not a number:

- **Name the creature.** If a second Boss-tier creature should exist, add it to
  `RUNEHAVEN_BIBLE.md`'s MOBS table (a name, a home-or-roaming note, a tier and
  a loot line is enough) and the build has everything else it needs. Its art,
  stats and respawn timer are then ordinary flagged tunables, exactly as the
  Elder Drake's 900hp/28dmg/6h were in v30.
- **Or re-point PART A at a bible creature** and say so in the spec — e.g.
  "the Demon Knight breaks out of the dungeons and roams", which is a real
  design statement the build can follow without inventing anything.
- **Or drop PART A** and re-issue the spec as the bounty board alone. See
  below — that half is genuinely ready.

---

## PART B is NOT the blocker, and is ready to build as written

Every system PART B says it reuses was confirmed live, so this is recorded so
the next run does not have to re-derive it:

| PART B needs | Status in `runehaven.html` |
| --- | --- |
| a day counter other daily systems use | `worldDayNum()` at line 8383, 12 call sites |
| a safe-hub interaction point to copy | `nearOracle()` at line 1651, prompt at 18841 |
| existing loot/reward patterns | every `MOBS` entry's `loot` array |
| creatures to name as a bounty | 15 `MOBS` + the `WILD_SPECIES` roster, all canon |

PART B on its own invents nothing: it names an **existing** creature and pays
in **existing** loot. The one thing in it worth the owner's eye is that a
"bounty board" is itself a structure the bible's LANDMARK STRUCTURES list does
not name — much weaker than PART A's problem (it is furniture inside an
existing bible landmark, the way v38's tutorial stone and dummy sit inside the
bible's Tutorial Grounds), and it would have shipped as a flagged judgment call
rather than a stop.

**It was not shipped alone**, because a spec with one of two parts built is the
half-finished build the routine prompt and README step 5 both forbid. If the
bounty board should ship by itself, that is a one-line change to
`NEXT_BUILD.md` — which this run deliberately did not touch.

---

## Also worth knowing (not a blocker, no action taken)

**The README's own queue order disagrees with `NEXT_BUILD.md`.** Line 730,
directly above this spec, reads *"QUEUED, AFTER THE GEAR BONUS PASS — do not
build until all specs above ship"*, and four specs above it have not shipped:
v52+53 (Session Resume, Colosseum Rework & Guild Tier 2), Spawn Ambience &
Empty-Biome Visual Pass, The Lighting & Atmosphere Pass, and — per its own
heading — Dungeons & the Basilisk, though `basilisk` and `demon_knight` are
both live in `MOBS`, so that last heading is stale rather than unbuilt.

`NEXT_BUILD.md` was followed over the queue note, per the standing instruction
that the build never decides its own target. Flagged only because the queue
note will keep contradicting `NEXT_BUILD.md` until one of the two is edited,
and PART A's missing creature needs the owner either way.
