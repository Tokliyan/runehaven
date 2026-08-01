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
Enchanted fst #4c6a63 / #496760   (v17 — rare Forest variant)
Sacred meadow #cbbf72 / #c8bc6f   (v17 — rare Meadow variant)
```

Flat-face shading formula: side faces are the top colour darkened by a multiplier (~0.72 for the "SW-facing" face catching less light, ~0.55 for the "SE-facing" face in full shadow). Keep this ratio consistent across ALL objects (terrain, trees, rocks, buildings) so the whole world reads under one consistent light source.

## Known visual problems flagged by the user (running list — check new builds against this before shipping)

Dated entries, most recent first. When a build fixes one, mark it FIXED but don't delete it — it's a regression check for the future.

### 2026-08-01 (v17 — Enchanted Forest, Sacred Meadow, 3 new pets)
Two rarer-variant biomes and three new species. Combat numbers, tame chances
and spawn gating live in the README's v17 spec + the commit message; the
rendering scope is below.
- **Enchanted Forest** (rare Forest variant): the palette is deliberately
  *desaturated* — cool grey-green ground (#4c6a63) and a muted canopy
  (#5f7d72 / #4d6961 / #3b544e, pale violet-grey trunks) — so the
  **bioluminescent undergrowth** is the brightest thing on the tile. The
  undergrowth is flat pale-cyan clusters (#8ff0d2 / #c8fbe8) with a soft
  halo, painted into the terrain bake; no gradients, the glow reads as
  shape. If this biome ever looks like plain Forest with sparkles, the
  canopy desaturation has been lost — that is the bug.
- **Sacred Meadow** (rare Meadow variant): warm golden grass (#cbbf72) with
  amber tuft strokes, a **soft dawn light-shaft** quad on ~38% of tiles
  (low alpha, no hard edge — a hard-edged shaft would reintroduce the v4
  "flashlight cone" complaint), and sparse golden blooms.
- **Drifting motes** — a new `mote` particle kind, deliberately the same
  magic-effect language as the runic/tier motes (soft glow core + hard
  pixel, gentle pulse), NOT the firefly treatment. Enchanted Forest motes
  drift day and night; Sacred Meadow's are warm dawn dust, daytime only.
- **Two new gatherable nodes**, each with its own silhouette so neither can
  be mistaken for a rock node (the 2026-07-07 "every node looks the same"
  lesson): **rare_herb** = fanned green blade cluster with a pale flower
  head, gentle sway; **magic_essence** = a faceted violet shard floating and
  bobbing above a dark stone cradle. Both flat-faceted, no outlines.
- **Stag / Unicorn / Lightfox**: approved concept art inserted verbatim via
  the v15 P/R/EY helpers — not redrawn or reinterpreted. Sizes in
  `SPECIES_K` are the reference-sheet ratios: Stag 1.15, Unicorn 1.30,
  Lightfox 1.05. The Lightfox carries its own radial glow and a rising
  ember-mote trail in all states (same idea as the Phoenix's persistent
  trail); the Unicorn's horn gets ribbed gold strokes and a four-band mane.
- These three are **passive-tame**, so they use the v14 pale-green pulsing
  tame ring and never the mob wind-up "!" tell. As with pets generally, an
  amber "!" over any of them is a bug.
- No mounting/riding art — deferred, and nothing was built toward it.

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
