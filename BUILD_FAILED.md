# BUILD FAILED — v18 (Underground + Underwater Caves, 5 new species)

**Date:** 2026-08-02
**Attempted:** the "Confirmed, locked spec for the next build (v18)" section of `README.md`, per `NEXT_BUILD.md`.
**Result:** stopped before any edit. `runehaven.html` is **unchanged** (README standard process, rule 5).
**Baseline verified green before stopping** (so nothing below is a pre-existing breakage):

```
node debug/run3.js runehaven.html   → frames pumped, CAUGHT ERROR: none
node debug/run4.js runehaven.html   → 66 PASS, 0 FAIL
node debug/run5.js runehaven.html   → coverage draws: 448 — CAUGHT: none
```

(Note for future runs: the harnesses need `npm install jsdom`, which is
gitignored and absent from a fresh clone. Not a blocker — just install it.)

---

## BLOCKER 1 (hard) — the underwater access mechanic PART B says to reuse does not exist

PART B states:

> Underwater Caves: reuse the breath-timer dive mechanic and the health-regen
> item already agreed for underwater access

Nothing of the kind is in the codebase, and nothing of the kind was ever in the
codebase. Evidence:

| Searched in `runehaven.html` | Hits |
|---|---|
| `breath`, `dive`, `oxygen`, `swim`, `underwater`, `regen`, `O2` | **0 each** |
| `cave` / `Cave` / `CAVE` | **0** |

- Deep water is **impassable terrain**, not swimmable: `const BLOCKED = new Set([B.DEEP, B.PEAK, B.LAVA]);` (`runehaven.html:630`). Every movement path — player (`:2422`, `:2440`), pets (`:1552`, `:1619`), mobs (`:1661`) — rejects `BLOCKED` tiles. The player currently cannot enter deep water at all, let alone dive.
- There is **no health-regen item and no consumable of any kind**. `RECIPES` (`runehaven.html:368`) is weapons, armour, bars and `trail_bait` only.
- `git log --all -S"breath"` and `-S"dive"` across all 24 commits return exactly **one** commit: `a98ae1b "v18 spec: ..."` — i.e. the only place either word has ever appeared in this repo is the spec sentence asking to reuse them. There is no earlier build, no prior spec, and no design note defining them.

So "reuse" is not available. Implementing this would mean **designing a new gameplay system from nothing**, with at minimum these values unspecified anywhere:

1. How the player enters deep water at all (does `B.DEEP` come out of `BLOCKED`? a swim state? a dive-point-only teleport that never traverses deep water?).
2. Breath duration, tick rate, and what happens at zero (damage per tick? drowning death? forced surface?).
3. The health-regen item's identity, recipe, stack behaviour, regen rate, duration, and whether it *extends breath* or only *offsets drowning damage* — the spec pairs it with the breath timer but never says which.
4. Whether breath applies inside the Underwater Cave interior or only in transit.

That is exactly the "do not invent" case in README rule 3 and the STOP case in rule 5, so I stopped rather than guess.

**Knock-on scope:** this doesn't only block the Underwater Cave interior. It blocks two of PART C's five species, which have no other home in the spec:

- **Water Dragon** (Rare pet — "Underwater Caves, tame as hatchling")
- **Sea Serpent** (Hard mob — "Underwater Caves interior")

**What I need from you (any one of these unblocks it):**

