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

## Confirmed, locked spec for the next build (v48 — World Expansion 4, Demon Knight & Minimap 3x)

Confirmed live: `N=2000`, `INTERIOR_N=80`. Three items deliberately
deferred out of v47.

**PART A — the map doubles again.** `N: 2000 -> 4000`. Full constant
audit repeated exactly as rigorously as every prior expansion — every
landmark-relative distance re-derived by the same ratio, not guessed;
`bakeTerrain()` remains gone since Expansion 2a, so memory is not the
blocker, but the viewport tile-count bound must still be re-confirmed at
this scale regardless. Biome rarity thresholds and noise wavelengths
stay untouched — proven correct twice already at two prior scales, this
is the third confirmation, not a new risk.

**PART B — caves double again.** `INTERIOR_N: 80 -> 160`. Reuse the
exact connectivity guarantee (flood-fill from arrival, carve to any
orphaned region) and re-derive the flood-fill guard from the grid size
itself, not a hardcoded number — this exact class of bug (a guard sized
for the old grid silently truncating at the new one) has already
happened once at this exact transition (50->80) and must not repeat at
80->160. Ore/mob/node density scales with the new area, not left flat.

**PART C — Demon Knight, built for real.** Confirmed live: does not
exist anywhere in `MOBS`. The bible places it in "Deep Dungeons," which
do not exist as their own biome — rather than block this on building
Dungeons from scratch (a whole separate landmark-scale feature), Demon
Knight spawns as a dedicated guardian at the Volcano specifically,
protecting the Elder Drake, matching the direct instruction already
given: this is a deliberate, named exception to its bible placement, not
an oversight — record it as such in the changelog. Stats at the bible's
own "Very Hard" tier, above Adult Golem/Sea Serpent's "Hard" and below
Elder Drake's "Boss": propose `hp:280, dmg:26, atkRange:2.0,
atkCooldownMs:1600, windupMs:600, aggroRadius:9, leashRadius:16,
moveSpeed:1.6, count:2` (two, flanking the Elder Drake, not one), drop
`dragonsteel` — the bible's own stated drop for this creature, already
consistent with dragonsteel's existing acquisition list. New art,
following the locked style guide (flat colour-block, no muddy palettes —
the exact lesson from the Elder Drake's own original mistake).

**PART D — minimap view area, 3x larger.** The rendered top-down minimap
(not the compass dial, which is unrelated and stays as-is) currently
shows roughly a 10x10 tile area — confirm the real current value at
build time rather than assume. Expand to roughly 30x30, same rendering
technique, same "close-range only, never reveals remote bases" limit
from its original spec — this is a bigger window on the same view, not
a different kind of view.

**PART E — re-verify music, bases, and fast travel are genuinely
correct, for the record.** These have all been independently confirmed
working in code across multiple prior sessions — this is not expected to
find anything, it is a documented re-check requested directly, and the
result (pass or genuinely find something) must be written into SKILL.md
either way. Confirm: `BG_PLAYLIST` still lists all five tracks correctly,
`tension.mp3` still fires only on Elder-tier combat; `basePlaceCheck()`
and `placeBasePiece()` still correctly write to `base_pieces` with no
regression from this version's own changes; the player-to-player travel
button's `disabled` condition still has no Unicorn Elder ownership check
anywhere in it.

**PART F — bake in the real connection, keep the box.** Confirmed live:
`connectSupabase()` currently throws `"Add your Supabase URL and key in
'Connect your world' first"` whenever the box is empty, and
`loadSavedCreds()` only pre-fills it from `localStorage` — meaning every
new browser genuinely requires typing it in once, which breaks down
completely for the game's own "one shared world" premise if anyone ever
points at a different project. Add two real constants, `DEFAULT_SB_URL`
and `DEFAULT_SB_KEY` — **the real project anon key, not the service_role
key, which must never be embedded anywhere** — and use them as the
fallback everywhere `rh_sb_url`/`rh_sb_key` are currently read: the box
still exists exactly as it is now, pre-filled with these real values on
first load rather than blank, and `connectSupabase()` never throws for a
missing value again since a real default always exists. A player can
still edit the box and connect elsewhere if they choose to — this adds a
working default, it does not remove the option.

**The real URL and anon key must be supplied directly by the project
owner before this can be built — placeholder values must never ship.**

**Proof gates:** standard gauntlet plus six-seed sweep for the expansion
with real before/after landmark and biome-pocket numbers (not assumed
unchanged), cave connectivity re-confirmed with zero sealed-off tiles
across a real multi-seed sample at the new interior size, confirm the
flood-fill guard is derived from the grid and not a new hardcoded
number, confirm Demon Knight spawns specifically at the Volcano
guarding the Elder Drake and nowhere else, confirm its drop is genuinely
dragonsteel, confirm the minimap's expanded radius still never reveals
anything beyond its own close range.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
