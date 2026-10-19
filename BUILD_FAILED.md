# BUILD FAILED — nightly 2026-10-19

**Nothing was built. `runehaven.html` is byte-for-byte unchanged.**

`NEXT_BUILD.md` points at **Mobile & Touch**. That spec was never started,
because the build it would have landed on is already RED: `main`
(`e66b2d0`) fails three of its own `run4` gates before any patch is applied.

README's "standard process" step 5 makes this an unconditional stop — *"Any
test harness actually fails ... this is the mechanical, objective signal that
something is genuinely broken. Never overridden."* Shipping a ~1000-line
input/CSS change on top of a red baseline would also destroy the one signal
that proves the change broke nothing.

## Baseline measured tonight, on an untouched tree

| check | result |
|---|---|
| `new Function(scriptText)` parse | OK (1,211,983 chars) |
| `node debug/run3.js runehaven.html` | `CAUGHT ERROR: none` |
| `node debug/run4.js runehaven.html` | **1857 PASS / 3 FAIL** |
| `node debug/run5.js runehaven.html` | 1366 coverage draws, `CAUGHT: none` |

Deterministic: run4 was run twice, same three FAILs, same counts.

All three come from the volcano cone in commit `5253d28`, whose own message
says **"work in progress"** — `Gauntlet S2 round 2+3 ... five-tier volcano
with moat ...`. It was merged to `main` through PR #2 (`e66b2d0`), so the
nightly's base is now a mid-flight gauntlet tree. Nothing in the failing set
is related to Mobile & Touch.

## Blocker 1 — the cone's base corner stands in shallow water (2 FAILs)

```
FAIL - S2 R2: and it stands only on lava — every tile under its base is LAVA (BLOCKED ground nobody stands on)
FAIL - S2 R3: the cone is five tiers and 96px to the crater, its whole base still on lava
```

Both gates assert an **11x11 square** of `B.LAVA` around the cone's centre
tile. Measured on the harness seed (123456789) with a read-only probe:

```
cone site: {x: 2506.5, y: 845.5}    VOLCANO: {x: 2502, y: 845}
non-LAVA tiles in the gates' 11x11 square: 1
    offset (-5,-5)  ->  biome=2 (B.SHALLOW)  h=-1   |dx|+|dy| = 10
```

The cause is an off-by-0.06 between the footprint and the test that guards it.
`volcanoConeSite()`'s `allLava()` (runehaven.html:16125) skips any offset where
`Math.abs(dx) + Math.abs(dy) > VCONE_R * 1.42`, and `VCONE_R` is 7.0, so the
cutoff is **9.94** — while the square's corners sit at exactly **10**. The four
corners of the base are therefore never tested for lava.

This is not only a gate quibble. The widest tier is `VCONE_TIERS[0]` at 9.6
tiles, centred on 2506.5/845.5, so its footprint spans x 2501.7-2511.3 and
y 840.7-850.3 — tile (2501, 840) really is under it. **The cone's NW base
corner genuinely overhangs a shallow-water tile.** S2 R3 widened the base
(`VCONE_R` 6.6 -> 7.0, comment: *"for the wider base"*) without widening the
mask to match the footprint it now has.

**This needs an owner decision, which is why the night stopped rather than
guessing.** Two fixes, with different costs:

1. **Make the search guarantee the square the gates assert** — raise the
   cutoff (`VCONE_R * 1.42` -> `VCONE_R * 1.5`, or drop the diamond mask and
   test the full square). Correct, and it fixes the real visual defect. But it
   makes siting stricter, so **the cone moves on an unknown share of seeds** —
   the same "the live world moves" YELLOW already flagged for 2026-10-13.
2. **Relax both gates to the diamond the implementation guarantees.** One-line
   each, no world movement — but it is a weakened gate that stops asserting
   its own claim, and it leaves the base corner in water. `gate-integrity`
   forbids this without a stated reason.

Recommendation, not applied: option 1. It is the one that fixes the thing the
gate is actually catching. The cost is purely that the volcano cone relocates
on some seeds, which is cosmetic and already an accepted class of change.

## Blocker 2 — a stale grep anchor in `debug/run4.js` (1 FAIL)

```
FAIL - WCF G: no plate or vent sits in front of higher ground — 0 of 27418 overlaid tiles (diagonal neighbour included)
```

**The measured half of this gate passes** — `0 of 27418`, exactly what it
wants. It fails only on its source grep (debug/run4.js:10999):

```js
gameScript.indexOf('const crusted = interiorLava && lavaCrustAt(tx, ty);') > 0
```

S2 R3 extended that line for the moat, so runehaven.html:19101 now reads:

```js
const crusted = interiorLava && lavaCrustAt(tx, ty) && !inConeMoat(tx, ty);   // S2 R3: the cone's foot stays molten
```

Fixing this is a one-line anchor update in the harness that keeps the gate's
claim intact (`UPDATED, not relaxed`). It was **not** applied tonight: it
cannot get the build to zero FAILs on its own, and editing the harness on a
night that ships nothing would only add noise to a branch the owner is
mid-gauntlet on.

## What the owner needs to do

1. Decide blocker 1 (option 1 or option 2 above) — this is the only genuine
   decision in the way.
2. Apply the one-line `run4.js` anchor fix for blocker 2.
3. Confirm `run4` is back to 0 FAIL, then delete this file.

`NEXT_BUILD.md` was not touched and still points at Mobile & Touch, so the
next nightly builds it as soon as the baseline is green.

## Not the blocker

Mobile & Touch itself was read and still applies cleanly to the current file:
`runehaven.html` has 0 `touchstart`, 0 `pointerdown` and 0 `@media`
occurrences, and the viewport meta is still
`width=device-width, initial-scale=1.0` — exactly the state the spec's "Why
this is next" describes. No ambiguity was found in the spec itself and no
patch anchor was tested, because no patch was attempted.