- **(a)** Specify the dive mechanic concretely — the four values above — and I build it as written; **or**
- **(b)** Split the version: authorise v18 to ship PART A + the Underground half + Fire Dragon, Glow Moth and Dark Wraith, and defer Water Dragon / Sea Serpent / Underwater Caves to v19 alongside the dive mechanic; **or**
- **(c)** Point me at wherever the "already agreed" dive design actually lives (a session record or the bible, neither of which is in this repo — `RuneHaven_Bible.docx` is still absent, as README's header notes).

I did **not** pick (b) on my own: the spec says "Do not redesign the numbers or mechanics below — implement exactly as written", and dropping two of five species is a redesign, not an implementation. It's your call.

---

## BLOCKER 2 (hard) — the supplied `dragonV2()` art code throws as written

Independent of Blocker 1. In the spec's block 3:

```js
function dragonV2(sx, sy, P, t, variant, S) {
  ...
  P(ctx, [X(-1), Y(-14), ...], P.wingDark);
```

The third parameter is named `P` and is passed a **palette object** (`dragonV2(sx, sy, DRAGON_PAL.water, t, "water")`). Inside the function that parameter **shadows the global `P(c, pts, col)` polygon helper** defined at `runehaven.html:3497`. Every drawing call in the body is therefore invoking the palette object as a function. Reproduced in isolation:

```
THROWS: TypeError: P is not a function
```

This fires on the **first draw call in the function body**, so both Water Dragon and Fire Dragon would throw the moment either renders — it would be caught by `run5`'s coverage sweep, not shipped silently, but it cannot be inserted "exactly as given".

**Proposed fix, needs your sign-off** (mechanical, changes no geometry, no colour, no coordinate):

> Rename the parameter `P` → `PAL` in the `dragonV2` signature, and change only the **colour arguments** that read from it (`P.wingDark` → `PAL.wingDark`, `P.mid` → `PAL.mid`, and so on for all ~30 uses), leaving every `P(ctx, [...], ...)` call as a call to the global helper. `P.nostril || P.mid` becomes `PAL.nostril || PAL.mid`.

I have not applied this. It is the obvious reading of intent, but "insert exactly as given below" plus README rule 5 means I'm not making the call unilaterally. Confirm and it's a two-minute change.

---

## AMBIGUITY 3 (needs one line from you) — PART A's count list omits the v17 species

PART A says reduce **every** existing `MOBS` and `WILD_SPECIES` `count`, then gives an "Exact target" list that covers goblin, bandit, troll, boar, bear, griffin, phoenix, wolf, golem, shadowfox and the four sprites — but **not** the three species v17 added, which do have counts:

| Species | Current `count` | Spec says |
|---|---|---|
| `stag` (`runehaven.html:580`) | 3 | *not listed* |
| `unicorn` (`:581`) | 2 | *not listed* |
| `lightfox` (`:582`) | 2 | *not listed* |

"Every existing count" implies 3→2, 2→1, 2→1; the enumeration being labelled "Exact target" implies they were deliberately left alone. These give different worlds and I won't guess. Also note `unicorn` and `lightfox` already sit behind a `presenceRoll: 0.55` gate on top of their count, so cutting them to 1 makes "must never drop a species to zero spawns in the test seed" materially harder to satisfy — worth deciding deliberately.

---

## Confirmed NOT blockers (verified, ready to build once the above are settled)

So you know the rest of the spec is sound and this report is the whole list:

- **Landmark placement for the Underground entrance** — the pattern PART B points at is real and reusable: `placeLandmarks()` (`runehaven.html:655`) picks `RUIN` by angle+radius from `TOWER` with rejection sampling against spawn/volcano/mountain separation. Straightforward to extend for a ROCK/PEAK entrance.
- **Glow Moth's light mechanic** — cleanly implementable, no new system needed. `collectLights()` (`:5185`) already returns `{x, y, z, r, a, col}` light sources consumed by the night pass (`:5188`), and already pushes one for the player. The Glow Moth is one extra entry while the pet is active.
- **Dark Wraith's attack** — there is **no ranged-mob pattern** in the framework; all seven `MOBS` are melee (`atkRange` 1.3–1.7). The spec anticipates this and permits "a short-range bolt … flag the exact mechanism used", so this is self-resolving, not a blocker.
- **Art helpers** — `P` / `R` / `EY` / `BND` / `SCL` (`:3497`–`:3528`) and `drawBlobLocal` (`:3808`) all exist with the signatures the ported art assumes. `aura()` is correctly reported as absent (0 hits) and inserts cleanly. The `glow_moth`, `dark_wraith` and `sea_serpent` art blocks use the global `P` correctly — **only `dragonV2` has the shadowing defect.**
- **Insertion points** — `drawSpecies` (`:4142`, `species === "…"` chain), `drawMob` (`:3838`, `kind === "…"` chain), `SPECIES_K` (`:3541`), `MOB_K` (`:3547`), `MOB_TALL` (`:3548`) and the pet-combat stat table (`:605`) are each unique and unambiguous. No anchor-uniqueness problem anywhere in this build.

---

## Next step

Resolve Blocker 1 (pick a, b or c), confirm the Blocker 2 rename, and answer
Ambiguity 3. With those three answers the rest of v18 is mechanical and I can
run it straight through the standard gauntlet in one session.

`NEXT_BUILD.md` has not been touched. `runehaven.html` has not been touched.
