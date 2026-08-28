# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RUNEHAVEN_BIBLE.md` — full text now in this repo, read it
directly, do not assume or invent anything it doesn't state.

## Layout

```
runehaven.html              the game — currently v19 (v20 in progress)
runehaven-art-style/         SKILL.md — read this before ANY rendering change
debug/run2.js                quick login-screen smoke test
debug/run3.js                REQUIRED full-boot harness (real login, 5 frames)
debug/run4.js                wear-down/taming-gate simulation
debug/run5.js                exhaustive branch-coverage sweep (every class/
                              weapon/armor/species/mob-state combo, once each)
```

Run any harness with: `node debug/runN.js runehaven.html` (or just
`node debug/runN.js` from inside `debug/`, defaulting to `../runehaven.html`).

## The standard process (non-negotiable)

1. **Read `runehaven-art-style/SKILL.md` in full** before touching any
   rendering code, even a small tweak.
2. Apply changes as **surgical, targeted patches** — never a full rewrite of
   a working section. Before any find-and-replace, confirm the anchor string
   is unique in the file (`grep -c "anchor text" runehaven.html` must return
   exactly the number of intended edit sites). An over-broad replace has
   caused a real shipped bug before (v13).
3. **Never invent bible content.** Pets, mobs, biomes, lore, and events must
   come from the bible. If a build needs a value the bible doesn't specify
   (an HP number, a cooldown, a percentage), that's fine to design — but
   flag it as a tunable, and never add a pet/mob/location the bible doesn't
   list without explicitly marking it non-canon.
4. After patching, run in order and require ALL to pass before shipping:
   - `node -e` parse check (`new Function(scriptText)` must not throw)
   - a grep checklist confirming every intended change landed AND every
     prior feature is still present (preservation checks, not just new ones)
   - `node debug/run3.js runehaven.html` — must show `CAUGHT ERROR: none`
   - `node debug/run4.js runehaven.html` — all `PASS`, zero `FAIL`
   - `node debug/run5.js runehaven.html` — must show `CAUGHT: none`
