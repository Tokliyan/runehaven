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

## Confirmed, locked spec for the next build (Mob Rarity + Music)

Revised after a genuine RED — the original PART C gave Rare/Epic pets a
bigger multiplier than the Elders, closing the size gap Tuning/Polish had
just established. Caught empirically, not by arithmetic: the failed build
built both ends of every range on a scratch copy and proved even the best
legal value left Unicorn Elder virtually the same size as a plain
Unicorn. Fixed below. PARTS B/D/E were independently verified clean
against the live file — unchanged from the original spec.

**PART A — real population caps, world-wide, with genuine persistence.**
New table, `rare_takes` — same house pattern as `base_pieces`, small SQL
step:
```sql
create table rare_takes (
  id bigserial primary key,
  species text,
  day_num integer,
  taken_at timestamptz default now()
);
```
A wild Rare-tier-and-up species (dragons, Crystal Golem, and above)
counts as "taken" for the day the moment it is EITHER successfully tamed
OR dies while still wild — both remove it from the world's available
pool, matching the bible's own framing ("once a pet goes... it's gone").
**Once a creature is tamed, anything that happens to it afterward —
including another player killing it for its dragonsteel — does not
return a slot to the pool.** That slot was already spent the day it was
first taken; the PvP-dragon-killing mechanic is a separate, already-built
system and must not interact with this cap at all. Query the day's take
count per species before allowing a new wild spawn; once at cap, that
species does not spawn again until `worldDayNum()` advances. Code must
degrade gracefully if the table doesn't exist yet — same fallback
discipline as every prior new column (v25, v33, v34): treat a failed
insert/select as "no takes yet today" rather than throwing.

**PART B — Griffin and Shadowfox, corrected to their real tiers.**
Confirmed live: both sit at `base: 0.35`. Uncommon tier-mates run
0.40-0.50 (Griffin -> 0.42, exact fit). Epic tier-mates run 0.20
(Shadowfox -> 0.20, exact fit). No existing run4 assertion pins either
value. Basilisk remains genuinely unbuilt (needs Dungeons) — not this
version.

**PART C — every pet gets bigger, Elders get their own band so the gap
survives.** Common: 1.15-1.25x. Uncommon: 1.3-1.4x. Rare: 1.5-1.65x.
Epic: 1.7-1.85x. **Elders get a dedicated band, not a percentage bump on
top of Tuning/Polish's numbers**: `golem_elder: 4.05, dragon_elder: 3.60,
unicorn_elder: 2.78` — landing +51%/+48%/+35% over their Tuning/Polish
values, so a future pass that sizes up a base tier still cannot leave an
Elder quietly level with it. Update the two `run4` SPECIES_K literals in
the mount-seat gate to match (updated, not relaxed — the ordering
`shadowfox > griffin > lightfox` holds at every band).

**PART D — the music.** Confirmed live: `BG_PLAYLIST` holds exactly
Pop/Slower_Jamz/Long_Way_Home/song, `audio/siren.mp3` and
`audio/tension.mp3` are both already in the repo. Add `siren.mp3` to
`BG_PLAYLIST` as a fifth track. Add a real Elder-scoped boss cue using
`tension.mp3`, reusing the exact `combatMusicUntil`/
`COMBAT_MUSIC_LINGER` mechanism already built for `nu_metal.mp3`. **Read
both tables to detect an Elder fight** — `WILD_SPECIES` entries for the
three tamed Elders carry `elder: true`; `MOBS` has no such flag, so
Elder Drake is matched by `m.kind === "elder_drake"` specifically. Do not
write a single expression assuming both live on one table. Four `run4`
literals need updating to match the new playlist length (5, not 4) and
the new call-site count — updated, not relaxed.

**PART E — credits.** Skeptik gets explicit composer credit for
`Pop.mp3`, `song.mp3`, `tension.mp3`. Advay gets explicit composer credit
for `siren.mp3`. `"Created by"` name updates from `"Harsh D"` to the full
`"Harsh Devarajan"`, placed directly alongside the existing "Hashbrown
Studios" line.

**Proof gates:** standard gauntlet plus confirm a capped species
genuinely stops spawning at its daily limit and resumes the next
`worldDayNum()`, confirm the cap survives a simulated reload (real
persistence, not session-local), confirm a tamed-then-PvP-killed dragon
does NOT free up a slot, confirm Griffin/Shadowfox's corrected values are
live, confirm every tier lands in its proposed range and the Elder band
lands at its dedicated values specifically, confirm both tracks are
correctly scoped, confirm credits are live.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
