# BUILD FAILED — v49 STOPPED (RED) at PART B

**Date:** 2026-08-28
**Base commit:** `44a22ce` (branch `claude/dazzling-planck-z6tciw`)
**`runehaven.html` is UNCHANGED.** The v49 patch (PART C) was deliberately
NOT applied. `debug/run4.js` carries three verified harness corrections
(PART B), described below.

---

## One-line summary

PART B asks for **real 0 FAIL**, and the spec simultaneously forbids the only
in-scope way to get there. Four `run4` gates fail, all four are
**cave dive-reachability**, and the spec's own words are *"only
diagnose-not-relax anything touching cave dive-reachability, which `SKILL.md`
has already ruled belongs in a real design decision, not a third silent
threshold drop."* Diagnosis is done and is below. The fix is a design change
that is not in this spec, so the build stops here rather than shipping a
relaxed threshold or a broken world.

---

## Where the run actually stands

Full, complete, **untruncated** runs against the unmodified `runehaven.html`:

| harness | result |
|---|---|
| `run2` | `CAUGHT ERROR: none` |
| `run3` | `CAUGHT ERROR: none`, login settled after **34,147 ms** |
| `run4` (baseline, before my harness fixes) | **1153 PASS / 7 FAIL**, `CAUGHT ERROR: none` |
| `run4` (after the three PART B fixes below) | **1156 PASS / 4 FAIL**, `CAUGHT ERROR: none` |
| `run5` | **1084 coverage draws — `CAUGHT: none`** |

`run4` now runs **end to end with no crash and no guarded stop at all**. The
"last guarded crash" the handoff describes does not occur any more.

Login is 34.1 s / unpatched, not the 5.99 s the spec asks to confirm — that
number is a *result of* PART C's chunking fix, which was not applied. It is
not a regression.

---

## PART A — RESOLVED. The `NaN` does not reproduce, and the root cause is known.

The interior-density log is a real number on the current file:

```
interior connectivity: 6 caves walked, smallest 15309 floor tiles, worst sealed-off count 0
interior density across 6 caves: 95301 floor tiles, 1.34 nodes / 1.84 ore / 1.01 mobs
  per 100 floor tiles (26x26 baseline: 1.41 / 1.74 / 1.01)
```

All six PART D density gates pass. `dFloor` is 95301, not `NaN`.

**Root cause of the whole family of symptoms — including the flaky
`window.debugXInfo()` calls — is the bug already fixed on this branch in
`64dbe37`, and it is a temporal-dead-zone cascade, not a timing race:**

- `run4.js:234` does `window.eval(gameScript)` inside a `try`.
- `runehaven.html:4960` calls `loadSavedCreds()` at **top level**. Before
  `64dbe37` it could throw on a not-yet-present DOM element.
- A throw there **aborts the rest of the top-level evaluation**. Every
  top-level `const` declared *after* line 4960 is then permanently in the
  temporal dead zone — `const pinEl` is on line **4988**, 28 lines later.
- Function *declarations* are hoisted, so `window.debugPinInfo` is still a
  function — it just **throws `ReferenceError: Cannot access 'pinEl' before
  initialization'`** the moment it is called. Same for `debugSettingsInfo()`
  (line 14758) and, as the handoff correctly predicted, *every hook further
  down the file.*

That is exactly the reported pattern: hooks that "return `undefined` or throw
partway through", getting worse the deeper into the file you go.

`debugSpaceInfo()` behaves differently from the other two for a consistent
reason: `interiorCache` (3195) and `INTERIOR_N` (3137) are both declared
*before* 4960, so it survives an aborted eval and returns **numbers computed
from a half-initialised world** rather than throwing — which is how a `NaN`
reached `dFloor` instead of an exception.

