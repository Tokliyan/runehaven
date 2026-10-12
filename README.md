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

0. **ECC is not usable in this build environment — confirmed twice, do
   not keep re-attempting installation.** First attempt: the plugin
   registration in `.claude/settings.json` alone does not install
   anything — `~/.claude/plugins/installed_plugins.json` came back empty.
   Second attempt: the actual install command was then explicitly refused
   by this environment's own permission layer, not a network failure.
   That is a real, structural restriction on this environment, not a
   transient issue a future build will succeed at by trying again. Do not
   spend any part of a build attempting to install or invoke ECC. If
   Anthropic or the project owner changes what this environment permits,
   this step should be rewritten then — until it is, treat ECC as a tool
   only usable from a manually-started Claude Code cloud session, never
   from this automated pipeline.

0b. **Doubt pass + gate integrity (required, every build).** Skills live in
   `.claude/skills/` as plain Markdown (vendored from
   addyosmani/agent-skills, MIT; no plugin install is involved, so Step 0's
   restriction does not apply). Before committing:
   - Read `.claude/skills/doubt-driven-development/SKILL.md` and apply it to
     the build's riskiest non-trivial change (new branching logic, anything
     touching saves, combat, or Supabase). Spawn a fresh-context reviewer if
     the environment allows; give it only the diff and the spec text, not
     your reasoning. This run is non-interactive, so cross-model review is
     skipped. Write "Cross-model skipped: non-interactive context." and never
     invoke an external CLI. If a fresh reviewer can't be spawned, do the
     degraded self-review the skill describes and label it DEGRADED.
   - Read `.claude/skills/gate-integrity/SKILL.md` and run its checks.
   - Put both results in the changelog entry (findings classified as
     actionable / trade-off / noise, plus the gate-integrity line). An
     actionable finding that is not fixed is RED.
   These skills are advice for the build; they never override the spec, the
   bible, or Step 3-5.

0c. **Supabase work.** For any build touching Supabase (tables, RLS,
   policies, redeem codes, PINs, saves, presence), read
   `.claude/skills/supabase/SKILL.md` and, for SQL, the relevant files in
   `.claude/skills/supabase-postgres-best-practices/references/` (security-*
   first). The automated environment has no Supabase MCP, CLI or login and
   must not try to get one: skip those parts and do not ask for tokens. NEVER
   run SQL against the live project. Instead write the SQL to a file named
   `supabase_<version>.sql` at the repo root for the owner to run. Note that
   RuneHaven uses its own username/PIN login with the public anon key, not
   Supabase Auth, so `auth.uid()` policies do not apply as-is. Do not
   rewrite auth in a normal build: record security findings in the changelog
   under "Security notes" and leave the fix to a dedicated spec. The service_role
   key must never appear in any file.

0d. **Look at it (visual check, not a gate).** After the gates in step 4 pass,
   run `node debug/shot.js shots` (Playwright + Chromium, stubbed Supabase,
   fully offline; it tours the six landmarks, six biomes and both cave
   interiors). Use `Read` on the screenshots for whatever area this build
   touched, plus `10-landmark-the-volcano.png`, and describe what you actually
   see in the changelog under "Visual check" (one line per shot: what is
   there, anything that looks wrong). If Playwright or Chromium is not
   available in this environment, write "visual check skipped: <reason>" and
   continue; never try to install them. Do not commit the `shots/` folder. A
   shot that looks wrong is a YELLOW note, not a reason to skip shipping,
   unless the spec's own acceptance line is about that look.

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

## Confirmed, locked spec for the next build (v52+53 combined — Session Resume, Colosseum Rework & Guild Tier 2)

Two versions combined into one run, per direct request — neither had
built yet, so this replaces both as a single spec rather than running
sequentially.

**PART A — session resume gets a real, visible pause.** Confirmed live:
`resumeSession()` fills the name field and then directly calls `await
enterBtn.onclick()` with zero pause — a returning player has no chance
to change settings, pick a different class, or decide not to resume at
all before they're already in the world. Add a brief, visible
"Welcome back — entering in a moment" state with a real, clickable
cancel that stops the auto-enter and returns control to the normal
login screen, fully filled in as it already is today. Propose a
1.5-2 second window before auto-submitting, long enough to read and
react, short enough that it still feels like the seamless resume it
was built to be for anyone who does nothing.

**PART B — the Ruined Colosseum, reworked into a real structured
duel.** Confirmed live: currently just `COLOSSEUM_R = 9`, an open PvP
ring with no structure — the bible's own "open player duels" framing,
built literally rather than ceremonially. Rebuild as:

- **Visually much larger and more fantastical** — this is meant to be a
  real landmark people travel to, not a PvP flag on the ground. Reuse
  the flat-shaded, no-gradient house style, but scale it up
  significantly from its current footprint and give it real presence —
  broken columns, a genuine arena bowl shape, something that reads as a
  destination from a distance the way the Eternal Tower already does.
- **Two named podiums**, fixed positions inside the ring. A duel only
  becomes possible when two different players are each standing on a
  podium at the same time — not simply "both inside the ring" as PvP
  currently works elsewhere.
- **A real confirmation step before the fight starts** — both players
  must explicitly confirm (a prompt each of them accepts) before combat
  actually becomes live between them; standing on a podium alone must
  never itself deal damage or force a fight neither player agreed to.
- **A real reward on winning** — the victor receives Runic Stone,
  amount left as a build judgment call but should feel like a
  meaningful, not trivial, reward for a genuine 1v1 someone chose to
  enter.
- **Everywhere else inside the ring keeps its existing behavior** — the
  current "both players inside the ring" PvP-enabled rule stays exactly
  as it is for anyone not using the podiums; this is an addition, not a
  replacement.

## PART C onward — Guild Tier 2, Grantable

**Scope, deliberately narrowed:** this version builds Tier 2 as an
admin/redeem-code-granted upgrade, not an earn-through-play milestone
system — that's a real, separate, bigger feature (per-guild progress
tracking) worth its own future spec if wanted later. This version is
specifically what was asked: a way to grant a stronger guild buff
through Supabase or a code, confirmed against the real, current buff
implementations before writing new numbers.

**PART C — a real `guild_tier` column, defaulting to 1.**
```sql
alter table players add column guild_tier integer default 1;
```
Degrades gracefully exactly like every other optional column this
project has ever added — a missing column or a null value must always
read as tier 1, never throw, never block login.

**PART D — five real Tier 2 upgrades, each confirmed against the live
Tier 1 value it replaces, not guessed:**

- **Hollow Choir** (confirmed live: `RESPAWN_SECONDS * 1000` bypassed entirely at Tier 1 — instant respawn already). Tier 2 adds combat-logout immunity: the native leave-warning prompt from `COMBAT_LOGOUT_MS` never fires for this guild at Tier 2, on top of the existing instant respawn.
- **The Drowned Court** (confirmed live: `GUILD_BREATH_MULT`). Tier 2 raises this constant meaningfully — propose roughly 1.5x the Tier 1 value.
- **The Quiet Vein** (confirmed live: `GUILD_VEIN_BONUS`, a flat add per gather). Tier 2 doubles this flat bonus.
- **The Gilded Bough** (confirmed live: `GUILD_BOUGH_TAME`, added to tame chance for capped species). Tier 2 roughly doubles this bonus.
- **The Bramblewatch** (confirmed live: a first-strike damage bonus). Tier 2 raises the percentage meaningfully — propose roughly 1.75x the Tier 1 bonus.

Every `guildIs("...")` call site that reads one of these constants must
be updated to check `myGuildTier() >= 2` and apply the upgraded value
instead — a single new helper function, not five different inline
patterns.

**PART E — grantable via Supabase directly.** Setting a player's
`guild_tier` to `2` in the `players` table takes effect on next login,
the same pattern as `role` and `guild` already use — no new mechanism
invented, this reuses the exact precedent.

