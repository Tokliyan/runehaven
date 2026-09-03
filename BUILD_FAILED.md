# BUILD_FAILED — 2026-09-03

**Nothing was built tonight, and `runehaven.html` is untouched.** This is a
STOP under the standard process, not a broken build. The blocker is a stale
pointer, not a bug.

## What blocked it

`NEXT_BUILD.md` currently says, in full:

> Build exactly per "Confirmed, locked spec for a future version — The
> Lighting & Atmosphere Pass" in README.md.

That spec is `README.md:322`, and **it has already been built and shipped.**
It went in as v55, commit `b36c9dd` ("sync v55 (The Lighting & Atmosphere
Pass)", 777 insertions into `runehaven.html`), with harness updates following
in `8a6de4b`.

So the spec does not apply to the current state of `runehaven.html` — it
describes work that is already present in it. Per the standard process, that
is a STOP: building it again would either be a no-op or would duplicate and
risk damaging a working, verified section of a shipped version. `NEXT_BUILD.md`
has deliberately not been edited.

## How this was verified (not taken from the commit message)

All nine parts are present in the current `runehaven.html`, each carrying its
own `v55 PART x` marker:

| Spec part | Marker line in `runehaven.html` |
|---|---|
| PART A — spawn safe-zone glow      | 11442 |
| PART B — dawn/dusk directional light | 11653 |
| PART C — creature rim light        | 12865 |
| PART D — combat light              | 899 |
| PART E — taming burst              | 7453 |
| PART F — real cave darkness        | 15943 |
| PART G — base light at distance    | 9686 |
| PART H — travel/Elder signatures   | 10396 |
| PART I — world-ending signature    | 7797 |

`debug/run4.js` already carries a full block of dedicated v55 assertions
(PART F/G/H/I plus GATE 1–4, including the "no new gradients" and particle
budget gates the spec's own proof gates call for). Every one passes.

## The gauntlet was run anyway, against the current committed state

| Check | Result |
|---|---|
| `new Function(scriptText)` parse | OK — 1 script block, no throw |
| `node debug/run3.js runehaven.html` | `CAUGHT ERROR: none` |
| `node debug/run4.js runehaven.html` | **0 FAIL** (all PASS) |
| `node debug/run5.js runehaven.html` | `coverage draws: 1315 — CAUGHT: none` |

The shipped v55 build is green. Nothing is broken and nothing needs fixing.

*(Note: `debug/` needs `npm install` first — `jsdom` was not present in this
environment. That is an environment detail, not a repo problem.)*

## What is needed to unblock the next run

**Point `NEXT_BUILD.md` at a spec that has not been built yet.** Every spec
currently written into `README.md` has shipped:

- v52+53 (Session Resume, Colosseum, Guild Tier 2) — `README.md:105`
- Spawn Ambience & Empty-Biome Visual Pass — `README.md:247` — shipped as v54 (`617f529`)
- The Lighting & Atmosphere Pass — `README.md:322` — shipped as v55 (`b36c9dd`)

So a genuinely new locked spec needs to be appended to `README.md` and
`NEXT_BUILD.md` repointed at it. Deciding what that should be is explicitly
not this routine's call to make.

## Three side observations, flagged but deliberately not acted on

These are outside tonight's scope and were left alone rather than fixed
unilaterally. They are worth a look:

1. **`SKILL.md` is missing changelog entries for v54 and v55.** Its newest
   dated entry is `### 2026-09-01 (v51 …)`. Standard process step 6 requires
   a dated changelog entry for rendering-scope changes, and both v54 and v55
   were heavily rendering-scoped — v55 especially, being an entire lighting
   pass. Both shipped `runehaven.html` without the paired `SKILL.md` entry.
   Writing those entries after the fact was not attempted here, because doing
   so would mean reconstructing the intent of builds this session did not
   perform.

2. **`debug/run5.js` was not extended for v55** (standard process step 7).
   It contains no `v55` or `rimLight` references, so the rim-light helper's
   call sites are not part of the branch-coverage sweep. `run4.js` does cover
   them, so this is a coverage gap rather than an untested feature.

3. **`origin/main` and this branch share no common ancestor.** `git merge-base
   origin/main HEAD` returns empty — they are two unrelated histories.
   `origin/main` is stalled at v47 (`6cc0f2c`, 2026-08-27); the working branch
   `claude/dazzling-planck-qmqcnv` carries everything through v55. Standard
   process step 8's "push to main as a nice-to-have" cannot work as written
   while the histories are unrelated, and this needs a human to reconcile —
   it was not forced from here.
