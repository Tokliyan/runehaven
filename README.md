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

## Confirmed, locked spec for the next build (v47 — Balance, Anti-Exploit & Economy)

Everything on this version genuinely closes out the roadmap — no bible
system remains unbuilt after this, only World Expansion 4 and Demon
Knight (both deliberately deferred to their own version).

**PART A — pet spawn rates, increased across every tier.** Confirmed
live: Common sits at `base: 0.65`, Uncommon `0.35-0.50`, Rare `0.20-0.30`,
Epic `0.20-0.35`. Increase each tier by roughly +0.08-0.10, keeping the
same relative ordering between tiers intact — Common should never become
LESS common than Uncommon, etc. Elders and admin-exclusive species
untouched; this is about ordinary world density, not the tightly-capped
rare-pet daily system from Mob Rarity + Music, which stays exactly as
built.

**PART B — cave mob difficulty reduced.** Confirmed live: Troll
`hp:90, dmg:14`, Dark Wraith `hp:65, dmg:12` — both currently placed
inside cave interiors. Reduce both roughly 25%: Troll to `hp:68, dmg:11`,
Dark Wraith to `hp:49, dmg:9`. Sea Serpent (UWCAVE-specific, not a
generic cave placement) is explicitly NOT part of this reduction — see
Part C, it moves the opposite direction.

**PART C — some mob health increased, by judgment: the tougher
overworld/underwater mobs, not the cave ones just made easier.**
Confirmed live: Sea Serpent `hp:130`, Adult Golem (check live value at
build time, not assumed). Increase Sea Serpent to `hp:165`, Adult Golem
by a comparable ~25%. These are deliberately NOT the same creatures as
Part B — the two changes must not cancel each other out on any shared
species.

**PART D — base HP doubled per tier, and genuinely harder to
penetrate.** Confirmed live: `BASE_TIER_HP = { wood:40, stone:90,
iron:180, runic:350, dragonsteel:800 }`. Double every value:
`{ wood:80, stone:180, iron:360, runic:700, dragonsteel:1600 }`. "Harder
to penetrate" beyond raw HP: confirm attack cooldown/damage-per-hit
against a piece hasn't silently made this a non-change in practice —
the doubled HP should translate to roughly double the real time/hits
needed to destroy something, verified with the math, not just the
constant changed.

**PART E — combat-logout, honestly scoped to what a browser can actually
enforce.** Confirmed live: `beforeunload` currently only calls
`savePlayer()` — no warning, no friction, no penalty. A website cannot
force a tab to stay open against the user's will; the real, available
mechanism is the browser's native `beforeunload` confirmation prompt.
If the player has dealt or taken damage within the last 30 seconds,
attach a `beforeunload` handler that triggers this native prompt
("changes you made may not be saved" is the browser's own wording, not
customizable). This adds real friction and a moment's warning to an
opponent, which is the honest ceiling of what's achievable — do not
build anything that claims to fully prevent leaving, that would be a
false promise no client-side code can keep.

**PART F — drop items directly to another player.** New interaction:
standing within gather range of another player, an interact option opens
a give panel — pick an item and quantity from your own inventory,
confirm, it transfers directly into their `inventory` field the same way
`invAdd`/`invRemove` already work internally, broadcast so their client
reflects it immediately. No approval step required, matching the bible's
low-friction "trades happen at players' own risk" philosophy already
used for ground trading at the Bazaar.

**PART G — base signs.** A short text label, settable by the owner
only, attached to a Foundation piece specifically (the anchor every
other piece already requires) and rendered above the base the same way
a player's own name already renders above their character. Reuse the
existing name-rendering technique, don't invent a second one.

**PART H — redeem code system.** New Supabase table:
```sql
create table redeem_codes (
  code text primary key,
  items jsonb,
  uses_left integer
);
create table redeem_claims (
  code text,
  username text,
  primary key (code, username)
);
```
A second field on the login screen, below the Enter The World button —
enter a code, submit. Looks up the code, checks `redeem_claims` to
confirm this username hasn't already claimed it, grants the items in
`items` directly to inventory on next login, decrements `uses_left`,
records the claim. Must degrade gracefully if either table doesn't
exist yet — same fallback discipline as every other new table this
project has ever added.

**Proof gates:** standard gauntlet plus confirm every tier's spawn rate
increased while preserving relative tier ordering, confirm Troll/Dark
Wraith are genuinely easier while Sea Serpent/Adult Golem are genuinely
harder (not the same creatures moving both directions), confirm base HP
doubled and the real time-to-destroy roughly doubled with it, confirm the
beforeunload prompt only fires within the 30s combat window, confirm
player-to-player item drop writes to the recipient's real inventory,
confirm base signs render only for pieces that have one set, confirm
redeem codes cannot be claimed twice by the same username and degrade
gracefully with no tables present.

**Explicitly not this version:** World Expansion 4, Demon Knight, the
minimap 3x expansion, spawn safe zone resizing, and cave barrier
changes — all either deferred to v48 or still waiting on clarification.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
