# BUILD_FAILED — 2026-09-19

**Nothing was built tonight, and `runehaven.html` is unchanged.** This is not
a broken build: the game is healthy and all three harnesses pass. The block is
that `NEXT_BUILD.md` points at a spec that has **already shipped**, and the
routine is not allowed to pick the next one on its own.

## What blocked the run

`NEXT_BUILD.md` currently says:

> Build exactly per "Confirmed, locked spec for a future version — Animation &
> A Living World Pass" in README.md.

That pass is already fully present in `runehaven.html`. It shipped as v57 in
commit `15903e9` ("sync v57 (Animation & A Living World)", +405/-74 in
`runehaven.html`), with its harness gates added in `9e2a5d4` ("sync v57 harness
updates, 43 new gates").

Verified directly against the current source, not taken from the commit
message — all five parts of the spec are implemented and named as such:

| Spec part | Evidence in `runehaven.html` |
|---|---|
| A — floating damage numbers | `floatTexts` / `debugAnimInfo().floats` (line ~18940). The v57 commit shipped this as a **verified no-op**: the system already existed since v9, so it was reported rather than duplicated. |
| B — real walk-cycle | `WALK_MS`, `BEAST_WALK_MS`, `WALK_SWING`, `walkStep()` (lines 13435-13439), consumed at 15706 and 16729 via the `moving` parameter `drawSpecies` had taken but ignored since v15. |
| C — water ripple | `/* ===== Animation Pass PART C — THE WATER RIPPLE ===== */` (line 1357); `RIPPLE_MS`, `RIPPLE_GATE`, `RIPPLE_RINGS`, `RIPPLE_R`; drawn at 17262-17272. |
| D — tree/grass sway | `/* ===== Animation Pass PART D — SWAY ===== */` (line 1380); `TREE_SWAY_MS`, `TREE_SWAY`, `BLOOM_SWAY_MS`, `BLOOM_SWAY`; `swayAt()` bends the canopy only (12474-12537). |
| E — UI transitions | `/* Animation Pass PART E */` at lines 270 and 566 (inventory rows, boss bar); `uiInvAnim` exported at ~18950. |

`debug/run4.js` carries 43 `ANIM A`-`ANIM E` gates and **every one passes**, so
the work is not merely typed in — it is proven live.

There is nothing left of this spec to build, and re-implementing it would
duplicate a shipped system. Per the routine's standing rule — *never decide
what to build next on your own; only ever follow what `NEXT_BUILD.md`
currently says, and never edit `NEXT_BUILD.md` yourself* — the run stopped
here rather than advancing to the next queued spec.

## Root cause

The v57 work was brought in by two **sync** commits that touched only
`runehaven.html` and `debug/run4.js`. The post-ship bookkeeping step that
normally follows a version was never done. The last commit to touch
`NEXT_BUILD.md` is `2561780` ("v56 shipped — point at Animation & A Living
World Pass"), which predates v57.

Two things were missed when v57 landed:

1. **`NEXT_BUILD.md` was never re-pointed** — it still names the pass v57 was.
2. **`runehaven-art-style/SKILL.md` has no v57 changelog entry** — its newest
   entry is still `### 2026-09-11 (v56 — UI Consistency & Onboarding Pass)`,
   even though v57 was a rendering-scope version that the standard process
   (step 6) requires a dated entry for.

Neither was fixed tonight: the first is explicitly off-limits to this routine,
and the second would mean writing a changelog for a build this session did not
do and whose judgment calls it cannot know.

## Current state of the build — all green, verified tonight

```
node debug/run3.js runehaven.html   frames pumped, CAUGHT ERROR: none
node debug/run4.js runehaven.html   0 FAIL lines (all PASS, incl. 43 ANIM gates)
node debug/run5.js runehaven.html   coverage draws: 1324 — CAUGHT: none
```

`runehaven.html` was not modified. `git status` was clean before this file was
written. (`node_modules/` was installed to run the harnesses; it is gitignored
and never ships.)

## What unblocks the next run

One decision, from a human, then this file can be deleted:

- **Point `NEXT_BUILD.md` at the next spec.** The README's own queue order puts
  **Consumables** next (`## Confirmed, locked spec for a future version
  (Consumables)`, README line 625) — its "QUEUED, AFTER THE ANIMATION PASS"
  gate is now satisfied. After that: Matched-Tier Gear Bonus (line 681), then
  World Encounters (line 717). **This routine deliberately did not make that
  edit.**

Worth knowing before picking Consumables: the README's own RED rule (step 5)
flags "a whole consumable-item framework" as the example of a spec that stops a
build if it needs 3+ unspecified interdependent decisions. The spec at line 625
should be read against the current state of `runehaven.html` with that in mind.

- **Optional, separate from the above:** add the missing v57 changelog entry to
  `runehaven-art-style/SKILL.md` so the rendering history is not left with a
  gap between v56 and v58.
