# BUILD FAILED — 2026-09-12 (Animation & A Living World Pass)

**Nothing was built. `runehaven.html` is byte-for-byte unchanged.**

`NEXT_BUILD.md` points at README's "Confirmed, locked spec for a future
version (Animation & A Living World Pass)" (README.md:555). I stopped
before writing a single patch, under the standard process's RED rule and
the routine's own "if the spec doesn't clearly apply to the current state
of `runehaven.html`: STOP".

## What blocked it

The spec opens with a bolded paragraph that is the stated justification
for the whole pass (README.md:557-563):

> **Confirmed real, current gaps: no floating damage numbers exist
> anywhere in the game, no water tile has any ripple/motion, and no
> walk-cycle exists for the player or any creature's legs during
> movement**

**Two of those three "confirmed" gaps are not gaps. Both features are
already built, and have been since v9.** I verified each against the live
file rather than taking the spec's word for it, exactly as v27 and v46
did before shipping on top of a spec claim that turned out to be false.

### PART A — floating damage numbers already exist, in full

PART A asks for a number at the impact point that drifts upward and
fades, for every hit source, with a different weight/colour for a crit.
Every clause of that is already in the file:

| PART A asks for | Already in `runehaven.html` |
|---|---|
| the system itself | `floatTexts` + `addFloat()` — `runehaven.html:1630`, `9339` (commented `v9: rising damage numbers`) |
| player hits a mob | `mobHit()` — `runehaven.html:7629` |
| mob hits the player | `runehaven.html:9570` |
| PvP | `dealHit()` — `runehaven.html:9335` |
| drifts upward, fades | `f.z += 22 * dt` — `runehaven.html:11835`; alpha `f.life / f.maxLife` — `runehaven.html:17524` |
| different weight for a crit | `f.big` → `bold 15px` vs `bold 12px` — `runehaven.html:17520` |
| different colour for a crit | `#ffb340` amber + `!` suffix vs `#ffe9b0` — `runehaven.html:7629`, `9335` |
| "reusing whatever crit distinction already exists in the damage calculation" | it already does — the v10 backstab dot-product crit at `runehaven.html:9290` feeds `opts.crit` straight into `addFloat` |

There is no work here that the spec describes. SKILL.md's own v9 entry
(line 3746) and v10 entry (line 3738) both record this shipping.

### PART C — water already has ripple motion, and shoreline foam

PART C says "Confirmed live: no ripple, wave, or shimmer exists on any
water tile." `runehaven.html:17006` is a section **named** `// Water
ripples + lava flicker`. Directly under it (`runehaven.html:17009-17022`)
is a per-tile animated ripple on `B.WATER || B.DEEP || B.SHALLOW` — a
stroke that fades in and out on a `(t / 1400 + hash2(tx,ty,33)) % 1`
cycle, i.e. already "drifting slowly across Shallow and Water tiles".

Separately, `runehaven.html:17024-17049` draws the animated shoreline
foam (`Math.sin(t / 700 + (tx + ty) * 1.7)`) along every water edge that
touches land. That foam is on this project's **must-not-regress list** —
SKILL.md:3769 records "No shoreline life — animated white foam edge where
shallow water meets land. FIXED in v6."

### The parts that ARE real work

To be clear about what is and isn't blocked — three of the five parts
check out against the live file exactly as written:

- **PART B (walk-cycle) is real.** Movement drives a vertical bob only
  (`runehaven.html:16462`), and legs are fixed polygons at literal
  coordinates in `drawHeroBody` (e.g. `runehaven.html:14208`, `14236`).
  No leg motion exists for the player or any creature.
- **PART D (tree/grass sway) is real,** and the spec correctly hedges it
  ("confirm whether it is currently used for sway and, if not, add").
  `drawTree(f, t)` at `runehaven.html:12347` receives `t` and never reads
  it anywhere in its body.
- **PART E (finish the UI transitions) is real,** and its premise is
  accurate: panel opacity and HP-bar width transitions already exist
  (`runehaven.html:233`, `315`, `417`).

## Why I stopped instead of building the three that work

Two reasons, and the second is the one that actually decides it.

**1. Shipping B/D/E alone would be me choosing the scope.** The routine
is explicit: "Never decide what to build next on your own — only ever
follow what `NEXT_BUILD.md` currently says." Quietly dropping two of five
parts is deciding what this version is.

**2. PART C has three defensible readings and no way to pick between
them, because the spec was written believing there was nothing there.**
This is a design decision, not a tunable:

- *Skip it* — the existing ripple already satisfies the description. But
  the spec asks for a specific different technique ("concentric fading
  circles", "layered"), so skipping ignores a locked spec part.
- *Add the concentric ripples alongside the existing ones* — this
  violates the spec's **own** proof gate, which requires that every part
  "reuses a named existing technique rather than introducing a parallel
  system". Two ripple systems on one tile is exactly the parallel system
  it forbids, and it is the same mistake SKILL.md's motes-vs-fireflies
  rule (line 3643) and baked-glow-vs-mote rule (line 3225) exist to
  prevent.
- *Replace the existing v6/v8 ripple and foam treatment* — this rewrites
  working, approved art nobody asked to change, and the foam is on the
  must-not-regress list above.

Each produces a visibly different game. Picking one is a creative call
that belongs to you, not to an overnight build. Per the README: "When
genuinely unsure which zone something belongs in: treat it as RED."

PART A has the same shape of problem in a milder form — there is nothing
to build, so the only question is whether the part is satisfied or
whether something *more* was wanted, and the spec cannot say, because it
thought the feature was absent.

## What I need from you to unblock this

One answer per part. Any of these makes the next run buildable:

- **PART A** — is it satisfied by what already ships (my reading), or was
  something beyond v9's numbers wanted? The one genuine gap I found is
  **gathering**: `baseHit()` floats a number when you hit a structure
  (`runehaven.html:10263`), but chipping a tree/ore node deals real
  damage and spawns only a particle burst, never a number
  (`runehaven.html:9936-9942`). If PART A was meant to cover that, say
  so and it is a one-line addition.
- **PART C** — which of the three readings above? If it's "make the
  existing ripple richer", say so and it becomes a clean, small edit to
  the block at `runehaven.html:17009` with the foam left alone.
- **PARTS B, D, E** — no answer needed; they are unambiguous and ready to
  build as written.

The cheapest fix is to amend the spec's opening paragraph in README.md so
it describes the real file, and re-point `NEXT_BUILD.md` at it. I have
deliberately **not** edited `NEXT_BUILD.md` or the README spec myself —
the routine forbids the first, and rewriting a locked spec to match my
own reading of it would be inventing the decision rather than surfacing
it.

## State of the repo

- `runehaven.html` — **unchanged**, still v56.
- `runehaven-art-style/SKILL.md` — unchanged, no changelog entry added
  (nothing shipped to record).
- `NEXT_BUILD.md` — unchanged, still pointing at the Animation pass.
- Baseline gate re-run on the untouched file to confirm nothing here
  broke it: `run3` **`CAUGHT ERROR: none`**, `run4` **1582/1582 with zero
  FAIL**, `run5` **1324 coverage draws, `CAUGHT: none`**. Those are
  v56's own documented numbers to the digit (SKILL.md:148), which is
  the point — the file is exactly as v56 left it and is in a good,
  shippable state. It simply has no new work in it.
