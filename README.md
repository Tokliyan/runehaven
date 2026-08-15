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

## Confirmed, locked spec for the next build (v25 — Crystal Golem, Krakenling, Salamander King)

v24 shipped successfully — 420/420 in run4, landed directly on main. This
section replaces the v24 entry as the current locked target. All three
species below have brand-new art, designed and syntax-verified against the
real `P()`/`R()`/`EY()`/`SCL()` toolkit before being written into this spec
— insert exactly as given, do not redraw.

**PART A — Crystal Golem (Rare pet, found young in mountain ruins).**

Bible: "Found young in mountain ruins only, adults are hostile enemies" —
same framing as regular Golem, different material. Confirmed directly:
`e < 0.86` is `B.ROCK`, `e >= 0.86` is `B.PEAK` in this game's own terms —
propose "mountain ruin" as any `RUINS[]` entry where `elevRaw(x, y) >= 0.72`
(meaningfully elevated without requiring a literal peak). Check this once
per ruin at worldgen and tag it; Golem keeps spawning at every ruin as
before, Crystal Golem spawns ONLY at tagged mountain ruins, same `B.RUINB`
tile gating both species already share.

Art — insert as a new `species === "crystal_golem"` branch, adjacent to
the existing golem branch:

```js
else if (species === "crystal_golem") {

    P(ctx, [sx - 4.4, sy, sx - 4.4, sy - 8.4, sx + 4.4, sy - 8.4, sx + 4.4, sy], "#9fc4e8");     // body
    P(ctx, [sx + 1.4, sy - 8.4, sx + 4.4, sy - 8.4, sx + 4.4, sy, sx + 1.4, sy], "#5a7fb0");
    P(ctx, [sx - 4.4, sy - 8.4, sx - 1.6, sy - 9.8, sx + 4.4, sy - 8.4], "#d4e8f8");             // top facet
    P(ctx, [sx - 2.6, sy - 8.6, sx - 2.6, sy - 12.6, sx + 2.6, sy - 12.6, sx + 2.6, sy - 8.6], "#b8d4ec"); // head
    P(ctx, [sx + 0.6, sy - 12.6, sx + 2.6, sy - 12.6, sx + 2.6, sy - 8.6, sx + 0.6, sy - 8.6], "#7a9fc8");
    ctx.fillStyle = "#e8a8f8";
    ctx.fillRect(sx - 1.6, sy - 11.4, 1.4, 1.4);                                               // crystal core glow
    ctx.fillStyle = "rgba(232,168,248,0.3)"; ctx.fillRect(sx - 2.6, sy - 12.2, 3.4, 3.4);
    P(ctx, [sx - 6.6, sy - 7.4, sx - 4.4, sy - 7.4, sx - 4.4, sy - 2.4, sx - 6.6, sy - 2.4], "#8fb4dc"); // arms
    P(ctx, [sx + 4.4, sy - 7.4, sx + 6.6, sy - 7.4, sx + 6.6, sy - 2.4, sx + 4.4, sy - 2.4], "#5a7fb0");
    ctx.strokeStyle = "#d4e8f8"; ctx.lineWidth = 0.6;                                          // facet lines
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 6.6); ctx.lineTo(sx - 1.4, sy - 4.6); ctx.lineTo(sx - 2.4, sy - 2.4); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy - 6.4); ctx.lineTo(sx + 3.4, sy - 4.4); ctx.stroke();
    P(ctx, [sx - 3.6, sy - 7.8, sx - 2.2, sy - 7.8, sx - 2.8, sy - 5.6], "rgba(255,255,255,0.35)"); // shine facet
    P(ctx, [sx + 4.4, sy - 8.4, sx + 3, sy - 8.4, sx + 4.4, sy - 7], "#7a9fc8");                // chipped corner

}
```

