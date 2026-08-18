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

### 2026-08-18 (Elder Drake palette hotfix)

Flagged by the user directly: the drake "looks like a normal goon" despite
the silhouette matching the approved reference. Root cause found by
re-reading this skill's own rule 20: the original palette was five shades
of near-black muddy brown (#2a2622/#403a34/#17140f/#221f1b/#0d0b09) with
only tiny decorative ember accents — a direct violation of "never
desaturated/muddy" and the flat-colour-contrast identity rule. The
reference image's painterly shadow-mood got pulled into the sprite instead
of this game's bold flat-shaded language.

FIXED: same geometry, unchanged — spine ridge, horn, hunched stance, teeth
were never the problem. Body recoloured true near-black (#14100d), and the
spine ridge / horn / tail spikes / vein cracks became bold glowing ember
(#ff7a3c, matching the locked Lava palette entry) instead of tiny dark-on-
dark decoration — real structural contrast, not an accent. Verified via
node before touching main; full gauntlet re-run clean, 591/591.
Dated entries, most recent first. When a build fixes one, mark it FIXED but don't delete it — it's a regression check for the future.

### 2026-08-18 (v30 — Elder Drake, ruin variety, idle-wander, real gathering + Pickaxe)

Four systems in one version. Built in-session after the spec was recovered
from git history — it had been accidentally overwritten by the v32 spec
push while NEXT_BUILD.md still pointed at it, which would have failed the
overnight run with nothing to build.

- **Elder Drake** — the bible's only boss-tier creature, absent from the
  game until now. 900hp/28dmg, one instance, hand-placed near the Volcano
  rather than by the hashed spawn loop (biomes:[] so the loop skips it).
  Guaranteed Dragonsteel. 6-hour respawn. Three phases: normal above 60%,
  a 50-degree cone sweep below it, a 90-degree breath below 30% — both
  specials reuse v27's spear-cone and staff-splash shapes rather than
  inventing new combat code.
- **Ruin variety** — all six ruins previously called one hardcoded layout.
  Now three (original, Collapsed Tower, Sunken Courtyard), picked
  deterministically from each ruin's own anchor so it never changes.
- **Idle-wander** — the old fixed 0.8-tile shuffle became a patrol scaled
  to each mob's own leashRadius, with a real ~3.5s pause / ~3.5s move
  cycle keyed off m.ph so mobs do not drift in sync.
- **Real gathering** — nodes have HP, each press deals the equipped
  weapon's own dmg, so tier already controls mining speed with no new
  stat. Ore needs an axe or pickaxe. Pickaxe added at Iron and Runic
  (Dragonsteel deferred: needs The Ancient Forge, unbuilt). weaponKind()
  checks "pickaxe" BEFORE "axe" — "pickaxe" contains "axe", and the
  unmatched fallback is "sword", so order mattered twice.

Interior cave nodes were deliberately left as a one-press pick — they are
a gathered resource, not something you mine through, and v29/v32's branch
was left untouched.

Three v13/v20 assertions were updated rather than forced: sea_serpent is
still the hardest NON-BOSS mob (which is what it always meant), and the
fixed per-piece ruin census no longer describes a world with three layouts.

JUDGMENT CALLS
- **900hp/28dmg, 6h respawn, MOB_K 3.40** — all unstated; sized so the
  drake is unambiguously the largest and hardest thing in the world.
- **Node HP 30 wood / 40-55 ore** — unstated. Ore tougher than wood.
- **Pickaxe stats (11 and 22 dmg)** — deliberately weaker than the axe
  line in a fight, since their dmg doubles as mining power.
- **Cone angles 50 and 90 degrees** — unstated; wide enough that phase 3
  is genuinely hard to sidestep.

### 2026-08-18 (v33 — Bases part 1: placement & construction)

The first thing in this world a player builds. Six placeable pieces —
Foundation, Wall, Door, Storage Chest, Forge, Generator — across the bible's
five material tiers. Raiding, destruction, per-piece HP, the Generator's
actual production tick and the Architect class tie-in are v34 and are
deliberately absent rather than half-built. Costs, spacing and persistence
live in the README + commit message; below is only how it all looks.

- **Not one new palette entry.** A piece is tinted with the colour its own
  MATERIAL already has in `ITEM_META` — wood `#a06a34`, stone `#a8a8b2`, iron
  bar `#d0d4dc`, runic stone `#5ac8e0`, dragonsteel `#b06ce0`. That is what
  makes tier legible across a valley without a label, an icon or a badge, and
  it means the bible's "higher material tiers are your backup defence" is
  something you can read off a base from outside it. A dragonsteel wall is
  violet because dragonsteel is violet.
- **Every piece is `drawBox`, on the locked 0.72 / 0.55 facet split.** No new
  shading path, no gradients, no outlines. They take the standard sun shadow
  and sort by `x + y` with everything else, so a player can stand behind their
  own wall and be occluded by it like any tree or rock.
- **The Door is the v20 dungeon-entrance language, in the piece's own
  material** — two jambs carrying a lintel over a flat near-black opening. The
  mouth is dark because it is a dark colour, not because it is blurred. That
  reuse is deliberate: a door has to read as a *gap in the wall run* at a
  glance, and this file already had a shape that says "way through".
- **The Storage Chest is the dev chest's silhouette, and deliberately NOT its
  paint.** Same base box, same slightly-wider lid — but the gold strap and the
  "DEV SUPPLY" label are gone, and the strap is the piece's own material
  darkened. The two must never be confused; one is a ⚠️ DEV-ONLY object.
- **The player Forge is the Spawn Forge shrunk, including its ember mouth and
  its anvil colours (`#3e424a` / `#4a4f58`), reused verbatim.** It is the same
  building, smaller — which is the read, since it does exactly the same job.
  The Spawn Forge keeps its scale, its slate roof and its name plate; nothing
  about it was touched.
- **The Generator is deliberately inert-looking.** A slow, quiet core pulse
  (`sin(t/900)`, alpha 0.28–0.46) rather than a working animation, because it
  produces nothing this version and must not advertise output it does not
  have. When v34 gives it a real tick, that is where the animation earns its
  keep.
- **A bare Foundation carries an inset upper slab.** Without it, a low flat
  box at 3px reads as a painted patch of ground rather than as something
  built — and the Foundation is the one piece you look at before there is
  anything else there to give it context.
- **Both new panels are the existing panel language, reused, with zero new
  component styles.** The BUILD list is the `.craft-row` treatment the
  Crafting panel already uses; the tier picker and both Storage Chest lists
  are `.inv-row`, and the selected tier wears the same gold `.equipped`
  marker an equipped weapon does. Only two lines of CSS were added, both of
  them positions.
- **⚠️ Walls have no orientation.** A Wall is a full-tile block, not an
  axis-aligned panel, so a wall run reads as a row of cubes rather than as a
  continuous barrier. Nothing in the spec asked for rotation and adding one
  means a rotation control and a second silhouette — but this is the single
  most likely thing to want next, and it is the difference between "a base"
  and "a fence made of boxes".
- **⚠️ Nothing marks a base as yours from outside it.** No owner name floats
  over a piece, and the only owner-dependent behaviour in the world is that
  your own Door lets you through. Correct for this version — the bible's whole
  base pitch is that anyone who finds your base walks straight in — but it
  means a Door is visually identical whether it will open for you or not.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent. All shipped through the full gate
(parse clean, `run3` `CAUGHT ERROR: none`, `run4` **628/628 with zero FAIL**,
`run5` 803 coverage draws clean) — refinements to consider, not unfinished
work.

1. **⚠️ A small v33 SQL update is needed before anyone can build.** The new
   table is `create table base_pieces (id bigserial primary key, kind text,
   tier text, x float8, y float8, owner text);` — exactly the spec's six
   columns and exactly `ground_items`' shape. Without it, placement refunds
   its materials and says so out loud rather than keeping an unsaved
   structure that would vanish on the next login; everything else in the game
   is unaffected. Same shape of note as v25's `last_fed_at` column.
2. **Storage Chest contents are SESSION-LOCAL.** The spec pins `base_pieces`
   to exactly id/kind/tier/x/y/owner — no contents column, no second table —
   so there is no schema here for what is inside a chest. The chest itself
   persists; what you leave in it does not, yet. Flagged rather than solved,
   because solving it is a schema decision (a JSON column on the row, or a
   `chest_items` table) and inventing one was not this version's job. This is
   the same call v21 made for the charm slot.
3. **Build costs: Foundation 4, Wall 3, Door 3, Chest 3, Forge 5, Generator
   5 — units of the chosen tier's material.** The bible sets no build costs at
   all. Deliberately flat across tiers, so choosing dragonsteel costs you
   dragonsteel rather than *more* dragonsteel. Every one is a one-line tunable.
4. **`BASE_ANCHOR_R = 8` tiles.** "Anchors everything else nearby" had to
   become a number. Eight leaves room for a real structure around one
   Foundation at the spec's 3-tile spacing without letting a single Foundation
   licence a base that sprawls across a region. Tunable.
5. **`BASE_PLACE_DIST = 2` — pieces are raised on the tile you face, two out.**
   The spec says nothing about how a player aims a placement. Two tiles is
   far enough that you can never seal yourself inside your own wall the moment
   it appears, and it reuses `facing`, which every other directional thing in
   this file already reads.
6. **Terrain and interiors are refused as build sites, though the spec names
   only safe zones.** A `BLOCKED` tile is lava, deep water or a peak — nothing
   stands there — and an interior is a different space whose coordinates are
   not world coordinates, so a piece built inside a cave would appear on the
   surface. Only one reading of either is sensible.
7. **Minimum spacing is measured against EVERYONE's pieces, not just your
   own.** The spec says "between any two player pieces". Measuring only your
   own would let two players interleave bases tile-by-tile, which is exactly
   what the rule exists to prevent.
8. **A failed insert refunds the materials rather than keeping the piece.**
   The spec does not cover a write that comes back empty. Keeping it locally
   would show the player a structure that silently vanishes on their next
   login and takes its cost with it.
9. **`B` is the BUILD key, the 14th `KEYBIND_DEFAULTS` entry**, labelled
   "Build" in the remapping screen. It was the only sensible letter still
   unbound after v27 took Q and v28 took R. The two v23/v27/v28 assertions
   that pinned the counts were **updated, not relaxed** — 13 → 14 bindable
   actions and 12 → 13 labelled rows — so a future pass cannot lose the
   binding without failing.
10. **The v27 guard asserting "no base/structure system was invented for the
    Architect" is retired**, exactly as v31 retired its two event guards, and
    replaced by the real proof gates above. What it was actually protecting is
    still pinned: a new assertion checks the Architect's own class tie-in is
    genuinely absent, not quietly half-built.
11. **`run4` and `run5` learned a recording insert stub, scoped by table name
    to `base_pieces` alone.** The shared stub returns the whole table for
    every call, so an insert never lands anywhere — which makes the
    round-trip gate ("insert, then re-select, same data comes back")
    untestable and, in `run5`, leaves every base render branch unreachable.
    Deliberately allow-listed to one table so no existing assertion's
    behaviour can shift underneath it.
12. **`run4`'s Door test flips the stored owner in the stub table and reloads**
    rather than adding an owner setter to the game. That proves both halves of
    the door rule — the owner passes, someone else is stopped — through the
    real persistence path instead of a debug-only shortcut.

### 2026-08-18 (v32 — Abyssal Hollow, reusing v29's interior system)

Second interior-bearing biome. Generalized v29's system rather than
duplicating it, specifically so Dungeons can be the third without another
rewrite: `uwcaveClusterAnchor()` became `clusterAnchor(tx,ty,biomeConst)`,
`enterInterior()` took a biome parameter (defaulted, so every v29 call site
still works), and space ids became `cave:<kind>:<anchor>`.

- Abyssal interiors read colder and near-black against the cave's
  blue-grey, with violet bioluminescence instead of cyan.
- Shadow Dragon moved INSIDE — `biomes: []`, no surface spawn, same as
  Water Dragon in v29. Moved, not duplicated.
- No hostile mob inside the Hollow: Sea Serpent is a UWCAVE creature and
  the bible names none for the Hollow, so inventing one was declined.
- `void_shard` added as the Hollow's resource. The bible names "rare
  aquatic resources" for Underwater Caves but nothing for the Hollow, so
  this is a deliberate new addition, flagged as such rather than presented
  as implementing something already specified.

Three issues found and fixed, none of them in the game logic:

1. A debug teleport did not reset `me.space`, so a harness that walked
   into a cave earlier in its sequence ran every later check from inside
   one — six breath assertions failed from that single cause.
2. The dive test picked its "shore" tile as anything not DEEP/PEAK/LAVA,
   which now matches ABYSSAL — a doorway, not standable ground. The player
   was teleported onto one and correctly pulled in. Test selection fixed;
   the game behaviour was right.
3. The interior debug hook ignored the biome parameter, so entering an
   ABYSSAL tile still searched for a UWCAVE cluster and found nothing.

One assertion was deliberately retargeted rather than forced: the gather
plumbing is already proven by v29's identical test, and `doInteract()`
will prefer taming the Shadow Dragon that also lives in the interior if it
is the nearer target. The v32 change is which resource the node carries,
so that is what is asserted.

JUDGMENT CALLS

- **`void_shard`** — name, colour, and existence all invented; no bible
  text to implement. Flagged as new content, not interpretation.
- **No mob in the Hollow** — declining to invent one, rather than reusing
  Sea Serpent somewhere it does not belong.
- **Same 3-5 node count and 26x26 grid as v29** — no reason to differ, and
  differing would have been an unstated change.

### 2026-08-18 (v31 — Blood Moon and Meteor Shower)

Both world events, built in-session. Deliberately derived rather than
broadcast: each is a pure function of worldEpoch + worldSeed, so every
client computes the same Blood Moon on the same night and races for the
same meteor rocks, with no new table, no new channel, and no authority
problem over who "started" the event.

- **Blood Moon**: `worldDayNum() % 12 === 0` and night. Mobs get x1.35 hp
  and damage, x1.5 aggro radius ("more aggressive"), and rare species get
  +0.30 on their presence roll — which is the roll that decides whether a
  Shadowfox/Unicorn/Lightfox exists at all this session, so the bible's
  "increase significantly" lands where it actually matters.
- **Meteor Shower**: hashed per 15-minute slice at a 12% chance, so it is
  genuinely unpredictable to a player but identical for every client. The
  sites are hashed off the same slice, which is what makes the bible's
  "scramble to reach them first" a real race — everyone sees the same
  fourteen rocks. They are FINITE, so the first player there claims it.
  None land in a safe zone.

IMPORTANT NAMING NOTE: `bloodDecayFrac()` further up the file is NOT this.
That is the v12 PvP-kill tame window and only shares the word "blood".
Checked before writing a line, and deliberately named `bloodMoonActive()`
so the two can never be confused by a future version.

Two v27/v28 guard assertions asserting these events had NOT been started
were retired on purpose and replaced with real proof gates.

JUDGMENT CALLS

- **x1.35 mob hp/dmg** — "stronger" is unquantified in the bible. Enough
  to feel it, not enough to make a Blood Moon night unsurvivable. Tunable.
- **x1.5 aggro radius** — the mechanical reading of "more aggressive".
- **+0.30 presence roll** — applied to presence rather than count, so the
  effect is "the rare thing is actually out tonight" rather than "there
  are more of a thing that already spawned".
- **15-minute slices at 12%** — "randomly with no fixed pattern" needed a
  concrete shape. Averages a shower every couple of hours. Both tunable.
- **14 sites per shower** — enough to be a real scramble on a 240x240 map
  without blanketing it.
- **Meteor ore yields runic_stone** — the bible says "rare ore" without
  naming a new material, and inventing one would be unstated content.

### 2026-08-18 (v29 — real cave interiors, Underwater Caves as the proof of concept)

Built directly in-session, same as v28. Genuinely new architecture — the
first system in the game where a player's position isn't just an x,y on
the one shared grid. Underwater Caves stop being a tinted patch of ocean
tile and become an actual place you walk into, generated on demand,
shared with anyone else who finds the same entrance.

- One field, `sp`, added to the move broadcast. The receive side already
  processes every broadcast on the one channel; it now skips rendering or
  colliding with anyone whose space doesn't match. No second channel, no
  new sync system — confirmed and asserted directly, not just claimed.
- Each interior is a 26x26 grid generated once from a seed derived from
  the physical cave's own connected-cluster anchor plus `worldSeed` —
  nothing stored server-side, and two players entering the same cave get
  provably identical geometry (asserted by regenerating from a cleared
  cache and diffing every tile).
- Entry hooks the exact moment breath already stopped draining on a
  UWCAVE tile — no new detection, the interior IS the air pocket that
  moment was always describing.
- Water Dragon and Sea Serpent moved inside — removed from the surface
  `biomes: []` entirely, not duplicated. Confirmed absent from the
  surface and confirmed present inside, both directions asserted.
- `aquatic_essence` — the bible's "rare aquatic resources," promised since
  the biome list existed and unbuilt until now.

A real bug found and fixed before this shipped: `me.space` was never
initialized on player construction, only ever set inside `exitInterior()`.
Every player counted as "inside a cave" from the moment they logged in,
which silently broke breath everywhere. Fixed by making the interior check
treat an unset space as "main" rather than trusting every construction
path to remember a new field — six failing assertions, one root cause.

A second, smaller issue: the debug hook for entering a cave called
`enterInterior()` directly without first honoring the precondition its
only real call site guarantees — that the player is already standing on
the entry tile. Fixed the hook, not the game logic, which was correct the
whole time.

JUDGMENT CALLS

- **26x26 interior size** — unstated. Big enough to feel like a real
  space, small enough to generate and render cheaply. Tunable.
- **3-5 aquatic_essence nodes per interior** — the spec's own range,
  implemented as `3 + hash(...) * 3`.
- **A single Water Dragon and single Sea Serpent per interior**, not a
  population — matches how rare and dangerous finding one should feel,
  distinct from a normal wilds density.
- **The exit tile sits at the arrival corner**, not somewhere separate —
  simplest correct choice for a first version; nothing stops a future
  version from making entry and exit different points.

### 2026-08-17 (v28 — full mounting, all nine bible species)

Built directly in-session rather than overnight. Mounting had been deferred
five separate times (v16/v17/v18/v19/v21) and then lost entirely once — a v26
spec was written, never verified as built, and quietly overwritten while the
conversation moved on. This is the same design, re-verified line by line
against the real post-v27 file before a single edit.

- `MOUNTABLE_SPECIES` — the bible's nine, exactly: stag, griffin,
  crystal_golem, the four dragons, shadowfox, lightfox.
- `R` joins `KEYBIND_DEFAULTS` as `mount`, so it inherits the v23 remapping,
  conflict-checking and persistence with no new code. Nothing hardcoded.
- `MOUNT_SPEED_MULT = 1.6`, applied only to the player's own movement — it
  multiplies alongside the existing SLOW/blocking factors rather than
  replacing them.
- `mountSeatOffsetY()` scales the rider's lift by the mount's own SPECIES_K,
  because a lightfox (1.05) and a shadowfox (1.66) genuinely do not sit the
  same height off the ground. Flat offsets were rejected for that reason.
- `updatePet()` early-returns the pet to the rider's own tile while mounted —
  no trailing, no circling glide — and the proof gate asserts BOTH directions:
  seated while mounted, trailing again after dismount, so the suspend is real
  and not just a coincidence of starting position.
- `updatePetCombat()` returns early while mounted. A mount lunging at things
  mid-ride isn't bible-required and reads wrong.
- `mo` on the move broadcast, so remote players see a rider seated rather
  than a rider standing next to a pet.
- `enforceMountValidity()` runs every frame: swap or lose the active pet and
  the rider is dismounted rather than left in a state pointing at nothing.

JUDGMENT CALLS

- **`MOUNT_SPEED_MULT = 1.6`** — unstated anywhere. Fast enough to be the
  real reason to mount, slow enough that the world doesn't shrink. Tunable.
- **`2.2` seat base** — the multiplier on SPECIES_K. Chosen so the smallest
  mount still clearly carries the rider and the largest doesn't float.
- **The v27 class ability works while mounted.** The original v26 draft could
  not have accounted for this — abilities did not exist yet. Blocking it
  would have been unstated scope, so it follows the same rule as combat:
  fully allowed, and there is now a proof gate asserting it fires.
- **`R` over any alternative.** Q went to the ability in v27; R was the only
  remaining letter that reads as "ride" and collides with nothing.

### 2026-08-16 (v27 — five class abilities + real spear/staff identity)
No new species, no new biomes, no world colour touched, and not one existing
draw call altered. v27 is a mechanics version — the cooldowns, the damage
multipliers, the cone angle and the counterplay rules live in the README + this
commit message. Its whole rendering scope is **one new effect and one HUD
line**, and both are things that already existed being pointed somewhere new.
- **The AOE ring is `aura()`, reused, with exactly one thing added: `rx`
  grows.** The v18 helper (pulsing radial wash + ground ellipse + rising
  diamond motes) was written to be reused and this is the first time anything
  has. Feeding it a radius that scales with the effect's own 0→1 life is what
  turns a standing wash into a ring travelling outward; nothing inside `aura()`
  was touched, and no second effect system was built. Radius is in **tiles**
  converted at `IW2` — the tile half-width — which is what plants the ring on
  the ground plane instead of floating it at an arbitrary pixel size.
- **Two rings, one code path, deliberately the same violet.** Mystic's Arcane
  Burst draws at 4 tiles, a staff orb's splash at 2, both in `#9670dc` — the
  Mystic's own lit palette colour, as `"150,112,220"` because `aura()` wants a
  triplet, not a css colour. They read as the same magic because they *are* the
  same magic: the class most associated with area damage, and the weapon that
  class carries. A staff splash in a different hue would have read as a second,
  unrelated system.
- **The ring draws after the entity pass and before the damage numbers** — over
  the ground it covers, under the numbers it caused. Its alpha falls to zero
  across its 520ms life, so it never lingers as a decal.
- **The staff splash got a ring even though the spec only asked for one on the
  Mystic.** This is the v18 wraith-bolt lesson again: a body dying 2 tiles away
  from where the orb landed has no visible cause otherwise. Same helper, same
  colour, smaller radius — a flagged call, not an addition to the art language.
- **Ability feedback is the v9 floating-text language, not new HUD chrome.**
  `GUARD BREAK` / `MARKED` / `ARCANE BURST` / `RALLY` / `QUICK BRACE` on cast,
  and `GUARDED` on a hit the Knight's window absorbed — each in its own class
  palette colour, in exactly the shape `POISONED`, `BLOCKED -n` and `RECOVERED`
  already use. No new panel, no new bar, no aura on the character.
- **The HUD help line gained `Q class ability`,** generated from `KEYBINDS` like
  every other entry since v23, so it follows a rebind instead of lying about it.
  The static fallback string in the markup was updated to match.
- **⚠️ There is no cooldown readout anywhere.** Five abilities now sit on
  cooldowns from 7s to 12s and the only feedback that one is ready is pressing
  Q and having something happen. That was not in the spec and no HUD element
  was invented for it, but it is the single most likely thing to want next —
  and it is a HUD line, not a rebuild, since `debugAbilityInfo()` already
  exposes every timestamp it would need.
- **⚠️ Nothing distinguishes a Knight standing inside a Guard Break window.**
  The cast floats once and then the buff is invisible until a hit lands on it.
  Deliberate — the v12 rule that buffs are private and carry no character aura —
  but worth a look now that an *enemy* has a reason to care (Marked Shot exists
  specifically to punch through it, and a Ranger cannot see what they are
  punching through).

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, plus one thing the spec asserted
that is not true of this repo. All shipped through the full gate (parse clean,
`run3` `CAUGHT ERROR: none`, `run4` **528/528 with zero FAIL**, `run5` 792
coverage draws clean) — refinements to consider, not unfinished work.
1. **⚠️ The spec opens "v26 shipped successfully". It did not — v26 was never
   built in this repo.** `runehaven.html`'s last build commit is **v25**, this
   skill's newest entry before today was **v25**, and there is no mounting code
   and none of the v26 species in the file. v27 was built anyway, and
   deliberately, because **v27 does not depend on v26 for anything**: every
   claim it makes about the current code was re-verified directly before a line
   was written — `tryAttack()`'s universal 1.6x backstab crit and per-type
   knockback weights (`axe` 1.1 / `spear` 0.6 / `sword` 0.55 / `dagger` 0.2)
   are exactly as described and untouched, `CLASSES` really was palette plus
   flavour text, spears really did hit one target, staves really did fire a
   single-target `"orb"`, `aura()` is present, and Q really was unbound. Nothing
   in v27 references mounting or the v26 species. **If v26 was meant to ship
   first, it is still outstanding and this version does not block it.**
2. **Arcane Burst deals the equipped weapon's damage, unscaled.** The spec
   locked the 4-tile radius and the `dealHit`/`mobHit` route but named no damage
   number. Using `equippedWeapon().dmg` keeps it inside the existing damage
   economy and lets it scale with gear like everything else, instead of adding a
   flat constant that would be strong at iron tier and worthless at dragonsteel.
   One line to change if a fixed number or a multiplier was wanted.
3. **Marked Shot does NOT consume the Knight's Guard Break window.** The spec
   says a Marked Shot "cannot be blocked by" the window — it does not say
   whether it strips it. It punches through and leaves the guard standing for
   the next ordinary hit, which is the reading that makes the pair genuine
   counterplay rather than a dispel. `run4` pins both halves.
4. **Knockback for the two new AOE paths: 0.3 (burst) and 0.15 (splash),
   tunables.** Unspecified. Both deliberately lighter than a committed melee
   swing, since neither is one. The spear thrust keeps v10's existing `0.6`
   spear weight exactly — the spec said not to touch that table and nothing did.
5. **Rally Companion loads its 3 charges whether or not a companion is out.**
   The spec gates nothing on having one, and the charges are spent inside
   `updatePetCombat()`, so with no pet nothing spends them and nothing breaks.
   Casting it petless burns the 9s cooldown for no effect — the same shape as
   Architect's deliberate no-op, and arguably the same thing to revisit.
6. **The rally bonus multiplies the post-Beastmaster damage.** A Beastmaster's
   own +20% passive (`PET_BM_BUFF`, v16) is already baked into `def.dmg`, so
   +40% lands on top of it: a rallied wolf is 4 → 5 → 7. Adding the two as one
   +60% instead would have been the other reading; this one keeps the passive a
   passive.
7. **The `ability` action is the 12th `KEYBIND_DEFAULTS` entry, labelled "Class
   ability" in the remapping screen.** The two v23 `run4` assertions that pinned
   "11 bindable actions" were **updated, not relaxed** — the count, the default
   table and the check-site list all moved to 12, so a future pass cannot lose
   the binding without failing. (Aside: the spec's parenthetical says the
   current defaults include `r`. They do not, and never have — there are eleven
   and `r` is not one of them. Q was unbound either way, which is the part that
   mattered.)
8. **`debugSetPlayer()` gained `cls`, `equipped` and `armor`; three new hooks
   joined it.** `debugAbilityInfo()` / `debugSetAbility()` are copies and a
   setter in the v21/v23/v25 pattern. `debugCombatHandles()` is the deliberate
   exception: it returns **live** `others` / `mobs` / `projectiles`, because
   PART D's gates have to stand real targets in the world to prove a burst, a
   thrust and a splash hit more than one of them. Same reasoning
   `debugAudioEngine()` used for its live handle.
9. **`run4`'s v27 block reads `window.performance.now()`, never the bare Node
   global.** The game runs on jsdom's clock and the harness on Node's; the two
   have different time origins, so mixing them made every ability-window
   comparison silently wrong. Found and fixed during this build — worth knowing
   for any future gate that asserts against a timestamp.
10. **`run5` gained an ability-ring sweep** — all five classes cast for real
    with frames pumped while a ring is alive, plus the staff splash's own ring,
    and it hard-fails if no ring was ever alive (the render branch is
    unreachable in the plain 5-frame boot). 758 → **792** coverage draws. No
    species, mob, weapon kind or class was added this version, so the existing
    `*_LIST` arrays are already complete.

### 2026-08-15 (v25 — Crystal Golem, Krakenling, Salamander King)
Three new species, no new biomes and no world colour touched. All three bodies
are approved concept art from the locked spec, **ported verbatim** into the
existing `P`/`EY` helper convention in the `drawSpecies` chain — not redrawn,
not reinterpreted. Spawn gating, stats and the feeding mechanic live in the
README + commit message; below is only how they look.
- **Crystal Golem** (Rare, mountain ruins). Deliberately the *same silhouette*
  as the young Golem — same blocky two-facet body, same head slab, same arm
  blocks — re-cut in pale crystal (`#9fc4e8` / `#5a7fb0`, `#d4e8f8` top facet).
  That sameness is the point: it must read instantly as "a Golem, but made of
  something else", the bible's own framing. The tells that separate them are a
  **violet core glow** (`#e8a8f8` + a soft square halo) where Golem has its
  runic-cyan eye, **facet lines** where Golem has cracks, a white shine facet,
  and **no moss** — moss is the old-stone Golem's signature and must never be
  added here.
- **Krakenling** (Epic, Abyssal Hollow). Deep-violet mantle (`#5a3a6e` /
  `#7a5a92`) over five tentacles that sway on a per-tentacle sine offset, big
  pale eyes, and three slow-pulsing bioluminescent dots along the mantle. It is
  the only cephalopod in the game and shares nothing with the dragon bodies it
  lives beside on `B.ABYSSAL` — at that depth the Shadow Dragon is the only
  other thing down there, so the two must not converge.
- **Salamander King** (Epic, Sunforge Caldera). Long, low and horizontal —
  molten orange (`#d84a28` / `#f07038`) with a dark `#8c2c14` jaw, a three-peak
  **gold crown ridge** (`#f4c020`) that is what makes it a *King* rather than a
  big lizard, matching gold belly marks, and a single hard heat-shimmer stroke.
  Its palette is the Caldera's own (`#f2c884` ground), so it reads as native to
  that biome rather than dropped onto it.
- **One branch, both forms.** The Salamander King's hostile rampage form draws
  from the exact same `drawSpecies` branch as the tamed companion, via the v14
  `def.tameable` route in `drawMob` — same creature, same art, which is the
  whole point of a pet that can turn on you. It therefore inherits the walk
  bob, sun shadow, `x+y` depth sort, the amber "!" wind-up tell, the red mob HP
  bar and the pale-green weakened tame ring with no per-species special casing.
- **Companion panel**: the Salamander King's row carries a `N% fed` readout.
  Below 30% it flips to the HUD's existing low-HP language — the same
  `var(--danger)` red, the same "this is going wrong" read — plus a "feed it!"
  nudge. This is deliberately **not** new panel chrome, and it is **not** the
  pet HP bar, the downed ring or the tame ring: happiness is a fourth state and
  reuses the low-HP colour only, never those shapes.
- All three are ground species, so they take the standard walk bob, sun shadow,
  depth sort and every v16 combat overlay unchanged. `SPECIES_K`: Crystal Golem
  1.50, Krakenling 1.10, Salamander King 1.20.

## JUDGMENT CALLS THIS VERSION
Five, all flagged in code at the site of each. Everything here shipped through
the full gate (parse, run3 clean, run4 476/476 with zero FAIL, run5 clean) —
this is a complete version, and these are refinements to consider, not
unfinished work.
1. **Crystal Golem's `SPECIES_K` is 1.50, not the spec's literal 1.15.** The
   spec asked for both "1.15" and "slightly smaller than regular Golem's
   existing entry — confirm against Golem's actual current value and stay close
   to it, don't invent a wildly different scale". Golem is **1.65**. 1.15 is not
   slightly smaller than 1.65; it is Stag's value, a deer, and would have made
   the Rare variant a third smaller than the Uncommon one it is meant to read as
   a rarer sibling of. The confirm-against-the-real-value clause is what caught
   it, so it won. **One-line revert if the smaller silhouette was intended.**
2. **The Krakenling art's branch head was changed from `kind ===` to
   `species ===`.** The drawing body is untouched, exactly as specified. The
   spec placed the branch "alongside the other wild species checks", and that
   chain dispatches on `species` — there is no `kind` in scope anywhere in
   `drawSpecies`, so `kind === "krakenling"` would have thrown on every frame.
   Krakenling is a wild pet, not a mob, so `drawMob`'s `m.kind` chain was not
   its home either. Only one location was ever possible.
3. **Crystal Golem's tame base is 0.25, but not "matching Golem's".** The spec
   said 0.25 "matching Golem's"; Golem's actual base is **0.50**. 0.25 was kept
   because it is the Rare-tier baseline every other Rare pet in the file already
   uses (Unicorn and all four dragons) — the number is right, only the stated
   reason was wrong.
4. **Every rostered Salamander King is checked for starvation, not just the
   active one.** The spec gated *feeding* on being the active companion but did
   not say which pets the rampage check walks. Checking only the active one
   would mean a benched King rampaged the instant it was brought back out, with
   no way to have prevented it. Feeding still works exactly as specified — select
   the pet, then Feed.
5. **`last_fed_at` persistence degrades instead of failing.** The feed clock is
   written to a `last_fed_at` column on the `pets` table, un-awaited and
   error-swallowing, and falls back to `tamed_at` (which *is* the spec's
   "tame-time on capture") when the column is absent. **A small v25 SQL update
   is needed for feeds to survive a reload** — `alter table pets add column
   last_fed_at timestamptz;` — but the game is fully playable without it and
   nothing can throw either way.

Also noted, no action taken: the bible **does** list Crystal Golem on its
MOUNTABLE PETS line, where the spec said it did not. No riding code was added
anyway, because riding is deferred for *every* species alike — the same
standing position v21 and v22 recorded for the dragons. Nothing to revisit until
mounting itself is built.

### 2026-08-13 (v24 — the intro card + real background/combat music)
No new species, no new biomes, no world colour touched. The rendering scope of
v24 is one screen that plays before the game does; the music rotation, the
combat switch and the audio file layout live in the README + commit message,
not here.
- **The intro card is a COVER, not a screen of its own.** The login card is
  already built and sitting underneath it — the same pattern the death and
  settings overlays use — so the card's *exit* is the crossfade rather than
  something that happens before one. Measured in real Chromium: at 2040ms the
  card is at 0.57 and the login at 0.43, at 2160ms 0.25 / 0.75. If those two
  ever stop overlapping, the crossfade has been broken back into a cut.
- **Pure typography, no image assets**, in the login screen's own language:
  Almendra Display gold for the two named lines, dim letter-spaced Barlow for
  the connective one, over the login's dark ground with the same warm radial
  behind it. Nothing here is new art — it is the logo treatment, reused.
- **Three lines, and the sentence itself is untouched**: "Hashbrown Studios" /
  "in collaboration with STG Records presents" / "RuneHaven". The line is the
  locked copy word for word; only where it wraps was a choice.
- **700ms fade+scale in (0.86 → 1), 1200ms hold, 700ms fade+scale out (1 →
  1.07)**, all on one eased `cubic-bezier(.22,.68,.28,1)` — never linear, and
  the exit deliberately mirrors the entrance rather than inventing a second
  motion. Traced frame by frame in real Chromium on a cold load.
- **BUG FOUND AND FIXED BY EYE: the login screen was briefly visible at load.**
  The transition sat on `#login` itself, so the initial hide *animated* — for
  the first few hundred ms you watched the login fade out underneath a card
  that had not faded in yet. The hide is now instant (`body.intro-hide`) and
  only the reveal is transitioned (`body.intro-exit`). Lesson, and it is the
  v9 draw-order lesson again in CSS: a transition you only want in one
  direction has to be scoped to that direction.
- **BUG FOUND AND FIXED BY EYE: the fade-in never ran at all.** The card comes
  out of `display: none`, and Chromium starts no transition from a
  display:none before-change style — so the entry class and the class that
  animates away from it collapsed into one and the card simply popped in. A
  `requestAnimationFrame` was NOT enough; it takes a synchronous layout read
  (`void introEl.offsetWidth`) to commit the entry state first. **Both of
  these looked completely correct in the harness** — jsdom has no computed
  transitions — which is exactly why they were caught in a browser and are now
  pinned by source assertions in `run4`.
- **Any keypress or click skips it, and the skip cannot fall through.** The
  card is the click target while it is up, the handler is inert once the exit
  has started, and `intro-lock` keeps the login's `pointer-events: none` until
  the card is fully gone. Proven, not assumed: `run4` clicks with a counter on
  the ENTER button, and the real-Chromium pass clicks at the exact coordinates
  of ENTER underneath — 0 triggers both times.
- **It plays every page load, deliberately.** No localStorage skip-forever,
  and `run4` asserts the intro code touches no storage at all.
- **⚠️ Nothing about the music is visible.** There is no now-playing readout,
  no audio cue in the HUD, and no visual tell that the combat track has taken
  over. That was not in the spec and is not obviously wanted, but it means the
  only feedback that the rotation is alive is the sound itself.
- **⚠️ The card is never seen by a returning player any differently.** It is
  the same 2.6s every load, skippable, with no shorter second-time variant —
  which is what "plays every time" asks for, but is the first thing to want
  changed if it starts to feel long.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, or where it explicitly asked to be
told. All verified through the full gate (420/420 in `run4`, zero FAILs, `run3`
and `run5` clean) plus a real-Chromium pass — refinements to consider, not
unfinished work.
- **The track roles are the spec's own proposal, shipped as proposed and
  flagged here because the spec asked for exactly that.** `nu_metal.mp3` is the
  combat track; `Pop` / `Slower_Jamz` / `Long_Way_Home` / `song` are the
  four-track rotation, in that order; the sixth file is held out of both. If
  any of those roles is wrong, changing it is one line in `BG_PLAYLIST` or one
  string in the loop check — nothing else in the wiring depends on which file
  is which.
- **The held-out sixth track's filename appears nowhere in `runehaven.html`,
  not even in a comment.** That is what lets its gate be a blunt "this string
  is not in the file" rather than a judgement about what counts as wiring.
- **Line 2 carries "presents"** rather than giving it a fourth line of its own.
  The spec allowed 2–3 lines; a studio line, a connective line and the title is
  the shape that fits in three without splitting the title away from it.
- **Timings 700 / 1200 / 700ms** — inside the spec's 0.6–0.8 / 1–1.5 / 0.6–0.8
  windows, and picked at the middle rather than the edges. The **250ms skip
  exit** is not in the spec at all: a skip that took the full 700ms would not
  read as "straight to the login screen", and both halves of the crossfade are
  driven off that one number so they can never drift apart.
- **`z-index: 50`, above even the settings overlay's 40.** The card covers the
  whole app while it is up, and the settings panel is unreachable underneath it
  by definition.
- **The card scales with the v23 `--ui-scale` lever** — `#introCard > *` joins
  the existing zoom rule. Same decision v23 made for the two full-viewport
  overlays: the children scale, never the overlay.
- **The music check lives at the end of `update()`**, the per-frame game logic,
  with `musicCheckAt` as a next-check timestamp ~1s out. The spec said "in the
  main game loop... throttled to roughly once a second" and gave no mechanism;
  a timestamp is the same shape as every other throttle in this file, and
  `run4` asserts a second check inside the window re-fetches nothing.
- **Three new harness hooks** — `debugIntroInfo()`, `debugMusicInfo()` and
  `debugSetMusicState()`, beside the v21/v23 ones. The intro and playlist state
  are all top-level `let`s, which never land on `window`; copies, except the
  setter, which exists so the combat gate can place a linger window without
  waiting six real seconds.
- **Two v23 `run4` assertions were updated, not relaxed.** "No imagined
  music/SFX trigger points" pinned `playMusic` at *zero* call sites, which was
  the correct v23 state and is exactly what v24 was asked to change; it is now
  pinned at two (rotation + combat switch), with SFX still pinned at zero
  because no sound-effect files have been provided. The ENTER-gesture assertion
  follows `init()` into its new `if (AudioEngine.init()) playNextBgTrack();`
  shape and additionally pins it as the only `init()` call site in the file.
- **`AudioEngine` itself was not touched**, as instructed — the rotation is a
  layer on top. The one edit inside it is a three-line comment that said
  nothing in the game calls `playMusic` on purpose, which stopped being true.

### 2026-08-12 (v23 — QOL: settings menu, accessibility, credits, favicon)
No new species, no new biomes, no change to a single world colour. v23 is
quality-of-life and infrastructure — the keybind config object, the audio
engine and the persistence layer live in the README + commit message. Below is
only what changed about how the game LOOKS.
- **The settings panel is the existing panel language, reused, not a new one.**
  Dark `--panel` card, `--panel-edge` hairline, Almendra Display gold header,
  Barlow body, the same 5px radius and blur as Inventory/Crafting/Companions.
  The only new component is the tab strip, and it is the class-card selection
  treatment (gold border + gold text on the active one) at button scale. A
  settings menu that invented its own visual language would read as a
  different program bolted onto the game.
- **The entry point is a bordered text button under the tagline**, not a bare
  gear glyph — `⚙ SETTINGS` in dim text with a `--panel-edge` border that goes
  gold on hover, which is the login card's own idiom (`#connectBox summary`).
  It sits between the tagline and the name field, in the one place on that
  card where nothing had to move to make room.
- **Text size is ONE root-level lever, `--ui-scale`.** Small 0.88 / medium 1 /
  large 1.18, applied as `zoom` to the HUD, the panels, the toast, the HP bar,
  the settings card and the CHILDREN of the two full-viewport overlays. The
  children, not the overlays themselves, so `#login` and `#deathOverlay` keep
  their own full-screen flex layout and only their contents grow.
- **`#login` gained `justify-content: safe center`.** At "large" the login card
  outgrows the viewport, and centred flex content clips at the TOP of a scroll
  container instead of scrolling to it — the logo and the name field were
  unreachable. `safe` falls back to start-alignment only in the overflow case,
  so the default screen is pixel-identical. Verified in real Chromium at
  1280x820 both before and after.
- **Colourblind mode moves the GREENS and never the reds.** Deuteranopia kills
  red-vs-green; red-vs-blue survives it, so every pure green that pairs against
  a red becomes `#4bb8e8` — the mob HP bar (against `#c84838`), the weakened
  tame ring and its name tag, the HUD HP numbers, the player HP bar fill and
  the connection dot. The reds stay exactly where they are: shifting both ends
  would have been a whole second palette to keep coherent. Canvas side is
  `tameCol()` / `tameRgb()`, CSS side is the `body.cb` rules — two halves of
  one decision, change them together.
- **The gold pet HP bar and the gold-green downed arc were deliberately left
  alone.** Neither of them reads against a red — the v16 rule is that gold
  means friendly and red means hostile, which is exactly the distinction that
  survives deuteranopia already. Recolouring them would have cost the v16
  read for nothing.
- **Reduce motion is one honest toggle over the AMBIENT spawner only** — the
  motes, fireflies, embers, snow, butterflies, bugs and the forge chimney
  smoke. Combat, death and dive particles are untouched, because those are
  feedback: a player who cannot see a hit burst cannot read the fight. One
  switch serving both low-end performance and motion sensitivity, as specced,
  and it drains the existing particles rather than snapping them off — `run4`
  pins it at zero ambient particles alive after 11 simulated seconds.
- **Credits are the panel treatment again**, a dim letter-spaced role over the
  name, and both the credits list and the Collaborations list build from data
  arrays so swapping real names in is a one-line change, never a markup edit.
- **The STG Records logo keeps its `#e8e4da` backing and 6px padding.** The
  mark is near-black line work on a near-black field; on the dark panel
  without the pale plate it renders as an empty square. Confirmed by eye in
  real Chromium — the coin reads clearly on the plate. **Do not remove it.**
- **Favicon**: the approved hashbrown mark, icon only, embedded as the
  pre-built two-size (16 + 32) `.ico` data URI. No splash, no animation —
  that is explicitly a later version once the rest of the logo set arrives.
- **⚠️ The settings panel is reachable from the login screen and nowhere
  else**, which is exactly what the spec scoped. Once you are in the world the
  gear is gone with the login card, so a player cannot rebind a key, change
  text size or mute the game mid-session. This is the single most likely thing
  to want next; the panel itself is already a fixed overlay at `z-index: 40`
  above everything, so surfacing it in-game is a hotkey and a HUD button, not
  a rebuild.
- **⚠️ Nothing in the world canvas was seen rendered this version.** The login
  screen and all five settings sections were screenshotted in real Chromium,
  but entering the world needs live Supabase creds, so the colourblind swap on
  the tame ring / mob HP bar and the text-size lever on the HUD are proven by
  assertion (`run4`, `run5`) and not by eye. Worth one screenshot next to a
  weakened creature with the toggle on.
- **⚠️ `zoom` scales padding and borders with the text, not just glyphs.** That
  is what keeps the HUD boxes proportioned instead of bursting, but it means
  "large" is really a UI scale. On a short viewport the panels are `max-height:
  70vh` scrolling already, so nothing is cut off — but a very small screen at
  "large" will have the HUD taking noticeably more of it.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, or where following its wording
literally would have shipped a half-applied feature. All verified through the
full gate (371/371 in `run4`, zero FAILs, `run3` and `run5` clean) —
refinements to consider, not unfinished work.
- **"11 keybind check sites" is 11 bindable ACTIONS across 13 lines, and all 13
  were converted.** The spec's own enumeration lists twelve checks for eleven
  actions — `interact` is checked twice, once as a single-press action and once
  as the held key that sustains the taming channel. On top of that its list
  omits the two keyup twins (`cancelTaming` on interact-up, `sendMove` on
  block-up, plus the raw `e.key === "Shift"` compare). Leaving those literal
  would have shipped a rebind that half-applies: rebind interact and the taming
  channel never cancels; rebind block and the pose never drops. Every site that
  keys off one of the 11 actions now reads `KEYBINDS`, and `run4` greps the
  source for both halves — the new lookups present, the old literals gone.
- **The arrow keys stay hardcoded as a second movement binding.** They are not
  one of the 11 actions and the spec said every other line at each site stays
  as it is, so `keys[KEYBINDS.up] || keys["arrowup"]` is the shape. Asserted, so
  a future pass does not "finish" them by accident.
- **Text size is `zoom: var(--ui-scale)`, not a root font-size.** Every size in
  the stylesheet is a px literal, so changing the root font-size moves nothing
  without rewriting each rule — which is the per-element override the spec
  explicitly ruled out. One custom property on `:root`, one rule, no duplicated
  numbers. 0.88 / 1 / 1.18 are tunables.
- **`#4bb8e8` for the colourblind green** and the matching `#2c6f96 → #4bb8e8`
  HP-bar gradient. The spec asked for a Deuteranopia-safe swap and gave no
  values; this is the existing `--runic` cyan family pulled toward blue so it
  cannot be confused with the runic tier colour it sits near.
- **Which contrasts count as "the handful".** Swapped: mob HP bar, weakened
  tame ring, weakened name tag, HUD HP numbers, player HP bar, connection dot.
  Not swapped: the gold pet bar and the gold-green downed arc (see above), and
  the biome palette, which has no red/green pair a player must tell apart.
- **Fullscreen is not re-requested on boot.** The API only works inside a user
  gesture, so a stored `true` cannot be honoured at page load without a click
  to hang it on. The stored value is what the panel last showed and the request
  itself only ever fires from the button. Flagged because "all settings persist"
  is true of the preference here, not of the state.
- **Default volumes 80 / 70 / 80 and all three unmuted.** Unspecified; music
  sits under SFX so a future track cannot drown combat feedback on first boot.
- **The HUD help line is now generated from `KEYBINDS`.** Not asked for, but it
  was a hardcoded "WASD move • SPACE attack • …" string that would have started
  lying the moment anyone rebound anything. `run4` asserts it re-renders as
  "TASD" after rebinding up to T.
- **Rebinding refuses duplicates rather than stealing the key**, with the reason
  said out loud in an inline message under the list — the spec asked for exactly
  this. ESCAPE and TAB are additionally unbindable: ESC is the capture-cancel
  key, and TAB would trap keyboard focus in the panel.
- **Credits placeholder is two `{role, name}` rows**, not three lines — "Created
  by [Your Name] and the RuneHaven development team" is one credit with one
  role, and splitting it would have made the array shape wrong for the real
  names it exists to receive.
- **`debugSettingsInfo()` and `debugAudioEngine()` — two new harness hooks**,
  beside `debugWorldInfo()` / `debugSetPlayer()`. `KEYBINDS`, `SETTINGS` and
  `particles` are all top-level `let`s, which never land on `window`, so PART
  F's gates cannot see any of them otherwise. Copies, except the deliberate
  live handle to the audio engine so its methods can actually be called.
- **`loadSettings()` resets to the defaults before reading storage**, which is
  what makes calling it a genuine reload of the subsystem — that is what the
  persistence gate leans on, and it is also correct behaviour for a key that
  was removed from storage.
- **`run4` installs a real in-memory `localStorage` for the persistence gate.**
  The shared harness header stubs it to a no-op, which cannot prove a round
  trip; the probe only replaces it if writes are not already sticking, so the
  header is untouched.
- **`run5` gained a v23 sweep** — every mob drawn weakened through both sides of
  the colourblind swap, and `updateParticles` through both sides of the
  reduce-motion gate. 660 → 718 coverage draws. Extend it whenever another
  colour or ambient effect learns a v23 twin.

### 2026-08-11 (v22 — Abyssal Hollow + Sunforge Caldera, Storm Dragon, Shadow Dragon)
Two more rare biome pockets and the last two dragons the bible lists. Nothing
here needed new art: both biomes are the proven pocket technique a fifth and
sixth time, and both dragons are one call each into the shared body that has
been sitting in the file since v18. Stats, counts and tame chances live in the
README + commit message; below is only how it all looks.
- **Abyssal Hollow** (rare DEEP variant, `B.ABYSSAL`). Palette
  `#182a36 / #162632` — the Underwater Caves' blue-grey rock taken down to
  roughly half its luminance and pulled colder still. The read is **below**
  the caves, not beside them: `#2f4a54` is a cave you have swum into,
  `#182a36` is the floor of the world. It is carved from `B.DEEP` on its own
  noise field, so the v21 dive is the only way in — **no new access logic was
  written for it at all.** That is not a shortcut, it is the point: every
  breath rule keys on `B.DEEP` specifically, so a Hollow tile is an air pocket
  exactly as a UWCAVE tile is, for free.
- **Hollow floor is the v21 cave floor made sparse.** Same three elements,
  three deliberate subtractions and nothing else: a heavier shadow pool
  (`rgba(4,10,16,0.46)` vs `0.34`), **one** fissure instead of two, and **at
  most one** bioluminescent speck behind a much higher gate (`0.86` vs `0.58`)
  instead of up to three, in a dimmer, greyer blue (`#4a96be` against the
  caves' `#8fe8f4`). Minimal bioluminescence is what the depth reads as.
  Still the **baked** speck-and-halo language, still deliberately NOT the
  drifting `mote` particle — the v18 rule that motes mark the two rare
  *surface* biomes and must not spread holds at a fifth and sixth biome.
- **A Hollow tile sits at sea-floor height (`h = -1`)**, same as UWCAVE and
  for the same reason: the plateau branch would otherwise raise the deepest
  point in the world out of the open ocean as a cliff-walled island.
- **Sunforge Caldera** (rare VOLROCK variant, `B.CALDERA`). Palette
  `#f2c884 / #eec27c` — plain volcanic rock `#5c3c3c` gone blinding. It is the
  brightest ground in the world after snow, and deliberately far more
  saturated than PEAK's `#ece7db`; the v6 PEAK→ROCK buffer already keeps snow
  42 tiles clear of the volcano, so the two can never touch and be confused.
- **The Caldera keeps the volcano cone's height.** Its carve happens *after*
  the volcano override (VOLROCK does not exist before then), and it inherits
  the cone's `h = 3 / 2` and the cone's erosion exemption. Left to fall
  through to the plateau branch it would have punched 2–3 level pits into the
  rim — the volcano silhouette is on this file's must-not-regress list, and
  the spec asked for hotter-looking VOLROCK, not a hole in the mountain.
  `run4` now hard-fails if any caldera tile drops below the cone.
- **Its cliff faces are its own hot tone**, `shade("#f2c884", 0.8 / 0.58)`,
  joining the VOLROCK and UNDERCAVE exceptions rather than wearing the cream
  `CLIFF_SW`/`CLIFF_SE`. Same v18 lesson: a biome-coloured tile with cream
  cliffs reads as a palette bug.
- **Caldera ground is the cave treatment inverted** — a *bright* inner pool
  (`rgba(255,240,206,0.30)`) instead of a dark one, two glowing crust cracks,
  and an occasional white-hot ember flake. Hard-edged flat fills only, no
  gradients; the heat comes from colour contrast.
- **The heat shimmer is the v8 lava shimmer, reused verbatim** — same
  wavering stroke, same rise cycle, own hash offsets, over a fainter and paler
  version of the lava glow. The spec said reuse a cheap one if it exists and
  skip it otherwise; it existed ten lines away. **No new particle system was
  built.**
- **Both dragons are one line of art each.** `DRAGON_PAL.storm` /
  `DRAGON_PAL.shadow` and `dragonV2()`'s `"storm"` (lightning flicker) and
  `"shadow"` (layered trail) branches were all pre-staged in v18 and have sat
  unused since, so the branches are `dragonV2(sx, sy, DRAGON_PAL.storm, t,
  "storm")` and its shadow twin, and nothing else. Ground species for the same
  reason all four dragons are — the shared body plants its claws on the
  baseline — so both inherit the walk bob, sun shadow, x+y depth sort and
  every v16 combat overlay with no special casing. `SPECIES_K` 1.30 each,
  matching their two siblings. All four call sites still pass `DRAGON_PAL.*`
  and the parameter is still named `PAL`, never `P` — re-grepped, no
  regression of the v18 collision.
- **⚠️ One of the three Storm Dragons in the test seed cannot be reached.**
  `B.PEAK` is in `BLOCKED` and always has been (Griffin has spawned there
  since v14), taming needs the player within 1.8 tiles, and the player can
  only stand on non-blocked ground. Measured over each creature's wander
  ellipse: the three sit 1.32 / 1.66 / **2.73** tiles from the closest point a
  player can occupy, so two are tameable and the third can be seen from the
  rocks below and never caught. The locked spec pins the spawn to `B.PEAK`, so
  this follows it exactly rather than second-guessing it, and it is now
  measured and printed by `run4` on every run — with a hard failure if the
  count ever reaches zero. **This is the thing most worth revisiting.** The
  fix, if one is wanted, is a walkable-adjacency filter on the spawn search,
  not a different biome — but that changes which tiles qualify and would need
  re-measuring.
- **⚠️ Nothing marks either pocket from outside it.** The Hollow is found
  exactly like the Underwater Caves — an ordinary stretch of dark sea with
  somewhere inside it — and the Caldera is a bright patch you walk into on the
  volcano's flank. Consistent with every prior pocket, but the Caldera is the
  first one that is genuinely *visible* at distance, since it is the brightest
  ground in the world sitting on a raised cone. Worth a screenshot to check it
  reads as heat rather than as snow on the volcano.
- **⚠️ Caldera tiles carry no ore.** `featureTypeAt`'s VOLROCK branch (iron at
  0.92, runic at 0.992) does not extend to `B.CALDERA`, so the carve quietly
  removes ~175 tiles' worth of chances from the volcanic band. That is the
  spec following its own explicit exclusion — dragonsteel acquisition from the
  Caldera is deferred until there is a reason to visit beyond the dragon — but
  it means the Caldera is currently scenery with no resource of its own.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent. All shipped and verified through
the full gate (324/324 in run4, zero FAILs) — refinements to consider, not
unfinished work.
- **The Abyssal Hollow wins the overlap with the Underwater Caves.** Both are
  carved from `B.DEEP` on independent fields, so some tiles satisfy both and
  the spec never says which takes precedence. The Hollow is tested first, so
  the rarer, deeper biome wins: letting the commoner one pre-empt it would
  make the Hollow rarer than its own threshold says and would chew holes in
  its pockets. Cost, measured: UWCAVE 1677 → **1619** tiles, 21 → 22 pockets,
  every one still reachable inside a single bare tank (max crossing 90 of a
  138-tile budget). Dark Forest is still exactly 763, so `run4`'s pin holds
  untouched.
- **`ABYSSAL_RARITY = 0.90` and `CALDERA_RARITY = 0.85`** — both the spec's
  proposals, kept. Measured: the Hollow is **965 tiles, 3.1% of the deep sea,
  across 13 pockets** (largest 694), against the caves' 5.2% — genuinely
  rarer, which was the stated intent. Every one of the 13 is reachable on a
  bare tank (max crossing 39). The Caldera is **175 tiles in 3 pockets**
  (largest 137) out of 1120 VOLROCK, and all 175 are walkable from spawn
  without diving — that is a `run4` assertion, not an observation.
- **The Caldera inherits VOLROCK's cone height and erosion exemption.** The
  spec says nothing about height. There were two defensible readings — the
  v18 precedent where an UNDERCAVE pocket drops to plateau height and reads as
  a recessed bowl, or keeping the cone — and the volcano silhouette being on
  the must-not-regress list settles it. Flagged because "caldera" does mean a
  crater, so a deliberate bowl is a legitimate thing to want instead; it would
  be one line, and `run4`'s pit assertion would need inverting.
- **Palette hexes for both biomes.** The spec gave directions ("near-black
  blue, minimal bioluminescence, sparse" / "near-white/orange glow") and no
  values. Picked to sit clearly apart from every neighbour: the Hollow from
  UWCAVE and deep water, the Caldera from VOLROCK, LAVA and PEAK.
- **Logging in on an `B.ABYSSAL` tile brings you back already diving.** v21
  added that guard for UWCAVE because surfacing into a ring of blocked deep
  water is a softlock; a Hollow tile is the same shape of tile, so leaving the
  guard UWCAVE-only would have shipped it with a second hole. Not new access
  logic — the existing guard, made whole.
- **`count: 3` for both dragons,** matching Fire and Water Dragon. The spec
  locked stats and tame chance but not density.
- **`debugSetPlayer()` now snaps the camera when it sets a position.** The
  camera eases toward the player at `dt*6`, so a harness that moved the player
  across the map and pumped a handful of frames was still rendering the tiles
  around SPAWN — every on-camera branch it meant to reach silently never ran.
  This is the same assignment login and respawn already make, and it is what
  lets `run5` actually execute the Caldera's animated shimmer (verified: 852
  draws, where before the change it was 0).
- **`run4`'s underwater reachability BFS now treats `B.ABYSSAL` as free to
  cross but never as a starting point.** Left alone it would have seeded the
  search from Hollow tiles as though they were dry land and reported the
  caves as far closer to shore than they are — a silently weaker test, not a
  failing one, which is the kind worth catching.

### 2026-08-10 (v21 — Underwater Caves, the dive mechanic, Water Dragon, Sea Serpent)
A fourth rare biome pocket, two new creatures, and the first time the player
can be somewhere the world previously refused to let them stand. Breath
numbers, drowning damage, the Diver's Charm recipe and both creatures' combat
stats live in the README + commit message; below is only how it all looks.
- **Underwater Caves** (rare DEEP variant, `B.UWCAVE`). Palette
  `#2f4a54 / #2c4650` — the point is that it reads as **rock that happens to
  be underwater**, not as more sea. Far greyer and darker than deep water's
  `#2c5a72`, and pulled cold/blue away from the Underground Caves' warm
  `#4a453e`, so the two cave biomes can never be mistaken for one another.
- Cave floor is the v18 cave language taken cold: a dark inner diamond
  (`rgba(8,18,26,0.34)`), two hard fissure strokes, and up to three
  **bioluminescent accents** — hard-edged blue speck (`#8fe8f4` / `#5fc4d8`)
  over a flat square halo. **That accent is the ENCHANTED FOREST UNDERGROWTH
  treatment recoloured, deliberately NOT the drifting `mote` particle kind.**
  Motes mark the two rare *surface* biomes (v17) and the v18 rule that they
  must not spread to a third stands — this is the *baked* glow language, which
  was always a separate thing. Do not merge them.
- **A cave pocket sits at sea-floor height (`h = -1`), like the water around
  it.** Without that it would fall through to the plateau-noise branch and
  rise out of the open ocean as a cliff-walled island — the exact opposite of
  the read. It also means a UWCAVE tile never draws a cliff face, which is
  correct: the caves are a hole in the sea, not a step in the land.
- **The surrounding deep water is unchanged and still blocked.** That is the
  whole composition: an ordinary-looking stretch of dark sea that you now
  discover has somewhere inside it. Nothing marks a pocket from the surface —
  found, not signposted.
- **Water Dragon is one line of art, not new art.** `dragonV2()` and
  `DRAGON_PAL.water` were both pre-staged in v18 (including the water
  variant's fin flashes and rising bubbles), so the branch is
  `dragonV2(sx, sy, DRAGON_PAL.water, t, "water")` and nothing else. A ground
  species for the same reason Fire Dragon is — the shared body plants its
  claws on the baseline — so it inherits the walk bob, sun shadow, x+y depth
  sort and every v16 combat overlay with no special casing. `SPECIES_K` 1.30,
  identical to its fire sibling. This is what pre-staging the palette bought.
- **Sea Serpent**: approved concept art ported verbatim, not redrawn — only
  the v15 port convention applied (`sx`/`sy` → `(0)`, since drawMob's chain
  runs inside the body transform, exactly as goblin/troll/bandit/wraith do).
  Two cresting coils with phase-offset wave motion, dorsal spine spikes, a
  reared neck and finned head, and its own rising bubbles. `MOB_K` **2.60** —
  by far the largest thing in the roster — with `MOB_TALL` 15, a low-profile
  body whose overlays sit above the reared head rather than the coils.
- **Diving cue: three pale bubbles rising off the local player and fading.**
  Local-player only, like every v16 combat overlay, because no other player's
  dive state is synced. It reuses the Sea Serpent's own bubble treatment (thin
  stroked ring, no fill, no gradient) rather than inventing an effect, and it
  is deliberately not a mote.
- **HUD gains a breath readout**, and only when it means something — while
  diving, or while it is still refilling afterwards. It turns red and reads
  DROWNING at zero. `F` is now in the help line.
- **⚠️ Nothing renders differently underwater.** There is no blue wash, no
  darkening, no surface line above the diver — a diving player is drawn
  exactly as a walking one, plus bubbles. That was not in the spec and adding
  it is a real rendering-architecture question (it would have to compose with
  the day/night light pass), so it was left alone. It is the most likely thing
  to want next: right now the read that you are *under* the water rather than
  on it comes entirely from the terrain and the bubbles.
- **⚠️ The Sea Serpent's `MOB_TALL` of 15 is a starting estimate.** The art is
  ~28px tall at native scale and 2.6× that drawn, so the "!" tell and the HP
  bar sit close to the head rather than clear above it. It reads, but it is
  the one number here most worth checking against a screenshot.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, or where following it literally
would have contradicted its own stated intent. All shipped and verified
through the full gate (282/282 in run4) — refinements to consider, not
unfinished work.
- **The movement gate is a DEEP-only exception, not the literal line the spec
  printed.** The spec wrote `if (me.diving || !BLOCKED.has(...))` and then, two
  sentences later, said "B.PEAK and B.LAVA stay blocked regardless of diving
  state — this is specifically a deep-water exception, not a general noclip."
  The literal line is a general noclip: it would have let a diving player walk
  onto lava. Shipped the stated intent as `diveBlocked(b)`, which is BLOCKED
  with the single `B.DEEP` exception, and `run4` now asserts peaks and lava
  stay shut while diving.
- **`UWCAVE_RARITY = 0.82`** (the spec's proposal, kept) — 1677 tiles in the
  test seed, 5.4% of the deep sea, across **21 separate pockets**, the largest
  320 tiles. Seven pockets touch shore directly and every one of the 21 is
  reachable inside a single bare 30s tank; 19 are reachable *and returnable*
  on one tank. Those are now assertions in `run4`, not observations, because
  an unreachable cave here loses more than a merely rare one elsewhere.
- **The Sea Serpent art block in the spec had a duplicated `else if (kind ===
  "sea_serpent") {` header and one extra closing brace** — a copy-paste
  artifact, not a second branch: inserted as written it is a syntax error. The
  body itself is unambiguous, so it was used once, verbatim.
- **Cave palette `#2f4a54 / #2c4650`** and the shadow/fissure/accent values.
  The spec asked for "desaturated blue-grey rock, sparse bioluminescent
  accents" and gave no hexes. Picked to sit clearly apart from both deep water
  and the warm Underground Caves.
- **The bioluminescent accent is the BAKED Enchanted-Forest undergrowth
  language, not the drifting `mote` particle.** The spec said "reuse the
  particle/glow language already established for Enchanted Forest's motes,
  shifted toward blue"; the v18 rule says motes must not spread to a third
  biome. The baked speck-and-halo satisfies both, and is what the Enchanted
  Forest floor actually uses.
- **`B.UWCAVE` forced to `h = -1`.** The spec never mentions height. Every
  other water tile is -1 and the plateau branch would otherwise raise a cave
  pocket into an island — only one reading is sensible.
- **Deep water is NOT in `SLOW`.** Diving happens at full walking speed, which
  is what the 30s-tank reachability numbers above are measured against. A
  swim-speed penalty would be a real design change and would need those
  numbers re-measured.
- **The Diver's Charm is designed content, not bible content** — the bible
  names no diving gear at all. It is an *item*, not a pet/mob/biome/location,
  so it is not the kind of thing the never-invent rule forbids, but it is
  flagged here explicitly. Its slot (`me.charm`) is a third equip slot built
  on the armor slot's exact pattern.
- **The charm's equipped state is session-local, deliberately not persisted.**
  `savePlayer()` writes a fixed column list and the players table has no
  column for it; adding one is a schema change this build has no way to
  verify. The charm itself lives in the inventory, which *is* persisted — only
  which slot it sits in resets, like starting each session surfaced and full
  of air. On death the slot is cleared without pushing a second drop, since
  the item was already dropped with the inventory (unlike the armor slot,
  which duplicates — pre-existing, left alone).
- **Surfacing on deep water is refused, not auto-pushed.** The spec offered
  either. Refusing is one branch and cannot fail; a push has to pick a
  destination tile and can. The toast says why.
- **Two related states the spec didn't cover, both fixed the obvious way:**
  respawning clears `diving` and refills breath (otherwise drowning respawns
  you flagged as diving on dry land, where breath never refills), and logging
  in *on* a UWCAVE tile brings you back already diving (otherwise you surface
  into a ring of blocked water).
- **Sea Serpent tunables:** 1.8 attack range / 1900ms cooldown / aggro 7 /
  leash 12 / move 1.5 / count 3, dropping `runic_stone ×2 @80%` and
  `iron_bar ×2 @90%`. Only HP, damage and windup were locked. Loot is existing
  materials at a generous rate because the bible's "rare aquatic loot" has no
  dedicated item and inventing one was explicitly not this version's job.
  Water Dragon's `count: 3` matches Fire Dragon's.
- **`debugSetPlayer()` — a new harness hook** beside `debugWorldInfo()`. PART F
  requires proving the dive gate end to end, and `me` is a top-level `let` that
  never lands on `window`; without a way to place the player, none of it is
  reachable. It writes only fields the game already writes every frame.
- **The bubble cue was built, though the spec marked it optional.** It is the
  only thing on screen that distinguishes diving from walking, and `run5` now
  covers both it and the real `drawPlayerEntity` branch that calls it.

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