**PART F — grantable via redeem code.** Confirmed live:
`normalizeRedeemItems()` and the redeem flow already parse a JSON
`items` object per code. Extend the accepted shape with one new
optional key, `_guildTier` — when present in a code's `items` JSON, in
addition to any real items also in that code, redeeming it sets the
player's `guild_tier` to the given value if it is higher than their
current one (a redeem should never be able to LOWER someone's tier).
No new table needed — this is one new recognized key in the existing
`redeem_codes.items` JSON shape.

**PART G — the Elder Drake gets a real boss-fight sequence, not a
reskinned mob encounter.** Confirmed live: fighting it uses the exact
same generic combat HUD as any regular mob — no dedicated boss health
bar, no special encounter framing. The tension music trigger already
works correctly and stays as-is. Add a real boss health bar overlay
(name + a large, visible HP bar, screen-anchored, not the small
floating text every other mob uses) that appears specifically while in
combat with `elder_drake` and disappears when the fight ends. This is
the one thing genuinely missing between "a big mob with a boss-tier
stat block" and "a boss fight."

**PART H — reduce gathering-node density.** Confirmed by direct report:
after the recent density passes (v47, v49, v51), ore/resource nodes now
read as visually cluttered rather than plentiful. Find the real, live
constant governing ground-feature density (the build has full file
search, locate it directly rather than guess at a name) and reduce it —
propose roughly 30-40% down from its current value — with a real
before/after tile count, the same discipline as every prior density
change, not a blind number swap.

**PART I — hitbox investigation, genuinely not diagnosed yet, reported
directly rather than guessed at.** Direct report: combat hit
registration feels off. Investigated two plausible causes directly and
ruled both out: standard melee hit-detection is purely radius-based
(`tryAttack()`, ~line 7861) and does not use facing direction at all,
so the WASD movement-rotation fix could not have affected it; ranged/
click-aimed attacks use `screenToWorld(e.clientX, e.clientY)`,
independent real screen math unrelated to keyboard movement. Neither
obvious candidate explains the report. Do not guess further blind —
investigate empirically: test hit registration at various ranges,
movement states (moving vs stationary, mounted vs not), and weapon
types, and report exactly what is actually wrong before proposing a
fix, the same rigor as any other genuinely undiagnosed report this
project has handled.

**Proof gates:** standard gauntlet plus confirm a fresh account with no
`guild_tier` set reads as tier 1 with no error, confirm each of the
five Tier 2 values is genuinely stronger than its Tier 1 counterpart
and only active at tier 2, confirm a redeem code carrying `_guildTier`
correctly raises but never lowers a player's stored tier, confirm
setting `guild_tier` directly in Supabase and relogging correctly
applies the upgraded buff.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.

---

## QUEUED FOR AFTER v52+53 — do not build this until the spec above ships.
## Confirmed, locked spec for the version after next (Spawn Ambience & Empty-Biome Visual Pass)

**PART A — real ambience concentrated at spawn specifically, not just
scattered globally.** New players spend their first real minutes inside
the Spawn Safe Zone — that's the one place a genuine "wow" moment
matters most and currently has none beyond standard biome color. Add a
real visual anchor at the safe zone itself: propose a soft, ambient
particle effect (motes/light, reusing the existing wisp technique from
v50/v51 rather than inventing a new one) concentrated specifically
within `SAFE_RADIUS`, distinct in density or color from anywhere else
in the world, so the very first thing a player sees reads as
unmistakably magical.

**PART B — Plains gets real landmark-scale visual variety, not just
ground color.** Confirmed live: Plains has real mob/pet density
(Goblin, Bandit, Boar, Wind Sprite, all genuine counts) but zero
decorative world features — only a flat two-color ground palette
(`[B.PLAINS]: ["#8fb562", "#8cb25f"]`). This is why it reads as visually
barren despite being mechanically populated. Add scattered, sparse
decorative features to Plains specifically — standing stones, small
rock formations, wildflower patches — reusing the same feature-
placement technique other biomes' decorations already use. Keep density
low and scattered, not a redesign of the biome's open character (Plains
is deliberately open for PvP per the bible) — this is visual interest
added to open space, not a removal of the openness itself.

**PART C — "shift up the map," needs one clarifying detail before this
can be built.** This instruction is not specific enough to act on
safely — it could mean repositioning a landmark, adjusting the overall
map's vertical/visual framing, or something else entirely. Do not guess
and implement a random interpretation; this part is a placeholder until
a real clarification is given, and should be dropped from the build
entirely if no clarification arrives before this version starts.

**PART D — hit-detection fixes, both real findings from the prior
version's diagnosis, not guessed at.**

1. **Spear and lance ignore this on purpose (25° facing cone) while
   every other melee weapon is pure distance — this asymmetry is the
   bug, not the cone itself.** Facing only updates on movement or
   click-aim, so a stationary player who hasn't recently moved/aimed
   can have spear/lance attacks miss a target directly in front of
   them. Fix: refresh `facing` from the aim/target direction at the
   moment of the swing itself for spear/lance specifically (the same
   way ranged weapons already compute aim direction fresh every shot),
   so the cone is always centered on where the swing is actually aimed,
   not stale movement history.
2. **Add real body radius to hit checks**, sized per-creature rather
   than a single global constant — reuse each creature's existing
   `MOB_TALL`/`SPECIES_K` scale value the render code already has,
   converted to a hit radius, so a full-sized Elder Drake or Sea
   Serpent doesn't have several tiles of its own painted body that are
   simply unhittable. Small creatures keep an effectively small radius,
   this is not a flat buff to every hitbox.

