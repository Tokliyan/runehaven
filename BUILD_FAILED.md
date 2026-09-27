# BUILD FAILED — 2026-09-27 — World Encounters (Roaming Boss & Bounty Board)

**Status: RED, stopped before any edit. `runehaven.html` is byte-for-byte
unchanged. `NEXT_BUILD.md` is untouched.**

`NEXT_BUILD.md` points at README.md's "Confirmed, locked spec for a future
version — World Encounters — Roaming Boss & Bounty Board" (README.md:731).
The build stopped on **PART A**. PART B is fine and is not what blocked this.

---

## THE BLOCKER, IN ONE SENTENCE

**PART A asks for "a new, additional Boss-tier creature", and the bible names
exactly one Boss-tier creature — the Elder Drake — which the same sentence
puts off-limits. There is no second boss in the bible to build, so building
PART A means inventing a creature.**

That is README rule 5's third RED condition, verbatim:

> The spec would require inventing bible content — a pet, mob, biome,
> location, or lore element not in the bible. This is a creative integrity
> rule, not a bug-severity one, and severity never overrides it.

## THE EVIDENCE, CHECKED RATHER THAN ASSUMED

**The bible mentions "boss" exactly three times, and all three are the same
creature at the same place:**

```
RUNEHAVEN_BIBLE.md:31   Volcano — Elder Drake world boss, dragonsteel ore
RUNEHAVEN_BIBLE.md:119  Defeating the Elder Drake world boss at the volcano
RUNEHAVEN_BIBLE.md:132  Elder Drake — Volcano, World Boss — Boss tier — ...
```

The spec's own first clause rules that one out: *"The Elder Drake stays
exactly fixed at the Volcano, per the bible — this is a **new, additional**
Boss-tier creature."*

**No other bible creature fits, and each was checked individually:**

| Candidate | Why it cannot be the roaming boss |
|---|---|
| Elder Drake | The spec explicitly excludes it and pins it to the Volcano |
| Demon Knight | Bible tier is "Very Hard", not Boss; already stationed (v48) |
| Adult Golem / Sea Serpent | Bible tier "Hard"; both have fixed bible homes |
| Basilisk | A *Rare pet*, "deep dungeons" — a fixed home, and already built |
| Unicorn Elder | Spawns randomly, but is a tameable pet, not a boss, and does not roam |
| Duskfox Elder | Admin-only cosmetic pet |

**Nothing in the bible describes a roaming, wandering or homeless creature of
any tier.** `grep -ni "boss\|roam\|wander\|nomad" RUNEHAVEN_BIBLE.md` returns
only the three Elder Drake lines above.

**Nothing in `runehaven.html` scaffolds one.** `grep -ci "roam"` → 0,
`grep -ci "bounty"` → 0. The full mob roster is thirteen creatures
(elder_drake, goblin, bandit, troll, boar, bear, griffin, phoenix,
dark_wraith, sea_serpent, adult_golem, demon_knight, basilisk) and **every
single one of the thirteen is a creature the bible names** — the eight from
its MOBS list, plus the five fight-to-tame beasts from its pet rarity table.
The three most recent additions each quote their own bible line verbatim in
the comment above them (adult_golem v47, demon_knight v48, basilisk
Dungeons). Inventing a fourteenth would be the first creature in this file
with nothing behind it.

## WHY THIS IS NOT A "FLAG IT AND SHIP IT" CASE

README rule 3 does allow non-canon *items* when marked as such, and this
project has used that three times — `divers_charm` (v21), `void_shard` (v32),
`raw_meat`/`cooked_meat` (v58). **It has never invented a creature, and it has
declined to once already, in as many words:**

> v32: "No hostile mob inside the Hollow: Sea Serpent is a UWCAVE creature and
> the bible names none for the Hollow, so inventing one was declined."

A creature is not a tunable. A boss needs a name, a silhouette, a place in the
world's lore and a reason to exist — every one of those is a creative decision
that belongs to the owner, not to an overnight build. README rule 5's
tie-breaker also applies: *"When genuinely unsure which zone something belongs
in: treat it as RED."*

## WHAT IS **NOT** BLOCKED — ALL OF IT VERIFIED LIVE

Everything the spec says to reuse genuinely exists, so this is a one-sentence
blocker and not a broken spec:

- **The spec's opening premise is accurate.** Deterministic idle-wander exists
  and is leash-bound to each creature's own `leashRadius` (runehaven.html:2565).
- **The boss bar exists** — `#hudBoss` / `#bossName` / `#bossBar`
  (runehaven.html:645, driven at 19340).
- **The Elder-tier music cue exists** — `ELDER_MUSIC_URL`, with
  `combatTrackUrl` already handling a mid-fight handover (runehaven.html:12384).
- **The day counter PART B asks for exists** — `worldDayNum()`
  (runehaven.html:8383), already driving `rare_takes` and the Blood Moon.
- **A safe-zone predicate exists** for PART A's "never enters a Safe Zone"
  gate — `inSafeZone()` (runehaven.html:9359).

**PART B (the bounty board) is buildable as written, today.** It names *an
existing creature* as the bounty, refreshes on the existing day counter, and
reuses existing loot patterns — it invents no bible content at all. A notice
board at the Bazaar is a prop, the same category as v38's training dummy.
**It was not built, because the standard process says a RED leaves
`runehaven.html` unchanged rather than shipping half a locked spec.**

## BASELINE IS GREEN — THE RED IS ENTIRELY SPEC-SIDE

Run against the untouched file, to prove nothing here is a code problem:

```
parse check (new Function(scriptText))   ok
node debug/run3.js runehaven.html        CAUGHT ERROR: none
node debug/run4.js runehaven.html        1718 PASS, zero FAIL
node debug/run5.js runehaven.html        1361 coverage draws, CAUGHT: none
```

(`npm install` was needed first — the container starts with no `node_modules`.
That is environment setup, not a repo problem.)

## WHAT WOULD UNBLOCK THIS — OWNER DECISION, PICK ONE

The next run **cannot** resolve this on its own. It needs one of:

1. **Name the creature in the bible.** Add a second Boss-tier row to the
   bible's MOBS section — a name and a one-line description is genuinely all
   that is needed. Everything else (HP, damage, wander speed, respawn) is an
   ordinary tunable this build is happy to design and flag. **This is the
   smallest change and it unblocks PART A completely.**
2. **Amend the spec to name an existing creature** to promote to roaming-boss
   status, accepting that it leaves its bible home. (Note this reads against
   the bible for every candidate — each one's home is stated there.)
3. **Drop PART A and re-scope the spec to PART B only.** The bounty board
   ships clean on its own; say so in the spec and the next run will build it.
4. **Explicitly authorise a non-canon creature**, marked non-canon in the file
   the way `void_shard` is. This is a deliberate first for the project — the
   never-invent-a-creature line has held for 59 versions — so it wants to be
   an explicit "yes", not an inference from silence.

---

⚠️ **TO THE NEXT AUTOMATED RUN:** this report is not unclear and there is no
fix to apply. The blocker is a creative decision that requires the owner. Do
**not** invent a boss creature, do not rename an existing one into the role,
and do not ship PART B alone unless the spec in README.md has actually been
re-scoped. If none of the four options above has been taken, leave
`runehaven.html` alone, leave this file in place, and stop.
