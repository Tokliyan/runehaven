# BUILD FAILED — 2026-10-10

**Target:** `NEXT_BUILD.md` → README.md, "Confirmed, locked spec for a future
version (World Encounters — Roaming Boss & Bounty Board)".

**Outcome: STOPPED at RED before any code was written. `runehaven.html` and
`runehaven-art-style/SKILL.md` are untouched — byte-identical to v59.**
Nothing was shipped, nothing was half-shipped, no creature was invented.

---

## THE BLOCKER: PART A cannot be built without inventing a mob

PART A asks for, in its own words, **"a new, additional Boss-tier creature
with no fixed home"**, explicitly separate from the Elder Drake.

The bible's `## MOBS` table contains exactly **one** Boss-tier entry, and it
is the one PART A rules out:

```
Demon Knight — Deep dungeons — Very Hard — Dragonsteel
Elder Drake  — Volcano, World Boss — Boss tier — Dragonsteel, legendary loot
```

There is no second Boss-tier creature anywhere in `RUNEHAVEN_BIBLE.md` — not
in MOBS, not in the pet rarity table, not in WORLD EVENTS, not in the
landmark or biome sections. The file already knows this and says so in two
places, written by earlier builds:

- `runehaven.html:2907` — `/* v30: the bible's only boss-tier creature. */`
- `runehaven.html:19283-19284` — `fighting the bible's only boss-tier creature`

So "a new, additional Boss-tier creature" is, unavoidably, a **new mob with a
new name, new lore and a new on-screen design that the bible does not list.**
That is the README's second RED condition, verbatim:

> The spec would require inventing bible content — a pet, mob, biome,
> location, or lore element not in the bible. This is a creative integrity
> rule, not a bug-severity one, and severity never overrides it.

### Why the "flag it non-canon" carve-out does not rescue this

Standard-process rule 3 does allow non-canon additions *if explicitly
marked*. That carve-out has only ever been used for **items** —
`divers_charm` (v21), `void_shard` (v32), `raw_meat` (v58) — and v58's own
changelog drew the line in exactly the place that matters here:

> **No new mob, no new biome, no new gatherable node and no bible content was
> invented** — two items were added and both are flagged non-canon.

Rule 5's RED list names "mob" explicitly and says severity never overrides
it. A world boss is the most lore-loaded object in the game: it needs a name,
a silhouette, a habitat story and a reason to exist, and every one of those
would be mine rather than the bible's. Where rules 3 and 5 appear to
disagree, rule 5's own tie-breaker applies — *"When genuinely unsure which
zone something belongs in: treat it as RED."*

### The three canon-adjacent readings I checked, and why each is also a guess