Stats, locked from the original v16 table: 70 HP / 9 dmg / 2.2s cooldown /
PvP-capable. Tame base chance: 0.25, matching Golem's. Add
`crystal_golem: 1.15` to `SPECIES_K` (slightly smaller than regular Golem's
existing entry, reads as a "younger/rarer variant" — confirm against
Golem's actual current value and stay close to it, don't invent a wildly
different scale). Mount status: NOT on the bible's mountable list — Golem
line isn't rideable, don't add riding code.

**PART B — Krakenling (Epic pet, Abyssal Hollow, cyclical spawn window).**

Bible: "disappears after 10 day cycles and returns to lay another egg,
giving a one day window every 10 days to capture it." Confirmed directly:
`dayNum` is already computed from `worldEpoch`/`DAY_LENGTH` at the HUD
display site — reuse the identical formula in the spawn-gating logic, do
not add a second day-counter:

```js
const dayNum = Math.floor((Date.now() / 1000 - worldEpoch) / DAY_LENGTH) + 1;
const krakenlingWindowOpen = (dayNum % 10) === 0;
```

Only allow a Krakenling presence-roll (same pattern as Shadowfox/Unicorn's
existing presence-roll gating) when `krakenlingWindowOpen` is true. Spawn
location: `B.ABYSSAL` tiles. When the window is closed, Krakenling simply
never rolls present — no despawn logic needed for existing tamed ones,
this gate only affects new wild spawns appearing.

Art — insert as a new `kind === "krakenling"` branch (wild-pet species
branch, alongside the other wild species checks):

```js
else if (kind === "krakenling") {

    P(ctx, [sx - 5, sy - 6, sx - 4, sy - 11, sx + 4, sy - 11, sx + 5, sy - 6, sx + 2, sy - 3, sx - 2, sy - 3], "#5a3a6e"); // mantle
    P(ctx, [sx - 4, sy - 11, sx + 4, sy - 11, sx + 3, sy - 9, sx - 3, sy - 9], "#7a5a92");      // mantle highlight
    EY(ctx, sx - 1.8, sy - 8, 1.1, "#f0e8ff", "#1a0f28");
    EY(ctx, sx + 1.8, sy - 8, 1.1, "#f0e8ff", "#1a0f28");
    for (let i = 0; i < 5; i++) {
      const tx = sx - 4 + i * 2, tang = Math.sin(t / 300 + i * 0.8) * 2;
      P(ctx, [tx, sy - 3, tx + tang, sy + 2, tx + 0.8 + tang, sy + 2, tx + 0.8, sy - 3], "#4a2a5e");
    }
    for (let i = 0; i < 3; i++) {
      const ph = (t / 700 + i * 0.33) % 1;
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(ph * Math.PI);
      ctx.fillStyle = "#c8a8f8";
      ctx.beginPath(); ctx.arc(sx - 3 + i * 3, sy - 7, 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

}
```

Stats, locked from the original table: 60 HP / 12 dmg / 1.8s cooldown /
PvP-capable. Tame base chance: 0.20, matching Lightfox/Shadowfox's Epic
baseline. Add `krakenling: 1.10` to `SPECIES_K` (small, "-ling" reads as
young). Mount status: not on the bible's list, don't add riding code.

**PART C — Salamander King (Epic pet, Sunforge Caldera, real feeding
system — the one genuinely new mechanic this version).**

Bible: "must be fed and kept happy or it will rampage and return to the
caldera." Nothing like this exists yet — designed here in full, not left
to be invented at build time.

New per-pet state on the tamed Salamander King specifically (not other
species): `lastFedAt` (timestamp, set to tame-time on capture). Happiness
is computed on demand, not ticked every frame:
```js
function salamanderHappiness(pet) {
  const hoursSinceFed = (Date.now() - pet.lastFedAt) / 3600000;
  return Math.max(0, 100 - hoursSinceFed * 100 / 8);   // reaches 0 at 8 hours unfed
}
```
8 hours to fully starve — long enough that a normal play session never
brushes it by accident, short enough to be a real commitment across
multiple sessions. Flagged as tunable.

