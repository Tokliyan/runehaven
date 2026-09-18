# BUILD FAILED — 2026-09-18

**Nothing was built and `runehaven.html` was not modified. No code change was
attempted.**

## What blocked this run

`NEXT_BUILD.md` currently says, in full:

> Build exactly per "Confirmed, locked spec for a future version — Animation &
> A Living World Pass" in README.md.

**That spec has already shipped.** It went in as v57 on 2026-09-14, commit
`15903e9` ("sync v57 (Animation & A Living World)"), with its harness gates
added in `9e2a5d4` ("sync v57 harness updates, 43 new gates"). Both commits are
in the current history of `main` and of this branch.

`NEXT_BUILD.md` was last touched on 2026-09-12 (`2561780`, "v56 shipped - point
at Animation & A Living World Pass") — i.e. it was pointed at the Animation pass
*before* that pass shipped, and was never re-pointed afterwards. It has been
stale for four days.

This is the README's own RED condition: the spec does not apply to the current
state of `runehaven.html`. Building it would mean adding a second, parallel
animation system beside the one already there — which the spec's own proof gate
explicitly forbids ("confirm every part reuses a named existing technique rather
than introducing a parallel system"). So this run stopped instead of guessing.

## Evidence that all five parts are already live

Verified directly against the working tree at `31dbe41`, not inferred from the
commit message:

- **PART A — floating damage numbers.** Already existed before the Animation
  pass and was shipped as a verified no-op rather than duplicated. `floatTexts`
  is declared at `runehaven.html:1680` ("v9: rising damage numbers"), pushed via
  `addFloat()` at `:9389`, drawn at `:17774`, and exposed to the harness as
  `floatList` at `:18941`. The crit distinction the spec asks for is at `:9385`
  — crits render amber `#ffb340` with a trailing `!` and the `big` flag, normal
  hits render `#ffe9b0`. There is no `Animation Pass PART A` marker in the file
  precisely because nothing needed to be added.
- **PART B — real walk-cycle.** Five `Animation Pass PART B` markers, at
  `:13407` (the walk-cycle block itself), `:13813`, `:14285` (the counter-swing
  `legA` value), `:15690` (the `moving` parameter), `:16724`.
- **PART C — water ripple.** Constants `RIPPLE_MS` / `RIPPLE_GATE` /
  `RIPPLE_RINGS` / `RIPPLE_R` at `:1376`ff, draw site at `:17262`ff.
- **PART D — canopy and bloom sway.** `TREE_SWAY_MS` at `:1387`, `BLOOM_SWAY_MS`
  at `:1389`, canopy bend at `:12475`, per-bloom sway at `:12964` and `:13015`.
- **PART E — UI transitions.** Markers at `:270` (inventory row), `:566` (boss
  bar), `:11508` (the inventory block), `:18498` (`uiReveal()`).
- **Harness coverage.** `debug/run4.js` carries 44 `ANIM` gates covering all of
  the above, including the spec's own proof gates (sway is visual only and does
  not affect gather range; ripples stay inside `RIPPLE_R`; the walk cycle
  animates only while moving).

## The current build is healthy — this is not a broken-build report

The full gauntlet was run against the committed state to confirm this run is not
papering over a real failure. Everything is green:

- `new Function(scriptText)` parse check — passes (1 of 1 script block)
- `node debug/run3.js runehaven.html` — `frames pumped, CAUGHT ERROR: none`
- `node debug/run4.js runehaven.html` — **zero `FAIL` lines**
- `node debug/run5.js runehaven.html` — `frames pumped, CAUGHT ERROR: none`

So there is nothing to fix in the game. The only thing wrong is the pointer file.

## What is needed to unblock — a human decision, not a build

`NEXT_BUILD.md` needs to be re-pointed at the next spec, by the same hand that
has re-pointed it after every previous ship. **This run deliberately did not
edit `NEXT_BUILD.md`**, per the standing rule that the build routine never picks
its own next target.

For information only, not as a recommendation: the README's queue marker at line
624 reads "QUEUED, AFTER THE ANIMATION PASS", and the section under it is
**Consumables** (README line 625). Worth knowing before re-pointing there: the
README's own RED rules name "a whole consumable-item framework" as the example of
a spec that should stop a build, and the Consumables spec does confirm that no
`useItem`/`consumeItem` function exists anywhere yet, plus it leaves speed-potion
stacking rules explicitly "TBD". Re-pointing at Consumables may therefore want an
accompanying decision line in `NEXT_BUILD.md` — the way `6d9e425` did for the six
stale Duskfox gates — rather than just a pointer. That call is yours, not this
routine's.

Also worth a look while you are in there: README's queue headings are themselves
out of date. Line 105 and line 438 are both still labelled "Confirmed, locked
spec for the next build" (v52+53, and Dungeons & the Basilisk) despite both
having shipped, and the Layout block at line 10 still says "currently v19 (v20 in
progress)" against a file that is now at v57.

## Note to the next run of this routine

The blocker above is **not** something a build session can fix on its own. If
you are reading this file because it exists at the repo root: do not resolve it
by choosing a spec, by editing `NEXT_BUILD.md`, or by re-implementing the
Animation pass. If `NEXT_BUILD.md` still points at the Animation & A Living
World Pass, the correct action is still to stop. Re-verify the evidence above
against the then-current file, update this file if anything has changed, and end
the session.