1. **A second Elder Drake that roams.** Contradicts the spec ("separate from
   the Elder Drake") and the bible (Elder Drake = Volcano, one world boss).
2. **Promote an existing canon mob to Boss tier and un-pin it.** Every
   candidate has a bible-stated home and a bible-stated tier: Troll
   (Mountains, Medium), Dark Wraith (dark forest/dungeons, Medium), Adult
   Golem (Ruins, Hard), Sea Serpent (Underwater, Hard), Demon Knight (deep
   dungeons, Very Hard). Choosing one and rewriting both its tier and its
   habitat is a bible edit, and *which* one is a creative decision, not a
   tunable.
3. **An "adult wild dragon" — the closest thing to canon.** The bible does
   name adult wild dragons as real, killable world creatures
   ("Killing an adult wild dragon in the world" is a dragonsteel source), and
   **no adult-dragon mob exists in the file today** (the whole `MOBS` roster
   is: elder_drake, goblin, bandit, troll, boar, bear, griffin, phoenix,
   dark_wraith, sea_serpent, adult_golem, demon_knight, basilisk,
   salamander_king, golem_elder). **This is the most promising route and it is
   the one I would recommend asking about** — but it still needs a human call,
   because the bible pins each dragon species to a territory (Storm → The
   Shattered Peaks / mountaintops, Shadow → The Abyssal Hollow / dark
   dungeons, Fire → deep lava caves, Water → deep underwater caves), which
   directly contradicts "no fixed home, moving across biome boundaries", and
   it never puts any dragon at Boss tier. Picking which of the four roams,
   and releasing it from its canon territory, is a design decision.

I am not allowed to pick between these, so I picked none.

## Supporting concern (not the primary blocker): "effectively unleashed" is new movement architecture

Worth knowing when you answer the question above, because it affects scope.
The spec's opening premise is correct — deterministic leash-bound idle-wander
does exist (`runehaven.html:8121-8160`) — but **every creature in the file is
anchored to a fixed home `(m.hx, m.hy)`, and the leash is load-bearing in the
state machine, not decoration.** `fromHome` vs `leashRadius` is what
classifies idle / leash / aggro, and the hotfix comment at `:8123-8134` records a
real bug (164 state flips in 10 seconds) from the last time that threshold
and the wander amplitude disagreed. The largest `leashRadius` in the file is
**24** (the drake; next is 16), so "dramatically larger" means leaving that
regime entirely, which raises at least these interdependent, unspecified
questions:

- What replaces the leash in the state machine once there is no home to
  measure from?
- What keeps it out of `BLOCKED` biomes and off water across a whole-map walk?
- The bible's server "runs 24/7" and the spec says "over real time" — where
  does its position live between sessions, given the current mob array is
  rebuilt per login from the world seed?
- How does a count:1 hand-placed singleton interact with the per-biome spawn
  budgets it would now wander through?

These are tunables individually but a design together, which is the README's
fourth RED clause. On its own I would have flagged this YELLOW and built it;
I am recording it because it is the real cost of PART A, and the invented
creature above is the hard stop.

## What is NOT blocked

**PART B (the rotating bounty board) is fully buildable today — every piece
it asks to reuse exists, and I verified each one:**

- Day counter: `worldDayNum()` at `:8383`, already shared by the rare-take
  gate and the v25 Krakenling window — exactly the "same day-counter other
  daily systems already use" the spec names.
- Daily-rotation precedent: `rareTakesDay` (`:8449`) already resets on day
  rollover.
- Safe-hub interaction point: the Oracle is the pattern to copy — `ORACLE`
  at `:1629` sits at Spawn with `nearOracle()` at `:1651`; the Beastmaster
  Shrine (`SHRINE` `:1610`, `nearShrine()` `:10206`) is the same shape. The
  Bazaar has real geometry too (`BAZAAR` `:1790`, `BAZAAR_R` 10).
- Reward: existing per-mob `loot` arrays, no new currency needed.
- `inSafeZone(x, y)` at `:9359` exists for the "never enters a Safe Zone"
  gate PART A would have needed.
- Boss-bar reuse would have been genuinely cheap: `BOSS_KIND` (`:19304`) is a
  single `const "elder_drake"` behind one early return, and
  `isElderCombatant()` (`:19267`) already handles the two-table Elder lookup.

**I did not build PART B alone.** The spec is one locked unit and shipping
half of it is the "half-finished build" the routine prompt forbids; the README
also says to leave `runehaven.html` unchanged on a RED.

## Baseline state — the tree is green, this stop is spec-level only

Verified on the untouched v59 file, so you know nothing is broken:

- `new Function(scriptText)` parse check — **both script blocks parse OK**
- `node debug/run3.js runehaven.html` — **`CAUGHT ERROR: none`**
- `node debug/run4.js runehaven.html` — **zero `FAIL` lines**
- `node debug/run5.js runehaven.html` — **`coverage draws: 1361 — CAUGHT: none`**, zero `COVERAGE GAP` lines

(`npm install` was needed first — `jsdom` is not vendored in the container.)

---

## WHAT I NEED FROM YOU — one decision

**Name the roaming boss, or tell me to rewrite PART A.** Concretely, any one
of these unblocks the next run:

1. **"Use an adult wild dragon, species X"** — name which of Storm / Shadow /
   Fire / Water, and confirm it may leave its bible territory. This is the
   most canon-faithful option (option 3 above).
2. **"Add it as a non-canon world boss named N"** — an explicit instruction
   extending rule 3's non-canon carve-out from items to creatures for this
   one build, with the name you want. I will flag it non-canon in the file
   exactly as `void_shard` is.
3. **"Add it to the bible first"** — put the creature in
   `RUNEHAVEN_BIBLE.md`'s MOBS table and nothing is invented at all. Cleanest
   option.
4. **"Drop PART A, ship PART B"** — edit the spec in README.md to the bounty
   board alone and the next run ships it immediately; it is ready.

## NOTE FOR THE NEXT AUTOMATED RUN — do not try to fix this yourself

This report is **not** a bug report and there is nothing here a build can
repair with a patch. It is a blocked creative decision that needs the project
owner. Per the routine prompt's own instruction — *"Do not invent a fix if
the report is unclear"* — if you are reading this and `README.md`'s World
Encounters spec and `RUNEHAVEN_BIBLE.md` are both still unchanged from
2026-10-10, **the blocker still holds: do not name a boss, do not ship PART B
alone, do not delete this file.** Stop again and leave this report in place.
