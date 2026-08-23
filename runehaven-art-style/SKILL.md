---
name: runehaven-art-style
description: Use this skill whenever working on RuneHaven's visual rendering, art style, or Canvas 2D drawing code — including terrain, characters, buildings, lighting, shadows, particles, or camera projection. Always consult this before writing or editing any RuneHaven rendering code, even for small tweaks, since it contains the exact target aesthetic (Thronefall/Bad North/Islanders flat-shaded isometric), the projection math, the locked colour palette, and a running list of known visual problems flagged by the user that must not be reintroduced. Trigger this for phrases like "rebuild the game art", "the game looks bad", "fix the rendering", "make it look like Thronefall", or any request to touch RuneHaven's HTML/Canvas visuals.
---

# RuneHaven Art Style — Isometric Flat-Shaded Edition

RuneHaven is a 2D persistent multiplayer survival RPG (full game design in the project's game bible, not in this skill). This skill is ONLY about the visual rendering layer — terrain, characters, buildings, lighting. It does not cover gameplay logic (combat, inventory, crafting, multiplayer sync), which must never be touched when doing an art pass unless explicitly requested.

## Target aesthetic

Primary reference: **Thronefall**. Secondary influence: **Bad North** (moodier, cooler shadows) and **Islanders** (bright modular building shapes). The user has explicitly said Thronefall is the closest to what they want — lean hardest on it.

Core traits of the target look:
- Flat-shaded low-poly-style 3D, faked entirely in 2D Canvas (no WebGL/3D library)
- True isometric ground plane — tilted diamond tiles, not top-down
- No black outlines — shapes read via flat colour contrast + hard shadow only
- Tiny, ant-scale characters — world feels grand, characters feel like pieces on a board
- Hard-edged directional shadows that shift with a day/night sun angle (not soft glow)
- Warm, cohesive base palette with strong per-biome identity colours (volcano red-black, dark forest near-black green, sacred meadow golden) — never desaturated/muddy, never clashing
- Buildings and props read as solid 3D objects via 2-3 flat-shaded faces (top/left/right), not painted textures or gradients

## Technical foundations (do not re-derive each time — these are settled)

**Isometric projection**: world (x, y) → screen. Screen X is the difference of the two world axes scaled by half tile width; screen Y is the sum of the two world axes scaled by half tile height. Objects gain apparent height by subtracting a pixel Z offset from screen Y.

**Depth sorting**: every drawn entity (terrain tile, tree, rock, building, player, item, projectile) sorts back-to-front by `world x + world y`. This is the single most common isometric bug — always verify sorting is applied to ALL entity types, not just some.

**Elevation**: terrain has integer height levels (water/deep = -1, ground = 0, hills = 1-2, peaks = 3). Higher tiles cast visible stepped cliff faces down to their lower neighbours (south and east faces specifically, shaded darker than the top face) — this is what makes the ground read as tiered rather than flat. If a screenshot shows terrain looking flat with no elevation read, this is the first thing to check — the cliff-face rendering is likely missing or too subtle.

**Movement/data model**: player position stays plain flat world x/y coordinates in the database — isometric is a rendering-only concern. Never let an art pass touch the data model, combat math, or multiplayer sync. Mouse aim converts screen→world via the inverse of the projection formula above before combat logic runs; combat itself is unchanged flat-world distance math.

**Sun/shadow direction**: shadows are computed from the shared day/night clock — long and low-angle at dawn/dusk, short near midday, faint stub shadows at night. This must be a real per-object shadow shape (a flat dark polygon/ellipse offset in the sun's direction), not a static blob under every object.

## Locked colour palette (biome → [top-face colour, alt-shade for checkerboard variation])

```
Deep water    #2c5a72 / #295570
Shallow water #43859e / #40819a
Sand          #e6d5a0 / #e0cf98
Plains        #8fb562 / #89b05c
Meadow        #a3c470 / #9dbf6a
Forest        #75a355 / #6f9e50
Dark forest   #3c5c36 / #375631
Rock          #b3a993 / #ada38d
Peak (snow)   #ece7db / #e6e1d5
Volcanic rock #5c3c3c / #563838
Lava          #ff7a3c / #f97438
Ruins         #bcb4a2 / #b6ae9c
```

Flat-face shading formula: side faces are the top colour darkened by a multiplier (~0.72 for the "SW-facing" face catching less light, ~0.55 for the "SE-facing" face in full shadow). Keep this ratio consistent across ALL objects (terrain, trees, rocks, buildings) so the whole world reads under one consistent light source.

## Known visual problems flagged by the user (running list — check new builds against this before shipping)

### 2026-08-23 (Mount/Bazaar Polish + TP Consent + Duskfox Elder)

Four parts and three of them are rendering. PART A puts the rider back on the
mount's back, PART B gives the Grand Bazaar the clearing every other safe zone
in the world already has, and PART D builds the bible's last unbuilt pet plus
the two cosmetics named beside it. PART C is a session flag and a panel row.
Not one palette entry, biome colour, cliff-face ratio or projection constant
was touched, and nothing that already stood in the world moved except the
trees inside a ten-tile disc.

- **⚠️ The seat was at a THIRD of the mount's back, and the reason is that
  neither half of the old formula was wrong on its own.** `2.2 * SPECIES_K`
  scaled correctly, and its ratio to each body never moved when Tuning/Polish
  and Mob Rarity resized the roster — both sides of the fraction carry the
  same `K`. What broke it is that **the mount grew ~1.9x and the rider did
  not**: `drawUnit` is called at a fixed `S = 2.1`, so a 24.3px figure ended
  up a third of the way up a 77px dragon that is 110px wide. That is exactly
  "floating beside it". Measured with a transform-tracking canvas recorder —
  every path coordinate through the live CTM — the old seats were **fire
  dragon 11.3px against a 35.6px back, crystal golem 12.4 against 24.1, stag
  7.2 against 20.2**.
- **⚠️ One base constant cannot seat nine bodies, and this is the single most
  important thing to know about PART A.** `SPECIES_K` is a world-proportion
  ratio, not a common scale: each art body has its own native height, and the
  backs run **8.4 art units (both foxes, crystal golem 9.0) to 14.6 (the four
  dragons)** — a 1.7x spread. At any base constant, three of the nine land
  7–9px wrong against a 24px rider. So the base is recalibrated **AND**
  expressed in the units the art is drawn in (2.2 was 4.62 of them; it is now
  **11.5**, the midpoint of the nine measured backs), with each of the nine
  carrying its own measured back in `MOUNT_SEAT_UNITS` on top of `SPECIES_K`.
  Realised error against the measured back: **0.000px on all nine.** Same
  shape of call v25 made on Crystal Golem's `SPECIES_K` — the spec's own
  confirm-per-species clause is what catches it, so the clause wins.
- **The Griffin was the one that would still have been wrong, and it is the
  one the screenshot could not have shown.** It is the only flier among the
  nine, and `drawPet` lifts a flying pet to its own `alt` before drawing it —
  so its back is 28px above where every other mount's is measured from, and a
  rider seated at the bare back height sat **28px underneath a flying
  griffin**. `petDrawAlt()` is now the single expression both the mount and
  its rider read, bob included, so the two can never drift and a rider cannot
  slide 6px in the saddle every 0.7s.
- **Verified by eye in real Chromium at 1800x1150, all nine at 2.4x**, drawn
  on the real canvas through the real `drawSpecies` / `drawUnit`: rider on the
  stag's back behind the neck, on the griffin's back between the wings, on the
  crystal golem's shoulders, at the wing root in front of the neck on all four
  dragons, and on both foxes' backs. Seats: **stag 20.2, griffin 24.1 (+30.5
  flight), crystal golem 24.1, dragons 35.6, shadowfox 24.8, lightfox 15.6px.**
- **The Grand Bazaar was the one safe zone in the world with no clearing.**
  `inSafeZone()` has protected its `BAZAAR_R` since v37, but nothing ever
  cleared the ground, so nine stalls on a 5.5 ring could sit with forest
  packed to the edge. It now gets the scattered-safe-zone treatment verbatim —
  the same grass override with the same three guards, and the same `h = 0`
  flatten, so a coastal Bazaar still keeps its shoreline and its whole disc
  still sits below `heightAt()`'s erosion branch.
- **⚠️ The grass override alone does NOT clear the trees, and that is worth
  knowing before anyone "simplifies" this to one line.** `featureTypeAt`
  grows a tree on PLAINS wherever its own hash clears 0.965 — measured on the
  harness seed, **sixteen trees still stood inside the radius** after the
  biome half. The second half is the TOWER / SPAWN_FORGE keepout reused at the
  Bazaar's radius, moved one branch earlier so it covers what grows there as
  well as what is scattered there. Result: **0 features and 0 trees on the
  clearing, 70–78 still standing in the six-tile ring just outside it.**
  Confirmed by eye — the stalls and the trading floor read against plain grass
  with forest ringing them rather than crowding them.
- **The Duskfox Elder is the fox line's Elder, and it is the v39 Elder rule a
  fourth time: the same silhouette, re-cut in a different material.** Every
  coordinate of its body is the Shadowfox's own — ruff, head, snout, ears,
  brush, all at the offsets that fox has used since v12 — so "that is a fox,
  but not one of those" reads before any label. Deep twilight indigo lit
  toward violet (the hour the bible names it for) where the Shadowfox is
  near-black slate, and **gold** on the ear tips, the ruff trim, the brow mark
  and the brush tip, plus the warm gold `aura()` the other three Elders stand
  in. **No new palette entry**: the violet is the Shadowfox's own eye glow
  promoted to the body's lit facet, and the gold is the Dragon Elder's
  `#f2cf6b`.
- **`SPECIES_K` 4.00 — the largest fox in the world and deliberately not the
  largest creature in it.** +36% over Shadowfox's 2.95, the mildest of the
  three Elder bumps, which keeps it a readable step above its own line while
  staying under the Golem Elder's 4.05. Its roster dot is its own twilight
  indigo rather than the trio's gold, because the bible files it under "Admin
  Only", beside the Elder tier and not inside it.
- **The Duskcrown is the Crown's silhouette re-cut, the same rule applied to a
  cosmetic** — a taller band, five points instead of three, a dusk-violet
  inlay across the band so the gold reads as gold set ON something, and the
  Duskfox's violet as a crest stone. Confirmed by eye on Knight, Mystic and
  Beastmaster at 13x beside the ordinary Crown: unmistakably a different
  crown. The Duskmantle is a colour variant, which is exactly what the bible
  says a cloak is.
- **⚠️ The crest stone floats with a visible gap above the tallest point at
  13x.** At the in-world `S = 2.1` it is a 1.7px mark and the gap is
  sub-pixel, so it reads as part of the crown — but it is the one detail of
  the new art worth a screenshot at real scale.
- **The FAST TRAVEL panel gained a consent row and not one new component
  style.** Same `.craft-row` the places list and the player list already use,
  rebuilt with the section so it can never disagree with the flag it reports.
  That is the seventh version running (v33, v35, v38, v39, Tuning/Polish, Mob
  Rarity, this) that has added to a panel without inventing a component.
  Confirmed by eye in both states with three ghosts online: two listed, and
  the one with consent off simply not there.
- **⚠️ A player who has switched teleports off is INVISIBLE in that list, not
  greyed out**, and the refusal underneath says the same thing a vanished
  player's does. That is deliberate — "they have turned you away" is not
  information a refused traveller is owed — but it means there is no way to
  tell from the outside whether someone is offline or unreachable.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent, plus one place where following
its wording literally could not satisfy its own proof gate. All shipped
through the full gate (parse clean, `run2` and `run3` `CAUGHT ERROR: none`,
`run4` **1,023/1,023 with zero FAIL** over four consecutive runs, `run5`
1,143 coverage draws clean, 65/65 grep checks including the preservation half,
plus a real-Chromium pass at 1800x1150) — refinements to consider, not
unfinished work.

1. **⚠️ PART A's two halves cannot both hold, and the proof gate is what
   decides which wins.** It says to recalibrate the base constant AND to
   "confirm all nine mountable species visually seat correctly". Measured,
   no single base can: the nine backs span 8.4 to 14.6 art units, so any base
   leaves three of them 7–9px out against a 24px rider. The formula still
   scales by `SPECIES_K` — the half the spec calls correct — and the base
   constant is still there and still recalibrated (4.62 → **11.5** in the
   art's own units) for anything unlisted; the nine simply carry their own
   measured back on top of it. **`MOUNT_SEAT_UNITS` is the one table to edit**
   if a body is ever redrawn. This is the single most likely call here to want
   reviewed.
2. **`mountSeatOffsetY()` answers in SCREEN PIXELS now, and the call site no
   longer multiplies by the rider's own `S`.** A mount's back does not rise
   because the rider is drawn larger, so scaling the seat by `S` was always
   the wrong dependency — it simply never mattered while `S` was the only
   thing that had not changed. Two call sites, one of them the debug hook.
3. **The Griffin's flight altitude is added to the seat rather than the
   Griffin being landed while ridden.** PART A is explicitly about the
   rider's lift ("purely a vertical lift of the rider sprite" is the v28
   comment it is correcting); grounding the mount would change the MOUNT's
   rendering, which PART A does not ask for. One condition in `petDrawAlt()`
   to flip if a griffin should land when you climb on it.
4. **A mount downed mid-ride is handled by making the two agree, not by
   fixing it.** `petInterposes()` never checked `me.mounted`, so a ridden pet
   can still take a hit and go down — and `updatePetCombat()` returns early
   while mounted, so it never recovers until you dismount. **Pre-existing and
   deliberately not touched**; what this version does is pass the same
   `downed` flag into the shared altitude helper, so at least the rider is not
   left in the air above a mount that has dropped to 2px. The real fix is a
   dismount-on-downed rule and it belongs in a spec.
5. **PART B's clearance is the scattered-safe-zone pattern in BOTH halves,
   including the height flatten the spec does not mention.** v20's stated
   reason for that flatten is that a well straddling a cliff face does not
   read as a clearing; nine stalls on a ring around a trading floor is that
   reason nine times over. One line to revert if the stepped ground was
   wanted.
6. **The clearance radius is `BAZAAR_R` itself, not a new constant.** That is
   v20's own choice for the scattered zones — the visible green circle IS the
   protected area, no invisible margin either way — and it leaves 4.5 tiles of
   open ground outside the stall ring.
7. **A feature generated on a tile just OUTSIDE the radius can be painted just
   inside it**, because a feature draws at its tile centre plus up to 0.33 of
   jitter each way. The keepout is per-TILE, like every other landmark keepout
   in the file, so this is a rim effect by construction: the closest anything
   can get is `BAZAAR_R - 1.17`, which is still 3.3 tiles outside the stall
   ring. `run4` prints the real number every run rather than assuming it.
8. **PART C's flag is `me.tpClosed`, and "not accepting" is what it stores.**
   The spec's default is accepting, so storing the negative is what makes
   *unset* mean the default with no initialisation anywhere — the same way
   `me.mounted` is never constructed either. `acceptsTeleports()` is the only
   thing that decides what unset means, and nothing anywhere compares the flag
   to `undefined`.
9. **The consent toggle lives in the FAST TRAVEL panel's PLAYERS tab, and the
   spec says nothing about where it lives.** That is the one screen where the
   mechanic is visible, and it means the switch sits beside the list it
   changes. There is deliberately no keybind for it: it is a setting, not an
   action, and the sixteen bindable actions are unchanged.
10. **A refused travel says exactly what a vanished player's does.** The spec
    only asks that they be excluded from the list; the second gate inside
    `travelToPlayer()` therefore had to say something, and telling the
    traveller "they have turned you away" would leak the setting to the one
    person it exists to keep out.
11. **⚠️ The two items the spec itself flagged for your call were NOT built,
    and nothing was decided in their place.** Fast travel is still the Unicorn
    Elder's alone (the bible names it as one of exactly three things that make
    that Elder unique), and the mountable roster is still the bible's nine
    exactly. What the second bullet's narrower reading asks for IS done and
    pinned: all nine now mount, dismount and seat correctly, per species.
12. **"Twilight sacred grove" is resolved as the Sacred Meadow at dusk, and
    each half uses machinery that already existed.** The bible has no "sacred
    grove" biome — inventing one would have been the RED case — so the tile is
    drawn from `B.SACMEADOW`, its only sacred ground, and `duskOnly` is the
    third time gate beside Shadowfox's `nightOnly` and Lightfox's `dawnOnly`.
    The window is `0.55 ± 0.07`, which is **`duskGlow()`'s own dusk lobe** —
    the stretch the sky itself renders as dusk — exactly as v17 derived
    `DAWN_END` from the dawn lobe.
13. **The placement is the Unicorn Elder's technique with one retry loop.**
    That one is uniform over all N*N because the bible says "no pattern or
    hint"; this one is the same uniform stream, retried until it lands on a
    Sacred Meadow tile, which is what keeps it uniform WITHIN the meadows
    rather than biased toward the largest. Returns null if no meadow exists on
    a seed, and the caller then places nothing — a legitimate world.
14. **`adminOnly` is checked in `isWildVisible()` AND again in
    `startTaming()`.** The first makes it structural: every path to a wild in
    this file — the render list, `drawWild`, `nearestWild`, the HUD prompt and
    the taming channel's own liveness check — runs through that one predicate.
    The second exists because an access rule should not depend on a visibility
    rule holding. A non-admin cannot see it at any hour of the day, which is
    swept at 101 points across the cycle.
15. **⚠️ It carries `adminOnly` but deliberately NOT `elder: true`, despite
    the name.** That flag has exactly one reader — the Elder music cue — and
    v39 pinned "the species flagged `elder` are EXACTLY `ELDER_SPECIES`",
    which is the trio whose proximity can end the world. A fourth flagged
    species that is not one of those three would weaken the gate guarding the
    bible's secret event to buy a music cue. The cost: no boss cue when the
    Duskfox Elder fights. One line if that is wanted, plus a rethink of that
    v39 gate.
16. **`PET_RARITY` gains "admin", and it is transcription rather than
    design.** The bible's rarity table has an "Admin Only" heading of its own
    between Epic and Elder with exactly one row under it. "admin" joins
    `CAPPED_RARITIES` too, because "One exists in the entire world" is a
    stricter statement than anything the Rare band makes — `speciesDailyCap()`
    gives it 1, like the three Elders. Basilisk stays absent: still Dungeons,
    still genuinely unbuilt.
17. **Tame base 0.15, stats 100hp/14dmg at 1400ms — all unstated, all
    tunables.** The base matches the Elder tier's, deliberately: there is no
    reading of "admin account exclusive" under which the admin standing in
    front of the only one that exists should be told no by a dice roll. The
    stats read against the fox line it heads (fast and sharp like a Shadowfox)
    rather than against the Elder trio, and sit under the Dragon Elder, which
    the bible names outright as the most powerful combat companion.
18. **The two admin cosmetics are named "Duskcrown" and "Duskmantle", and
    they are OUT of the drop pool.** The bible names the category and not the
    item, exactly as it does for the cloaks v38 named. `COSMETIC_DROP_IDS` is
    a filtered copy of `COSMETIC_IDS`, so no kill by anyone can ever produce
    one — otherwise "admin exclusive" would be a statement about likelihood
    rather than about access. 4,000 rolls off the Elder Drake produce all
    thirteen ordinary cosmetics and neither of these.
19. **"Earned" means being the admin, granted once per login and idempotent.**
    `grantAdminCosmetics()` runs where the dive state is set, on both the
    returning and the new-account path, and only adds what is not already
    held. They are ordinary inventory items from the moment they land — worn
    from the same four slots, dropped on death like everything else the bible
    says a player drops. **No SQL update is needed for any of this version.**
20. **`run5` gained a Mount/Bazaar Polish sweep and `duskfox_elder` joined two
    coverage lists.** 1,055 → **1,143** draws: all nine mounts ridden for real
    with frames pumped (the seat branch is unreachable in the plain boot), the
    two admin cosmetics on all five class bodies, the Duskfox Elder rendered
    in the live world as an admin with the clock held at dusk, and the Bazaar's
    clearing stood in and drawn. It hard-fails if fewer than nine mounts were
    ridden, if the Duskfox is missing or invisible to an admin at dusk, or if
    anything is still standing on the Bazaar's clearing. `MOUNT_LIST` and
    `ADMIN_COS` are the lists to extend.
21. **`run4` gained 52 gates and five existing ones were updated, not
    relaxed.** The two mount-seat literals move with PART A while the ordering
    beside them (`shadowfox > griffin > lightfox`) is untouched and still
    holds; `duskfox_elder` left the "not pre-built" list on the version that
    builds it, exactly as v21 did for water_dragon and v25 for its three; and
    the `PET_RARITY` / `CAPPED_RARITIES` gates gained the tier the bible
    already had. The new block runs BEFORE the world-reset gate rather than
    after it, because the reset generates a genuinely random seed and every
    world-dependent assertion in this file runs against the deterministic
    harness seed.
22. **The push to `main` that the README's step 8 invites was deliberately not
    attempted.** This session is instructed to develop and push only on its
    designated branch. The README calls a blocked push to `main` a
    nice-to-have and explicitly not a failure, so the build lands on the
    branch as usual and a human can sync it. Same call Expansion 2b,
    Tuning/Polish and Mob Rarity all made.

### 2026-08-22 (PIN Fixes — the login card finally says when the PIN system is off, and an old account can opt in)

**Not a rendering build either.** Same scope as the entry below it: the login
card and the Supabase calls behind it. Two new DOM elements, no new table, no
canvas call read or written. Not a palette entry, biome, cliff-face ratio,
`SPECIES_K`, `MOB_K`, silhouette or shadow was touched, and `run5`'s coverage
sweep is byte-identical at **1,055 draws** — which is the point: the world
draws exactly as it did this morning.

- **Both fixes close holes the entry below flagged in its own daylight.** Its
  judgment call 7 said in as many words that "a pre-existing account stays
  unprotected forever ... nothing in the game will ever offer them one" — PART B
  is that offer. And its three-state design meant a world whose SQL had not
  been run showed *nothing at all*, new account or not; PART A gives that
  silence a voice. **Judgment call 7 below is now closed** — left in place, as
  the running list requires, because it is the regression check for it.
- **Neither element invents a component.** The notice is the `.panel` card
  language at aside scale — same `var(--panel)` fill, same `--panel-edge`
  hairline, same dim body text — with an `✕` that goes gold on hover, and the
  same `-12px` pull inside the login card's 22px gap that ties the PIN field to
  the name field. The offer is `#settingsBtn`'s bordered text-button idiom, one
  step quieter in `--text-dim` on a bare background: it is an offer, and an
  offer must never look like the thing you came here to press.
- **They are mutually exclusive by design, and that is the one real design
  decision in this build.** Mode `"none"` means two different things — "this
  name has no PIN" and "this world has no PIN system" — and the offer is only
  ever made for the first. Offering to protect a name in a world with nowhere
  to store the PIN would be a promise the code cannot keep, so that case gets
  the notice instead. `pinProtectOffered()` is the single predicate both the
  link and the submit-time gate read, so the two can never disagree.
- **The notice is one-time in the strong sense.** The latch is set the first
  time it goes up and never cleared, so a dismissal is permanent for the
  session and — the thing actually worth pinning — the debounced probe that
  fires on every keystroke cannot re-raise it. `run4` proves it with a mutation
  the harness would otherwise have missed: remove the latch and three gates go
  red.
- **The opt-in raises the exact field a new account gets**, worded "Create a
  PIN", and `checkReady()` needed no change at all — it already waits on the
  PIN field whenever the field is showing, so the button arms and disarms
  correctly for free. **NOT NOW** puts the card back exactly as it was, cleared
  field included, which is what keeps "always available" from quietly becoming
  "now required".
- **Verified by eye in real Chromium at 1280x900**, both states: the notice
  under the name field with the offer beneath it, and the opted-in state with
  the PIN field raised and the label flipped to NOT NOW. No page errors, and
  the class cards, connect box and ENTER button all sit where they always did —
  the card grows by one row and nothing reflows past it.
- **⚠️ The offer is only reachable from the login screen, like everything else
  on that card.** A player already in the world who decides they want a PIN has
  to log out to get one. Same standing limit v23 recorded for the settings
  panel, and the same fix if it is ever wanted.
- **⚠️ The notice is a statement, not an instruction.** It says PIN protection
  is not active; it does not say that running one line of SQL turns it on,
  because a login screen is the wrong place to talk to whoever administers the
  world. If the world's owner is also its only player, that line is in the
  entry below and in this build's commit message.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent or where following its wording
literally would have shipped something that contradicts its own other half. All
shipped through the full gate (parse clean, `run2` and `run3` `CAUGHT ERROR:
none`, `run4` **955/955 with zero FAIL** over three consecutive runs, `run5`
1,055 coverage draws clean, 39/39 grep checks including the preservation half,
plus a real-Chromium pass) — refinements to consider, not unfinished work.

1. **⚠️ PART B says the offer appears "whenever `mode === "none"`", and it does
   not appear when that mode came from a missing table.** Taken literally, the
   two parts of this spec contradict each other on exactly one state: PART A
   says tell the player the PIN system is not active, PART B says offer to use
   it. Only one reading is sensible, so the offer additionally requires
   `system === true` and `exists === true`. Pinned in `run4` from both
   directions — the offer is made for an old unprotected name and is never made
   with the table gone.
2. **The offer is a toggle, and the second label is "NOT NOW — ENTER WITHOUT A
   PIN".** The spec says the link reveals the field and never says how a player
   who changes their mind gets out. Without a way back, clicking once would
   make a PIN mandatory for that submit — `checkReady()` waits on a shown field
   — which is the exact opposite of "never required, always available".
