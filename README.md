# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RuneHaven_Bible.docx`
(not included here yet — add it to this repo before relying on any automated
build to check bible-fidelity claims itself).

## Layout

```
runehaven.html              the game — currently v16
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

## Confirmed, locked spec for the next build (v19 — world scale-up, N: 80 to 240)

v18 shipped successfully — genuinely clean night, zero blockers, verified.
This section replaces the v18 entry as the current locked target.
Underwater Caves (originally slated as v19) is now v20 — deliberately kept
separate so this version stays focused on one large, high-blast-radius
change rather than combining it with an unrelated system.

**Why this version exists:** the island currently reads as visually
cramped — all v17/v18 biome content crammed onto an 80x80 dev-scale
island. This grows the actual map footprint 3x in each direction (9x
total area) and rescales everything anchored to the old size, rather than
leaving the same small world with more content stacked onto it.

**This is the highest-blast-radius version attempted so far — every
existing system touches world generation in some way.** Read this entire
section before touching any code, more carefully than usual.

**PART A — the core change.**
```
const N = 80;
```
becomes
```
const N = 240;
```
`SPAWN`, `TOWER`, `SPAWN_FORGE`, `DEV_CHEST`, `SHRINE` are already computed
relative to `N` (confirmed directly in the live code before this spec was
written — search for `N / 2` to verify again before relying on it) and
require NO changes themselves.

**PART B — every hardcoded absolute-distance constant found by direct
search, each scaled by exactly 3x to match N's growth.** This list was
built by searching the entire world-generation code for every
distance-from-a-point check — do not assume it's exhaustive; if you find
another one during implementation, scale it by 3x too and note it as a
judgment call (YELLOW, not a blocker — this is a straightforward,
low-risk category of fix even if incomplete on the first pass).

| What | Old | New (x3) |
|---|---|---|
| `SAFE_RADIUS` | 9 | 27 |
| VOLCANO placement radius from TOWER | 25 | 75 |
| MOUNT placement radius from TOWER | 24 | 72 |
| RUIN placement radius from TOWER | 19 | 57 |
| VOLCANO min-distance-from-SPAWN buffer | `SAFE_RADIUS + 14` | `SAFE_RADIUS + 42` (using new SAFE_RADIUS) |
| MOUNT min-distance-from-SPAWN buffer | `SAFE_RADIUS + 12` | `SAFE_RADIUS + 36` |
| MOUNT min-distance-from-VOLCANO | 26 | 78 |
| RUIN min-distance-from-SPAWN buffer | `SAFE_RADIUS + 8` | `SAFE_RADIUS + 24` |
| RUIN min-distance-from-VOLCANO | 14 | 42 |
| RUIN min-distance-from-MOUNT | 14 | 42 |
| `placeLandmarks` clamp margin (`12` in `Math.max(12, Math.min(N-12,...))`) | 12 | 36 |
| `elevRaw` dTower divisor | 40 | 120 |
| `elevRaw` dMount divisor | 12 | 36 |
| Mount height bump — near threshold | 5 | 15 |
| Mount height bump — far threshold | 9 | 27 |
| Volcano rim threshold | 5.5 | 16.5 |
| Volcano VOLROCK/LAVA band threshold | 9 | 27 |
| Volcano LAVA core threshold | 2.5 | 7.5 |
| ROCK-flattening-near-volcano threshold | 14 | 42 |
| Safe-zone grass flatten, first check | `SAFE_RADIUS + 2` | `SAFE_RADIUS + 6` |
| Safe-zone grass flatten, second check | `SAFE_RADIUS + 3` | `SAFE_RADIUS + 9` |
| Wild-pet spawn exclusion near SPAWN | 12 | 36 |
| Mob spawn exclusion near SPAWN | 14 | 42 |

**Explicitly do NOT touch:** `SPAWN_FORGE` decor-clearance check (`< 2.5`)
— that's object-collision clearance, not world-scale, leave it as-is. The
`ENCH_RARITY`/`SACRED_RARITY`/`UNDERCAVE_RARITY` threshold VALUES — these
are percentages evaluated per-tile via noise, already resolution-independent,
confirmed directly, do not change the 0.78/0.74/0.80 numbers themselves.

**PART C — widen biome pockets so they read as substantial regions, not
just "the same tiny patches, more of them."** The three v17/v18 rare-biome
overlays sample noise at `valueNoise(tx / 4, ty / 4, ...)` — the `/4`
controls how large each contiguous pocket is. Change all three from `/4`
to `/12` (matching the 3x scale factor), keeping the existing threshold
values unchanged. This makes each Enchanted Forest / Sacred Meadow /
Underground Cave region roughly 3x wider and taller — a real, walkable
biome you spend time in, not a patch you cross in three steps — while the
overall rarity (how much of the map is each type) stays the same.

**PART D — density rescaling for every existing species, as a formula and
rule, not hand-picked numbers.** With 9x the area, keeping every count
identical would make the world feel empty; multiplying every count by 9
would likely overcrowd it and add real sync/performance load for no good
reason. Apply this rule instead:

- **Common ambient wildlife** (four sprites, wolf, boar, bear, griffin,
  phoenix, golem, goblin, bandit, troll, fire_dragon, glow_moth,
  dark_wraith, stag) — multiply each current count by 3 (not 9). This
  keeps density-per-tile somewhat lower than before the v18 pass, which
  fits the bible's "bases genuinely hard to find" framing — more empty
  space between encounters, not the same crowding spread over more room.
- **Already-gated rare/chance-spawn pets** (shadowfox, unicorn, lightfox —
  all with `presenceRoll` and/or time-window gating already) — multiply by
  2, not 3. Their whole design is scarcity; growing the map shouldn't make
  them proportionally easier to find.
- This is explicitly YELLOW-zone: pick the exact resulting numbers,
  implement them, and list the full before/after table in the changelog's
  JUDGMENT CALLS section. Reasonable, not required to be perfectly tuned —
  this is exactly what that system exists for.

**PART E — proof gates, more thorough than usual given the blast radius:**
- Standard gauntlet: parse check, `run3`, `run4`, `run5` all clean.
- Confirm `placeLandmarks()` actually succeeds for VOLCANO, MOUNT, and RUIN
  in the test seed — none of the three should exhaust their 12 placement
  attempts without finding a valid spot. If one does, the scaled distances
  in Part B are inconsistent with each other — fix them, don't ship a
  landmark that silently failed to place.
- Re-run the EXACT worldgen sanity check pattern from v17 and v18 — confirm
  Enchanted Forest, Sacred Meadow, AND Underground Cave tiles all still
  exist in the test seed at the new scale. All three, not just the newest
  one — this version has the highest chance of silently breaking something
  that worked before.
- Confirm the safe zone still reads as plain grass near SPAWN (spot-check
  a handful of tiles within the new `SAFE_RADIUS` of SPAWN).
- Confirm total entity count in the test seed is roughly proportional to
  the old count x3 (not x9, not x1) — a rough sanity check that Part D's
  formula was actually applied, not skipped.

**Explicitly not touched this version:** Underwater Caves, Water Dragon,
Sea Serpent (now v20). Mounting. Dungeons. Any new content — this version
is purely the scale-up, nothing new added on top of it.

**After v19 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target, exactly as before.
