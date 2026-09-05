# BUILD FAILED — 2026-09-05

**Nothing was built. `runehaven.html` is unchanged.** No patch was attempted,
so there is nothing to revert.

## What blocked the run

`NEXT_BUILD.md` currently reads:

> Build exactly per "Confirmed, locked spec for a future version — The
> Lighting & Atmosphere Pass" in README.md.

**That spec has already been built and shipped.** It landed as v55 in commit
`b36c9dd` ("sync v55 (The Lighting & Atmosphere Pass)"), with harness updates
following in `8a6de4b`. `NEXT_BUILD.md` was last changed in `5d1bdc2` ("v54
shipped — point at Lighting & Atmosphere Pass") and was never advanced after
v55 landed, so the pointer is stale.

This is a RED stop under README step 5: the spec does not apply to the current
state of `runehaven.html`, because it is already applied. Re-running it would
mean re-patching code that already exists, against anchors the spec's own
"confirmed live" statements no longer describe.

## Evidence the spec is already in the file

Every one of the nine parts is present in `runehaven.html`, marked in-source:

| Part | `v55 PART x` markers in `runehaven.html` |
|------|------------------------------------------|
| A — spawn glow            | 2  |
| B — time-of-day lighting  | 3  |
| C — creature rim light    | 1 (the shared helper) |
| D — combat light          | 12 |
| E — taming burst          | 4  |
| F — cave darkness         | 2  |
| G — base light at night   | 2  |
| H — travel effects        | 4  |
| I — world-ending signature| 3  |

PART C's shared helper resolves to 6 `rimLight` references. The two prior
queued specs are also already shipped: v52+53 in `022180f`, v54 in `617f529`.

## Why the run stopped instead of choosing something else

The standing instruction is to build only what `NEXT_BUILD.md` points to, never
to decide the next version independently, and never to edit `NEXT_BUILD.md`
from inside a build. All three queued specs in `README.md` have now shipped and
there is no unbuilt spec left in the file, so there was no correct next target
to fall back to.

## What is needed to unblock

One of:

1. Add a new locked spec section to `README.md` and point `NEXT_BUILD.md` at it, or
2. Point `NEXT_BUILD.md` at an existing unbuilt spec, if one is intended that
   the run could not find.

Then delete this file.

## Separate finding, not the blocker

`runehaven-art-style/SKILL.md` has no changelog entry for v52+53, v54, or v55 —
its most recent entry is still **2026-09-01 (v51)**. README step 6 requires a
dated changelog entry per shipped version, and the three v5x ship commits
(`022180f`, `617f529`, `b36c9dd`) each touched only `runehaven.html`. Three
versions of rendering work are therefore undocumented in the skill.

This was **not** fixed here: reconstructing three versions of changelog from
diffs after the fact is not what `NEXT_BUILD.md` points to, and writing it
would mean inventing the reasoning behind decisions this run did not make.
Flagging it for a decision instead.

## Health of the current shipped build (read-only check, no changes made)

The full gauntlet was run against the unmodified `runehaven.html` to confirm
that what is live is sound:

- `node debug/run3.js runehaven.html` → `frames pumped, CAUGHT ERROR: none`
- `node debug/run4.js runehaven.html` → **1506 PASS, 0 FAIL**
- `node debug/run5.js runehaven.html` → `coverage draws: 1315 — CAUGHT: none`

So v55 as shipped is green on all three. The blocker is purely the stale
pointer, not a broken build.

Note: `npm install` was required first — `node_modules/` was absent and every
harness needs `jsdom`. That is expected in a fresh clone (`node_modules` is
gitignored), not a repo problem.