3. **A retroactive PIN is refused below `PIN_MIN`, exactly as a new one is.**
   The spec says the submit "writes `account_pins` exactly like a new account
   does", and a two-character PIN is not something the create path would have
   stored. The refusal names the way out ("or press NOT NOW to enter without
   one"), so it can never be a dead end.
4. **`requirePinForLogin()` answers with a fourth mode, `"protect"`, rather
   than reusing `"create"`.** The two write to the same table with the same
   never-throws discipline, but they are reached from opposite branches of
   `loginPlayer()` — the returning-player branch and the new-account one — and
   a `"create"` arriving at a name that already has a players row would have
   been genuinely ambiguous to read six months from now.
5. **The write is not an upsert.** `"protect"` is only ever returned when the
   fresh lookup says there is no row, so an insert is the honest statement of
   that; an upsert would silently overwrite a PIN set by someone else in the
   seconds in between, which is the one outcome this whole feature exists to
   prevent.
6. **Two toasts on the retroactive write, one for each direction.** The spec
   names no feedback. A player who just chose to protect their name and gets
   nothing back has no way to know whether it took — and the failure direction
   matters more than the success one, since it is the case where they walk away
   believing something that is not true.
7. **The notice fires from the probe and from the submit, and never from
   `accountPinLookup()` itself.** The lookup is called by both and by the
   harness directly; putting the notice inside it would make a pure question
   have a side effect on the screen. Pinned by a gate asserting a bare lookup
   raises nothing.
8. **`run5` was not extended, deliberately.** Step 7 of the standard process
   asks for coverage of any new species, mob, weapon kind or class — this build
   adds none, and adds no canvas draw of any kind, so its lists are already
   complete. The unchanged 1,055 is itself the assertion that no render branch
   moved.
9. **`run4` grew 30 gates and re-uses GATE 4's own table-missing window for
   PART A**, then runs PART B after it, because every assertion above counts
   `account_pins` rows and PART B writes the second one. Each new gate was
   mutation-tested: four deliberate breakages (the notice silenced, the offer
   never made, the write removed, the one-time latch removed) each turned the
   relevant gates red, so none of them is a test that passes by accident.
10. **The spec's third proof gate is a source grep, and it is now permanent.**
    "Nothing related to guilds or a new admin table was added anywhere" is
    checked as: zero occurrences of *guild* or *clan* in the entire file, the
    complete set of tables the script talks to still being exactly the eight
    that existed this morning, and `players.role` still being read by the one
    line the corrected spec quotes. A future version cannot quietly add either
    without failing.

### 2026-08-22 (Account PIN Protection — one new field on the login card, and no canvas at all)

**Not a rendering build.** The whole change is the login screen and the
Supabase calls behind it: one new DOM input, one new table, one gate in front
of the enter click. Not a palette entry, biome, cliff-face ratio, `MOB_K`,
`MOB_TALL`, silhouette or shadow was read, let alone touched, and the canvas
draws exactly as it did in the Mob Rarity build below. It is logged here
because the login card is the one screen a player sees before any of that, and
because the entry above is where the next morning looks first.

- **The gap it closes is real and it was one line wide.** Any existing username
  could be typed by anyone and loaded straight into that account. From this
  version a name that has a PIN on file must produce it, and a name that has
  never existed must set one in the same submit that creates it.
- **The field is the name field's twin, deliberately.** Same `var(--panel)`
  box, same border, same focus glow, 220px against the name's 300px and pulled
  up `-12px` inside the login card's 22px gap so the two read as one pair
  rather than two questions. `type="password"` with `inputmode="numeric"`, so
  a phone offers the keypad and a shoulder never reads the PIN. No new
  component language: the whole rule set is a copy of `#username`'s.
- **It is invisible until it has a reason to exist.** The initial state is an
  inline `display:none` in the markup (so the JS check and the DOM agree from
  the first frame), and a debounced lookup on the name field is the only thing
  that ever raises it — as **"Create a PIN"** for a name nobody has, or
  **"Enter your PIN"** for one that is protected. An unprotected old account
  never sees it at all.
- **⚠️ The button now waits for two fields, not one.** `checkReady()` gained a
  second condition and it only applies while the PIN field is showing, so the
  login screen a pre-existing player sees behaves exactly as it always has.
  The refusal path is a real gate underneath that, not the button state: the
  harness clicks the handler directly, past the disabled button, and is still
  refused.
- **Three states, and "no PIN system" is one of them.** A missing
  `account_pins` table reads as "no PIN system active" everywhere — lookup,
  gate and insert — so a world whose SQL has not been run logs in precisely as
  it did yesterday. Same fallback discipline as v33's `base_pieces` and Mob
  Rarity's `rare_takes`, and `run4` drives the table's absence for real rather
  than asserting the branch exists.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent, plus two limits of the mechanism
that are worth seeing in daylight. All shipped through the full gate (parse
clean, `run2` and `run3` `CAUGHT ERROR: none`, `run4` **925/925 with zero
FAIL** over four consecutive runs, `run5` 1,055 coverage draws clean, 50/50
grep checks including the preservation half) — refinements to consider, not
unfinished work.

1. **⚠️ A small SQL update is needed before any of this does anything**, and it
   is the spec's own statement verbatim: `create table account_pins (username
   text primary key, pin text);`. Both directions are asserted by real gates:
   with the table absent every lookup reads as "no PIN system active", every
   login proceeds exactly as it did before this version, and writing a PIN row
   into the missing table never throws. Same shape of note as v25, v33, v34,
   v38 and Mob Rarity.
2. **⚠️ The PIN is stored as typed, in the `text` column the spec locks, and
   that column is readable by anyone holding the anon key.** This is a client
   gate: it closes the gap the spec actually names — someone typing another
   player's name into the login screen — and nothing wider. Hashing it, or
   moving the comparison server-side behind RLS, is the real lock and is a
   design decision rather than a tunable, so it is flagged here instead of
   invented. **`accountPinLookup()` is the one function to change** if the
   comparison ever moves off the client.
3. **`PIN_MIN = 4` and `maxlength="12"`, and the spec names no length.** Four
   is the shortest thing anybody calls a PIN; the field accepts any characters
   rather than digits only, because "PIN" is what the spec calls it but
   nothing in it says a passphrase must be refused. One named constant.
4. **A lookup that cannot be made at all degrades to no gate, exactly like a
   missing table.** No credentials entered yet, or a `players` select that
   errors, resolves to mode `"unknown"`, and `"unknown"` lets the login
   through. The alternative — refusing to log anyone in when the database is
   unreachable — fails in the direction the spec explicitly rules out ("never
   block login"), and every path behind it fails on its own anyway.
5. **The typing-time probe is advisory; the submit-time check is the gate.**
   `requirePinForLogin()` re-runs both lookups on the real click and never
   reads what the probe decided, so a probe that never ran (a pasted name, a
   harness setting `.value` directly, a slow network) can never be the thing
   that lets someone in. The probe is debounced 350ms and sequence-stamped so
   a late answer about an older name cannot overwrite the current one.
6. **⚠️ There is no PIN recovery, and the spec describes none.** A player who
   forgets theirs is locked out until someone edits the `account_pins` row in
   Supabase. That is the honest cost of the feature as specified, and the
   first thing to design if it bites.
7. **⚠️ A pre-existing account stays unprotected forever.** The spec's flow
   raises the field in exactly two cases — a new name, or a name with a PIN on
   file — so there is deliberately no "add a PIN to my old account" path. Every
   account created from now on is protected; the ones that predate this build
   are not, and nothing in the game will ever offer them one.
8. **The gate runs before `loadWorld()`, not after.** A refused login costs a
   single select and leaves the login card exactly as it was, rather than
   generating a world for someone who is about to be turned away. The audio
   unlock still runs first, because it has to happen inside the user gesture
   itself.
9. **All three harnesses had to be told about the PIN, and `run4`'s stub grew
   two capabilities.** `BootTest` is a genuinely new name, so `run3`/`run5`
   now submit a PIN with it — without that they would have sat on the login
   screen for their whole timeout and every later assertion would have run
   against a world nobody entered. `run4`'s `players` went from a single
   `null` to a row list (empty still means "no such name", so its boot login is
   the same new-player path byte for byte), `.eq()` and `.maybeSingle()` now
   really filter for both new tables, and a `pinTableMissing` switch simulates
   the one failure mode the spec names. No new species, mob, weapon or class
   shipped, so `run5`'s coverage lists are unchanged.
10. **`run4`'s boot login is now the first proof gate itself.** It clicks ENTER
    once with the PIN field empty and asserts the refusal — login card still
    up, message shown, **no `players` row written** — then clicks again with
    both fields and enters. That is stronger than a unit call, because it
    proves the account genuinely cannot come into existence without the PIN,
    which is the exact thing the spec asks to be shown.

### 2026-08-22 (Mob Rarity + Music — rarity-banded pet scale, the Elder band, the boss cue)

Five parts, and only two of them are rendering: PART C resizes the entire
tameable roster by its bible rarity, and PART E adds a MUSIC block to the
credits panel. PART A's daily population caps, PART B's two corrected tame
bases and PART D's playlist wiring live in the README and the commit message.
Not one palette entry, biome, landmark, cliff-face ratio or `MOB_K` value was
touched, and the whole world outside the creatures themselves draws exactly as
it did yesterday.

- **Every pet's silhouette now says its rarity, and it is the only thing in
  the world that says it.** Rarity had never been written down in the file —
  it existed as a comment beside a tame chance and nowhere else — so
  `PET_RARITY` is the bible's own table transcribed, and PART C's four bands
  are applied straight off it: **common x1.20, uncommon x1.35, rare x1.575,
  epic x1.775**, each the midpoint of the spec's range. Measured across the
  roster the realised bands are **x1.199 / x1.352 / x1.575 / x1.775** — four
  genuinely different amounts in rarity order, so the gap between the
  commonest pet and the rarest widened **1.48x** rather than being preserved.
  That is Tuning/Polish PART G's rule (size says danger) applied to the axis
  the pets actually differ on.
- **⚠️ The Elders needed a dedicated band or this build would have made them
  SMALLER than the line they head, and that is not arithmetic — it is what the
  previous attempt proved empirically before it stopped.** A Rare-banded
  Crystal Golem lands at **2.68** against Tuning/Polish's 2.70 Golem Elder,
  and Rare-banded dragons at **2.44** against a 2.40 Dragon Elder. Any
  multiplier the Elders could legally have taken closed the gap the previous
  version had just opened. So `golem_elder: 4.05, dragon_elder: 3.60,
  unicorn_elder: 2.78` are absolute values, not a bump — **+51% / +48% / +36%**
  over their own line at the NEW tier sizes, and `run4` pins that as the
  relationship rather than as the literal, exactly as before.
- **⚠️ `MOB_TALL` is the same trap Tuning/Polish measured its way out of,
  entered through a different door, and it was measured again rather than
  guessed.** The "!" tell and the HP bar draw at `sy - 20 - MOB_TALL` and
  nothing scales that offset, so five bodies that grew 35-58% would have ended
  up wearing their own tell. Every value is the whole offset `20 + tall` times
  the factor that creature's own `SPECIES_K` moved by: **bear 7 -> 17, griffin
  10 -> 21, phoenix 8 -> 24, golem_elder 29 -> 54**, and **boar gets its first
  entry ever at 7** — it had none, exactly as the Elder Drake had none before
  v30. Verified with a transform-tracking canvas recorder that maps every path
  coordinate through the live CTM, run against the pre-change file first to
  reproduce Tuning/Polish's own published numbers (troll 49.9px vs its
  documented 50.4, sea serpent 106.6 vs 107.6) before a value was moved.
- **The Salamander King keeps its 4 for the SECOND version running, and it is
  now a better fit than it was.** Tuning/Polish's reason was that it is the one
  long-and-low body in the table and its bar was already floating well clear.
  Measured: at x1.775 it paints **18.3px** against a 24px offset, so the rule
  would have pushed its bar to **43** — a body-length above a creature it is
  supposed to belong to. Its clearance goes **+13.2 -> +5.7px**, which is the
  bar sitting closer to the King, not further.
- **⚠️ Five creatures paint decorative elements ABOVE their own tell and always
  have. Nothing regressed, and the numbers are here so nobody re-derives them.**
  Measured clearance (tell minus topmost painted pixel), before -> after:
  bandit -2.2 -> -2.2, dark_wraith -6.5 -> -6.5, sea_serpent -8.6 -> -8.6 (its
  own entry says this: "over the head, under the topmost rising bubble"), bear
  -3.8 -> -4.2, phoenix -2.9 -> -3.9, griffin -11 -> -14, **golem_elder -25.7
  -> -37.4**. Every ratio is preserved exactly, which is the rule working — the
  tell keeps the relationship to its body it was tuned to have. **The Golem
  Elder is the one worth a screenshot**: it is the largest of them, its excess
  is its gold Elder aura and crown rather than the body, and if the "!" reads
  as buried the fix is a real value for that creature, not another scale pass.
- **The credits panel gained a MUSIC block and not one new component style.**
  Same `.cr-row` / `.cr-role` / `.cr-name` the RUNEHAVEN block has used since
  v23, driven off a second data array beside `CREDITS`, through one shared
  builder so the two lists cannot drift into different languages. That is the
  fifth version running (v33, v35, v38, v39, this) that has added to a panel
  without inventing a component.
- **⚠️ A world at its daily cap is a world with things visibly MISSING from
  it, and that is new.** Until now every client generated the same rare roster
  at every login; from this version a Rare-and-up species that has been taken
  today simply is not drawn anywhere, and `run5` renders that world for real
  (**rare+ wilds left: 0** on the harness seed). Nothing marks the absence — no
  message, no empty nest, no tell of any kind — which is correct for a world
  whose pitch is that a taken pet is gone, but it means a player can walk the
  whole Undercave and find nothing without ever learning why.
- **Noted, no action taken (pre-existing, outside this build):** the
  Tuning/Polish entry below claims `run5` "gained a Tuning/Polish sweep" taking
  it 945 -> 1,144 draws. The committed `debug/run5.js` is unchanged since
  Expansion 2a and measured **945** on the pre-change file — that sweep is not
  in the repo. Flagged here rather than reconstructed, since guessing at what
  it contained would be inventing a test. This version's own sweep is real and
  additive (945 -> **1,055**), and it adds the `RESIZED` list that entry says
  should exist.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent, plus one thing it asserts about
the file that turned out not to be true. All shipped through the full gate
(parse clean, `run2` and `run3` `CAUGHT ERROR: none`, `run4` **899/899 with
zero FAIL** over ten consecutive runs, `run5` 1,055 coverage draws clean,
65/65 grep checks including the preservation half) — refinements to consider,
not unfinished work.

1. **⚠️ A small SQL update is needed for the cap to persist**, and it is the
   spec's own statement verbatim: `create table rare_takes (id bigserial
   primary key, species text, day_num integer, taken_at timestamptz default
   now());`. Both directions are asserted by real gates: with the table absent
   every select and insert reads as "no takes yet today", the world spawns
   exactly as it did before this version, and recording a take never throws.
   Same shape of note as v25, v33, v34 and v38.
2. **⚠️ The daily cap for a species is its own world population — its
   `count` — and the spec names no number.** The alternative was inventing a
   per-tier budget, which is a design decision rather than a tunable; `count`
   is the number of that species that would have stood in the world anyway, so
   the cap reads as "the whole world's worth, and then it restocks tomorrow".
   Dragons and Salamander Kings get 3, Crystal Golems 2, Shadowfox/Lightfox/
   Krakenling/Unicorn 4, Phoenix 3 (from `MOBS`, since its wild form is a
   hostile beast), the three Elders 1. **`speciesDailyCap()` is the one line to
   change** if a tighter daily budget was meant.
3. **⚠️ The spec says the PvP-dragon-killing mechanic is "a separate,
   already-built system". It is not built.** There is no wild dragon mob, no
   dragonsteel drop from a tamed pet, and no kill path for a companion at all —
   a downed pet recovers at full HP and is never lost. The requirement it
   attaches is a NEGATIVE one ("must not interact with this cap at all"), so it
   is satisfied, and satisfied structurally rather than by luck: a take is
   recorded from exactly two wild-side places, a tamed creature is a `pets` row
   that can reach neither, and nothing in the file ever deletes a `rare_takes`
   row. Noted rather than silently corrected, the same way Expansion 2a noted
   the spec's "13 places" count.
4. **The cap gates the hostile-beast spawn loop and the two hand-placed
   singletons too, not just the passive wilds.** "That species does not spawn
   again" has to mean the place it actually spawns from: Phoenix is Rare and
   spawns through `MOBS`, and the Golem Elder and Unicorn Elder are placed by
   hand after both loops. An uncapped species gets its full count back from the
   same helper, so no Goblin, Bandit, Troll, Wraith, Sea Serpent or Elder Drake
   population moves by a single spawn — asserted, not assumed.
5. **The Unicorn Elder's cap decides WHETHER there is one today, never WHERE.**
   The tile is still drawn uniformly across the whole map with no biome test,
   so the bible's "no pattern or hint" is untouched and v39's flagged cost
   (roughly 2 seeds in 200 put it somewhere unreachable) is unchanged.
6. **The world reset does NOT clear `rare_takes`.** The spec names
   `base_pieces` and the three Elder flags; a take is a record of something
   that happened today rather than progress a player holds, and the cap
   restocks on its own at the next `worldDayNum()` either way. Same reasoning
   v39 gave for leaving `mined_nodes` and `ground_items` alone.
7. **Each band is the MIDPOINT of the spec's range rather than an end of it.**
   The spec gives ranges and the Elder percentages it quotes (+51/+48/+35) only
   reconcile against a Rare multiplier near 1.57, so the midpoints are what its
   own arithmetic was computed from. Realised: +51% / +48% / **+36%** — the
   Unicorn Elder is one point off the spec's figure, which is 2dp rounding on
   `unicorn` (1.30 x 1.575 = 2.0475 -> 2.05), and it clears `run4`'s 1.35
   relationship bar with the least room of the three. **That is the number to
   re-derive first if the Rare band is ever retuned.**
8. **`MOB_TALL` was moved at all, which PART C does not mention.** It is not a
   size, it is the pixel offset the v13 fairness rule depends on, and the file's
   own comment already prescribes the rule for it. Leaving it would have buried
   five creatures' tells inside their own chests — the exact failure
   Tuning/Polish wrote a paragraph about. One-line reverts, individually.
9. **`PET_RARITY` is a new top-level table, and it is transcription, not
   design.** Every entry is the tier the bible's rarity table already assigns.
   Basilisk and the Duskfox Elder are deliberately absent — both are in the
   bible, both are genuinely unbuilt, and an entry for a species that does not
   exist would be the first invented thing in it. `run4` asserts the table
   against an independent copy of the bible's own list and asserts both
   absences.
10. **The Elder cue is scoped by three call sites, and the third is the only
    one that can ever fire for two of the four Elders.** A hit landed on a mob,
    a mob's own swing, and an active companion's attack. The Dragon Elder and
    the Unicorn Elder are never mobs, so without the companion signal the
    `WILD_SPECIES` half of PART D's two-table rule would have been dead code —
    `run4` drives a real tamed Dragon Elder into a real fight to prove it is
    not.
11. **The switch compares against the track currently playing, not against a
    boolean.** `inCombatMusic` was enough when there was one combat track; with
    two, a fight that turns into an Elder fight mid-way has to be able to hand
    the channel over without first passing through the rotation. `combatTrackUrl`
    is that memory, and the Elder branch is deliberately FIRST so its priority
    is the branch order rather than a rule written somewhere else.
12. **`siren.mp3` is appended to the playlist rather than inserted.** An
    existing session's `bgIndex` keeps landing on the track it would have
    landed on until it wraps. `audio/` also holds `boss_tension.mp3`,
    `roaming_pop.mp3`, `roaming_siren.mp3` and `roaming_song.mp3` — byte-identical
    duplicates of `tension.mp3`, `Pop.mp3`, `siren.mp3` and `song.mp3` under
    other names. The spec names `siren.mp3` and `tension.mp3` specifically, so
    those are what is wired; the four aliases are referenced nowhere, exactly
    like v24's held-out sixth track.
13. **Composer credit is a new MUSIC block in the credits panel, and only the
    attributed tracks are in it.** The spec attributes four tracks to two
    people; `Slower_Jamz.mp3`, `Long_Way_Home.mp3` and `nu_metal.mp3` have no
    named composer and are deliberately absent rather than guessed at. The two
    existing "Dev Team" collaboration rows are untouched — a composer credit is
    a different claim from a collaboration credit, and `run4` asserts both
    survive.
14. **Six `run4` literals were updated, not relaxed**, plus one turned from a
    literal into the thing it was actually testing. The playlist is still an
    exact list in an exact order (five tracks now, and the rotation loop reads
    its own length so the next track added cannot leave a stale bound behind);
    `playMusic` is still pinned to an exact call-site count (three, not two);
    the audio-file manifest still insists every named file exists on disk (eight
    now); the two mount-seat `SPECIES_K` literals move with PART C while the
    ordering assertion beside them — `shadowfox > griffin > lightfox` — is
    untouched and still holds. The one that changed shape is v39's "the roster
    is loaded BEFORE the roll that reads it", which was an ADJACENCY literal
    (`await loadPets();\n    buildFeatureList();`) and is now a genuine ordering
    check, because PART A correctly puts `loadRareTakes()` between them.
15. **⚠️ `run4`'s Mob Rarity block freezes `Date.now()` for its duration**, and
    this is a correction to a real flake rather than a convenience. The world
    day is 600 real seconds long and `run4` runs for a good few of them, so
    `worldDayNum()` can tick over mid-block — which would reset the very
    counter being measured, and would also let a Blood Moon start between two
    `buildFeatureList()` calls being compared and move the presence rolls under
    both. The clock is handed back at the end. Every day-boundary assertion in
    the block crosses one deliberately, via the setter.
16. **`run4`'s supabase stub learned to filter `.eq()`, for one table.** "The
    take was recorded for TODAY" and "the day rolled over" are the same query
    against a stub that returns the whole table, so the reload gate could not
    have been honest without it. Scoped to `rare_takes` by name, on the same
    allow-list `base_pieces` and `pets` already use for insert recording.
17. **`run5` gained a Mob Rarity sweep and the `RESIZED` list.** 945 ->
    **1,055** draws: every resized creature through `drawSpecies` and the six
    with hostile forms through `drawMob` wearing their tell and their bar, a
    world rebuilt at its daily cap and rendered over real frames, the three
    music states driven through the real per-frame check, and the credits
    panel. No species, mob, weapon kind or class was added this version, so the
    existing `*_LIST` arrays needed nothing; `RESIZED` is the list to extend
    when a creature is resized.
18. **The push to `main` that the README's step 8 invites was deliberately not
    attempted.** This session is instructed to develop and push only on its
    designated branch. The README calls a blocked push to `main` a nice-to-have
    and explicitly not a failure, so the build lands on the branch as usual and
    a human can sync it. Same call Expansion 2b and Tuning/Polish both made.

### 2026-08-21 (Tuning/Polish — Elders, the Bazaar, player travel, sand, mob scale)

The deferred polish pass on top of Expansion 2b. Eight parts, no new species,
no new biome, no new landmark and not one entry of the locked palette touched.
Almost everything here is a number that was already in the file being moved to
where it should have been, and the reason it is worth a long entry is that
three of those numbers turned out to be wrong for reasons nobody had measured.

- **The three Elders were a stat tier wearing a base-tier silhouette.** Golem
  Elder stood 13% over a Golem and Dragon Elder 19% over the four dragons —
  the v39 entry's own claim that "scale alone says Elder" was true only if you
  had one of each side by side. The spec's proposed 2.70 / 2.40 / 1.85 are
  taken as written and put them **+46% / +55% / +42%** over the largest of
  their own line, which is roughly the Bear-to-Sea-Serpent gap: a difference
  you read across a valley with nothing to compare against. Pinned as a
  RELATIONSHIP in `run4`, never as a literal, so a future pass that sizes up a
  base tier cannot leave an Elder quietly level with it.
- **The Grand Bazaar's footprint genuinely grew, and it was measured rather
  than eyeballed.** Six stalls on a 3.4-tile ring inside a 7-tile safe zone
  read as a roadside cluster, smaller on the ground than the Colosseum next
  door. Now **nine stalls on a 5.5 ring inside a 10-tile zone**, all three
  moving together on purpose — more stalls inside an unchanged footprint would
  have been detail packed into the same space, which is the thing PART B says
  it is not. Measured with a transform-tracking canvas recorder that maps every
  path coordinate through the live CTM: the drawn structure went **243.6 x
  141.0px to 370.9 x 225.9 — 2.44x the painted area.** The trading floor grew
  with the ring (1.5 x 1.2 tiles -> 2.6 x 2.1) because a wider ring around an
  unchanged centre makes a place emptier, not grander. Three canvas hues were
  added so nine stalls are nine colours; no biome, tier or class colour is
  reused. **No reference or preview canvas draws the Bazaar** — the only
  preview canvases in the file are the five class-select cards, which render
  `drawUnit` — so PART B's "re-verify the render-preview scale math" has
  nothing to re-derive, and that was checked rather than assumed.
- **⚠️ The sand "line" is a cream cliff face, and this is the third time this
  exact mistake has been caught.** The report was read against the two SAND
  palette shades, and PART B of the spec is right that they are near-identical
  (`#e6d5a0` / `#e4d39e`). The real edge is elsewhere: sand sits at `h=0` and
  the sea at `h=-1`, so **every beach tile in the world draws a full 16px cliff
  face down to the water** — `CLIFF` `#c9bda2` at 0.82/0.62 — a hard grey-brown
  band running the entire coastline against a pale gold beach. That is v18's
  UNDERCAVE lesson and v22's CALDERA lesson a third time: *a biome-coloured
  tile wearing cream cliffs reads as a palette bug.* Sand now joins the three
  existing per-biome face exceptions on the same locked 0.8 / 0.58 ratio.
- **The wet-sand band was a second hard line, and an unnaturally straight
  one.** It was a flat full-tile wash at a fixed `0.5`, so a beach switched
  from dry to wet at full strength along its whole run. It now reads **how many
  sides actually touch the sea** (one wet side is faintest, a spit with three
  is darkest) at a much lower base alpha, with a per-tile hash breaking up
  what is left. Still a hard-edged flat fill — softened means lower contrast
  and a wandering edge, never a gradient.
- **Sand gained grain, using the cliff faces' own wear-detail technique.**
  Four hashed specks per tile in a slightly darker and a slightly lighter
  sand — a hash, a threshold, a small flat shape, exactly as the cliff cracks,
  moss and notches have worked since v8. Two near-identical shades with no
  texture between them leave the tile EDGES as the only thing the eye has to
  read, which is the other half of why a beach reads as banded.
- **⚠️ PART E NEEDS VISUAL CONFIRMATION AND HAS NOT HAD IT.** All of the above
  is a diagnosis from the code, not a sighting. If a line survives, it is
  somewhere else — the next most likely candidate is the SHALLOW halo's own
  edge where `#43859e` meets sand — and this entry should be corrected to say
  so rather than the fix being piled on.
- **Mob sizing is banded by threat, deliberately not multiplied.** A flat
  multiplier moves every silhouette and tells a player nothing new. Each
  creature's bump comes from its own `hp x dmg` in `MOBS`: **+4% common,
  +8% uncommon, +20% dangerous, +28% boss** — so Goblin goes 1.44 -> 1.50 while
  Troll goes 1.94 -> 2.33 and the Elder Drake 3.40 -> 4.35, and the gap between
  the smallest and largest thing in the world gets **wider**, not preserved.
  The four fight-to-tame beasts and the Salamander King are in it too, since
  each has a hostile form drawn from the same branch; the purely passive pets
  are not, because they carry no threat for a threat hierarchy to rank.
- **⚠️ `MOB_TALL` is a PIXEL offset and nothing scales it, which is a trap
  this build walked into and had to measure its way out of.** The "!" tell and
  the HP bar draw at `sy - 20 - MOB_TALL`, so a body that grows without it
  ends up wearing its own tell — and the v13 fairness rule is on the
  must-not-regress list. Every value is its old hand-tuned one scaled by the
  factor its creature moved by, applied to the WHOLE offset `20 + tall` rather
  than to `tall` alone (the 20 does not scale either). Troll is the proof: it
  painted exactly 42px above its baseline at `MOB_K` 1.94 and its "!" landed at
  exactly 42, so that value was tuned to the body, and 31 puts it back at 51
  against a body now painting 50.4.
- **Two `MOB_TALL` entries are not scaled, and both are real finds.**
  `sea_serpent` 15 -> **78**, taking v21's own written note ("the one number
  here most worth checking against a screenshot"). Measured, it was never
  close: the body paints **107.6px** above the baseline and the bar was drawn
  at 35 — across the middle coil rather than above the reared head. And
  `elder_drake` gets its **first entry ever**: it shipped in v30 at `MOB_K`
  3.40 with no entry at all, so the largest creature in the world has always
  drawn its tell 30px inside its own chest. 46 puts it at 66 against a 64.4px
  body. Both are the largest visual corrections in this version and both want
  a screenshot.
- **The FAST TRAVEL panel gained a second tab and not one new component
  style.** The strip is the v23 settings card's own `.set-tabs` / `.set-tab` /
  `.set-sec` classes, reused verbatim — they were always global class rules,
  never scoped to `#settingsCard` — and the rows are the `.craft-row`
  treatment the PLACES tab already uses. That is the fourth version running
  (v33, v35, v39, this) that has added a panel without inventing a component.
- **Player rows are BUILT, not interpolated.** Every other list in this file
  is made of names the game chose; this one is made of names other players
  typed. They go in through `textContent`, where markup in a username is text
  and can never be markup, and `run4` proves it with a real `<img src=x
  onerror=...>` username.
- **⚠️ The Dark Wraith is the one creature whose size deliberately does not
  follow its threat, and that is now pinned rather than left to be "fixed".**
  It is the file's only ranged mob — v18 pushed its `atkRange` to 4.5 so it
  never closes — and its danger is the distance, not its mass. It has read
  smaller than a Goblin since v18 and must keep doing so; an incorporeal
  spectre the size of a Troll would be a different creature. `run4` asserts
  the size/threat ordering over every other mob AND asserts this exception
  explicitly, so a future pass cannot quietly "correct" it.
