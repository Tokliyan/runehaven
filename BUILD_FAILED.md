# BUILD FAILED — v51 not started

**Date:** 2026-08-30
**Status:** RED. Stopped before any edit. `runehaven.html` is unchanged
(verify: `git status` shows it clean).

I did not guess, did not invent, and did not ship a partial build. Per
README step 5, a RED stops the whole version, not just the affected part —
so Parts A/B/F/H were deliberately left unbuilt too, even though they are
individually clear and I verified their premises are correct.

**This one cannot be unblocked by the build agent.** It needs a `README.md`
spec edit by the owner. A build agent must not edit `README.md` or
`NEXT_BUILD.md` itself, so tomorrow's run will hit exactly the same wall
until the spec is restored by hand.

---

## BLOCKER 1 — PART E is missing 8 of its 13 guilds (primary, hard RED)

PART E's prose requires thirteen guilds:

> "**Thirteen guilds**, assigned deterministically… **Twelve** are meant to
> feel roughly equally desirable… and **the thirteenth** is deliberately the
> outlier, both rarer and stronger"

The numbered list underneath it currently contains **only five**: The Hollow
Choir, The Drowned Court, The Quiet Vein, The Gilded Bough, The Bramblewatch.

The proof gates then require something that isn't in the list at all:

> "confirm that **the Nameless Tide's** real assignment rate is meaningfully
> rarer than the other twelve"

There is no Nameless Tide in the spec as it currently stands. Building this
would mean inventing eight guild names, mottos, and gameplay buffs, plus the
entire identity and rarity of the outlier guild — the exact "creative
integrity" RED in README step 5, and 8× more than the "3+ unspecified,
interdependent decisions" threshold. There is no guild system in
`runehaven.html` today to fall back on either (`grep -c -i guild
runehaven.html` → **0**), so nothing existing supplies the missing eight.

### Cause — and the exact fix

This is a truncation, not a deliberate cut. Commit `cb2ec45`
("v51 spec: … full Guild system with 12 balanced + 1 rare outlier") listed
**all thirteen**. Commit `692da6d` ("v51 update: Hollow Choir instant
respawn, combat-logout 30s->15s, guild badges…") revised guild #1's buff and
inserted PARTS F and G — and in doing so replaced the 13-line list with a
5-line one, dropping entries 2, 4, 6, 8, 9, 10, 12 and 13 and renumbering
the survivors.

Recover the original text with:

```
git show cb2ec45:README.md | sed -n '156,169p'
```

The eight dropped guilds, verbatim from `cb2ec45`:

- **Ashbound** — fire and ruin. *"Let it burn, let it teach."* Immune to lava-proximity damage tick (still dies to full lava contact).
- **Stormwrought** — storm and mountain. *"The sky owes us nothing, and gives everything."* +20% move speed during any active world event (Blood Moon, Meteor Shower).
- **Nightglass** — shadow and dark forest. *"We are the shape you almost saw."* Untargetable by wild mob aggro at night specifically (still fully PvP-vulnerable).
- **Emberkin** — volcano and forge. *"We were shaped by what should have killed us."* Crafting at any forge costs 10% less material.
- **The Salt Wardens** — coasts and open plains. *"Nothing here belongs to anyone."* Take 15% less damage while inside a Plains biome specifically.
- **Duskthread** — twilight, in-between things. *"Neither day claims us, nor night."* Double XP during the dawn and dusk transition windows specifically.
- **Frostmere** — shattered peaks, cold and isolation. *"Alone is not the same as lost."* Immune to Storm Dragon's own environmental effects at the peaks specifically.
- **The Nameless Tide** — deliberately the outlier. *"Some of us were never meant to be counted."* Rarer assignment odds than the other twelve (propose roughly half as likely), and a genuinely stronger, stacked effect: small passive HP regen at all times AND a smaller version of the Beastmaster Shrine's own taming boost, permanently, without needing to stand at the Shrine.

**To unblock:** restore those eight into PART E's list (keeping guild #1's
revised "instant respawn — 0 second wait" from `692da6d`, which was the
intended change), renumber 1–13, and confirm PART G's badge line — which
currently names only "the five-icon concept already shown (bell, wave, ore
vein, leaf, thorned fist)", i.e. exactly the five that survived — is meant
to cover all thirteen.

**Alternatively**, if the cut to five was actually intentional: say so
explicitly, change the prose from "Thirteen guilds / Twelve / the
thirteenth" to five, and either drop the Nameless Tide proof gate or name
which of the five is the rare outlier. Either resolution is fine; I just
can't pick between them, because they are different games.

