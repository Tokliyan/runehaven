# BUILD_FAILED — 2026-09-17

**Nothing was built tonight, and `runehaven.html` was not touched.**
The blocker is not a broken build. It is that `NEXT_BUILD.md` points at a
spec that has already shipped, and I am not permitted to re-point it.

## What blocked me

`NEXT_BUILD.md` currently reads:

> Build exactly per "Confirmed, locked spec for a future version — Animation
> & A Living World Pass" in README.md.

That spec (README.md line 555) is **already fully implemented in the current
`runehaven.html`**, shipped by commit `15903e9` on 2026-09-14
("sync v57 (Animation & A Living World)"). I verified all five parts directly
against the source rather than trusting the commit message:

| Part | Spec | State in current `runehaven.html` |
|------|------|-----------------------------------|
| A — floating damage numbers | new numbers on every hit, crit distinguished | Present. `floatTexts` at line 1680, pushed at 9390 with a `big` flag for crits, ticked at 11920, drawn at 17774. Predates the spec (v9). |
| B — real walk-cycle | leg offset off the existing bob phase, stops when movement stops | Present. `Animation Pass PART B` helper at line 13407. `WALK_MS 110` reuses the player bob's own `t/110`; hard `0` when `moving` is false; drives hero, creature and dragon legs. Uses the `moving` parameter `drawSpecies` had taken unused since v15. |
| C — water ripple | concentric fading rings on Shallow/Water, no gradient | Present. `Animation Pass PART C` at line 1357. `RIPPLE_MS 2600`, `RIPPLE_GATE 0.66`, `RIPPLE_RINGS 3`, `RIPPLE_R 0.86`. Ground-plane ellipses at the tile's IH2/IW2 ratio, flat strokes only, deep ocean deliberately excluded. |
| D — tree/grass sway | canopy sway off the idle-bob technique, grass at smaller scale | Present. `Animation Pass PART D` at line 1380 and the canopy application at 12454. `TREE_SWAY 1.9` px at scale 1, `BLOOM_SWAY 0.7` px. Canopy only, never the trunk. |
| E — UI transitions | finish the existing transition pattern | Present. `Animation Pass PART E` at lines 270, 566, 11508 and `uiReveal()` at 18498. Covers inventory rows, new-item appearance, count changes, and the boss bar. |

So the spec does not apply to the current state of `runehaven.html` — there
is nothing left in it to build. Per the standard process and the routine
prompt, that is a STOP, not something to guess my way around.

I also may not pick the next spec myself, and I may not edit `NEXT_BUILD.md`.
Those two rules together mean no build is possible tonight.

## The current build is healthy — this is not a regression

I ran the full gate against the unmodified working tree so the state on
record is accurate:

- `new Function(scriptText)` parse check — **1 of 1 inline script parsed OK**
- `node debug/run3.js runehaven.html` — **CAUGHT ERROR: none**
- `node debug/run4.js runehaven.html` — **1625 PASS, 0 FAIL** (includes the
  43 Animation-pass gates added in `9e2a5d4`)
- `node debug/run5.js runehaven.html` — **coverage draws: 1324 — CAUGHT: none**

HEAD is `31dbe41`. The working tree was clean before this file and no game
code was changed.

## What v57 left unfinished (both are bookkeeping, not code)

Commit `15903e9` shipped `runehaven.html` and `9e2a5d4` shipped the run4
gates, but two standard-process steps were never completed:

1. **`runehaven-art-style/SKILL.md` has no changelog entry for the Animation
   pass.** Its newest entry is still `### 2026-09-11 (v56 — UI Consistency &
   Onboarding Pass)`. Standard process step 6 requires a dated,
   rendering-scope entry, and Parts B, C and D are squarely rendering scope.
   I did not write it myself: authoring the permanent design record for a
   build I did not run, including the intent behind its judgment calls, is
   the kind of narrative content the process wants the actual builder to
   own. The verified constants in the table above are everything needed to
   write it quickly.

2. **`NEXT_BUILD.md` was never advanced.** Every prior version ends with a
   commit like `v56 shipped - point at Animation & A Living World Pass`
   (`2561780`). That step is missing for v57, which is the direct cause of
   tonight's stall.

## What unblocks the next run

Re-point `NEXT_BUILD.md` at the next queued spec. Per the README's own
queue order, the next unshipped one is:

> `## Confirmed, locked spec for a future version (Consumables)` — README.md line 625

I am deliberately not making that edit. Confirming it is the intended next
build is a call for a human, and the rule against editing `NEXT_BUILD.md`
exists precisely so a stalled pointer surfaces instead of being silently
resolved.

Once `NEXT_BUILD.md` points somewhere unshipped, delete this file and the
next scheduled run will build normally.