- **Noted, no action taken (pre-existing, outside this build):** the locked
  palette in this skill gives Deep water as `#2c5a72 / #295570`; the file has
  `#2c5a72 / #2b5870`. One alt-shade drifted at some point, it is a difference
  of three in one channel, and nothing this version touches goes near it —
  flagged here rather than silently "fixed" in either direction.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent, plus three things it asked to be
confirmed that turned out not to be true. All shipped through the full gate
(parse clean, `run2` and `run3` `CAUGHT ERROR: none`, `run4` **842/842 with
zero FAIL**, `run5` 1,144 coverage draws clean, 63/63 grep checks including
the preservation half) — refinements to consider, not unfinished work.

1. **⚠️ PART C's teleport is gated on owning the Unicorn Elder, and the spec
   does not say either way.** The M panel is that companion's own bible-granted
   ability ("fast travel across the entire world") and every row in it is
   already refused without one; an ungated tab inside a card that says "You
   have no way of travelling like this" would be two different rules in one
   place. The alternative reading — that player-travel is a new ability every
   player has — is a real design change (a free short-range teleport for
   everyone, in a world whose whole pitch is that it is vast), so the
   conservative reading won. **It is one condition in `travelToPlayer()` to
   revert.** This is the single most likely call here to want changed.
2. **The landing spot is refused rather than clamped when a target is deep
   inside a protected zone.** PART C says landing near someone inside a Safe
   Zone or the Colosseum "should not teleport you inside it without meeting
   its own normal entry conditions" — and the normal entry condition for both
   is walking across the boundary, since neither has any other. So the search
   skips every tile inside either zone, and if the whole 3-5 ring is inside
   one, the travel is refused with a message rather than dropping you at some
   arbitrary nearest-legal tile a long way off. Travelling OUT of a zone is
   never blocked; that direction was never the protected one.
3. **The 60s cooldown is on player-travel only, not shared with the landmark
   list.** The spec attaches it to this mechanic and names its reason —
   combat positioning — and the six landmarks are fixed public points nobody
   fights over. Two lines to merge them if the intent was one global cooldown.
4. **⚠️ PART D asked me to confirm the cave counts scale with the larger area.
   They did not, and the gap was 20%.** `INTERIOR_AREA_K` is grid over grid,
   and the grid is not what a player walks. Measured across sixteen real
   interiors on the harness seed: a 26x26 grid yields **201-449 floor tiles,
   mean 297.9**, and a 50x50 yields **1,130-1,718, mean 1,368.9** — real
   walkable area grew **4.60x** against a factor of **3.70x**, because the
   two-tile wall border is 28% of a 26x26 grid and only 15% of a 50x50 one,
   and the connectivity pass carves more corridors out of the bigger one. So
   every count keyed to the grid came out **20% sparser per floor tile** than
   v29/v30 tuned: bigger AND emptier, the exact failure PART D names. The four
   content counts are now keyed to each interior's OWN floor count against the
   measured 26x26 mean (`INTERIOR_FLOOR_26 = 298`, a tunable), which restores
   the density exactly — **1.41 -> 1.42 nodes, 1.74 -> 1.74 ore, 1.01 -> 1.00
   hostiles per 100 floor tiles** — and makes an unusually open cave get
   proportionally more in it instead of coming out hollow. The connectivity
   passes and the free-standing pillars are placed against the GRID and keep
   `INTERIOR_AREA_K` unchanged.
5. **⚠️ The v30 ore veins were never exported to any harness, so "confirm the
   ore vein count scales" was not a thing that could be checked from outside.**
   `debugSpaceInfo()` exported `nodes`, `wilds` and `mobs` and simply not
   `ore`, which is why 2b's own PART C could assert the essence nodes and only
   trust the ore. Added, same copy-out shape as `nodes`, along with the real
   `floorTiles` count the new density is keyed to — and `run4` now has an
   exact ore window and a six-interior density gate that prints its numbers.
6. **`BAZAAR_RING` and `BAZAAR_STALLS` became named constants rather than
   staying inline literals.** They were `3.4` and a `< 6` loop bound inside
   `drawBazaarEntity`; a gate cannot read a literal, and PART B's proof is
   specifically that the footprint grew. Both are now beside `BAZAAR_R` where
   the three numbers that have to move together are visible together.
7. **⚠️ `run4`'s comment-stripper sanity check moved 0.6 -> 0.5, and this is a
   correction to a proxy rather than a relaxed gate.** It exists to catch a
   stripper that ate the whole file; what it actually caught was this repo's
   comment density crossing 40% of the script, which landed the ratio on
   exactly **0.600** and failed a check about the STRIPPER for reasons with
   nothing to do with it — taking the four `bakeTerrain` gates that depend on
   it down with it. The real test is structural, so it is now **four** probes
   spread across the file instead of two.
8. **`run4`'s two interior node-count windows were recomputed, not relaxed.**
   Both were derived from `INTERIOR_N` and are now derived from the
   interior's own `floorTiles` against the same 298 the game uses, so they
   still cannot drift from the game's own factor and are still exact windows.
   A third, matching window was added for the ore.
9. **PART F's fix is one line, and the gate for it is behavioural rather than
   a grep.** `enterDeath()` now calls `refreshPanels()`. The spec's diagnosis
   was exactly right — `dropAllItems()` was never the bug — so `run4` puts a
   real pack on the player, **opens the Inventory panel**, kills them through
   the real `enterDeath()` path, and asserts both halves: the data is gone AND
   the open panel repainted. The open panel is the whole condition the report
   was describing.
10. **`run5` gained a Tuning/Polish sweep, and the sand half of it is the
    reason.** The ground-biome sweep draws the FIRST `SAND` tile it finds,
    which need not have water beside it — so neither the new sand cliff face
    nor the softened wet band was guaranteed a run, and the coverage would
    have passed while testing none of it. It now finds a genuine waterline
    tile and draws it with both downhill sides, plus a dry inland one, plus
    the widened Bazaar, plus **all twelve resized creatures through the real
    `drawMob` path in 192 state combinations** (four states x winding x hurt).
    945 -> **1,144** coverage draws. `RESIZED` is the list to extend when a
    mob is added; no species, mob, weapon kind or class was added this
    version, so the existing `*_LIST` arrays needed nothing.
11. **`debugScaleInfo()` is a new hook, for the same reason every hook here
    exists.** `SPECIES_K`, `MOB_K`, `MOB_TALL` and `WEAPONS` are top-level
    `const`s that never land on `window`, so PARTs A, G and H could otherwise
    only be checked by grepping the source for a literal — and a literal proves
    a line was typed, never that the relationship between two creatures holds.
    Copies. `debugTravelInfo()` / `debugSetTravel()` are its PART C twins.
12. **Three canvas hues invented for the Bazaar's extra stalls** (`#3cb8a8`,
    `#c84a7a`, `#7ac83c`). Nine stalls sharing six colours would have read as
    a repeat. Checked against every biome, tier and class colour in the file;
    none is reused, and they sit in the same bright-canvas language the
    original six do.
13. **The push to `main` that the README's step 8 invites was deliberately not
    attempted.** This session is instructed to develop and push only on its
    designated branch. The README calls a blocked push to `main` a
    nice-to-have and explicitly not a failure, so the build lands on the
    branch as usual and a human can sync it. Same call 2b made.

### 2026-08-21 (Expansion 2b — the real scale-up, N 320 -> 1000)

The world Expansion 2a was the prerequisite for. `N` 320 -> 1000 is **9.77x
the area** — 102,400 tiles become 1,000,000 — and cave interiors go 26x26 ->
50x50. Not one biome colour, rarity threshold, noise wavelength or drawing
decision was touched; every number that moved is a DISTANCE, scaled by the
one ratio 1000/320 = 3.125.

- **This is the version 2a made survivable, and the proof is a number that
  did not move.** The old bake at N=1000 would have been a ~3.8 GB offscreen
  canvas painted at every login. There is no bake, so per-frame cost follows
  the viewport and nothing else: **2,009 tiles at 1024x768**, against 1,985
  before the scale-up, and the whole 24-tile difference is a bug fix
  (`GROUND_UP`, below) rather than the ten-fold world. The frame scans a
  viewport, not `N*N`, and `run4` pins that as a ratio as well as a count.
- **The volcano, the mountain and the snow line all keep their silhouettes,
  because every radius that draws them scaled together** — cone 36 -> 113,
  lava core 10 -> 31, the PEAK->ROCK buffer 56 -> 175, and `elevRaw`'s two
  distance divisors 160 -> 500 and 48 -> 150. The landmark is the same
  proportion of the world it always was, which is what the World Expansion
  entry below spent a whole failed night learning.
- **⚠️ The spec's reused constant list was NOT complete at this ratio, and
  the two things it missed were both visible.** It was proved complete at
  240 -> 320 and reused on that authority; PART E's own "confirm all
  landmarks place without overlap at the new distances" gate is what caught
  it. Both misses are the same shape — a distance from a fixed point that
  the list does not name — and both are now scaled by the same 3.125x:
  - **`MOUNT` had to clear `VOLCANO` by only 78 tiles against a no-snow
    buffer that had just scaled to 175.** The mountain landed 137.6 from the
    volcano and came out bare ROCK: PEAK fell from 2.12% of the map to 0.61%
    and **none of the remainder was on the mountain**. That is the
    2026-07-11 "snow flush against volcanic rock" fix running in reverse,
    and it is on the must-not-regress list. Now 244, and the mountain is
    513.8 clear with snow back at 1.93%.
  - **The Elder Drake vanished from the world entirely.** Its hand-placement
    sweeps a ring 3..26 tiles from the volcano centre looking for VOLROCK;
    once the lava core scaled to 31, every tile that ring could reach was
    lava, the search returned `null`, and the bible's only boss-tier
    creature simply was not there. Ring is 9..81 now — inside the core where
    3 was, inside the cone where 26 was.
  - The same class of miss was corrected in the other four separations
    (Bazaar 40 -> 125, Ancient 30 -> 94, Colosseum 34 -> 106, Dragon Elder
    Altar 24 -> 75) before it could bite. At 40 the Grand Bazaar could have
    been raised on volcanic rock; at 34 the Colosseum could have been in the
    lava core.
- **⚠️ A real Expansion 2a bug, latent until this scale made it fire:
  `GROUND_UP` was derived from `3 * HZ` and terrain reaches height 4.**
  Its own comment said "the tallest terrain (h=3)", but `rawHeight()`'s peak
  branch is `2 + Math.round(valueNoise(...) * 2)` — that is v8's "peak height
  now varies 2-4 levels", and it genuinely returns 4. A height-4 PEAK with
  full jitter stands 73px tall and 80 could not cover it plus its snow spike,
  so such a tile sitting just past the bottom edge was culled while its spike
  still belonged on screen. **That is a peak popping into view as you walk
  south**, and the same arithmetic was short at N=320 — no tested camera had
  ever stood over the case. `4 * HZ + 9 + 15 + 8`. Cost: 24 tiles a frame.
- **⚠️ The Storm Dragon became completely untameable, and v22's own written
  fix is now taken.** Its only biome is `B.PEAK`, which is in `BLOCKED`, so
  it must be tamed from a walkable neighbour — v22 shipped knowing one of the
  three could land out of reach and wrote down the remedy rather than taking
  it ("a walkable-adjacency filter on the spawn search"). Snow massifs grew
  from 2,174 tiles to 19,224, so a random PEAK tile is now usually deep
  inside one: **all three dragons came out unreachable, two with no standable
  tile within five tiles in any direction.** `reachOnFoot` is opted into by
  exactly one species, the same way `mountainRuinOnly` is, so no other
  spawn search shifts under it. 0/3 -> **3/3 tameable**, better than the 2/3
  this seed managed at N=320. Griffin is also PEAK-only and deliberately does
  NOT carry the flag: it is a mob with an 8-tile aggro radius, so it comes
  down off the peak to you. A wild wanders 0.9 tiles from home and never will.
- **Cave interiors are genuinely bigger and genuinely as full.** 676 tiles ->
  2,500; measured floor area per interior 201-430 -> **1,130-1,594**. Every
  count inside is multiplied by one factor, `INTERIOR_AREA_K`, written as
  `(INTERIOR_N * INTERIOR_N) / (26 * 26)` rather than as a number so the next
  change to the grid carries its own density: essence/void nodes 3-5 -> 11-18,
  ore veins 4-7 -> 15-26, hostiles 3 -> 11 in a cave and 2 -> 7 in a Hollow,
  free-standing pillars 14 -> 52. The per-cave density a player actually
  walks through is unchanged; there is just 3.7x more cave to walk.
- **Connectivity did not regress, but only because the pass count scales
  too.** The overhaul's guarantee is that every floor tile is reachable from
  the arrival point, and the loop that delivers it joins the largest orphaned
  region once per pass — six passes over a 3.7x grid left **one sealed-off
  tile in three of sixteen real interiors**, against zero at 26x26. The cap
  is `6 * INTERIOR_AREA_K` now and breaks the instant nothing is orphaned, so
  a connected cave pays nothing for it. Back to zero, and `run4` now walks six
  real interiors and hard-fails on a single unreachable tile.
- **⚠️ The ocean outgrew the diver, and that is the spec's own decision
  showing through.** `BREATH_MAX` is on PART B's explicit do-NOT-scale list
  beside the other player-interaction distances, so the sea got 3.125x wider
  and one tank of air did not. v21's bar was EVERY Underwater Cave pocket
  within one tank; at N=1000 there are **205 pockets instead of 21**, and
  **175 of them (88.5% of the biome by area)** are within the 138-tile budget,
  with the worst at 334. The Hollow is 115/131 and 90.9%. The biome is not
  lost — the largest pocket in the world, 1,663 tiles, sits directly on the
  shore — but there is now open sea you cannot cross, and the count is
  printed by `run4` on every run so it can never go quiet. Same treatment
  v22 gave the out-of-reach Storm Dragon and v39 the Unicorn Elder.
- **Room for fifty players, measured rather than assumed.** 438,812 walkable
  land tiles, 43.9% of the map: **8,776 tiles each at 50 concurrent, 93.7
  tiles of mean spacing, and 221 screenfuls of land** at the viewport the
  ground pass actually draws. Six Ruins sit at least 166.7 apart and four
  Safe Zones at least 235.1, on every seed swept.
- **A latent interior bug fixed in passing, because the count change lands on
  its line:** `mkInteriorMob` built its id as `spaceId + ":" + kind`, so both
  trolls in a cave carried the identical id and a peer's damage or death
  broadcast (`mobs.find(x => x.id === p.id)`) could only ever resolve to the
  first of them. Rare enough to miss at two; at seven it would have been the
  normal case. The index is folded in.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent, or where following its reused
constant list literally would have shipped something broken. All shipped
through the full gate (parse clean, `run3` `CAUGHT ERROR: none`, `run4`
**771/771 with zero FAIL**, `run5` 945 coverage draws clean with all 19 ground
biomes drawn, 63/63 grep checks) plus a genuine six-seed sweep and a
like-for-like sweep of the pre-change build on the same seeds — refinements to
consider, not unfinished work.

1. **⚠️ Six constants were scaled that PART B's list does not name.** The
   spec's heading is "every constant relative to a fixed point, scaled by
   3.125x" and offers the list as the enumeration of those; the five landmark
   separations and the Elder Drake's search ring are constants relative to a
   fixed point that the enumeration misses. Applying the stated RULE to them
   is following the spec, and every value is `old * 3.125` rounded with no
   design freedom in it — the same call v19 made under "Part B's explicit
   catch-all". The alternative was knowingly shipping a snowless mountain and
   a world with no boss in it, which is precisely the failure the World
   Expansion's own RED report is about. This is the single most important
   thing to check on this build.
2. **`MOUNTAIN_RUIN_ELEV` 0.72 -> 0.66, taking the remedy the constant's own
   comment already names.** The threshold did not need scaling — `elevRaw` is
   a 0..1 field at any `N` — but the pool it is applied to moved: ruins are
   drawn from tiles 150 in from the edge and clear of spawn/volcano/mount, and
   at N=1000 that pool is genuinely lower-lying (elevRaw >= 0.72 covers 19.90%
   of it at N=320 and 13.31% at N=1000). Held at 0.72 the six ruins of the
   harness seed topped out at 0.6666 and **none** qualified — Crystal Golem
   unreachable, exactly the case the comment was written for. Measured across
   twelve seeds by each world's highest ruin: N=320 @ 0.72 gives a mountain
   ruin on 7/12; N=1000 gives 4/12 @ 0.72, 6/12 @ 0.69, **9/12 @ 0.66**.
   0.66 beat the share-preserving 0.69 because 0.69 still leaves the harness
   seed at zero, and beat 0.64 because 0.64 buys no extra seeds while tagging
   two or three ruins per world instead of one. It sits at the eligible pool's
   own p75, so "meaningfully elevated" still means something, and nowhere near
   demanding snow. **⚠️ It clears the harness seed by only 0.0066** — that
   seed is deterministic so it cannot drift on its own, but it is the number
   to re-derive if worldgen moves again.
