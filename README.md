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

## Confirmed, locked spec for the next build (Death Timer + Session Resume + Expansion 3 + Real Minimap + Block/Credits)

**PART A — death timer.** 10 minutes -> 30 seconds. One constant.

**PART B — reload resumes your session.** Store username in `localStorage`
on successful login; auto-fill and auto-submit on page load if found. PIN
still required if the account has one. **This does NOT fix the online
count issue in Part F below — different mechanisms, confirmed by reading
both, do not conflate them in QA.**

**PART C — Expansion 3.** `N: 1000 -> 2000`. Full constant audit repeated,
same rigor as both prior expansions, real six-seed sweep required.

**PART D — real rendered minimap.** Separate from the compass dial (stays
as-is). Small top-down canvas, ~10x10 tiles centered on the player, real
terrain colors and nearby player dots, close-range only per the bible's
"does not reveal exact base locations."

**PART E — block available to every class.** Confirmed live: currently
gated to Knight and Architect only (`canBlock()`, matches "shield
classes" in the HUD hint text). Remove the class restriction entirely —
every class can hold the block key. Update the HUD hint text to match
("SHIFT block" without the "(shield classes)" qualifier, since it is no
longer true).

**PART F — the online count. Confirmed, not guessed: this reads
`others.size + 1` off Supabase's live presence channel — a real-time
network sync mechanism, not app logic.** No code bug found on inspection.
Cannot be fixed with certainty without live multi-client testing, which
the automated harness cannot do. If reproducible, the most useful next
step is confirming whether it recovers on its own after a short delay
(a presence sync lag) or stays wrong indefinitely (a real leak/bug) —
build should add a periodic force-resync as a safety net regardless,
even if the root cause can't be nailed down blind.

**PART G — credits.** Add "Sam Hicks" as a named dev, same "Dev Team"
role shown alongside Skeptik and Advay.

**PART H — music, investigated, likely not a code bug.** Confirmed the
playlist and file paths are correct and use relative paths, which should
resolve correctly on Netlify. The most likely real cause: testing was
done by opening a local downloaded file directly rather than the actual
hosted Netlify URL — local `file://` origins have different, often
stricter media/network loading rules in some browsers than a real hosted
site does. **No code change proposed here** — flag this clearly in the
notification and ask directly whether the report was from the live
Netlify site or a local file, since that changes where to look entirely.

**PART I — admin access, documentation only, no code change.** There is
deliberately no in-game way to self-promote to admin — by design, the
same two-key safety principle as the world-reset safeguard. To become
admin: open the Supabase dashboard, `players` table, find your row, set
`role` to `admin`. Next login reads it and grants admin, including
Duskfox Elder access. Add this exact instruction to SKILL.md's notes so
it's not lost.

**Proof gates:** standard gauntlet plus confirm block works for all five
classes, confirm the HUD hint text no longer says "(shield classes)",
confirm Sam Hicks appears in credits, confirm the presence-resync safety
net exists (even without proof it fixes the underlying issue), confirm
everything from the prior spec version (death timer, session resume,
Expansion 3, real minimap) still holds.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