---

## BLOCKER 2 — PART D's cave pet roster contradicts the bible (second RED)

PART D says to increase cave-interior tameables, "(Golem, Crystal Golem,
Glow Moth **per the bible's own cave placements**)". The bible does not
place two of those three in caves:

| Species | Bible says | Code today |
|---|---|---|
| Golem | "Found young in **ruins only**, adults are hostile enemies" | `biomes: [B.RUINB]`, count 72 |
| Crystal Golem | "Found young in **mountain ruins only**" | `biomes: [B.RUINB]`, `mountainRuinOnly: true`, count 28 |
| Glow Moth | "Caves and dungeons" ✅ | `biomes: [B.UNDERCAVE]`, count 315 — the surface cave-mouth band, not interiors |

Adding Golem or Crystal Golem to cave interiors would directly contradict
the bible's explicit "ruins only" / "mountain ruins only". That is a bible
contradiction, not a tunable.

Compounding it: **no tameable pet spawns inside cave interiors today except
one dragon.** `populateInterior()` builds `rec.wilds` with exactly one
dragon species per cave (line ~3641) and nothing else. So PART D's "increase
whatever tameable pet species spawn inside cave interiors" has almost
nothing to increase — delivering its stated goal ("caves shift toward a
place to find companions") means designing a new cave-interior tameable
roster from scratch, which is a real design decision, not a number tweak.

**To unblock:** name exactly which species should spawn inside cave
interiors and at what counts, and confirm whether the bible's "ruins only"
constraint on Golem/Crystal Golem is being deliberately overridden.

---

## BLOCKER 3 — PART C and PART D pull the same number in opposite directions

Both parts act on `MOBS[kind].count`, in opposite directions, for the same
two mobs:

- **PART C:** increase overworld mob counts, "Troll currently 6" — correct,
  `MOBS.troll.count = 6` (line 2338).
- **PART D:** "Troll and Dark Wraith (both cave-placed)… Reduce their
  `count` specifically."

But `count` is **not** the cave lever. In the code:

- `MOBS.troll` is `biomes: [B.ROCK, B.PEAK]` — its `count` drives **surface**
  mountain/peak spawns.
- `MOBS.dark_wraith` is `biomes: [B.DARKFOREST]`, count 6 — its `count`
  drives **surface** dark-forest spawns.
- Cave-interior Trolls and Wraiths are spawned separately and are not
  governed by `count` at all — `populateInterior()` hardcodes
  `Math.round(2 * areaK)` of `isAbyss ? "dark_wraith" : "troll"` (line
  ~3686).

So doing PART D literally ("reduce their `count`") would reduce *overworld*
Trolls — undoing PART C — and change nothing inside caves, failing PART D's
own proof gate. The cave-only fix is the `2 * areaK` multiplier, which PART D
never mentions.

I'm fairly confident the intent is: raise `MOBS.troll.count`/
`dark_wraith.count` for the surface (PART C) and lower the `2 * areaK`
interior multiplier (PART D). But README step 5 says treat genuine
uncertainty as RED, and this one changes real balance in two systems, so I
did not act on the guess.

**To unblock:** confirm that reading, or state the intended surface and
interior numbers separately.

---

## Verified fine — no action needed, these are not blockers

I checked every other "confirmed live" claim in the spec. They are accurate:

- **PART A** — wisp fire chance is `0.32` at line 9855, and it is genuinely
  mutually exclusive with the mote chain for Enchanted Forest, exactly as
  described. Ready to build.
- **PART F** — `COMBAT_LOGOUT_MS = 30000` at line 7280, already marked
  TUNABLE. Ready to build.
- **PART H** — `RUIN_COUNT = 10` (line 3161), `RUIN_SEP = 664` (3220),
  `RUIN_ZONE_SEP = 400` (3222). Ready for the six-seed sweep.
- **PART B** — one naming slip only: the function is **`updateMinimap()`**
  (line 14725), not `renderMinimap()`. There is no `renderMinimap` in the
  file. Only one function can be meant, so this is a YELLOW I would have
  shipped with a flagged note — recording it here only so it isn't mistaken
  for a fourth blocker.

---

## Summary of what's needed to restart v51

1. Restore PART E's eight missing guilds (the verbatim text is above), or
   explicitly redefine the system as five.
2. Resolve PART D's cave pet roster against the bible's "ruins only".
3. Confirm PART C/PART D's opposing reads of `count`.

Once `README.md` carries those, delete this file and the build can run
start-to-finish in one night — the other five parts are already unambiguous
and their premises check out against the live code.
