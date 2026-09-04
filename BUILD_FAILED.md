# BUILD FAILED — 2026-09-04

**Nothing was built. `runehaven.html` is unchanged. No harness failed.**

The blocker is upstream of the code: **`NEXT_BUILD.md` points at a spec that
has already shipped**, and there is no unshipped spec left in `README.md` to
build instead. Per the standing rule ("never decide what to build next on your
own — only ever follow what `NEXT_BUILD.md` currently says, and never edit
`NEXT_BUILD.md` yourself"), this run stopped rather than picking a target.

---

## What `NEXT_BUILD.md` says

```
Build exactly per "Confirmed, locked spec for a future version — The Lighting & Atmosphere Pass" in README.md.
```

That file was last written on **2026-09-03** by commit `5d1bdc2`
("v54 shipped - point at Lighting & Atmosphere Pass") and has not been
touched since.

## Why that spec no longer applies

**The Lighting & Atmosphere Pass shipped as v55**, in two commits that both
land after `5d1bdc2` and are both on `origin/main`:

- `b36c9dd` — "sync v55 (The Lighting & Atmosphere Pass): rim light on 27
  species via one shared helper, real cave darkness, spawn glow, directional
  dawn/dusk light, taming/combat glow, base lighting, world-ending event
  signature — all 9 parts verified directly against source" (777 insertions
  in `runehaven.html`)
- `8a6de4b` — "sync v55 harness updates, corrected a random-seeded flaky gate
  and two real cave-gate signature bugs" (507 insertions in `debug/run4.js`)

Verified directly against the current `runehaven.html` rather than taken from
the commit messages — every one of the spec's nine parts is present and
labelled in source:

| Spec part | Marker in `runehaven.html` | Sites |
|---|---|---|
| A — spawn glow + denser wisps in `SAFE_RADIUS` | `v55 PART A`, `SPAWN_GLOW_RINGS`, `spawnGlowRingsDrawn` | 2 |
| B — time-of-day directional light | `v55 PART B` ("the four numbers time of day is made of") | 3 |
| C — shared creature rim light | `v55 PART C` — the `rimLight` helper | 1 helper, 30 call sites |
| D — combat embers + staff afterglow + Drake pulse | `v55 PART D` | 12 |
| E — tame burst in the creature's own colour | `v55 PART E`, `TAME_BURST_FALLBACK` | 4 |
| F — cave darkness between light sources | `v55 PART F`, `caveDark` | 2 |
| G — base light from a Forge/Generator at night | `v55 PART G` | 2 |
| H — per-source travel effects | `v55 PART H`, `travelEffect("landmark"/"player")` | 4 |
| I — world-ending event signature | `v55 PART I`, the wisp storm | 3 |

`debug/run4.js` also already contains dedicated v55 gates that pass, including
the spec's own proof gates (`v55 GATE 1`–`GATE 4`: every part reuses a named
existing primitive, 30 rim call sites, 12 gradients unchanged with none inside
a v55 block, particle budget unchanged).

Rebuilding this spec on top of itself would double-apply the effects, so it
was not attempted.

## And there is nothing else queued

`README.md`'s three spec sections have all shipped:

- "next build (v52+53 …)" → shipped in `022180f`
- "QUEUED FOR AFTER v52+53 … (Spawn Ambience & Empty-Biome Visual Pass)" →
  shipped as v54 in `617f529`
- "QUEUED, AFTER EVERYTHING ELSE … (The Lighting & Atmosphere Pass)" →
  shipped as v55, above

`README.md` was last touched on 2026-09-02 (`db84bb1`), before v54 and v55
shipped, so neither its ordering headers nor `NEXT_BUILD.md` reflect the
current state. There is no fourth spec to fall through to.

## What is needed to unblock

One of these, from you — not from a build:

1. Write the next locked spec into `README.md`, and repoint `NEXT_BUILD.md`
   at it (the precedent for "caught up, nothing to do" is `8d174b4`,
   "v50 shipped - nothing queued"); **or**
2. If some part of the Lighting & Atmosphere Pass was meant to be redone or
   was judged wrong in the shipped v55, say which part specifically — a
   re-do of a named part is buildable, a blind re-run of the whole spec is
   not.

Delete this file once `NEXT_BUILD.md` points somewhere live again.

---

## Current build state (checked, not assumed)

The tree is healthy — this is a "no target" stop, not a broken build.

- `node debug/run3.js runehaven.html` → `frames pumped, CAUGHT ERROR: none`
- `node debug/run5.js runehaven.html` → `coverage draws: 1315 — CAUGHT: none`
- `node debug/run4.js runehaven.html` → **1506 `PASS`, zero `FAIL`**

## One real gap noticed while checking, not fixed here

**`runehaven-art-style/SKILL.md` has no changelog entry for v52, v53, v54 or
v55.** Its newest entry is v51. The v55 commit `b36c9dd` changed
`runehaven.html` only, so step 6 of the standard process ("commit
`runehaven.html` and `SKILL.md` together with a new dated changelog entry")
did not complete for the largest rendering change in several versions — 777
lines of new lighting code across nine parts, with no record in the skill that
is supposed to be read in full before any rendering change.

This is the same drift the file already flags for v47–v50 ("⚠️ v47, v48, v49
and v50 have no entries in this file at all"), now four versions wider. It was
**not** backfilled here, for the same reason that note gives: reconstructing
four versions' rendering notes after the fact is writing history rather than
recording it, and v55's rendering decisions are not this session's to narrate.
Worth a deliberate call from you — either backfill v55 from its own source
comments while they are still fresh, or accept the gap knowingly.