**Consequence for the handoff's instruction:** the `typeof window.debugXInfo
=== "function"` guards added in `1767f28` do not actually address this (the
function *is* a function; it throws when called). They are harmless and have
been left in place as instructed, but **no further call sites need hardening**
— the real cause is fixed upstream in `64dbe37`, and the whole file now runs
clean. This item can be closed.

---

## PART B — three real, verified harness corrections applied (7 FAIL → 4 FAIL)

Each was checked against the live constant/function **before** the test's
expectation was changed, per the spec. All three anchors were confirmed unique
(`grep -cF` = 1) before editing. No gate was weakened; two were strengthened.

### 1. `v46 C: the wild and mob spawn keepouts are named, not literals`
Stale N=2000 literals — the same class of miss `1767f28` was re-syncing.
Live file: `runehaven.html:3003-3004`
```
const WILD_SPAWN_MIN = 600;   // Expansion 4: 300 * 2
const MOB_SPAWN_MIN = 700;    // Expansion 4: 350 * 2
```
The gate still grepped for `300`/`350`. Updated to `600`/`700`.

### 2. `v46 C: every Ruin clears both spawn exclusions by its whole footprint` — STRENGTHENED
Was `worst > 350 + RUIN_FOOT`. `350` is the N=2000 `MOB_SPAWN_MIN`, so at
N=4000 this gate was **passing against half the exclusion it claims to
check**. Raised to the live `700`. It is guaranteed by construction, not by
luck — `placeRuinsAndZones()` rejects any candidate with
`if (H(tx, ty, SPAWN) <= MOB_SPAWN_MIN + RUIN_FOOT) continue;`
(`runehaven.html:3080`), so it cannot flake. Now reads
`nearest 782.8 > 700 + 76`.

### 3. `it stands on a Ruin tile`
**Not a placement bug.** The live file had already answered this and the
harness was never moved onto the answer: `v48` added `hx`/`hy` to
`debugV39Info()` (`runehaven.html:1997-2001`) with the comment *"a mob
idle-wanders up to its own leashRadius … so 'it is on a ruin tile' is only a
stable question about its home."* The gate was still asking about the live
`x`/`y`. Placed on `[829,2750]` — a real RUINB tile, and the outermost of its
cluster, which the independent recompute alongside it still proves — then it
wanders off, correctly. Re-pointed at `hx`/`hy`.

### 4. `surfaced, WASD cannot enter deep water` — STRENGTHENED
**The game is correct; the gate's assumption was stale.** It asserted
`Math.floor(st.x) === dx0 + 1` — that the player is still in the shore
*column*. That assumed `a` moves due west, which stopped being true in v47:
`update()` maps keys to screen axes (`runehaven.html:8996`,
`dx = rawX + rawY, dy = rawY - rawX`), so `a` is world **(-1, +1)** —
southwest. The player therefore slides *along* the shoreline rather than
pressing into it.

Measured directly with a purpose-built probe against the live file:

```
edge deep tile 2258,74   shore 2259,74
  2256,74=DEEP  2257,74=DEEP  2258,74=DEEP  2259,74=WATER
  2256,75=DEEP  2257,75=DEEP  2258,75=WATER 2259,75=WATER
