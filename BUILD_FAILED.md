# BUILD FAILED — v52+53 (Session Resume, Colosseum Rework & Guild Tier 2)

**Date:** 2026-09-01
**Spec attempted:** README.md → "Confirmed, locked spec for the next build
(v52+53 combined — Session Resume, Colosseum Rework & Guild Tier 2)", as
pointed at by `NEXT_BUILD.md`.
**Outcome:** STOPPED under README standard-process rule 5 (RED).
**`runehaven.html` is unchanged.** Verified: `git status` clean, file parses.

---

## The blocker, in one sentence

`node debug/run4.js runehaven.html` is **already red on the current file, before
this build changed anything** — **1334 PASS / 6 FAIL, exit 1** — and every one of
the six failures is a stale assertion left behind by the two commits that
shipped immediately before this run, neither of which updated its own proof
gates.

Rule 5 makes any `run4` FAIL line a RED condition that is "never overridden",
and tonight's instruction is that all three harnesses must pass "with zero
errors/FAILs before shipping". That state is not reachable tonight without
making a creative decision that is not mine to make (see **Why I did not just
fix it**, below).

## Proof it is pre-existing and not caused by this build

The `run4` figures above were measured on the **pristine file at HEAD**, before
a single edit was made — that run was started first, deliberately, as the
baseline. The other two harnesses are green on the same pristine file:

| harness | pristine result |
|---|---|
| `node -e` parse check | OK (915,516 script chars) |
| `debug/run3.js` | `CAUGHT ERROR: none` |
| `debug/run4.js` | **1334 PASS / 6 FAIL, exit 1** |
| `debug/run5.js` | 1315 coverage draws, `CAUGHT: none` |

Two commits on this branch changed the game and **touched `runehaven.html`
only** — `debug/run4.js` was not updated in either:

```
bd18816  mount speed halved back (was too fast), pet density doubled via a real
         global multiplier, Duskfox Elder now mountable at 2x the standard rate
         runehaven.html | 19 +++++----   (1 file changed)

b7259dd  Duskfox Elder relocated to a fixed, always-visible spot near Spawn
         Forge - the random hidden twilight-only placement made it unfindable
         again after a failed taming attempt
         runehaven.html | 25 +++++-----  (1 file changed)
```

## The six failing gates, and the exact cause of each

| # | `run4` line | Cause |
|---|---|---|
| 1 | `the mountable set is exactly the bible's nine species` | `bd18816`. `MOUNTABLE_SPECIES` (runehaven.html:12084) now holds **ten** entries — `duskfox_elder` was added. The gate pins `MOUNTABLE.length === 9`. |
| 2 | `PART A: the seat table covers exactly the bible's nine mountable species` | `bd18816`. Same cause: the seat table is derived from `MOUNTABLE_SPECIES`, so it covers ten. |
| 3 | `PART D: the Duskfox Elder exists, and carries the bible's own two rules as flags` | `b7259dd`. The gate requires `def.duskOnly === true`; the `duskOnly` flag no longer exists on `WILD_SPECIES.duskfox_elder` (runehaven.html:2937) — it was removed with the twilight window. |
| 4 | `PART D: and it stands in a Sacred Meadow — the bible's own sacred ground (biome 4)` | `b7259dd`. `duskfoxElderTile()` (runehaven.html:4706) is now hardcoded to `SPAWN_FORGE + (5, -5)`, so its tile is whatever biome that is, not `SACMEADOW`. |
| 5 | `PART D: an admin sees it at twilight and at NO other hour — dawn, noon and night all refuse` | `b7259dd`. Twilight-only visibility was deliberately removed; it is now visible at every hour. |
| 6 | `PART D: and it is NOT mountable — the bible names exactly nine, and this is not one` | `bd18816`. It is now mountable, at 2x the standard rate. |

**The game is not broken.** Each change is deliberate and is documented in the
file itself. `runehaven.html:4700-4705` says so in as many words:

> "Moved to a fixed, always-known spot near the Spawn Forge instead:
> guaranteed reachable, no search... **Twilight-only visibility is
> intentionally REMOVED along with this change** — it is not 'hidden AND only
> visible at dusk' AND 'impossible to relocate', it can only reasonably be one
> of those."

What is broken is the *record*: six gates still assert the behaviour those two
commits replaced.

## Why I did not just fix it

There are only two ways to get to zero FAILs, and neither is mine to take:

1. **Revert the two commits' game changes.** Plainly wrong — they are the
   owner's own deliberate, reasoned decisions, made in-session and explained in
   both the commit messages and the code.

2. **Re-pin the six gates to the new behaviour** ("updated, not relaxed", the
   precedent v19, v23, v27, v33, v35, v39, v46, Mob Rarity, Expansion 2b and
   v51 all followed). This is the right shape of fix — but **two of the six
   would permanently encode a bible deviation**, and rule 3 puts that decision
   with the owner, not with an overnight build:
   - The bible's **MOUNTABLE PETS** line names exactly nine species and the
     Duskfox Elder is not among them. Re-pinning gate 1/2/6 means writing "the
     mountable set is ten, and the tenth is the Duskfox Elder" into a permanent
     proof gate.
   - The bible's **Admin Only** entry reads "One exists in the entire world,
     **twilight sacred grove**, admin account exclusive". Re-pinning gates 3-5
     means retiring both halves of that sentence as proof-gated behaviour.

   That is the same class of call v51 flagged at the top of its own judgment
   list when the guild system contradicted the bible: shippable, but the
   owner's decision to make, not an overnight build's.

