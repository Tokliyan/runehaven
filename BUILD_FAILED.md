# BUILD FAILED — 2026-10-08

**Target:** `NEXT_BUILD.md` → README.md "Confirmed, locked spec for a
future version — World Encounters — Roaming Boss & Bounty Board"
(README.md line 731).

**Outcome:** Nothing was built. `runehaven.html` is **unchanged** — not
one byte patched. No test gate was run, because the blocker is in the
spec, not in the code.

**Classification:** RED, under the standard process rule 5 — *"The spec
would require inventing bible content — a pet, mob, biome, location, or
lore element not in the bible. This is a creative integrity rule, not a
bug-severity one, and severity never overrides it."*

---

## THIS BLOCKER IS HUMAN-GATED — DO NOT TRY TO SOLVE IT IN AN AUTOMATED RUN

A future automated run cannot clear this by working harder. It needs a
one-line decision from the project owner (options at the bottom). If you
are an automated run reading this: re-confirm the facts below still hold,
and if they do, **stop and leave this file in place.** Do not invent a
boss. Do not pick a creature yourself.

---

## PART A is blocked: it requires a Boss-tier creature the bible does not contain

PART A reads: *"this is a new, additional Boss-tier creature with no
fixed home."* That creature does not exist anywhere in
`RUNEHAVEN_BIBLE.md`.

Verified against the bible and the current code:

- The bible's `## MOBS` table has **exactly one Boss-tier entry**:
  `Elder Drake — Volcano, World Boss — Boss tier`. PART A explicitly
  rules it out, since the Elder Drake must stay fixed at the Volcano.
- The code already states this in its own words at `runehaven.html:2907`:
  *"v30: the bible's only boss-tier creature."*
- The full implemented mob roster is 15 keys — `adult_golem`, `bandit`,
  `basilisk`, `bear`, `boar`, `dark_wraith`, `demon_knight`,
  `elder_drake`, `goblin`, `golem_elder`, `griffin`, `phoenix`,
  `salamander_king`, `sea_serpent`, `troll`. Every one maps 1:1 to a
  bible entry. There has never been a creature in this game that the
  bible did not name.
- `grep -i "non-canon" runehaven.html` returns **zero** matches. There is
  no precedent for non-canon content in this codebase, so inventing a
  world boss would not be following an established escape hatch — it
  would be setting a new precedent for the most lore-heavy object type in
  the game.

### Why no existing creature can be quietly promoted instead

Two near-miss candidates were checked and both are rejected:

- **Unicorn Elder** — the bible's only "spawns randomly anywhere in the
  world" entity. But it is an *Elder pet* that grants fast travel and a
  luck buff, not a Boss-tier hostile. Turning it into a world boss would
  contradict its own bible entry.
- **Adult wild dragon** — the bible mentions *"Killing an adult wild
  dragon in the world"* as a dragonsteel source, which sounds like a
  roaming hostile. But no such mob is implemented (`grep` for
  `adult_dragon` / `wildDragon`: zero hits), and the bible classifies
  dragons as pets tamed as hatchlings. Minting an adult-dragon boss means
  choosing its species, naming it, and setting its tier — a creative
  decision, not a tunable.

Choosing between "invent a brand-new boss" and "promote one of these two
against its own bible entry" **is itself the design decision**, which is
precisely the case rule 5 says must stop. Per the tie-break — *"When
genuinely unsure which zone something belongs in: treat it as RED"* — it
stopped.

---

## Everything else the spec asks for is ready and verified present

This is a narrow blocker. The spec's premise that it reuses existing
systems is correct — all of them were confirmed live:

| Spec dependency | Status |
|---|---|
| Deterministic leash-bound idle wander | present — `leashRadius` on every mob (`runehaven.html:2911` and throughout) |
| Boss bar UI | present — v52+53 PART G (`runehaven.html:549`, `:643`) |
| Elder-tier music cue | present — `ELDER_MUSIC_URL` / `elderMusicUntil` (`runehaven.html:19263`) |
| Shared day counter for daily systems | present — `worldDayNum()` (`runehaven.html:8383`) |
| Safe Zone test (for "never enters a Safe Zone") | present — `inSafeZone(x, y)` (`runehaven.html:9359`) |
| Existing loot/reward patterns for the bounty payout | present — per-mob `loot` tables |

**PART B (the rotating bounty board) is NOT blocked.** It names *"one
existing creature"* as the daily bounty, ties to the existing day
counter, and reuses existing loot — no invention required. It was held
back only because PART A and PART B ship as one version, and the standard
process forbids shipping a half-finished build.

---

## What would unblock this — any one of these is enough

1. **Add the roaming boss to `RUNEHAVEN_BIBLE.md`** (name, tier, loot,
   and that it has no fixed home). Then PART A becomes a normal build
   with only tunables left to design, and the whole spec ships in one
   night.
2. **Amend the README spec** to name an existing bible creature as the
   roamer, and state explicitly that promoting it is intended.
3. **Split the spec** — point `NEXT_BUILD.md` at PART B only (bounty
   board), which is buildable tonight exactly as written, and queue
   PART A behind a bible update.
4. **Grant a standing non-canon exception** for this creature in the
   README's rule 3, if a non-canon world boss is genuinely wanted.

No part of `NEXT_BUILD.md` was edited, per the routine's standing rule.