surfaced end pos 2258.069 77.183 -> tile [2258,77] = WATER
```

The player ends on **shallow WATER**, never deep. The block works. Replaced
the x-literal with the claim in the gate's own title, asserted **per step**
rather than only at the end — a surfaced player is never standing on a
dive-only tile (`DEEP`/`UWCAVE`/`ABYSSAL`) at any point of the walk. That is
strictly stronger than the literal ever was, and independent of both the
movement basis and the local coastline. Now reads
`PASS - surfaced, WASD cannot enter deep water (ended on 2258,77)`. Its
companion `diving, WASD DOES enter deep water (walked to x 2253.26)` is
untouched and still passes.

---

## THE BLOCKER — the four remaining FAILs, and why I did not touch them

```
FAIL - most Underwater Cave pockets are reachable on one tank (2401/3438, budget 138 tiles)
FAIL - and most of the biome BY AREA is reachable (63.4%)
FAIL - most Hollow pockets are reachable on one tank (1483/2127, budget 138 tiles)
FAIL - and most of the Hollow BY AREA is reachable (65.4%)
```

Measured, both biomes, `budget = BREATH_MAX * 4.6 = 138` tiles:

| | pockets | by area | largest pocket | worst crossing |
|---|---|---|---|---|
| Underwater Caves | 2401/3438 = **69.8 %** | 390853/616368 = **63.4 %** | 3118 tiles at 5 — reachable | 1094 |
| Abyssal Hollow | 1483/2127 = **69.7 %** | 129999/198826 = **65.4 %** | 1100 tiles at 0 — reachable | 1091 |

The bar is `REACH_BAR = 0.7` (`run4.js:870`). **Both pocket counts miss it by
under half a percent; both area figures miss it by six to seven points.**

The third assertion of the trio — *the single largest pocket in the world must
be reachable* — **still passes in both biomes**, which is the one that says
the content is real rather than a locked room.

### Why this is RED and not a number to nudge

This is the **third consecutive expansion** to move this bar, and `SKILL.md`
has already ruled on it twice, in writing:

> *"If the intent is that a diver can reach anywhere, the fix is a real design
> change and belongs in a spec: scale `BREATH_MAX` with the world, or keep the
> rare pockets off the open ocean."* — `SKILL.md`, v46 judgment call 6
> (and Expansion 2b's judgment call 5 before it)

It is arithmetic, not a bug. The ocean has now grown 3.125x, then 2x, then 2x
again (N 2000 → 4000) while one tank of air has not moved since v21.

**And the two available levers are both closed to this build:**

1. **Scaling `BREATH_MAX` would immediately break a currently-passing gate.**
   `run4.js:5564` asserts
   `v46 C: BREATH_MAX is deliberately NOT scaled, as both expansion specs require`
   by grepping for `const BREATH_MAX = 30`. So the two gates are in **direct
   contradiction at N=4000**: one requires breath not to scale, the other
   requires reach that only scaled breath can deliver. That contradiction is
   itself the thing that needs a decision.
2. **Dropping `REACH_BAR` to ~0.6** is precisely the "third silent threshold
   drop" both `SKILL.md` and this spec forbid by name.

Nothing in the v49 patch touches worldgen, breath, or pocket placement, so
**applying PART C would not have changed any of these four numbers** — it
would only have shipped a build on top of a failing gate.

---

## What I did NOT do, and why

- **PART C (apply `BUILD_FAILED_v49.patch`)** — not applied. The patch was
  located and verified: it lives on the sibling branch
  `origin/claude/dazzling-planck-q30zb4` at commit `1b2eb6b`, it is exactly
  the **310 insertions / 38 deletions** the spec describes, and
  `git apply --check` confirms it **applies cleanly to `44a22ce`**. It is
  ready to go the moment the gate is green. It was not applied because
  README rule 5 requires a RED build to leave `runehaven.html` unchanged.
- **PART D** — not applied, since it is part of the same shipment. The
  analysis is done and is recorded below so it costs nothing next time.
- **No `SKILL.md` changelog entry**, no version commit, no `NEXT_BUILD.md`
  edit.

### PART D, worked out and ready (do not re-derive)

- **D1 — `speciesDailyCap()` scaling with `count`.** Accept, do not revert,
  exactly as the spec instructs. Unicorn 16 → 56.
- **D2 — the four fight-to-tame pets.** They take density from `MOBS.count`,
  which neither v47 nor the patch touched. Applying the patch's own
  tier multipliers, using the file's own `PET_RARITY` table
  (`runehaven.html:2700`):
  - `boar` **uncommon** ×4.0 → **6 → 24**
  - `bear` **uncommon** ×4.0 → **6 → 24**
  - `griffin` **uncommon** ×4.0 → **3 → 12**
  - `phoenix` **rare** ×3.5 → 3 → 10.5, i.e. **11** (the one value that does
    not land exactly; every other number in the patch's tier table is exact.
    This is a genuine YELLOW tunable and should be flagged as one.)

  Relative spread inside the tier is preserved exactly — griffin stays half of
  boar/bear, mirroring golem/wolf. Goblin, Bandit, Troll, Dark Wraith and
  Sea Serpent are combat balance and must NOT move.
- **Harness follow-up** for whoever ships this: `MOB_COUNTS` (`run4.js:545`)
  and `SP_COUNTS` (`run4.js:561`) both need the new numbers, plus the two
  exact-population gates — `Storm Dragon reaches its peaks`
  (`run4.js:1160`, `=== 12`) and `golem spawns its full v47 population`
  (`run4.js:1994`, `=== 18`).

---

## What is needed to unblock v49

**A one-line decision in `NEXT_BUILD.md` on dive reachability at N=4000.**
Any one of these unblocks it; all three are design calls, not tunables:

1. **Scale `BREATH_MAX` with the world** (e.g. 30 → 60) and update the
   `BREATH_MAX is deliberately NOT scaled` gate to match — this is the
   contradiction resolved in favour of reach.
2. **Keep rare pockets off the open ocean** — constrain `UWCAVE`/`ABYSSAL`
   placement so pockets generate within a tank of a shore. Reach becomes true
   by construction at any `N`, which is the shape v46 used for the Crystal
   Golem fix.
3. **Accept the number explicitly and say so in the spec** — decide that
   ~65 % of the deep biomes on a bare tank is intended at this scale, and
   authorise `REACH_BAR` to move with a written rationale, so it is a recorded
   design decision rather than a silent third drop.

Once that is decided, the rest is short: the patch applies clean, PART D is
worked out above, and everything else in `run4` is already green.
