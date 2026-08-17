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

## Confirmed, locked spec for the next build (v29 — real cave interiors, Underwater Caves as the proof of concept)

v28 (mounting) shipped successfully. This section replaces it as the
current locked target. This is a genuinely large, foundational system —
scoped deliberately to ONE biome first. Abyssal Hollow gets the same
system reused, not redesigned, once this is proven. This also lays real
groundwork for Dungeons later, which need the identical "enter, arrive
somewhere separate" pattern — do not build anything here that is specific
to water and cannot be reused.

**Confirmed directly before writing this spec:** one shared Supabase
channel handles all sync (`channel.send({ type: "broadcast", event:
"move", ...})`), payload currently has these short-named fields: `u, x, y,
c, l, h, m, t, d, wk, at, pe`. Breath already stops draining the instant
`here === B.UWCAVE` (confirmed: drain condition is specifically `here ===
B.DEEP`, so any non-DEEP tile including UWCAVE already halts it) — this is
the exact existing moment to hook the space-transition into, not a new
detection. `wilds.push({ id: sp + ":" + tx + "," + ty, species: sp, x: tx
+ 0.5, y: ty + 0.5, ph })` is the real spawn call for every wild species
including `water_dragon`, currently placed directly on the main grid.

**PART A — the space system itself.**

New player state: `me.space` (string, default `"main"`). Add one field to
the move broadcast payload: `sp: me.space`. On the receiving end
(`channel.on("broadcast", { event: "move" }, ...)`), only render/collide
with another player if `p.sp === me.space` — this is the entire
multiplayer mechanism. No new channel, no new sync system.

**PART B — entry trigger, reusing the exact existing moment.**

The instant a diving player's current tile biome becomes `B.UWCAVE`
(exactly where breath already stops draining today), instead of just
continuing to stand on that tile: identify which connected UWCAVE cluster
they touched (flood-fill from that tile, same technique already used to
verify pocket counts in past worldgen sanity checks), take that cluster's
lowest-`(tx,ty)` tile as its anchor point, and transition `me.space` to
`"cave:uwcave:" + anchorX + "," + anchorY`. Store the player's surface
position and the anchor before transitioning, so exit can restore both.

**PART C — the interior itself, reusing the main world's own generation
technique at a smaller scale.**

A 26x26 tile interior grid, generated on first entry from a seed derived
from the cluster's anchor point plus `worldSeed` (deterministic — every
player who ever enters that same physical cave gets the identical
interior, every time, with nothing stored server-side). Reuse
`valueNoise()` and the same cave-tone palette already established for
`B.UWCAVE`'s surface rendering — real rock walls forming tunnels and
chambers, not open water. One tile marked as the exit point, placed near
the generated entrance corner.

While `me.space !== "main"`: redirect the tile-lookup and camera-following
that currently point at the main world's grid to this interior grid
instead. `cam.x = me.x; cam.y = me.y;` — same tracking, same code, just
operating on interior-local coordinates. Breath does not drain at all
while inside (already true structurally, since interior tiles are never
`B.DEEP`).

**PART D — the creatures move in, they do not duplicate.**

Remove `water_dragon` and `sea_serpent` from the main-grid `wilds.push()`
spawn path for `B.UWCAVE` tiles entirely — they no longer spawn on the
surface. Instead, spawn both inside the generated interior the first time
it is created, using their existing stats and art completely unchanged.
This is a move, not new content.

**PART E — the resource this biome was always supposed to have.**

New gatherable item, `aquatic_essence` (the bible's own words: "rare
aquatic resources"), placed as real nodes inside the interior alongside
the creatures — 3 to 5 per interior, propose reusing the existing
gather-node interaction pattern. No new crafting recipe this version — the
resource existing and being gatherable is the whole scope here.

**PART F — exit.**

Walking onto the interior's marked exit tile: transition `me.space` back
to `"main"`, restore the player's stored surface position (the same
`(tx,ty)` where they originally touched the `B.UWCAVE` tile, or the
nearest non-blocked tile if that spot is somehow occupied).

**PART G — proof gates, standard gauntlet plus:**
- Confirm two simulated players entering the SAME cluster's anchor point
  both land in `me.space` values that match each other exactly.
- Confirm a simulated player in `"main"` and one in a cave `space` do NOT
  render or collide with each other.
- Confirm the interior is generated deterministically — entering the same
  cluster twice produces identical interior tiles both times.
- Confirm Water Dragon and Sea Serpent no longer spawn via the main-grid
  `wilds` path for any `B.UWCAVE` tile.
- Confirm both species DO spawn inside a freshly-generated interior.
- Confirm `aquatic_essence` nodes exist and are gatherable inside.
- Confirm exiting restores the exact stored surface position.
- Confirm breath does not drain at any point while `me.space !== "main"`.

