# BUILD FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-10-02
**Target:** `NEXT_BUILD.md` → README.md line 731, "Confirmed, locked spec for a
future version (World Encounters — Roaming Boss & Bounty Board)"
**Outcome:** STOPPED before any patch. `runehaven.html` is **unchanged**, byte
for byte. No partial build was shipped.

---

## The one-sentence reason

**PART A of the spec cannot be built without inventing a new Boss-tier
creature that the bible does not contain**, and that is a RED condition under
README "The standard process" step 5, which names a "mob ... not in the bible"
explicitly and adds that "severity never overrides it."

PART B (the bounty board) is **not** blocked and is ready to build — see
"What is NOT blocked" below. It was not built alone because the routine
prompt forbids shipping a half-finished version.

---

## What the spec asks for, quoted

> **PART A — a roaming world boss, separate from the Elder Drake.** The Elder
> Drake stays exactly fixed at the Volcano, per the bible — **this is a new,
> additional Boss-tier creature with no fixed home**, given a dramatically
> larger wander range than any current creature [...]

The wording is unambiguous on the two points that matter: the creature is
**"new, additional"** (so it is not a re-use or promotion of anything already
in the world), and it is **"Boss-tier"** (which is a bible classification, not
a loose adjective).

## Why that is a hard block, with the evidence

**1. The bible's mob roster contains exactly one Boss-tier creature, and it is
the one PART A explicitly excludes.**

`RUNEHAVEN_BIBLE.md`, `## MOBS` — all eight entries, with their stated tiers:

| Mob | Tier |
|---|---|
| Goblin | Easy |
| Bandit | Easy |
| Troll | Medium |
| Dark Wraith | Medium |
| Adult Golem | Hard |
| Sea Serpent | Hard |
| Demon Knight | Very Hard |
| **Elder Drake** | **Boss tier** |

"Boss tier" appears once in the entire bible. It belongs to the Elder Drake,
which PART A rules out in its first sentence.

**2. All eight are already implemented, so there is no unbuilt bible creature
to draw on.** Verified directly against the `MOBS` table in `runehaven.html`
(`elder_drake` 2910, `goblin` 2943, `bandit` 2945, `dark_wraith` 3017,
`sea_serpent` 3037, `adult_golem` 3063, `demon_knight` 3098, plus `troll`
2953). The roster is complete. There is no leftover.

