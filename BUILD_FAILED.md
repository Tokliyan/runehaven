# BUILD_FAILED — 2026-08-07 (nightly run)

**Nothing was built tonight. Nothing is broken. `runehaven.html` was not
touched.**

This is a "no target" stop, not a failure of the code. Read the one-line fix
at the bottom.

## What blocked the run

`NEXT_BUILD.md` currently says:

> Build exactly per the "Confirmed, locked spec for the next build — v19"
> section in README.md.

**v19 has already been built, verified, committed and merged.** The spec it
points at is fully implemented in the current `runehaven.html`, so there is no
work in it left to do. Per the standard process, when the spec doesn't apply
to the current state of the file, the run stops rather than guessing at a
target — and the v19 spec itself closes with:

> After v19 ships successfully, do not start any further version
> automatically — wait for `NEXT_BUILD.md` to be updated with the next target.

I did not pick a target myself, and I did not edit `NEXT_BUILD.md` — both are
explicitly forbidden.

## Evidence that v19 is already shipped

Git history (`main` and `claude/dazzling-planck-m9jdt7` are at the same
commit, `38a328c`, with no diff between them):

```
38a328c sync: bring v19 run5.js onto main
ec289ae sync: bring v19 run4.js onto main
b8d39aa sync: bring v19 run3.js onto main
211e63e sync: bring v19 SKILL.md onto main
3a98211 sync: bring v19 runehaven.html onto main
e8fc633 v19: widen biome pockets further per confirmed preference (/4 -> /20)
71b1563 point NEXT_BUILD.md at v19
```

`runehaven-art-style/SKILL.md` already carries a dated v19 changelog entry
(2026-08-05, "world scale-up, N 80 → 240") with its JUDGMENT CALLS section.

Spec conformance re-checked directly in the live file tonight:

| Spec item | Expected | Found |
|---|---|---|
| Part A — `const N` | 240 | 240 (line 277) |
| `SAFE_RADIUS` | 27 | 27 (line 282) |
| VOLCANO / MOUNT / RUIN radius from TOWER | 75 / 72 / 57 | 75 / 72 / 57 |
| VOLCANO / MOUNT / RUIN spawn buffers | `+42` / `+36` / `+24` | all present |
| MOUNT↔VOLCANO, RUIN↔VOLCANO, RUIN↔MOUNT | 78 / 42 / 42 | 78 / 42 / 42 |
| `placeLandmarks` clamp margin | 36 | 36 |
| `elevRaw` dTower / dMount divisors | 120 / 36 | 120 / 36 |
| PEAK→ROCK buffer near volcano | 42 | 42 |
| Safe-zone grass / flatten checks | `+6` / `+9` | both present |
| Wild-pet / mob spawn exclusion | 36 / 42 | 36 / 42 |
| Part C — rare-biome noise wavelength | `/20` | `/20`, all three overlays |
| Old pre-v19 values (`+14`, `+12`, `+8`, `tx / 4`) | absent | 0 occurrences |

## Proof the current build is healthy (run tonight, unmodified file)

```
node debug/run3.js runehaven.html   -> login hidden: true, CAUGHT ERROR: none
node debug/run4.js runehaven.html   -> 151 PASS, 0 FAIL
node debug/run5.js runehaven.html   -> 492 coverage draws, CAUGHT: none
```

(`jsdom` is not vendored in the repo; it was installed with
`npm install jsdom --no-save` to run the harnesses. Not committed.)

So: the gauntlet is green on the shipped v19. There is no defect here for a
future run to fix — **do not try to "fix" anything in `runehaven.html` on the
strength of this file.**

## How to unblock

Update `NEXT_BUILD.md` to point at the next target, and delete this file.

The obvious candidate, from the v19 spec's own text, is **v20 — Underwater
Caves / Water Dragon / Sea Serpent**, which v19 deliberately deferred. But
there is no locked v20 spec section in `README.md` yet, so that spec has to be
written before a nightly run can build it. Choosing it, or writing it, is a
human decision — that is exactly why this run stopped instead of proceeding.

Minor unrelated observation, left alone deliberately: `README.md` line 11 still
describes `runehaven.html` as "currently v16". Stale comment only, no effect on
anything, and out of scope for tonight.
