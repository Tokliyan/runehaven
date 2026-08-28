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

## Confirmed, locked spec for the next build (v49 — Feature-List Chunking & Spawn Density Rebalance)

Confirmed live: `buildFeatureList()` runs a single eager `for(ty<N)
for(tx<N)` pass at login, checking every one of N² tiles and building an
in-memory `features` array + `featureIndex` map covering the ENTIRE
world at once, regardless of where the player actually is. At N=4000
this is 16 million tile checks synchronously blocking login, independently
confirmed real: login went from 5.9s/326MB to 26s/988MB purely from this
version's own expansion, and the automated test harness itself timed out
attempting the full gauntlet against it.

**This is the exact same category of problem `bakeTerrain()` had before
Expansion 2a replaced it with viewport-only rendering — that fix is the
direct precedent for this one, not a new pattern being invented.**

**PART A — chunk the feature list, load only what's near the player.**
Divide the world into fixed-size chunks (propose 64x64 tiles — large
enough that chunk-boundary crossings are infrequent during normal
movement, small enough that a chunk's own feature scan stays cheap).
`buildFeatureList()` is replaced with a per-chunk builder that runs ONLY
for chunks within a real radius of the player (propose 3 chunks — a
9-chunk window, matching roughly the same effective feature-visibility
range the eager version already gave the player at any one moment,
verify this against the current visible-radius rather than guess). A
chunk's features are computed once and cached the first time the player
comes near it — revisiting an already-loaded chunk costs nothing. Chunks
outside the load radius may be evicted from memory to keep heap bounded,
but a chunk a player has already interacted with (a mined node, a
picked-up item) must not lose that state on eviction — reuse the exact
`minedNodes` persistence mechanism already in place, this only changes
WHEN a chunk's features get computed, not what gets remembered about
them.

**PART B — every existing call site updated, not just the builder.**
Confirmed the render loop, `nearestGatherable()`, and any other function
reading `features`/`featureIndex` currently assume the full map is
already resident. Each must be re-checked against the chunked reality —
a gather attempt near a chunk boundary must correctly see features from
BOTH adjacent chunks if the player's own gather range spans it, not just
whichever chunk loaded first.

**PART C — real, measured proof this actually fixes the regression.**
Confirm login time and heap usage return to something close to pre-
Expansion-4 numbers (5.9s/326MB) rather than assuming the architecture
change alone is sufficient — measure it the same way the v48 build
measured the regression in the first place.

**PART D — pet spawn density, rebalanced again.** Confirmed: v47's
count increases are now roughly 4x sparser purely from N doubling again
without the counts scaling alongside it — the identical problem v47
fixed, undone by Expansion 4. Reapply the same tier-scaled correction
technique from v47 (Common scales more aggressively than Rare, Elders
and daily-capped species untouched), measured against the CURRENT
N=4000 map, not re-deriving from v47's own already-stale N=2000 numbers.

**Proof gates:** standard gauntlet plus confirm login time and heap
usage are measured and reported (not assumed), confirm a gather action
near a chunk boundary correctly sees features from both sides, confirm
a mined/picked-up node's state survives its chunk being evicted and
reloaded, confirm pet density is genuinely restored to comparable
findability as v47's own fix, verified the same way (real counts, real
comparison, not assumed proportional).

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