**PART E — the Volcano gets the same real ambient treatment the
Caldera already has, confirmed live it currently has none.** The
Caldera's glowing-crack technique (`ctx.strokeStyle =
"rgba(255,232,150,0.7)"`) exists and works — reuse it directly for
Volcano-adjacent `VOLROCK`/`LAVA` tiles rather than inventing a new
effect, so the actual Volcano (home to the Elder Drake, the Ancient
Forge, and the world's most central landmark cluster) doesn't read as
visually flatter than a smaller, more remote biome next to it.

**Proof gates:** standard gauntlet plus confirm the spawn ambience
effect is genuinely concentrated within SAFE_RADIUS and distinct from
the general wisp effect elsewhere, confirm Plains decorative features
are sparse and do not block movement or combat sightlines (defeating
the biome's own PvP-openness purpose), confirm Part C either has a real
clarification to build from or is explicitly dropped, not guessed at.


---

## QUEUED, AFTER EVERYTHING ELSE ALREADY QUEUED — do not build until prior specs ship.
## Confirmed, locked spec for a future version (The Lighting & Atmosphere Pass)

**Read this whole section before touching anything — it is written as
one continuous player session, in order, because that is the actual
point of it: every touch here is judged by what a real person sees in
the moment they see it, not as an isolated feature.** No new rendering
technology, no gradients, no texture files — this is explicitly a
harder push on the exact technique already proven in the wisp system
and the Volcano's glowing cracks: layered flat, semi-transparent shapes
doing the work gradients would normally do. Every part reuses a real,
existing primitive — `nightAlpha()`, `burst()`, `aura()`, the wisp
particle stream — not a new system per part.

**PART A — the moment of first login.** A new player's very first
frame is the Spawn Safe Zone. Right now it is biome-colored ground and
nothing else. Add a soft, warm ambient glow using the same layered-
transparency technique as the mockup already shown — a large, low-
opacity radial suggestion of light (built from concentric flat circles,
not a CSS gradient) centered on the zone, plus a slightly denser wisp
stream than anywhere else in the world specifically inside
`SAFE_RADIUS`. This is a player's first five seconds; it should not
look identical to open plains a thousand tiles away.

**PART B — real time-of-day lighting, not just a night/day biome tint.**
Confirmed live: `nightAlpha(dayT)` already exists and drives whether
wisps fire. Extend its use to a genuine directional-light illusion: at
dawn and dusk specifically, add a warm, low-opacity wash from one
screen edge using the same layered-shape technique, and at full night,
darken non-lit tiles slightly more than they currently are while
letting anything already emissive (lava, wisps, Dragonsteel's aura, a
base's own torches if any exist) read as brighter by contrast — light
feels real when there is real darkness around it, not from the light
itself being stronger.

**PART C — every creature gets a rim-light pass, not just new ones.**
Confirmed live: creature bodies are drawn with flat `P()`/poly-style
fills and no light-direction cue at all. Add one shared helper — a
thin, brighter-toned outline traced along the upper-left edge of a
creature's main body shape, reusing its own existing palette (a
lightened version of its base fill, not a new color) — and call it from
every creature's draw function already using the shared body-shape
functions, so this is one helper touching many call sites, not dozens
of one-off edits. This is the single highest-leverage change in the
whole spec: every single creature in the game gets a free depth boost
from one function.

**PART D — combat gets real light, not just a flash.** Confirmed live:
`burst()` already exists and is the shared particle-spawn function
every hit effect already calls. A weapon connecting should scatter a
handful of dim embers along the direction of the swing rather than only
a hit-flash; a staff's spell impact should leave a faint, fading glow
circle at the impact point for a beat after the particles disperse
(reuse `aura()`, shortened lifetime, not a new draw call). The Elder
Drake's new boss bar moment deserves the same treatment on a bigger
scale — a brief, dramatic light pulse across the whole visible area the
instant the fight actually starts, not just the bar appearing.

**PART E — taming, the one moment the game currently under-sells.**
Successfully taming something is one of the biggest emotional beats in
the whole game and currently gets the same generic feedback as any
other action. Add a real, brief burst of the creature's own palette
color radiating outward the instant a tame succeeds (reuse `burst()`
with the target's own colors, not a generic white flash) — this should
feel different taming a Tree Sprite than a Fire Dragon, because the
colors are different, at zero new system cost.

**PART F — caves, where darkness should mean something.** Confirmed
these are currently lit evenly regardless of distance from an actual
light source. Ore veins and the new Kelp-Crystal clusters already glow
— extend that glow to genuinely light the floor tiles immediately
around them (a soft, layered-circle falloff, same technique as
everywhere else in this spec) so a cave reads as dark BETWEEN light
sources, not uniformly lit with some glowing decorations scattered in
it. This is what will make a torch, a crystal, or lava actually feel
like they are casting light rather than just being bright objects.

**PART G — a player's own base, seen from a distance, especially at
night.** A base currently has no way to read as "someone lives here"
from outside interaction range. Add a small, warm light source
rendered at any base with a Forge or Generator piece, visible from a
real distance at night specifically — this turns "I found a base" into
a genuine discovery moment from far away, not just something you walk
directly into.

**PART H — fast travel and the Elders each deserve their own signature
effect, not a shared generic one.** A teleport currently should feel
different depending on how it happened — landmark travel, player travel,
and (if built) each Elder's own presence should each carry a distinct,
reused-but-recolored version of the same burst/aura primitives, so a
Unicorn Elder's travel effect reads as unmistakably different from a
plain landmark jump, without inventing three separate systems.

**PART I — the world-ending event, if it is ever near, must look like
it.** This is the rarest, most legendary moment this game can produce,
and currently has zero unique visual buildup. If the Golem Elder and
Dragon Elder ever enter proximity combat, the screen for anyone nearby
should carry an unmistakable, escalating visual signature — reuse the
Blood Moon's existing red-tint technique but pushed further, plus a
dense wisp storm — building for the full duration of the trigger
window, so that if this ever actually happens, everyone watching knows
immediately that something enormous is happening, before any patch
notes or forum post could ever tell them.

**Proof gates:** standard gauntlet plus confirm every part reuses a
named existing primitive rather than introducing a parallel system,
confirm PART C's rim-light helper is called from every creature sharing
the body-shape functions (a real grep count of call sites, not a
sample), confirm nothing in this spec adds an actual CSS/canvas
gradient anywhere (the house style's no-gradient rule stays intact
throughout), confirm frame cost stays within the existing per-frame
particle budget rather than silently regressing performance the same
way the feature-list eager-load issue once did.


---

## Confirmed, locked spec for the next build (Dungeons & the Basilisk)

The last real bible system that doesn't exist yet, and the only thing
blocking Basilisk (Deep Dungeons, dangerous, fight to tame). Scoped
deliberately to one real, solid dungeon type rather than several at
once — every other major system this project has built (caves, bases,
guilds) shipped as one working version first, expanded later. Confirmed
live: `RUINS` is a real, populated array (the bible's own entry point —
"Ruins... dungeon entrances"), `demon_knight` already has real stats
(`hp:280, dmg:26`) and a dragonsteel drop, `enterInterior()` is the
proven, reusable space-transition technique cave interiors already use.

**PART A — a dungeon entrance at a real subset of Ruins.** Not every
Ruin becomes a dungeon — propose roughly 1 in 4 of the real, placed
`RUINS` entries deterministically (seeded, so it's consistent across
sessions, not re-rolled). A visibly distinct entrance marker
distinguishes a dungeon Ruin from an ordinary one before the player
commits to entering, reusing the existing Ruin art with a real, added
detail rather than a whole new structure.

**PART B — the dungeon interior, reusing the cave technique exactly.**
Same underlying pattern as `enterInterior()`/cave generation — its own
grid, its own space, flood-fill connectivity guaranteed the same way
caves already prove it. Visually and structurally distinct from a cave
(stone corridors and worked architecture, not natural rock), matching
the bible's own framing of Dungeons as separate from Underground Caves.

**PART C — Demon Knights live here too, not exclusively at the
Volcano.** The existing Volcano placement (guarding the Elder Drake)
stays exactly as it is — this adds dungeon interiors as a second, real
place they exist, matching the bible's actual "Deep dungeons" placement
that the Volcano exception always described as deliberate, not
exclusive.

**PART D — Basilisk, built for real.** Confirmed absent from the game
entirely. Bible: "Deep dungeons, dangerous, fight to tame," Rare tier.
New `WILD_SPECIES` entry, tameable via the same fight-to-tame pattern
Bear/Boar/Griffin already use, placed only inside dungeon interiors —
this is the one creature in the entire pet roster with nowhere to exist
until this version ships. New art, following the locked style guide.

**PART E — a real locked-vault reward, not just loot on the floor.**
Each dungeon has one vault room at its deepest point, locked until the
player defeats that dungeon's own Demon Knight and takes a key it
drops specifically on death — guarantees a real fight happens before
the reward, not a dash past every threat straight to the prize. Vault
contents: guaranteed dragonsteel, matching the bible's own dragonsteel
acquisition list, which already includes "Killing a Demon Knight in a
dungeon" as a real, named source that currently has nowhere to happen.

**Proof gates:** standard gauntlet plus confirm dungeon connectivity
holds with zero sealed-off tiles across a real multi-seed sample,
confirm Basilisk spawns only inside dungeon interiors and nowhere else,
confirm a vault cannot be opened without the real key drop from that
specific dungeon's Demon Knight, confirm the Volcano's own Demon
Knights are completely unaffected by this version.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.

---

## QUEUED, AFTER DUNGEONS — do not build until the spec above ships.
## Confirmed, locked spec for the version after next (UI Consistency & Onboarding Pass)

**Confirmed live: 13 distinct top-level HUD/panel elements exist,
added incrementally across 55+ versions.** Real panels (inventory,
craft, build, character, travel, chest, give) genuinely share one
`.panel` class and are already consistent with each other. This spec
targets what hasn't been verified: the HUD elements outside that shared
class, and one specific, confirmed, real problem.

**PART A — the keybind bar has grown into an unreadable single line and
will keep growing forever as-is.** Confirmed live: `#hudHelp` currently
lists 14 separate keybinds in one unbroken string, and every new
mechanic this project has shipped has simply appended another entry —
this does not scale and reads as worse with every future feature. Fix:
show only the handful of core, always-relevant keys by default (move,
attack, gather, inventory — 4-5 entries), with the full current list
moved behind a small, unobtrusive toggle (a `[?]` icon or similar) that
expands the complete reference on demand. This is a real UX fix, not a
cosmetic one — a 14-entry text wall is measurably harder to actually
read than a short list plus an opt-in expansion.

**PART B — a real consistency audit across every non-panel HUD
element**, not assumed clean. Check the compass dial, minimap, player
status box, boss bar, and every toast/notification style against one
shared set of values — border-radius, padding, backdrop blur, font
weight, the `--panel`/`--panel-edge` color variables the real panels
already use consistently. Where an element was built independently and
drifted from these values (very plausible given how incrementally this
UI has grown), bring it in line. Report the actual specific
inconsistencies found, not just "checked, found none" — this is a real
audit, the same rigor as every code-correctness pass this project has
done, applied to visual consistency instead.

**PART C — the very first login should not show everything at once.**
Confirmed: compass, minimap, and the full status box all render
immediately on a brand new account, before Tutorial Grounds even
finishes. Hold the compass and minimap hidden until the tutorial
completes (or is skipped) — a new player's very first screen should
teach movement and combat, not compete with two separate navigational
UI elements they don't have a reason to use yet. This does not touch
Tutorial Grounds' own logic, only what surrounds it.

**Proof gates:** standard gauntlet plus confirm the keybind bar's
default state shows only the core entries with a real, working
expand/collapse, confirm every one of the 13 HUD elements shares real,
identical spacing/radius/color values (a genuine per-element check, not
a sample), confirm compass/minimap stay hidden until Tutorial Grounds
completes or is explicitly skipped, confirm nothing else during the
tutorial is affected.


---

## QUEUED, AFTER THE UI PASS — do not build until the spec above ships.
## Confirmed, locked spec for a future version (Animation & A Living World Pass)

**Confirmed live before writing this: 15 creatures already use a real
idle-bob technique (`Math.sin(t/400 + phase)`-style motion) — that
pattern is proven and should be the reused foundation, not replaced.
Confirmed real, current gaps: no floating damage numbers exist
anywhere in the game, no water tile has any ripple/motion, and no
walk-cycle exists for the player or any creature's legs during
movement — everything currently translates position as a rigid shape.**
This spec closes those specific gaps and extends the proven idle
technique further, rather than inventing a new animation system.

**PART A — floating damage numbers, the single most-requested feeling
in games like this and currently entirely absent.** Every hit that
lands — player attacking a mob, a mob hitting the player, PvP — spawns
a small number at the impact point that drifts upward and fades,
reusing the existing particle/text-rendering technique already used
for toasts rather than a new system. Different weight or color for a
critical/backstab hit versus a normal one, reusing whatever crit
distinction already exists in the damage calculation.