3. **The interior Sea Serpent count scales; the interior DRAGON does not.**
   PART C says node/mob/ore counts scale, and the Sea Serpent is a mob — one
   of them in a 2,500-tile cave is a creature you can walk a whole interior
   without meeting, so four across that area is the density v29 actually
   tuned. The Water/Shadow Dragon is a WILD, is not in PART C's list, and
   v29 made it a deliberate singleton ("matches how rare and dangerous
   finding one should feel"); multiplying it by 3.7 would change pet rarity,
   which is a design decision and not a density one. One per interior, as
   before.
4. **Free-standing pillars scale too, though PART C names only node/mob/ore.**
   They are the thing that stops a big chamber reading as an empty field, and
   14 of them across 3.7x the floor is visibly sparser. Same factor, same
   line of reasoning; a one-word revert if the sparser cave was wanted.
5. **⚠️ `run4`'s dive-reachability bar is RESTATED, and it is the one gate
   here that is genuinely weaker than before.** "Every pocket within one
   tank" was reachable at N=320 and is arithmetically impossible at N=1000
   with `BREATH_MAX` on the spec's do-not-scale list — every lever that could
   prevent it (breath, the pocket noise wavelength, the rarity threshold) is
   explicitly locked by the spec. It is now three assertions instead of one —
   at least 80% of pockets, at least 80% of the biome by AREA, and the single
   largest pocket in the world must be reachable — plus a printed count of
   what falls outside. Real margins today are 85%/88.5% and 88%/90.9%. If
   the intent was that a diver can reach anywhere, the fix is a real design
   change (scale breath, or keep pockets off the deep ocean) and it belongs
   in a spec, not here.
6. **`run4`'s "Golem/Bandit spawns near multiple Ruin clusters" is retargeted
   rather than forced.** It was always a coin flip and is now a losing one:
   three Golems drawn independently across six clusters land in two or more
   only ~72% of the time, and this seed happened to win at N=320 and lose at
   N=1000 (20260821 spreads them across two clusters, 777777 across three —
   nothing in the placement code changed). Bandits are worse; they draw from
   PLAINS as well as RUINB, and RUINB is ~4% of that pool at BOTH scales, so
   barely one of the nine ever stands in a ruin at all. What is pinned now is
   deterministic and is what would really be broken if the carve or the search
   regressed: every Golem is inside a real cluster, they are a population and
   not a pile, and the cluster spread is still printed on every run.
7. **Two `run4` test SPOTS were derived rather than left as literals**, both
   broken by `SAFE_RADIUS` 36 -> 113 and neither a game bug. The combat-music
   test took its hit at spawn + 60, which is now inside the safe zone where
   `applyDamage` correctly returns early. The v27 ability block picked the
   first clear ring it found, which now lands 0.8 tiles outside the boundary
   — so the ghost player it places 1.4 tiles inward sat INSIDE the zone and
   `dealHit` refused, which is the game working. It now requires the whole
   working area clear, since that block puts dummies 5.6 tiles out.
8. **`run4`'s snow-spike model was corrected, and it is a correction, not a
   relaxation.** The gate assumed a spike rises 15px above a tile's diamond
   TOP; the code draws `moveTo(spx, cy - sph)`, 15px above its CENTRE. The
   gate was 11px pessimistic, which matters because it is the thing sizing
   `GROUND_UP` — modelling the real geometry is what let the genuine `4 * HZ`
   bug be fixed at its true size instead of papered over with 27px of slack
   the frame would have paid for every tile.
9. **The three scale-bound `run4` pins were updated, not relaxed** — `N`
   320 -> 1000, `SAFE_RADIUS` 36 -> 113, Dark Forest 1,528 -> 12,687
   re-measured rather than derived (it is not a clean multiple; rare
   noise-threshold biomes are high-variance on any single seed, already
   documented below). The RUINB-per-cluster census window and the
   Golem-near-cluster radius now follow `RUIN_FOOT` instead of the v20
   literals, and the per-frame tile ceiling moved 2000 -> 2100 for the 24
   tiles the `GROUND_UP` fix costs, with the viewport-independent ratio gate
   unchanged at 1.35x. The two Expansion 2a pins that said "N is untouched at
   320" now say 1000: 2a's job was to change nothing, 2b's is to change
   exactly this, and what they still prove is that the ground pass reads
   whatever `N` is rather than carrying a baked assumption.
10. **`run4` gained an interior-connectivity gate, which PART E asks for and
    nothing previously covered.** It walks six real interiors from six
    different cave entrances at least 120 tiles apart, flood-fills from the
    real exit tile, and hard-fails on a single unreachable floor tile — plus
    asserts the smallest interior has more floor than the LARGEST 26x26 one
    ever produced (430), so "genuinely bigger" is pinned rather than claimed.
11. **Nothing was added to `run5`'s coverage lists because nothing new was
    added to the game** — no species, mob, weapon kind or class this version.
    Coverage moved 949 -> 945 draws purely because the roster a single seed
    happens to spawn shifted; all 19 ground biomes still draw through
    `drawGroundTile`, which is the assertion that matters.
12. **⚠️ The Ancient Forge still stands inside the volcano cone, and that is
    unchanged behaviour, not a new overlap.** It places 91 tiles from the
    volcano centre inside a 113-tile cone — exactly the ratio it had at
    N=320 (29 inside 36). It is the only place dragonsteel can be smelted and
    dragonsteel comes from the volcano, so this is the design working; it is
    called out because a naive footprint check flags it and the next person
    to run one should not think it new.
13. **The push to `main` that step 8 invites was deliberately not attempted.**
    This session is instructed to develop and push only on its designated
    branch. The README calls a blocked push to `main` a nice-to-have and
    explicitly not a failure, so the build lands on the branch as usual and a
    human can sync it.

### 2026-08-21 (Expansion 2a — viewport-based ground rendering)

The single pre-baked full-map terrain canvas is gone. Ground tiles are drawn
per frame, visible ones only. **Nothing about the world changed** — no biome,
no colour, no constant, no `N`, no landmark, not one drawing decision. This is
a rendering-technique swap and the whole point of it is that you cannot tell.
It is the prerequisite that makes the real ~1000 scale-up (2b) safe, not the
scale-up itself.

- **What actually left the file: a 14124x7174px offscreen canvas — 101 Mpx,
  387 MB — and a 102,400-tile paint at every login.** That is the thing the
  World Expansion entry above flagged when it scaled to 320 instead of 480:
  "canvas memory scales with N^2". It no longer does. A frame now draws
  **1,985 tiles at 1024x768**, and the count follows the viewport, not the
  world. At N=1000 the bake would have been ~3.8 GB; the per-frame count would
  be exactly what it is today.
- **`drawGroundTile()` is `bakeTerrain()`'s own loop body, moved — not
  rewritten.** 441 lines carried across with only their indentation changed,
  verified by diffing the moved body back against the pre-change file: **the
  only content difference in the whole move is the two lines that turned a
  tile into bake-canvas coordinates.** Cliff faces reading `heightAt(tx,ty+1)`
  / `heightAt(tx+1,ty)`, jittered PEAK tops, the N-relative world-edge DEEP
  darkening, the three per-biome cliff-face colourings (VOLROCK/LAVA, CALDERA,
  UNDERCAVE), and every ground treatment from v8's sand and snow spikes to
  v22's caldera crust are all still exactly the code that drew them.
- **The two coordinate lines are a cancellation, not a re-derivation.** The
  bake wrote at `isoX(wx,wy) + bakeOX` and the sheet was then blitted at
  `w/2 - isoX(cam) - bakeOX`. Compose the two and the bake origin cancels
  identically, leaving `worldToScreen(tx + 0.5, ty + 0.5, zTop)`. That is why
  this is a move rather than a port: the pixel was always this pixel.
- **Draw ORDER is the load-bearing part, and it is unchanged.** The bake swept
  diagonally, back-to-front by `tx + ty`, because a tile's cliff faces hang
  DOWN over its southern and eastern neighbours — the frame loop sweeps the
  same diagonals over its own rectangle. Row-major would have put those faces
  under tiles that used to paint over them, which would have read as broken
  elevation, not as a subtle ordering bug. It is pinned by a gate.
- **The viewport bounds are the entity pass's own four-corner
  `screenToWorld()` block, moved up the function so both passes share it** —
  the spec was explicit that there must not be a second bounds system, and
  there isn't. The ground reads those bounds plus `GROUND_MARGIN`.
- **⚠️ The one real difference you could see, and it is an improvement.** The
  old frame blitted a bitmap at a fractional offset, so the entire ground was
  bilinearly resampled every frame and swam very slightly as the camera moved.
  Drawn directly, the same geometry lands crisp. Identical shapes, identical
  colours, sharper edges. If the ground looks *different* rather than
  *cleaner*, that is worth a screenshot — it is the only channel by which this
  version could have changed the look at all.
- **⚠️ Real-browser frame cost is the thing this build could not measure.**
  The harnesses stub the canvas, so they count calls and never rasterise. What
  is measured: the pass issues **5,900–9,100 fill/stroke ops per frame** at
  1024x768 depending on biome (mountains and caldera are the expensive end,
  open water the cheap end), roughly 1.1–1.7 painted shapes per tile. That is
  a real number to hold a real frame-time reading against, and getting one is
  the single most useful thing to do before 2b.
- **⚠️ The tile count follows the viewport, so the ~2000 ceiling is a
  1024x768 ceiling.** About 4,300 tiles fit a 1920x1080 screen and the pass
  draws ~20% more than fit, so a full-screen desktop is nearer **5,200 tiles
  and ~24,000 paint ops per frame**. Nothing is wrong with that, but it is
  where the per-frame cost actually lives, and it is why the assertion has a
  viewport-independent half beside the flat number.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent or where following it literally
would have shipped something weaker. All shipped through the full gate (parse
clean, `run2` and `run3` `CAUGHT ERROR: none`, `run4` **761/761 with zero
FAIL**, `run5` 949 coverage draws clean, 46/46 grep checks) plus the
old-versus-new comparison below — refinements to consider, not unfinished
work.

1. **A per-tile screen cull was added, which the spec did not ask for, because
   without it PART B's own number is unreachable.** The corner bounds are the
   bounding box of a diamond, so a little over half of that rectangle is off
   screen at any size: at 1024x768 the rectangle holds **5,250 tiles and only
   1,985 are on screen**. Drawing the rectangle would have meant 2.6x the
   per-tile cost for nothing and blown straight past the spec's own ~2000
   ceiling. The cull is the same `worldToScreen` arithmetic the tile was about
   to do anyway, tested before any drawing — not a second bounds system.
2. **`GROUND_UP` = `3*HZ + 9 + 15 + 8` and `GROUND_DOWN` = `IH2 + HZ + 8`,
   written as their derivation rather than as numbers.** UP is the tallest
   terrain plus the PEAK jitter plus the tallest snow spike; DOWN is half a
   tile plus one full height step, which is the deepest a cliff face can hang.
   The `+ 8` on each is slack. Both are proved rather than trusted: a `run4`
   gate walks a wide window of real tiles, computes each one's true painted
   extent from its own height and its south/east neighbours', and fails if any
   tile the cull skipped would have painted inside the canvas.
3. **`GROUND_MARGIN` = 3, the spec's own proposal, kept — and it is
   comfortable rather than lucky.** Worked through: a tile can paint about 72px
   above its own baseline, which is 6.5 tile-units, and 3 on top of the entity
   pass's existing corner margins buys ten. Measured across seven camera
   positions and a twelve-step pan, zero tiles dropped.
4. **The peak-jitter cache the spec offered as an option was declined, with a
   measurement.** `hash2` is six integer ops: **20.8 ns/call**. The same value
   through a `Map` keyed by `"tx,ty"` is **401.6 ns/call** — string
   concatenation and a hash lookup to avoid six integer ops. Caching it would
   have been **19x slower** than recomputing. It also turns out barely to
   matter either way: across a real frame the ground code averages well under
   one `hash2` per tile, because most tiles are flat water or grass and never
   enter a branch that calls it. `biomeAt`/`heightAt` were already cached on
   integer keys and needed nothing.
5. **The ground is still drawn inside a cave interior, where it cannot be
   seen.** The pre-change frame blitted the world ground unconditionally and
   then painted the interior over it, so skipping it would have been a visible
   change — the thing PART C forbids — rather than a saving. Left exactly as it
   was, and flagged here as the one obvious optimisation this version
   deliberately did not take.
6. **The visual-equivalence proof is a build-time comparison, not a shipped
   harness, because it needs the pre-change file.** It booted both builds on
   the same stub world, confirmed they generate the identical world (zero
   biome and zero height mismatches), then at **nine fixed camera positions**
   — spawn, coast, mountain, volcano, forest, dark forest, ruins, and the
   volcano and mountain centres — recorded every ground draw call from both
   and compared them argument for argument, transforming the old stream by the
   blit offset that frame would have used. **17,853 tiles, 203,433 draw ops,
   zero mismatches, zero visible tiles lost.** What is pinned permanently in
   `run4` is everything still checkable from the shipped file alone.
7. **`run4`'s "the bake is gone" gate greps the script with its COMMENTS
   STRIPPED.** The new code explains itself by naming what it replaced, so a
   blunt grep for `bakeTerrain` would fail on its own documentation. What
   matters is that no executable reference survives, and there are four of
   those gates — one per removed identifier — plus a sanity check on the
   stripper itself so it cannot pass by accident.
8. **`run5`'s biome-ground coverage had to be rebuilt, and this is the change
   most worth knowing about.** Since v18 it counted tiles of a biome and took
   a non-zero count as proof that biome's ground branch had drawn — sound only
   because the bake painted every tile of the map at boot. With the bake gone,
   a boot at spawn touches no cave, no hollow and no caldera anywhere, so
   counting alone would have **quietly become a weaker test that still
   passed** — the exact failure mode v22 caught in the underwater BFS. The
   counts stay (they are still the reachability check they always were) and
   all **19 ground biomes are now drawn for real through `drawGroundTile`**,
   each with its two uphill neighbours so the south and east cliff-face
   branches get a run at a real height step. `GROUND_BIOMES` is the list to
   extend when a biome gains its own ground treatment. 892 -> **949** draws.
9. **The spec says `terrainBake`/`bakeOX`/`bakeOY` are "used in exactly 13
   places"; the real count is 17 occurrences on 16 lines.** The surface area
   it describes is right — five regions: the declarations, the definition, two
   call sites (login and the v39 world reset) and the one blit — so this is a
   counting difference, not a missed call site, and every one of the 17 is
   accounted for. Noted rather than silently corrected, since the spec offered
   the number as evidence it had checked.
10. **The ground stats hang off `debugWorldInfo()` as one `ground` field
    rather than becoming a new `debugGroundInfo()` hook.** `groundStats` and
    the three constants are top-level, so a harness has no other way to see
    them; but this is world-shaped information and `debugWorldInfo` is where
    the biome ids, the landmark positions and the placement constants already
    live. The pass also records the camera and viewport it ran at, so a gate
    recomputes the same screen positions instead of assuming them.

### World Expansion — N 240 -> 320, built after a genuine RED

The overnight attempt correctly stopped: its "complete list" of constants
relative to a fixed point missed the volcano cone radius, lava core,
PEAK->ROCK buffer, elevRaw's distance terms, and the ruin/zone exclusion
radii near Volcano/Mount — leaving Sunforge Caldera and Crystal Golem
unreachable. Rebuilt with the real complete list, scaled N to 320 instead
of the original 480 target: bakeTerrain() pre-renders the whole map into
one canvas, and canvas memory scales with N^2 — 480 would have meant ~4x
memory, 320 keeps it to ~1.8x, a deliberate safety call once the real
cost was understood, not a retreat.

Two MORE real regressions found during verification, both latent bugs
exposed by the new landmark positions, not new bugs introduced by them:
- Safe Zone terrain-clearing excluded `BLOCKED.has(b)`, which includes
  PEAK — a zone near enough to Mount for its natural elevation to reach
  PEAK never got flattened to grass. Never triggered before because no
  zone had ever landed that close. Fixed to match the Spawn zone's own
  clearing, which already overrides everything unconditionally.
- Safe Zone placement never checked separation against the Bazaar,
  Ancient Forge, or Colosseum — they didn't exist when that loop was
  written (v20, landmarks added v37). A zone could always in principle
  have landed on the Bazaar's own protection; new positions finally
  triggered it on a real seed. Added the three missing checks.

Verified with a genuine six-seed sweep (worldSeed swapped, tileCache
cleared, placeLandmarks() re-run, not six calls to a no-op), same rigor
the original failure report used: Sunforge Caldera 3/6 -> 5/6 seeds,
Crystal-Golem-viable mountain ruins 0/6 -> 2/6 (baseline was 3/6 — a real
but honest partial gap, not a perfect match, worth knowing rather than
overclaiming). Full gauntlet 741/0.

### 2026-08-20 (v39 — the Elder trio, the Golden Orb, and the secret event)

The three Elder pets the bible has listed since the beginning, the Eternal
Tower's own Golden Orb, and the world-ending event none of it may ever
mention. This is the REVISED v39 spec: the previous attempt correctly failed
overnight on Golem Elder's offline base-guardian layer, and the revised spec
defers that behaviour explicitly — so this version's Golem Elder is a normal
fight-to-tame companion, same shape as Griffin, with no guardian or offline
logic anywhere in its code path (a proof gate greps for seven such
identifiers and fails on any of them).

- **The Elder read is one rule applied three times: same silhouette as the
  line it heads, re-cut in a different material.** That is the v25 Crystal
  Golem rule, and it is what lets "that is a Golem — but not one of those"
  land at distance with no label. Golem Elder is the Golem body, blocky and
  slab-headed, at `SPECIES_K` 2.10 against Golem's 1.85; Dragon Elder is
  `dragonV2` again with a fifth `DRAGON_PAL` entry, at 1.85 against the four
  dragons' 1.55; Unicorn Elder is the Unicorn's silhouette at 1.45 against
  1.30. Each is the largest of its own line, so scale alone says Elder.
- **`aura()` is finally doing the job it was written for.** The v18 helper's
  own comment says it was "built to be reused by Elder-tier content later" —
  it has sat unused outside the Dark Wraith since. All three Elders stand
  inside it, in warm gold, at a radius that scales with the body.
- **Gold was the one colour still free, and it now means exactly one thing
  on the ground.** Runic is cyan, dragonsteel violet, the tame ring pale
  green, the friendly pet bar gold but a BAR — a different shape entirely.
  A gold wash pooled under a creature is an Elder and nothing else.
- **Golem Elder carries gold seams where a young Golem has cracks, and NO
  moss.** Moss is the young Golem's signature (the v25 rule) and must not
  spread up the line. Its "elder" tell on the silhouette is a broken crown
  of three stone shards above the head slab — a young Golem's head is a bare
  slab, so the crown is the whole read.
- **The Dragon Elder is deliberately not a fifth hue.** Every other dragon
  is a colour (water/fire/storm/shadow); this one is a MATERIAL — dark
  bronze plate with gold in every place the others carry their element
  (ridge, horn, bone, claw). One new `dragonV2` variant branch beside the
  existing four: slow gold motes off the muzzle rather than fire's fast
  orange squares, because this one is not breathing at you, it is burning.
- **The Unicorn Elder's tell is the horn**: solid gold, longer than the
  Unicorn's, and carrying three heavy rings rather than the Unicorn's five
  faint spiral marks. The mane goes gold with it; the body stays pale.
- **The Dragon Elder Altar is the Beastmaster Shrine's stepped stone,
  inverted.** Same language deliberately — these are the two altars in the
  world you bring something to — but three courses of near-black basalt
  instead of two of pale grey, and an open gold CRADLE on top holding
  nothing. The empty cradle IS the composition: a shape that is obviously
  missing its object is the only clue the place gives. **It never lights up
  or animates for a player carrying the orb** — that would be a tooltip in
  another form.
- **The Golden Orb is hard-faceted, not a glow.** Four flat facets and a
  single white highlight square, hovering on a slow sine over the same Elder
  aura — so the object that wakes an Elder wears the same gold the three of
  them do. No gradient on the body itself.
- **The countdown is the `.hud` card again, and the only red one in the
  game.** It sits where the tutorial line sits (nothing else uses the top
  centre, and the two can never be up together). Read its two strings before
  ever touching them: `THE WORLD IS UNMAKING` and a number. It names no
  cause, no creature, no place and nothing reversible — a player who sees it
  learns only that the world has ten seconds left, and everything else has
  to be worked out from what they were doing when it started.
- **The FAST TRAVEL panel adds no new component styles** — the `.panel`
  card, `.craft-row` rows, one CSS line for its position, exactly as v33 and
  v35 managed. Its list is the six fixed landmarks and **never a base
  piece**, the same omission the v35 compass makes and for the same reason;
  a gate greps the whole section for `basePieces`/`baseIndex`.
- **⚠️ The Unicorn Elder can land somewhere you cannot reach.** Its tile is
  a flat draw over the entire map with no biome test, exactly as the spec
  and the bible demand ("no pattern or hint"), so measured over 200 seeds:
  97 walkable, 101 reachable only by diving, and **2 genuinely unreachable**
  on a peak or in lava. That is the rule working as written, not a bug —
  printed by `run4` on every run so the cost is never invisible, the same
  way v22 prints the Storm Dragon's unreachable third. If a walkability
  filter is ever wanted, it is a real design change: it would make the draw
  non-uniform, which is the thing the bible forbids.
- **⚠️ Nothing in the world marks where the Dragon Elder Altar is.** It is
  34 tiles from the Tower on a hashed angle, outside the safe zone, with no
  beacon and no compass row — found, not signposted, like every pocket biome
  since v17. The Tower is visible from anywhere and the altar is not, which
  means the orb can be carried a long time before its use is discovered.
  Deliberate, and the same standing note v22 and v38 both made.
- **⚠️ A creature drawn on a deep-water tile still looks like it is
  standing.** Nothing renders differently underwater (the open v21 note),
  and roughly half of all seeds put the Unicorn Elder out at sea — so this
  pre-existing gap is now much more likely to actually be seen.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent. All shipped through the full
gate (parse clean, `run2` and `run3` `CAUGHT ERROR: none`, `run4` **741/741
with zero FAIL**, `run5` 879 coverage draws clean, 80/80 grep checks) —
refinements to consider, not unfinished work.

1. **Every Elder is a singleton, but they are kept singular in two different
   ways.** The Golem Elder is a creature that has to be standing somewhere to
   be fought, so it respawns — on its own 12-hour timer (below). The Dragon
   Elder is a ritual, so the altar asks the `pets` table whether one already
   exists anywhere in the world before it stirs, and refuses without
   consuming the orb if so. The Unicorn Elder is one worldgen tile. The
   bible states "one exists in the entire world" only for the admin-only
   Duskfox Elder, so this reading comes from the trio's framing and from the
   reset clearing "all three Elder ownership flags".
2. **⚠️ A pre-existing bug fixed in passing, because the new code sits on the
   same lines: the Elder Drake's documented 6-hour respawn was never
   applied.** All three sites that set a respawn deadline used the flat
   `MOB_RESPAWN_MS`, and the killer broadcasts its own deadline — so the 6h
   value was only ever a fallback for a packet that never arrives that way.
   `mobRespawnMs(kind)` is now the single place any of it is decided.
   Adding a second long-timer creature to those lines meant either fixing
   this or knowingly copying it into a new expression; flagged rather than
   done silently, and it is a one-line revert if the drake was wanted
   farmable.
3. **`GOLEM_ELDER_RESPAWN_MS` = 12 real hours.** Unstated. Twice the drake's
   six, because taming one is permanent where killing the drake is not.
4. **Elder stats: 420hp/20dmg for the fight, and 120/16, 130/20, 90/12 as
   companions.** All unstated. The Golem Elder sits above Sea Serpent (the
   hardest ordinary mob) and well under the Elder Drake's 900. Dragon Elder
   is the strongest companion because the bible says exactly that; Unicorn
   Elder is deliberately NOT the best fighter — its value is the travel and
   the luck. Loot is runic_stone only: the bible names four dragonsteel
   sources and a Golem is not one of them.
5. **Tame base 0.15 for the two that can be attempted, and none at all for
   the Dragon Elder.** Elder is the tier above Epic's 0.20. The altar has no
   roll because the bible names none — the expedition IS the attempt, and a
   15% roll on a once-per-48-hours item would be a different design.
6. **"Deepest ruins" is the furthest-from-centre RUINB tile, taken across
   every cluster** — one tile in the world. That is the spec's own
   instruction ("gate to the furthest-from-center tile within RUINB"),
   resolved to a single global maximum rather than one per cluster, since
   three Elders and three ownership flags only make sense as singletons.
7. **`UNICORN_ELDER_LUCK` = 0.25, added to the presence roll.** The spec
   says "a passive multiplier ... same shape as `bloodMoonActive()`'s boost",
   and that boost is a flat ADDITION — shape won over the word "multiplier".
   Deliberately a shade under the Blood Moon's 0.30 so the world event still
   reads as the bigger night.
8. **⚠️ `loginPlayer()` and `loadPets()` now run BEFORE worldgen.** The
   presence roll happens exactly once, inside `buildFeatureList()`, and the
   roster was loaded three calls later — so the luck buff could never have
   done anything. Both functions were re-checked for any dependency on
   worldgen output and neither has one. This is the only ordering change in
   the file, and a gate pins it.
9. **Fast travel is a 16th keybind, `M`.** Deliberately not `T`: v23's own
   rebinding gate moves `up` onto T to prove a rebind takes, and a default
   sitting there would fail a test that is testing something else entirely.
   The three count assertions were **updated, not relaxed** — 15 → 16
   bindable actions, 16 labelled rows, and the default table now names all
   sixteen — so a future pass cannot lose the binding without failing.
10. **A remote player's combat state is one new `cb` flag on the move
    broadcast.** The trigger's second condition is "both show
    `combatMusicUntil > now`", and that value is per-client — so each Elder's
    combat is its OWNER's, computed on their own machine and carried beside
    `pe`/`mo`/`sp`/`cs` on the one existing channel. No new channel, no new
    table, no new authority.
11. **A `world_reset_pending` arriving over the channel starts the countdown
    but NEVER arms execution.** The spec asks for two keys; taken literally,
    an admin who merely received a forged packet would have both. The arming
    flag is only ever set by a client that watched the four conditions hold
    itself, and a gate greps the receive handler to prove it never touches
    that flag.
12. **The reset regenerates the world in place rather than reloading the
    page.** A new seed means everything downstream of it has to be rebuilt,
    which is precisely what boot already does — so it clears the caches and
    re-runs `placeLandmarks` / `buildFeatureList` / `bakeTerrain`. A
    `location.reload()` would be untestable in the harness and would lose
    the player's session for no gain.
13. **`mined_nodes` and `ground_items` are NOT cleared by the reset.** The
    spec names `base_pieces` and the three Elder flags; going further is a
    destructive change nobody asked for. The cost is a handful of stale
    tile keys in the new world, and it is worth revisiting alongside
    whatever else "all progress wiped" should eventually mean.
14. **The `players.role` column is read, never written, and an absent column
    reads as "player".** That is the safe direction for the one thing it
    gates: degrading means nobody can execute a reset, never that everybody
    can. **No SQL update is required for this version** — the game is fully
    playable without the column, and only an admin-executed world reset is
    unavailable until someone adds it (`alter table players add column role
    text default 'player';`).
15. **Two harness changes, both allow-listed rather than global.** `pets`
    joined `run4`'s recording-insert list (with `.single()` unwrapping)
    because the Dragon Elder is minted by an insert and the plain stub never
    lands one; and `channel.send()` now records into an array, because
    "broadcast it ONCE" is a real requirement with no other way to observe
    it. Both are additive — nothing that already passed can behave
    differently.
16. **`run5` gained a v39 sweep** — all three Elder bodies through
    `drawSpecies` and `drawPet`, the Golem Elder through every `drawMob`
    state, the altar and the orb drawn directly and then walked to in the
    live world with real frames pumped. It hard-fails if the Golem Elder or
    the Unicorn Elder was never placed, or if this window's orb was already
    claimed. 803 → **879** coverage draws.

### 2026-08-19 (v38 — the locked v35 spec: minimap, tutorial, reclassing, cosmetics, the Oracle)

Five smaller systems in one version. **The version number is v38, not v35.**
`NEXT_BUILD.md` still pointed at the README's locked "v35" spec, which was
never built — v37 shipped ahead of it — so this is that spec, built late and
numbered where it actually lands. Every claim it makes about the current file
was re-verified before a line was written: none of the five systems existed
(zero occurrences of minimap/tutorial/reclass/cosmetic/oracle in the file),
levelling really is the single `me.level` counter with no XP field anywhere,
and the three landmarks the spec calls "unscheduled" have since shipped in
v37 and were left alone exactly as it asks. Same shape of call v27 made when
its own spec opened "v26 shipped successfully" and v26 had not.

- **The compass is the `.hud` card, reused, and its whole design is an
  omission.** Three rows — TOWER, VOLCANO, SPAWN — and nothing else: no
  coordinates, no scale, no distance, no player dot, and **no base piece,
  ever**. The bible's base pitch is that the world is vast and obscurity is
  your defence, so a minimap that could betray a base would undo an entire
  system. `basePieces` and `baseIndex` are not read anywhere in that section
  and a proof gate greps for both names there, plus a live test that builds a
  real Foundation and proves the compass does not flinch.
- **The only new component in the whole version is the arrow**, a CSS
  triangle rotated to the bearing. It inherits `--ui-scale` and the panel
  language for free, exactly as v33's two base panels did.
- **The bearing is the ON-SCREEN one, not a world-axis compass.** The ground
  plane is isometric, so `atan2(isoY(dx,dy), isoX(dx,dy))` is what makes the
  arrow point where the player is actually looking — the same conversion
  `drawTowerArrow()` has used since v8. Pinned by a gate: standing (10,10)
  south-east of the Tower puts it at exactly −90°.
- **The compass hides inside a cave**, where the grid is the interior's own
  and a world bearing would be a lie. Same rule as v21's breath readout: on
  screen only while it means something.
- **The Tutorial Grounds are two props and one HUD line — no new systems.**
  A marked stone with a pulsing ring and a thin gold beacon (so the very
  first thing a new player is asked to do is findable from across the safe
  zone), and a straw-headed training dummy on a wooden post with a painted
  red-and-cream target. Both are `drawBox` on the locked 0.72/0.55 split,
  both take the standard sun shadow and the `x + y` sort, and both are gone
  from the entity list the instant the tutorial ends. They are the lesson,
  not world furniture.
- **The dummy has no HP, no AI and no loot** — it is scenery that the real
  attack path notices, which is why nothing in the combat code had to learn
  about it. The wolf is an ordinary `WILD_SPECIES.wolf` pushed into `wilds`,
  so the v12 hold-E channel does all the work with no special case.
- **Every step names the real bound key**, generated from `KEYBINDS` like the
  v23 help line. A tutorial that says "WASD" to someone who rebound their
  keys is worse than no tutorial.
- **Cosmetics are drawn INSIDE the unit's own local space**, so a hat flips,
  scales and bobs with the body under it rather than floating beside it. The
  cloak goes down before `drawHeroBody` so the body paints over it; the hat
  goes on after. Flat fills, hard edges, no gradients, no glow, no outline.
- **A hat anchors off the class it is worn on, never a flat offset.** The
  Mystic's hood apex sits nine sheet-units above the Beastmaster's antler
  band, so `COS_HAT_Y` carries a value per class — the same reasoning v28's
  `mountSeatOffsetY()` used when it scaled the rider's lift by `SPECIES_K`.
  All six hats are swept across all five bodies in `run5` for exactly this
  reason.
- **A weapon skin recolours the held silhouette and does nothing else.** Same
  geometry, same weapon, same damage — it replaces one colour argument to
  `drawHeldWeapon` and there is a gate asserting the equipped weapon's `dmg`
  is unchanged while one is worn.
- **The pet accessory is deliberately NOT any of the three existing pet
  overlays.** The gold HP bar means friendly-and-hurt (v16), the slate arc
  means downed, the pale-green pulsing ring means tameable-right-now (v14).
  A collar or ribbon is a fourth thing and wears none of those shapes — it is
  a small flat band at the neck, scaled by that species' own `SPECIES_K` so
  it neither swallows a Sprite nor vanishes on a Golem.
- **The Oracle is a seated hooded seer on the Shrine's own stone.** The dais
  is reused verbatim (`#9a9084` / `#b4ac9e`) because these are the two things
  in the world you walk up to and ask something of, and they should read as
  one civilisation. The figure is deliberately nothing like a player Mystic:
  no legs, a wide seated base, a deep blue robe (`#274b6e`) instead of the
  Mystic's violet, gold hem, and ONE slow orbiting rune rather than the
  Mystic's ring of them.
- **⚠️ The compass sits bottom-left, above the help line.** The Crafting and
  BUILD panels open on that side; at a short viewport with "large" text they
  scroll rather than overlap, but it is the one placement worth a screenshot.
- **⚠️ Nothing in the world marks where the Oracle is.** It is inside the
  safe zone and the compass points at SPAWN, so it is findable — but a new
  player who skips the tutorial has no reason to know it exists. The same
  standing note v22 made about its two unmarked biome pockets.
- **⚠️ Cosmetics have no preview anywhere.** You equip one from the pack and
  find out what it looks like on the tiny in-world sprite. The class-select
  cards already render a full-size animated `drawUnit`, so a preview is a
  call site rather than a rebuild — the most likely thing to want next.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent, plus two things about the repo it
could not have known. All shipped through the full gate (parse clean, `run2`
and `run3` `CAUGHT ERROR: none`, `run4` **729/729 with zero FAIL**, `run5` 990
coverage draws clean, 52/52 grep checks) — refinements to consider, not
unfinished work.

1. **⚠️ The spec is labelled v35 and this ships as v38.** `NEXT_BUILD.md`
   pointed at it, but v37 had already shipped, so numbering this v35 would put
   an out-of-order version in the changelog. Its two stale framing lines — "v34
   shipped successfully" and "Grand Bazaar / Ancient Forge / Ruined Colosseum
   remain unscheduled" — describe other versions, not this one's work, and its
   "explicitly not touched" list is honoured either way: none of those three
   was touched. Everything the spec asserts about `runehaven.html` itself was
   re-verified and still true.
2. **⚠️ A small v38 SQL update is needed** for two of the five to persist:
   `alter table players add column tutorial_done boolean;` and
   `alter table players add column cosmetics jsonb;`. Both degrade cleanly and
   both directions are asserted: with no `tutorial_done` the Grounds replay on
   each login (one keypress to skip), and with no `cosmetics` the worn slots
   reset each session while the cosmetic ITEMS keep persisting in `inventory`
   like every other item. The writes live in their own `savePlayerExtras()`,
   un-awaited and error-swallowing — the v25 `last_fed_at` pattern — so
   `savePlayer()`'s fixed column list never learns about a column that might
   not be there and normal saving cannot break. Same shape of note as v25,
   v33 and v34.
3. **`class` joined `savePlayer()`'s column list.** It is an existing column
   the insert has always written and nothing ever updated, because until
   reclassing existed a class could not change. No schema change.
4. **The compass shows direction and NOTHING else — not even distance.** The
   bible says "general direction only". A distance to a fixed landmark would
   arguably be harmless, but the rule reads as a deliberate limit and the
   cheapest way to honour it is to have nothing else to leak.
5. **Reclassing lives in a new CHARACTER panel on `K`,** the 15th
   `KEYBIND_DEFAULTS` entry and the natural remaining letter after v33 took B.
   The spec says nothing about where a player reclasses; the settings panel is
   login-only, and class is not inventory. The two count assertions were
   **updated, not relaxed** — 14 → 15 bindable actions and 13 → 14 labelled
   rows — so a future pass cannot lose the binding without failing.
6. **Confirmation is a second click on the same row, not a browser dialog.**
   The spec asks for "a confirmation prompt first"; the row arms, states the
   consequence in the panel's own `.craft-row` language, and only then commits.
7. **Cosmetic names beyond the bible's six hats.** The bible names the hats
   exactly and gives only categories for the rest, so Crimson / Azure /
   Verdant Cloak, Gilded / Obsidian Finish and Pet Collar / Pet Ribbon are
   named here. Thirteen items in four slots; adding more is a data change.
8. **Drop rates 4–10%, and 50% from the Elder Drake.** The bible sets none.
   Goblin, Bandit and Boar are deliberately excluded: "earned through
   gameplay" should mean something was actually fought. Every rate is a
   one-line tunable.
9. **Worn cosmetics drop on death, like everything else.** The bible's
   "players drop all items on death" is absolute and a cosmetic is an item —
   so the four slots clear and the items go with the inventory. Following the
   v21 charm precedent exactly, the slots are only pointers, so nothing is
   duplicated.
10. **Cosmetics sync to other players** through one new `cs` field on the move
    broadcast, the same shape `pe` (v28) and `sp` (v29) already use, and
    normalised on arrival so a malformed payload can only ever resolve to real
    cosmetics in their own slots. Showing off is the entire point of a
    cosmetic; a purely local one would be half the feature.
11. **The tutorial's taming step completes whether the tame succeeds or not.**
    The lesson is the channel, and a 50% roll must never be able to strand a
    new player inside step three. Pinned by a gate that forces the resist
    branch.
12. **ESCAPE skips the tutorial and is deliberately not a `KEYBINDS` action.**
    It is the one key v23 made unbindable, so it can never be remapped out
    from under someone who wants out.
13. **`run4`'s tutorial walkthrough restarts a fresh one rather than using the
    boot's.** The v24 gate above it replays the intro card mid-session and
    skips it with Escape, which is also the tutorial's skip key — a collision
    that cannot happen in a real session, since the card only ever plays
    before login. That the tutorial DID start on its own at login is asserted
    separately, through a `tutorialRuns` counter.
14. **`run5` gained a v38 sweep** — every hat on all five class bodies, every
    cloak, every skin across all eight weapon silhouettes, both pet
    accessories on every species and through the real `drawPet` path, the
    Oracle, both tutorial props, and a live tutorial with frames pumped. It
    hard-fails if the props were never alive or the compass drew any number of
    rows other than three. 803 → **990** coverage draws.
15. **Noted, no action taken (pre-existing, outside this spec's scope):**
    `dragonsteel_shield` carries `armor: true` in `ITEM_META` but has no
    `ARMORS` entry, so opening the Inventory while holding one would throw on
    `ARMORS[type].tier`. It predates this version, giving it a `reduce` value
    would be inventing a stat, and v38 touches nothing in that path — flagged
    here rather than fixed silently.

### 2026-08-18 (Elder Drake palette hotfix)

Flagged by the user directly: the drake "looks like a normal goon" despite
the silhouette matching the approved reference. Root cause found by
re-reading this skill's own rule 20: the original palette was five shades
of near-black muddy brown (#2a2622/#403a34/#17140f/#221f1b/#0d0b09) with
only tiny decorative ember accents — a direct violation of "never
desaturated/muddy" and the flat-colour-contrast identity rule. The
reference image's painterly shadow-mood got pulled into the sprite instead
of this game's bold flat-shaded language.

FIXED: same geometry, unchanged — spine ridge, horn, hunched stance, teeth
were never the problem. Body recoloured true near-black (#14100d), and the
spine ridge / horn / tail spikes / vein cracks became bold glowing ember
(#ff7a3c, matching the locked Lava palette entry) instead of tiny dark-on-
dark decoration — real structural contrast, not an accent. Verified via
node before touching main; full gauntlet re-run clean, 591/591.
Dated entries, most recent first. When a build fixes one, mark it FIXED but don't delete it — it's a regression check for the future.

### 2026-08-18 (v30 — Elder Drake, ruin variety, idle-wander, real gathering + Pickaxe)

Four systems in one version. Built in-session after the spec was recovered
from git history — it had been accidentally overwritten by the v32 spec
push while NEXT_BUILD.md still pointed at it, which would have failed the
overnight run with nothing to build.

- **Elder Drake** — the bible's only boss-tier creature, absent from the
  game until now. 900hp/28dmg, one instance, hand-placed near the Volcano
  rather than by the hashed spawn loop (biomes:[] so the loop skips it).
  Guaranteed Dragonsteel. 6-hour respawn. Three phases: normal above 60%,
  a 50-degree cone sweep below it, a 90-degree breath below 30% — both
  specials reuse v27's spear-cone and staff-splash shapes rather than
  inventing new combat code.
- **Ruin variety** — all six ruins previously called one hardcoded layout.
  Now three (original, Collapsed Tower, Sunken Courtyard), picked
  deterministically from each ruin's own anchor so it never changes.
- **Idle-wander** — the old fixed 0.8-tile shuffle became a patrol scaled
  to each mob's own leashRadius, with a real ~3.5s pause / ~3.5s move
  cycle keyed off m.ph so mobs do not drift in sync.
- **Real gathering** — nodes have HP, each press deals the equipped
  weapon's own dmg, so tier already controls mining speed with no new
  stat. Ore needs an axe or pickaxe. Pickaxe added at Iron and Runic
  (Dragonsteel deferred: needs The Ancient Forge, unbuilt). weaponKind()
  checks "pickaxe" BEFORE "axe" — "pickaxe" contains "axe", and the
  unmatched fallback is "sword", so order mattered twice.

Interior cave nodes were deliberately left as a one-press pick — they are
a gathered resource, not something you mine through, and v29/v32's branch
was left untouched.

Three v13/v20 assertions were updated rather than forced: sea_serpent is
still the hardest NON-BOSS mob (which is what it always meant), and the
fixed per-piece ruin census no longer describes a world with three layouts.

JUDGMENT CALLS
- **900hp/28dmg, 6h respawn, MOB_K 3.40** — all unstated; sized so the
  drake is unambiguously the largest and hardest thing in the world.
- **Node HP 30 wood / 40-55 ore** — unstated. Ore tougher than wood.
- **Pickaxe stats (11 and 22 dmg)** — deliberately weaker than the axe
  line in a fight, since their dmg doubles as mining power.
- **Cone angles 50 and 90 degrees** — unstated; wide enough that phase 3
  is genuinely hard to sidestep.

### 2026-08-19 (v37 — the three remaining bible landmarks)

Grand Bazaar, The Ancient Forge and the Ruined Colosseum: named in the
bible from the beginning, the last structures never built, and not
scheduled anywhere on the roadmap until they were spotted missing. Placed
deterministically from worldSeed at worldgen like every other landmark.

- **The Ancient Forge** was the biggest find here. `nearAncient()` had
  existed as a stub returning `false` since dragonsteel recipes were
  written — every one of them was already gated on it, with nowhere for
  it to be true. Making the landmark real turns that gate on. Placed near
  the Volcano, where dragonsteel actually comes from.
- **A real gap caught by the proof gates:** the bible lists SEVEN
  dragonsteel items and only the sword existed — because until this
  version there was no forge that could make any of them. The other six
  (Bow, Axe, Elder Runestaff, Shadow Dagger, Lance, Shield) were added,
  all gated to the Ancient Forge.
- **The Grand Bazaar** is a real safe zone, per the bible's "trading hub
  inside a safe zone". No trading system was invented: the bible says
  item-for-item at players' own risk, which the existing drop/pickup
  already does. Protection IS the mechanic.
- **The Ruined Colosseum** is the deliberate inverse — the one place in
  the game that turns PvP ON, overriding safe-zone protection. Both
  duellists must be inside the ring, so nobody can stand in the arena and
  swing at someone safely outside it.

Art: the Bazaar is a ring of bright canvas stalls (reads as "people
gather here" from a distance against the world's greens), the Ancient
Forge is black basalt with a molten mouth and rising embers, and the
Colosseum is a deliberately BROKEN ring with three collapsed sections and
fallen rubble — ruined, not a clean stadium.

JUDGMENT CALLS
- **Radii 7 / 4 / 9** — unstated. The Ancient Forge's 4 matches
  SPAWN_FORGE's existing crafting proximity exactly.
- **Placement distances (Bazaar 48 from Tower, Ancient 22 from Volcano,
  Colosseum 60 from Tower)** — unstated; chosen so all three are findable
  without being clustered, with separation checks against each other.
- **Dragonsteel stats (30-44 dmg)** — the sword's existing 40 was the only
  reference point; the other six scale around it by weapon type, above
  runic tier throughout.
- **The Colosseum overriding safe zones rather than merely not being one**
  — the bible calls it an open duelling arena, and it would be neither
  open nor an arena if a Safe Zone could ever generate over it.

### 2026-08-19 (v34 — Bases part 2: raiding & generation)

Everything v33 deliberately left out. Structures can now be destroyed,
generators actually produce, and the Architect finally does something.

- **⚠️ A small v34 SQL update is needed.** Two columns:
  `alter table base_pieces add column hp integer;` and
  `alter table base_pieces add column last_collected timestamptz;`
  Everything degrades gracefully without it — a piece with no `hp` reads
  as FULL (never destroyed), a generator with no `last_collected` reads
  as just-collected (never backdated into crediting years of imaginary
  production). Both directions are asserted by real proof gates simulating
  the pre-migration state. Same shape of note as v25 and v33.
- **HP straight off the bible's own words** — 40/90/180/350/800 for wood
  through dragonsteel. "Near indestructible" is 20x a wood wall.
- **`baseHit()` is modeled on `dealHit()`/`mobHit()`**, same broadcast
  discipline. Structures are a third melee target through the SAME attack
  key — no confirmation step, because the bible's raiding pitch is low
  friction. Players and mobs win ties: a wall must never steal a swing
  meant for the person standing behind it.
- **A destroyed chest spills** through the existing `ground_items` path
  rather than silently deleting what was inside.
- **Generator yield is computed on demand**, exactly like
  `salamanderHappiness()` — nothing ticks, nothing runs server-side while
  you are offline, the elapsed time already knows. Capped at 24h so a
  generator neglected for a week does not dump a week at once.
- **Quick Brace redesigned.** "Completes a placement instantly" made no
  sense once v33 shipped — placement was already instant. It now restores
  a damaged piece to full HP within 4 tiles: the same idea aimed at the
  thing that actually takes time, and real defensive value mid-raid.
  Still never throws when nothing is nearby.
- **Two Architect passives**, always on: +20% structure HP and 1.25x
  generation. Stamped at placement, so a piece keeps what it was built
  with even if its owner later reclasses.

A real bug caught by the harness before shipping: the insert was sending
`arch` (a local-only field with no column) and `lastCollected` (wrong case
— the column is `last_collected`), which would have failed against the
real schema. Fixed by building the row explicitly and copying rather than
mutating what the insert hands back.

Two prior assertions were updated rather than forced: v33's exact-six-column
schema check now allows v34's two documented additions, and v27's "the
Architect tie-in is deliberately unbuilt" guard was retired, exactly as
v31 retired its event guards.

JUDGMENT CALLS
- **GENERATOR_RATE 1/1.5/2/3/4 per hour by tier, 24h cap** — the bible
  sets no rate. A trickle you come back to, not a replacement for going out.
- **QUICK_BRACE_R = 4 tiles** — unstated. Close enough to require standing
  with your base, not a map-wide repair.
- **Architect bonuses 1.20 HP / 1.25 generation** — unstated; meaningful
  without making the other four classes feel wrong to build with.
- **Generators are owner-only to collect.** Unstated, but the alternative
  is anyone walking up and emptying yours, which the bible's raiding rules
  already cover through destruction instead.

### 2026-08-18 (v33 — Bases part 1: placement & construction)

The first thing in this world a player builds. Six placeable pieces —
Foundation, Wall, Door, Storage Chest, Forge, Generator — across the bible's
five material tiers. Raiding, destruction, per-piece HP, the Generator's
actual production tick and the Architect class tie-in are v34 and are
deliberately absent rather than half-built. Costs, spacing and persistence
live in the README + commit message; below is only how it all looks.

- **Not one new palette entry.** A piece is tinted with the colour its own
  MATERIAL already has in `ITEM_META` — wood `#a06a34`, stone `#a8a8b2`, iron
  bar `#d0d4dc`, runic stone `#5ac8e0`, dragonsteel `#b06ce0`. That is what
  makes tier legible across a valley without a label, an icon or a badge, and
  it means the bible's "higher material tiers are your backup defence" is
  something you can read off a base from outside it. A dragonsteel wall is
  violet because dragonsteel is violet.
- **Every piece is `drawBox`, on the locked 0.72 / 0.55 facet split.** No new
  shading path, no gradients, no outlines. They take the standard sun shadow
  and sort by `x + y` with everything else, so a player can stand behind their
  own wall and be occluded by it like any tree or rock.
- **The Door is the v20 dungeon-entrance language, in the piece's own
  material** — two jambs carrying a lintel over a flat near-black opening. The
  mouth is dark because it is a dark colour, not because it is blurred. That
  reuse is deliberate: a door has to read as a *gap in the wall run* at a
  glance, and this file already had a shape that says "way through".
- **The Storage Chest is the dev chest's silhouette, and deliberately NOT its
  paint.** Same base box, same slightly-wider lid — but the gold strap and the
  "DEV SUPPLY" label are gone, and the strap is the piece's own material
  darkened. The two must never be confused; one is a ⚠️ DEV-ONLY object.
- **The player Forge is the Spawn Forge shrunk, including its ember mouth and
  its anvil colours (`#3e424a` / `#4a4f58`), reused verbatim.** It is the same
  building, smaller — which is the read, since it does exactly the same job.
  The Spawn Forge keeps its scale, its slate roof and its name plate; nothing
  about it was touched.
- **The Generator is deliberately inert-looking.** A slow, quiet core pulse
  (`sin(t/900)`, alpha 0.28–0.46) rather than a working animation, because it
  produces nothing this version and must not advertise output it does not
  have. When v34 gives it a real tick, that is where the animation earns its
  keep.
- **A bare Foundation carries an inset upper slab.** Without it, a low flat
  box at 3px reads as a painted patch of ground rather than as something
  built — and the Foundation is the one piece you look at before there is
  anything else there to give it context.
- **Both new panels are the existing panel language, reused, with zero new
  component styles.** The BUILD list is the `.craft-row` treatment the
  Crafting panel already uses; the tier picker and both Storage Chest lists
  are `.inv-row`, and the selected tier wears the same gold `.equipped`
  marker an equipped weapon does. Only two lines of CSS were added, both of
  them positions.
- **⚠️ Walls have no orientation.** A Wall is a full-tile block, not an
  axis-aligned panel, so a wall run reads as a row of cubes rather than as a
  continuous barrier. Nothing in the spec asked for rotation and adding one
  means a rotation control and a second silhouette — but this is the single
  most likely thing to want next, and it is the difference between "a base"
  and "a fence made of boxes".
- **⚠️ Nothing marks a base as yours from outside it.** No owner name floats
  over a piece, and the only owner-dependent behaviour in the world is that
  your own Door lets you through. Correct for this version — the bible's whole
  base pitch is that anyone who finds your base walks straight in — but it
  means a Door is visually identical whether it will open for you or not.

## JUDGMENT CALLS THIS VERSION

Calls made where the locked spec was silent. All shipped through the full gate
(parse clean, `run3` `CAUGHT ERROR: none`, `run4` **628/628 with zero FAIL**,
`run5` 803 coverage draws clean) — refinements to consider, not unfinished
work.

1. **⚠️ A small v33 SQL update is needed before anyone can build.** The new
   table is `create table base_pieces (id bigserial primary key, kind text,
   tier text, x float8, y float8, owner text);` — exactly the spec's six
   columns and exactly `ground_items`' shape. Without it, placement refunds
   its materials and says so out loud rather than keeping an unsaved
   structure that would vanish on the next login; everything else in the game
   is unaffected. Same shape of note as v25's `last_fed_at` column.
2. **Storage Chest contents are SESSION-LOCAL.** The spec pins `base_pieces`
   to exactly id/kind/tier/x/y/owner — no contents column, no second table —
   so there is no schema here for what is inside a chest. The chest itself
   persists; what you leave in it does not, yet. Flagged rather than solved,
   because solving it is a schema decision (a JSON column on the row, or a
   `chest_items` table) and inventing one was not this version's job. This is
   the same call v21 made for the charm slot.
3. **Build costs: Foundation 4, Wall 3, Door 3, Chest 3, Forge 5, Generator
   5 — units of the chosen tier's material.** The bible sets no build costs at
   all. Deliberately flat across tiers, so choosing dragonsteel costs you
   dragonsteel rather than *more* dragonsteel. Every one is a one-line tunable.
4. **`BASE_ANCHOR_R = 8` tiles.** "Anchors everything else nearby" had to
   become a number. Eight leaves room for a real structure around one
   Foundation at the spec's 3-tile spacing without letting a single Foundation
   licence a base that sprawls across a region. Tunable.
5. **`BASE_PLACE_DIST = 2` — pieces are raised on the tile you face, two out.**
   The spec says nothing about how a player aims a placement. Two tiles is
   far enough that you can never seal yourself inside your own wall the moment
   it appears, and it reuses `facing`, which every other directional thing in
   this file already reads.
6. **Terrain and interiors are refused as build sites, though the spec names
   only safe zones.** A `BLOCKED` tile is lava, deep water or a peak — nothing
   stands there — and an interior is a different space whose coordinates are
   not world coordinates, so a piece built inside a cave would appear on the
   surface. Only one reading of either is sensible.
7. **Minimum spacing is measured against EVERYONE's pieces, not just your
   own.** The spec says "between any two player pieces". Measuring only your
   own would let two players interleave bases tile-by-tile, which is exactly
   what the rule exists to prevent.
8. **A failed insert refunds the materials rather than keeping the piece.**
   The spec does not cover a write that comes back empty. Keeping it locally
   would show the player a structure that silently vanishes on their next
   login and takes its cost with it.
9. **`B` is the BUILD key, the 14th `KEYBIND_DEFAULTS` entry**, labelled
   "Build" in the remapping screen. It was the only sensible letter still
   unbound after v27 took Q and v28 took R. The two v23/v27/v28 assertions
   that pinned the counts were **updated, not relaxed** — 13 → 14 bindable
   actions and 12 → 13 labelled rows — so a future pass cannot lose the
   binding without failing.
10. **The v27 guard asserting "no base/structure system was invented for the
    Architect" is retired**, exactly as v31 retired its two event guards, and
    replaced by the real proof gates above. What it was actually protecting is
    still pinned: a new assertion checks the Architect's own class tie-in is
    genuinely absent, not quietly half-built.
11. **`run4` and `run5` learned a recording insert stub, scoped by table name
    to `base_pieces` alone.** The shared stub returns the whole table for
    every call, so an insert never lands anywhere — which makes the
    round-trip gate ("insert, then re-select, same data comes back")
    untestable and, in `run5`, leaves every base render branch unreachable.
    Deliberately allow-listed to one table so no existing assertion's
    behaviour can shift underneath it.
12. **`run4`'s Door test flips the stored owner in the stub table and reloads**
    rather than adding an owner setter to the game. That proves both halves of
    the door rule — the owner passes, someone else is stopped — through the
    real persistence path instead of a debug-only shortcut.

### 2026-08-18 (v32 — Abyssal Hollow, reusing v29's interior system)

Second interior-bearing biome. Generalized v29's system rather than
duplicating it, specifically so Dungeons can be the third without another
rewrite: `uwcaveClusterAnchor()` became `clusterAnchor(tx,ty,biomeConst)`,
`enterInterior()` took a biome parameter (defaulted, so every v29 call site
still works), and space ids became `cave:<kind>:<anchor>`.

- Abyssal interiors read colder and near-black against the cave's
  blue-grey, with violet bioluminescence instead of cyan.
- Shadow Dragon moved INSIDE — `biomes: []`, no surface spawn, same as
  Water Dragon in v29. Moved, not duplicated.
- No hostile mob inside the Hollow: Sea Serpent is a UWCAVE creature and
  the bible names none for the Hollow, so inventing one was declined.
- `void_shard` added as the Hollow's resource. The bible names "rare
  aquatic resources" for Underwater Caves but nothing for the Hollow, so
  this is a deliberate new addition, flagged as such rather than presented
  as implementing something already specified.

Three issues found and fixed, none of them in the game logic:

1. A debug teleport did not reset `me.space`, so a harness that walked
   into a cave earlier in its sequence ran every later check from inside
   one — six breath assertions failed from that single cause.
2. The dive test picked its "shore" tile as anything not DEEP/PEAK/LAVA,
   which now matches ABYSSAL — a doorway, not standable ground. The player
   was teleported onto one and correctly pulled in. Test selection fixed;
   the game behaviour was right.
3. The interior debug hook ignored the biome parameter, so entering an
   ABYSSAL tile still searched for a UWCAVE cluster and found nothing.

One assertion was deliberately retargeted rather than forced: the gather
plumbing is already proven by v29's identical test, and `doInteract()`
will prefer taming the Shadow Dragon that also lives in the interior if it
is the nearer target. The v32 change is which resource the node carries,
so that is what is asserted.

JUDGMENT CALLS

- **`void_shard`** — name, colour, and existence all invented; no bible
  text to implement. Flagged as new content, not interpretation.
- **No mob in the Hollow** — declining to invent one, rather than reusing
  Sea Serpent somewhere it does not belong.
- **Same 3-5 node count and 26x26 grid as v29** — no reason to differ, and
  differing would have been an unstated change.

### 2026-08-18 (v31 — Blood Moon and Meteor Shower)

Both world events, built in-session. Deliberately derived rather than
broadcast: each is a pure function of worldEpoch + worldSeed, so every
client computes the same Blood Moon on the same night and races for the
same meteor rocks, with no new table, no new channel, and no authority
problem over who "started" the event.

- **Blood Moon**: `worldDayNum() % 12 === 0` and night. Mobs get x1.35 hp
  and damage, x1.5 aggro radius ("more aggressive"), and rare species get
  +0.30 on their presence roll — which is the roll that decides whether a
  Shadowfox/Unicorn/Lightfox exists at all this session, so the bible's
  "increase significantly" lands where it actually matters.
- **Meteor Shower**: hashed per 15-minute slice at a 12% chance, so it is
  genuinely unpredictable to a player but identical for every client. The
  sites are hashed off the same slice, which is what makes the bible's
  "scramble to reach them first" a real race — everyone sees the same
  fourteen rocks. They are FINITE, so the first player there claims it.
  None land in a safe zone.

IMPORTANT NAMING NOTE: `bloodDecayFrac()` further up the file is NOT this.
That is the v12 PvP-kill tame window and only shares the word "blood".
Checked before writing a line, and deliberately named `bloodMoonActive()`
so the two can never be confused by a future version.

Two v27/v28 guard assertions asserting these events had NOT been started
were retired on purpose and replaced with real proof gates.

JUDGMENT CALLS

- **x1.35 mob hp/dmg** — "stronger" is unquantified in the bible. Enough
  to feel it, not enough to make a Blood Moon night unsurvivable. Tunable.
- **x1.5 aggro radius** — the mechanical reading of "more aggressive".
- **+0.30 presence roll** — applied to presence rather than count, so the
  effect is "the rare thing is actually out tonight" rather than "there
  are more of a thing that already spawned".
- **15-minute slices at 12%** — "randomly with no fixed pattern" needed a
  concrete shape. Averages a shower every couple of hours. Both tunable.
- **14 sites per shower** — enough to be a real scramble on a 240x240 map
  without blanketing it.
- **Meteor ore yields runic_stone** — the bible says "rare ore" without
  naming a new material, and inventing one would be unstated content.

### 2026-08-18 (v29 — real cave interiors, Underwater Caves as the proof of concept)

Built directly in-session, same as v28. Genuinely new architecture — the
first system in the game where a player's position isn't just an x,y on
the one shared grid. Underwater Caves stop being a tinted patch of ocean
tile and become an actual place you walk into, generated on demand,
shared with anyone else who finds the same entrance.

- One field, `sp`, added to the move broadcast. The receive side already
  processes every broadcast on the one channel; it now skips rendering or
  colliding with anyone whose space doesn't match. No second channel, no
  new sync system — confirmed and asserted directly, not just claimed.
- Each interior is a 26x26 grid generated once from a seed derived from
  the physical cave's own connected-cluster anchor plus `worldSeed` —
  nothing stored server-side, and two players entering the same cave get
  provably identical geometry (asserted by regenerating from a cleared
  cache and diffing every tile).
- Entry hooks the exact moment breath already stopped draining on a
  UWCAVE tile — no new detection, the interior IS the air pocket that
  moment was always describing.
- Water Dragon and Sea Serpent moved inside — removed from the surface
  `biomes: []` entirely, not duplicated. Confirmed absent from the
  surface and confirmed present inside, both directions asserted.
- `aquatic_essence` — the bible's "rare aquatic resources," promised since
  the biome list existed and unbuilt until now.

A real bug found and fixed before this shipped: `me.space` was never
initialized on player construction, only ever set inside `exitInterior()`.
Every player counted as "inside a cave" from the moment they logged in,
which silently broke breath everywhere. Fixed by making the interior check
treat an unset space as "main" rather than trusting every construction
path to remember a new field — six failing assertions, one root cause.

A second, smaller issue: the debug hook for entering a cave called
`enterInterior()` directly without first honoring the precondition its
only real call site guarantees — that the player is already standing on
the entry tile. Fixed the hook, not the game logic, which was correct the
whole time.

JUDGMENT CALLS

- **26x26 interior size** — unstated. Big enough to feel like a real
  space, small enough to generate and render cheaply. Tunable.
- **3-5 aquatic_essence nodes per interior** — the spec's own range,
  implemented as `3 + hash(...) * 3`.
- **A single Water Dragon and single Sea Serpent per interior**, not a
  population — matches how rare and dangerous finding one should feel,
  distinct from a normal wilds density.
- **The exit tile sits at the arrival corner**, not somewhere separate —
  simplest correct choice for a first version; nothing stops a future
  version from making entry and exit different points.

### 2026-08-17 (v28 — full mounting, all nine bible species)

Built directly in-session rather than overnight. Mounting had been deferred
five separate times (v16/v17/v18/v19/v21) and then lost entirely once — a v26
spec was written, never verified as built, and quietly overwritten while the
conversation moved on. This is the same design, re-verified line by line
against the real post-v27 file before a single edit.

- `MOUNTABLE_SPECIES` — the bible's nine, exactly: stag, griffin,
  crystal_golem, the four dragons, shadowfox, lightfox.
- `R` joins `KEYBIND_DEFAULTS` as `mount`, so it inherits the v23 remapping,
  conflict-checking and persistence with no new code. Nothing hardcoded.
- `MOUNT_SPEED_MULT = 1.6`, applied only to the player's own movement — it
  multiplies alongside the existing SLOW/blocking factors rather than
  replacing them.
- `mountSeatOffsetY()` scales the rider's lift by the mount's own SPECIES_K,
  because a lightfox (1.05) and a shadowfox (1.66) genuinely do not sit the
  same height off the ground. Flat offsets were rejected for that reason.
- `updatePet()` early-returns the pet to the rider's own tile while mounted —
  no trailing, no circling glide — and the proof gate asserts BOTH directions:
  seated while mounted, trailing again after dismount, so the suspend is real
  and not just a coincidence of starting position.
- `updatePetCombat()` returns early while mounted. A mount lunging at things
  mid-ride isn't bible-required and reads wrong.
- `mo` on the move broadcast, so remote players see a rider seated rather
  than a rider standing next to a pet.
- `enforceMountValidity()` runs every frame: swap or lose the active pet and
  the rider is dismounted rather than left in a state pointing at nothing.

JUDGMENT CALLS

- **`MOUNT_SPEED_MULT = 1.6`** — unstated anywhere. Fast enough to be the
  real reason to mount, slow enough that the world doesn't shrink. Tunable.
- **`2.2` seat base** — the multiplier on SPECIES_K. Chosen so the smallest
  mount still clearly carries the rider and the largest doesn't float.
- **The v27 class ability works while mounted.** The original v26 draft could
  not have accounted for this — abilities did not exist yet. Blocking it
  would have been unstated scope, so it follows the same rule as combat:
  fully allowed, and there is now a proof gate asserting it fires.
- **`R` over any alternative.** Q went to the ability in v27; R was the only
  remaining letter that reads as "ride" and collides with nothing.

### 2026-08-16 (v27 — five class abilities + real spear/staff identity)
No new species, no new biomes, no world colour touched, and not one existing
draw call altered. v27 is a mechanics version — the cooldowns, the damage
multipliers, the cone angle and the counterplay rules live in the README + this
commit message. Its whole rendering scope is **one new effect and one HUD
line**, and both are things that already existed being pointed somewhere new.
- **The AOE ring is `aura()`, reused, with exactly one thing added: `rx`
  grows.** The v18 helper (pulsing radial wash + ground ellipse + rising
  diamond motes) was written to be reused and this is the first time anything
  has. Feeding it a radius that scales with the effect's own 0→1 life is what
  turns a standing wash into a ring travelling outward; nothing inside `aura()`
  was touched, and no second effect system was built. Radius is in **tiles**
  converted at `IW2` — the tile half-width — which is what plants the ring on
  the ground plane instead of floating it at an arbitrary pixel size.
- **Two rings, one code path, deliberately the same violet.** Mystic's Arcane
  Burst draws at 4 tiles, a staff orb's splash at 2, both in `#9670dc` — the
  Mystic's own lit palette colour, as `"150,112,220"` because `aura()` wants a
  triplet, not a css colour. They read as the same magic because they *are* the
  same magic: the class most associated with area damage, and the weapon that
  class carries. A staff splash in a different hue would have read as a second,
  unrelated system.
- **The ring draws after the entity pass and before the damage numbers** — over
  the ground it covers, under the numbers it caused. Its alpha falls to zero
  across its 520ms life, so it never lingers as a decal.
- **The staff splash got a ring even though the spec only asked for one on the
  Mystic.** This is the v18 wraith-bolt lesson again: a body dying 2 tiles away
  from where the orb landed has no visible cause otherwise. Same helper, same
  colour, smaller radius — a flagged call, not an addition to the art language.
- **Ability feedback is the v9 floating-text language, not new HUD chrome.**
  `GUARD BREAK` / `MARKED` / `ARCANE BURST` / `RALLY` / `QUICK BRACE` on cast,
  and `GUARDED` on a hit the Knight's window absorbed — each in its own class
  palette colour, in exactly the shape `POISONED`, `BLOCKED -n` and `RECOVERED`
  already use. No new panel, no new bar, no aura on the character.
- **The HUD help line gained `Q class ability`,** generated from `KEYBINDS` like
  every other entry since v23, so it follows a rebind instead of lying about it.
  The static fallback string in the markup was updated to match.
- **⚠️ There is no cooldown readout anywhere.** Five abilities now sit on
  cooldowns from 7s to 12s and the only feedback that one is ready is pressing
  Q and having something happen. That was not in the spec and no HUD element
  was invented for it, but it is the single most likely thing to want next —
  and it is a HUD line, not a rebuild, since `debugAbilityInfo()` already
  exposes every timestamp it would need.
- **⚠️ Nothing distinguishes a Knight standing inside a Guard Break window.**
  The cast floats once and then the buff is invisible until a hit lands on it.
  Deliberate — the v12 rule that buffs are private and carry no character aura —
  but worth a look now that an *enemy* has a reason to care (Marked Shot exists
  specifically to punch through it, and a Ranger cannot see what they are
  punching through).

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, plus one thing the spec asserted
that is not true of this repo. All shipped through the full gate (parse clean,
`run3` `CAUGHT ERROR: none`, `run4` **528/528 with zero FAIL**, `run5` 792
coverage draws clean) — refinements to consider, not unfinished work.
1. **⚠️ The spec opens "v26 shipped successfully". It did not — v26 was never
   built in this repo.** `runehaven.html`'s last build commit is **v25**, this
   skill's newest entry before today was **v25**, and there is no mounting code
   and none of the v26 species in the file. v27 was built anyway, and
   deliberately, because **v27 does not depend on v26 for anything**: every
   claim it makes about the current code was re-verified directly before a line
   was written — `tryAttack()`'s universal 1.6x backstab crit and per-type
   knockback weights (`axe` 1.1 / `spear` 0.6 / `sword` 0.55 / `dagger` 0.2)
   are exactly as described and untouched, `CLASSES` really was palette plus
   flavour text, spears really did hit one target, staves really did fire a
   single-target `"orb"`, `aura()` is present, and Q really was unbound. Nothing
   in v27 references mounting or the v26 species. **If v26 was meant to ship
   first, it is still outstanding and this version does not block it.**
2. **Arcane Burst deals the equipped weapon's damage, unscaled.** The spec
   locked the 4-tile radius and the `dealHit`/`mobHit` route but named no damage
   number. Using `equippedWeapon().dmg` keeps it inside the existing damage
   economy and lets it scale with gear like everything else, instead of adding a
   flat constant that would be strong at iron tier and worthless at dragonsteel.
   One line to change if a fixed number or a multiplier was wanted.
3. **Marked Shot does NOT consume the Knight's Guard Break window.** The spec
   says a Marked Shot "cannot be blocked by" the window — it does not say
   whether it strips it. It punches through and leaves the guard standing for
   the next ordinary hit, which is the reading that makes the pair genuine
   counterplay rather than a dispel. `run4` pins both halves.
4. **Knockback for the two new AOE paths: 0.3 (burst) and 0.15 (splash),
   tunables.** Unspecified. Both deliberately lighter than a committed melee
   swing, since neither is one. The spear thrust keeps v10's existing `0.6`
   spear weight exactly — the spec said not to touch that table and nothing did.
5. **Rally Companion loads its 3 charges whether or not a companion is out.**
   The spec gates nothing on having one, and the charges are spent inside
   `updatePetCombat()`, so with no pet nothing spends them and nothing breaks.
   Casting it petless burns the 9s cooldown for no effect — the same shape as
   Architect's deliberate no-op, and arguably the same thing to revisit.
6. **The rally bonus multiplies the post-Beastmaster damage.** A Beastmaster's
   own +20% passive (`PET_BM_BUFF`, v16) is already baked into `def.dmg`, so
   +40% lands on top of it: a rallied wolf is 4 → 5 → 7. Adding the two as one
   +60% instead would have been the other reading; this one keeps the passive a
   passive.
7. **The `ability` action is the 12th `KEYBIND_DEFAULTS` entry, labelled "Class
   ability" in the remapping screen.** The two v23 `run4` assertions that pinned
   "11 bindable actions" were **updated, not relaxed** — the count, the default
   table and the check-site list all moved to 12, so a future pass cannot lose
   the binding without failing. (Aside: the spec's parenthetical says the
   current defaults include `r`. They do not, and never have — there are eleven
   and `r` is not one of them. Q was unbound either way, which is the part that
   mattered.)
8. **`debugSetPlayer()` gained `cls`, `equipped` and `armor`; three new hooks
   joined it.** `debugAbilityInfo()` / `debugSetAbility()` are copies and a
   setter in the v21/v23/v25 pattern. `debugCombatHandles()` is the deliberate
   exception: it returns **live** `others` / `mobs` / `projectiles`, because
   PART D's gates have to stand real targets in the world to prove a burst, a
   thrust and a splash hit more than one of them. Same reasoning
   `debugAudioEngine()` used for its live handle.
9. **`run4`'s v27 block reads `window.performance.now()`, never the bare Node
   global.** The game runs on jsdom's clock and the harness on Node's; the two
   have different time origins, so mixing them made every ability-window
   comparison silently wrong. Found and fixed during this build — worth knowing
   for any future gate that asserts against a timestamp.
10. **`run5` gained an ability-ring sweep** — all five classes cast for real
    with frames pumped while a ring is alive, plus the staff splash's own ring,
    and it hard-fails if no ring was ever alive (the render branch is
    unreachable in the plain 5-frame boot). 758 → **792** coverage draws. No
    species, mob, weapon kind or class was added this version, so the existing
    `*_LIST` arrays are already complete.

### 2026-08-15 (v25 — Crystal Golem, Krakenling, Salamander King)
Three new species, no new biomes and no world colour touched. All three bodies
are approved concept art from the locked spec, **ported verbatim** into the
existing `P`/`EY` helper convention in the `drawSpecies` chain — not redrawn,
not reinterpreted. Spawn gating, stats and the feeding mechanic live in the
README + commit message; below is only how they look.
- **Crystal Golem** (Rare, mountain ruins). Deliberately the *same silhouette*
  as the young Golem — same blocky two-facet body, same head slab, same arm
  blocks — re-cut in pale crystal (`#9fc4e8` / `#5a7fb0`, `#d4e8f8` top facet).
  That sameness is the point: it must read instantly as "a Golem, but made of
  something else", the bible's own framing. The tells that separate them are a
  **violet core glow** (`#e8a8f8` + a soft square halo) where Golem has its
  runic-cyan eye, **facet lines** where Golem has cracks, a white shine facet,
  and **no moss** — moss is the old-stone Golem's signature and must never be
  added here.
- **Krakenling** (Epic, Abyssal Hollow). Deep-violet mantle (`#5a3a6e` /
  `#7a5a92`) over five tentacles that sway on a per-tentacle sine offset, big
  pale eyes, and three slow-pulsing bioluminescent dots along the mantle. It is
  the only cephalopod in the game and shares nothing with the dragon bodies it
  lives beside on `B.ABYSSAL` — at that depth the Shadow Dragon is the only
  other thing down there, so the two must not converge.
- **Salamander King** (Epic, Sunforge Caldera). Long, low and horizontal —
  molten orange (`#d84a28` / `#f07038`) with a dark `#8c2c14` jaw, a three-peak
  **gold crown ridge** (`#f4c020`) that is what makes it a *King* rather than a
  big lizard, matching gold belly marks, and a single hard heat-shimmer stroke.
  Its palette is the Caldera's own (`#f2c884` ground), so it reads as native to
  that biome rather than dropped onto it.
- **One branch, both forms.** The Salamander King's hostile rampage form draws
  from the exact same `drawSpecies` branch as the tamed companion, via the v14
  `def.tameable` route in `drawMob` — same creature, same art, which is the
  whole point of a pet that can turn on you. It therefore inherits the walk
  bob, sun shadow, `x+y` depth sort, the amber "!" wind-up tell, the red mob HP
  bar and the pale-green weakened tame ring with no per-species special casing.
- **Companion panel**: the Salamander King's row carries a `N% fed` readout.
  Below 30% it flips to the HUD's existing low-HP language — the same
  `var(--danger)` red, the same "this is going wrong" read — plus a "feed it!"
  nudge. This is deliberately **not** new panel chrome, and it is **not** the
  pet HP bar, the downed ring or the tame ring: happiness is a fourth state and
  reuses the low-HP colour only, never those shapes.
- All three are ground species, so they take the standard walk bob, sun shadow,
  depth sort and every v16 combat overlay unchanged. `SPECIES_K`: Crystal Golem
  1.50, Krakenling 1.10, Salamander King 1.20.

## JUDGMENT CALLS THIS VERSION
Five, all flagged in code at the site of each. Everything here shipped through
the full gate (parse, run3 clean, run4 476/476 with zero FAIL, run5 clean) —
this is a complete version, and these are refinements to consider, not
unfinished work.
1. **Crystal Golem's `SPECIES_K` is 1.50, not the spec's literal 1.15.** The
   spec asked for both "1.15" and "slightly smaller than regular Golem's
   existing entry — confirm against Golem's actual current value and stay close
   to it, don't invent a wildly different scale". Golem is **1.65**. 1.15 is not
   slightly smaller than 1.65; it is Stag's value, a deer, and would have made
   the Rare variant a third smaller than the Uncommon one it is meant to read as
   a rarer sibling of. The confirm-against-the-real-value clause is what caught
   it, so it won. **One-line revert if the smaller silhouette was intended.**
2. **The Krakenling art's branch head was changed from `kind ===` to
   `species ===`.** The drawing body is untouched, exactly as specified. The
   spec placed the branch "alongside the other wild species checks", and that
   chain dispatches on `species` — there is no `kind` in scope anywhere in
   `drawSpecies`, so `kind === "krakenling"` would have thrown on every frame.
   Krakenling is a wild pet, not a mob, so `drawMob`'s `m.kind` chain was not
   its home either. Only one location was ever possible.
3. **Crystal Golem's tame base is 0.25, but not "matching Golem's".** The spec
   said 0.25 "matching Golem's"; Golem's actual base is **0.50**. 0.25 was kept
   because it is the Rare-tier baseline every other Rare pet in the file already
   uses (Unicorn and all four dragons) — the number is right, only the stated
   reason was wrong.
4. **Every rostered Salamander King is checked for starvation, not just the
   active one.** The spec gated *feeding* on being the active companion but did
   not say which pets the rampage check walks. Checking only the active one
   would mean a benched King rampaged the instant it was brought back out, with
   no way to have prevented it. Feeding still works exactly as specified — select
   the pet, then Feed.
5. **`last_fed_at` persistence degrades instead of failing.** The feed clock is
   written to a `last_fed_at` column on the `pets` table, un-awaited and
   error-swallowing, and falls back to `tamed_at` (which *is* the spec's
   "tame-time on capture") when the column is absent. **A small v25 SQL update
   is needed for feeds to survive a reload** — `alter table pets add column
   last_fed_at timestamptz;` — but the game is fully playable without it and
   nothing can throw either way.

Also noted, no action taken: the bible **does** list Crystal Golem on its
MOUNTABLE PETS line, where the spec said it did not. No riding code was added
anyway, because riding is deferred for *every* species alike — the same
standing position v21 and v22 recorded for the dragons. Nothing to revisit until
mounting itself is built.

### 2026-08-13 (v24 — the intro card + real background/combat music)
No new species, no new biomes, no world colour touched. The rendering scope of
v24 is one screen that plays before the game does; the music rotation, the
combat switch and the audio file layout live in the README + commit message,
not here.
- **The intro card is a COVER, not a screen of its own.** The login card is
  already built and sitting underneath it — the same pattern the death and
  settings overlays use — so the card's *exit* is the crossfade rather than
  something that happens before one. Measured in real Chromium: at 2040ms the
  card is at 0.57 and the login at 0.43, at 2160ms 0.25 / 0.75. If those two
  ever stop overlapping, the crossfade has been broken back into a cut.
- **Pure typography, no image assets**, in the login screen's own language:
  Almendra Display gold for the two named lines, dim letter-spaced Barlow for
  the connective one, over the login's dark ground with the same warm radial
  behind it. Nothing here is new art — it is the logo treatment, reused.
- **Three lines, and the sentence itself is untouched**: "Hashbrown Studios" /
  "in collaboration with STG Records presents" / "RuneHaven". The line is the
  locked copy word for word; only where it wraps was a choice.
- **700ms fade+scale in (0.86 → 1), 1200ms hold, 700ms fade+scale out (1 →
  1.07)**, all on one eased `cubic-bezier(.22,.68,.28,1)` — never linear, and
  the exit deliberately mirrors the entrance rather than inventing a second
  motion. Traced frame by frame in real Chromium on a cold load.
- **BUG FOUND AND FIXED BY EYE: the login screen was briefly visible at load.**
  The transition sat on `#login` itself, so the initial hide *animated* — for
  the first few hundred ms you watched the login fade out underneath a card
  that had not faded in yet. The hide is now instant (`body.intro-hide`) and
  only the reveal is transitioned (`body.intro-exit`). Lesson, and it is the
  v9 draw-order lesson again in CSS: a transition you only want in one
  direction has to be scoped to that direction.
- **BUG FOUND AND FIXED BY EYE: the fade-in never ran at all.** The card comes
  out of `display: none`, and Chromium starts no transition from a
  display:none before-change style — so the entry class and the class that
  animates away from it collapsed into one and the card simply popped in. A
  `requestAnimationFrame` was NOT enough; it takes a synchronous layout read
  (`void introEl.offsetWidth`) to commit the entry state first. **Both of
  these looked completely correct in the harness** — jsdom has no computed
  transitions — which is exactly why they were caught in a browser and are now
  pinned by source assertions in `run4`.
- **Any keypress or click skips it, and the skip cannot fall through.** The
  card is the click target while it is up, the handler is inert once the exit
  has started, and `intro-lock` keeps the login's `pointer-events: none` until
  the card is fully gone. Proven, not assumed: `run4` clicks with a counter on
  the ENTER button, and the real-Chromium pass clicks at the exact coordinates
  of ENTER underneath — 0 triggers both times.
- **It plays every page load, deliberately.** No localStorage skip-forever,
  and `run4` asserts the intro code touches no storage at all.
- **⚠️ Nothing about the music is visible.** There is no now-playing readout,
  no audio cue in the HUD, and no visual tell that the combat track has taken
  over. That was not in the spec and is not obviously wanted, but it means the
  only feedback that the rotation is alive is the sound itself.
- **⚠️ The card is never seen by a returning player any differently.** It is
  the same 2.6s every load, skippable, with no shorter second-time variant —
  which is what "plays every time" asks for, but is the first thing to want
  changed if it starts to feel long.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, or where it explicitly asked to be
told. All verified through the full gate (420/420 in `run4`, zero FAILs, `run3`
and `run5` clean) plus a real-Chromium pass — refinements to consider, not
unfinished work.
- **The track roles are the spec's own proposal, shipped as proposed and
  flagged here because the spec asked for exactly that.** `nu_metal.mp3` is the
  combat track; `Pop` / `Slower_Jamz` / `Long_Way_Home` / `song` are the
  four-track rotation, in that order; the sixth file is held out of both. If
  any of those roles is wrong, changing it is one line in `BG_PLAYLIST` or one
  string in the loop check — nothing else in the wiring depends on which file
  is which.
- **The held-out sixth track's filename appears nowhere in `runehaven.html`,
  not even in a comment.** That is what lets its gate be a blunt "this string
  is not in the file" rather than a judgement about what counts as wiring.
- **Line 2 carries "presents"** rather than giving it a fourth line of its own.
  The spec allowed 2–3 lines; a studio line, a connective line and the title is
  the shape that fits in three without splitting the title away from it.
- **Timings 700 / 1200 / 700ms** — inside the spec's 0.6–0.8 / 1–1.5 / 0.6–0.8
  windows, and picked at the middle rather than the edges. The **250ms skip
  exit** is not in the spec at all: a skip that took the full 700ms would not
  read as "straight to the login screen", and both halves of the crossfade are
  driven off that one number so they can never drift apart.
- **`z-index: 50`, above even the settings overlay's 40.** The card covers the
  whole app while it is up, and the settings panel is unreachable underneath it
  by definition.
- **The card scales with the v23 `--ui-scale` lever** — `#introCard > *` joins
  the existing zoom rule. Same decision v23 made for the two full-viewport
  overlays: the children scale, never the overlay.
- **The music check lives at the end of `update()`**, the per-frame game logic,
  with `musicCheckAt` as a next-check timestamp ~1s out. The spec said "in the
  main game loop... throttled to roughly once a second" and gave no mechanism;
  a timestamp is the same shape as every other throttle in this file, and
  `run4` asserts a second check inside the window re-fetches nothing.
- **Three new harness hooks** — `debugIntroInfo()`, `debugMusicInfo()` and
  `debugSetMusicState()`, beside the v21/v23 ones. The intro and playlist state
  are all top-level `let`s, which never land on `window`; copies, except the
  setter, which exists so the combat gate can place a linger window without
  waiting six real seconds.
- **Two v23 `run4` assertions were updated, not relaxed.** "No imagined
  music/SFX trigger points" pinned `playMusic` at *zero* call sites, which was
  the correct v23 state and is exactly what v24 was asked to change; it is now
  pinned at two (rotation + combat switch), with SFX still pinned at zero
  because no sound-effect files have been provided. The ENTER-gesture assertion
  follows `init()` into its new `if (AudioEngine.init()) playNextBgTrack();`
  shape and additionally pins it as the only `init()` call site in the file.
- **`AudioEngine` itself was not touched**, as instructed — the rotation is a
  layer on top. The one edit inside it is a three-line comment that said
  nothing in the game calls `playMusic` on purpose, which stopped being true.

### 2026-08-12 (v23 — QOL: settings menu, accessibility, credits, favicon)
No new species, no new biomes, no change to a single world colour. v23 is
quality-of-life and infrastructure — the keybind config object, the audio
engine and the persistence layer live in the README + commit message. Below is
only what changed about how the game LOOKS.
- **The settings panel is the existing panel language, reused, not a new one.**
  Dark `--panel` card, `--panel-edge` hairline, Almendra Display gold header,
  Barlow body, the same 5px radius and blur as Inventory/Crafting/Companions.
  The only new component is the tab strip, and it is the class-card selection
  treatment (gold border + gold text on the active one) at button scale. A
  settings menu that invented its own visual language would read as a
  different program bolted onto the game.
- **The entry point is a bordered text button under the tagline**, not a bare
  gear glyph — `⚙ SETTINGS` in dim text with a `--panel-edge` border that goes
  gold on hover, which is the login card's own idiom (`#connectBox summary`).
  It sits between the tagline and the name field, in the one place on that
  card where nothing had to move to make room.
- **Text size is ONE root-level lever, `--ui-scale`.** Small 0.88 / medium 1 /
  large 1.18, applied as `zoom` to the HUD, the panels, the toast, the HP bar,
  the settings card and the CHILDREN of the two full-viewport overlays. The
  children, not the overlays themselves, so `#login` and `#deathOverlay` keep
  their own full-screen flex layout and only their contents grow.
- **`#login` gained `justify-content: safe center`.** At "large" the login card
  outgrows the viewport, and centred flex content clips at the TOP of a scroll
  container instead of scrolling to it — the logo and the name field were
  unreachable. `safe` falls back to start-alignment only in the overflow case,
  so the default screen is pixel-identical. Verified in real Chromium at
  1280x820 both before and after.
- **Colourblind mode moves the GREENS and never the reds.** Deuteranopia kills
  red-vs-green; red-vs-blue survives it, so every pure green that pairs against
  a red becomes `#4bb8e8` — the mob HP bar (against `#c84838`), the weakened
  tame ring and its name tag, the HUD HP numbers, the player HP bar fill and
  the connection dot. The reds stay exactly where they are: shifting both ends
  would have been a whole second palette to keep coherent. Canvas side is
  `tameCol()` / `tameRgb()`, CSS side is the `body.cb` rules — two halves of
  one decision, change them together.
- **The gold pet HP bar and the gold-green downed arc were deliberately left
  alone.** Neither of them reads against a red — the v16 rule is that gold
  means friendly and red means hostile, which is exactly the distinction that
  survives deuteranopia already. Recolouring them would have cost the v16
  read for nothing.
- **Reduce motion is one honest toggle over the AMBIENT spawner only** — the
  motes, fireflies, embers, snow, butterflies, bugs and the forge chimney
  smoke. Combat, death and dive particles are untouched, because those are
  feedback: a player who cannot see a hit burst cannot read the fight. One
  switch serving both low-end performance and motion sensitivity, as specced,
  and it drains the existing particles rather than snapping them off — `run4`
  pins it at zero ambient particles alive after 11 simulated seconds.
- **Credits are the panel treatment again**, a dim letter-spaced role over the
  name, and both the credits list and the Collaborations list build from data
  arrays so swapping real names in is a one-line change, never a markup edit.
- **The STG Records logo keeps its `#e8e4da` backing and 6px padding.** The
  mark is near-black line work on a near-black field; on the dark panel
  without the pale plate it renders as an empty square. Confirmed by eye in
  real Chromium — the coin reads clearly on the plate. **Do not remove it.**
- **Favicon**: the approved hashbrown mark, icon only, embedded as the
  pre-built two-size (16 + 32) `.ico` data URI. No splash, no animation —
  that is explicitly a later version once the rest of the logo set arrives.
- **⚠️ The settings panel is reachable from the login screen and nowhere
  else**, which is exactly what the spec scoped. Once you are in the world the
  gear is gone with the login card, so a player cannot rebind a key, change
  text size or mute the game mid-session. This is the single most likely thing
  to want next; the panel itself is already a fixed overlay at `z-index: 40`
  above everything, so surfacing it in-game is a hotkey and a HUD button, not
  a rebuild.
- **⚠️ Nothing in the world canvas was seen rendered this version.** The login
  screen and all five settings sections were screenshotted in real Chromium,
  but entering the world needs live Supabase creds, so the colourblind swap on
  the tame ring / mob HP bar and the text-size lever on the HUD are proven by
  assertion (`run4`, `run5`) and not by eye. Worth one screenshot next to a
  weakened creature with the toggle on.
- **⚠️ `zoom` scales padding and borders with the text, not just glyphs.** That
  is what keeps the HUD boxes proportioned instead of bursting, but it means
  "large" is really a UI scale. On a short viewport the panels are `max-height:
  70vh` scrolling already, so nothing is cut off — but a very small screen at
  "large" will have the HUD taking noticeably more of it.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, or where following its wording
literally would have shipped a half-applied feature. All verified through the
full gate (371/371 in `run4`, zero FAILs, `run3` and `run5` clean) —
refinements to consider, not unfinished work.
- **"11 keybind check sites" is 11 bindable ACTIONS across 13 lines, and all 13
  were converted.** The spec's own enumeration lists twelve checks for eleven
  actions — `interact` is checked twice, once as a single-press action and once
  as the held key that sustains the taming channel. On top of that its list
  omits the two keyup twins (`cancelTaming` on interact-up, `sendMove` on
  block-up, plus the raw `e.key === "Shift"` compare). Leaving those literal
  would have shipped a rebind that half-applies: rebind interact and the taming
  channel never cancels; rebind block and the pose never drops. Every site that
  keys off one of the 11 actions now reads `KEYBINDS`, and `run4` greps the
  source for both halves — the new lookups present, the old literals gone.
- **The arrow keys stay hardcoded as a second movement binding.** They are not
  one of the 11 actions and the spec said every other line at each site stays
  as it is, so `keys[KEYBINDS.up] || keys["arrowup"]` is the shape. Asserted, so
  a future pass does not "finish" them by accident.
- **Text size is `zoom: var(--ui-scale)`, not a root font-size.** Every size in
  the stylesheet is a px literal, so changing the root font-size moves nothing
  without rewriting each rule — which is the per-element override the spec
  explicitly ruled out. One custom property on `:root`, one rule, no duplicated
  numbers. 0.88 / 1 / 1.18 are tunables.
- **`#4bb8e8` for the colourblind green** and the matching `#2c6f96 → #4bb8e8`
  HP-bar gradient. The spec asked for a Deuteranopia-safe swap and gave no
  values; this is the existing `--runic` cyan family pulled toward blue so it
  cannot be confused with the runic tier colour it sits near.
- **Which contrasts count as "the handful".** Swapped: mob HP bar, weakened
  tame ring, weakened name tag, HUD HP numbers, player HP bar, connection dot.
  Not swapped: the gold pet bar and the gold-green downed arc (see above), and
  the biome palette, which has no red/green pair a player must tell apart.
- **Fullscreen is not re-requested on boot.** The API only works inside a user
  gesture, so a stored `true` cannot be honoured at page load without a click
  to hang it on. The stored value is what the panel last showed and the request
  itself only ever fires from the button. Flagged because "all settings persist"
  is true of the preference here, not of the state.
- **Default volumes 80 / 70 / 80 and all three unmuted.** Unspecified; music
  sits under SFX so a future track cannot drown combat feedback on first boot.
- **The HUD help line is now generated from `KEYBINDS`.** Not asked for, but it
  was a hardcoded "WASD move • SPACE attack • …" string that would have started
  lying the moment anyone rebound anything. `run4` asserts it re-renders as
  "TASD" after rebinding up to T.
- **Rebinding refuses duplicates rather than stealing the key**, with the reason
  said out loud in an inline message under the list — the spec asked for exactly
  this. ESCAPE and TAB are additionally unbindable: ESC is the capture-cancel
  key, and TAB would trap keyboard focus in the panel.
- **Credits placeholder is two `{role, name}` rows**, not three lines — "Created
  by [Your Name] and the RuneHaven development team" is one credit with one
  role, and splitting it would have made the array shape wrong for the real
  names it exists to receive.
- **`debugSettingsInfo()` and `debugAudioEngine()` — two new harness hooks**,
  beside `debugWorldInfo()` / `debugSetPlayer()`. `KEYBINDS`, `SETTINGS` and
  `particles` are all top-level `let`s, which never land on `window`, so PART
  F's gates cannot see any of them otherwise. Copies, except the deliberate
  live handle to the audio engine so its methods can actually be called.
- **`loadSettings()` resets to the defaults before reading storage**, which is
  what makes calling it a genuine reload of the subsystem — that is what the
  persistence gate leans on, and it is also correct behaviour for a key that
  was removed from storage.
- **`run4` installs a real in-memory `localStorage` for the persistence gate.**
  The shared harness header stubs it to a no-op, which cannot prove a round
  trip; the probe only replaces it if writes are not already sticking, so the
  header is untouched.
- **`run5` gained a v23 sweep** — every mob drawn weakened through both sides of
  the colourblind swap, and `updateParticles` through both sides of the
  reduce-motion gate. 660 → 718 coverage draws. Extend it whenever another
  colour or ambient effect learns a v23 twin.

### 2026-08-11 (v22 — Abyssal Hollow + Sunforge Caldera, Storm Dragon, Shadow Dragon)
Two more rare biome pockets and the last two dragons the bible lists. Nothing
here needed new art: both biomes are the proven pocket technique a fifth and
sixth time, and both dragons are one call each into the shared body that has
been sitting in the file since v18. Stats, counts and tame chances live in the
README + commit message; below is only how it all looks.
- **Abyssal Hollow** (rare DEEP variant, `B.ABYSSAL`). Palette
  `#182a36 / #162632` — the Underwater Caves' blue-grey rock taken down to
  roughly half its luminance and pulled colder still. The read is **below**
  the caves, not beside them: `#2f4a54` is a cave you have swum into,
  `#182a36` is the floor of the world. It is carved from `B.DEEP` on its own
  noise field, so the v21 dive is the only way in — **no new access logic was
  written for it at all.** That is not a shortcut, it is the point: every
  breath rule keys on `B.DEEP` specifically, so a Hollow tile is an air pocket
  exactly as a UWCAVE tile is, for free.
- **Hollow floor is the v21 cave floor made sparse.** Same three elements,
  three deliberate subtractions and nothing else: a heavier shadow pool
  (`rgba(4,10,16,0.46)` vs `0.34`), **one** fissure instead of two, and **at
  most one** bioluminescent speck behind a much higher gate (`0.86` vs `0.58`)
  instead of up to three, in a dimmer, greyer blue (`#4a96be` against the
  caves' `#8fe8f4`). Minimal bioluminescence is what the depth reads as.
  Still the **baked** speck-and-halo language, still deliberately NOT the
  drifting `mote` particle — the v18 rule that motes mark the two rare
  *surface* biomes and must not spread holds at a fifth and sixth biome.
- **A Hollow tile sits at sea-floor height (`h = -1`)**, same as UWCAVE and
  for the same reason: the plateau branch would otherwise raise the deepest
  point in the world out of the open ocean as a cliff-walled island.
- **Sunforge Caldera** (rare VOLROCK variant, `B.CALDERA`). Palette
  `#f2c884 / #eec27c` — plain volcanic rock `#5c3c3c` gone blinding. It is the
  brightest ground in the world after snow, and deliberately far more
  saturated than PEAK's `#ece7db`; the v6 PEAK→ROCK buffer already keeps snow
  42 tiles clear of the volcano, so the two can never touch and be confused.
- **The Caldera keeps the volcano cone's height.** Its carve happens *after*
  the volcano override (VOLROCK does not exist before then), and it inherits
  the cone's `h = 3 / 2` and the cone's erosion exemption. Left to fall
  through to the plateau branch it would have punched 2–3 level pits into the
  rim — the volcano silhouette is on this file's must-not-regress list, and
  the spec asked for hotter-looking VOLROCK, not a hole in the mountain.
  `run4` now hard-fails if any caldera tile drops below the cone.
- **Its cliff faces are its own hot tone**, `shade("#f2c884", 0.8 / 0.58)`,
  joining the VOLROCK and UNDERCAVE exceptions rather than wearing the cream
  `CLIFF_SW`/`CLIFF_SE`. Same v18 lesson: a biome-coloured tile with cream
  cliffs reads as a palette bug.
- **Caldera ground is the cave treatment inverted** — a *bright* inner pool
  (`rgba(255,240,206,0.30)`) instead of a dark one, two glowing crust cracks,
  and an occasional white-hot ember flake. Hard-edged flat fills only, no
  gradients; the heat comes from colour contrast.
- **The heat shimmer is the v8 lava shimmer, reused verbatim** — same
  wavering stroke, same rise cycle, own hash offsets, over a fainter and paler
  version of the lava glow. The spec said reuse a cheap one if it exists and
  skip it otherwise; it existed ten lines away. **No new particle system was
  built.**
- **Both dragons are one line of art each.** `DRAGON_PAL.storm` /
  `DRAGON_PAL.shadow` and `dragonV2()`'s `"storm"` (lightning flicker) and
  `"shadow"` (layered trail) branches were all pre-staged in v18 and have sat
  unused since, so the branches are `dragonV2(sx, sy, DRAGON_PAL.storm, t,
  "storm")` and its shadow twin, and nothing else. Ground species for the same
  reason all four dragons are — the shared body plants its claws on the
  baseline — so both inherit the walk bob, sun shadow, x+y depth sort and
  every v16 combat overlay with no special casing. `SPECIES_K` 1.30 each,
  matching their two siblings. All four call sites still pass `DRAGON_PAL.*`
  and the parameter is still named `PAL`, never `P` — re-grepped, no
  regression of the v18 collision.
- **⚠️ One of the three Storm Dragons in the test seed cannot be reached.**
  `B.PEAK` is in `BLOCKED` and always has been (Griffin has spawned there
  since v14), taming needs the player within 1.8 tiles, and the player can
  only stand on non-blocked ground. Measured over each creature's wander
  ellipse: the three sit 1.32 / 1.66 / **2.73** tiles from the closest point a
  player can occupy, so two are tameable and the third can be seen from the
  rocks below and never caught. The locked spec pins the spawn to `B.PEAK`, so
  this follows it exactly rather than second-guessing it, and it is now
  measured and printed by `run4` on every run — with a hard failure if the
  count ever reaches zero. **This is the thing most worth revisiting.** The
  fix, if one is wanted, is a walkable-adjacency filter on the spawn search,
  not a different biome — but that changes which tiles qualify and would need
  re-measuring.
- **⚠️ Nothing marks either pocket from outside it.** The Hollow is found
  exactly like the Underwater Caves — an ordinary stretch of dark sea with
  somewhere inside it — and the Caldera is a bright patch you walk into on the
  volcano's flank. Consistent with every prior pocket, but the Caldera is the
  first one that is genuinely *visible* at distance, since it is the brightest
  ground in the world sitting on a raised cone. Worth a screenshot to check it
  reads as heat rather than as snow on the volcano.
- **⚠️ Caldera tiles carry no ore.** `featureTypeAt`'s VOLROCK branch (iron at
  0.92, runic at 0.992) does not extend to `B.CALDERA`, so the carve quietly
  removes ~175 tiles' worth of chances from the volcanic band. That is the
  spec following its own explicit exclusion — dragonsteel acquisition from the
  Caldera is deferred until there is a reason to visit beyond the dragon — but
  it means the Caldera is currently scenery with no resource of its own.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent. All shipped and verified through
the full gate (324/324 in run4, zero FAILs) — refinements to consider, not
unfinished work.
- **The Abyssal Hollow wins the overlap with the Underwater Caves.** Both are
  carved from `B.DEEP` on independent fields, so some tiles satisfy both and
  the spec never says which takes precedence. The Hollow is tested first, so
  the rarer, deeper biome wins: letting the commoner one pre-empt it would
  make the Hollow rarer than its own threshold says and would chew holes in
  its pockets. Cost, measured: UWCAVE 1677 → **1619** tiles, 21 → 22 pockets,
  every one still reachable inside a single bare tank (max crossing 90 of a
  138-tile budget). Dark Forest is still exactly 763, so `run4`'s pin holds
  untouched.
- **`ABYSSAL_RARITY = 0.90` and `CALDERA_RARITY = 0.85`** — both the spec's
  proposals, kept. Measured: the Hollow is **965 tiles, 3.1% of the deep sea,
  across 13 pockets** (largest 694), against the caves' 5.2% — genuinely
  rarer, which was the stated intent. Every one of the 13 is reachable on a
  bare tank (max crossing 39). The Caldera is **175 tiles in 3 pockets**
  (largest 137) out of 1120 VOLROCK, and all 175 are walkable from spawn
  without diving — that is a `run4` assertion, not an observation.
- **The Caldera inherits VOLROCK's cone height and erosion exemption.** The
  spec says nothing about height. There were two defensible readings — the
  v18 precedent where an UNDERCAVE pocket drops to plateau height and reads as
  a recessed bowl, or keeping the cone — and the volcano silhouette being on
  the must-not-regress list settles it. Flagged because "caldera" does mean a
  crater, so a deliberate bowl is a legitimate thing to want instead; it would
  be one line, and `run4`'s pit assertion would need inverting.
- **Palette hexes for both biomes.** The spec gave directions ("near-black
  blue, minimal bioluminescence, sparse" / "near-white/orange glow") and no
  values. Picked to sit clearly apart from every neighbour: the Hollow from
  UWCAVE and deep water, the Caldera from VOLROCK, LAVA and PEAK.
- **Logging in on an `B.ABYSSAL` tile brings you back already diving.** v21
  added that guard for UWCAVE because surfacing into a ring of blocked deep
  water is a softlock; a Hollow tile is the same shape of tile, so leaving the
  guard UWCAVE-only would have shipped it with a second hole. Not new access
  logic — the existing guard, made whole.
- **`count: 3` for both dragons,** matching Fire and Water Dragon. The spec
  locked stats and tame chance but not density.
- **`debugSetPlayer()` now snaps the camera when it sets a position.** The
  camera eases toward the player at `dt*6`, so a harness that moved the player
  across the map and pumped a handful of frames was still rendering the tiles
  around SPAWN — every on-camera branch it meant to reach silently never ran.
  This is the same assignment login and respawn already make, and it is what
  lets `run5` actually execute the Caldera's animated shimmer (verified: 852
  draws, where before the change it was 0).
- **`run4`'s underwater reachability BFS now treats `B.ABYSSAL` as free to
  cross but never as a starting point.** Left alone it would have seeded the
  search from Hollow tiles as though they were dry land and reported the
  caves as far closer to shore than they are — a silently weaker test, not a
  failing one, which is the kind worth catching.

### 2026-08-10 (v21 — Underwater Caves, the dive mechanic, Water Dragon, Sea Serpent)
A fourth rare biome pocket, two new creatures, and the first time the player
can be somewhere the world previously refused to let them stand. Breath
numbers, drowning damage, the Diver's Charm recipe and both creatures' combat
stats live in the README + commit message; below is only how it all looks.
- **Underwater Caves** (rare DEEP variant, `B.UWCAVE`). Palette
  `#2f4a54 / #2c4650` — the point is that it reads as **rock that happens to
  be underwater**, not as more sea. Far greyer and darker than deep water's
  `#2c5a72`, and pulled cold/blue away from the Underground Caves' warm
  `#4a453e`, so the two cave biomes can never be mistaken for one another.
- Cave floor is the v18 cave language taken cold: a dark inner diamond
  (`rgba(8,18,26,0.34)`), two hard fissure strokes, and up to three
  **bioluminescent accents** — hard-edged blue speck (`#8fe8f4` / `#5fc4d8`)
  over a flat square halo. **That accent is the ENCHANTED FOREST UNDERGROWTH
  treatment recoloured, deliberately NOT the drifting `mote` particle kind.**
  Motes mark the two rare *surface* biomes (v17) and the v18 rule that they
  must not spread to a third stands — this is the *baked* glow language, which
  was always a separate thing. Do not merge them.
- **A cave pocket sits at sea-floor height (`h = -1`), like the water around
  it.** Without that it would fall through to the plateau-noise branch and
  rise out of the open ocean as a cliff-walled island — the exact opposite of
  the read. It also means a UWCAVE tile never draws a cliff face, which is
  correct: the caves are a hole in the sea, not a step in the land.
- **The surrounding deep water is unchanged and still blocked.** That is the
  whole composition: an ordinary-looking stretch of dark sea that you now
  discover has somewhere inside it. Nothing marks a pocket from the surface —
  found, not signposted.
- **Water Dragon is one line of art, not new art.** `dragonV2()` and
  `DRAGON_PAL.water` were both pre-staged in v18 (including the water
  variant's fin flashes and rising bubbles), so the branch is
  `dragonV2(sx, sy, DRAGON_PAL.water, t, "water")` and nothing else. A ground
  species for the same reason Fire Dragon is — the shared body plants its
  claws on the baseline — so it inherits the walk bob, sun shadow, x+y depth
  sort and every v16 combat overlay with no special casing. `SPECIES_K` 1.30,
  identical to its fire sibling. This is what pre-staging the palette bought.
- **Sea Serpent**: approved concept art ported verbatim, not redrawn — only
  the v15 port convention applied (`sx`/`sy` → `(0)`, since drawMob's chain
  runs inside the body transform, exactly as goblin/troll/bandit/wraith do).
  Two cresting coils with phase-offset wave motion, dorsal spine spikes, a
  reared neck and finned head, and its own rising bubbles. `MOB_K` **2.60** —
  by far the largest thing in the roster — with `MOB_TALL` 15, a low-profile
  body whose overlays sit above the reared head rather than the coils.
- **Diving cue: three pale bubbles rising off the local player and fading.**
  Local-player only, like every v16 combat overlay, because no other player's
  dive state is synced. It reuses the Sea Serpent's own bubble treatment (thin
  stroked ring, no fill, no gradient) rather than inventing an effect, and it
  is deliberately not a mote.
- **HUD gains a breath readout**, and only when it means something — while
  diving, or while it is still refilling afterwards. It turns red and reads
  DROWNING at zero. `F` is now in the help line.
- **⚠️ Nothing renders differently underwater.** There is no blue wash, no
  darkening, no surface line above the diver — a diving player is drawn
  exactly as a walking one, plus bubbles. That was not in the spec and adding
  it is a real rendering-architecture question (it would have to compose with
  the day/night light pass), so it was left alone. It is the most likely thing
  to want next: right now the read that you are *under* the water rather than
  on it comes entirely from the terrain and the bubbles.
- **⚠️ The Sea Serpent's `MOB_TALL` of 15 is a starting estimate.** The art is
  ~28px tall at native scale and 2.6× that drawn, so the "!" tell and the HP
  bar sit close to the head rather than clear above it. It reads, but it is
  the one number here most worth checking against a screenshot.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent, or where following it literally
would have contradicted its own stated intent. All shipped and verified
through the full gate (282/282 in run4) — refinements to consider, not
unfinished work.
- **The movement gate is a DEEP-only exception, not the literal line the spec
  printed.** The spec wrote `if (me.diving || !BLOCKED.has(...))` and then, two
  sentences later, said "B.PEAK and B.LAVA stay blocked regardless of diving
  state — this is specifically a deep-water exception, not a general noclip."
  The literal line is a general noclip: it would have let a diving player walk
  onto lava. Shipped the stated intent as `diveBlocked(b)`, which is BLOCKED
  with the single `B.DEEP` exception, and `run4` now asserts peaks and lava
  stay shut while diving.
- **`UWCAVE_RARITY = 0.82`** (the spec's proposal, kept) — 1677 tiles in the
  test seed, 5.4% of the deep sea, across **21 separate pockets**, the largest
  320 tiles. Seven pockets touch shore directly and every one of the 21 is
  reachable inside a single bare 30s tank; 19 are reachable *and returnable*
  on one tank. Those are now assertions in `run4`, not observations, because
  an unreachable cave here loses more than a merely rare one elsewhere.
- **The Sea Serpent art block in the spec had a duplicated `else if (kind ===
  "sea_serpent") {` header and one extra closing brace** — a copy-paste
  artifact, not a second branch: inserted as written it is a syntax error. The
  body itself is unambiguous, so it was used once, verbatim.
- **Cave palette `#2f4a54 / #2c4650`** and the shadow/fissure/accent values.
  The spec asked for "desaturated blue-grey rock, sparse bioluminescent
  accents" and gave no hexes. Picked to sit clearly apart from both deep water
  and the warm Underground Caves.
- **The bioluminescent accent is the BAKED Enchanted-Forest undergrowth
  language, not the drifting `mote` particle.** The spec said "reuse the
  particle/glow language already established for Enchanted Forest's motes,
  shifted toward blue"; the v18 rule says motes must not spread to a third
  biome. The baked speck-and-halo satisfies both, and is what the Enchanted
  Forest floor actually uses.
- **`B.UWCAVE` forced to `h = -1`.** The spec never mentions height. Every
  other water tile is -1 and the plateau branch would otherwise raise a cave
  pocket into an island — only one reading is sensible.
- **Deep water is NOT in `SLOW`.** Diving happens at full walking speed, which
  is what the 30s-tank reachability numbers above are measured against. A
  swim-speed penalty would be a real design change and would need those
  numbers re-measured.
- **The Diver's Charm is designed content, not bible content** — the bible
  names no diving gear at all. It is an *item*, not a pet/mob/biome/location,
  so it is not the kind of thing the never-invent rule forbids, but it is
  flagged here explicitly. Its slot (`me.charm`) is a third equip slot built
  on the armor slot's exact pattern.
- **The charm's equipped state is session-local, deliberately not persisted.**
  `savePlayer()` writes a fixed column list and the players table has no
  column for it; adding one is a schema change this build has no way to
  verify. The charm itself lives in the inventory, which *is* persisted — only
  which slot it sits in resets, like starting each session surfaced and full
  of air. On death the slot is cleared without pushing a second drop, since
  the item was already dropped with the inventory (unlike the armor slot,
  which duplicates — pre-existing, left alone).
- **Surfacing on deep water is refused, not auto-pushed.** The spec offered
  either. Refusing is one branch and cannot fail; a push has to pick a
  destination tile and can. The toast says why.
- **Two related states the spec didn't cover, both fixed the obvious way:**
  respawning clears `diving` and refills breath (otherwise drowning respawns
  you flagged as diving on dry land, where breath never refills), and logging
  in *on* a UWCAVE tile brings you back already diving (otherwise you surface
  into a ring of blocked water).
- **Sea Serpent tunables:** 1.8 attack range / 1900ms cooldown / aggro 7 /
  leash 12 / move 1.5 / count 3, dropping `runic_stone ×2 @80%` and
  `iron_bar ×2 @90%`. Only HP, damage and windup were locked. Loot is existing
  materials at a generous rate because the bible's "rare aquatic loot" has no
  dedicated item and inventing one was explicitly not this version's job.
  Water Dragon's `count: 3` matches Fire Dragon's.
- **`debugSetPlayer()` — a new harness hook** beside `debugWorldInfo()`. PART F
  requires proving the dive gate end to end, and `me` is a top-level `let` that
  never lands on `window`; without a way to place the player, none of it is
  reachable. It writes only fields the game already writes every frame.
- **The bubble cue was built, though the spec marked it optional.** It is the
  only thing on screen that distinguishes diving from walking, and `run5` now
  covers both it and the real `drawPlayerEntity` branch that calls it.

### 2026-08-09 (v20 — Ruins as repeatable structures + scattered Safe Zones)
No new species, no new mobs, no palette changes. The single hand-composed Ruin
becomes six of them, scattered, and the bible's "Other Safe Zones" arrive as
four rest points. Separations, search budgets and the placement rules live in
the README + commit message; below is only what changed about how the world
READS.
- **The Ruin stops being a landmark and becomes a structure you find.** v19
  placed one Ruin by angle-and-radius from the Tower, which kept it orbiting
  the town centre at a fixed distance — it read as part of the spawn hub's
  furniture rather than as somewhere out in the world. Six clusters now place
  by the same hashed sampling the wilds and mobs use, so they land anywhere
  the island has room. Measured in the test seed: centres 45–52 tiles apart,
  spread across all four quadrants, none within 61 tiles of spawn.
- **The hand-composed ruin composition is untouched — it is now built six
  times.** `buildRuinPieces()` → `buildRuinCluster(center)`, every piece still
  at its exact v6 offset from the cluster centre. The user declared that
  composition DONE and it must never be altered; repeating it is not altering
  it. All six clusters are deliberately identical, which is what makes them
  read as the same lost civilisation rather than six unrelated set pieces.
- **New set piece: the dark dungeon entrance**, one per cluster, set into the
  gap in the north wall run (the wall segments sit at x −2.4/−1.4/−0.4 and
  1.6/2.6, so +0.6 is the doorway). Two jambs carrying a lintel, ~34px tall
  (≈3 tiles at `IH2` 11) — the tallest thing in a cluster — over a flat
  near-black trapezoid mouth that tapers inward as it rises. Stone is
  `#8f8878` / lintel `#9c9484`: the same ruin stone taken down in value, so it
  reads as this architecture gone deeper and colder rather than as a
  different material. Hard-edged flat fills only, standard 0.72/0.55 facet
  split via `drawBox` — the mouth is dark because it is a dark colour, not
  because it is blurred. Bible-supported ("Ruins — ... dungeon entrances");
  purely visual, nothing behind it is enterable this version.
- **Other Safe Zones read as clearings, not as buildings.** Four of them,
  each a radius-8 disc of plain grass on level ground with the existing ruin
  stone well as its only anchor — the same well art, reused, no new drawing
  code. Deliberately quiet: a rest point should read as somewhere the land
  opens up, not as another structure competing with the Ruins.
- **The clearing is guarded like the RUINB carve** (`!BLOCKED`, not water), so
  a zone that lands on the coast keeps its shoreline instead of painting grass
  out over the sea. Two of the four do exactly that in the test seed.
- **⚠️ Two of the four Safe Zones sit on the coastline** — ~15% of their disc
  is water. Placement tests land fitness on the CENTRE tile only, which is
  what the exhaustive 57,600-tile (240×240) scan behind this spec measured, so
  this follows the spec exactly rather than second-guessing it. The result is
  defensible (a coastal rest point by the water reads fine) but if a fully
  inland clearing is wanted, the fix is a footprint check rather than another
  separation number — and it would need re-measuring, since it changes which
  spots qualify.
- **⚠️ No boundary ring on the scattered zones.** The Spawn zone has its gold
  dashed ellipse; these have only the grass edge and the HUD's safe-zone
  indicator. The spec listed the well and the clearing as the whole visual
  treatment, so nothing was added beyond it. Worth a look — the protected
  radius and the grass radius are identical (8), so the green edge *is* the
  boundary, but it is a softer read than the ring.
- **RUINB ground now covers six pockets instead of one** — 63–69 tiles per
  cluster, 408 total. Golem (RUINB-only) and Bandit both reach more than one
  cluster in the test seed, so the ruin biome's creatures are spread across
  the world rather than stacked in a single spot.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent. All shipped and verified through
the full gate — refinements to consider, not unfinished work.
- **Ruin-to-Ruin separation set to 40.** The spec pins Ruin-to-Zone at 24 and
  every zone separation at 40, and says the Ruins' own separations are
  unchanged — but v19 had a single Ruin, so a Ruin-to-Ruin number never
  existed to carry forward. 40 matches the zone-to-zone value and puts ~35
  tiles of open ground between two 4.5-tile footprints. Measured result: the
  closest pair lands at 45.1, so the constraint is not the binding one.
- **Safe Zone protected radius = clearing radius = 8, one constant.** The spec
  gives the radius-8 clearing and says `inSafeZone()` extends to the zones,
  but never states a separate protection radius. Using one number for both
  means the visible green circle IS the safe area, with no invisible margin in
  either direction. (The Spawn zone deliberately keeps its own arrangement,
  where the grass disc is 6 tiles wider than the protection.)
- **The clearing also flattens terrain to `h = 0`,** like the Spawn zone does.
  The spec says "grass clearing" and nothing about height; a well straddling a
  three-level cliff step would not read as a clearing. Setting `h = 0` also
  puts the whole disc below the `h >= 1` edge-erosion branch, so no erosion
  exemption was needed — one change instead of two.
- **The dungeon entrance's placement, size and two stone colours** are visual
  tunables the spec left open (it specified only "two jambs, a lintel, a flat
  near-black trapezoid mouth, ~2.5–3 tiles tall, darkened ruin stone"). The
  wall-run gap was chosen because it is the one spot in the locked composition
  that is already empty, so nothing had to move to make room.
- **FIX 3 resolved by not re-seeding, not by widening the budget.** The
  wilds/mobs pattern folds `placed` into the hash offset, restarting the
  candidate stream from `a = 0` after every success; under the Ruins' tighter
  constraints that is what exhausted the search on the sixth cluster. One
  fixed stream swept once is the smaller change of the two the spec offered,
  and it also stops the search re-testing candidates it already rejected.
- **`debugWorldInfo()` now also exports `RUINS`, `OTHER_SAFE_ZONES`, the five
  placement constants, mob/wild home spots and the ruin set-piece list** (all
  copies). Same reason as v19's landmark export: these are top-level `let`s
  and `const`s, which never land on `window`, so PART C's proof gates cannot
  see them any other way.
- **`run4`'s Dark Forest pin re-measured to 763, not carried over.** PART C
  required this explicitly. 875 → 763 because six RUINB carves (not one) and
  four grass clearings now take more tiles from the moisture band. The
  invariant being guarded is unchanged — the rare-variant noise fields still
  never touch it; only landmark overrides do, as they always have.
- **`run5` gained a ruin set-piece sweep** (`RUINPIECE_LIST`), covering all
  eight kinds at synthetic coordinates and then every piece the live world
  actually built. Clusters now sit far from spawn, so the 5-frame boot is no
  longer guaranteed to draw a single one — exactly the gap that sweep exists
  to close. It also hard-fails if a listed kind was never built.

### 2026-08-05 (v19 — world scale-up, N 80 → 240)
No new art and no new species. The island itself is 3x wider in each direction
(9x the area), and everything that was measured in absolute tiles moved with it.
Entity counts, search budgets and the density rule live in the README + commit
message; below is only what changed about how the world READS.
- **The cramped island is FIXED — it was a scale problem, not a content
  problem.** v17/v18 kept adding biomes and species onto an 80x80 dev-scale
  map, so every new region landed shoulder-to-shoulder with the last one.
  Growing the map and rescaling the distances (rather than thinning content)
  is what buys back the space between things.
- **Rare-biome pockets are now large enough to be places, not patches.** The
  three v17/v18 overlays sample their own noise field; that field's wavelength
  went `/4` → `/20` — 5x, deliberately more than the map's own 3x, so a pocket
  grows faster than the world around it. Measured in the test seed: Enchanted
  Forest 9 distinct regions (largest 220 tiles, vs 64 tiles across the WHOLE
  old map), Sacred Meadow 4, Underground Caves 8. The spec's back-off
  condition — "only one or two enormous blobs per biome" — did not trigger, so
  `/16` was not needed. The rarity thresholds are untouched, so each variant's
  share of its parent biome is exactly what it was; only pocket size and count
  moved.
- **Landmark separation scales with the world.** Volcano/Mount/Ruin now place
  at 75/72/57 tiles from the Tower instead of 25/24/19, with every
  minimum-separation buffer tripled to match. Verified in the test seed that
  all three actually found a valid spot rather than silently exhausting their
  12 attempts and shipping wherever the last try landed — that failure mode is
  now a `run4` assertion, not a hope.
- **Volcano and mountain keep their silhouettes.** Cone rim, lava core, the
  VOLROCK band and the PEAK→ROCK buffer that keeps snow off volcanic rock
  (the 2026-07-11 "no transition" fix) all tripled together, so the landmark
  reads at the same proportion of the world it always did rather than becoming
  a pinprick on a bigger map.
- **Safe zone still reads as plain grass**, at `SAFE_RADIUS` 27 instead of 9 —
  the full-override radius, the height flatten and the erosion exemption all
  scaled together, verified by spot-checking tiles out to the new radius.
- **⚠️ The Eternal Tower now sits INSIDE the safe zone.** Spawn and Tower are
  pinned to `N/2` with fixed offsets (18 tiles apart), and the locked spec
  explicitly said not to change them — so as `SAFE_RADIUS` went 9 → 27 the
  zone grew out past the Tower. The spawn hub is now a compact cluster in a
  much larger world instead of a spread the size of the map. Nothing breaks
  (mobs were already excluded far past the Tower), but it is a visible change
  in how the centre reads and is the most likely thing to want revisiting.
- **⚠️ The baked terrain canvas is now 10604x5414px (~57 Mpx, ~219 MB) —
  up from 3564x1894 (~6.8 Mpx, ~26 MB).** `bakeTerrain()` paints the whole
  map into one offscreen canvas at boot; that is inherent to N and the spec
  did not raise it. Within desktop Chrome/Firefox limits, but it is well past
  what mobile Safari will allocate, and boot cost rose ~290ms → ~300ms in the
  harness (which stubs the actual painting, so the real-browser cost is
  higher). Flagging rather than fixing: chunking the bake is a rendering
  architecture decision, not a tunable, and inventing one was not in scope.
- **Ambient decor did not scale and now reads thin.** Grazing rabbits (3),
  the Tower's circling birds (3), butterflies, torches and fences are all
  fixed counts and none of them appear in the spec's density list, so they
  were left exactly as they were — across 9x the area they are now much
  sparser than before. Deliberate (following the spec's explicit list), not
  an oversight, but worth a look next pass.

## JUDGMENT CALLS THIS VERSION
Calls made where the locked spec was silent or where the world's new size broke
an assumption it didn't mention. All shipped and verified through the full gate
— these are refinements to consider, not unfinished work.
- **"Safe-zone grass flatten, first/second check" resolved to three sites, not
  two.** The spec's table lists one `SAFE_RADIUS + 2` → `+6` and one
  `SAFE_RADIUS + 3` → `+9`, but the code has the `+2` pattern twice (the
  biome grass override in `biomeAt` and the height flatten in `rawHeight`) and
  `+3` twice. Applied the spec's mapping to every safe-zone grass/flatten
  site — `+2`→`+6` on both, `+3`→`+9` on the erosion exemption — since any
  other split would leave the grass disc and the flat disc different sizes.
- **One extra distance check found and scaled 3x**, under Part B's explicit
  catch-all: the grazing-rabbit spawn exclusion, `SAFE_RADIUS + 3` → `+9`.
  It is the same category as the wild-pet and mob exclusions the spec listed.
- **Spawn-search budgets scaled by AREA (9x), not by Part B's 3x** — wilds
  4000 → 36000, mobs 600 → 5400. These are counts of random samples taken
  across the map, so samples-per-tile is the invariant that has to hold; at 3x
  the cave and ruin species fell short of their new counts purely because the
  search ran out. Costs ~12ms of boot. Not a design number.
- **Glow Moth reaches 7–9 of its 9 target, run to run** — Underground Caves
  are only ~90 tiles and wilds must sit 3 tiles apart, so the last one or two
  are geometry-limited, not budget-limited. Left as is; raising it would mean
  either more cave tiles or tighter spacing, both real design changes.
- **`debugWorldInfo()` now also exports `SAFE_RADIUS`, `SPAWN`, `TOWER` and the
  three landmark positions** (as copies). Part E requires proving the landmarks
  actually placed, and like the biome ids they are lexically scoped consts that
  a harness cannot otherwise see.
- **The three harnesses no longer sleep a fixed 200ms after clicking ENTER;
  they wait for the login screen to actually hide.** At the new scale boot takes
  ~300ms, so the old fixed sleep expired *before* login finished and every
  assertion after it silently ran against a world that was never entered —
  `run3` still printed `CAUGHT ERROR: none` while testing nothing. This was
  found and fixed during this build; it is the single most important change in
  the harnesses.
- **`run4`'s scale-bound pins were updated, not relaxed.** "Dark Forest band
  untouched" was pinned at `dark === 1` — a true value only at N=80 — and is
  now pinned at `dark === 875`, the same invariant at the new scale. The
  density table was updated to the v19 locked numbers with the same
  exact-value style v18 used.
- **The Dark Wraith is now asserted rather than excused.** v18 shipped with an
  open note that it could not be tested because Dark Forest was a *one-tile*
  band in the test seed. The scale-up fixed that as a side effect — the same
  moisture logic over 9x the tiles yields an 875-tile band, and the wraith now
  reliably spawns 6x — so the gap is closed and held closed by a real
  assertion. Shadowfox (Dark Forest-only too) benefits identically but keeps
  its presence roll, so it still can't be asserted.

### 2026-08-04 (v18 — Underground Caves, Fire Dragon, Glow Moth, Dark Wraith)
A third rare biome pocket and three new creatures. Density counts, combat stats,
tame chances and the Dark Wraith's ranged mechanism live in the README + commit
message, not here — below is only how it all looks.
- **Underground Caves** (rare ROCK/PEAK variant, `B.UNDERCAVE`). Palette
  `#4a453e / #474239` — the parent Rock hue with the warmth and the value taken
  out of it, so a cave pocket reads as a **hole punched in the highland**, not
  as one more shade of rock. Its cliff faces are the cave tone shaded on the
  locked 0.8 / 0.58 ratio, **not** the cream `CLIFF_SW`/`CLIFF_SE` — a dark tile
  wearing cream cliffs read as a palette bug in every test frame.
- Cave ground is a deep shadow pool (`rgba(12,10,16,0.34)` inner diamond), two
  hard fissure strokes, and a sparse warm mineral glint with a flat halo.
  **Hard-edged flat shapes only, no gradients** — same rule the Enchanted Forest
  undergrowth follows.
- **Caves deliberately do NOT get drifting motes.** Motes mark the two rare
  *surface* biomes (v17); spreading them to a third would destroy the "you have
  found somewhere rare" read that earns them. Caves carry their identity through
  value and shadow instead. Do not merge these treatments.
- A cave pocket carved out of a snow PEAK loses the peak height rule and drops
  to plateau height, which reads as a recessed bowl in the massif. That is
  wanted, not a bug — it is what makes the cave mouth legible from above.
- **`aura()` — new shared render helper** (pulsing radial wash + ground ellipse
  + rising diamond motes). Takes an `"r,g,b"` triplet rather than a css colour
  because every stop composes its own alpha. Used by the Dark Wraith now, built
  to be reused by Elder-tier content later.
- **`dragonV2()` + `DRAGON_PAL` — one shared dragon body, four palettes**
  (water / fire / storm / shadow) with only `fire` wired up this version, so
  later dragons need no rework. Its palette parameter is named **`PAL`, never
  `P`** — `P` is this file's global polygon helper and shadowing it would
  silently break every draw call in the body. (`PAL` shadowing the biome-palette
  global inside that one function is harmless; nothing in there reads a biome
  colour.)
- **Fire Dragon**: approved concept art ported verbatim. It is a **ground
  species** — the art plants its claws on the baseline — so it inherits the
  standard walk bob, sun shadow, x+y depth sort and every v16 combat overlay
  with no special casing. `SPECIES_K` 1.30, the reference-sheet hatchling scale.
- **Glow Moth**: `SPECIES_K` 0.32, the smallest thing in the roster. Its warm
  radial gradient is the one place a gradient is correct here — it is a light
  source, not a surface. That same colour is reused as the light it casts: while
  it is the active pet the **local player's own light widens 150→215 and warms
  to `rgba(244,232,160,…)`**. It is deliberately not a second light entity — no
  stacking, no toggle, on while active — so it can never double-expose a scene.
- **Dark Wraith**: incorporeal read — 86% alpha body, drifting tatter fringe,
  violet eye squares with a soft square halo, and the new `aura()` beneath it.
  Ported into `drawMob`'s in-transform chain with `sx`/`sy` substituted for
  `(0)`, the same v15 port convention goblin/troll/bandit already use.
  `MOB_K` 1.30, `MOB_TALL` 4.
- **The wraith's ranged strike is a visible bolt**, drawn *after* the body and
  *outside* the body transform so it reads as reaching the target rather than as
  part of the silhouette — a 240ms violet line that fades out. Without it a hit
  from 4.5 tiles away has no visual cause at all. The v13 fairness rule is
  untouched: the amber "!" still plays for a full 600ms first.

## JUDGMENT CALLS THIS VERSION
Rendering-scope calls made where the spec was silent. All shipped and working —
these are refinements to consider, not unfinished work.
- **Cave palette `#4a453e / #474239`** and the shadow/fissure/glint values. The
  spec asked for "desaturated rock, deep shadow, sparse ambient light" and gave
  no hexes. Picked to sit clearly apart from volcanic `#5c3c3c` (warm) and plain
  Rock `#b3a993` (light).
- **`UNDERCAVE_RARITY = 0.80`** — yields 41 cave tiles in the test seed, 8.2% of
  the Rock/Peak pool, deliberately between Sacred Meadow's 3.7% and Enchanted
  Forest's 12.4%. Pure tunable; raise it for rarer caves, lower it for more.
- **Fire Dragon as a ground species, and Glow Moth as a flier at `alt: 12`**
  (matching Wind Sprite). Neither was stated; both follow from the supplied art.
- **`GLOW_MOTH_LIGHT_R = 215`** against the unlit default of 150. "A soft
  radius" was the whole brief — this is a ~43% widening, tunable either way.
- **240ms bolt lifetime** for the wraith's ranged strike.

### 2026-07-31 (v17 — Enchanted Forest, Sacred Meadow, and three new species)
Two rare-variant biomes and three new creatures. Biome rarity thresholds, tame
chances, time gates and the two new gatherables' mechanics live in the README +
commit message, not here — below is only how they look.
- **Enchanted Forest** (rare Forest variant). Palette `#55736a / #527066` — the
  canopy is **deliberately desaturated**, green pulled toward slate-teal, and
  the trees use their own facet set (`#6a9086 / #557a72 / #3d5c58`, violet-grey
  trunk). That desaturation is the whole point: it is what lets the
  bioluminescent undergrowth read. If a future pass "fixes" the canopy back to
  forest green, the glow disappears into it. Undergrowth is baked into the tile
  as hard-edged teal specks with a flat halo — **no gradients**, the shimmer
  comes from colour contrast, per the flat-shaded rule.
- **Sacred Meadow** (rare Meadow variant). Golden dawn palette
  `#cfc079 / #ccbd75`, warm grass strokes, occasional gold bloom, and a soft
  light-shaft treatment — a pale wedge laid across the tile. The shaft is a
  hard-edged polygon, not a bloom or blur; it reads as a shaft of light, and
  keeping it hard-edged is what keeps it inside the art language.
- **Drifting motes** are a new particle kind (`mote`): twinkling square core +
  square halo, rising slowly, teal in the Enchanted Forest and warm gold in the
  Sacred Meadow. **These are not fireflies.** Fireflies are gold, forest/dark
  forest only, and night only; motes run day and night and mark the rare
  biomes. Do not merge the two treatments — a mote appearing in plain Forest at
  night would destroy the "you have found somewhere rare" read.
- **Stag / Unicorn / Lightfox**: approved concept art inserted verbatim into the
  `drawSpecies` chain in the existing `P`/`R`/`EY` helper convention — ported,
  not redrawn or reinterpreted. `SPECIES_K` ratios from the reference sheet:
  Stag 1.15, Unicorn 1.30 (tallest ground pet after Shadowfox/Golem), Lightfox
  1.05. All three are ground species, so they inherit the standard walk bob,
  sun shadow, x+y depth sort, and every v16 combat overlay (gold HP bar, lunge,
  downed ring) with no per-species special-casing.
- **Two new gatherable node silhouettes**, both deliberately unlike the ore
  nodes so the 2026-07-07 "everything is grey cube debris" problem does not come
  back: **Rare Herb** is a swaying frond cluster with pale seed heads — plant-
  shaped, no rock base; **Magic Essence** is a hovering violet wisp over a small
  mossy stone, with orbiting motes tying it to the Enchanted Forest floor.
- Grass tufts and cliff moss now follow the variant tones (warm gold in the
  Sacred Meadow, teal-grey in the Enchanted Forest) rather than staying plains
  green — a variant biome whose grass detail is the parent biome's colour reads
  as a palette bug.

### 2026-07-29 (v16 — pet combat states: lunge, damage, downed/recovery)
No new creature art and no new species this build — v16 is a mechanics pass
(stats/targeting/cooldowns live in the README + commit message). The rendering
scope is the set of states the existing pet art now has to read in:
- **Attack lunge, deliberately NOT a wind-up tell.** Pets get a ~200ms sine
  shove toward the target and nothing else. The v13 fairness rule (raised
  weapon + amber "!" before every hit) is a MOB rule and must stay mob-only —
  pets aren't mobs, and giving them a telegraph would misread as an enemy
  about to strike the player. If a pet ever pops an amber "!", that's a bug.
- **Downed read (0 HP, recovers after 75s — pets are never lost).** Dimmed to
  55% alpha, walk bob replaced by a crouch offset so it sits/cowers, and
  fliers (Griffin/Phoenix) drop from their ~28px follow altitude to 2px — a
  grounded flier is the loudest possible "out of the fight" signal. At its
  feet: a dim slate ring with a gold-green arc that sweeps to full over the
  recovery, plus a small "downed Ns" label.
- **The downed ring is NOT the pale-green pulsing tame ring.** That ring means
  "this creature can be tamed right now" (v14) and must keep meaning only
  that. Different colour, different shape (filling arc vs pulse), different
  unit. Never merge the two treatments.
- **Pet HP bar**: same language as the v13 mob bar — thin, above the unit,
  hidden at full HP — but **gold (#d8a24c), not red**. Red bars mean hostile;
  a friendly unit must not wear one. Bar and flash offsets scale by
  `SPECIES_K` so the big pets (Golem 1.65, Shadowfox 1.66, Bear 1.60) don't
  wear their bar inside their own silhouette.
- All combat overlays are **local-player only** — remote pet HP isn't synced,
  so other players' pets keep the plain v11 follower treatment.
- HUD: active-pet HP/damage line under the blood-window line; the Companions
  roster rows now carry each pet's combat stat (or "no combat role" for the
  four Sprites, which have none by design).

### 2026-07-15 (v15 — reference sheet v3 incorporated: players, pets, mobs, weapons, armour)
The whole approved art-reference package is now the live game art. Zero mechanics changed.
- **Players — Direction A "Heroic"**: five distinct silhouettes replace the triangle+head. Mystic = floor-length robe, NO legs, bell sleeves, glowing eyes in a pointed hood, orbiting runes. Knight = broadest body, closed crested helm (no face), plate lames, tabard, shield slung on the back. Ranger = lean, half-cape one shoulder, quiver of fletched arrows, visible jaw under the hood. Beastmaster = asymmetric one-shoulder pelt, bare arms/chest, claw necklace, antler band. Architect = boxy work apron, hammer + chisel on the belt, rolled plans on the back, pencil behind ear. Locked class palettes unchanged. Bodies live in `drawHeroBody` at sheet-native 28px, scaled by `HERO_K = 11/28` inside drawUnit — the 11-unit local space and S=2.1 world proportion are unchanged.
- **Held weapons**: drawHeldWeapon body swapped for the v3 geometry — crossguards+pommels, fuller highlights, bound hafts, bearded axe edges, bow risers with strings, crossbow laths+nuts+bolts, prong-set staff orbs. Same name/signature/local slot, so every call site (players, class-select previews) upgraded at once.
- **Armour**: flat trapezoid → tinted facets + two lame lines + pauldron caps. Tier colours unchanged.
- **Pets (all 11)** and **mobs (goblin/bandit/troll)**: reference-sheet v2 bodies, machine-ported via context-first helpers (P/R/EY/BND/SCL — new names, zero collisions). Per-species/mob draw scales in `SPECIES_K`/`MOB_K` implement the approved size ratios: shadowfox+golem markedly bigger (mount-plausible), bandit human-height, troll ~1.8× player. Overlay heights (`MOB_TALL`) and the weakened ring scale with body size.
- Wind-up raise preserved on all three humanoid weapons through the port — the tell must still read.

### 2026-07-15 (v14 — Troll + fight-to-tame pets: Boar, Bear, Griffin, Phoenix)
Rendering-scope changes (HP/damage/aggro/tame numbers live in the session record):
- **Troll**: big hunched grey-green bulk (#6f8a5e / #41563a), clearly taller than a Bandit — heavy brow shelf, two tusks, stone club, moss patches. Slow stomp reads its weight; its wind-up tell is 750ms vs the standard 550ms and MUST stay visibly longer.
- **Boar** (low brown, dark bristle ridge, ivory tusks, curly tail), **Bear** (biggest ground pet: shoulder hump, round ears, claws), **Griffin** (lion body + pale eagle head, gold beak, flapping wings — flier follow at ~28px when tamed), **Phoenix** (flame-orange bird, gold flame crest, persistent ember-mote trail in ALL states — flier follow ~28px). One drawSpecies branch each serves both the hostile mob form and the tamed follower — same creature, same art, which is the point of fight-to-tame.
- **Weakened tell**: when a fight-to-tame creature drops below the wear-down threshold it stops attacking, cowers (slight crouch offset), and a pale-green pulsing ring appears at its feet + the name tag flips to "weakened!" green. This is the tame-window advertisement — if players don't notice the state change, check the ring is drawing.
- Hostile beasts reuse the amber "!" wind-up tell; no weapon-raise (they have no weapons) — the "!" plus a pre-lunge crouch IS their tell.

### 2026-07-14 (v13 — hostile mob framework: Goblin + Bandit art)
Rendering-scope changes (mob HP/damage/aggro numbers, wear-down threshold, and the peer-sync model live in the session record, not here):
- **Goblin**: small hunched green humanoid — two-facet body (#5f8a3c / #46682c), pale-green head blob, two pointed ear triangles, crude brown club held low. Reads smaller and scrappier than any player class.
- **Bandit**: human-scale but hooded — leather two-facet body (#7a5c40 / #5a4430), near-black hood covering the head blob, short steel blade. Deliberately darker/duller than player Knights so the silhouette can't be confused for another player.
- **Wind-up tell (the fairness rule)**: before every mob attack there is a ~550ms telegraph — the weapon arm raises AND an amber "!" pops above the head. A hit must NEVER land without this tell rendering first. If mobs ever feel like they hit instantly, check the tell is drawing.
- **Mob HP bars**: thin bar above the mob only once damaged (full-HP mobs stay clean), same visual language as player bars but smaller and red-tinted.
- Mobs use the standard unit sun-shadow, depth-sort by x+y like every other entity, and die with the existing burst particle language — no new death art.

### 2026-07-14 (v12 — bible pet roster + Beastmaster Shrine)
Rendering-scope changes (tame percentages, blood-decay curve, bait/bond mechanics, shrine timings live in the session record as tunable values, not here):
- **Fox/Fawn/Owl art RETIRED** with their species — replaced by seven bible-accurate species. Legacy roster rows may still reference them; code guards prevent crashes but they no longer render or follow.
- **Four elemental Sprites** (hovering wisps, low float ~10px, gentle bob): **Tree** (leafy green teardrop + sprig), **Water** (cyan droplet + wave arc), **Stone** (chunky hovering rock cluster + orbiting pebble), **Wind** (translucent pale swirl strokes — the only intentionally semi-transparent creature).
- **Wolf pup** (grey faceted, ears/snout/tail — direct descendant of v10's wolf art at smaller scale), **young Golem** (heavy blocky, moss patch, slow stomp bob), **Shadowfox** (sleek near-black fox, faint dark wisp trail; night-only so it mostly renders under the night palette).
- **Beastmaster Shrine**: small stepped stone altar near the safe zone edge, carved antler motif + paw dots on the face — same hand-crafted architecture language as the Forge. Pulses a warm gold-green glow (Tower-orb treatment) while any shrine blessing is active in the world.
- HUD: tame prompts now show the live computed success %, plus small lines for active shrine blessing countdown and blood-bonus state. Buff is deliberately private — no character aura.

### 2026-07-13 (v11 — logo font, plateau silhouette, Wild Companions art)
Rendering-scope changes (taming chance, roster mechanics, and the retirement of v10's auto-assigned pets live in the session record, not here):
- **Logo/header font**: Eagle Lake → **Almendra Display** (user pick from Art Nouveau direction). Gold + glow unchanged; Barlow body untouched.
- **BUG FIXED: grey plateau read as a straight-edged tabletop.** Root cause: baked notches were paint-only and too rare (hash > 0.78/0.8) to break a long contiguous cliff line — the plateau's actual tile silhouette stayed perfectly straight. Fix is geometric + paint: (a) deterministic **edge erosion** — boundary tiles of elevated regions (h ≥ 1, non-volcano, non-peak, non-safe-zone) drop one level ~30% of the time, breaking straight runs with real steps; (b) notch/outcrop chances raised to 0.55/0.6/0.7. Lesson: silhouette problems need geometry changes, not just surface decoration.
- **Wild Companions art**: three tameable species, low-poly faceted, distinct from rabbits and from each other — **Fox** (rust-orange, pointed ears, bushy tail; forests), **Fawn** (tan, taller thin body, white spot dots; meadows), **Owl** (stubby grey-brown flier, big head; rocky foothills). Wild ones wander near a home point; tamed active ones reuse the trail/circle follow language from v10. Old wolf/hawk models retired with the auto-assign system.
- New UI panel: Companions roster (same dark panel + gold header + Barlow language as Inventory/Crafting). Taming shows a small channel bar above the creature.

### 2026-07-13 (v10 — fonts, pets, armor, combat-feel pass)
Rendering-scope changes (combat mechanics — crit multiplier, poison numbers, knockback amounts, block reduction — live in the session record, not here):
- **Fonts replaced**: logo + panel headers Cinzel → **Eagle Lake** (user found Cinzel too basic); body UI Rubik → **Barlow**. All in-canvas ctx.font uses updated to Barlow. Gold colour + glow treatment on the logo unchanged.
- **Companion pets (visual-only)**: wolf (faceted grey ground-follower, trailing bob) and hawk (small faceted glider, circles the player when idle, trails at altitude when moving). Deterministic per player from username hash, drawn for all clients client-side, deliberately distinct silhouettes from ambient rabbits. No combat/stats yet.
- **Armor chest-plate tint**: single trapezoid overlay on the torso in tier colour (steel/cyan), lit/dark split matching the body facets. Base silhouette unchanged.
- **Block pose**: shield classes holding block show an enlarged raised shield on the facing side.
- **Hit stagger**: struck players recoil a few px opposite the hit direction with fast decay (local player directional; remote players brief shake during their flash window).
- **Poison tell**: small green motes rise off poisoned players while the effect runs.
- **Crit tell**: backstab damage numbers render amber with an "!" and slightly larger than normal hits.

### 2026-07-11 (v9 — combat/UI visual pass)
Rendering-scope changes (gameplay additions — new weapon types, recipes, dev chest — are documented in the session record, not here, per this skill's visual-only scope):
- **BUG FIXED: runic/dragonsteel auras were invisible** — the tier aura was drawn as a flat ellipse under the unit BEFORE the unit's own sun-shadow ellipse, which painted over it at the same position. Fix: tier effects now draw AFTER the unit, as a visible pulsing ring + rising motes. Lesson: draw-order within a single entity matters as much as entity sort order.
- **Every equipped weapon now renders a held silhouette** on the tiny unit (sword/spear/dagger/axe/bow/crossbow/staff), tier-coloured (steel/cyan/purple). Class identity props (helm, hood, hat, shield) stay; class default weapon props yield to the equipped weapon.
- **Melee swings sweep the weapon's own silhouette**, per-weapon motion: dagger fast tight arc, sword medium arc, spear straight thrust, axe wide slow arc, staff = magic pulse (no physical swing).
- **Projectiles have real shapes**: fletched arrow (bows), short thick bolt (crossbows), glowing orb (staves). Tier colours kept.
- **Floating damage numbers** rise and fade on hits (outgoing and incoming).
- **UI font swapped**: body text Pixelify Sans → Rubik (clean geometric sans; pixel font clashed with the flat-shaded direction). Cinzel retained for logo + panel headers only. All in-canvas ctx.font uses updated to match.
- **Class cards enlarged with idle-animated previews** + per-class "best weapons" blurb.
- Inventory rows now carry diamond item icons matching in-world ground-item icons.
- New world prop: dev supply chest near spawn (distinct wooden chest silhouette — flagged DEV-ONLY in code).

### 2026-07-11 (second review, v6 build) — addressed in v8
Confirmed working in v6 and MUST NOT regress: no fake roads (plateau elevation), decor density, birds, angular runic crystals, mountain/volcano separation, hand-composed ruin (user declared it DONE — never alter its composition), organic tree clustering (user likes it — never alter placement/density).
- **Individual tree art reads childish/clip-art** (two stacked circles). FIXED in v8: faceted low-poly polygon canopies, hard lit/dark facet split, per-tree width/lean/archetype variety; two canopy archetypes per forest (tall faceted + wide flat-top). Placement untouched.
- **Iron nodes mistaken for tiny huts** (rectangular orange patch = roof). FIXED in v8: orange vein streaks across facets, irregular boulder silhouettes.
- **Snow mountain reads as one flat wedge/glacier slab.** FIXED in v8: peak height now varies 2–4 levels via fine noise, producing broken stepped massif.
- **Sand flat/textureless; some sand non-coastal and unexplained.** FIXED in v8: dune ripple strokes, wet-sand band at waterline, shells/driftwood; non-coastal sand becomes rocky foothill.
- **Shape language too box-and-cone for natural features.** FIXED in v8: rocks get 3 hashed silhouettes (worn boulder / jagged shards / low slab); cliff faces get occasional notches and outcrop chunks. Architecture (Tower/Forge) deliberately stays clean/geometric by contrast.
- Additions in v8: ruin well (decor), signpost with real directional text, grazing rabbits, tower water reflection (when coastal), torch posts whose night glow marks lit ground near spawn, player-proximity grass sway, daytime butterflies over meadows, dock/jetty, sun-dimming cloud passes, deliberate dirt trail Spawn→Forge (single narrow intentional trail — distinct from the old fake-road bug), parallax horizon hills, lava heat-shimmer lines, bugs near bushes.
- Deferred pending user confirmation (do NOT build silently): interactable healing well; ore spawning in 2–3 node clusters.

### 2026-07-11 (screenshot review, v5 build) — all addressed in v6
Confirmed working in v5 and MUST NOT regress: monumental tower design, forge building silhouette, clean grass safe zone, cream stepped cliffs, warm palette, finite distinct ore.
- **Runic nodes too frequent + shards read as scattered "blue flames"** — reduce spawn rate sharply; sharper angular Bad North-style crystals, no rounded flame tops. FIXED in v6.
- **Ruins read as cluttered rubble/messy village** — replaced per-tile scatter with one hand-composed layout: broken wall run, standing archway, corner fragment, fallen column, sparse rubble, open ground between. FIXED in v6.
- **Long diagonal grey bands across grass (fake "roads")** — cliff faces along thin single-level noise contours formed corridor strips. Fixed by generating elevation from coarse plateau noise (wide blobs, no thin contour lines). FIXED in v6. Open design option (not built): deliberate stone paths Spawn→Forge→Tower, Thronefall-style.
- **Mountain snow block flush against volcano rock, no transition** — enforced larger landmark separation + no snow PEAK tiles within volcano radius (downgraded to ROCK buffer). FIXED in v6.
- **World too sparse vs references** — added non-gatherable decor: bushes, flowers, pebbles, fence bits near spawn. FIXED in v6.
- **No shoreline life** — animated white foam edge where shallow water meets land. FIXED in v6.
- **No sky/horizon treatment** — day/dusk/night-reactive gradient sky behind the island; deep water stays dark. FIXED in v6.
- **Cliff faces a single flat tone** — added baked cracks, moss drip at grass tops, subtle base banding; approach/colours unchanged. FIXED in v6.
- **Forge lacks individual character** — added doorway with shadow, warm window, beam, wood stack; silhouette unchanged. FIXED in v6.
- **No ambient life** — 3 bird silhouettes circling the Tower. FIXED in v6.
- **Peak silhouette boxy** — per-tile jittered peak tops + occasional snow spikes for jagged outline. FIXED in v6.
- **World edge is an invisible wall** — deep water darkens toward the map border (kept dark, not lightened). FIXED in v6.

### 2026-07-07 (screenshot review, isometric v4 build) — all FIXED in v5, verified via 2026-07-11 screenshot
- **Ore/rock nodes look identical and infinite** — no visual distinction between plain rock / iron / runic stone at normal zoom (colour flecks too small to read). Gameplay-wise, ore nodes were also infinitely mine-able — **this is a gameplay bug, not art, but was flagged in the same pass**: nodes must be consumed on gather and not respawn instantly (or respawn on a long timer), and must have a clearer, larger, more distinct visual per ore type — bigger colour patches, not tiny flecks, or a distinct silhouette shape per type.
- **The Spawn Forge is not visually distinct from generic rock/ore clutter** — needs a clear forge silhouette (anvil/furnace/chimney shape) that reads instantly as "building," not more grey rubble.
- **Safe zone ground rendered as a separate brown/dirt patch with a strange bright green pool in the middle** — this is wrong; the safe zone should just be the normal grass biome under the dashed boundary ring, not a distinct crater-like texture.
- **The Eternal Tower reads as a thin plain silo, not a grand centerpiece** — needs significantly more visual mass/width, a proper stepped base, and architectural silhouette detail (buttresses, wider crown, more levels) — it should dominate the skyline the way Thronefall's central keep does.
- **Ruins and mountain both read as generic "grey cube debris"** with no distinct silhouette language separating "this is a ruin" from "this is a mountain" from "this is a rock resource node." Each needs its own distinct shape vocabulary.
- **Mysterious floating "+1" diamond icons** appeared scattered near mountain/ruins in a screenshot — flagged as a likely rendering bug (unclear source), needs investigation, not a wanted effect.
- **Tree spacing too uniform/grid-like** — reads as a planted orchard rather than an organic forest; needs randomised clustering and gaps.
- **Player light glow is a hard, unnatural circular vignette** ("flashlight cone" look) rather than ambient light bleeding naturally into the surroundings.
- **No visible stepped elevation/cliffs** despite height data existing — the ground reads flat with no sense of tiers, even in mountain regions.

## Process reminder for whoever is iterating on this

1. Read this skill fully before touching any rendering code.
2. After any build, the user reviews via **screenshot**, not a live look from Claude (Claude cannot see the rendered canvas directly). Wait for a screenshot before assuming a fix worked.
3. When the user reports a new problem, add it to the "Known visual problems" list above (with date) before or while fixing it, so it persists across sessions.
4. Do not touch gameplay logic (combat, inventory, database schema, multiplayer sync) during an art-only pass unless the user explicitly asks — cross-reference the "Technical foundations" section above.
5. World size, landmark list, and other scope decisions for the current dev build are tracked in conversation/project context, not duplicated here — this skill is about the RENDERING RULES only.