Rule 5's tiebreak — "When genuinely unsure which zone something belongs in:
treat it as RED" — settles it.

## What I need from you (one answer unblocks the whole spec)

**Should the six stale `run4` gates be re-pinned to the new deliberate
behaviour?** If yes, say so and the next run will update them (never relax
them) as part of the build, and note the two bible deviations in the changelog
the way v51 noted its own. If instead either change was not meant to be
permanent, say which, and it gets reverted in the game file instead.

Either answer takes the gate to green and the v52+53 spec builds in full.

## State of the v52+53 work

Nothing was shipped. `runehaven.html` is byte-identical to HEAD.

The spec itself was fully read and checked against the live file first, and
**none of its nine parts is blocked** — every anchor the spec names exists, is
unique, and clearly applies. For whoever picks this up next, the findings are
worth keeping:

- **PART A** — confirmed live at `resumeSession()` (runehaven.html:6341):
  `await enterBtn.onclick()` is called on the line after the name is filled,
  with no pause. The pause belongs immediately before that one line, after
  every check that can already refuse the resume (PIN required / no such
  account / lookup unavailable), so the only thing it can interrupt is a submit
  that was genuinely about to happen.
- **PART B** — confirmed live: `COLOSSEUM_R = 9` (runehaven.html:1431) and the
  ring PvP rule at `dealHit()` (`arena37`, runehaven.html:7950). Note that
  growing `COLOSSEUM_R` also grows the PvP zone, the base-building keep-out
  (`LANDMARK_KEEPOUT`, runehaven.html:8911) and the fast-travel exclusion,
  which is correct but should be stated. The `kill` broadcast handler
  (runehaven.html:7404) is the single existing site where a victor is already
  credited, and is where a duel reward belongs.
- **PARTS C-F** — all five Tier 1 values confirmed live and unchanged:
  `GUILD_BREATH_MULT = 1.5`, `GUILD_VEIN_BONUS = 1`, `GUILD_BRAMBLE_MULT = 1.20`,
  `GUILD_BOUGH_TAME = 0.12`, and the Hollow Choir's Tier 1 already bypasses the
  respawn wait entirely (`guildRespawnWaitMs()`), which is why the spec gives it
  a second effect rather than a bigger number. `guild_tier` degrades exactly
  like `role` (v39) and `guild` (v51) — same read-only column pattern, same
  safe direction. Note the spec's wording is deliberately different between two
  of the five: the Drowned Court says "1.5x the Tier 1 **value**" (the constant
  is 1.5, so 2.25) where the Bramblewatch says "1.75x the Tier 1 **bonus**"
  (the bonus is +20%, so +35%, i.e. 1.35).
- **PART G** — confirmed live: the drake uses the generic mob HUD. The file
  already has the exact signal shape needed — `noteElderCombat()` /
  `elderMusicUntil` (runehaven.html:16080) is a linger timestamp pushed forward
  by the fight itself, called from the two sites that know which creature is in
  it, so the bar needs a drake-scoped twin of that and no new detection system.
- **PART H** — the ground-feature density lever is **not** a named constant: it
  is five inline hash thresholds in `featureTypeAt()` (runehaven.html:4442) —
  `ROCK` runic `0.996` / iron `0.93` / rock `0.885`, `VOLROCK` runic `0.992` /
  iron `0.92`. `git log -L` confirms none has moved since v46, so the v47/v49/
  v51 density passes named in the spec moved pets and mobs, not nodes. Because
  `hash2` is uniform, one named lever reproduces a clean cut with the bands'
  ratios preserved exactly: `threshold' = 1 - K * (1 - threshold)`, so `K = 0.65`
  is a true 35% cut of every node band. **Trees must be excluded** — this
  skill's own must-not-regress list (2026-07-11) says "organic tree clustering
  (user likes it — never alter placement/density)" — which also matches the
  report's own words, "ore/resource nodes", and the file's existing definition
  of that set in `GUILD_VEIN_TYPES`.
- **PART I** — the two candidates the spec rules out are confirmed ruled out by
  reading: `tryAttack()` (runehaven.html:7853) resolves melee purely on
  `Math.hypot(...) <= w.range` with no facing term, and click-aim goes through
  `screenToWorld`. The investigation the spec asks for is still owed and is
  unaffected by this blocker.

## To re-verify this report

```
npm install                              # jsdom is not vendored in the repo
node debug/run3.js runehaven.html        # expect: CAUGHT ERROR: none
node debug/run4.js runehaven.html        # expect: 1334 PASS / 6 FAIL, exit 1
node debug/run5.js runehaven.html        # expect: 1315 draws, CAUGHT: none
```
