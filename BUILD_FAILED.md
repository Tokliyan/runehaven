# BUILD FAILED — World Encounters (Roaming Boss & Bounty Board)

**Date:** 2026-10-03
**Target:** `NEXT_BUILD.md` → README.md "Confirmed, locked spec for a future
version (World Encounters — Roaming Boss & Bounty Board)" (README.md:731)
**Outcome:** Stopped before any edit. `runehaven.html` is byte-for-byte
unchanged. Nothing was patched, nothing was shipped.

---

## The blocker, in one sentence

**PART A requires a Boss-tier creature that does not exist in the bible, and
inventing one is a RED stop under the standard process (README.md rule 5,
third RED bullet) — the one rule the process says severity never overrides.**

## Why this is RED and not a tunable

PART A is explicit that the roaming boss is **not** an existing creature:

> "The Elder Drake stays exactly fixed at the Volcano, per the bible — this is
> a **new, additional Boss-tier creature** with no fixed home"

I checked the bible's full `## MOBS` table. It has exactly eight entries, and
exactly **one** at Boss tier:

```
Elder Drake — Volcano, World Boss — Boss tier — Dragonsteel, legendary loot
```

That one is the creature PART A explicitly excludes. `runehaven.html` already
agrees, in its own words at the top of the `MOBS` table (runehaven.html:2907):

```js
/* v30: the bible's only boss-tier creature. */
```

So building PART A means inventing a creature — a name, a biome relationship,
and a place in the world's lore. README.md rule 5 lists exactly this as RED:

> "The spec would require inventing bible content — a pet, mob, biome,
> location, or lore element not in the bible. This is a creative integrity
> rule, not a bug-severity one, and severity never overrides it."

I did consider whether rule 3's escape hatch applies ("never add a pet/mob/
location the bible doesn't list **without explicitly marking it non-canon**"),
i.e. shipping the boss flagged as non-canon. Two reasons I did not take it:

1. Rule 5's RED bullet is the stop-decision rule and says severity never
   overrides it; rule 3 governs how canon is handled in a build that is
   already cleared to proceed. Where the two pull against each other, rule 5's
   closing line is the tie-breaker: *"When genuinely unsure which zone
   something belongs in: treat it as RED."*
2. There is no precedent to follow. `grep -i "non-canon" runehaven.html`
   returns **zero** hits across all 59 shipped versions — every creature in
   the game traces to the bible. A first-ever non-canon world boss is a
   project-identity decision for the owner, not a call for an unattended
   3am build to make.

## A second, independent bible conflict — worth knowing before you decide

Even if a name were supplied, the bible closes the dragonsteel list:

> "**Only obtained by:** Killing an adult wild dragon in the world / Killing a
> Demon Knight in a dungeon / Defeating the Elder Drake world boss at the
> volcano / Killing another player's tamed dragon"

The bible's own Boss tier drops "Dragonsteel, legendary loot". So a second
Boss-tier creature forces a choice between two contradictions: give it
boss-tier loot and it becomes a **fifth** dragonsteel source the bible says
cannot exist, or withhold it and it is the only Boss-tier creature in the game
without Boss-tier loot. Material Tier 5 says the same thing a second time.
This is a design decision with real gameplay consequences (dragonsteel scarcity
is what makes it a visible target — see the purple-aura paragraph), not a
tunable I should pick a number for.

---

## What I verified is ready, so none of this has to be re-checked

The investigation is done and the infrastructure claims in the spec hold. When
PART A is unblocked, the build starts from here rather than from scratch:

| Spec requirement | Status |
|---|---|
| "deterministic idle-wander logic already exists, leash-bound to `leashRadius`" | **Confirmed live** — runehaven.html:8125-8140, and the wild-creature wander at :16976 |
| "Reuses the existing boss-bar ... from prior versions" | **Exists** — `#bossBarWrap`/`#bossName`/`#bossHp` (:646-648), driven at :19340 |
| "and Elder-tier music cue" | **Exists** — `ELDER_MUSIC_URL` (:19263), cue logic :12381-12386 |
| "confirm it never enters a Safe Zone" | **Gate is writable** — `inSafeZone(x, y)` at :9359 |
| PART B "tied to the same day-counter other daily systems already use" | **Exists** — `worldDayNum()` at :8383, already shared by the Krakenling gate (:18810) and the Blood Moon (:8520) |
| PART B "naming one existing creature as today's bounty" | **No invention needed** — rotates over creatures already in `MOBS`/`WILD_SPECIES` |
| PART B "reuse existing loot/reward patterns rather than a new currency" | **Pattern available** — per-mob `loot: [{type, qty, chance}]` tables |

One engineering note for whoever picks this up: the boss bar is currently
hardwired to a single boss via `const BOSS_KIND = "elder_drake"`
(runehaven.html:19304), read in four places. A second boss means that constant
becomes a set or a per-mob flag. That is ordinary surgical work, not a blocker
— I am flagging it only so the estimate is honest.

**PART B is fully buildable today with zero invented content.** I did not build
it alone, because rule 5 says a RED stop leaves `runehaven.html` unchanged and
does not ship a half-finished spec. If you would rather have PART B land on its
own while PART A waits, say so and it ships as its own version.

---

## What unblocks this — pick one, no code change needed from you

1. **Name the creature in the bible** (preferred, keeps the 59-version
   streak intact): add one line to the bible's `## MOBS` table at Boss tier
   with its loot, and one line to `## DRAGONSTEEL — ACQUISITION & STAKES` if
   it is meant to drop dragonsteel. Then PART A is pure engineering and I can
   build the whole spec in one night.
2. **Amend the spec to reuse a bible creature** — e.g. retarget PART A at an
   existing Boss/Very-Hard creature given the unleashed wander range, which
   needs no new canon. Note the Unicorn Elder is *not* a fit: the bible makes
   it a tameable Elder pet granting fast travel and a luck buff, not a hostile
   boss, and PART A's "no teleporting" requirement contradicts its "spawns
   randomly anywhere, no pattern" line.
3. **Explicitly authorise non-canon content** for this build, stating the
   creature's name and whether it drops dragonsteel. I will not infer this
   authorisation from silence, and I will not choose the name.

Per the routine's rules I have **not** edited `NEXT_BUILD.md` — it still points
at this spec, so the next run retries it. Delete this file once PART A is
unblocked, or the next run will try to fix this report instead of building.