**Explicitly not touched this version:** Abyssal Hollow (same system
reused later). Blood Moon, Meteor Shower. Dungeons themselves — this
version builds the pattern they will need, not Dungeons. Mounting — this
version does not include mounting, that ships separately.

**After v29 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.

---

## DRAFT — staged for review only, NOT the active build target (v30 — Elder Drake, ruin variety, idle-wander, real gathering + Pickaxe)

**This is not what `NEXT_BUILD.md` points at.** v29 (cave interiors) remains
the active locked spec above. This section becomes real only once
explicitly confirmed, and only after v29 is verified actually built —
not assumed. v28 (mounting) is confirmed live already, checked directly.

Four pieces, each touching a genuinely different part of the game — worth
knowing before green-lighting this as one version rather than several.

**PART A — Elder Drake: art (verified), stats, and the phased fight.**

Art already designed and syntax-verified against the real toolkit before
being written here — insert exactly as given:

```js
else if (species === "elder_drake") {

    const stride = Math.sin(t / 260) * 1.4;
    P(ctx, [sx - 14, sy - 1, sx - 11, sy - 9, sx + 9, sy - 10, sx + 15, sy - 2, sx + 10, sy + 2, sx - 8, sy + 2.5], "#2a2622"); // body
    P(ctx, [sx - 11, sy - 9, sx + 9, sy - 10, sx + 6, sy - 5.5, sx - 8, sy - 5], "#403a34");   // back highlight
    for (let i = 0; i < 7; i++) {                                                            // full-spine spike ridge
      const rx = sx - 10 + i * 3.6, ry = sy - 9.4 + Math.sin(i * 0.5) * 1.2;
      P(ctx, [rx - 1, ry, rx + 1, ry, rx, ry - 3.4 - (i % 3)], "#17140f");
    }
    ctx.fillStyle = "#c8501e";                                                                // ember cracks
    for (let i = 0; i < 5; i++) {
      const cx = sx - 8 + i * 4.4, cy = sy - 4 + Math.sin(i * 1.7) * 2;
      ctx.fillRect(cx, cy, 1.6, 0.6); ctx.fillRect(cx + 0.4, cy + 0.8, 0.6, 1.2);
    }
    P(ctx, [sx - 14, sy - 1, sx - 20, sy - 3.4, sx - 21, sy + 0.6, sx - 15, sy + 1.6], "#221f1b"); // head/jaw
    P(ctx, [sx - 20, sy - 3.4, sx - 21, sy + 0.6, sx - 24, sy + 0.4, sx - 22.4, sy - 3.8], "#17140f"); // lower jaw
    ctx.fillStyle = "#f4f0e0";                                                                 // teeth
    for (let i = 0; i < 4; i++) ctx.fillRect(sx - 21.4 - i * 0.9, sy - 2.2 + i * 0.7, 0.7, 1.4);
    P(ctx, [sx - 19, sy - 3.6, sx - 17.6, sy - 7.2, sx - 16.4, sy - 3.4], "#0d0b09");           // single low horn
    EY(ctx, sx - 18, sy - 2, 1.3, "#ff9838", "#1a0e04");
    P(ctx, [sx - 8, sy + 2.5, sx - 6.6, sy + 6.4, sx - 4.6, sy + 6.2, sx - 5.8, sy + 2.2], "#221f1b"); // front leg
    P(ctx, [sx + 6, sy + 1.4, sx + 7.2, sy + 6, sx + 9.2, sy + 5.8, sx + 8.4, sy + 1.2], "#17140f");   // back leg
    ctx.fillStyle = "#0d0b09";                                                                 // claws
    P(ctx, [sx - 7, sy + 6.4, sx - 6.2, sy + 8, sx - 5, sy + 6.6], "#0d0b09");
    P(ctx, [sx + 7.6, sy + 6, sx + 8.6, sy + 7.6, sx + 9.8, sy + 6.2], "#0d0b09");
    P(ctx, [sx + 15, sy - 2, sx + 24 + stride, sy - 4 + stride * 0.6, sx + 23 + stride, sy - 0.4], "#2a2622"); // tail
    P(ctx, [sx + 24 + stride, sy - 4 + stride * 0.6, sx + 30 + stride, sy - 3 + stride * 0.5, sx + 28 + stride, sy], "#221f1b");
    for (let i = 0; i < 3; i++) {
      const tx2 = sx + 24 + stride + i * 2.6, ty2 = sy - 3.4 + stride * 0.5;
      P(ctx, [tx2 - 0.6, ty2, tx2 + 0.6, ty2, tx2, ty2 - 2], "#17140f");
    }

}

```

