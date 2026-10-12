---
name: gate-integrity
description: Use at the end of every RuneHaven build, before committing, to prove the build did not quietly weaken its own checks (harness gates, thresholds, parse floor). Adapted from the idea in addyosmani/agent-skills constraint-driven-development (MIT); RuneHaven-specific, no scripts.
---

# Gate integrity (RuneHaven)

Purpose: README says "RED means RED; never relax gates, update them." This
skill makes that checkable. Run it after run3/run4/run5 pass and before commit.

## Checks (all must hold, else treat as RED and write BUILD_FAILED.md)

1. **Gate count never drops.** Count PASS lines in the run4 output now vs the
   number recorded in the previous changelog entry. It may only go up, unless
   the spec explicitly removes a feature (name the removed gates in the changelog).
2. **No silenced gates.** `git diff -U0 HEAD -- debug/` must show no newly
   commented-out checks, no `if (false)`, no added `.skip`/`xit`/`TODO`, and no
   check whose condition was loosened (e.g. `>=` changed to `>`/`||true`, a
   literal widened). Updated literals are fine only when the spec changed the
   constant (e.g. N=2000 to 4000); say which spec line justifies each.
3. **No weakened tunables.** `git diff -U0 HEAD -- runehaven.html` must not
   change a tunable the spec did not name (e.g. `REACH_BAR`, `N`, `PLAYER_SPEED`,
   `RESPAWN_SECONDS`, `COMBAT_LOGOUT_MS`, `BASE_TIER_HP`). List any tunable that
   changed and the spec line that asked for it.
4. **Parse floor still present.** The parse check must keep its length floor
   (script body >= 1000 chars) so an empty or truncated file can never pass.
5. **No new swallowed errors.** No new empty `catch {}` / `catch(e){}` around
   game logic in the diff unless the spec asks for it.
6. **Secrets.** The diff must not add any key other than the public anon key
   (`role: anon`). Never embed a service_role key.

## Report

Add a "Gate integrity" line to the changelog entry: gate count before/after,
tunables changed (with spec line), and "no silenced gates" or the exceptions.
