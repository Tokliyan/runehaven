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

## Confirmed, locked spec for the next build (v50 — Magical Biome Landmarks, Ruin Density, Ambient Life)

Direct feedback: magical biomes currently read as a ground-tile color
shift with nothing standing in them — confirmed live, `ENCHFOREST`'s
shimmer (line ~4951) is real and correctly coded but is a floor effect
only, no object. The fix is giving magic a light source and a location,
not another palette pass.

**PART A — five biome-anchored landmark objects, one per magical
biome.** Reuse the exact placement technique `golemElderSpot()` and
`unicornElderSpot()` already use — search real generated tiles of the
target biome, pick deterministically from the world seed, not a fixed
offset (unlike SHRINE, which anchors to SPAWN — these anchor to their
biome instead, since the biome itself is scattered, not fixed).

- **Enchanted Forest — the Heartwood Tree.** One per real ENCHFOREST
  pocket found (not one globally) — thick trunk, internally-lit canopy,
  slow pulse, tall enough to read from outside the pocket's edge.
- **Underwater Caves — Kelp-Crystal Clusters.** Multiple per interior,
  jutting from cave walls, faint glow, reuse the drifting-particle
  technique already used for cave ore veins rather than inventing a new
  particle system.
- **The Abyssal Hollow — a Void Rift.** Single, striking, dark
  violet-black energy effect at the deepest point already defined for
  this biome — this is the one most in need of visually justifying
  "deepest point in the world," currently indistinguishable from a
  regular dark cave.
- **Sacred Meadow — a Dawn Obelisk.** Only visibly lit during the dawn
  window — tie its lit state to the exact same time check Lightfox's own
  spawn window already uses, so the visual and the mechanic reinforce
  each other rather than being separately tuned.
- **The Sunforge Caldera — visible heat distortion and glowing ground
  cracks**, not another orange overlay — actual cracks in the terrain
  texture with an ember glow, matching the "blinding heat" bible line
  more literally than a tint does.

**PART B — ruins, genuinely more of them.** `RUIN_COUNT` confirmed live
at 6. Increase to a real, noticeably denser number — propose 10 — with
the standard six-seed sweep to confirm placement still respects every
existing separation constant (RUIN_SEP, RUIN_ZONE_SEP) rather than
starting to overlap zones or each other as density goes up.

**PART C — ambient life in magical biomes specifically.** Drifting
motes/will-o-wisps as a light, genuinely ambient particle effect — present
in Enchanted Forest, Dark Forest (night), Sacred Meadow (dawn), and the
Abyssal Hollow, absent from Plains/Forest/Meadow so the effect stays
meaningful rather than becoming wallpaper. Reuse whatever particle
technique the game already has (cave ore glow, gathering bursts) rather
than building a new particle system from scratch.

**Proof gates:** standard gauntlet plus confirm each landmark object
only renders where its real biome actually exists (not globally), confirm
the Sacred Meadow obelisk's lit state matches Lightfox's own spawn-window
check exactly, confirm ruin density increase holds every existing
separation constant across a real six-seed sweep, confirm ambient
particles are scoped only to the five named biomes/conditions and do not
appear elsewhere.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
