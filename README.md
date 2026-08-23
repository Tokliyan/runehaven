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

## Confirmed, locked spec for the next build (Mount/Bazaar Polish + TP Consent + Duskfox Elder)

**Two items need your call before this can be built as-is — flagged here,
not decided silently, the same way Guilds was handled earlier.**

- **"Make Places fast travel accessible to all mountable things"** — the
  bible ties fast travel specifically and exclusively to the Unicorn
  Elder ("Grants fast travel across the entire world" — one of exactly
  three things that make it unique). Extending it to any mount would
  remove that exclusivity. If this is what you want, confirm it plainly;
  I won't build a bible deviation without that.
- **"Give more mobs mounting specs"** — the bible names exactly nine
  mountable species by name, no more. Same situation — confirm if this
  means genuinely adding species beyond that list, or if it meant
  something narrower (e.g., every one of the nine actually working
  correctly, which is worth confirming as its own check regardless).

**Everything below is buildable as specified, no bible conflict.**

**PART A — mount seat recalibration.** Confirmed directly: `mountSeatOffsetY()`
scales by `SPECIES_K` correctly in formula, but its base constant (2.2)
was set before Tuning/Polish's Elder size pass and Mob Rarity's tiered
size pass both increased dragon sizes substantially. Screenshot shows the
rider reading as floating beside the mount rather than seated on its
back. Recalibrate the base constant against the mounts' CURRENT
`SPECIES_K` values, verified per-species, not just Fire Dragon — confirm
all nine mountable species visually seat correctly, not just the one in
the screenshot.

**PART B — Grand Bazaar surroundings.** Confirmed no tree-clearance exists
around it at all, unlike other landmarks. Add the same kind of clearance
radius already used elsewhere (reuse the pattern, don't invent a new
one) so the stalls and trading floor read clearly instead of crowded by
forest right up to the edge.

**PART C — player-to-player teleport consent.** Real gap: right now
anyone can teleport to anyone, with no way to opt out. Add a genuine
consent toggle — a player can mark themselves as "not accepting
teleports" (default: accepting, matching current behavior, so this is
additive not a breaking change), and the Players tab in Fast Travel
simply excludes anyone with it off. Store the flag the same lightweight
way `me.mounted` and similar session flags already work; must degrade
sensibly if unset (treated as accepting, the current default behavior).

**PART D — the Duskfox Elder, finally built.** Confirmed: currently
exists only as a name in the Oracle's forbidden-hint list, never actually
implemented. Per the bible exactly: one exists in the entire world,
spawns in a twilight sacred grove, admin-account exclusive — reuse the
Unicorn Elder's "single random world tile" placement technique for a
true one-of-one, but gate taming behind `isAdmin()` specifically, not
just rarity. Comes with the bible's other two admin-exclusive cosmetics
mentioned alongside it — a unique crown and cloak — added to the
cosmetics system the same way every other cosmetic already works (earned,
never purchased; here, "earned" means being the admin).

**Proof gates:** standard gauntlet plus confirm all nine mounts seat
visually correctly post-recalibration, confirm the Bazaar's clearance
radius actually removes tree crowding, confirm a teleport-consent-off
player is genuinely excluded from the Players list, confirm the Duskfox
Elder's tame path is unreachable without `isAdmin()`, confirm nothing
related to it ever appears in the Oracle's hints (already true, must not
regress).

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