Feeding: reuse `rare_herb` — confirmed genuinely unused since v17, this is
its first real purpose. Add a "Feed" interaction to the companion panel
when Salamander King is the active companion and the player holds at least
one `rare_herb`: consuming it sets `lastFedAt = Date.now()` (happiness back
to 100).

Below 30 happiness: a visible warning cue on the companion panel (reuse
the existing weakened/low-HP visual language, don't invent new UI chrome).
At 0 happiness: the pet rampages — remove it from the player's tamed
roster, spawn it back as a hostile mob at the Sunforge Caldera (reuse the
existing mob-spawn pattern, not a new one), and give it one brief aggro
tick on the player who neglected it before it resumes normal hostile-mob
behavior — matches "rampage and return to the caldera" literally rather
than just silently vanishing.

Art — insert as a new `species === "salamander_king"` branch:

```js
else if (species === "salamander_king") {

    P(ctx, [sx - 8, sy, sx - 6, sy - 4, sx + 4, sy - 4.4, sx + 7, sy], "#d84a28");              // body
    P(ctx, [sx - 6, sy - 4, sx + 4, sy - 4.4, sx + 2, sy - 2, sx - 4, sy - 1.8], "#f07038");    // body highlight
    P(ctx, [sx + 4, sy - 4.4, sx + 10, sy - 5.4, sx + 11, sy - 1.4, sx + 7, sy], "#c8401e");    // head
    P(ctx, [sx + 10, sy - 5.4, sx + 11, sy - 1.4, sx + 9, sy - 1.6], "#8c2c14");
    for (let i = 0; i < 3; i++) {                                                              // crown ridge
      P(ctx, [sx + 5.4 + i * 1.4, sy - 5, sx + 6 + i * 1.4, sy - 7.4, sx + 6.6 + i * 1.4, sy - 5], "#f4c020");
    }
    EY(ctx, sx + 9, sy - 3.6, 1, "#ffe8a0", "#2a0e04");
    ctx.fillStyle = "#f4c020";                                                                 // belly glow marks
    ctx.fillRect(sx - 5, sy - 2.2, 1.6, 1); ctx.fillRect(sx - 1.6, sy - 1.8, 1.6, 1);
    ctx.fillStyle = "#1c0e08";                                                                 // legs
    ctx.fillRect(sx - 5.6, sy - 1.6, 1.6, 1.6); ctx.fillRect(sx + 1, sy - 2, 1.6, 1.6);
    ctx.strokeStyle = "#ffb050"; ctx.lineWidth = 0.7;                                           // heat shimmer
    ctx.beginPath(); ctx.moveTo(sx - 2, sy - 5); ctx.lineTo(sx - 1, sy - 7); ctx.stroke();

}
```

Stats, locked from the original table: 75 HP / 13 dmg / 1.8s cooldown /
PvP-capable. Tame base chance: 0.20. Add `salamander_king: 1.20` to
`SPECIES_K`. Spawn location: `B.CALDERA` tiles. Mount status: not on the
bible's list, don't add riding code.

**PART D — proof gates, standard gauntlet plus:**
- Confirm at least one of the 6 `RUINS[]` entries actually qualifies as a
  "mountain ruin" (`elevRaw >= 0.72`) in the test seed — if none do,
  Crystal Golem is unreachable and the threshold needs lowering, don't
  ship an unreachable species.
- Confirm Crystal Golem only spawns at tagged mountain ruins, never at the
  others, in the test seed.
- Confirm Krakenling's presence-roll genuinely gates on `dayNum % 10`,
  tested across a simulated range of day values, not just the current one.
- Confirm the full feeding cycle: happiness starts at 100 on tame, drops
  correctly with simulated elapsed time, feeding resets it, and 0
  happiness genuinely triggers the rampage-and-respawn path end to end.
- Confirm all three new art branches render without error.
- Extend `run5.js` coverage for all three new species.

**Explicitly not touched this version:** mounting, Blood Moon, Meteor
Shower (still v26 — Arc C's actual close), Dungeons, bases.

**After v25 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
