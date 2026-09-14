# BUILD_FAILED — 2026-09-14

**Nothing was built this run, and `runehaven.html` is unchanged.**
This is a RED stop under README "standard process" step 5, and it needs a
one-line human decision to clear. It is *not* a broken build — see
"Current repo state" below, everything is green.

## What blocked me

`NEXT_BUILD.md` currently says:

> Build exactly per "Confirmed, locked spec for a future version — Animation
> & A Living World Pass" in README.md.

**That spec has already shipped.** It was built as v57 in commit `15903e9`,
with its harness gates added in `9e2a5d4`. `NEXT_BUILD.md` was never
re-pointed afterwards, so it still names a finished build.

Every previous version got a dedicated "shipped — point at <next spec>"
commit that advanced this file:

```
2561780  v56 shipped - point at Animation & A Living World Pass
5df52e8  Dungeons shipped - point at UI Consistency & Onboarding Pass
5d1bdc2  v54 shipped - point at Lighting & Atmosphere Pass
```

No such commit exists for v57. That step was simply missed.

## How I verified it, rather than trusting the commit message

I checked the current `runehaven.html` directly against all five parts of
the spec at README.md:555, and then ran the full gauntlet. Every one of the
spec's three "confirmed live" gap claims is **false** of the file as it
stands today:

| Spec claim ("confirmed live") | Actual state of `runehaven.html` |
|---|---|
| PART A — "no floating damage numbers exist anywhere" | `floatTexts` + `addFloat()` exist, tagged `v9` at line 1680 |
| PART B — "no walk-cycle exists" | `function walkStep(t, moving, per)` at line 13438, returns `0` when not moving |
| PART C — "no water tile has any ripple/motion" | line 17253, commented `Animation Pass PART C: the concentric ripple` |
| PART D — tree/canopy sway | present (48 `sway` references) |
| PART E — UI transitions | present |

`debug/run4.js` already carries 43 dedicated gates for this spec, and all 43
pass right now:

```
PART A: 7   PART B: 10   PART C: 8   PART D: 6   PART E: 9
```

Note that `run4.js`'s own header block for these gates (line 9010) says the
same thing I found independently: *"Two of this spec's five 'confirmed live'
claims were not true of the file, and PART A is the one where it matters:
the feature it asks for has existed since v9."*

## Why I stopped instead of building something

Building this spec again would mean either a pure no-op or bolting a second,
parallel animation system next to the working one. The spec's own proof
gates forbid exactly that: *"confirm every part reuses a named existing
technique rather than introducing a parallel system."*

The next unbuilt spec in the README queue is **Consumables** (README.md:625).
I did **not** start it. My standing instruction is to only ever build what
`NEXT_BUILD.md` currently points at, to never choose the next build myself,
and to never edit `NEXT_BUILD.md`. So this needs you.

## What you need to do (one line)

Re-point `NEXT_BUILD.md` at whichever spec you actually want next, then
delete this file. If you want the queue order as written in README.md, that
is Consumables:

```
Build exactly per "Confirmed, locked spec for a future version — Consumables" in README.md.
```

Worth knowing before you pick: the Consumables spec looks like a likely RED
under step 5's fourth bullet ("the spec assumes an entire system exists that
doesn't, AND building it properly needs 3+ genuinely unspecified,
interdependent decisions") — it explicitly calls for a whole consumable-item
framework, which is the example the rule names. You may want to tighten that
spec before pointing at it, or point at a different one.

## Current repo state — green, untouched

Full gauntlet run against the current `runehaven.html` at this commit:

```
run3:  frames pumped, CAUGHT ERROR: none
run4:  1625 PASS / 0 FAIL   (including all 43 Animation Pass gates)
run5:  CAUGHT: none
```

`git status` is clean apart from this file. Nothing was patched, nothing was
reverted.

## Secondary finding, for whenever you next touch the repo

v57 shipped `runehaven.html` (`15903e9`) **without** the `SKILL.md`
changelog entry that standard process step 6 requires. `SKILL.md`'s newest
entry is still `### 2026-09-11 (v56 — UI Consistency & Onboarding Pass)`,
even though v57 was a rendering-heavy pass that clearly belongs in it. I did
not write that entry myself — it is a retroactive changelog for a build I
did not do, and inventing its content is not mine to do. Flagging it so it
does not get silently lost.
