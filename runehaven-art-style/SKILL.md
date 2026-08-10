---
name: runehaven-art-style
description: Use this skill whenever working on RuneHaven's visual rendering, art style, or Canvas 2D drawing code — including terrain, characters, buildings, lighting, shadows, particles, or camera projection. Always consult this before writing or editing any RuneHaven rendering code, even for small tweaks, since it contains the exact target aesthetic (Thronefall/Bad North/Islanders flat-shaded isometric), the projection math, the locked colour palette, and a running list of known visual problems flagged by the user that must not be reintroduced. Trigger this for phrases like "rebuild the game art", "the game looks bad", "fix the rendering", "make it look like Thronefall", or any request to touch RuneHaven's HTML/Canvas visuals.
---

# RuneHaven Art Style — Isometric Flat-Shaded Edition

RuneHaven is a 2D persistent multiplayer survival RPG (full game design in the project's game bible, not in this skill). This skill is ONLY about the visual rendering layer — terrain, characters, buildings, lighting. It does not cover gameplay logic (combat, inventory, crafting, multiplayer sync), which must never be touched when doing an art pass unless explicitly requested.

## Target aesthetic

Primary reference: **Thronefall**. Secondary influence: **Bad North** (moodier, cooler shadows) and **Islanders** (bright modular building shapes). The user has explicitly said Thronefall is the closest to what they want — lean hardest on it.

Core traits of the target look:
- Flat-shaded low-poly-style 3D, faked entirely in 2D Canvas (no WebGL/3D library)
- True isometric ground plane — tilted diamond tiles, not top-down
- No black outlines — shapes read via flat colour contrast + hard shadow only
- Tiny, ant-scale characters — world feels grand, characters feel like pieces on a board
- Hard-edged directional shadows that shift with a day/night sun angle (not soft glow)
- Warm, cohesive base palette with strong per-biome identity colours (volcano red-black, dark forest near-black green, sacred meadow golden) — never desaturated/muddy, never clashing
- Buildings and props read as solid 3D objects via 2-3 flat-shaded faces (top/left/right), not painted textures or gradients

## Technical foundations (do not re-derive each time — these are settled)

**Isometric projection**: world (x, y) → screen. Screen X is the difference of the two world axes scaled by half tile width; screen Y is the sum of the two world axes scaled by half tile height. Objects gain apparent height by subtracting a pixel Z offset from screen Y.

**Depth sorting**: every drawn entity (terrain tile, tree, rock, building, player, item, projectile) sorts back-to-front by `world x + world y`. This is the single most common isometric bug — always verify sorting is applied to ALL entity types, not just some.

**Elevation**: terrain has integer height levels (water/deep = -1, ground = 0, hills = 1-2, peaks = 3). Higher tiles cast visible stepped cliff faces down to their lower neighbours (south and east faces specifically, shaded darker than the top face) — this is what makes the ground read as tiered rather than flat. If a screenshot shows terrain looking flat with no elevation read, this is the first thing to check — the cliff-face rendering is likely missing or too subtle.

**Movement/data model**: player position stays plain flat world x/y coordinates in the database — isometric is a rendering-only concern. Never let an art pass touch the data model, combat math, or multiplayer sync. Mouse aim converts screen→world via the inverse of the projection formula above before combat logic runs; combat itself is unchanged flat-world distance math.

**Sun/shadow direction**: shadows are computed from the shared day/night clock — long and low-angle at dawn/dusk, short near midday, faint stub shadows at night. This must be a real per-object shadow shape (a flat dark polygon/ellipse offset in the sun's direction), not a static blob under every object.

## Locked colour palette (biome → [top-face colour, alt-shade for checkerboard variation])

```
Deep water    #2c5a72 / #295570
Shallow water #43859e / #40819a
Sand          #e6d5a0 / #e0cf98
Plains        #8fb562 / #89b05c
Meadow        #a3c470 / #9dbf6a
Forest        #75a355 / #6f9e50
Dark forest   #3c5c36 / #375631
Rock          #b3a993 / #ada38d
Peak (snow)   #ece7db / #e6e1d5
Volcanic rock #5c3c3c / #563838
Lava          #ff7a3c / #f97438
Ruins         #bcb4a2 / #b6ae9c
```

Flat-face shading formula: side faces are the top colour darkened by a multiplier (~0.72 for the "SW-facing" face catching less light, ~0.55 for the "SE-facing" face in full shadow). Keep this ratio consistent across ALL objects (terrain, trees, rocks, buildings) so the whole world reads under one consistent light source.

## Known visual problems flagged by the user (running list — check new builds against this before shipping)

Dated entries, most recent first. When a build fixes one, mark it FIXED but don't delete it — it's a regression check for the future.

### 2026-08-09 (v20 — Ruins as repeatable structures + scattered Safe Zones)
No new species, no new mobs, no palette changes. The single hand-composed Ruin
becomes six of them, scattered, and the bible's "Other Safe Zones" arrive as
four rest points. Separations, search budgets and the placement rules live in
the README + commit message; below is only what changed about how the world
READS.
- **The Ruin stops being a landmark and becomes a structure you find.** v19
  placed one Ruin by angle-and-radius from the Tower, which kept it orbiting
  the town centre at a fixed distance — it read as part of the spawn hub's
  furniture rather than as somewhere out in the world. Six clusters now place
  by the same hashed sampling the wilds and mobs use, so they land anywhere
  the island has room. Measured in the test seed: centres 45–52 tiles apart,
  spread across all four quadrants, none within 61 tiles of spawn.
- **The hand-composed ruin composition is untouched — it is now built six
  times.** `buildRuinPieces()` → `buildRuinCluster(center)`, every piece still
  at its exact v6 offset from the cluster centre. The user declared that
  composition DONE and it must never be altered; repeating it is not altering
  it. All six clusters are deliberately identical, which is what makes them
  read as the same lost civilisation rather than six unrelated set pieces.
- **New set piece: the dark dungeon entrance**, one per cluster, set into the
  gap in the north wall run (the wall segments sit at x −2.4/−1.4/−0.4 and
  1.6/2.6, so +0.6 is the doorway). Two jambs carrying a lintel, ~34px tall
  (≈3 tiles at `IH2` 11) — the tallest thing in a cluster — over a flat
  near-black trapezoid mouth that tapers inward as it rises. Stone is
  `#8f8878` / lintel `#9c9484`: the same ruin stone taken down in value, so it
  reads as this architecture gone deeper and colder rather than as a
  different material. Hard-edged flat fills only, standard 0.72/0.55 facet
  split via `drawBox` — the mouth is dark because it is a dark colour, not
  because it is blurred. Bible-supported ("Ruins — ... dungeon entrances");
  purely visual, nothing behind it is enterable this version.
- **Other Safe Zones read as clearings, not as buildings.** Four of them,
  each a radius-8 disc of plain grass on level ground with the existing ruin
  stone well as its only anchor — the same well art, reused, no new drawing
  code. Deliberately quiet: a rest point should read as somewhere the land
  opens up, not as another structure competing with the Ruins.
- **The clearing is guarded like the RUINB carve** (`!BLOCKED`, not water), so
  a zone that lands on the coast keeps its shoreline instead of painting grass
  out over the sea. Two of the four do exactly that in the test seed.
- **⚠️ Two of the four Safe Zones sit on the coastline** — ~15% of their disc
  is water. Placement tests land fitness on the CENTRE tile only, which is
  what the exhaustive 57,600-tile (240×240) scan behind this spec measured, so
  this follows the spec exactly rather than second-guessing it. The result is
  defensible (a coastal rest point by the water reads fine) but if a fully
  inland clearing is wanted, the fix is a footprint check rather than another
  separation number — and it would need re-measuring, since it changes which
  spots qualify.
- **⚠️ No boundary ring on the scattered zones.** The Spawn zone has its gold
  dashed ellipse; these have only the grass edge and the HUD's safe-zone
  indicator. The spec listed the well and the clearing as the whole visual
  treatment, so nothing was added beyond it. Worth a look — the protected
  radius and the grass radius are identical (8), so the green edge *is* the
  boundary, but it is a softer read than the ring.
- **RUINB ground now covers six pockets instead of one** — 63–69 tiles per
  cluster, 408 total. Golem (RUINB-only) and Bandit both reach more than one
  cluster in the test seed, so the ruin biome's creatures are spread across
  the world rather than stacked in a single spot.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent. All shipped and verified through
the full gate — refinements to consider, not unfinished work.
- **Ruin-to-Ruin separation set to 40.** The spec pins Ruin-to-Zone at 24 and
  every zone separation at 40, and says the Ruins' own separations are
  unchanged — but v19 had a single Ruin, so a Ruin-to-Ruin number never
  existed to carry forward. 40 matches the zone-to-zone value and puts ~35
  tiles of open ground between two 4.5-tile footprints. Measured result: the
  closest pair lands at 45.1, so the constraint is not the binding one.
- **Safe Zone protected radius = clearing radius = 8, one constant.** The spec
  gives the radius-8 clearing and says `inSafeZone()` extends to the zones,
  but never states a separate protection radius. Using one number for both
  means the visible green circle IS the safe area, with no invisible margin in
  either direction. (The Spawn zone deliberately keeps its own arrangement,
  where the grass disc is 6 tiles wider than the protection.)
- **The clearing also flattens terrain to `h = 0`,** like the Spawn zone does.
  The spec says "grass clearing" and nothing about height; a well straddling a
  three-level cliff step would not read as a clearing. Setting `h = 0` also
  puts the whole disc below the `h >= 1` edge-erosion branch, so no erosion
  exemption was needed — one change instead of two.
- **The dungeon entrance's placement, size and two stone colours** are visual
  tunables the spec left open (it specified only "two jambs, a lintel, a flat
  near-black trapezoid mouth, ~2.5–3 tiles tall, darkened ruin stone"). The
  wall-run gap was chosen because it is the one spot in the locked composition
  that is already empty, so nothing had to move to make room.
- **FIX 3 resolved by not re-seeding, not by widening the budget.** The
  wilds/mobs pattern folds `placed` into the hash offset, restarting the
  candidate stream from `a = 0` after every success; under the Ruins' tighter
  constraints that is what exhausted the search on the sixth cluster. One
  fixed stream swept once is the smaller change of the two the spec offered,
  and it also stops the search re-testing candidates it already rejected.
- **`debugWorldInfo()` now also exports `RUINS`, `OTHER_SAFE_ZONES`, the five
  placement constants, mob/wild home spots and the ruin set-piece list** (all
  copies). Same reason as v19's landmark export: these are top-level `let`s
  and `const`s, which never land on `window`, so PART C's proof gates cannot
  see them any other way.
- **`run4`'s Dark Forest pin re-measured to 763, not carried over.** PART C
  required this explicitly. 875 → 763 because six RUINB carves (not one) and
  four grass clearings now take more tiles from the moisture band. The
  invariant being guarded is unchanged — the rare-variant noise fields still
  never touch it; only landmark overrides do, as they always have.
- **`run5` gained a ruin set-piece sweep** (`RUINPIECE_LIST`), covering all
  eight kinds at synthetic coordinates and then every piece the live world
  actually built. Clusters now sit far from spawn, so the 5-frame boot is no
  longer guaranteed to draw a single one — exactly the gap that sweep exists
  to close. It also hard-fails if a listed kind was never built.

### 2026-08-05 (v19 — world scale-up, N 80 → 240)
No new art and no new species. The island itself is 3x wider in each direction
(9x the area), and everything that was measured in absolute tiles moved with it.
Entity counts, search budgets and the density rule live in the README + commit
message; below is only what changed about how the world READS.
- **The cramped island is FIXED — it was a scale problem, not a content
  problem.** v17/v18 kept adding biomes and species onto an 80x80 dev-scale
  map, so every new region landed shoulder-to-shoulder with the last one.
  Growing the map and rescaling the distances (rather than thinning content)
  is what buys back the space between things.
- **Rare-biome pockets are now large enough to be places, not patches.** The
  three v17/v18 overlays sample their own noise field; that field's wavelength
  went `/4` → `/20` — 5x, deliberately more than the map's own 3x, so a pocket
  grows faster than the world around it. Measured in the test seed: Enchanted
  Forest 9 distinct regions (largest 220 tiles, vs 64 tiles across the WHOLE
  old map), Sacred Meadow 4, Underground Caves 8. The spec's back-off
  condition — "only one or two enormous blobs per biome" — did not trigger, so
  `/16` was not needed. The rarity thresholds are untouched, so each variant's
  share of its parent biome is exactly what it was; only pocket size and count
  moved.
- **Landmark separation scales with the world.** Volcano/Mount/Ruin now place
  at 75/72/57 tiles from the Tower instead of 25/24/19, with every
  minimum-separation buffer tripled to match. Verified in the test seed that
  all three actually found a valid spot rather than silently exhausting their
  12 attempts and shipping wherever the last try landed — that failure mode is
  now a `run4` assertion, not a hope.
- **Volcano and mountain keep their silhouettes.** Cone rim, lava core, the
  VOLROCK band and the PEAK→ROCK buffer that keeps snow off volcanic rock
  (the 2026-07-11 "no transition" fix) all tripled together, so the landmark
  reads at the same proportion of the world it always did rather than becoming
  a pinprick on a bigger map.
- **Safe zone still reads as plain grass**, at `SAFE_RADIUS` 27 instead of 9 —
  the full-override radius, the height flatten and the erosion exemption all
  scaled together, verified by spot-checking tiles out to the new radius.
- **⚠️ The Eternal Tower now sits INSIDE the safe zone.** Spawn and Tower are
  pinned to `N/2` with fixed offsets (18 tiles apart), and the locked spec
  explicitly said not to change them — so as `SAFE_RADIUS` went 9 → 27 the
  zone grew out past the Tower. The spawn hub is now a compact cluster in a
  much larger world instead of a spread the size of the map. Nothing breaks
  (mobs were already excluded far past the Tower), but it is a visible change
  in how the centre reads and is the most likely thing to want revisiting.
- **⚠️ The baked terrain canvas is now 10604x5414px (~57 Mpx, ~219 MB) —
  up from 3564x1894 (~6.8 Mpx, ~26 MB).** `bakeTerrain()` paints the whole
  map into one offscreen canvas at boot; that is inherent to N and the spec
  did not raise it. Within desktop Chrome/Firefox limits, but it is well past
  what mobile Safari will allocate, and boot cost rose ~290ms → ~300ms in the
  harness (which stubs the actual painting, so the real-browser cost is
  higher). Flagging rather than fixing: chunking the bake is a rendering
  architecture decision, not a tunable, and inventing one was not in scope.
- **Ambient decor did not scale and now reads thin.** Grazing rabbits (3),
  the Tower's circling birds (3), butterflies, torches and fences are all
  fixed counts and none of them appear in the spec's density list, so they
  were left exactly as they were — across 9x the area they are now much
  sparser than before. Deliberate (following the spec's explicit list), not
  an oversight, but worth a look next pass.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent or where the world's new size broke
an assumption it didn't mention. All shipped and verified through the full gate
— these are refinements to consider, not unfinished work.
- **"Safe-zone grass flatten, first/second check" resolved to three sites, not
  two.** The spec's table lists one `SAFE_RADIUS + 2` → `+6` and one
  `SAFE_RADIUS + 3` → `+9`, but the code has the `+2` pattern twice (the
  biome grass override in `biomeAt` and the height flatten in `rawHeight`) and
  `+3` twice. Applied the spec's mapping to every safe-zone grass/flatten
  site — `+2`→`+6` on both, `+3`→`+9` on the erosion exemption — since any
  other split would leave the grass disc and the flat disc different sizes.
- **One extra distance check found and scaled 3x**, under Part B's explicit
  catch-all: the grazing-rabbit spawn exclusion, `SAFE_RADIUS + 3` → `+9`.
  It is the same category as the wild-pet and mob exclusions the spec listed.
- **Spawn-search budgets scaled by AREA (9x), not by Part B's 3x** — wilds
  4000 → 36000, mobs 600 → 5400. These are counts of random samples taken
  across the map, so samples-per-tile is the invariant that has to hold; at 3x
  the cave and ruin species fell short of their new counts purely because the
  search ran out. Costs ~12ms of boot. Not a design number.
- **Glow Moth reaches 7–9 of its 9 target, run to run** — Underground Caves
  are only ~90 tiles and wilds must sit 3 tiles apart, so the last one or two
  are geometry-limited, not budget-limited. Left as is; raising it would mean
  either more cave tiles or tighter spacing, both real design changes.
- **`debugWorldInfo()` now also exports `SAFE_RADIUS`, `SPAWN`, `TOWER` and the
  three landmark positions** (as copies). Part E requires proving the landmarks
  actually placed, and like the biome ids they are lexically scoped consts that
  a harness cannot otherwise see.
- **The three harnesses no longer sleep a fixed 200ms after clicking ENTER;
  they wait for the login screen to actually hide.** At the new scale boot takes
  ~300ms, so the old fixed sleep expired *before* login finished and every
  assertion after it silently ran against a world that was never entered —
  `run3` still printed `CAUGHT ERROR: none` while testing nothing. This was
  found and fixed during this build; it is the single most important change in
  the harnesses.
- **`run4`'s scale-bound pins were updated, not relaxed.** "Dark Forest band
  untouched" was pinned at `dark === 1` — a true value only at N=80 — and is
  now pinned at `dark === 875`, the same invariant at the new scale. The
  density table was updated to the v19 locked numbers with the same
  exact-value style v18 used.
- **The Dark Wraith is now asserted rather than excused.** v18 shipped with an
  open note that it could not be tested because Dark Forest was a *one-tile*
  band in the test seed. The scale-up fixed that as a side effect — the same
  moisture logic over 9x the tiles yields an 875-tile band, and the wraith now
  reliably spawns 6x — so the gap is closed and held closed by a real
  assertion. Shadowfox (Dark Forest-only too) benefits identically but keeps
  its presence roll, so it still can't be asserted.

### 2026-08-04 (v18 — Underground Caves, Fire Dragon, Glow Moth, Dark Wraith)
A third rare biome pocket and three new creatures. Density counts, combat stats,
tame chances and the Dark Wraith's ranged mechanism live in the README + commit
message, not here — below is only how it all looks.
- **Underground Caves** (rare ROCK/PEAK variant, `B.UNDERCAVE`). Palette
  `#4a453e / #474239` — the parent Rock hue with the warmth and the value taken
  out of it, so a cave pocket reads as a **hole punched in the highland**, not
  as one more shade of rock. Its cliff faces are the cave tone shaded on the
  locked 0.8 / 0.58 ratio, **not** the cream `CLIFF_SW`/`CLIFF_SE` — a dark tile
  wearing cream cliffs read as a palette bug in every test frame.
- Cave ground is a deep shadow pool (`rgba(12,10,16,0.34)` inner diamond), two
  hard fissure strokes, and a sparse warm mineral glint with a flat halo.
  **Hard-edged flat shapes only, no gradients** — same rule the Enchanted Forest
  undergrowth follows.
- **Caves deliberately do NOT get drifting motes.** Motes mark the two rare
  *surface* biomes (v17); spreading them to a third would destroy the "you have
  found somewhere rare" read that earns them. Caves carry their identity through
  value and shadow instead. Do not merge these treatments.
- A cave pocket carved out of a snow PEAK loses the peak height rule and drops
  to plateau height, which reads as a recessed bowl in the massif. That is
  wanted, not a bug — it is what makes the cave mouth legible from above.
- **`aura()` — new shared render helper** (pulsing radial wash + ground ellipse
  + rising diamond motes). Takes an `"r,g,b"` triplet rather than a css colour
  because every stop composes its own alpha. Used by the Dark Wraith now, built
  to be reused by Elder-tier content later.
- **`dragonV2()` + `DRAGON_PAL` — one shared dragon body, four palettes**
  (water / fire / storm / shadow) with only `fire` wired up this version, so
  later dragons need no rework. Its palette parameter is named **`PAL`, never
  `P`** — `P` is this file's global polygon helper and shadowing it would
  silently break every draw call in the body. (`PAL` shadowing the biome-palette
  global inside that one function is harmless; nothing in there reads a biome
  colour.)
- **Fire Dragon**: approved concept art ported verbatim. It is a **ground
  species** — the art plants its claws on the baseline — so it inherits the
  standard walk bob, sun shadow, x+y depth sort and every v16 combat overlay
  with no special casing. `SPECIES_K` 1.30, the reference-sheet hatchling scale.
- **Glow Moth**: `SPECIES_K` 0.32, the smallest thing in the roster. Its warm
  radial gradient is the one place a gradient is correct here — it is a light
  source, not a surface. That same colour is reused as the light it casts: while
  it is the active pet the **local player's own light widens 150→215 and warms
  to `rgba(244,232,160,…)`**. It is deliberately not a second light entity — no
  stacking, no toggle, on while active — so it can never double-expose a scene.
- **Dark Wraith**: incorporeal read — 86% alpha body, drifting tatter fringe,
  violet eye squares with a soft square halo, and the new `aura()` beneath it.
  Ported into `drawMob`'s in-transform chain with `sx`/`sy` substituted for
  `(0)`, the same v15 port convention goblin/troll/bandit already use.
  `MOB_K` 1.30, `MOB_TALL` 4.
- **The wraith's ranged strike is a visible bolt**, drawn *after* the body and
  *outside* the body transform so it reads as reaching the target rather than as
  part of the silhouette — a 240ms violet line that fades out. Without it a hit
  from 4.5 tiles away has no visual cause at all. The v13 fairness rule is
  untouched: the amber "!" still plays for a full 600ms first.

## JUDGMENT CALLS THIS VERSION
Rendering-scope calls made where the spec was silent. All shipped and working —
these are refinements to consider, not unfinished work.
- **Cave palette `#4a453e / #474239`** and the shadow/fissure/glint values. The
  spec asked for "desaturated rock, deep shadow, sparse ambient light" and gave
  no hexes. Picked to sit clearly apart from volcanic `#5c3c3c` (warm) and plain
  Rock `#b3a993` (light).
- **`UNDERCAVE_RARITY = 0.80`** — yields 41 cave tiles in the test seed, 8.2% of
  the Rock/Peak pool, deliberately between Sacred Meadow's 3.7% and Enchanted
  Forest's 12.4%. Pure tunable; raise it for rarer caves, lower it for more.
- **Fire Dragon as a ground species, and Glow Moth as a flier at `alt: 12`**
  (matching Wind Sprite). Neither was stated; both follow from the supplied art.
- **`GLOW_MOTH_LIGHT_R = 215`** against the unlit default of 150. "A soft
  radius" was the whole brief — this is a ~43% widening, tunable either way.
- **240ms bolt lifetime** for the wraith's ranged strike.

### 2026-07-31 (v17 — Enchanted Forest, Sacred Meadow, and three new species)
Two rare-variant biomes and three new creatures. Biome rarity thresholds, tame
chances, time gates and the two new gatherables' mechanics live in the README +
commit message, not here — below is only how they look.
- **Enchanted Forest** (rare Forest variant). Palette `#55736a / #527066` — the
  canopy is **deliberately desaturated**, green pulled toward slate-teal, and
  the trees use their own facet set (`#6a9086 / #557a72 / #3d5c58`, violet-grey
  trunk). That desaturation is the whole point: it is what lets the
  bioluminescent undergrowth read. If a future pass "fixes" the canopy back to
  forest green, the glow disappears into it. Undergrowth is baked into the tile
  as hard-edged teal specks with a flat halo — **no gradients**, the shimmer
  comes from colour contrast, per the flat-shaded rule.
- **Sacred Meadow** (rare Meadow variant). Golden dawn palette
  `#cfc079 / #ccbd75`, warm grass strokes, occasional gold bloom, and a soft
  light-shaft treatment — a pale wedge laid across the tile. The shaft is a
  hard-edged polygon, not a bloom or blur; it reads as a shaft of light, and
  keeping it hard-edged is what keeps it inside the art language.
- **Drifting motes** are a new particle kind (`mote`): twinkling square core +
  square halo, rising slowly, teal in the Enchanted Forest and warm gold in the
  Sacred Meadow. **These are not fireflies.** Fireflies are gold, forest/dark
  forest only, and night only; motes run day and night and mark the rare
  biomes. Do not merge the two treatments — a mote appearing in plain Forest at
  night would destroy the "you have found somewhere rare" read.
- **Stag / Unicorn / Lightfox**: approved concept art inserted verbatim into the
  `drawSpecies` chain in the existing `P`/`R`/`EY` helper convention — ported,
  not redrawn or reinterpreted. `SPECIES_K` ratios from the reference sheet:
  Stag 1.15, Unicorn 1.30 (tallest ground pet after Shadowfox/Golem), Lightfox
  1.05. All three are ground species, so they inherit the standard walk bob,
  sun shadow, x+y depth sort, and every v16 combat overlay (gold HP bar, lunge,
  downed ring) with no per-species special-casing.
- **Two new gatherable node silhouettes**, both deliberately unlike the ore
  nodes so the 2026-07-07 "everything is grey cube debris" problem does not come
  back: **Rare Herb** is a swaying frond cluster with pale seed heads — plant-
  shaped, no rock base; **Magic Essence** is a hovering violet wisp over a small
  mossy stone, with orbiting motes tying it to the Enchanted Forest floor.
- Grass tufts and cliff moss now follow the variant tones (warm gold in the
  Sacred Meadow, teal-grey in the Enchanted Forest) rather than staying plains
  green — a variant biome whose grass detail is the parent biome's colour reads
  as a palette bug.

### 2026-07-29 (v16 — pet combat states: lunge, damage, downed/recovery)
No new creature art and no new species this build — v16 is a mechanics pass
(stats/targeting/cooldowns live in the README + commit message). The rendering
scope is the set of states the existing pet art now has to read in:
- **Attack lunge, deliberately NOT a wind-up tell.** Pets get a ~200ms sine
  shove toward the target and nothing else. The v13 fairness rule (raised
  weapon + amber "!" before every hit) is a MOB rule and must stay mob-only —
  pets aren't mobs, and giving them a telegraph would misread as an enemy
  about to strike the player. If a pet ever pops an amber "!", that's a bug.
- **Downed read (0 HP, recovers after 75s — pets are never lost).** Dimmed to
  55% alpha, walk bob replaced by a crouch offset so it sits/cowers, and
  fliers (Griffin/Phoenix) drop from their ~28px follow altitude to 2px — a
  grounded flier is the loudest possible "out of the fight" signal. At its
  feet: a dim slate ring with a gold-green arc that sweeps to full over the
  recovery, plus a small "downed Ns" label.
- **The downed ring is NOT the pale-green pulsing tame ring.** That ring means
  "this creature can be tamed right now" (v14) and must keep meaning only
  that. Different colour, different shape (filling arc vs pulse), different
  unit. Never merge the two treatments.
- **Pet HP bar**: same language as the v13 mob bar — thin, above the unit,
  hidden at full HP — but **gold (#d8a24c), not red**. Red bars mean hostile;
  a friendly unit must not wear one. Bar and flash offsets scale by
  `SPECIES_K` so the big pets (Golem 1.65, Shadowfox 1.66, Bear 1.60) don't
  wear their bar inside their own silhouette.
- All combat overlays are **local-player only** — remote pet HP isn't synced,
  so other players' pets keep the plain v11 follower treatment.
- HUD: active-pet HP/damage line under the blood-window line; the Companions
  roster rows now carry each pet's combat stat (or "no combat role" for the
  four Sprites, which have none by design).

### 2026-07-15 (v15 — reference sheet v3 incorporated: players, pets, mobs, weapons, armour)
The whole approved art-reference package is now the live game art. Zero mechanics changed.
- **Players — Direction A "Heroic"**: five distinct silhouettes replace the triangle+head. Mystic = floor-length robe, NO legs, bell sleeves, glowing eyes in a pointed hood, orbiting runes. Knight = broadest body, closed crested helm (no face), plate lames, tabard, shield slung on the back. Ranger = lean, half-cape one shoulder, quiver of fletched arrows, visible jaw under the hood. Beastmaster = asymmetric one-shoulder pelt, bare arms/chest, claw necklace, antler band. Architect = boxy work apron, hammer + chisel on the belt, rolled plans on the back, pencil behind ear. Locked class palettes unchanged. Bodies live in `drawHeroBody` at sheet-native 28px, scaled by `HERO_K = 11/28` inside drawUnit — the 11-unit local space and S=2.1 world proportion are unchanged.
- **Held weapons**: drawHeldWeapon body swapped for the v3 geometry — crossguards+pommels, fuller highlights, bound hafts, bearded axe edges, bow risers with strings, crossbow laths+nuts+bolts, prong-set staff orbs. Same name/signature/local slot, so every call site (players, class-select previews) upgraded at once.
- **Armour**: flat trapezoid → tinted facets + two lame lines + pauldron caps. Tier colours unchanged.
- **Pets (all 11)** and **mobs (goblin/bandit/troll)**: reference-sheet v2 bodies, machine-ported via context-first helpers (P/R/EY/BND/SCL — new names, zero collisions). Per-species/mob draw scales in `SPECIES_K`/`MOB_K` implement the approved size ratios: shadowfox+golem markedly bigger (mount-plausible), bandit human-height, troll ~1.8× player. Overlay heights (`MOB_TALL`) and the weakened ring scale with body size.
- Wind-up raise preserved on all three humanoid weapons through the port — the tell must still read.

### 2026-07-15 (v14 — Troll + fight-to-tame pets: Boar, Bear, Griffin, Phoenix)
Rendering-scope changes (HP/damage/aggro/tame numbers live in the session record):
- **Troll**: big hunched grey-green bulk (#6f8a5e / #41563a), clearly taller than a Bandit — heavy brow shelf, two tusks, stone club, moss patches. Slow stomp reads its weight; its wind-up tell is 750ms vs the standard 550ms and MUST stay visibly longer.
- **Boar** (low brown, dark bristle ridge, ivory tusks, curly tail), **Bear** (biggest ground pet: shoulder hump, round ears, claws), **Griffin** (lion body + pale eagle head, gold beak, flapping wings — flier follow at ~28px when tamed), **Phoenix** (flame-orange bird, gold flame crest, persistent ember-mote trail in ALL states — flier follow ~28px). One drawSpecies branch each serves both the hostile mob form and the tamed follower — same creature, same art, which is the point of fight-to-tame.
- **Weakened tell**: when a fight-to-tame creature drops below the wear-down threshold it stops attacking, cowers (slight crouch offset), and a pale-green pulsing ring appears at its feet + the name tag flips to "weakened!" green. This is the tame-window advertisement — if players don't notice the state change, check the ring is drawing.
- Hostile beasts reuse the amber "!" wind-up tell; no weapon-raise (they have no weapons) — the "!" plus a pre-lunge crouch IS their tell.

### 2026-07-14 (v13 — hostile mob framework: Goblin + Bandit art)
Rendering-scope changes (mob HP/damage/aggro numbers, wear-down threshold, and the peer-sync model live in the session record, not here):
- **Goblin**: small hunched green humanoid — two-facet body (#5f8a3c / #46682c), pale-green head blob, two pointed ear triangles, crude brown club held low. Reads smaller and scrappier than any player class.
- **Bandit**: human-scale but hooded — leather two-facet body (#7a5c40 / #5a4430), near-black hood covering the head blob, short steel blade. Deliberately darker/duller than player Knights so the silhouette can't be confused for another player.
- **Wind-up tell (the fairness rule)**: before every mob attack there is a ~550ms telegraph — the weapon arm raises AND an amber "!" pops above the head. A hit must NEVER land without this tell rendering first. If mobs ever feel like they hit instantly, check the tell is drawing.
- **Mob HP bars**: thin bar above the mob only once damaged (full-HP mobs stay clean), same visual language as player bars but smaller and red-tinted.
- Mobs use the standard unit sun-shadow, depth-sort by x+y like every other entity, and die with the existing burst particle language — no new death art.

### 2026-07-14 (v12 — bible pet roster + Beastmaster Shrine)
Rendering-scope changes (tame percentages, blood-decay curve, bait/bond mechanics, shrine timings live in the session record as tunable values, not here):
- **Fox/Fawn/Owl art RETIRED** with their species — replaced by seven bible-accurate species. Legacy roster rows may still reference them; code guards prevent crashes but they no longer render or follow.
- **Four elemental Sprites** (hovering wisps, low float ~10px, gentle bob): **Tree** (leafy green teardrop + sprig), **Water** (cyan droplet + wave arc), **Stone** (chunky hovering rock cluster + orbiting pebble), **Wind** (translucent pale swirl strokes — the only intentionally semi-transparent creature).
- **Wolf pup** (grey faceted, ears/snout/tail — direct descendant of v10's wolf art at smaller scale), **young Golem** (heavy blocky, moss patch, slow stomp bob), **Shadowfox** (sleek near-black fox, faint dark wisp trail; night-only so it mostly renders under the night palette).
- **Beastmaster Shrine**: small stepped stone altar near the safe zone edge, carved antler motif + paw dots on the face — same hand-crafted architecture language as the Forge. Pulses a warm gold-green glow (Tower-orb treatment) while any shrine blessing is active in the world.
- HUD: tame prompts now show the live computed success %, plus small lines for active shrine blessing countdown and blood-bonus state. Buff is deliberately private — no character aura.

### 2026-07-13 (v11 — logo font, plateau silhouette, Wild Companions art)
Rendering-scope changes (taming chance, roster mechanics, and the retirement of v10's auto-assigned pets live in the session record, not here):
- **Logo/header font**: Eagle Lake → **Almendra Display** (user pick from Art Nouveau direction). Gold + glow unchanged; Barlow body untouched.
- **BUG FIXED: grey plateau read as a straight-edged tabletop.** Root cause: baked notches were paint-only and too rare (hash > 0.78/0.8) to break a long contiguous cliff line — the plateau's actual tile silhouette stayed perfectly straight. Fix is geometric + paint: (a) deterministic **edge erosion** — boundary tiles of elevated regions (h ≥ 1, non-volcano, non-peak, non-safe-zone) drop one level ~30% of the time, breaking straight runs with real steps; (b) notch/outcrop chances raised to 0.55/0.6/0.7. Lesson: silhouette problems need geometry changes, not just surface decoration.
- **Wild Companions art**: three tameable species, low-poly faceted, distinct from rabbits and from each other — **Fox** (rust-orange, pointed ears, bushy tail; forests), **Fawn** (tan, taller thin body, white spot dots; meadows), **Owl** (stubby grey-brown flier, big head; rocky foothills). Wild ones wander near a home point; tamed active ones reuse the trail/circle follow language from v10. Old wolf/hawk models retired with the auto-assign system.
- New UI panel: Companions roster (same dark panel + gold header + Barlow language as Inventory/Crafting). Taming shows a small channel bar above the creature.

### 2026-07-13 (v10 — fonts, pets, armor, combat-feel pass)
Rendering-scope changes (combat mechanics — crit multiplier, poison numbers, knockback amounts, block reduction — live in the session record, not here):
- **Fonts replaced**: logo + panel headers Cinzel → **Eagle Lake** (user found Cinzel too basic); body UI Rubik → **Barlow**. All in-canvas ctx.font uses updated to Barlow. Gold colour + glow treatment on the logo unchanged.
- **Companion pets (visual-only)**: wolf (faceted grey ground-follower, trailing bob) and hawk (small faceted glider, circles the player when idle, trails at altitude when moving). Deterministic per player from username hash, drawn for all clients client-side, deliberately distinct silhouettes from ambient rabbits. No combat/stats yet.
- **Armor chest-plate tint**: single trapezoid overlay on the torso in tier colour (steel/cyan), lit/dark split matching the body facets. Base silhouette unchanged.
- **Block pose**: shield classes holding block show an enlarged raised shield on the facing side.
- **Hit stagger**: struck players recoil a few px opposite the hit direction with fast decay (local player directional; remote players brief shake during their flash window).
- **Poison tell**: small green motes rise off poisoned players while the effect runs.
- **Crit tell**: backstab damage numbers render amber with an "!" and slightly larger than normal hits.

### 2026-07-11 (v9 — combat/UI visual pass)
Rendering-scope changes (gameplay additions — new weapon types, recipes, dev chest — are documented in the session record, not here, per this skill's visual-only scope):
- **BUG FIXED: runic/dragonsteel auras were invisible** — the tier aura was drawn as a flat ellipse under the unit BEFORE the unit's own sun-shadow ellipse, which painted over it at the same position. Fix: tier effects now draw AFTER the unit, as a visible pulsing ring + rising motes. Lesson: draw-order within a single entity matters as much as entity sort order.
- **Every equipped weapon now renders a held silhouette** on the tiny unit (sword/spear/dagger/axe/bow/crossbow/staff), tier-coloured (steel/cyan/purple). Class identity props (helm, hood, hat, shield) stay; class default weapon props yield to the equipped weapon.
- **Melee swings sweep the weapon's own silhouette**, per-weapon motion: dagger fast tight arc, sword medium arc, spear straight thrust, axe wide slow arc, staff = magic pulse (no physical swing).
- **Projectiles have real shapes**: fletched arrow (bows), short thick bolt (crossbows), glowing orb (staves). Tier colours kept.
- **Floating damage numbers** rise and fade on hits (outgoing and incoming).
- **UI font swapped**: body text Pixelify Sans → Rubik (clean geometric sans; pixel font clashed with the flat-shaded direction). Cinzel retained for logo + panel headers only. All in-canvas ctx.font uses updated to match.
- **Class cards enlarged with idle-animated previews** + per-class "best weapons" blurb.
- Inventory rows now carry diamond item icons matching in-world ground-item icons.
- New world prop: dev supply chest near spawn (distinct wooden chest silhouette — flagged DEV-ONLY in code).

### 2026-07-11 (second review, v6 build) — addressed in v8
Confirmed working in v6 and MUST NOT regress: no fake roads (plateau elevation), decor density, birds, angular runic crystals, mountain/volcano separation, hand-composed ruin (user declared it DONE — never alter its composition), organic tree clustering (user likes it — never alter placement/density).
- **Individual tree art reads childish/clip-art** (two stacked circles). FIXED in v8: faceted low-poly polygon canopies, hard lit/dark facet split, per-tree width/lean/archetype variety; two canopy archetypes per forest (tall faceted + wide flat-top). Placement untouched.
- **Iron nodes mistaken for tiny huts** (rectangular orange patch = roof). FIXED in v8: orange vein streaks across facets, irregular boulder silhouettes.
- **Snow mountain reads as one flat wedge/glacier slab.** FIXED in v8: peak height now varies 2–4 levels via fine noise, producing broken stepped massif.
- **Sand flat/textureless; some sand non-coastal and unexplained.** FIXED in v8: dune ripple strokes, wet-sand band at waterline, shells/driftwood; non-coastal sand becomes rocky foothill.
- **Shape language too box-and-cone for natural features.** FIXED in v8: rocks get 3 hashed silhouettes (worn boulder / jagged shards / low slab); cliff faces get occasional notches and outcrop chunks. Architecture (Tower/Forge) deliberately stays clean/geometric by contrast.
- Additions in v8: ruin well (decor), signpost with real directional text, grazing rabbits, tower water reflection (when coastal), torch posts whose night glow marks lit ground near spawn, player-proximity grass sway, daytime butterflies over meadows, dock/jetty, sun-dimming cloud passes, deliberate dirt trail Spawn→Forge (single narrow intentional trail — distinct from the old fake-road bug), parallax horizon hills, lava heat-shimmer lines, bugs near bushes.
- Deferred pending user confirmation (do NOT build silently): interactable healing well; ore spawning in 2–3 node clusters.

### 2026-07-11 (screenshot review, v5 build) — all addressed in v6
Confirmed working in v5 and MUST NOT regress: monumental tower design, forge building silhouette, clean grass safe zone, cream stepped cliffs, warm palette, finite distinct ore.
- **Runic nodes too frequent + shards read as scattered "blue flames"** — reduce spawn rate sharply; sharper angular Bad North-style crystals, no rounded flame tops. FIXED in v6.
- **Ruins read as cluttered rubble/messy village** — replaced per-tile scatter with one hand-composed layout: broken wall run, standing archway, corner fragment, fallen column, sparse rubble, open ground between. FIXED in v6.
- **Long diagonal grey bands across grass (fake "roads")** — cliff faces along thin single-level noise contours formed corridor strips. Fixed by generating elevation from coarse plateau noise (wide blobs, no thin contour lines). FIXED in v6. Open design option (not built): deliberate stone paths Spawn→Forge→Tower, Thronefall-style.
- **Mountain snow block flush against volcano rock, no transition** — enforced larger landmark separation + no snow PEAK tiles within volcano radius (downgraded to ROCK buffer). FIXED in v6.
- **World too sparse vs references** — added non-gatherable decor: bushes, flowers, pebbles, fence bits near spawn. FIXED in v6.
- **No shoreline life** — animated white foam edge where shallow water meets land. FIXED in v6.
- **No sky/horizon treatment** — day/dusk/night-reactive gradient sky behind the island; deep water stays dark. FIXED in v6.
- **Cliff faces a single flat tone** — added baked cracks, moss drip at grass tops, subtle base banding; approach/colours unchanged. FIXED in v6.
- **Forge lacks individual character** — added doorway with shadow, warm window, beam, wood stack; silhouette unchanged. FIXED in v6.
- **No ambient life** — 3 bird silhouettes circling the Tower. FIXED in v6.
- **Peak silhouette boxy** — per-tile jittered peak tops + occasional snow spikes for jagged outline. FIXED in v6.
- **World edge is an invisible wall** — deep water darkens toward the map border (kept dark, not lightened). FIXED in v6.

### 2026-07-07 (screenshot review, isometric v4 build) — all FIXED in v5, verified via 2026-07-11 screenshot
- **Ore/rock nodes look identical and infinite** — no visual distinction between plain rock / iron / runic stone at normal zoom (colour flecks too small to read). Gameplay-wise, ore nodes were also infinitely mine-able — **this is a gameplay bug, not art, but was flagged in the same pass**: nodes must be consumed on gather and not respawn instantly (or respawn on a long timer), and must have a clearer, larger, more distinct visual per ore type — bigger colour patches, not tiny flecks, or a distinct silhouette shape per type.
- **The Spawn Forge is not visually distinct from generic rock/ore clutter** — needs a clear forge silhouette (anvil/furnace/chimney shape) that reads instantly as "building," not more grey rubble.
- **Safe zone ground rendered as a separate brown/dirt patch with a strange bright green pool in the middle** — this is wrong; the safe zone should just be the normal grass biome under the dashed boundary ring, not a distinct crater-like texture.
- **The Eternal Tower reads as a thin plain silo, not a grand centerpiece** — needs significantly more visual mass/width, a proper stepped base, and architectural silhouette detail (buttresses, wider crown, more levels) — it should dominate the skyline the way Thronefall's central keep does.
- **Ruins and mountain both read as generic "grey cube debris"** with no distinct silhouette language separating "this is a ruin" from "this is a mountain" from "this is a rock resource node." Each needs its own distinct shape vocabulary.
- **Mysterious floating "+1" diamond icons** appeared scattered near mountain/ruins in a screenshot — flagged as a likely rendering bug (unclear source), needs investigation, not a wanted effect.
- **Tree spacing too uniform/grid-like** — reads as a planted orchard rather than an organic forest; needs randomised clustering and gaps.
- **Player light glow is a hard, unnatural circular vignette** ("flashlight cone" look) rather than ambient light bleeding naturally into the surroundings.
- **No visible stepped elevation/cliffs** despite height data existing — the ground reads flat with no sense of tiers, even in mountain regions.

## Process reminder for whoever is iterating on this

1. Read this skill fully before touching any rendering code.
2. After any build, the user reviews via **screenshot**, not a live look from Claude (Claude cannot see the rendered canvas directly). Wait for a screenshot before assuming a fix worked.
3. When the user reports a new problem, add it to the "Known visual problems" list above (with date) before or while fixing it, so it persists across sessions.
4. Do not touch gameplay logic (combat, inventory, database schema, multiplayer sync) during an art-only pass unless the user explicitly asks — cross-reference the "Technical foundations" section above.
5. World size, landmark list, and other scope decisions for the current dev build are tracked in conversation/project context, not duplicated here — this skill is about the RENDERING RULES only.
