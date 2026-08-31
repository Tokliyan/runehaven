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

## Confirmed, locked spec for the next build (v51 — Ambience Fix, Minimap Texture, Density Rebalance & Guilds)

**PART A — the wisp effect, made genuinely visible.** Confirmed live: it
fires at a 0.32 chance per qualifying tile, and by its own documented
design it fires INSTEAD of the existing mote/firefly chain for
Enchanted Forest specifically — meaning that biome got nothing NEW from
v50, only Dark Forest (night), Sacred Meadow (dawn), and the Abyssal
Hollow did. Fix: raise the fire chance to something clearly noticeable
(propose 0.55) across all four conditions, and give Enchanted Forest its
own additive wisp layer instead of the mutually-exclusive fallback — the
existing motes and the new wisps should both be present there, not one
replacing the other.

**PART B — minimap gets real texture, not flat color blocks.** Confirmed
live: `updateMinimap()`'s tile loop does a single `fillRect` per tile
from a two-color checkerboard palette, nothing else. Add a light texture
pass on top — small darker flecks for tiles with trees, a small grey
fleck for rock/mountain tiles, reusing whatever per-tile feature data
`buildFeatureList()`'s chunking already tracks rather than re-scanning
biomes from scratch. Keep it subtle at this cell size (4px) — a mark,
not a redraw of the whole tile.

**PART C — overworld density, up across pets, ruins, and mobs together.**
Ruins already went 6→10 in v50. Increase overworld MOBS.count values
(Goblin/Bandit currently 9, Troll currently 6, and the rest of the
non-cave roster) by roughly the same proportion applied to pets in v49
(tier-scaled, not flat) — measure the real current spread before
picking multipliers, the same discipline every prior density pass used.
Pet counts (WILD_SPECIES) get a further increase on top of v49's fix,
specifically for overworld-biome species — this is on top of, not
instead of, what already shipped.

**PART D — CORRECTED: caves inverted using the real interior-specific
lever, not the surface `count` field PART C already raises.** Confirmed
live: `MOBS.troll.count`/`MOBS.dark_wraith.count` govern SURFACE spawns
only (mountain/peak and dark-forest respectively) — reducing them here
would undo PART C's own increase to the same field, and would change
nothing inside caves regardless, since cave-interior Trolls/Wraiths are
placed separately by `populateInterior()`'s own
`Math.round(2 * areaK)` multiplier (line ~3684), untouched by `count`.
Lower THAT multiplier specifically — propose `1.2 * areaK`, down from
`2 * areaK` — leaving every surface count from PART C fully intact.

For the pet side of the inversion: Golem and Crystal Golem are
confirmed bible-restricted to "ruins only" / "mountain ruins only" —
placing either inside a cave interior would be a direct bible
contradiction, not a tunable, and is dropped from this version
entirely. The real, bible-compliant lever instead: Glow Moth is
explicitly "caves and dungeons" per the bible and currently only
spawns in the surface `UNDERCAVE` band, never inside actual interiors —
add it to cave-interior generation for real, at a count proportional to
interior floor area the same way ore/node density already scales.
Additionally, the cave-hatchling dragon `populateInterior()` already
places (currently exactly one per cave) becomes the other real anchor
for "a place to find companions" — do not change its species or
placement logic, only confirm it remains exactly as it is so PART D's
"more companions" goal has two real, bible-compliant answers (Glow Moth
plus the existing dragon) rather than a contradiction.

**PART E — CORRECTED: this was never actually locked at thirteen.**
The prior version's "thirteen guilds" prose was left over from an
earlier idea in conversation — it was explicitly narrowed to **five**
plus a separate, admin-only sixth, and that narrowing was never
correctly carried into this document before now, which is what caused
the truncation the build correctly caught. This is the actual, current
design:

**Five real guilds**, assigned deterministically from a hash of the
username at account creation — never chosen, never re-rollable, no
in-game way to know the assignment in advance. At an initial player
base of roughly 50, five guilds gives roughly ten members each, a real
felt group size — thirteen would have averaged under four and felt
empty. Each is a genuine, felt mechanical advantage, not a stat-sheet
footnote:

1. **The Hollow Choir** — mourners, death-touched. *"We sang before you were born, we'll sing after."* Instant respawn — 0 second wait.
2. **The Drowned Court** — water and secrets. *"What sinks, we keep."* Breath capacity +50% while diving.
3. **The Quiet Vein** — earth and stone. *"Deep enough, everything is treasure."* Ore and stone gathering yields +1 extra per action.
4. **The Gilded Bough** — enchanted forest, growth and luck. *"Every root remembers."* Real, felt bump to rare-pet tame-chance specifically (not spawn density).
5. **The Bramblewatch** — dark forest, thorn and warning. *"We do not chase. We wait."* +20% damage to any mob that attacked first (not the initiator).

