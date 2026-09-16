# BUILD_FAILED — 2026-09-16

**Nothing was built tonight, and `runehaven.html` was not modified.**
The blocker is not a bug: it is that `NEXT_BUILD.md` points at a spec that
has already shipped, and I am not permitted to pick a different one.

## What blocked me

`NEXT_BUILD.md` currently reads:

> Build exactly per "Confirmed, locked spec for a future version — Animation
> & A Living World Pass" in README.md.

That spec (README.md:555–619) **shipped on 2026-09-14 as v57**, in commit
`15903e9` ("sync v57 (Animation & A Living World) …", 405 insertions to
`runehaven.html`), with its harness gates added in `9e2a5d4` ("sync v57
harness updates, 43 new gates"). Both commits are ancestors of the current
HEAD (`31dbe41`), so the work is present in the file I was asked to patch.

Building it again would mean bolting a second walk-cycle, a second ripple
system and a second damage-number system onto code that already has them —
exactly the "parallel system" the spec's own proof gates forbid. That is the
RED condition from README.md step 5: *the spec does not apply to the current
state of `runehaven.html`*. So I stopped instead of guessing.

## Why NEXT_BUILD.md is stale (root cause)

Every prior version shipped in two commits: the build itself, then a
follow-up repointing `NEXT_BUILD.md` at the next spec —
`5df52e8` "Dungeons shipped - point at …", `2561780` "v56 shipped - point at
Animation & A Living World Pass", and so on.

For v57 that second commit was never made. `git log -- NEXT_BUILD.md` ends at
`2561780` (the v56 one). v57 shipped without repointing the file, so the
pointer still names the spec v57 itself implemented.

## Evidence that all five parts are already in the file

Verified by reading the current `runehaven.html`, not from the commit message:

| Spec part | Where it lives now |
| --- | --- |
| A — floating damage numbers | `floatTexts` declared `runehaven.html:1680` ("v9: rising damage numbers"), spawned :9390, ticked :11920, drawn :17774, exposed to the harness :18940 |
| B — walk cycle | `Animation Pass PART B — THE WALK CYCLE` block at :13407, plus the `moving` parameter threading at :13813, :14285, :15690, :16724 |
| C — water ripple | `Animation Pass PART C — THE WATER RIPPLE` constants at :1357, applied in the water/lava draw at :17253 |
| D — tree & grass sway | `Animation Pass PART D — SWAY` at :1380, canopy `swayAt()` at :12454, grass/flowers at :12959 and :13013 |
| E — UI transitions | CSS at :270 and :566, inventory reveal at :11508, `uiReveal()` at :18498, hook at :18922 |

`debug/run4.js` already carries 49 lines of `ANIM A/B/C/D/E` gates (9/10/9/6/10).

## State of the tree right now — healthy, not broken

The full gauntlet was run against unmodified HEAD to confirm nothing is
actually wrong with the shipped code:

- `node debug/run3.js runehaven.html` → `frames pumped, CAUGHT ERROR: none`
- `node debug/run4.js runehaven.html` → zero `FAIL` lines (all `PASS`, ANIM
  gates included)
- `node debug/run5.js runehaven.html` → `coverage draws: 1324 — CAUGHT: none`

`git status` is clean apart from this file.

## What a human needs to decide

I must never choose the next build myself or edit `NEXT_BUILD.md`, so this
needs one human decision:

1. **Repoint `NEXT_BUILD.md`** at whichever spec should actually be next.
   README's own queue order after the Animation pass reads: Consumables
   (README.md:625) → Matched-Tier Gear Bonus (:681) → World Encounters
   (:717). I am deliberately *not* picking one.
2. **Delete this `BUILD_FAILED.md`** once repointed, so the next scheduled
   run goes straight to building.

## One unrelated gap noticed while verifying (not fixed, not mine to fix)

v57 shipped `runehaven.html` but **never added its dated changelog entry to
`runehaven-art-style/SKILL.md`** — that file's newest entry is still
`### 2026-09-11 (v56 — UI Consistency & Onboarding Pass)`. README step 6
requires a rendering-scope changelog entry per version, and v57 was almost
entirely rendering work. I did not write one, because documenting a build I
did not perform would mean inventing the rationale behind someone else's
patches. Flagging it so it can be backfilled by whoever shipped v57.

## Also worth a glance: stale README section headers

Several README specs are still titled "for the next build" / "for the version
after next" after shipping — v52+53 (:105), Dungeons (:438), the UI pass
(:501). The Animation pass at :555 is still labelled "QUEUED, AFTER THE UI
PASS — do not build until the spec above ships" (:554) despite both having
shipped. Harmless today, but these headers are what a future run reads to
orient itself, so they are worth a cleanup pass.
