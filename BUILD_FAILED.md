# BUILD FAILED — Mob Rarity + Music (2026-08-21 overnight)

`runehaven.html` is **unchanged**. Nothing was patched, nothing was shipped.
`NEXT_BUILD.md` was not touched. The baseline was verified green before any
analysis: `run3` `CAUGHT ERROR: none`, `run4` **842 PASS / 0 FAIL**, `run5`
945 coverage draws, `CAUGHT: none`.

One RED condition stopped the build. Per the README's rule 5 that means the
whole version stops — the other four parts are analysed below and are ready
to go the moment PART C is resolved, so this should be a one-line amendment
to the spec rather than another night of investigation.

---

## THE BLOCKER — PART C cannot be built as written

**PART C's tier multipliers, combined with its 1.1x for the Elders, break a
regression guard that Tuning/Polish shipped one version ago specifically to
prevent this exact outcome. There is no set of values inside PART C's own
ranges that avoids it.**

### What the guard is

Tuning/Polish PART A raised the three Elders to `2.70 / 2.40 / 1.85` because
they "were a stat tier wearing a base-tier silhouette". Its changelog entry
says, in as many words:

> Pinned as a RELATIONSHIP in `run4`, never as a literal, so a future pass
> that sizes up a base tier cannot leave an Elder quietly level with it.

That gate is `debug/run4.js`, and it asserts each Elder is at least **35%**
larger than the largest member of the line it heads:

```js
const elderVs = [
  ['Golem Elder',   SK.golem_elder,   Math.max(SK.golem, SK.crystal_golem)],
  ['Dragon Elder',  SK.dragon_elder,  Math.max(SK.fire_dragon, SK.water_dragon,
                                                SK.storm_dragon, SK.shadow_dragon)],
  ['Unicorn Elder', SK.unicorn_elder, SK.unicorn],
];
// k >= base * 1.35
```

This pass **is** the "future pass that sizes up a base tier". The guard fires
exactly as designed.

### Why no value in PART C's ranges works

