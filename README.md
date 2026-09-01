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

**Proof gates:** standard gauntlet plus confirm a fresh account with no
`guild_tier` set reads as tier 1 with no error, confirm each of the
five Tier 2 values is genuinely stronger than its Tier 1 counterpart
and only active at tier 2, confirm a redeem code carrying `_guildTier`
correctly raises but never lowers a player's stored tier, confirm
setting `guild_tier` directly in Supabase and relogging correctly
applies the upgraded buff.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