**3. No other bible entry can stand in.** The closest canon thing to a
creature "with no fixed home" is the **Unicorn Elder** ("Spawns randomly
anywhere in the world, no pattern or hint"), and it is the wrong thing twice
over: the bible files it under **Elder pets**, not mobs, so it is a tame
target rather than boss-tier; and `runehaven.html` line ~19299 already carries
a deliberate, written decision against exactly this substitution —

> It is deliberately scoped to `elder_drake` alone, NOT to
> `isElderCombatant()`. That predicate also matches the three Elder PETS,
> which are companions and tame targets rather than boss encounters — a boss
> bar over a Unicorn Elder you are trying to tame would be exactly wrong. The
> drake is the only thing in the world the bible calls boss-tier, and this is
> its bar.

Re-using the Unicorn Elder would mean overruling a prior version's explicit
reasoning, not filling a gap.

## Why README step 3's "mark it non-canon" escape hatch does not cover this

Step 3 permits a non-canon addition if it is "explicitly marking it
non-canon", so this was checked carefully rather than assumed. It does not
apply here, for three reasons:

1. **Step 5 is the operative classification rule and it names this case.**
   It lists as always-RED: "The spec would require inventing bible content — a
   pet, **mob**, biome, location, or lore element not in the bible. This is a
   creative integrity rule, not a bug-severity one, and severity never
   overrides it."
2. **Fifty-nine versions of precedent say items only.** Every non-canon
   addition this project has ever made is an **item**: `divers_charm` (v21),
   `void_shard` (v32), `raw_meat` (v58). v58's own judgment-call note states
   the boundary in its own words — "**No new mob, no new biome, no new
   gatherable node and no bible content was invented**". A new world boss is
   the first of its kind, not a continuation of that pattern.
3. **Step 5's tiebreak points the same way:** "When genuinely unsure which
   zone something belongs in: treat it as RED."

## And it is not one tunable — it is a creature design

Step 5 reserves YELLOW for "a single tunable number or threshold". A new
Boss-tier creature is not that. Measured against what `elder_drake` actually
needs in the current file, a new boss would require inventing, at minimum:

- a **name** and the lore to justify a second world boss (bible authority)
- a full **flat-shaded art routine** — boss-tier bodies are the largest art
  class in the game, and `MOB_K.elder_drake` is `4.35`, "the largest thing in
  the world, by design" (~line 14575)
- **hp / dmg / atkRange / windup / cooldown / aggro / moveSpeed** as a
  coherent boss-tier stat block (the drake's is hp 900 / dmg 28)
- a **loot table** that must interact with the bible's closed list of four
  dragonsteel sources
- a **rarity band**, a **respawn constant** (cf. `ELDER_DRAKE_RESPAWN_MS`),
  and **spawn placement** logic
- a decision on whether it joins `FIRE_MOBS`, the cosmetic-drop table, and
  the Oracle's hint rules

Several of these are interdependent design decisions with real gameplay
consequences, which is step 5's second RED clause as well as its first.

---

## What is NOT blocked — PART B is ready to build

PART B needs no invented content and every dependency it names is live. If
PART A is resolved (or deliberately dropped), PART B can be built immediately
against these confirmed anchors:

- **"refreshing on a real timer ... tied to the same day-counter other daily
  systems already use"** → `worldDayNum()` (line 8383) is that counter, already
  shared by the Krakenling `dayCycle` gate (8558-8567), the Blood Moon
  (`BLOOD_MOON_EVERY`, 8520) and the rare-take restock (8449).
- **"A new interaction point at Spawn or the Bazaar"** → both exist with safe
  radii: `SPAWN`/`SAFE_RADIUS`, and `BAZAAR` with `BAZAAR_R = 10`,
  `BAZAAR_RING`, `BAZAAR_STALLS` (1804-1806). `bazaarIsSafe` (2463) already
  asserts the Bazaar sits inside a safe zone, per the bible.
- **"naming one existing creature"** → the live `MOBS` table, no additions.
- **"reuse existing loot/reward patterns rather than a new currency"** →
  `mobKill()`'s `ground_items` insert path (~8020) is the existing reward
  pipeline, and the bible has no currency to conflict with.
- **"confirm it never enters a Safe Zone"** → `inSafeZone()` is live and
  already consulted by mob targeting (8107, 8113).
- The spec's **boss-bar/music re-use** is also genuinely available:
  `noteBossCombat()` / `activeBossMob()` / `updateBossHud()` (19304-19360)
  are parameterised by a single `BOSS_KIND` constant, so extending them to a
  second boss is a small, clean change — the UI half of PART A was never the
  problem. **Only the creature itself is.**

## Three ways to unblock this, cheapest first

1. **Add the roaming boss to `RUNEHAVEN_BIBLE.md`** — a name, a line in the
   `## MOBS` table at Boss tier, and one sentence of lore. That is the real
   fix: it makes PART A canon and the build becomes routine. One bible line
   unblocks the whole version.
2. **Amend the spec to authorise a non-canon boss in writing**, i.e. state in
   README that this one creature may ship flagged non-canon, and name it. That
   overrides step 5 deliberately rather than by my guess — which is the part I
   am not willing to do unilaterally.
3. **Split the version:** amend `NEXT_BUILD.md` to point at PART B alone
   (bounty board) and re-queue PART A behind a bible update. PART B is fully
   specified and buildable tonight as written.

Any one of these turns this into a normal build. Option 1 is a single line.

---

## State of the repository

- `runehaven.html` — **unchanged**. No patch was attempted, per step 5's "leave
  `runehaven.html` unchanged."
- `runehaven-art-style/SKILL.md` — unchanged (no rendering work happened).
- `NEXT_BUILD.md` — unchanged, deliberately. Not mine to edit.
- `RUNEHAVEN_BIBLE.md` — unchanged. The block is precisely that editing it
  would be inventing canon.

**Baseline health, confirmed on the untouched file** (so it is on record that
nothing here is a pre-existing breakage):

- `node debug/run3.js runehaven.html` → `frames pumped, CAUGHT ERROR: none`
- `node debug/run4.js runehaven.html` → **1718 PASS, zero FAIL** (1844 lines)
- `node debug/run5.js runehaven.html` → **`coverage draws: 1361 — CAUGHT: none`**

So the tree is healthy and the only thing standing between this spec and a
shipped version is the one bible question above.

Process steps followed before stopping: the spec's queue position was checked
(it reads "QUEUED, AFTER THE GEAR BONUS PASS", and the Gear Bonus pass shipped
as v59 on 2026-09-24, so its turn had genuinely come), `RUNEHAVEN_BIBLE.md` was
read in full, and the live `MOBS` table was read directly rather than assumed.
The RED fired on the bible check, before any rendering code was touched.
