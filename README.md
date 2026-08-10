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

## Confirmed, locked spec for the next build (v22 — Abyssal Hollow + Sunforge Caldera, Storm Dragon, Shadow Dragon)

v21 shipped successfully — 282/282 in run4, landed directly on main.
This section replaces the v21 entry as the current locked target.

This version is deliberately scoped to species and biomes that reuse
already-built art and already-proven techniques. Crystal Golem, Krakenling,
and Salamander King need genuinely new art and (for Salamander King) a new
mechanic — they're v23, not this version.

**Confirmed directly before writing this spec:** `DRAGON_PAL.storm` and
`DRAGON_PAL.shadow` already exist in the live file, pre-staged since v18,
unused until now. `dragonV2()` already handles the `"storm"` and
`"shadow"` variant branches (lightning flicker, layered shadow trail) —
confirmed present in the shared function, not something to add.

**PART A — two new biome pockets, same proven technique as every one
before them (Enchanted Forest, Sacred Meadow, Underground Caves,
Underwater Caves).**

**Abyssal Hollow** — bible: "Deepest point in world, Shadow Dragon
territory." Carve from `B.DEEP` tiles specifically (own independent noise
field, own seed offset — do not reuse `UWCAVE_RARITY`'s field), propose
`ABYSSAL_RARITY = 0.90` (deliberately rarer than Underwater Caves — this is
meant to feel like the genuine bottom of the map, not just "more ocean").
New enum value `B.ABYSSAL`. Do NOT add to `BLOCKED` — same as every prior
pocket, this alone makes it walkable once reached. Since it's carved from
`B.DEEP`, reaching it requires the existing v21 dive mechanic — no new
access logic needed, this is a direct, deliberate reuse. Visual: darker and
colder than Underwater Caves — near-black blue, minimal bioluminescence,
sparse.

**Sunforge Caldera** — bible: "Beyond the volcano, blinding heat, rare
dragonsteel." Carve from `B.VOLROCK` tiles (own independent noise field),
propose `CALDERA_RARITY = 0.85`. New enum value `B.CALDERA`. Not in
`BLOCKED` — walkable, reached on foot like any land pocket, no dive
mechanic involved (this is the volcanic side, not the ocean). Visual:
brighter and hotter than plain `VOLROCK` — near-white/orange glow,
heat-shimmer particle if a cheap one already exists in the render code,
skip it if not (do not build a new particle system for this alone).

Standard worldgen sanity check for both: confirm at least one tile of each
new biome exists in the test seed.

**PART B — Storm Dragon (Rare pet, tame as hatchling).**

Bible: "Mountaintop storms, tame as hatchling." Spawn location: `B.PEAK`
tiles. Add `species === "storm_dragon"` to `drawSpecies`, calling
`dragonV2(sx, sy, DRAGON_PAL.storm, t, "storm")` — the entire art
requirement. Stats, already locked from the v16 table: 55 HP / 12 dmg /
1.6s cooldown / PvP-capable. Tame base chance: 0.25, matching Fire/Water
Dragon. Add `storm_dragon: 1.30` to `SPECIES_K`. Mount status: on the
bible's mountable list, DEFERRED same as every dragon so far.

**PART C — Shadow Dragon (Rare pet, tame as hatchling).**

Bible: "Dark dungeons, tame as hatchling" AND, separately, "The Abyssal
Hollow... Shadow Dragon territory." Dungeons don't exist yet — spawn in
`B.ABYSSAL` this version (bible-supported, and this version's own new
biome), defer the Dark Dungeons spawn location until Dungeons ship (same
precedent as Dark Wraith's second location in v18). Add
`species === "shadow_dragon"` calling
`dragonV2(sx, sy, DRAGON_PAL.shadow, t, "shadow")`. Same stats as Storm
Dragon: 55/12/1.6s/PvP-capable, tame base 0.25. Add
`shadow_dragon: 1.30` to `SPECIES_K`. Same deferred mount status.

**PART D — proof gates, standard gauntlet plus:**
- Worldgen sanity: confirm `B.ABYSSAL` and `B.CALDERA` tiles both exist in
  the test seed.
- Confirm Storm Dragon spawns on `B.PEAK`, Shadow Dragon on `B.ABYSSAL`,
  in the test seed.
- Confirm both dragons render without error and both use `dragonV2()`
  correctly (no repeat of the `P`/`PAL` parameter collision from before —
  that's long fixed, but worth a quick grep to be sure nothing regressed).
- Extend `run5.js` coverage for both new species and both new biome tiles.

**Explicitly not touched this version:** Crystal Golem, Krakenling,
Salamander King (v23 — new art and, for Salamander King, a new feeding
mechanic, deserve their own dedicated pass). Dungeons themselves and Shadow
Dragon's second spawn location. Mounting. Dragonsteel acquisition from
Sunforge Caldera specifically (the biome exists this version; the "rare
dragonsteel" resource-drop detail can be added once there's an actual
reason to visit beyond the dragon, e.g. alongside Dungeons/dragonsteel
crafting).

**After v22 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