**PART B — a real walk-cycle, not just translating position.**
Confirmed live: movement currently repositions a rigid shape with no
internal motion. Add a simple, cheap leg/limb offset driven by the
existing movement-phase value already computed for bob animation —
alternating leg positions synced to actual movement speed, stopping
instantly when the player or a creature stops moving. This is the
single highest-leverage change for making the game feel alive on every
single frame someone is playing, the same logic as the Lighting pass's
rim-light helper being one function touching everywhere.

**PART C — water gets real motion.** Confirmed live: no ripple, wave,
or shimmer exists on any water tile. Add a subtle, layered-shape ripple
technique (concentric fading circles, reusing the exact non-gradient
technique already proven throughout this project) that drifts slowly
across Shallow and Water tiles specifically — cheap, ambient, and
currently the single most static-looking surface in the whole game
despite covering a large fraction of the map.

**PART D — trees and grass respond to something, even if only
themselves.** Confirmed `drawTree()` already receives a time parameter;
confirm whether it is currently used for sway and, if not, add a real,
subtle sway — reusing the exact rotation-offset technique idle-bob
creatures already use, applied to the canopy shape specifically, not
the trunk. Grass/flower decoration gets the same treatment at a smaller
scale. This alone will change how "alive" empty biomes feel more than
any single other change in this spec.

**PART E — UI transitions get finished, not invented.** Confirmed live:
some transitions already exist (panel opacity, HP bar width). Audit
every remaining UI value that currently snaps instantly — inventory
counts changing, a new item appearing, the boss bar itself on first
appearing — and apply the same `transition` technique already proven
elsewhere, rather than a new animation system. This is completion of an
existing pattern, not new work.

**Proof gates:** standard gauntlet plus confirm floating damage numbers
appear for every real hit source (player, mob, PvP) and correctly
distinguish a crit, confirm the walk-cycle only animates while actual
movement speed is non-zero and stops cleanly, confirm water ripple
animation has no measurable per-frame cost regression against the
existing particle budget, confirm tree/grass sway does not affect
hitbox or gather-range detection (visual only), confirm every part
reuses a named existing technique rather than introducing a parallel
system, matching the Lighting pass's own discipline.


---

## QUEUED, AFTER THE ANIMATION PASS — do not build until both specs above ship.
## Confirmed, locked spec for a future version (Consumables)

**Confirmed live: `herb` and `essence` are real, gatherable resources
with their own node types, drawing, and picking logic — and are used in
zero crafting recipes anywhere in the current file.** They are pure
dead weight right now: a player can gather them and nothing in the game
ever asks for them again. This spec gives them, and food generally, a
real purpose, reusing the existing item/inventory system rather than
building a new one.

**PART A — a real "use item" action, since none currently exists.**
Confirmed live: no `useItem`/`consumeItem` function exists anywhere.
Add one real interaction point — an inventory item with a defined
consumable effect gets a "Use" action alongside its existing display,
reusing the inventory panel's own existing item-row rendering rather
than a new UI. Using an item removes one from the stack and applies its
effect immediately.

**PART B — real food, using resources that already exist.** Cooked
meat from existing mob loot (reuse whatever raw-meat-equivalent loot
already drops, or gate behind a Forge interaction turning a raw
material into a cooked one) restores HP over a short duration — the
simplest, most obvious first consumable, and the most universally
useful.

**PART C — herb and essence become real potion ingredients.** A small,
contained set of potions craftable at any Forge from combinations of
existing materials (herb, essence, plus a tier-appropriate common
resource) rather than inventing new gatherables:
- A speed potion (temporary movement boost, stacking rules TBD against
  mount speed and guild buffs — must not compound into something
  absurd, check against both directly)
- A breath-extension potion for diving — a direct, in-world answer to
  the underwater-reachability conversation from earlier in this
  project, an item-based solution instead of a permanent stat change
- A basic resist potion (temporary reduced damage from one specific
  source — propose fire, tying naturally to Volcano/Caldera expeditions)

**PART D — no consumable breaks combat balance on its own.** Every
effect in Part B/C is temporary and modest — this is about texture and
survival-prep, not a new permanent power source stacked on top of
guilds, gear, and Elders. Confirm every proposed number against what
already exists (guild buffs, gear bonuses) rather than in isolation.

**Proof gates:** standard gauntlet plus confirm using a consumable
correctly removes exactly one from the stack and cannot be used from
an empty count, confirm every potion's real duration/magnitude is
measured and stated (not left as a vague "temporary boost"), confirm
stacking behavior against mount speed and guild Tier 1/2 buffs is
explicitly tested, not assumed safe, confirm herb/essence genuinely
have a real use for the first time in the project's history.


---

## QUEUED, AFTER CONSUMABLES — do not build until all three specs above ship.
## Confirmed, locked spec for a future version (Matched-Tier Gear Bonus)

**Confirmed live: `ARMORS` has exactly one equip slot (`me.armor`), not
separate pieces — "set bonus" in the traditional multi-piece sense
does not fit this game's real structure.** Confirmed real values:
`iron_armor: { tier: "iron", reduce: 0.15 }`,
`runic_armor: { tier: "runic", reduce: 0.28 }`. The real, buildable
version of this idea: a bonus for matching your equipped weapon's tier
to your equipped armor's tier, since that is the actual choice a player
makes with two real slots, not an imagined third and fourth slot.

**PART A — one small, real bonus per matched tier.** Wielding an Iron
weapon while wearing Iron armor, or Runic-with-Runic, or Dragonsteel-
with-Dragonsteel, grants one modest passive — propose a small bonus to
the armor's own `reduce` value specifically (matched tier meaningfully
outperforms mismatched tier at the same gear level) rather than an
unrelated new stat. This rewards deliberate, coherent gear choices
without adding new equipment slots this game was never built around.

**PART B — mismatched tiers stay completely valid, just without the
bonus.** A Dragonsteel weapon with Iron armor (or any other mismatch)
continues working exactly as it does today — this is a bonus for
coherence, not a penalty for mixing tiers, which is a real, legitimate
playstyle choice (e.g., prioritizing offense while gear is still
catching up on defense).

**Proof gates:** standard gauntlet plus confirm the bonus only applies
when weapon tier and armor tier are genuinely identical strings,
confirm a mismatched loadout takes zero penalty relative to current
behavior, confirm the bonus is real and measured against the base
`reduce` value for each tier, not a vague "small boost".


---

## Confirmed, locked spec for the next build (World Check Fixes — Landmarks, Compass, Caves, Lava & Dark Forest)

**Where this came from.** On 2026-10-12 the whole game was checked from
the outside for the first time. `debug/shot.js` entered the world offline
with stubbed Supabase and took 36 screenshots: six landmarks, six biomes,
both cave types, every panel key, night, combat, death and two phone sizes.
Terrain was also measured with `biomeAt`, `heightAt` and `featureTypeAt`
using the harness seed `123456789`. At that time run3, run5 and run4
(1718 PASS, 0 FAIL) were all green. Every problem below was seen on screen
or measured; none comes from reading code alone. Mobile/touch, rendering
performance, security and new content are deliberately NOT in this build.
They are separate runs, decided by the owner later.

**PART A — Landmarks must stand on land.** Measured on the harness seed,
the Ancient Forge (the only place dragonsteel can be smelted) has its
centre on `DEEP`. Within 6 tiles there are 93 DEEP, 8 WATER, 5 SHALLOW
and 3 VOLROCK tiles. The only non-blocked tiles inside `ANCIENT_R` are 4
water tiles, so players have to stand in the sea to use it. The
screenshot shows the forge as a box floating in open water.
`placeLandmarks()` picks `ANCIENT` and `COLOSSEUM` by hashed angle alone
and never looks at terrain.
- In `placeLandmarks()`, add a land test to the ANCIENT and COLOSSEUM
  attempt loops. A candidate passes only if every tile within
  `ANCIENT_R + 2` (forge) or `COLOSSEUM_R + 3` (arena) has
  `elevRaw(tx, ty) >= 0.42`, i.e. above the sand band, so it is land.
- Use `elevRaw` only. NEVER call `biomeAt` inside `placeLandmarks()`: it
  runs before `tileCache.clear()` (see the existing comments near lines
  4137 and 4292), so a `biomeAt` call there would cache stale tiles.
  `elevRaw` depends only on TOWER and MOUNT, which are both placed before
  these two.
- If no attempt passes, keep the attempt with the highest land fraction
  instead of the last one, and log the fraction through the existing
  harness-hook pattern.
- Raise the attempt counts from 20 to 40 for these two loops only.
- The existing distance rules stay exactly as they are.
- **YELLOW note for the changelog:** on the live seed this may move the
  Ancient Forge and/or the Colosseum to a new spot. That is the fix. Say
  in the changelog that it can happen.

