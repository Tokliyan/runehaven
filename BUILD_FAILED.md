# BUILD_FAILED — 2026-09-25 (scheduled run)

**Nothing was built and `runehaven.html` is unchanged.** The run stopped at the
very first step, before any patch was designed, for one reason:

## What blocked it

`NEXT_BUILD.md` currently says, in full:

> Build exactly per "Confirmed, locked spec for a future version — Matched-Tier
> Gear Bonus" in README.md.

**That spec has already shipped.** It is `HEAD` of this branch — commit
`191c43e`, "v59 (Matched-Tier Gear Bonus)", authored 2026-09-24. It is not a
partial or abandoned attempt; it is a complete, gated version:

- `runehaven.html:1226` — `const ARMOR_MATCH_BONUS = 0.05;` (flat, marked
  TUNABLE, with the reasoning for the number in the comment block above it)
- `runehaven.html:1232` — `matchedGearTier()`, which requires both sides to
  carry a genuine, identical, truthy tier string (so `null === null` from bare
  fists + empty armour slot does **not** read as a match)
- `runehaven.html:1244` — `armorReduceNow()`, the single place the bonus is
  ever added; `applyDamage` multiplies by it instead of reading `arm.reduce`
- PART B is structural, not promised: a mismatched loadout returns the
  armour's own untouched `reduce`, exactly what `applyDamage` used before v59
- `debug/run4.js` carries 15 matched-tier gates (`gear P:` / `gear:`), all
  PASS; `debug/run5.js` coverage was extended in the same commit
- `runehaven-art-style/SKILL.md:56` — `### 2026-09-24 (v59 — Matched-Tier
  Gear Bonus)` changelog entry

So the pointer is stale: v58 shipped and `NEXT_BUILD.md` was advanced to the
Gear Bonus (commit `4d56af8`), then v59 built the Gear Bonus but
`NEXT_BUILD.md` was never advanced past it.

This is the README's RED-by-default case — "the spec doesn't clearly apply to
the current state of `runehaven.html`" — and the routine prompt forbids both
choosing the next build independently and editing `NEXT_BUILD.md`. Rebuilding
v59 on top of itself would either no-op or double-apply a shipped bonus, so
nothing was touched.

## The current state of the repo is healthy, not broken

The full gauntlet was run tonight against the unchanged `runehaven.html`, to
be sure this is only a stale pointer and not a failed v59:

- `node debug/run3.js runehaven.html` → `CAUGHT ERROR: none`
- `node debug/run4.js runehaven.html` → all PASS, zero FAIL
- `node debug/run5.js runehaven.html` → `CAUGHT: none`

(`node_modules` is not committed; `npm install` was needed first in this fresh
container. ECC was **not** verified or installed this run — Step 0 was never
reached, because no spec work started.)

## What unblocks it (a human decision, one line of editing)

Point `NEXT_BUILD.md` at whichever spec should be next. For reference only —
this is not a recommendation this run is allowed to make — the README's own
queue order puts the next unbuilt spec at line 737:

> `## QUEUED, AFTER THE GEAR BONUS PASS — do not build until all specs above ship.`
> `## Confirmed, locked spec for a future version (World Encounters — Roaming Boss & Bounty Board)`

One other thing worth a look while deciding: several earlier
`## Confirmed, locked spec ...` headings remain in README.md for versions that
have already shipped (Consumables at line 645, the Gear Bonus at line 701).
The headings alone no longer tell you what is outstanding; `NEXT_BUILD.md` plus
the git log does.

`main` is fine and needs no sync — it is at `191c43e`, v59 itself, so
standard-process step 8's direct push to `main` did land last night. The stale
`NEXT_BUILD.md` is on `main` too, which is why it has to be the fix.

Once `NEXT_BUILD.md` points somewhere unbuilt, delete this file and the next
scheduled run will proceed normally.