5. **When something is unclear or unspecified, classify it before deciding
   what to do — RED always stops, YELLOW ships with a flagged note.**

   **RED — always STOP, no exceptions, regardless of how small it looks:**
   - Any test harness actually fails (`run3`/`run4`/`run5` catch a real
     error, or any `run4` line is `FAIL`) — this is the mechanical,
     objective signal that something is genuinely broken. Never overridden.
   - A patch anchor isn't unique.
   - The spec would require inventing bible content — a pet, mob, biome,
     location, or lore element not in the bible. This is a creative
     integrity rule, not a bug-severity one, and severity never overrides it.
   - The spec assumes an entire system exists that doesn't, AND building it
     properly needs 3+ genuinely unspecified, interdependent decisions with
     real gameplay consequences (a whole consumable-item framework, a whole
     new traversal/instance architecture — the kind of thing where any
     guess is really a design decision, not a tunable).

   For any RED case: do not guess, do not "fix forward" with invented
   content, do not ship a broken build. Write `BUILD_FAILED.md` at the repo
   root explaining exactly what's blocking and why, leave `runehaven.html`
   unchanged.

   **YELLOW — make the reasonable call, ship it, flag it clearly:**
   - A single tunable number or threshold is uncertain, but any reasonable
     value in a normal range keeps the game working (a rarity threshold, a
     cooldown, a light radius, a stat number within the established range
     for its rarity tier).
   - A minor naming or implementation choice where multiple options all
     work equally well (matching an existing code convention, e.g. an
     abbreviated enum name).
   - A visual/polish detail that doesn't affect functionality (an overlay
     offset, a minor color choice within an already-approved palette).
   - An implementation detail the spec left slightly underspecified, but
     where only one interpretation is actually sensible given everything
     else in the spec.

   For any YELLOW case: make the call, implement it, ship normally through
   the full gate above — but add a `## JUDGMENT CALLS THIS VERSION` section
   to the changelog entry in `SKILL.md` (or a top-level note in the commit
   message if it's not rendering-related) listing every one, in plain
   language, so it's easy to spot and revise the next morning. A version
   that shipped with flagged judgment calls is a complete, done version —
   not a partial one. The judgment calls are refinements to consider, not
   unfinished work.

   **When genuinely unsure which zone something belongs in: treat it as
   RED.** A missed YELLOW just means an unnecessary night lost, which is
   recoverable. A wrongly-shipped RED is a broken or invented build in a
   real player's hands, which is not.
6. On success: update `runehaven-art-style/SKILL.md` with a new dated
   changelog entry (rendering-scope changes only — mechanics/balance live in
   this README or commit messages, not the skill).
7. Extend `debug/run5.js`'s coverage lists with any new species/mobs/weapon
   kinds/classes added in this build, so future runs keep covering them.
8. **If the full gate passed cleanly** (every check above green, nothing
   flagged RED): attempt to push the final commit directly onto `main`,
   not just your own branch, as the very last step. If your environment
   does not permit a direct push to `main`, that's fine — land on the
   usual branch as before, no error, a human will sync it. This is a
   nice-to-have, never a requirement — never fail a build or treat a
   blocked push to `main` as a RED condition.

## Confirmed, locked spec for the next build (v49 — finish the harness repair, then ship)

**This is a completion, not a fresh design — read this whole section
before touching anything.** `runehaven.html` and `debug/run4.js` on
`main` already contain real, finished work from tonight's repair
session:

- `run4.js` re-synced to the real N=4000 world: every stale N=2000
  literal re-recorded from the live file (map size, safe zone radius,
  ruin/zone separation and footprint, cave grid size, Elder Drake's
  search ring, Ancient Forge and Dragon Altar distances from their
  reference points, Dark Forest area, minimap tile count).
- Demon Knight correctly added to both mob-roster gates (it is allowed
  to out-HP Sea Serpent — Very Hard sits above Hard on the bible's own
  table — and it now counts in the named-roster check).
- A genuine, real bug fixed in `runehaven.html` itself, not just the
  test: `loadSavedCreds()` assumed `sbUrl`/`sbKey`/`connectBox` were
  already in the DOM the instant it ran and could throw if they were
  not yet parsed, silently breaking everything after it in page setup.
  Made defensive again; the baked-in Supabase defaults are unchanged.
- Several `window.debugXInfo()` calls in `run4.js` were made defensive
  against a real, deterministic issue where they return `undefined` or
  throw partway through a full run (`debugPinInfo`, `debugSettingsInfo`
  confirmed so far) — **this pattern was not fully chased to its root
  cause tonight and may recur at other call sites still further into
  the file. Continue hardening any further `window.debugXInfo()` call
  that throws the same way, in place, rather than reverting the ones
  already fixed.**

**PART A — finish getting `run4.js` to a real, complete, honest run.**
Continue from where tonight's session stopped: there is a `NaN` in the
interior-density console log (`interior density across N caves: NaN
floor tiles...`) immediately before the last guarded crash — this was
NOT root-caused tonight, only worked around downstream. Determine
whether `debugSpaceInfo()`'s `rec` lookup genuinely fails to see a
just-entered interior at that point in the test sequence (a real
harness bug) or whether call ordering needs to change (`dspc()` needs
to run before `dssp({ clearCache: true })` on the next iteration, or
similar) — fix the actual cause, not just the symptom, since a NaN
silently reaching a `results.push` threshold check would be a false
PASS or a confusing FAIL either way.

**PART B — reach real 0 FAIL on the current, unmodified file.** Run the
full `run4.js` end to end without truncating early. Fix whatever
remains the same way tonight's session did: verify against the real
live constant/function before changing a test's expectation, and only
diagnose-not-relax anything touching cave dive-reachability, which
`SKILL.md` has already ruled belongs in a real design decision, not a
third silent threshold drop.

**PART C — apply v49's actual work.** The chunked feature-loading fix
and the density rebalance are already fully built, measured, and
correct — saved as `BUILD_FAILED_v49.patch` in the repo (310
insertions / 38 deletions against commit `ae3f277`). Do not redesign
this. Apply it, then update `run4.js`'s `SP_COUNTS` table and the two
exact-population gates (`Storm Dragon reaches its peaks`, `golem spawns
its full v47 population`) to the patch's own new counts, exactly as the
patch's own notes describe.

**PART D — the two small open decisions from the patch's own notes,
make a real call on each:**
1. `speciesDailyCap()` scales with `count`, so Rare species' daily caps
   are now ~4x bigger (Unicorn 16 → 56) as a direct consequence of the
   density fix. This is consistent with the fix's own intent — more
   instances spread across 4x more map area — accept it, do not revert.
2. Fight-to-tame pets (Boar, Bear, Griffin, Phoenix) take density from
   `MOBS.count`, which neither v47 nor this patch touched — they are
   still roughly 4x sparser than everything else post-Expansion-4.
   Apply the same tier-scaled correction technique to these four
   specifically, for consistency with every other species.

**Proof gates:** real, complete, unmodified full run4 + run5 + run2/run3
with actual reported numbers — not partial, not truncated. Confirm login
time and heap return to something close to the measured 5.99s/165.8MB
from tonight's session. Confirm every gate this spec touches passes for
a real, understood reason, not a guessed one.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