Add to `MOBS`: `elder_drake: { name: "Elder Drake", hp: 900, dmg: 28,
atkRange: 3.5, atkCooldownMs: 1400, windupMs: 900, aggroRadius: 14,
leashRadius: 24, moveSpeed: 1.6, count: 1, tameable: false, loot: [{
type: "dragonsteel", qty: 1, chance: 1.0 }] }` — confirmed the single
largest HP/dmg pair in the game on purpose, `count: 1` because it's a
named world boss, not a spawned population.

Placement: fixed near `VOLCANO` (confirmed live at `TOWER + 75` on a
locked angle) — spawn within the existing `VOLROCK`/`LAVA` band around it,
reusing that terrain check rather than a new biome gate.

Phases, keyed to HP percentage, each reusing an existing v27 combat
pattern rather than inventing a new one:
- **100–60%**: standard attacks.
- **60–30%**: tail-sweep — hit everything in a cone in front of the Drake,
  reusing Spear's exact line/cone-hit logic from v27, just at a wider
  angle (propose 50 degrees) and the Drake's own `dmg`.
- **Below 30%**: fire-breath — reuse Staff's splash-on-impact pattern from
  v27 as a cone-shaped area attack instead of a point splash.

Respawn: `ELDER_DRAKE_RESPAWN_MS` — propose 6 real hours, not the standard
`MOB_RESPAWN_MS` used for regular mobs. A world boss that respawns like a
Goblin isn't a world boss.

**PART B — the two new ruin layouts, verified, wired to real deterministic
selection.**

```js
function buildRuinCluster(center, template) {
  const R = center;

  if (template === 1) {
    // "Collapsed Tower" — dense, circular, total-collapse composition
    const fallenAngles = [0, 0.9, 1.8, 2.7, 3.6, 4.5];
    fallenAngles.forEach((a, i) => {
      ruinPieces.push({ k: "fallen", x: R.x + Math.cos(a) * 1.6, y: R.y + Math.sin(a) * 1.6 });
    });
    ruinPieces.push({ k: "col", x: R.x + 0.3, y: R.y - 0.4, hp: 34 }); // one surviving fragment, off-center
    ruinPieces.push({ k: "rubble", x: R.x - 2.2, y: R.y + 0.6 });
    ruinPieces.push({ k: "rubble", x: R.x + 2.0, y: R.y - 1.4 });
    ruinPieces.push({ k: "rubble", x: R.x - 0.6, y: R.y + 2.4 });
    ruinPieces.push({ k: "entrance", x: R.x + 2.6, y: R.y + 0.2 });
  } else if (template === 2) {
    // "Sunken Courtyard" — open, sparse, boundary-only
    ruinPieces.push({ k: "well", x: R.x, y: R.y });
    ruinPieces.push({ k: "wallX", x: R.x - 2.8, y: R.y - 2.4, hp: 10 + hash2(0, 3, worldSeed) * 12 });
    ruinPieces.push({ k: "wallX", x: R.x + 1.6, y: R.y - 2.4, hp: 10 + hash2(1, 3, worldSeed) * 12 });
    ruinPieces.push({ k: "wallY", x: R.x - 3.0, y: R.y - 1.0, hp: 15 });
    ruinPieces.push({ k: "wallY", x: R.x + 2.8, y: R.y - 0.6, hp: 15 });
    ruinPieces.push({ k: "rubble", x: R.x - 1.2, y: R.y + 1.8 });
    ruinPieces.push({ k: "rubble", x: R.x + 1.4, y: R.y + 2.0 });
    ruinPieces.push({ k: "col", x: R.x - 2.6, y: R.y + 2.2, hp: 18 });
    ruinPieces.push({ k: "entrance", x: R.x - 0.6, y: R.y - 2.4 });
  } else {
    // template 0 — the original "broken wall + archway" layout, unchanged
    const wallSegs = [[-2.4, -2.2], [-1.4, -2.2], [-0.4, -2.2], [1.6, -2.2], [2.6, -2.2]];
    wallSegs.forEach(([ox, oy], i) => {
      ruinPieces.push({ k: "wallX", x: R.x + ox, y: R.y + oy, hp: 13 + hash2(i, 3, worldSeed) * 15 });
    });
    ruinPieces.push({ k: "wallX", x: R.x - 2.3, y: R.y + 2.0, hp: 25 });
    ruinPieces.push({ k: "wallY", x: R.x - 2.7, y: R.y + 1.4, hp: 21 });
    ruinPieces.push({ k: "col", x: R.x + 2.4, y: R.y + 0.4, hp: 28 });
    ruinPieces.push({ k: "col", x: R.x + 2.4, y: R.y + 1.6, hp: 28 });
    ruinPieces.push({ k: "lintelY", x: R.x + 2.4, y: R.y + 1.0, z: 28 });
    ruinPieces.push({ k: "fallen", x: R.x - 0.3, y: R.y + 0.9 });
    ruinPieces.push({ k: "rubble", x: R.x + 0.9, y: R.y - 0.8 });
    ruinPieces.push({ k: "rubble", x: R.x - 1.4, y: R.y - 0.4 });
    ruinPieces.push({ k: "col", x: R.x + 0.2, y: R.y + 2.3, hp: 12 });
    ruinPieces.push({ k: "well", x: R.x - 0.6, y: R.y + 0.1 });
    ruinPieces.push({ k: "entrance", x: R.x + 0.6, y: R.y - 2.2 });
  }
}

```