**PART B — The Colosseum gets a real clearing, like the Bazaar.**
Measured: the `COLOSSEUM_R + 3` disc contains 297 FOREST, 293 DARKFOREST,
219 WATER, 157 ROCK and 152 SAND tiles, 346 features (trees growing
inside the arena) and heights −1 to 2. The sand floor is drawn as a
see-through disc over trees and water, and some columns stand in the sea.
The Bazaar already solved exactly this:
- `biomeAt`: its clearing line (`Math.hypot(tx - BAZAAR.x, ty - BAZAAR.y) < BAZAAR_R) b = B.PLAINS`,
  with the same guards).
- `rawHeight`: its flat-ground line (`< BAZAAR_R) h = 0`).

Copy both lines for the Colosseum with radius `COLOSSEUM_R + 3`, placed
directly after the Bazaar's own. Nothing else about the Colosseum
changes: pieces, podiums, the duel logic, PvP rules and its keep-out stay
as they are.

**PART C — No trees inside the Bazaar or the Colosseum.** The Bazaar
clearing turns ground into PLAINS, but PLAINS still grows a tree at
`h > 0.965`. Measured: 13 trees inside `BAZAAR_R`, which is what the
owner asked to have removed in the Mount/Bazaar polish. At the top of
`featureTypeAt()`, return `null` for any tile inside `BAZAAR_R` or inside
`COLOSSEUM_R + 3`. The Spawn safe zone keeps its scattered trees (that
look is intended), so do not add Spawn here.

**PART D — Compass labels never overlap.** In every landmark screenshot,
labels that share a bearing are drawn on top of each other and are
unreadable (for example "ARENA", "SHRINE" and "SPAWN" printed as one
blob, or "TOWER" over "ORACLE"). All marks sit at one radius
(`R_MARK`, declared as `const R_TICK = 64, R_MARK = 42` in `updateMinimap()`) and each label is drawn centred above its dot
(`.mm-mark-label`, `translate(-50%, -140%)`, 8px text).
- In `updateMinimap()`, lay the labels out greedily: nearest landmark
  first, using its world distance from `me`.
- Estimate each label's box as `label.length * 5 + 4` px wide by 10 px
  high. Try the normal spot first, then the same bearing at
  `R_MARK - 14`, then at `R_MARK + 10`.
- If all three spots collide with a label already placed, draw the dot
  only, with no label.
- Dots never move. Only labels shift or drop.
- Add a harness hook `compassLabelLayout()` that returns the placed label
  boxes.

**PART E — The [?] help panel must not cover other HUD.** With the full
control list open, `#hudHelp` grows upward from `bottom: 14px; left: 12px`
straight over the compass card (`#hudMinimap`, `bottom: 52px; left: 12px`).
It also runs into `#hudZone` ("SAFE ZONE — YOU ARE PROTECTED",
`bottom: 64px`, centred), which the night-spawn and help screenshots both
show.
- When `helpExpanded` is true, lift `#hudMinimap` and `#hudZone` above
  the help card's real height. Reading `#hudHelp`'s `offsetHeight` into a
  CSS variable from `toggleHelpFull()` is fine.
- Closing the help puts them back exactly where they were.
- Nothing about the help text itself changes.