PART C gives the Elders' own line-mates a **larger** multiplier than it gives
the Elders (Rare 1.5–1.65x and Epic 1.7–1.85x against the Elders' 1.1x), so
the gap Tuning/Polish opened necessarily closes. Both ends of every band were
built and actually run through `run4` on a scratch copy — this is measured,
not arithmetic:

**Mid-band (Common 1.20 / Uncommon 1.35 / Rare 1.575 / Epic 1.775 / Elder 1.1):**

```
FAIL - PART A: Golem Elder is the largest of its line by a real margin (2.97 vs 2.68, +11%)
FAIL - PART A: Dragon Elder is the largest of its line by a real margin (2.64 vs 2.44, +8%)
FAIL - PART A: Unicorn Elder is the largest of its line by a real margin (2.04 vs 2.05, +0%)
```

**Most favourable legal choice — the *minimum* of every band, so each Elder's
gap is as wide as PART C permits (Common 1.15 / Uncommon 1.30 / Rare 1.50 /
Epic 1.70 / Elder 1.1):**

```
FAIL - PART A: Golem Elder is the largest of its line by a real margin (2.97 vs 2.55, +16%)
FAIL - PART A: Dragon Elder is the largest of its line by a real margin (2.64 vs 2.33, +13%)
FAIL - PART A: Unicorn Elder is the largest of its line by a real margin (2.04 vs 1.95, +5%)
```

All three fail at both ends. `run4` goes 842/0 to **838 PASS / 4 FAIL**.

### The part that is worse than a failing assertion

Look at the mid-band Unicorn Elder line: **2.04 vs 2.05, +0%**.

At mid-band the Unicorn Elder is the *same size* as a plain Unicorn, and at
the top of the Rare band (unicorn 1.30 x 1.65 = 2.15) it is **smaller than
one**. Tuning/Polish shipped it at +42% eight days ago. That is not an
assertion that needs updating — it is the mechanic inverting.

### Why this was not resolved by judgment

Both available fixes are design decisions with real visual consequences, not
tunables, so rule 5 puts them out of reach:

1. **Give the Elders a bigger bump than 1.1x.** To restore the 35% margin
   they need roughly **x1.28–1.50** (see the table below). PART C explicitly
   rules that out — "a smaller additional bump only ... not a second full
   pass". Overriding it would be me redesigning PART C.
2. **Relax the `1.35` margin in `run4`.** That is gutting a guard shipped one
   version ago for this exact case. The README's precedent is assertions
   "updated, not relaxed" when the spec *deliberately* changes the pinned
   thing; PART C never mentions the Elder relationship at all, so this would
   be collateral damage quietly written off, not an update.

Rule 5 also says: when genuinely unsure which zone something belongs in,
treat it as RED. A failing harness is named as the objective, never-overridden
signal.

---

## What would unblock it — pick one, and PART C ships as-is otherwise

**Option 1 (recommended) — give the Elders their own size band.** Treat Elder
as a tier in PART C rather than an afterthought, at roughly **1.45–1.55x**.
At 1.5x: `golem_elder 4.05`, `dragon_elder 3.60`, `unicorn_elder 2.78`, which
lands **+51% / +48% / +35%** over mid-band line-mates — the guard passes, and
the Elders stay the size tier Tuning/Polish just established. This keeps
"every pet gets bigger, by tier" fully intact and only changes the one number
PART C left too small.

Minimum Elder multiplier needed to clear the guard, per line-mate choice:

| Elder         | current | vs line-mates at band MIN | vs line-mates at band MID |
|---------------|---------|---------------------------|---------------------------|
| Golem Elder   | 2.70    | x1.28                     | x1.34                     |
| Dragon Elder  | 2.40    | x1.31                     | x1.37                     |
| Unicorn Elder | 1.85    | x1.42                     | x1.50                     |

**Option 2 — deliberately retire the Tuning/Polish PART A relationship.** Keep
Elders at 1.1x and lower the `run4` margin (or drop the gate). This is a real
reversal of a decision made one version ago and needs to be said out loud in
the spec, not inferred. Note it still leaves the Unicorn Elder within a few
percent of a Unicorn, so it likely wants Option 1 for that one regardless.

**Option 3 — exempt the three Elder lines from PART C.** Common/Uncommon get
their bumps; Rare and Epic species that head into an Elder (unicorn,
crystal_golem, the four dragons, golem) stay where they are. Cheapest to
build, but it contradicts "every pet gets bigger" and leaves the size tiers
uneven.

---

## Everything else — analysed, no blockers found

These were all worked through against the live file before stopping, so the
next run should be able to go straight to patching.

### PART A — daily population caps: buildable, but needs ONE decision

The mechanic itself is clean and the hooks all exist:

- Rarity is **bible content, not invented** — `RUNEHAVEN_BIBLE.md` has an
  explicit "PETS — FULL RARITY TABLE" with Common / Uncommon / Rare / Epic /
  Elder membership, so a `RARITY` map is a transcription, not a design.
- `worldDayNum()` is already the single shared counter (`dayWindowOpen()` and
  `bloodMoonActive()` both key off it) — no second counter needed.
- The cap layers onto `count` exactly as the spec asks: the wilds loop
  (`buildFeatureList`, `placed < def.count`) and the mobs loop take
  `Math.min(def.count, capLeft)`, and the mob respawn at `updateMob` holds a
  revive while the day's allotment is spent. Density logic untouched.
- Takes hook cleanly at `resolveTaming()`'s success branch and `mobKill(m,
  true)`. Every `mobHit()` call site is local-player-originated, so there is
  no double-count from the broadcast path.
- Boot ordering already works: `loadMinedNodes()` runs before
  `buildFeatureList()`, so a `loadRareTakes()` beside it is seen by worldgen.

**The decision needed: where the day's take-count lives.** There is currently
*no* persistence of a wild being removed — `wilds` is regenerated from
worldgen on every login, so a creature tamed by one player is back for the
next player who logs in. A genuinely *world*-wide cap therefore needs new
storage. Two readings, and picking one is a schema decision rather than a
tunable:

1. **A new `rare_takes` table**, shaped exactly like `mined_nodes`
   (`day_num integer, species text, taken_by text`), loaded at boot,
   inserted un-awaited and error-swallowing, broadcast so live clients tally
   immediately, degrading to "caps still apply, takes just do not persist" if
   the column is absent. This is the v25/v33/v34/v38 house pattern and would
   ship with the usual "a small SQL update is needed" note.
2. **Session-local only** — simpler, no SQL, but then it is a per-session cap
   rather than a world one, which is a materially weaker version of what the
   spec asked for.

Say which and PART A goes in without further questions.

**Second, smaller question:** should the Elder tier be capped at all? All
three Elders are already hard singletons placed outside the density system
(`biomes: []`, hand-placed, with their own v39 mechanisms), so a daily cap on
them is redundant at best and risks disturbing working v39 code. The plan was
to record their rarity but exempt them from the cap and flag it — confirm or
override.

### PART B — Griffin and Shadowfox: verified, no conflict

Both premises check out against the live file. `griffin` and `shadowfox` are
both at `base: 0.35`. Uncommon tier-mates are wolf 0.50, golem 0.50, boar
0.45, stag 0.45, bear 0.40 — the spec's "0.40–0.50" is exact, and 0.42 fits.
Epic tier-mates are lightfox 0.20, krakenling 0.20, salamander_king 0.20 —
0.20 is exact. No `run4` assertion pins either value. Ready.

### PART D — the music: verified, no conflict

`BG_PLAYLIST` holds exactly Pop/Slower_Jamz/Long_Way_Home/song as the spec
says. `audio/siren.mp3` and `audio/tension.mp3` are both present. The
`combatMusicUntil` / `COMBAT_MUSIC_LINGER` mechanism is intact with three
signal sites, and a separate Elder-scoped signal hooks cleanly into
`mobHit(m, ...)` and the mob-attacks-player branch of `updateMob`, where the
mob is in scope.

Two notes for whoever builds it:

- **`def.elder` does not exist on `MOBS`.** The spec's
  `m.kind === "elder_drake" || def.elder` only resolves if `def` is the
  `WILD_SPECIES` entry (`golem_elder`/`dragon_elder`/`unicorn_elder` carry
  `elder: true`; no `MOBS` entry carries it). Reading both tables satisfies
  either intent and was the plan — flagging it because the spec offered the
  expression as if it were live code.
- Four `run4` literals will need the **"updated, not relaxed"** treatment
  (playlist length 4→5, the `% 4` wrap, `bgAt === 5`, and
  `split('AudioEngine.playMusic(').length === 3` for the third call site).
  All are cases where the spec deliberately changes the pinned thing, which
  is the established precedent — none is a blocker.

### PART E — credits: verified, no conflict

The credits arrays are data, exactly as v23 built them for this. No blocker.

### Two incidental findings, no action taken

- **`debug/run4.js` line ~2214 pins two SPECIES_K values as literals**
  (`so.lightfox === -(2.2 * 1.05)`, `so.shadowfox === -(2.2 * 1.66)`), so
  PART C will need them updated whichever option is chosen. This one *is* a
  benign "update, not relax" — the invariant (seat height scales with each
  species' own ratio) survives, and the ordering
  `shadowfox > griffin > lightfox` holds at every PART C band. It shows up as
  the fourth FAIL in both probe runs above.
- **`SKILL.md`'s Tuning/Polish entry says `run5` is "1,144 coverage draws";
  the actual current run reports 945.** `run5` is clean either way
  (`CAUGHT: none`), so this is documentation drift rather than a failure —
  noted rather than silently corrected, since the entry offered the number as
  evidence.

---

## State of the repo

- `runehaven.html` — **unchanged**, byte for byte.
- `NEXT_BUILD.md` — **untouched**, still pointing at this spec.
- `runehaven-art-style/SKILL.md` — untouched, no changelog entry added (there
  is no version to describe).
- `debug/*` — untouched.
- The two scratch copies used for the probes were deleted; the working tree
  carries only this file.