At each `RUINS[]` entry's placement time, pick its template via
`Math.floor(hash2(anchorX, anchorY, worldSeed + 77) * 3)` — deterministic,
so the same ruin always gets the same layout for every player, every
session. Confirmed the existing `buildRuinCluster(center)` call site is
the only place this needs to change — pass the resolved template index
through to the function shown above.

**PART C — idle-wander, genuinely expanded, not the current 0.8-tile
shuffle.**

Confirmed current code: `m.hx + Math.cos(t / 8000 + m.ph) * 0.8 - m.x` —
a fixed, tiny amplitude for every mob regardless of size or territory.
Replace with a real patrol scaled to each mob's own `leashRadius` (already
exists per-species, no new stat): propose amplitude =
`Math.min(leashRadius * 0.4, 4)`, with a genuine pause-then-move cycle
(propose 3-5s paused, 2-4s moving, randomized per mob via `m.ph` so they
don't all switch in sync) rather than continuous drift. This is a
numbers-and-timing change to an existing function, not new architecture.

**PART D — real gathering: durability, channeled collection, Pickaxe.**

Confirmed current gathering is instant, one `E` press, zero tool check,
zero durability of any kind — the entire redesign below replaces that.

Each gatherable feature gets HP (propose trees: 30, ore nodes: 50 —
ore harder than wood, matching intuition and the bible's own material-tier
framing). Gathering becomes a hold-`E` channel, reusing the exact
mechanical shape the taming channel already uses (progress state, cancels
on release/move/distance) rather than a new interaction paradigm — each
channel tick deals damage to the node's HP equal to the equipped weapon's
existing `dmg` stat (no new "mining damage" number — a Dragonsteel axe is
already stronger than an Iron one via a stat that already exists).
Completing the channel (HP reaches 0) awards the resource exactly as
before.

**Pickaxe — confirmed this does not exist anywhere in the bible's
crafting tables.** Add it as new content, Iron and Runic tiers (matching
what's fully modeled currently — Dragonsteel tier smelting requires The
Ancient Forge, which doesn't exist as a built landmark yet, so Dragonsteel
Pickaxe is deferred until that does):
```js
{ out: "iron_pickaxe",  mats: { iron_bar: 3, wood: 2 },        where: "forge", label: "Forge Iron Pickaxe" },
{ out: "runic_pickaxe", mats: { runic_stone: 2, iron_bar: 2 }, where: "forge", label: "Forge Runic Pickaxe" },
```
Add `if (id.includes("pickaxe")) return "pickaxe";` to `weaponKind()`,
BEFORE the axe check (confirmed current fallback for unmatched IDs is
`"sword"`, which would silently misclassify pickaxes if this isn't placed
correctly). Restrict ORE gathering specifically to axe or pickaxe equipped
— wood gathering stays axe-only, matching genre convention that a pickaxe
doesn't chop trees.

**PART E — proof gates, standard gauntlet plus:**
- Confirm Elder Drake spawns near `VOLCANO`, has exactly one instance, and
  each phase's attack pattern fires at the correct HP threshold in a
  simulated fight.
- Confirm all three ruin templates render without error and that template
  selection is deterministic across repeated calls with the same anchor.
- Confirm idle-wander amplitude genuinely differs between a small-leash
  and large-leash mob, and that the pause/move cycle is real, not
  continuous drift.
- Confirm a tree/ore node's HP actually depletes per channel tick scaled
  by equipped weapon damage, and that a Dragonsteel-tier tool completes
  gathering in fewer ticks than an Iron one.
- Confirm Pickaxe crafts at both tiers, `weaponKind()` correctly returns
  `"pickaxe"` and not `"sword"`, and ore gathering is blocked without an
  axe or pickaxe equipped.

**Explicitly not touched this version:** the guild system (moved to pair
with admin tooling). Blood Moon, Meteor Shower. Bases. Dragonsteel
Pickaxe (needs The Ancient Forge, not built yet).

**After v30 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
