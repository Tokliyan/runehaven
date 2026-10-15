# BUILD FAILED — 2026-10-15 (nightly)

**Tonight's build did not start. `runehaven.html` is unchanged.**

`NEXT_BUILD.md` points at **Mobile & Touch**. That spec is fine and still
applies cleanly — I checked every assumption it makes about the current file
and they all hold. The blocker is upstream of it: **the branch this session
was handed is already failing its own gate before a single character is
edited.**

## The blocker

Baseline, on a clean working tree at `claude/stoic-tesla-vi46gf`
(`e66b2d0`, the merge of PR #2), with `npm install` fresh and nothing
touched:

| harness | result |
|---|---|
| `node debug/run3.js runehaven.html` | `CAUGHT ERROR: none` — clean |
| `node debug/run5.js runehaven.html` | `CAUGHT: none` — clean |
| `node debug/run4.js runehaven.html` | **1857 PASS / 3 FAIL** |

Run twice, start to finish. Byte-identical both times — 1857/3 each run, the
same three lines. Not a flake.

README step 4 requires run4 all-PASS/zero-FAIL *before shipping*, and step 5
lists "any `run4` line is `FAIL`" as RED and says it is never overridden. So
Mobile & Touch cannot ship tonight no matter how well it is built: it would
land on top of three failures and the gate would still be red.

## The three failures, diagnosed

All three were introduced by `5253d28` — "Gauntlet S2 round 2+3 **(work in
progress)**" — which came in through PR #2. They are S2 round 3 volcano work,
not Mobile & Touch.

### 1. `WCF G: no plate or vent sits in front of higher ground` — a stale gate string

The gate's *measured* claim passes: **0 of 27418** overlaid tiles sit in front
of higher ground. What fails is one of the three source greps beside it. The
gate looks for this exact line:

```
const crusted = interiorLava && lavaCrustAt(tx, ty);
```

S2 R3 deliberately changed it (`runehaven.html:19101`):

```
const crusted = interiorLava && lavaCrustAt(tx, ty) && !inConeMoat(tx, ty);   // S2 R3: the cone's foot stays molten
```

The other two greps in the same gate still match. So this is a gate whose
text was left behind by a legitimate code change — but **repairing it is a
gate edit**, and `.claude/skills/gate-integrity` exists precisely to stop a
build quietly rewriting checks it did not author. Not something tonight's
spec authorises me to do.

### 2 and 3. The volcano cone's base is not all lava — a real geometry mismatch

- `S2 R2: and it stands only on lava — every tile under its base is LAVA`
- `S2 R3: the cone is five tiers and 96px to the crater, its whole base still on lava`

Both assert the same thing: that the 11x11 (`±5` tile) square around
`volcanoConeSite()` is entirely `B.LAVA`. I probed it on the pinned harness
seed `123456789` through the real boot path:

```
VOLCANO    2502,845
cone site  2506.5,845.5
non-LAVA tiles in the ±5 square the gates assert: 1 of 121
  dx,dy = -5,-5  ->  SHALLOW   (|dx|+|dy| = 10)
```

One corner tile, and it is water. The cause is a mismatch between the site
search and the gates:

- `volcanoConeSite()`'s `allLava()` skips any tile where
  `|dx| + |dy| > VCONE_R * 1.42`. With `VCONE_R = 7.0` that threshold is
  **9.94**, so all four corners of the `±5` square (sum = 10) are **never
  checked** — the search can and does accept a site with water in a corner.
- The two gates check the full square, corners included.

The `VCONE_TIERS` and `VCONE_TOP` regexes in gate 3 both match the file, so
the lava check is the only failing part of each.

## Why I did not fix it and build anyway

Every repair here is a design decision that nobody has made, on the exact
feature S2 is still actively scoring (the changelog's own "Still open" list
leads with the Volcano):

1. **Widen `allLava()`'s mask** to cover the square the gates claim — but the
   search already scans out to `r = 60` and can return `null`, and a stricter
   mask makes that more likely. On a seed where it fails there is no cone at
   all, which is worse than a wet corner.
2. **Narrow the two gates** to the diamond the predicate actually checks —
   that is relaxing a gate to match the code, the one thing gate-integrity
   forbids.
3. **Move or shrink the cone** (`VCONE_R`, `VCONE_MOAT`, the tier table) —
   changes the Volcano's look, which is what the scorecard is measuring.

That is three interdependent, genuinely unspecified decisions with real
visual consequences. README step 5 calls that RED, and the nightly prompt is
explicit that I never choose what to build: `NEXT_BUILD.md` says Mobile &
Touch, and the volcano cone is not Mobile & Touch. So I stopped rather than
guess, and rather than ship a build that fails its own gate.

## What unblocks the next night

Any **one** of these, from the owner:

1. **Finish or revert S2 round 3.** Either land the rest of the round so the
   three gates pass, or revert `5253d28` so the branch is green and the
   nightly has a clean base. One decision, and the nightly runs again.
2. **Or rule on the cone base** — pick (1), (2) or (3) above and say so in
   the README's OWNER DECISIONS, and the next session can apply it as a
   stated decision rather than a guess.
3. **Or say in `NEXT_BUILD.md`** that fixing the S2 R3 gates is the build,
   and the next session will do exactly that instead of Mobile & Touch.

Mobile & Touch itself is ready to go the moment the baseline is green. I
re-verified every assumption in the spec against the current file and found
no drift: `runehaven.html` still has zero `touchstart`/`pointerdown` handlers
and zero `@media` rules, and every anchor the spec names is present — the
four `raw*` key lines in `update()`, the `canvas` `mousedown` handler,
`screenToWorld`, `tryAttack`/`tryAbility`/`toggleMount`/`toggleDive`/
`startTaming`/`cancelTaming`, `KEYBINDS`/`KEYBIND_DEFAULTS`, the
`rh_settings` storage, and `#hudMinimap`/`#hudMap`/`#hudZone`/`#hudPrompt`/
`#hudHelp`. Playwright and Chromium are available here, so PART E's phone
mode and the overlap measurement can be built and checked for real.

One thing the next session should know before it starts PART A: `jsdom` has
**no `window.matchMedia`** (checked, jsdom 30.0.1). The touch-layer check
has to be written so it is both safe when `matchMedia` is absent and
re-readable after the harness stubs it, or the spec's first proof gate cannot
be written.

## Housekeeping

- `runehaven.html` untouched — `git status` was clean at baseline and the only
  file this session adds is this report.
- `runehaven-art-style/SKILL.md` untouched: no rendering change was made, so
  there is no changelog entry to add.
- `NEXT_BUILD.md` untouched, as the nightly prompt requires.
- Night Run (README step 9): reported, `status: "fail"`, with the blocker in
  `needs_you`.
