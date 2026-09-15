# BUILD_FAILED — 2026-09-15

**Nothing was built tonight. `runehaven.html` is unchanged and still green.**
The blocker is a stale pointer, not a broken build.

## What blocked the run

`NEXT_BUILD.md` currently says:

> Build exactly per "Confirmed, locked spec for a future version — Animation
> & A Living World Pass" in README.md.

That spec (README.md lines 555–623) **has already shipped**. It went in on
this branch as commit `15903e9` — *"sync v57 (Animation & A Living World):
real walk-cycle via a dormant drawSpecies parameter unused since v15,
concentric water ripples, tree canopy sway, UI transitions"* — with the
matching harness gates in `9e2a5d4` (*"sync v57 harness updates, 43 new
gates"*). `NEXT_BUILD.md` was never repointed afterwards, so it still aims
at the version that just shipped.

Building it again would mean re-implementing five systems that already
exist — exactly the duplicate-system outcome the v57 commit message says it
avoided for PART A. Per the routine's own rule I must never decide what to
build next on my own and must never edit `NEXT_BUILD.md` myself, so the run
stops here.

## Verification that the spec is already live (checked directly, not assumed)

Every part was confirmed in the current `runehaven.html`, not inferred from
the commit message:

| Part | Spec | State in current `runehaven.html` |
|---|---|---|
| A | Floating damage numbers, crit distinguished | `floatTexts` (line 1680, v9) + `addFloat` as the single mint point; `col`/`big` carry the crit distinction |
| B | Real walk-cycle driven by the existing movement phase | `Animation Pass PART B` blocks; `drawSpecies(species, sx, sy, t, moving)` at line 15686 now reads the `moving` parameter it had taken since v15 |
| C | Concentric water ripples on Shallow/Water | `Animation Pass PART C` at lines 1357 and 17253 |
| D | Canopy + grass sway using the idle-bob technique | `Animation Pass PART D` at lines 1380, 12454, 12959, 13013 — `swayAt()` bends from the canopy base |
| E | Finish the existing UI transitions | `Animation Pass PART E` at lines 270, 566, 11508, 18498 — `uiReveal()` |

## Gauntlet result on the unchanged tree

Run in full before stopping, all three green:

- `node debug/run3.js runehaven.html` → `frames pumped, CAUGHT ERROR: none`
- `node debug/run4.js runehaven.html` → **1625 PASS, 0 FAIL** (includes all
  43 v57 `ANIM A`–`ANIM E` gates)
- `node debug/run5.js runehaven.html` → `coverage draws: 1324 — CAUGHT: none`

Working tree was clean at the start of the run and the only file added is
this one.

## What a human needs to decide

1. **Repoint `NEXT_BUILD.md`.** The next unshipped spec in README.md order is
   *"Confirmed, locked spec for a future version (Consumables)"* at line 625,
   whose own header reads "QUEUED, AFTER THE ANIMATION PASS — do not build
   until both specs above ship." That now appears satisfied, but choosing the
   next build is explicitly not mine to make, so it is left untouched.
2. **Separately: v57 never got its `SKILL.md` changelog entry.** Standard
   process step 6 requires a dated, rendering-scope changelog entry per
   shipped version. The newest entry in `runehaven-art-style/SKILL.md` is
   `### 2026-09-11 (v56 — UI Consistency & Onboarding Pass)`; there is no v57
   entry, even though v57 was almost entirely rendering work. This was left
   for a human rather than back-filled, since writing it would mean
   documenting a build this session did not do.

Once `NEXT_BUILD.md` points at unshipped work, delete this file and the next
run proceeds normally.
