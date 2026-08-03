# BUILD FAILED — v18 (Underground + Underwater Caves, 5 new species)

**Date:** 2026-08-03
**Stopped at:** planning/anchor-verification, before any edit.
**`runehaven.html` is UNCHANGED** (README standard process, step 5).
**`NEXT_BUILD.md` untouched**, as required.

Stopping was the specified action here, not a failure to try: the locked spec
tells me to *reuse* a mechanic that does not exist anywhere in the repo, and
building it would mean inventing a mechanic, an item, and their numbers.

---

## BLOCKER 1 (hard) — Part B underwater access depends on code that does not exist

README v18 spec, Part B:

> Underwater Caves: reuse the breath-timer dive mechanic and the health-regen
> item already agreed for underwater access — the entrance is a dive point in
> deep water, leading to its own separate interior area…

There is nothing to reuse. Verified by search across `runehaven.html`,
`README.md`, `NEXT_BUILD.md`, `runehaven-art-style/SKILL.md`, and `debug/`:

| Thing the spec says to reuse | Occurrences in the whole repo |
|---|---|
| `breath` / `Breath` | 0 in `runehaven.html` (only the spec sentence in README) |
| `dive` / `swim` / `oxygen` / `underwater` | 0 in `runehaven.html` |
| health-regen item | does not exist — see below |

Three separate things are missing, not one:

1. **No breath/dive timer of any kind.** No timer, no drain, no surfacing rule,
   no penalty-on-empty.
2. **No health-regen item, and no framework to hang one on.** `ITEMS`
   (`runehaven.html:298`) has no consumable at all — the only two
   non-weapon/non-armour additions since v17 are `rare_herb` and
   `magic_essence`, both explicitly commented *"collect-only — no recipe and no
   consumable effect by design"* (`runehaven.html:305`). There is no
   consumable-effect code path in the file. So this is not "wire up an existing
   item" — it is designing an item *and* the consumable system it needs.
3. **Deep water is not enterable.** `const BLOCKED = new Set([B.DEEP, B.PEAK,
   B.LAVA]);` (`runehaven.html:630`), enforced on player movement at
   `runehaven.html:2422-2441`. A "dive point in deep water" is currently
   unreachable — the player is hard-blocked from standing on `B.DEEP` at all.
   Making it reachable is a movement-rule change the spec never authorises.

To build this I would have to invent: breath duration, drain rate, what happens
at zero (damage? forced surface? both?), the regen item's name, how it is
obtained (recipe? drop?), its effect size and duration, *plus* a consumable
system, *plus* a deep-water traversal rule. Those are not the "HP number /
cooldown / percentage" tunables README rule 3 permits me to design — that rule
covers filling in a number for an agreed mechanic, not authoring the mechanic.
The spec's own instinct is anti-invention here: for Sea Serpent loot it says to
reuse `iron_bar`/`runic_stone` "rather than inventing a new item type."

The phrase **"already agreed"** is the crux — these were settled in a
conversation that never landed in this repo. I can't recover those decisions,
and guessing them would bake wrong numbers into a locked spec.

### Knock-on: 2 of the 5 species in Part C are also blocked

- **Water Dragon** — home is "Underwater Caves, tame as hatchling."
- **Sea Serpent** — home is "Underwater Caves interior."

Neither has a valid place to exist until Blocker 1 is resolved. The spec's own
proof gate — *"confirm that both new cave interiors are actually reachable from
the entrances placed in the overworld"* — cannot pass for the underwater half.

I did not ship the unblocked two-thirds: README step 5 says to leave
`runehaven.html` unchanged on a stop, and a half-applied v18 carrying a v18
changelog entry would misrepresent the build's state to the next session.

---

## BLOCKER 2 (small, needs one number) — Part A sprite/wolf/golem/shadowfox counts

Part A gives exact targets for seven entries, then says the rest should
"reduce similarly by ~35% each, minimum 1." For the four sprites the stated
rule and the stated example disagree:

- The four sprites are at `count: 4`. `4 − 35% = 2.6`, and the spec says
  **"rounding down"** → **2**.
- But **bandit is also at 4**, and its explicit locked target is **4→3** (a 25%
  cut, which does not round down).

So a `count: 4` entry maps to 3 by the worked example and to 2 by the written
formula. Same question, smaller, for wolf `3`, golem `2`, shadowfox `2`.

Please confirm the intended values:

| Entry | Current | 3 (bandit precedent) or 2 (formula)? |
|---|---|---|
| tree/water/stone/wind sprite | 4 each | ? |
| wolf | 3 | 2 assumed |
| golem | 2 | 1 assumed |
| shadowfox | 2 | 1 assumed |

Flagging rather than picking, because Part A is explicitly "do not redesign the
numbers", and because dropping the night-gated `shadowfox` (which already has a
`presenceRoll: 0.55`) to `count: 1` interacts with the spec's own requirement
that no species fall to zero spawns in the test seed.

---

## Everything else is verified ready — this build should go straight through once unblocked

I checked all the remaining insertion points so the next run needs no re-survey:

- `aura()`, `dragonV2()`, `DRAGON_PAL` — confirmed **absent**, as the spec
  states. Clean to insert; no name collisions.
- Art helpers `P` / `R` / `EY` / `BND` / `SCL` / `drawBlobLocal` — all present,
  exactly one definition each. Ported art will run as written.
- `drawSpecies` chain (`runehaven.html:4142`) ends at
  `else if (species === "lightfox")` — unique tail anchor, clean append.
- `drawMob` art chain (`runehaven.html:3878`) — unique anchors.
- `SPECIES_K` / `MOB_K` / `MOB_TALL` (`runehaven.html:3541-3548`) — all present
  and unique.
- `run5.js` coverage lists (`debug/run5.js:125-127`) — located, ready to extend.
- Underground Cave entrance placement — the `RUIN` landmark pattern the spec
  points to is real (`runehaven.html:665-676`, separation-checked retry loop).
  The **underground** half is buildable as specified; only the underwater half
  is blocked.
- Dark Forest exists (`B.DARKFOREST`) for Dark Wraith.

Two minor notes, both resolvable by me — recorded, not blocking:

1. **No ranged-mob pattern exists.** Only player-side ranged weapons and
   projectiles. The spec anticipates this ("if not, a short-range bolt is fine,
   flag the exact mechanism used") — so Dark Wraith will use the fallback, and
   I will flag the mechanism in the commit.
2. The supplied mob art uses `kind === "dark_wraith"`; the live chain uses
   `m.kind === "goblin"`. Trivial port adaptation, consistent with how v15/v17
   art was ported.

---

## To unblock

Answer these, in `README.md`'s v18 section (I must not edit it myself):

1. **The breath-timer dive mechanic** — duration, drain, and what happens at
   zero breath.
2. **The health-regen item** — name, how it is obtained, effect size/duration;
   and confirm whether v18 is meant to build the first consumable-effect
   system, since none exists.
3. **Deep-water access** — how the player reaches a deep-water dive point given
   `B.DEEP` is in `BLOCKED`.
4. **Blocker 2's counts** — 3 or 2 for the `count: 4` entries.

Alternatively: explicitly re-scope v18 to the underground half only (Part A +
Underground Caves + Fire Dragon, Glow Moth, Dark Wraith), deferring Water
Dragon, Sea Serpent and Underwater Caves to v19. That is a scope decision, so
it is yours to make, not mine.
