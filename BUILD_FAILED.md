# BUILD FAILED — 2026-10-17 nightly (Mobile & Touch)

**Nothing was built tonight. `runehaven.html` is byte-for-byte unchanged.**

`NEXT_BUILD.md` points at README's "Confirmed, locked spec for a future
version (Mobile & Touch)". That spec was never started, because the gate
run every build has to pass was **already red before a single character
was patched**.

## The blocker

`node debug/run4.js runehaven.html` on the current `main` (and on the
designated branch, which is identical to it — `e66b2d0`):

```
1857 PASS
FAIL - WCF G: no plate or vent sits in front of higher ground — 0 of 27418 overlaid tiles (diagonal neighbour included)
FAIL - S2 R2: and it stands only on lava — every tile under its base is LAVA (BLOCKED ground nobody stands on)
FAIL - S2 R3: the cone is five tiers and 96px to the crater, its whole base still on lava
```

run3 is clean (`CAUGHT ERROR: none`) and run5 is clean (`CAUGHT: none`).
The three FAILs are **pre-existing** and **deterministic** — two full run4
runs produced the identical three lines and the identical 1857 PASS, and
each was then root-caused on a standalone boot of the same seed.

This is README step 5's first RED condition ("any `run4` line is `FAIL` …
Never overridden"), so the build stopped there and `runehaven.html` was
left alone.

## Where they come from

Commit `5253d28` — *"Gauntlet S2 round 2+3 (work in progress)"* — says so
in its own message: **"Gates for round 2/3 not yet green; stage not merged
to main."** It was merged to `main` anyway in PR #2 (`e66b2d0`), so `main`
now carries a knowingly-unfinished stage. Every nightly from here is
blocked by it, not just this one. `GAUNTLET_PROGRESS.md` still lists S2
round 2 as IN PROGRESS.

## Root cause of each, measured

### 1. `WCF G` — a stale source grep, not a broken behaviour

The gate's own measurement **passes**: `overRim = 0` of `drawn = 27418`.
It fails on one of the three source strings it also greps for:

| grep string (run4.js:10996-11000)                             | hits |
|---------------------------------------------------------------|------|
| `biomeAt(tx + 1, ty + 1) === B.LAVA;`                           | 1    |
| `const crusted = interiorLava && lavaCrustAt(tx, ty);`          | **0** |
| `if (interiorLava && lavaVentAt(tx, ty)) {`                     | 1    |

Round 3's moat work rewrote that line to:

```js
const crusted = interiorLava && lavaCrustAt(tx, ty) && !inConeMoat(tx, ty);
```

…which the round-3 gate at run4.js:11390 asserts by name. So round 3
changed the line and never updated the older WCF G gate that pins it.

**Fix:** update WCF G's grep to the current line. The gate keeps its claim
(`overRim === 0` is doing the real work and already passes); only the
pinned source text moves. Mechanical, not a relaxation.

### 2 + 3. The two cone gates — one tile, square vs diamond

Both assert the same thing over the same 11×11 square, so they fail
together. Seed `123456789` (the seed run4's S2 block uses):

- cone site: `{x: 2506.5, y: 845.5}`
- non-lava tiles inside the 11×11 the gates check: **1**
- the offending tile: `dx = -5, dy = -5` (biome id 2, not `B.LAVA`)

The mechanism is a shape mismatch between the gates and the code:

- `volcanoConeSite()` (`runehaven.html:~16103`) accepts a centre when every
  tile with `|dx| + |dy| <= VCONE_R * 1.42` is lava. With `VCONE_R = 7.0`
  that threshold is **9.94** — a diamond.
- The four corner tiles of the gates' square sit at `|dx| + |dy| = 10`, so
  the search never looks at them.
- But the widest tier is `VCONE_TIERS[0] = [9.6, 0, 22]` and `drawBox()`
  centres its footprint, so the base spans **±4.8 tiles** and really does
  reach into tile offsets −5 and +5 on both axes.

So the gates assert the right thing and the code checks the wrong shape:
the base can be — and on this seed is — drawn with one corner hanging over
non-lava ground.

**Recommended fix:** make `allLava()` in `volcanoConeSite()` check the
square the widest tier actually touches rather than a diamond — accept a
centre only when every tile with `|dx| <= 5 and |dy| <= 5` is lava. That
makes the code match the claim the gates already make, and is the reading
the tier table itself supports.

**Alternative:** decide the diamond is the intended footprint and correct
both gates to assert it. That *relaxes* a gate, which
`.claude/skills/gate-integrity/SKILL.md` treats as something to justify out
loud, so it should be a deliberate decision rather than the quiet option.

## Why this nightly did not just fix it

Fix 1 is a harness-text change inside the gauntlet's own in-flight stage.
Fixes 2/3 are a **rendering change** to that stage: a stricter site search
can relocate the cone, and round 3's moat, occlusion and night-render gates
are all measured relative to the site it returns. That belongs with the
person running the gauntlet, with its before/after contact sheets and its
frame-rate budget — not with a nightly whose spec is Mobile & Touch, and
whose instructions say to stop rather than guess.

## To unblock the nightlies

1. Update WCF G's grep string (fix 1), and apply one of the two options for
   the cone (fixes 2/3), on `main`.
2. Re-run all three harnesses; `run4` must be `0 FAIL`. Expect the other
   round-3 cone gates (moat, night volcano frame) to move with the site —
   read them, do not assume.
3. Delete this file. The next nightly will then build Mobile & Touch from
   `NEXT_BUILD.md` as normal.

## Tonight's run, for the record

- Baseline established before any edit: run3 clean, run4 **1857 PASS / 3
  FAIL**, run5 clean (`coverage draws: 1366 — CAUGHT: none`).
- All three FAILs confirmed deterministic across two full run4 runs and
  root-caused individually.
- `runehaven.html`, `runehaven-art-style/SKILL.md` and `NEXT_BUILD.md` were
  **not** modified.
- No part of the Mobile & Touch spec was implemented, so nothing
  half-finished is sitting in the tree.
