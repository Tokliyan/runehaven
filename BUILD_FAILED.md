# BUILD_FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-10-07
**Target per `NEXT_BUILD.md`:** "Confirmed, locked spec for a future version —
World Encounters — Roaming Boss & Bounty Board" (`README.md` line 731).
**Outcome:** STOPPED before any patch. `runehaven.html` is **unchanged**
(verified: `git status` reports only this new file — no tracked file was
modified).
**Classification:** RED, under `README.md` standard process rule 5 —
*"The spec would require inventing bible content — a pet, mob, biome,
location, or lore element not in the bible. This is a creative integrity
rule, not a bug-severity one, and severity never overrides it."*

---

## What blocked the build

**PART A cannot be built without inventing a creature the bible does not
list.**

PART A asks for *"a new, additional Boss-tier creature with no fixed home"*,
and in the same sentence rules out the only candidate the bible actually
has: *"The Elder Drake stays exactly fixed at the Volcano, per the bible."*

`RUNEHAVEN_BIBLE.md`'s `## MOBS` section is a closed, enumerated list, and it
contains **exactly one** Boss-tier entry:

```
Elder Drake — Volcano, World Boss — Boss tier — Dragonsteel, legendary loot
```

Every other creature in the bible was checked against PART A's three hard
requirements (Boss tier / no fixed home / not already in the game). None
satisfies them:

| Candidate | Bible text | Why it fails PART A |
|---|---|---|
| **Elder Drake** | "Volcano, World Boss — Boss tier" | Explicitly excluded by PART A itself; must stay fixed at the Volcano. |
| **Demon Knight** | "Deep dungeons — Very Hard" | Not Boss tier; fixed home (dungeons). Already placed in-game as drake flank spawns. |
| **Sea Serpent** | "Underwater — Hard" | Not Boss tier; fixed home; `biomes: []` cave-interior-only in current code. |
| **Adult Golem / Troll / Dark Wraith / Goblin / Bandit** | Easy–Hard tiers | Not Boss tier; all have stated biomes. |
| **Golem Elder** | "Deepest ruins, must defeat in combat to tame. Ultimate base defender" | Elder *pet*, and the bible gives it a fixed home ("deepest ruins"). Already implemented there (`runehaven.html:6255`). Making it roam across biomes would contradict the bible, not extend it. |
| **Dragon Elder** | "Retrieve the Golden Orb … bring to the Dragon Elder Altar to awaken" | Not a wild boss at all — an awakened companion gated on a landmark ritual. No roaming state exists in the bible for it. |
| **Unicorn Elder** | "Spawns randomly anywhere in the world, no pattern or hint. Grants fast travel … plus a passive luck buff" | The *only* canon creature with no fixed home — but it is a tameable Elder pet, not Boss tier, it is **already in the game** (`runehaven.html:6273`, so not "new, additional"), and it is load-bearing for the admin-only world-ending event (it must be alive to sense and sacrifice itself). Promoting it to a killable roaming boss would rewrite bible lore. |
| **Basilisk / Phoenix / Krakenling / Salamander King** | Rare/Epic pets | All have explicit fixed homes (deep dungeons, volcano, Abyssal Hollow, Sunforge Caldera). |
| **Duskfox Elder** | "One exists … admin account exclusive" | Admin cosmetic exclusive, fixed grove. |

So PART A has no canon creature left to be. Implementing it means **naming a
new Boss-tier mob**, which is precisely the RED trigger above. Per rule 5 I
did not guess, did not promote an existing creature out of its bible role,
and did not ship a non-canon mob behind a "non-canon" marker.

This is a **spec gap, not a code problem.** Nothing in `runehaven.html` is
broken and no patch anchor was ambiguous — I stopped at the spec-reading
stage, before the first edit.

## What was *not* a blocker (so this is a one-line fix, not a redesign)

Everything else the spec leans on is confirmed live in the current file, so
the moment PART A names a creature this build is straightforward:

- **Idle-wander / leash movement** — real, 22 `leashRadius` sites; the
  "extend rather than rebuild" premise in the spec's own preamble holds.
- **Boss bar** — real (`bossBar`, 9 sites; `BOSS_KIND` at line 19304).
- **Safe-zone test for the "never enters a Safe Zone" gate** — real:
  `inSafeZone(x, y)` at line 9359, already covering Spawn, the Bazaar and
  the scattered Other Safe Zones.
- **Day counter for PART B's rotation timer** — real: `worldDayNum()` at
  line 8383, already shared by the Blood Moon, the Krakenling window and the
  daily rare-spawn cap.
- **Safe hub interaction points for the board** — real: `SPAWN`, `BAZAAR` /
  `BAZAAR_R` / `BAZAAR_STALLS`, and the Oracle as an existing precedent for
  a hub NPC that names creatures.
- **Loot/reward patterns to reuse for the bounty bonus** — real, per-mob
  `loot` tables throughout `MOBS`.

**PART B on its own is fully buildable as written.** I did not ship it
alone, because rule 5 requires that a RED build leave `runehaven.html`
unchanged, and shipping half a locked spec would also be the
"half-finished build" the routine prompt forbids.

## Baseline harness state (unchanged file, for reference)

Run against the untouched `runehaven.html`, after `npm install` (jsdom was
not present in this fresh container — worth noting for future runs):

- `node debug/run3.js runehaven.html` → `frames pumped, CAUGHT ERROR: none`
- `node debug/run4.js runehaven.html` → 1718 PASS lines emitted; the
  baseline sweep was still running when this report was written and is **not**
  a gate for this build, because no patch was applied — the full gauntlet
  belongs to the run that actually ships PART A + PART B.
- `node debug/run5.js runehaven.html` → same: baseline only, not a gate here.

The gate was never reached. This build stopped at step 1 (reading the spec
against the bible), not at step 4 (the harnesses).

## What would unblock the next run

A one-line amendment to the PART A paragraph in `README.md`, made by the
project owner — I am deliberately not choosing between these, because
picking one *is* the bible decision:

1. **Name the roaming boss in the bible** (add it to `## MOBS` as a second
   Boss-tier entry, with its tier and loot), then PART A is canon and this
   build proceeds immediately; or
2. **Re-scope PART A onto an existing creature and say so explicitly** —
   e.g. "a roaming Boss-tier *variant* of <named canon mob>, same creature,
   unleashed wander" — which makes it an extension of canon rather than a
   new creature; or
3. **Drop PART A and re-issue the spec as PART B only** (the bounty board),
   which is buildable tonight exactly as written.

`NEXT_BUILD.md` was **not** edited, per the routine's standing rule that the
build never chooses its own target.