**PART F — Caves stop floating in the daytime sky.** Inside both
interiors (underwater cave and Abyssal Hollow), the screenshots show the
cave floor as a diamond island over a bright sky, sea and parallax hills.
The surface backdrop in `render()` (the block under "Sky/horizon gradient
reacting to time of day") runs even when `inInterior()` is true.
- When `inInterior()` is true, replace that whole backdrop (sky gradient,
  sea band, parallax hills) with one flat near-black fill: `#07080c` for
  underwater caves, `#0a0612` for the Abyssal Hollow. Both are tunables.
- Keep it flat, with no gradient, per the art-style skill.
- The v55 cave darkness pass (`CAVE_DARK_A`, the light map) is not
  touched.

**PART G — Lava looks molten, not like a flat orange field.** The
Volcano's lava core has radius 124 (`dV < 124`). By day the landing
screenshot is an unbroken flat orange plane: each LAVA tile gets one
fill plus a faint pulse at 0.02–0.18 alpha and two shimmer lines. In the
`b === B.LAVA` branch of the ground pass, add cooled crust plates:
- Using `hash2(tx, ty, <new salt>)`, about 45% of lava tiles (tunable)
  get a darker crust diamond inset inside the tile, colour
  `shade("#5c3c3c", 0.8)`. That is the existing VOLROCK face colour, so
  no new palette entry.
- That leaves bright seams of the existing lava orange between plates,
  so the surface reads as crust with glowing cracks.
- Inside the crust, a slow pulse of the existing `rgba(255,200,120,…)`
  glow on about 20% of tiles (tunable) brightens to at least 0.35 alpha
  at its peak.
- Cheap per-tile only: no gradients, no new canvas, no per-frame
  allocation.
- Read `runehaven-art-style/SKILL.md` first. The volcano silhouette is on
  its must-not-regress list and heights are not touched.

**PART H — The Dark Forest is the densest forest.** Measured over the
whole map: FOREST 36.7% tree tiles, DARKFOREST 36.2% (the same rule,
`clusterNoise > 0.42 && h > 0.42`, is shared by both). The
Dark-Forest screenshot is a large flat dark clearing (22% trees in a
25×25 window), which reads as empty.
- Split the shared branch in `featureTypeAt()` so DARKFOREST uses
  `clusterNoise > 0.30 && h > 0.30` (tunables). FOREST stays exactly as
  it is.
- Aim for DARKFOREST at 50% tree tiles or more, and at least 12 points
  above FOREST.
- If the gate's sampled numbers miss, tune only those two thresholds.

**PART I — One cheap render fix.** In the `render()` entity gather, the
wild loop (`if (!rec29) for (const w of wilds)`, not the one in
`nearestWild()`) calls `isWildVisible(w)` on all of `wilds` (3090 alive on the
harness seed) before the screen-bounds test. Swap the order so the
bounds test runs first. Behaviour must stay the same.

**PART J — Teach `debug/shot.js` the views this build is judged on.**
After the existing tour, add:
- `40-night-spawn.png` and `41-night-volcano.png`: set
  `worldEpoch = Date.now()/1000 - DAY_LENGTH*0.75` through `page.evaluate`.
- `42-help-open.png`: click `#helpToggle`.
- `43-compass.png`: a clipped shot of `#hudMinimap` taken at the Grand
  Bazaar, where the labels collided.

Add no new dependencies, and never touch the network.

**Proof gates** (standard gauntlet, plus):
- A: for at least 5 seeds (the harness seed plus 4 others), every tile
  within `ANCIENT_R + 2` of ANCIENT and within `COLOSSEUM_R + 3` of
  COLOSSEUM has `elevRaw >= 0.42`, or, if the fallback fired, the chosen
  spot's land fraction is the best of its attempts. Print the fractions.
  Also check that `placeLandmarks` contains no `biomeAt` call.
- B: on the harness seed, every tile in the `COLOSSEUM_R + 3` disc has
  biome PLAINS (or LAVA, DEEP or WATER only if the A fallback fired, and
  then it is printed) and `heightAt == 0`. The Bazaar clearing gates still
  pass.
- C: `featureTypeAt` returns null for every tile inside `BAZAAR_R` and
  inside `COLOSSEUM_R + 3`. The Spawn safe zone still has at least one
  tree feature (preservation).
- D: walk `me` to 20 points, including the Bazaar and Spawn, run
  `updateMinimap()`, and check that no two boxes from
  `compassLabelLayout()` intersect. Check too that every landmark still
  has a dot.
- E: source gate showing `toggleHelpFull()` (or the code it calls)
  adjusts `#hudMinimap` and `#hudZone` and that closing restores them.
  The help text content is unchanged.
- F: inside each interior kind, the sky gradient's colour stops are not
  drawn this frame (instrument through the existing ctx proxy or a hook),
  and the surface still draws them.
- G: count crust tiles over the lava disc. The share must land within ±8
  points of the 45% tunable. No `createRadialGradient` or
  `createLinearGradient` may be added inside the LAVA branch.
- H: DARKFOREST treePct ≥ 50 and ≥ FOREST + 12, sampled exactly as in
  the measurement above (every 3rd tile, a 40-tile margin). FOREST and
  ENCHFOREST must stay within ±1 point of 36.7 and 29.1.
- I: the render gather still yields the same wild set for a fixed camera
  (count before and after).
- J: `node debug/shot.js shots` produces the four new files when
  Playwright is available, or prints "skipped" and exits 0 when it is not.
- **Visual check (step 0d):** Read `10-landmark-the-ancient-forge.png`,
  `10-landmark-the-ruined-colosseum.png`, `10-landmark-the-volcano.png`,
  `30-interior-uwcave.png`, `20-biome-darkforest.png`,
  `42-help-open.png` and `43-compass.png`. Describe each one in the
  changelog. The acceptance for Parts A, B, D, E, F and G is literally
  what those shots show: the forge on land, no trees or water in the
  arena, readable compass labels, help not covering the compass, a dark
  backdrop in caves, and lava with visible crust and glowing cracks.

## QUEUED, AFTER THE WORLD CHECK FIXES — do not build until the spec above ships.
## Confirmed, locked spec for a future version (Mobile & Touch)

**Why this is next.** The owner's goal is the App Store. On 2026-10-12
the game was checked at iPhone sizes (844×390 landscape, 390×844
portrait) with Playwright using `hasTouch`. The game cannot be played on
a phone today:
- `runehaven.html` has **zero** `touchstart`/`pointerdown` handlers and
  **zero** `@media` rules.
- Every action goes through the window `keydown` handler (`k ===
  KEYBINDS.*`), and attack aiming goes through `canvas` `mousedown`.
- At phone size the HUD cards overlap each other: compass, minimap,
  `#hudZone`, `#hudPrompt` and `#hudHelp` all collide in portrait. The
  Inventory panel covers the minimap and its title gets clipped to
  "VENTORY".
- On the login screen at 390 px wide, the RUNEHAVEN title runs off both
  edges.

The keyboard game must behave exactly as it does today on a computer.

**PART A — Touch controls that reuse the key path, with no second input
system.**
- A `#touchUI` layer shows when
  `matchMedia('(pointer: coarse)').matches` is true. A new Settings row,
  "Touch controls: Auto / On / Off", overrides that. Persist it in the
  existing `rh_settings` storage, with try/catch around storage the way
  the current settings already do.
- **Buttons fire synthetic key events.** Every on-screen button
  dispatches `new KeyboardEvent('keydown', { key: KEYBINDS[action] })`
  on `window` on `pointerdown`. It dispatches the matching `keyup` on
  `pointerup`, `pointercancel` and `pointerleave`. That way, taming by
  holding E, blocking by holding Shift, `e.repeat` guards, remapped keys
  and every panel toggle work unchanged. Never call `tryAttack`/
  `startTaming` etc. directly from a button.
- **Right-thumb cluster:**
  - Attack: 72 px, `KEYBINDS.attack`.
  - Interact: E, hold works.
  - Ability: Q.
  - Block: Shift, hold.
  - Mount: R.
  - Dive: F. Shown dimmed unless the player is on or next to water.
- **Menu button.** A small ☰ button sits in the top-right under the day
  card. It opens a row of buttons that each send one key press (down then
  up):
  - Inventory (I)
  - Craft (C)
  - Companions (P)
  - Build (B)
  - Character (K)
  - Travel (M)
  - Give (G)
  - Help
- **Left-thumb joystick.** It appears where the thumb lands inside a
  `#touchStick` zone covering the left 45% of the bottom 65% of the
  screen.
  - Radius 56 px, deadzone 0.2 (both tunables).
  - It writes a module-level `touchVec = {x, y}` in screen directions.
  - In `update()`, directly after the four existing
    `if (keys[KEYBINDS.*] || keys["arrow*"]) raw* ±= 1;` lines, add
    `rawX += touchVec.x; rawY += touchVec.y;`. Nothing else in the
    movement code changes; it already normalises and does the isometric
    turn.
  - On release, `touchVec` is reset to 0,0.
- **Tap to attack.** A tap on the open game canvas (outside every
  control) attacks toward the tap. Convert the `canvas` `mousedown`
  handler to `pointerdown`, keeping the same body
  (`screenToWorld(e.clientX, e.clientY)` → `tryAttack(wx, wy)`).
  Controls call `stopPropagation()`, so touching a control never
  attacks.
- **Stop the phone acting like a web page.**
  - Viewport meta becomes `width=device-width, initial-scale=1,
    maximum-scale=1, user-scalable=no, viewport-fit=cover`.
  - `touch-action: none` on the canvas and every control.
  - `-webkit-user-select: none` and `-webkit-touch-callout: none` on the
    game layer.
  - Block double-tap zoom.
  - Use `env(safe-area-inset-*)` padding, so nothing sits under the notch
    or the home bar.

**PART B — The HUD fits a phone.** Add one media query block for
`(max-width: 900px), (max-height: 500px)`. The bottom corners belong to
the thumbs, so on a touch layout:
- `#hudMinimap` (the compass card) and `#hudMap` (the minimap) shrink to
  about 70% and move to the top corners, under the player card and the
  day card.
- `#hudZone` and `#hudPrompt` move to top-centre, under the tutorial line.
- `#hudHelp` is hidden; Help is in the ☰ menu.
- Every `.panel` gets `max-height: calc(100dvh - 24px); overflow-y: auto;
  width: min(92vw, <current width>)`.
- On the login screen, the RUNEHAVEN title uses a `clamp()` font size so
  it fits 360 px.

The desktop layout is untouched outside the media query.

**PART C — Portrait.** In-world on touch with
`innerHeight > innerWidth`, show a dismissible card: "Turn your phone
sideways for the best view". The game stays playable in portrait.

**PART D — Help text matches the device.** On touch, the help list
(now in the ☰ menu) describes the buttons, for example "Left thumb: move
· Tap: attack · ✋ hold: tame / gather". The keyboard text stays for
keyboards.

**PART E — `debug/shot.js` gets a phone mode.** With `MOBILE=1`, run the
same tour in a `hasTouch: true, isMobile: true` context at 844×390, plus
one portrait shot at 390×844. Save the files as `50-m-*.png`. Measure
the `getBoundingClientRect()` of the player card, day card, compass,
minimap, `#hudZone`, `#hudPrompt`, `#touchStick` and the button cluster,
and print any pair that intersects.

**Proof gates** (standard gauntlet, plus):
- In jsdom, with `matchMedia` stubbed to coarse, `#touchUI` is shown.
  With it stubbed to fine, it is hidden. The Settings override beats
  both ways.
- A synthetic `pointerdown`/`pointerup` on each button reaches the same
  handler as the real key. Count calls to `tryAttack`, `tryAbility`,
  `toggleMount`, `toggleDive` and `startTaming`/`cancelTaming` (hold,
  then release). Each panel button toggles its panel exactly as its key
  does.
- Setting `touchVec = {x:0, y:-1}` for 1 s of pumped frames moves `me`
  the same distance and direction as holding W for the same frames
  (±2%).
- **Preservation:** with touch hidden, the keyboard and mouse gates that
  already exist in run4 all still pass unchanged. The `mousedown` →
  `pointerdown` change still attacks on a mouse click.
- The viewport meta contains `user-scalable=no` and `viewport-fit=cover`.
- Playwright (via shot.js `MOBILE=1`, skip with a note if it is not
  available): no intersecting HUD pairs at 844×390. At 390×844 only the
  portrait card may overlap other elements.
- Visual check: read `50-m-*.png` and describe them.

---

## QUEUED, AFTER MOBILE & TOUCH — do not build until the spec above ships.
## Confirmed, locked spec for a future version (Performance — Ground Cache & Quiet HUD)

**Measured 2026-10-12** in headless Chromium at 1280×720, which uses
software rendering, so these are relative numbers:
- **Frame rate:** 28.3 fps at Spawn, 17.0 at the Ruined Colosseum's
  forest edge, 16.7 at the Grand Bazaar.
- **CPU profile at the Colosseum:** 51.5% native canvas rasterising,
  plus JS spread across `render`, `lineTo`, `drawBox`, `drawGroundTile`
  (3.2%) and `drawTree` (2.6%).
- **Why:** the ground pass redraws every visible tile's diamond and cliff
  faces from scratch every frame (`drawGroundTile(ctx, tx, ty)` in the
  diagonal sweep in `render()`).
- **What makes caching possible:** `drawGroundTile(c, tx, ty)` takes no
  time argument; its output depends only on `biomeAt`/`heightAt`/
  `variedZ`, which are cached and static.
- **HUD churn:** `updateHUD()` runs every frame from `render()` and calls
  `updateMinimap()` (rebuilds the compass `innerHTML`) and
  `updateWorldMap()` (redraws the minimap canvas), even when nothing has
  changed.

Phones are slower than this, so this run comes before any public launch.

**PART A — Bake the ground into chunk canvases.**
- **Chunks and cache:** behind `GROUND_CACHE = true` (a constant gates
  can flip), split the world into chunks of `GC_TILES = 16` tiles. Keep
  baked chunks in an LRU of `GC_MAX = 48` (both tunables). Each baked
  chunk is an offscreen canvas.
- **Baking:** a chunk is baked by calling the existing
  `drawGroundTile(chunkCtx, tx, ty)` for its tiles, in the same diagonal
  `tx + ty` order the live pass uses. The context is translated so the
  chunk's top tile sits at a fixed origin. Pad the canvas by
  `GROUND_UP`/`GROUND_DOWN` so cliff faces are not clipped.
- **Compositing:** blit visible chunks back to front by `cx + cy`.
  Cliff faces overhang their southern and eastern neighbours (see the
  comment above the ground pass), so the chunk order has to keep that
  overlap correct across chunk edges. The gate below is the judge.
- **No frame hitches:** bake at most `GC_BAKE_PER_FRAME = 2` chunks a
  frame (tunable). Any visible chunk that is not baked yet is drawn with
  the existing direct path that frame, so nothing pops in.
- **Invalidation:** clear the whole cache wherever `tileCache.clear()`
  runs (login world build and world reset).
- **Not cached:** interiors are untouched; they have their own pass. The
  water ripple and lava flicker pass after the ground stays live per
  frame. Anything animated stays out of the cache.

**PART B — The HUD only writes when something changed.**
- `updateMinimap()` rebuilds the dial's `innerHTML` only when the set of
  rounded bearings (1°) or labels changed since the last build.
- `updateWorldMap()` redraws only when the player's tile changes, the
  set of visible players changes, or 250 ms have passed (tunable).
- Every other `innerHTML`/`textContent` write inside `updateHUD()` is
  skipped when the new string equals the last one written.

**PART C — Record, don't change, the pixel-ratio decision.** The canvas
stays at CSS-pixel size (`canvas.width = innerWidth`), not
`devicePixelRatio`. That is deliberately cheaper on phones. Add a
comment saying so and add a `RENDER_SCALE = 1` tunable that `resize()`
reads, so it can be raised later.

**Proof gates** (standard gauntlet, plus):
- **Pixel match (Playwright, required when available).** At four camera
  positions (Spawn, a coastline, the volcano rim, a forest edge), render
  one frame with `GROUND_CACHE` false and one with it true. Freeze time
  with a fixed `t`, hide entities and HUD, and count pixels whose channel
  difference is greater than 8. It must be 0.5% of the frame or less.
  Print each number.
- **Frame rate (Playwright, required when available).** In one session,
  at the Colosseum and Bazaar spots, fps with the cache on must be at
  least 1.4× fps with it off. Print both. If Playwright is missing, say
  "skipped" and still run every jsdom gate.
- **jsdom:**
  - The LRU never holds more than `GC_MAX` chunks.
  - At most `GC_BAKE_PER_FRAME` bakes happen per frame.
  - A world reset empties the cache.
  - Interiors never touch it.
- **HUD:** over 120 frames standing still, the compass is rebuilt at most
  once and the minimap at most once per 250 ms window. Moving one tile
  triggers a minimap redraw.
- **Preservation:** every existing ground-pass gate in run4
  (`groundStats`, the cull proof) still passes. Where a gate measures
  the direct path, run it with `GROUND_CACHE` false.

---

## QUEUED, AFTER PERFORMANCE — do not build until the spec above ships.
## Confirmed, locked spec for a future version (Account Security — Own Your Row)

**Measured 2026-10-12 from the source.** The game talks to Supabase with
the public anon key and has no Supabase Auth at all (`sb.auth` is never
used). The holes, all exploitable with nothing more than the key that is
already in the page:
1. **PINs can be read in plain text.** `account_pins` stores `pin` as
   text, and the login gate reads it with
   `sb.from("account_pins").select("pin").eq("username", …)`, then
   compares in the browser. Anyone can read any player's PIN, and the
   check can be skipped.
2. **Players can edit any player's row,** including
   `role` (`isAdmin()` is `me.role === "admin"`), `guild`, `guild_tier`
   and inventory. The update policy is `using (true)`.
3. **Redeem codes are counted by the client:**
   `redeem_codes.update({ uses_left: usesLeft - 1 })`.
4. **The admin world reset is a set of plain client writes:**
   `world.update({ seed })`, `base_pieces.delete().neq("id", 0)` and the
   Elder `pets` delete.
5. **`supabase-js` is loaded unpinned** (`@supabase/supabase-js@2`).

Read `.claude/skills/supabase/SKILL.md` and
`.claude/skills/supabase-postgres-best-practices/references/security-*.md`
before writing anything. Per README step 0c, the build writes SQL to
`supabase_<version>.sql` and **never runs it**.

**The design (keeps the username + PIN the players know):**
- **Every browser gets an anonymous Supabase user**
  (`sb.auth.signInAnonymously()`) before login. supabase-js keeps the
  session in local storage. A new column, `players.owner_id uuid`, ties a
  row to the auth user that owns it.
- **PINs are hashed and never readable.** Store them in
  `account_pins.pin_hash` (pgcrypto `crypt`/`gen_salt('bf')`). The SQL
  migrates existing plain PINs to hashes, then drops the `pin` column.
  Clients get no select/insert/update on `account_pins` at all.
- **Logging in is one RPC.** `claim_account(p_username, p_pin)` is
  `security definer` with `set search_path = ''` and grants execute to
  `authenticated` only:
  - A new name: creates the PIN hash.
  - An existing name: checks the hash.
  - On success, sets `players.owner_id = auth.uid()` (a new device simply
    takes ownership).
  - Rate limit: 5 failed attempts per username per 15 minutes, in a
    `pin_attempts` table that clients cannot touch.
  - Returns ok or a reason; never the hash.
- **`players` row-level security:**
  - Select is open to `authenticated`.
  - Insert requires `owner_id = auth.uid()`.
  - Update has `using` and `with check` both `owner_id = auth.uid()`.
  - A `before insert or update` trigger, applied when `current_user` is
    `anon` or `authenticated`:
    - On insert, it forces `role = 'player'` and `guild_tier = 1`.
    - On update, it rejects changes to `role`, `guild`, `guild_tier` and
    `owner_id`.
  - The owner editing in the SQL editor (as `postgres`) is not blocked,
    so admin setup keeps working.
- **`pets`:** insert, update and delete only where
  `owner = (select username from players where owner_id = auth.uid())`.
  Select stays open.
- **Redeeming is one RPC.** `redeem_code(p_code)` (security definer, same
  guards) checks `redeem_claims`, decrements `uses_left` atomically and
  returns the items. Any guild-tier grant also goes through it. Clients
  lose direct update on `redeem_codes` and insert on `redeem_claims`.
  Find every client path that currently sets `guild_tier` and route it
  through this RPC.
- **World reset is one RPC.** `admin_world_reset(p_seed)` (security
  definer) checks the caller's row has `role = 'admin'` and then does the
  three writes. Clients lose update on `world`.
- **Left deliberately open, and written into the changelog as known
  risk:** `base_pieces` (raids damage other players' pieces). Limit it:
  - insert only with `owner` = my username;
  - update of any piece allowed, but when the caller is not the owner a
    trigger rejects changes to any column except `hp`. The owner may also
    change `sign` and `last_collected`, the only other columns the client
    updates today;
  - delete allowed for the owner or when `hp <= 0`.

  `ground_items`, `mined_nodes` and `rare_takes` stay open: the world
  needs anyone to drop and pick up. The realtime broadcast channel stays
  unauthenticated. Fully server-side combat is a much bigger project and
  is not this run.
- **Pin supabase-js** to an exact current 2.x version on the
  `<script src>` (look it up; do not guess).

**Deploy order, which this HTML must survive.** The HTML ships first.
Until the owner runs the SQL, `claim_account` does not exist. When an RPC
returns "function does not exist", the game falls back to today's legacy
path and logs one console warning, so nothing breaks in between. Once
the SQL is run, the legacy path is refused by row-level security and the
RPC path is the only one.

**Owner steps (write them at the top of `supabase_<version>.sql` as
comments, numbered, plain English):**
1. Supabase → Authentication → Sign In / Providers → turn on
   **anonymous sign-ins**.
2. Authentication → Rate Limits → raise **anonymous sign-ins per hour**
   from the default 30 per IP. A whole school can share one IP, so use
   something like 300.
3. Optionally turn on CAPTCHA/Turnstile for anonymous sign-ins, which
   Supabase recommends.
4. Run the SQL file.
5. Make the admin's row: `update players set role='admin',
   guild='nameless_tide' where username='…';`. It then has to be claimed
   once by logging in with the PIN.

**Proof gates** (standard gauntlet, plus):
- **Harness stubs.** Extend the run3, run4 and run5 Supabase stubs with
  `auth.signInAnonymously` and `rpc`. Gate both modes: RPC present, and
  RPC "does not exist" (legacy fallback). Login succeeds in both.
- **Source gates:**
  - No `.from("account_pins")` call remains outside the legacy fallback.
  - No client-side PIN comparison remains outside it.
  - No direct `redeem_codes` update and no direct `world` update remain
    outside it.
  - The `<script src>` names an exact version.
- **SQL file gates** (text checks on `supabase_<version>.sql`):
  - Row-level security is enabled on every table named above.
  - Every `security definer` function has `set search_path = ''`, checks
    `auth.uid()`, and is granted to `authenticated` only (revoked from
    `public`/`anon`).
  - The `pin` text column is dropped after migration.
  - The update policy on `players` has both `using` and `with check`.
  - No policy uses `auth.role()`.
  - No view is created without `security_invoker = true`.
- **Preservation:** admin features still work from the stub when the
  stubbed row has `role: 'admin'`. Guild display, redeem rewards, raids,
  pickups and pets all pass their existing gates.

---

---

## QUEUED, AFTER ACCOUNT SECURITY — do not build until every spec above ships.
## Confirmed, locked spec for a future version (World Encounters — Roaming Boss & Bounty Board)

**Confirmed live: deterministic idle-wander logic already exists,
leash-bound to each creature's own `leashRadius`.** This spec extends
that proven pattern rather than building new movement logic.

**PART A — the Elder Drake roams (owner decision, 2026-10-12).** Three
nightly builds (9, 10 and 11 Oct) stopped RED. The old PART A asked for a
new Boss-tier creature, but the bible has exactly one Boss-tier creature,
the Elder Drake (`RUNEHAVEN_BIBLE.md:132`, "Volcano, World Boss"). The
owner has decided: **the Elder Drake itself becomes the roaming world
boss.** This is an approved bible deviation (the owner's word beats the
bible). Record it in the changelog as one, citing this line. No new
creature is added.
- **How it roams.** Mobs already idle-wander around their home (`m.hx`,
  `m.hy`) up to their `leashRadius` (the Drake's is 24). Make the Drake's
  *home* travel instead of adding new movement code. Add a deterministic
  `drakeRoamHome(nowMs)` that returns where the home is at any moment:
  - legs of `DRAKE_LEG_MS = 20 min` (tunable);
  - each leg's target comes from `hash2(legIndex, worldSeed, <new salt>)`,
    a point within `DRAKE_ROAM_R = 900` tiles of the VOLCANO (tunable);
  - the home moves in a straight line from the previous target, reaching
    it at the end of the leg.

  Because it is computed from time and the seed, every client agrees on
  where it is with no network messages. While the Drake is idle, its
  `hx/hy` follow `drakeRoamHome(now)` every frame. When it is engaged,
  the existing combat and `mob_sync` behaviour is unchanged; leashing
  measures from the current home. After combat ends, the Drake walks back
  toward the moving home at normal speed: no teleport, no snap.
- **Safe Zones are never entered.** A leg target inside, or a straight
  leg that crosses, Spawn's `SAFE_RADIUS`, `OTHER_SAFE_ZONES` (`ZONE_R`),
  the Bazaar (`BAZAAR_R`) or the Colosseum is skipped: re-hash with
  `legIndex` plus an offset. The Drake flies, so water and lava are fine.
- **What stays the same:**
  - the Volcano lair keeps its Demon Knight guards, the lava, the boss bar
    (`#hudBoss`), the Elder music cue and the Drake's loot (dragonsteel);
  - `ELDER_DRAKE_RESPAWN_MS` (6 h) and `count: 1`;
  - after a respawn, the Drake reappears at `drakeRoamHome(now)`, not at
    the lair.
- **It can be tracked.** Add a harness hook `worldBossPos()` that returns
  the live x/y. The bounty board (PART B) also says which way the Drake
  is from the board and roughly how far ("The Elder Drake was last seen
  far to the NE"), using the compass bearing maths already in
  `minimapBearings()`.

**PART B — a rotating bounty board.** A new interaction point at Spawn
or the Bazaar (build's choice, either fits the "safe hub" role) naming
one existing creature as today's bounty, refreshing on a real timer
(propose once per in-game day, tied to the same day-counter other
daily systems already use). Killing or taming that specific creature
while the bounty is active grants a bonus reward — reuse existing loot/
reward patterns rather than a new currency.

**Proof gates:** standard gauntlet plus confirm the Elder Drake's
position is always real and queryable via `worldBossPos()`. Sample 600
frames across several legs: no frame-to-frame jump bigger than its
speed × dt, including straight after combat ends. A respawn is a fresh
appearance and must land exactly on `drakeRoamHome(now)`.
`drakeRoamHome` gives the same answer for the same time on two separate
evaluations. Over 200 consecutive legs the Drake never enters a Safe
Zone. The Volcano's Demon Knights and the Drake's loot are unchanged.
Also confirm the bounty
board's target rotates on the stated real timer and the bonus reward
only triggers for the currently-active bounty species specifically.

---

## QUEUED, AFTER WORLD ENCOUNTERS — do not build until every spec above ships.
## Confirmed, locked spec for a future version (Real Stakes — Weather, Death Weight & Raid Alerts)

**What exists now (checked 2026-10-12):**
- There is **no weather system** (the only "storm" in the code is the
  Storm Dragon).
- Death already drops your whole pack (`dropAllItems()`, tagged with the
  space you died in), and the death overlay only says "Slain by X".
- A raid already broadcasts `base_hit` and `base_destroy`, but the owner
  gets no alert: the receiver just updates hp and flashes the piece.
  Pieces carry `owner`.

**Rules for this run:**
- All respawn timers stay exactly as they are, including the Hollow
  Choir's 0 s, which was the owner's explicit design.
- No new tables. Everything new is a client feature or derived from data
  that already exists.

**PART A — Shared weather, with no network.**
- **Shared by computation:** weather is computed from
  `hash(worldSeed, weatherSlot, regionX, regionY)`, so every player sees
  the same weather without a network message.
  - `weatherSlot = floor(seconds since worldEpoch / WEATHER_SLOT_S)`,
    with `WEATHER_SLOT_S = 300`, half a game day.
  - Regions are `WEATHER_REGION = 256` tiles square.
  - Both are tunables.
- **Weather types,** chosen by the biome under the player:
  - **Clear:** most slots, at least 55% overall.
  - **Rain:** FOREST, PLAINS, MEADOW, ENCHFOREST, SACMEADOW. Mobs'
    `aggroRadius` is −25% because rain hides your steps. Apply it the same
    way `BLOOD_MOON_AGGRO_MULT` is applied.
  - **Fog:** DARKFOREST, plus RUINB at night. A flat dark overlay at
    alpha 0.28. Mob `aggroRadius` −40%. Other players' name plates are
    hidden beyond 8 tiles.
  - **Ashfall:** VOLROCK, CALDERA, LAVA surroundings. 1 damage every 4 s
    unless the v58 fire-resist draught is active. Respect the safe-zone
    rule in `applyDamage`.
  - **Snow:** ROCK and PEAK. Movement −15% unless mounted.
- **Visuals:** a screen-space particle layer drawn after the world and
  before the HUD, capped at 160 particles (tunable): rain streaks, ash
  flecks, snow dots. Fog is one flat fill. No gradients.
  Read `runehaven-art-style/SKILL.md` first.
- **HUD:** the day card shows the weather after the time of day, for
  example "Day 433 — Morning · Rain". There is no weather inside
  interiors.

**PART B — Death has weight, with timers untouched.**
- **Death recap:** the overlay lists exactly what was dropped, for
  example "You dropped: 12 Wood, 3 Iron Ore, Iron Sword", using
  `ITEM_META` names. It reads the same list `dropAllItems()` built.
- **Your pack:** for 10 minutes (tunable), or until the pile is picked
  up, the compass and minimap show a "PACK" mark pointing to where you
  fell. It goes through the existing mark lists and is only visible to
  you.
- **A beacon everyone can see:** for 2 minutes (tunable), a faint light
  column rises over a fresh death pile, using the existing light/aura
  primitives. It is visible to everyone, so a death becomes a race.

**PART C — Raid alerts.**
- **When you're online:** when a `base_hit` or `base_destroy` arrives for
  a piece whose `owner === me.username`:
  - toast "Your base is under attack!" (at most once every 20 s,
    tunable);
  - add a "RAID" compass mark toward the piece for 60 s;
  - set the existing combat-music signal.
- **When you log back in:** after login, if you own pieces whose `hp` is
  below their full value, toast "While you were away: N base pieces were
  damaged". Full value comes from a new `basePieceMaxHp(p)` helper, using
  `BASE_TIER_HP` with the Architect bonus applied the same way the
  insert does.
- **Destroyed pieces** are counted against the number of pieces you
  owned at your last logout. Store that number in local storage under
  the username, with try/catch. It is per device; say so in a code
  comment.

**Proof gates** (standard gauntlet, plus):
- Weather is deterministic: two separate evaluations for the same seed,
  slot and region agree. The share of Clear across 2,000 sampled
  slot/region pairs is at least 55%. Each type only appears on its
  biomes.
- Ashfall damage stops while fire resist is active and never applies
  inside a safe zone.
- Snow slows by 15% unmounted and 0% mounted.
- Fog and rain aggro multipliers apply to mob aggro checks only.
- The particle count never goes over the cap.
- Death recap text matches the dropped list exactly. The PACK mark
  appears only for the dier and is removed on pickup or timeout.
- Raid toasts are throttled to the stated interval. A RAID mark appears
  only for the owner. The login summary counts damaged pieces correctly
  from stubbed rows.
- **Preservation:** every respawn timer gate (`RESPAWN_SECONDS`, the
  Hollow Choir 0 s) is unchanged. The existing `dropAllItems` and raid
  gates still pass.