**The Nameless Tide is a separate, sixth, admin-only guild — not part
of the random assignment pool at all.** No hash outcome can ever
produce it; it is granted the exact same way admin itself is, by
editing that player's row directly in Supabase. Effect when granted:
small passive HP regen at all times, plus a smaller, permanent version
of the Beastmaster Shrine's own taming boost without needing to stand
at the Shrine. There is no "rarer roll" language for it anymore — it
simply is not rollable, which is a cleaner design than the prior
"rare but possible" framing and was the direction already agreed.

Each guild's name and motto render beside the player's existing name
display, reusing that exact mechanism — do not invent a second one.

**PART F — combat-logout window shortened, 30s -> 15s.** Confirmed live:
`COMBAT_LOGOUT_MS = 30000`. Change to `15000`. Same mechanism, same
honest limit already documented (a native browser prompt, not a true
block) — just a shorter, sharper danger window if someone is actively
chasing you when you try to leave.

**PART G — guild badges, richer but still nameplate-scale.** These
render directly beside a player's existing name, the same tiny space
their username already occupies — not a character-panel portrait. Each
badge needs genuine, distinct silhouette and color at roughly 14-18px,
readable at a glance, not a detailed illustration that only reads at
mockup size. Iterate past the five-icon concept already shown (bell,
wave, ore vein, leaf, thorned fist) toward slightly more distinctive
per-guild shapes while keeping every one legible that small — test each
at the actual render size before calling a shape final, not just at
preview scale. The Nameless Tide needs its own sixth badge too, even
though it is never randomly assigned — an admin-granted guild still
needs a real visual when someone actually has it.

**PART H — ruins, much more, and a real "30-second rule" pass.**
Confirmed live: `RUIN_COUNT = 10`, already up from 6 in v50. Increase
significantly further — propose 20, roughly double again — with the
same six-seed separation-constant sweep every prior ruin change has
required, since density this much higher is far more likely to start
crowding RUIN_SEP/RUIN_ZONE_SEP than the last, smaller jump was.

Beyond ruins specifically: apply a real "should a player see something
worth noticing within about 30 seconds of walking in any direction"
standard to the overworld generally, not just ruins. This means
checking real average spacing — between ruins, between resource nodes,
between wild pet spawns — against a rough distance a player covers
walking in 30 seconds at normal speed, and where the gap is
meaningfully larger than that, increasing density until it isn't. This
is a real, measured check against actual movement speed and actual
placement spacing, not a vibe — report the real numbers found and the
real numbers after, the same discipline as every density change this
project has made.

**PART I — landmark fast travel opened to everyone, no Unicorn Elder
required.** This is the explicit bible deviation already discussed and
approved directly: the bible ties fast travel exclusively to the
Unicorn Elder, and the direct instruction now is to remove that
requirement entirely for the Places tab, matching what already happened
for the Players tab. Remove the `ownsUnicornElder()` gate everywhere it
still applies to landmark travel specifically (distinct from anything
already correctly gated elsewhere) — every player should see every
landmark's TRAVEL button enabled, with no ownership check anywhere in
the execution path, the same standard already applied and verified for
player-to-player travel.

**PART J — item-giving, already live, real key conflict flagged rather
than silently overwritten.** Confirmed live: giving an item to a nearby
player already exists, bound to `E` (same key as gather/interact,
`openGivePanel()` at line ~8818) — this already works today. The
request to bind this to `Q` cannot be done as asked: `Q` is already
`KEYBINDS.ability` (class ability), confirmed live, and rebinding it
would silently break every class's core ability with no warning. Bind
giving to a genuinely free key instead — propose `G`, unused in the
current keybind list — as an additional direct shortcut alongside the
existing `E` proximity trigger, not a replacement for it.

**PART K — the Fast Travel Players tab auto-refreshes every 10
seconds.** Currently confirmed to populate once when the panel opens.
Add a `setInterval` tied to the panel's own open/close state — refresh
the online-player list every 10 seconds while the panel is visible,
stop the interval the moment it closes so it never runs in the
background. This directly solves "someone just came online but I can't
travel to them without reopening the panel."

**Proof gates:** standard gauntlet plus confirm the wisp fire-chance
increase and Enchanted Forest's additive layer, confirm minimap texture
flecks only appear where real feature data says they should, confirm
overworld density increases hold tier-proportionality the same way
v49's pet fix did, confirm cave Troll/Dark Wraith counts genuinely drop
while cave-biome pet counts genuinely rise, confirm guild assignment is
deterministic (same username always yields the same guild) and that
the Nameless Tide's real assignment rate is meaningfully rarer than the
other twelve, not just described as such.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
