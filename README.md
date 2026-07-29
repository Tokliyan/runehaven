# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RuneHaven_Bible.docx`
(not included here yet — add it to this repo before relying on any automated
build to check bible-fidelity claims itself).

## Layout

```
runehaven.html              the game — currently v16
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
5. **If anything fails, or a patch anchor isn't unique, STOP.** Do not guess,
   do not "fix forward" with more invented content, do not ship a broken
   build. Write a `BUILD_FAILED.md` at the repo root explaining exactly what
   failed and why, and leave `runehaven.html` unchanged.
6. On success: update `runehaven-art-style/SKILL.md` with a new dated
   changelog entry (rendering-scope changes only — mechanics/balance live in
   this README or commit messages, not the skill).
7. Extend `debug/run5.js`'s coverage lists with any new species/mobs/weapon
   kinds/classes added in this build, so future runs keep covering them.

## Confirmed, locked spec for the next build (v16 — pet combat & uses)

The bible defines pet rarity, taming method, and flavor — but **zero combat
numbers**. This is confirmed (checked directly against the full bible text).
The following framework and numbers are agreed and ready to build exactly as
specified — do not redesign or "improve" them, just implement:

**Mechanic:** the player's active tamed pet auto-attacks the nearest valid
target within a short radius on a cooldown. No wind-up tell (pets aren't
mobs). Beastmaster's bible-stated "pet stat buffs" trait grants a flat
**+20% HP and damage** to the active pet.

**Targeting rule (locked):** Uncommon-rarity pets only ever target hostile
mobs. **Rare rarity and above may also assist their owner against another
player** (PvP) if that player is already in combat with the owner. Common
pets (the four Sprites, Glow Moth) have no combat role at all.

**Downed, not dead:** a pet reaching 0 HP stops fighting and sits/cowers,
then auto-recovers to full HP after ~75 seconds. Pets are never permanently
lost to this. (Flag in `BUILD_FAILED.md` — not a failure, just a note — if
you think this should change; do not silently alter it.)

**Mounts:** DEFERRED — do not build any riding/mount mechanic in v16.
No mount/dismount system exists yet in runehaven.html, and designing one
(trigger, camera, combat-while-mounted rules) is real design work that
belongs in its own version, not smuggled into a pet-stats build. This
ships properly alongside Arc C (full mounting, ~v20/21). Ignore all
mount-related content for this version.

**Stats table** — only the species currently implemented in `runehaven.html`
get built this version (Sprites/Wolf/Golem/Shadowfox from early builds, plus
Boar/Bear/Griffin/Phoenix from v14). Everything else in this table is locked
in for whenever that species is actually implemented — do not build stats
for species that don't exist in the file yet.

| Rarity | Pet | HP | Dmg | Cooldown | PvP-capable |
|---|---|---|---|---|---|
| Common | Sprites ×4, Glow Moth | — | — | — | No combat (Glow Moth: small light radius in dark areas — separate from this system, build only if time allows) |
| Uncommon | Wolf | 30 | 4 | 1.5s | No |
| Uncommon | Bear | 55 | 8 | 2.2s | No |
| Uncommon | Boar | 35 | 6 | 1.3s | No |
| Uncommon | Griffin | 40 | 7 | 1.6s | No |
| Uncommon | Golem | 60 | 5 | 2.5s | No |
| Uncommon | Stag | 25 | 3 | 1.8s | No |
| Rare | Unicorn | 45 | 8 | 1.6s | Yes |
| Rare | Crystal Golem | 70 | 9 | 2.2s | Yes |
| Rare | Phoenix | 50 | 10 | 1.5s | Yes |
| Rare | Water/Fire/Storm/Shadow Dragon | 55 | 11–12 | 1.6s | Yes |
| Rare | Basilisk | 65 | 13 | 2.0s | Yes |
| Epic | Shadowfox / Lightfox | 50 | 10 | 1.3s | Yes |
| Epic | Krakenling | 60 | 12 | 1.8s | Yes |
| Epic | Salamander King | 75 | 13 | 1.8s | Yes — plus a feeding/happiness mechanic (bible-specified: "rampages" if neglected). **Do not build this mechanic now** — Salamander King isn't implemented yet; design it properly when its biome arc ships. |
| Admin | Duskfox Elder | 70 | 13 | 1.5s | Yes |
| Elder | Golem Elder | 150 | 16 | 2.5s | Yes — "stays at base while offline" per bible is blocked on the base-building system (not yet built); combat stats can ship now, the offline-defense behavior cannot. |
| Elder | Dragon Elder | 100 | 22 | 1.6s | Yes — bible: "most powerful combat companion," hence the highest damage in the table. |
| Elder | Unicorn Elder | — | — | — | Zero combat — pure utility (fast travel + luck buff), per bible. Do not give it combat stats. |

**After v16 ships successfully**, the next planned version is v17 (Arc B:
Enchanted Forest + Sacred Meadow biomes, Unicorn/Stag/Lightfox). Do not start
v17 automatically — wait for the next explicit go-ahead in a future commit
or instruction, even if v16 finishes early in the run.
