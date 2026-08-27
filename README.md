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

**Revised after a genuine, correct RED stop.** Two real corrections below,
both mine, caught by the build reading the actual file rather than
trusting the spec's own claims. Everything else (Parts B, D-H) was
independently verified clean and is unchanged.

**PART A — CORRECTED: this is world density, not tame chance.** The
original spec said "spawn rates" in prose but quoted `base` — the
documented tame-success chance (`tameChanceFor()`), a completely
different thing from how often a pet is encountered. Reread against the
actual original ask ("increase pet rates all over the map"): this means
`count`, not `base`. Confirmed live spread today: `count` values run
1/2/3/4/6/9 across the roster. Increase every species' `count` by
roughly +25-30%, rounded to a whole number, preserving relative rarity
between tiers — a Common at count 9 should still clearly outnumber a
Rare at count 3 after the change, not converge toward it. Do not touch
`base` (tame chance) anywhere in this part — that system is correct as
it stands and untouched by this request.

**PART B — unchanged.** Troll `hp:90,dmg:14 -> hp:68,dmg:11`. Dark Wraith
`hp:65,dmg:12 -> hp:49,dmg:9`. Both confirmed live and unique.

**PART C — CORRECTED: Adult Golem does not exist and is dropped, not
substituted.** Confirmed by direct search: no such creature exists in
`MOBS` or `WILD_SPECIES` under any name — the bible's own line is flavor
text describing what a young Golem becomes, never actually built as a
distinct implemented mob. Rather than invent a whole new creature (real
stat block, art, loot, spawn placement — a feature version, not a
balance-pass line) under a balance spec, this part ships as Sea Serpent
alone: `hp:130 -> hp:165`. No other creature substituted in its place.

**PART D — unchanged.** `BASE_TIER_HP` doubled:
`{wood:80, stone:180, iron:360, runic:700, dragonsteel:1600}`. Confirm
the real time-to-destroy roughly doubles with it, not just the constant.

**PART E — unchanged.** `beforeunload` currently only calls
`savePlayer()`. Needs one new tracked value — last damage-dealt-or-taken
timestamp — to drive the 30-second window; add it as a tunable. Native
browser confirmation prompt only; no code can force a tab to stay open.

**PART F — unchanged.** Player-to-player item drop, reusing `invAdd`/
`invRemove` and the existing `item_add`/`item_del` broadcast pattern.

**PART G — unchanged.** Base sign on the Foundation piece (`anchor:
true`), owner-settable, rendered with the exact same nameplate technique
already used for player names above characters — dark rounded plate,
centred 11px Barlow, no new component invented.

**PART H — unchanged.** Redeem codes, two new tables, same
graceful-degradation fallback as `account_pins`/`baseHpOf()`.

**Proof gates:** standard gauntlet plus confirm every species' `count`
increased ~25-30% while relative tier ordering held, confirm `base`
(tame chance) is byte-identical to before this version anywhere it
appears, confirm Sea Serpent alone moved in Part C with nothing else
touched, confirm Troll/Dark Wraith genuinely easier, confirm base HP
doubled with real time-to-destroy verified alongside it, confirm the
beforeunload prompt only fires within the 30s combat window, confirm
player-to-player item transfer writes to the real recipient inventory,
confirm base signs render only where set, confirm redeem codes reject a
second claim from the same username and degrade gracefully with no
tables present.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
