# BUILD FAILED — v48 (World Expansion 4, Demon Knight & Minimap 3x) was not started

**Date:** 2026-08-28
**Branch:** `claude/dazzling-planck-04jkj0`
**`runehaven.html` was NOT touched.** Working tree is clean apart from this file.
**`NEXT_BUILD.md` was NOT touched** — it still points at v48, as it should.

## The blocker, in one sentence

`node debug/run4.js runehaven.html` reports **1,056 PASS / 22 FAIL on the
current, unmodified file**, before a single line of v48 was written — because
`debug/run4.js` and `debug/run5.js` in this repo are still the **v46** harnesses
and were never synced alongside v47's `runehaven.html`.

The README's standard process makes any `run4` FAIL a RED condition that is
"never overridden", and requires zero FAILs before shipping. That gate cannot be
reached tonight by building anything, so nothing was built.

## Why this is a sync gap and not a code defect

Every one of the 22 failures asserts a **pre-v47 value against v47's own
deliberate, committed change**. Evidence:

- `git show --stat 18c2a23` ("sync v47 (1160 PASS/0 FAIL, verified
  independently)") touches **`runehaven.html` only** — no harness file.
- `git log -- debug/run4.js` stops at `131dc69` (**v46**). Same for `run5.js`.
- Neither harness contains a single reference to **any** v47 feature:
  `grep -c "adult_golem" debug/run4.js debug/run5.js` → `0` and `0`;
  `grep -n "redeem\|givePanel" debug/run4.js` → no matches.
- The v47 session that produced the shipped HTML reported **1160 PASS / 0 FAIL**,
  which is 100 more gates than the 1,078 this repo's v46 harness runs. **A
  correct, updated `run4.js` already exists in that session** — it just never
  landed here.

So the harness is not wrong about the world; it is describing a world two
versions old.

## The 22 failures, and the shipped value each one is measuring against

**v47 PART A — spawn counts rescaled to the real 2000x2000 map** (14 gates,
`run4.js:505`, table at `run4.js:491`):

| species | run4 expects | shipped | | species | run4 expects | shipped |
|---|---|---|---|---|---|---|
| tree_sprite | 9 | **70** | | glow_moth | 9 | **70** |
| water_sprite | 9 | **70** | | wolf | 6 | **36** |
| stone_sprite | 9 | **70** | | stag | 6 | **36** |
| wind_sprite | 9 | **70** | | golem | 3 | **18** |
| unicorn | 4 | **16** | | fire_dragon | 3 | **12** |
| crystal_golem | 2 | **8** | | water_dragon | 3 | **12** |
| storm_dragon | 3 | **12** | | shadow_dragon | 3 | **12** |

Three more gates are the same PART A change seen from a different angle:
- `Storm Dragon reaches its peaks (12 spawned)` — wants exactly 3 (`run4.js:1053`)
- `golem still spawns as before (18)` — wants exactly 3 (`run4.js:1874`)
- `entity total is roughly 3x the old world (535, want 72..160)` (`run4.js:1300`)

**v47 PART B — Troll/Wraith nerf** (2 gates): `dark_wraith 65 HP` and
`dark_wraith 12 dmg`; shipped is **49 HP / 9 dmg**.

**v47 PART C — Sea Serpent buff** (1 gate): `sea_serpent 130 HP`; shipped is
**165 HP**.

**v47 PART F and the redeem-code feature** (2 gates):
- `PIN Fixes: no new table of any kind ... was added` (`run4.js:5173`) — the
  shipped file now legitimately calls `from("redeem_codes")` and
  `from("redeem_claims")`, so the pinned table list is two entries short.
- `closeAllPanels() exists and covers every real panel` (`run4.js:5211`) — pins
  the exact 7-panel array literal; v47 added `givePanel` as an eighth
  (`runehaven.html:8748`).

## Neither of the other two harnesses is failing

- `node debug/run3.js runehaven.html` → **`CAUGHT ERROR: none`** (login settled
  in 6.2s).
- `node debug/run5.js runehaven.html` → **1,071 coverage draws, `CAUGHT: none`**,
  19 of 19 ground biomes.

`run5` is nonetheless also stale: step 7 of the standard process asks that its
coverage lists gain any new mob, and it has **no `adult_golem` branch at all**,
so v47's new creature is currently drawn by nothing.

## What unblocks this (in order of preference)

1. **Sync `debug/run4.js` and `debug/run5.js` from the v47 session that reported
   1160 PASS / 0 FAIL**, the same way `runehaven.html` was synced in `18c2a23`.
   This is the right fix: that harness already exists, already covers the Adult
   Golem, redeem codes and the give panel, and is 100 gates richer than anything
   that could be reconstructed here.
2. Failing that, confirm explicitly that this session may **update the 22 stale
   gates in place** to the shipped values tabulated above. That was deliberately
   not done unasked: rewriting a gate to match the code it is meant to police
   destroys the gate, and doing it for 22 at once would silently bless anything
   v47 got wrong among them. It also needs a human decision, since the resulting
   harness would be weaker than, and would later collide with, the 1160-gate one
   that already exists elsewhere.

Once either happens, v48 can be built exactly as `NEXT_BUILD.md` and the locked
spec describe — nothing about the spec itself is unclear or blocked.

---

## Appendix — NOT part of the blocker. Do not act on this section while the block stands.

Two things were confirmed by reading the file tonight, recorded so the v48
session does not have to rediscover them:

- **PART B has a real, latent bug waiting at `INTERIOR_N: 80 -> 160`, and it is
  the exact class of bug the spec warns about — but it is NOT the flood-fill
  guard.** `INTERIOR_FLOOD_GUARD` (`runehaven.html:3173`) is already
  `8 * INTERIOR_N * INTERIOR_N`, correctly derived, and carries the change for
  free. The hardcoded one is the **corridor carver's** guard: `carve()` at
  `runehaven.html:3192` stops after `guard++ < 200` steps. An L-shaped tunnel
  from a far-corner orphan back to the arrival point at (4,5) is at most
  `(80-4) + (80-5) = 151` steps today — under 200, so it always completes. At
  `INTERIOR_N = 160` it becomes `(160-4) + (160-5) = 311` steps, and the carve
  is cut off ~100 tiles short of its target. The connectivity pass would then
  report the region as still orphaned on every pass, burn its whole pass budget,
  and leave sealed-off floor tiles — precisely the "guard sized for the old grid
  silently truncating at the new one" failure the spec says must not repeat.
  It needs to be derived from `INTERIOR_N`, not bumped to another literal.
- **PART D's "confirm the real current value at build time":** confirmed. The
  minimap is `MAP_R = 5` → an **11x11** window at `MAP_CELL = 11` px, canvas
  `MAP_PX = 121` (`runehaven.html:13664-13666`). The spec's "roughly 10x10" is
  accurate. Note that going to ~30x30 at the current 11px cell would make the
  card 341px square against the compass's 148px, so the cell size is the one
  real decision PART D leaves open.
