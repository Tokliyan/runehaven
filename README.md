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
   - `node debug/run6.js runehaven.html` — browser gates (ground-cache pixel
     match and frame rate): all `PASS`; prints `skipped` and passes when
     Playwright/Chromium is not installed (added with the Performance spec)
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
9. **Report to the Night Run — before ending ANY session, including a RED
   stop or a "nothing to build" night.** This is how the owner sees the
   result: BUILD_FAILED.md on a side branch is invisible to him (14 straight
   RED nights on World Encounters, 28 Sep–11 Oct, never reached him). POST to
   `https://jarvis-aio.onrender.com/api/nightrun/report` with header
   `Authorization: Bearer $NIGHT_RUN_TOKEN` and JSON:
   `{"section":"runehaven","status":"ok"|"warn"|"fail","summary":"1-2 plain sentences: version shipped, or exactly what blocked it","needs_you":["short owner actions, under 70 chars each"],"details":{"version":"","branch":"","pushed_to_main":true,"review":"the step 0b doubt-pass verdict (the fresh-context review)","judgment_calls":[],"blocker":""}}`.
   Shipped clean → `ok`; shipped with YELLOW judgment calls or not on
   `main` → `warn`; RED → `fail` with the blocker in `needs_you` (e.g. "Add a
   2nd Boss-tier creature to the bible for World Encounters"). The server may
   be asleep: if the first call times out, wait 30s and retry once. If
   `NIGHT_RUN_TOKEN` is not set, skip this step and say so in the commit
   message; never fail a build over it.

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

**SHIPPED 2026-10-13** in the owner-started gauntlet session (stage 1): saved patch + OWNER DECISIONS + two doubt-pass cycles; run4 1800 PASS / 0 FAIL. See the art-style skill's 2026-10-13 changelog entry for the judgment calls and the YELLOW live-world note.

### OWNER DECISIONS (2026-10-13) — these OVERRIDE the parts below wherever they conflict

Harsh read the 2026-10-12 BUILD_FAILED.md and delegated every open game
decision to the builder ("use your discretion to make the game as good as
possible"). The four blockers are therefore decided as follows. This is
authorisation to make exactly these changes; it is not blanket permission
to touch anything else on the art-style skill's MUST-NOT-REGRESS list.

1. **Land test gets an upper bound.** Use the band already in the file,
   `isPlaceableLand()`'s `e >= 0.44 && e < 0.84`, instead of a bare
   `elevRaw >= 0.42`. A candidate passes only if every tile in the disc is
   inside that band. Reuse, don't invent a new constant.
2. **COLOSSEUM gets a MOUNT separation** in its attempt loop, the same
   distance the volcano separation already uses (copy that constant).
3. **Clearing guard set grows**: `B.RUINB`, `VOLROCK` and `CALDERA` join the
   guards in the arena clearing, and the Bazaar's identical line gets the
   same additions. Also add the Colosseum to the ruin-candidate checks in
   `placeRuinsAndZones()` so a Ruin is never placed over it. The hand-
   composed Ruin is never altered.
4. **Dark Forest (PART H) is intended, but gentler**: lower only
   `clusterNoise`, keep `h` at 0.42 so the clump structure and clearings
   stay. Aim for a visibly denser forest *with* clearings, not a uniform
   scatter. Re-measure; if the density gain is under ~+10 points over Forest,
   lower `clusterNoise` a little more rather than touching `h`.
5. **Decor keepout (blocker 3):** add the Bazaar's existing keepout to the
   Colosseum in both decor branches of `buildFeatureChunk()` (and the
   PLAINS-decor loop). Target: 0 bushes/pebbles/flowers inside the arena.
6. **Two small fixes:** reset `landmarkLandFrac` at the top of
   `placeLandmarks()`, and correct the three wrong radius comments
   (`LANDMARK_KEEPOUT` = `COLOSSEUM_R + 2`, `inColosseum()` = bare
   `COLOSSEUM_R`, sand floor at `COLOSSEUM_R * COLOSSEUM_WALL_RING`).
7. **Gate:** after these changes, measure over >=40 seeds that the arena is
   never on a >50% ROCK/PEAK mass and never within the Mount's footprint,
   and add that as a permanent run4 gate.

**How to resume:** the finished-but-unshipped work is on the remote branch
`claude/stoic-tesla-22bq3v` as `WORLD_CHECK_FIXES_blocked.patch` (1,343
lines). `git fetch origin claude/stoic-tesla-22bq3v`, then
`git show origin/claude/stoic-tesla-22bq3v:WORLD_CHECK_FIXES_blocked.patch | git apply`,
make the changes above, re-run the full gauntlet (run3, run4, run5), and ship
if green. Delete `BUILD_FAILED.md` handling is not needed on main. Report
to the Night Run as usual (step 9).

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

**DEFERRED — owner decision 2026-10-15:** not needed for now. The spec stays
locked here, unbuilt; NEXT_BUILD.md skips it until the owner says otherwise.

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
**Owner decision 2026-10-15:** Mobile & Touch is deferred (above), so this
queue gate is lifted — the spec below is next.
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
  **Owner decision 2026-10-21: the bar is 1.2×, not 1.4×.** Measured at
  build time (headless, same session): cache on 1.22–1.34× cache off. Drawing
  NO ground at all — the most any ground cache could give — measured anywhere
  from 1.39× to 1.69× across runs (the Colosseum's S2 stone pieces now carry
  much of that frame), so 1.4× sits at or past the ceiling on some runs; the
  rest of the gap is the cost of blitting the chunks and of the S2 seam
  underlay. Against the previous build the frame rate rose +25% to +142% at
  the four tour views. run6 prints the no-ground ceiling beside each ratio
  so the gap stays visible.
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

**DEFERRED — owner decision 2026-10-15:** not needed for now; no
`supabase_s5.sql` is written. The spec stays locked here, unbuilt.

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
**Owner decision 2026-10-15:** Mobile & Touch and Account Security above are
deferred, so they do not hold this queue — the spec below is next.
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

---

## QUEUED, AFTER REAL STAKES — the next build.
## Confirmed, locked spec for the next build (Front Page Rework — Title Screen, Character Select & Settings)

**Owner request (2026-10-22):** rework the front page entirely, in a
AAA-game style. The two reference images the owner gave were Thronefall's
Settings screen and its upgrade tooltip:
- the Settings screen has a large blackletter title, a tab row in widely
  spaced italic small caps with the active tab shown as "-GAMEPLAY-",
  italic serif option labels with small square checkboxes on the right,
  and a faint destructive action at the bottom;
- the tooltip is a dark rounded card with a blackletter heading, a
  small-caps subheading, serif body text, and a row of round icon badges.

This ships as a **major update for all players**. It is front-end only:
no gameplay, network, database or HUD-in-world change of any kind.

**What exists now (checked 2026-10-22):** after the intro card
(`#introCard`, "Hashbrown Studios … presents RuneHaven"), `#login` is one
centred column:
- the "RUNEHAVEN" heading, the tagline and `#settingsBtn`;
- the `#username` box (plus `#pinInput`, `#pinNotice`, `#pinProtect`);
- `#classRow` with 5 `.class-card` boxes;
- the `#connectBox` details;
- `#resumeNotice`, `#loginError` and `#enterBtn`;
- `#redeemRow` and `#redeemMsg`.

Fonts come from one Google Fonts `@import` (Almendra Display and Barlow).
The Settings overlay (`#settingsOverlay`) is a generic dark dialog with
boxed ON/OFF buttons.

**Rules for this run:**
- **Behaviour is untouched.** Every existing element id keeps its id, its
  element type and its handler. That covers `#login`, `#username`,
  `#pinInput`, `#pinNotice`, `#pinNoticeX`, `#pinProtect`, `#classRow`,
  `.class-card` (same 5, same order, Beastmaster 4th), `#connectBox`,
  `#sbUrl`, `#sbKey`, `#connDot`, `#resumeNotice`, `#resumeCancel`,
  `#loginError`, `#enterBtn`, `#redeemInput`, `#redeemBtn`, `#redeemMsg`,
  `#settingsBtn` (still a child of `#login`), `#settingsOverlay`, every
  `#sec*` section, every `#set*`/`#sld*`/`#val*`/`#btnMute*` control, and
  `#introCard`.
- The settings toggle buttons keep their `ON`/`OFF` text content, because
  gates read it. They may be *drawn* as checkboxes with CSS.
- The ENTER flow, the PIN gate order, the resume pause, the redeem path, the
  one `AudioEngine.init()` call site and the intro rules
  `body.intro-hide #login { opacity: 0; }` /
  `body.intro-exit #login { transition: opacity 700ms` stay byte-identical.
- Re-parenting elements into new wrappers is fine. Changing what they do is
  not.
- No new files. The game stays one HTML file.
- **Fonts:** extend the existing `@import` with **Grenze Gotisch**
  (700–800; display/blackletter) and **Cormorant Garamond** (500, 600, 600
  italic; menu and body). The in-game HUD keeps Barlow. Nothing
  in-world changes font.
- Read `runehaven-art-style/SKILL.md` first. The in-world art direction is
  locked. This pass is the menu layer only.
- Desktop widths 1024–2560 must look right. Phones are not a target (S3
  dropped), but nothing may overflow or become unreachable at 1024×640.

**PART A — Design tokens.** Add one CSS block of `--menu-*` custom
properties, and use them for everything in this pass:
- ink `#e9dcc0` (parchment text), dim `#9b917d`, faint `#5e574b`;
- gold `#e8b64c` (the game's existing gold: active, hover and focus only);
- panel `rgba(18,19,23,0.94)`, card `#16171b`, card edge
  `rgba(233,220,192,0.10)`, radius 14px;
- `--menu-display: 'Grenze Gotisch', 'Almendra Display', serif` and
  `--menu-serif: 'Cormorant Garamond', Georgia, serif`;
- small caps style: `font-variant: small-caps` or uppercase with
  `letter-spacing: 0.32em` at 12–14px.

There are no new colours outside these tokens. Fallback fonts must still
read well if Google Fonts is blocked.

**PART B — The title screen (the first thing after the intro card).**
- **Layout:** full-bleed. The logo **"RuneHaven"** is in `--menu-display`
  at ~96px (clamp 64–112px), parchment ink with one soft dark drop shadow
  (no gold glow), set top-left with generous margins (≈8vw left, ≈10vh
  top). The tagline sits beneath it in spaced small caps, dim: "ONE WORLD
  · ONE HISTORY · SHARED BY ALL".
- **A vertical menu at the left, under the logo:** **Play**, **Settings**
  (this IS `#settingsBtn`), **Redeem a Code**, **Credits** (opens the
  Settings overlay on its Credits tab).
  - Items are `--menu-serif` italic ~26px, dim.
  - Hover and keyboard focus turn an item gold and frame it with dashes:
    "– Play –".
  - ↑/↓ move the focus, Enter or Space activates, and Esc steps back.
  - The first item has focus on arrival.
  - Every item is a real `<button>`, so S8's click sound covers it once
    audio exists.
- **Bottom-left:** the update banner, small caps, dim. Its text is
  `UPDATE_NAME` (TUNABLE const, default "THE REFORGING UPDATE") plus the
  version.
- **Bottom-right:** the world status. It reuses `#connDot`'s state as
  "World connected" or "Connect your world", and clicking it opens the
  Connect panel (PART D).
- **"What's new":** a small card (PART E style) shows the 5 headline
  changes of this update:
  - the roaming Elder Drake and Bounty Board;
  - weather;
  - death and raid stakes;
  - combat feel and sound;
  - the new front page.

  It shows once per device per `UPDATE_NAME` (localStorage key, in a
  try/catch). It can be dismissed with ✕ and reopened from a small "What's
  new" link.

**PART C — The backdrop (live world, with a safe fallback).**
- **Goal:** behind the title screen, the real world drawn by the game's own
  renderer, with the camera drifting slowly (≈2 tiles/s) along a fixed
  scenic path near Spawn and the Eternal Tower. On top of it go a flat dark
  vignette (left 70% darker, so the menu reads) and a flat
  `rgba(10,10,12,0.35)` wash.
- **Constraints:**
  - nothing is sent or saved;
  - no `players` row, no channel and no Supabase call happen before ENTER,
    exactly as now;
  - any stand-in camera/spectator object exists only on the title screen
    and is gone before `loginPlayer` runs;
  - no HUD card shows over the menu;
  - the menu loop stops the instant ENTER starts, and the game loop starts
    exactly as today;
  - it runs at least 30 fps headless at 1280×720 (measure, the run6 way).
- **Fallback:** if the renderer can't run safely before login (it reads `me`
  in many places; that is the build's call after reading it), ship a
  **static fallback** instead. That is a flat dark field with the same
  vignette, and slow drifting gold motes drawn on a small canvas, capped at
  40, off under Reduce motion. Report the fallback as YELLOW with the
  reason. Never ship a backdrop that can break login.

**PART D — Character select (after Play).** A second state of the same
screen. The logo shrinks to the top-left, a "← Back" text button returns to
the title, and Esc does the same. Contents:
- **Name:** `#username` as a borderless underlined field, `--menu-serif`
  italic ~28px, with the placeholder "Your name". `#pinInput`,
  `#pinNotice` and `#pinProtect` sit directly beneath it in the same
  style, with all their logic unchanged.
- **Class cards:** the 5 `.class-card`s are restyled as PART E cards:
  - the class portrait (the existing drawn sprite, scaled up crisply with
    `image-rendering: pixelated` where it is a canvas or image);
  - the class name in `--menu-display`;
  - the role line in spaced small caps;
  - the description in serif;
  - "Best with …" in dim italic;
  - a row of three round badges for that class's strengths (simple flat
    glyphs in CSS or inline SVG, no image files).

  The selected card lifts 6px with a gold edge. The others stay dim.
  ←/→ change the selection when the name field isn't focused.
- **Connect your world:** `#connectBox` shows here only while the world
  isn't configured (`#connDot` not green), or when it is opened from the
  title's status link. Restyle it as a card and keep its fields and hint.
- **The big action:** `#enterBtn` reads "– Enter the World –" in
  `--menu-display` ~30px with a gold underline bar. `#resumeNotice` and
  `#loginError` sit directly above it, restyled in the card language.
- **Redeem:** `#redeemRow`/`#redeemMsg` move behind the title screen's
  "Redeem a Code" item, shown as a small card on this screen. Redeeming
  keeps working before login exactly as now; the input and button keep
  their ids.

**PART E — The card and the Settings overlay (the reference look).**
- **One card component** (`.menu-card`) styles the What's new card, the
  class cards, Connect, Redeem and the in-overlay notes: `--menu-card`
  fill, 14px radius, 1px card-edge border, 18–22px padding, a
  `--menu-display` heading, a spaced small-caps subheading and a serif body.
  Round badge row: 40px circles with a 1.5px ink ring, and the active one
  is filled ink with a dark glyph, as in the reference.
- **`#settingsOverlay` becomes a full-screen page in the reference's
  style:**
  - a near-black panel;
  - a "Settings" title in `--menu-display` ~56px, ink;
  - the existing tabs restyled as a row of widely spaced italic small caps
    (dim), with the active tab gold-free ink and bold, framed with dashes:
    "-GRAPHICS-";
  - option rows as italic serif labels (~17px, ink) with notes beneath in
    dim serif;
  - the ON/OFF toggles drawn as 14px squares, with an empty outline for
    OFF and an inner filled square for ON (text kept, visually hidden);
  - sliders as a thin ink line with a small square thumb;
  - "Reset" actions faint until hovered;
  - Close as an "– Close –" text button, plus Esc.
- Keyboard: Tab order is sane, the focus ring is a visible 1px gold
  outline, and nothing is reachable only by mouse.

**PART F — The intro card.** Keep its timing, its skip (Escape or click)
and its two lines ("Hashbrown Studios", "in collaboration with STG Records
presents"). Set "RuneHaven" in `--menu-display`. The intro then hands off
to the title screen with the existing fade. The title screen fades in, and
does not pop.

**Proof gates** (standard gauntlet, plus):
- **Preservation:**
  - every id listed above exists exactly once, with the same element type;
  - `#settingsBtn` is still a child of `#login`;
  - `.class-card` count is 5, with Beastmaster 4th;
  - the harness login (`.class-card`[3] click → `#username` →
    `#enterBtn.onclick()`) still enters the world;
  - every existing run4 gate passes unmodified, unless the change is a
    pure text-pin rename, which must be listed with its reason;
  - `AudioEngine.init()` is still at exactly one site.
- **States:**
  - title → Play → character select → Back → title, and Esc, all work;
  - ↑/↓/Enter drives the title menu;
  - Credits opens the overlay on `#secCredits`;
  - Redeem shows the redeem card;
  - the status link opens Connect;
  - What's new shows once per `UPDATE_NAME`, then stays dismissed after a
    reload, and reopens from its link.
- **Settings:**
  - every toggle still reads `ON`/`OFF` and flips its setting;
  - each square shows checked exactly when its setting is on (computed
    style or class);
  - the active tab shows the dashes;
  - Esc closes.
- **Backdrop:**
  - before ENTER: no `players` request, no channel and no `sb` call
    (stubbed and counted);
  - `me` is null again (or never set) when `loginPlayer` starts;
  - no `.hud` card is visible over the title;
  - the menu loop stops at ENTER;
  - fps ≥ 30 headless, or the static fallback is shipped and reported
    YELLOW;
  - motes stay at 40 or under, and at 0 under Reduce motion.
- **Fonts:** the `@import` names Grenze Gotisch and Cormorant Garamond, and
  menu text uses the `--menu-*` font tokens. No new colour literal is used
  outside the token block in the new CSS. Count hex/rgba literals in the
  added CSS against the token list.
- **Visual:**
  - screenshots at 1280×720 and 1920×1080 of the title, What's new,
    character select with a class picked, Connect open, Redeem open, and
    Settings on each tab;
  - the same at 1024×640: nothing overlaps or clips (bounding-box check of
    every visible menu element against every other);
  - score the shots against GAUNTLET.md's "UI is one cohesive style, never
    overlapping".
- **Release:** a "What's new" entry list exists, and its 5 lines match the
  shipped features above.

**After this version ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated.

## LOCKED 2026-10-24 — the owner approved the 6-session plan below ("start with 1 now").
## Spec for a future version (The Living World — Pixel Art, Scale, Motion & Action)

**Owner request (2026-10-23):** "I like what's in it, but it's just not
speaking to me. Something's missing; overall it isn't grand enough for such
a sick adventure game." The owner wants constant motion, characters and
buildings big enough to be alive and show what they're doing, and a pixel
look.

**Diagnosis (live build `d404630`):**
- **Everything is tiny.** Actors are about 40 px tall in a 1280×720 view
  that shows about 60 tiles across.
- **It's soft on Retina.** The canvas is drawn at CSS pixels, not
  `devicePixelRatio`.
- **Characters move but don't act.** There is a walk cycle, but no wind-ups,
  gather, cast, idle or death animations.
- **Towns are empty.**
- **The world doesn't move on its own.**
- **Big moments are unframed.**

### Owner decisions (2026-10-23)

- **D1: art style is pixel art, "B+".** That means finer pixels (about 80×100
  art pixels for a full-height character), up to 40 colours per sprite, and
  no outline. The no-outline rule stands. Reference images, both made from
  the real game code:
  - `docs/pixel-style-reference.png`, row "B+";
  - `docs/style-options-reference.png`.
- **D1 scope: the whole game goes pixel, in stages, with the owner's sign-off
  at each step.** Player characters and pets come first. Then mobs. Then the
  world one biome at a time; **each biome is merged only after the owner
  approves its before/after shots.**
- **D2:** default zoom 1.6×, adjustable from 1.0× to 2.2×.
- **D3:** yes to townsfolk NPCs, visual only.
- **D4:** no quality setting. Everyone gets the full version, so every stage
  has to hold frame rate on its own.

### How the pixel look is made: the Pixel Forge (no hand-drawing)

Everything already has procedural drawing code (`drawUnit`, `drawPet`,
`drawMob` / `drawWild`, `drawBox`, the ground pass). The Pixel Forge renders
that existing code, so every class, tier, weapon, armour, cosmetic and
animation keeps working automatically:
1. **Draw big.** The sprite is drawn into an offscreen canvas at 4× its
   final art resolution.
2. **Shrink to the pixel grid.** A box downsample takes it to the art grid.
   `PIXEL_ART_SCALE` is the number of screen pixels per art pixel at 1.0×
   zoom (B+ is about 1.25, so a 1.6× zoom gives about 2 px art pixels and a
   2.2× zoom about 2.75 px).
3. **Clean it up.** Alpha becomes either solid or clear (threshold 100/255),
   so there are no half-transparent edges. Colours are reduced to at most
   40, using a median-cut palette per sprite that is cached.
4. **Cache it.** The result goes in an LRU sprite cache keyed by everything
   that changes how it looks (class, tier, weapon kind, armour tier,
   cosmetics, facing, animation state, frame). There is a hard memory cap. A
   miss draws the old way that frame and bakes in the background, so nothing
   ever blanks.
5. **Draw crisp.** Sprites are drawn with `imageSmoothingEnabled = false` at
   whole-art-pixel positions, so pixels stay square and never shimmer.

### LOCKED 2026-10-26 — Living World v2: Cities & a Lifelike World (owner: "large cities, better quality and a lifelike world that can be done within weeks")

Supersedes sessions 4–6 of the plan below. Target: about 4 weeks at ~1.5 sessions a week. ★ = the owner approves GIFs before merge.

| Session | Week | Contents | Status |
|---|---|---|---|
| **4** ★ | 1 | **Pixel biomes, batch 1** — Plains, Meadow, Forest, Dark Forest, sand and coast through the forge (outline, light, shade). **Wind:** grass and trees sway. One `PIXEL_BIOMES` switch per biome; each approved on its own. | next |
| **5** ★ | 1–2 | **Pixel biomes, batch 2 + buildings** — Enchanted, Sacred, Snow, Volcano, caves; every building and landmark forged (Spawn Forge, Bounty Board, Oracle, Eternal Tower, ruins). Lava glows and flows; snow drifts. | |
| **6** ★ | 2 | **The Capital: Spawn Vale becomes a walled city** (below). | |
| **7** ★ | 3 | **Frontier towns and roads** — Emberhold (volcano edge) and Frostgate (snow edge), each with an inn, smith, notice board and a local merchant; cobbled roads joining them to the Capital; each town a fast-travel point and a safe zone. | |
| **8** ★ | 3 | **City life** — named townsfolk with daily routines, guards on patrol, an opening and closing market, lamps and lit windows at night, chimney smoke, cats, dogs and birds, children who chase pets; the existing weather drawn properly (rain on roofs, snow on streets, ash at Emberhold). | |
| **9** | 4 | **Feel and grand moments** — heavier hits (hit-stop, dust, shake through the setting), title cards on entering a city, town or landmark, the Elder Drake's boss intro, and the **Tower Awakening** world event. | |

#### The Capital (session 6)
- **Size and shape:** about 40×40 tiles centred on today's spawn, inside a stone wall with four gates (N/E/S/W). Today's Spawn Forge, Bounty Board and Oracle keep their places and become part of it.
- **Districts:** Market Square (stalls, a fountain, the bounty board), Smithy Row (the Spawn Forge, an armourer), Guild Row (one hall per real guild, flying its badge and colour), the Temple of the Oracle, homes (lit windows at night), and a Keep at the top of the city.
- **Streets:** cobbled streets on a grid with lamp posts, signposts and banners. Buildings block movement; streets do not.
- **Rules:** the whole city is a safe zone; players cannot place base pieces inside the wall; mobs and wilds never spawn inside it.

#### Design rules for v2 (they keep it doable in weeks)
- **No new SQL.** Cities, towns and roads are generated from the world seed on every client, so everyone sees the same city without new tables.
- **Townsfolk are clock-driven.** Each one's position comes from the shared world clock and their schedule, so every player sees them in the same place with nothing synced over the network.
- **Everything through the forge.** New buildings, stalls and townsfolk are procedural art baked by the Pixel Forge, with the finish (outline, light, shade, ≤ 40 colours).
- **Performance stays a gate.** City ground goes through the ground-chunk cache; frame rate at the Capital must stay within 0.9× of today's spawn figure on desktop, and the mobile layout must still fit.
- **Process unchanged:** gates only rise, one Opus review per session, run3–run6 green before merge, the owner redeploys on Render.

#### Not in v2 (parked, not cancelled)
Flying mounts and the sky layer, airships, guild-built cities and sieges, lava that reshapes the map, and the App Store wrapper (a separate track once touch play is polished).

### The 6-session plan (owner-approved 2026-10-24; this supersedes the P-stage order below)

| Session | Contents | Status |
|---|---|---|
| **1** | P1: zoom, device pixels, camera | **SHIPPED** (see the changelog) |
| **2** ★ | P2: Pixel Forge plus player characters and all their actions | **SHIPPED** (owner-approved GIFs, 2026-10-24) |
| **3** ★ | P3 + P4: pets and all 27 mobs, through the same forge | **SHIPPED** (owner-approved design + in-game GIFs, 2026-10-25) |
| **4–9** | superseded 2026-10-26 by "Living World v2 — Cities & a Lifelike World" below | see below |

- **Batch approval.** In sessions 4 and 5 each biome is its own `PIXEL_BIOMES` switch. The owner approves or rejects each one from before/after GIFs during the session, and only approved ones merge.
- **Cut to fit:** windmills and water wheels, footprints, the dawn/dusk colour sweep, and run frames separate from walk frames.
- **Token discipline:**
  - A fresh chat per session.
  - Opus builds; Haiku explores; Sonnet writes gates and scores.
  - One Opus review per session.
  - One screenshot check per stage.

### Session 3 design (owner direction 2026-10-25; APPROVED and SHIPPED 2026-10-25)

Previews were rendered from the real game art: `mobs3.gif`, `pets3.gif`, `heroes3.gif` and `pet-families.gif`, all sent in chat.

**Look (final).**
- **Fine pixels.** One art pixel = one screen pixel at the 1.6× default. That is half the earlier size, so today's detail survives: eyes, teeth, wing ribs.
- **The pixel-art finish:**
  - an outline in each sprite's own darkened hue (never flat black);
  - a 1 px highlight on top-left edges and shade on bottom-right edges;
  - speckle clean-up;
  - at most 40 colours.
- **Scope.** It applies to mobs, pets, wild creatures AND the player classes, so the whole cast matches.

**Living motion.** The creature's own animation clock keeps running through every action, so wings flap, tails swish and embers drift. A state never freezes it.

**Mobs (all 15).**
- States: idle, walk, attack (crouch wind-up → lunge with stretch → overshoot → settle), hurt (white then red flash, knockback squash), death (flash, pop, fall with a bounce and dust, then an ordered-dither dissolve).
- Two-legged mobs topple backwards; beasts flop onto their side.
- Humanoid mobs (goblin, bandit, troll, Demon Knight, Dark Wraith) get the player arm rig, so their weapon swings.
- Big ones (Elder Drake, golems, Demon Knight) get heavier timing and a stomp shake that respects the shake switch.
- Styled FX: a tapered two-tone slash smear, a gold impact star on the hit frame, two-tone dust clouds.

**Pets and wild creatures — every family moves differently** (owner: "differentiation and uniqueness for everything so it feels like the world is alive").

| Family | Members | Moving | Attack | Happy |
|---|---|---|---|---|
| Dragon | fire/water/storm/shadow, Dragon Elder | flies: hovers on fast wing beats | rears back, breathes its element (fireballs / water jet / lightning bolt) | NONE (owner: no happy for dragons) |
| Flier | griffin, phoenix | glides with speed streaks | rises, then dives in a swoop with smear, star and dust | spirals up |
| Canine | wolf, shadowfox, lightfox, Duskfox Elder | bounding run | crouch → leap arc → bite on landing | sits and howls (sound rings) |
| Equine | unicorn, stag, Unicorn Elder | high-stepping prance | rears on its hind legs, stamps with a horn sparkle burst | sparkle trot |
| Golem | golem, crystal golem, Golem Elder | lumbering steps, a dust puff each footfall | overhead slam with a ground shockwave ring | stomp dance |
| Sprite | tree/water/stone/wind sprites | floats and bobs | — (no combat role) | twirls upward |
| Moth | glow moth | erratic flutter | — (no combat role) | loop-the-loop |
| Serpent | basilisk, krakenling, salamander king | slithers in waves | coils, strikes, spits venom | sways |
| Beast | bear, boar | heavy trot | bear: standing swipe; boar: head-down charge with a dust trail | bear sits up; boar snuffles |

**Rules the owner set (and memory records):**
- **Pets that don't fight get NO attack animation.** The attack set is exactly the `PET_COMBAT` roster: wolf, bear, boar, griffin, golem, stag, phoenix, shadowfox, unicorn, lightfox, the four dragons, crystal golem, basilisk, krakenling, salamander king. Re-check the live table when building.
- **Happy is for every family EXCEPT dragons.**
- **Every species gets a unique idle "life" beat** on top of its family, so no two read the same. For example:
  - the wolf sniffs the ground; the shadowfox flicks between shadows; the lightfox's tail glints;
  - the unicorn grazes; the stag lifts its head and listens;
  - golems' runes pulse; the crystal golem refracts a glint;
  - sprites orbit their element; the glow moth circles the nearest light;
  - dragons puff smoke or steam and look around; the storm dragon crackles;
  - the basilisk flicks its tongue; the krakenling waves a tentacle;
  - each guild companion gets its guild's motif.
- **Combat is unchanged.** Stats, AI, damage, ranges, taming and the timing of wind-up warnings stay exactly as they are; the animations sit on top of the existing timers.

### Stages (each in one sitting, gauntlet rules; ★ = owner sign-off before merge)

**P1: camera, zoom and a sharp canvas.**
- **Zoom.** A world-layer transform: scroll or pinch between 1.0× and
  2.2×, defaulting to 1.6×, eased, and saved per viewer.
  - `worldToScreen`, IW2 / IH2 / HZ and depth by x + y stay untouched.
  - Picking divides by the zoom.
  - The HUD, plates and labels stay at screen scale.
- **Device pixels.** The backing store is `innerWidth × dpr` (dpr capped at
  2). The ground-chunk cache bakes per zoom bucket (1, 1.5, 2, 3, 4).
  - run6's pixel match runs at each bucket.
  - Frame rate is measured at 1.0×, 1.6× and 2.2× and must not drop at
    1.0×.
- **Camera.** A gentle look-ahead in the direction of movement.

**P2 ★: the Pixel Forge plus player characters that act.**
- The forge pipeline above, applied to `drawUnit` for every player, local
  and remote.
- New animation states, each with keyframed poses on the existing body
  parts and eased timing:
  - idle: breathing, a blink, a look-around, a fidget;
  - walk (8 frames) and run;
  - attacks per weapon kind, with a wind-up, the strike, a follow-through
    and a recovery. Hits land on the strike frame; combat timing and damage
    are unchanged;
  - cast, gather (chop, mine, pick), hurt, block, tame and death;
  - mount and ride;
  - emotes: wave, cheer and sit.
- The animation state rides on the move broadcast, so remote players
  visibly fight and chop too.
- The owner sees a GIF of every class doing every state before merge.

**P3 ★: pets in pixel.**
- `drawPet` and pet accessories go through the forge.
- Pets get idle, walk, happy hop (on feed), sit (when you idle) and alert
  (looking toward danger).

**P4 ★: mobs and wild creatures in pixel.**
- `drawMob` and `drawWild` go through the forge for all 27 species.
- They get idle, walk, attack with a readable wind-up, hurt and death.
- Big creatures (the Drake, golems, the Demon Knight) get heavy timing and
  an impact shake that respects the shake switch.

**P5 ★: the world, one biome per sign-off.**
- **How it works.** The S4 ground-chunk cache bakes the biome's tiles
  through the forge (draw at 4×, downsample, cap the colours). Trees, rocks
  and props in that biome are forge sprites. A `PIXEL_BIOMES` set records
  which biomes are converted, so a mixed world is a supported state at
  every step.
- **Order:**
  1. Plains and Meadow (what you see at spawn);
  2. Forest and Dark Forest;
  3. Sand and coast, with water;
  4. Enchanted Forest and Sacred Meadow;
  5. Snow and peaks;
  6. Volcano;
  7. caves and interiors.
- **For each biome**, the owner gets before/after shots of day, night and a
  border with an unconverted biome, plus a frame-rate figure. **Nothing
  merges without the owner's OK.**
- Then the buildings and landmarks (Spawn, Tower, Bazaar, Forge, Colosseum,
  Shrine), also ★.

**P6: living settlements.**
- NPCs through the forge, walking local-only scripted loops. Nobody else
  sees the same ones, so there's no network cost.
  - **Spawn:** a blacksmith with sparks, a guard patrol, villagers, and a
    child chasing a chicken.
  - **Bazaar:** merchants, browsers and a crier.
  - **Ancient Forge:** a smith quenching blades.
- **Buildings come alive:**
  - chimney smoke on every house;
  - doors that open as anyone passes;
  - windows that flicker at night;
  - windmill and water-wheel props;
  - laundry and banners in the wind.

**P7: a world in motion.**
- **Wind.** One wind field: a direction plus gusts that travel across the
  map. Everything that sways reads it, so a gust rolls across a meadow.
- **Ground cover.** Pixel grass and flowers on grassy tiles, bending with
  the wind.
- **Sky and wildlife.**
  - Cloud shadows drift over the ground.
  - Deer and rabbits graze and flee.
  - Fish jump, and birds rise from trees as you pass.
  - Butterflies come out by day and fireflies at night.
- **Small touches.** Ripples where anything walks into shallow water, and
  dust or footprints on sand and snow.

**P8: action feel.**
- **Resources.**
  - Each chop shakes the tree and throws chips; the last chop topples it,
    leaving a stump.
  - Ore cracks in stages.
- **Combat.**
  - Knockback and a white hit-flash (flat fill).
  - Damage numbers pop and arc; crits are gold.
  - Hit particles match the target.
  - Mob attacks are telegraphed with a ground marker.
- **Loot** fountains out and bounces, and pickups fly to you.
- **Level-up:** a pillar of light, a ring shockwave and a short slow-mo.

**P9: grand moments.**
- **Landmark discovery.** The first visit eases the camera out, shows a
  blackletter title card and plays a stinger. You can skip it, and it plays
  once per landmark (stored in the existing `cosmetics` JSON).
- **Boss intro.** The Elder Drake gets framing and a name-card slam.
- **Dawn and dusk.** A colour sweep, birdsong at dawn, and torches lighting
  one by one at dusk.

### Constraints
- **Art style.** The locked art-style skill gets a new "Pixel layer" section
  when P2 ships; the owner approved this direction on 2026-10-23.
  - No outlines (B+ is outline-free).
  - No new gradients.
  - PAL stays the colour source; the forge only reduces colours, it never
    invents new hues.
- **Projection.** It stays as it is; zoom is a transform on top.
- **Gameplay.** Every number stays the same; animation is presentation only.
- **Frame rate.** It may not drop below today's run6 figures at 1.0× at any
  stage (no quality toggle to fall back on).
- **Gates.** They only go up, and every stage adds its own gates and
  mutation checks.

### Estimated effort
About 13–15 sessions. P1 takes 1 session, P2 takes 2–3, P3 takes 1 and P4
takes 2. P5 takes about 7 short biome sessions plus 1 for buildings. P6, P7
and P8 take 1 each, and P9 takes 1.

**After this version ships successfully, do not start any further version
automatically.** Wait for `NEXT_BUILD.md` to be updated.
