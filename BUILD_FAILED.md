# BUILD FAILED — 2026-10-18 nightly (Mobile & Touch)

**Nothing was built and `runehaven.html` is byte-for-byte unchanged.**
`NEXT_BUILD.md` points at Mobile & Touch, but the repo arrived with `run4`
already failing, so the standard process's own gate ("all `PASS`, zero
`FAIL`" before shipping, RED never overridden) cannot be cleared by ANY
build tonight, including a perfect one. Both failures pre-date this session
and neither is in Mobile & Touch's scope.

## Baseline on `main` (e66b2d0), measured before touching anything

| harness | result |
|---|---|
| `run3` | clean — `CAUGHT ERROR: none` |
| `run4` | **1857 PASS / 3 FAIL** |
| `run5` | clean — `CAUGHT: none` |

The 3 FAILs come from commit 5253d28, whose own message says "Gates for
round 2/3 not yet green; stage not merged to main" — it then reached `main`
through PR #2. They are deterministic (seed 123456789, pinned by the gates
themselves), not an artefact of this environment: both were reproduced
independently, one by source inspection and one in a real Chromium.

---

## Blocker 1 — `WCF G: no plate or vent sits in front of higher ground`

**This one is unambiguous and needs no design decision.**

The gate's *measurement* still passes: `0 of 27418` overlaid tiles sit in
front of higher ground. It fails only on a source fingerprint that S2 R3
made stale. The gate (`debug/run4.js:10996`) still greps for

```
const crusted = interiorLava && lavaCrustAt(tx, ty);
```

and S2 R3 rewrote that very line, in `runehaven.html`, to

```
const crusted = interiorLava && lavaCrustAt(tx, ty) && !inConeMoat(tx, ty);
```

Confirmed by count: the old string occurs **0** times in `runehaven.html`,
the new one **1** time. The gate's other two fingerprints
(`biomeAt(tx + 1, ty + 1) === B.LAVA;` and
`if (interiorLava && lavaVentAt(tx, ty)) {`) are both still present.

**Fix:** update that one fingerprint in `debug/run4.js` to the current line.
Nothing in the game changes and the gate's claim is not weakened — the moat
term is separately asserted by the S2 R3 gate at `debug/run4.js:11390`, so
the clause cannot silently disappear.

I did not apply it on my own, because it would not have made tonight green
(blocker 2 remains) and editing a gate is exactly what `gate-integrity`
says a build must not do quietly.

---

## Blocker 2 — the two volcano-cone gates — **needs your decision**

- `S2 R2: and it stands only on lava — every tile under its base is LAVA`
  (`debug/run4.js:11308`)
- `S2 R3: the cone is five tiers and 96px to the crater, its whole base
  still on lava` (`debug/run4.js:11380`)

Both assert that the full **±5 square** (11×11) under the cone is `B.LAVA`.
Measured in a real browser at the gates' own seed: **exactly one tile of
the 121 is not lava.**

```
seed 123456789   VOLCANO 2502,845   cone site 2506.5,845.5
offending tile:  dx -5, dy -5   |dx|+|dy| = 10   biome = SHALLOW
```

That tile is the one the game deliberately never checks.
`volcanoConeSite()` masks its own search with
`if (Math.abs(dx) + Math.abs(dy) > VCONE_R * 1.42) continue;` — with
`VCONE_R = 7.0` that is a diamond of radius **9.94**, so `|d| = 10` is
outside it. The cone's widest tier is `VCONE_TIERS[0]` size **9.6**, so the
tile is also outside the base the gate is talking about. The game is
self-consistent; the gate asserts a square where the base is a diamond.

**Two valid fixes, with different consequences — this is a design call on
S2 R3's work, not something a nightly should pick:**

1. **Correct the gates to the base's real footprint** (assert the same
   `|dx| + |dy| <= VCONE_R * 1.42` diamond the site search uses). No game
   change; the cone stays where it is. Accepts that a tile of shallow water
   can sit just past the base's corner — 7.07 tiles out, diagonally, at the
   cone's foot.
2. **Tighten the game instead** (raise the mask so the whole ±5 box must be
   lava, e.g. `VCONE_R * 2`). Gates stay exactly as written and the
   constraint gets stronger, but `volcanoConeSite()` then searches further
   out and the cone **moves** on this seed — and on every seed. The
   companion gate only allows 60 tiles from the centre, and "the live world
   moves" is already a standing YELLOW.

My read is that **(1)** is right — the gate over-asserts relative to its own
stated claim ("every tile under its *base*"), and (2) changes what players
see to satisfy a test. But it moves what a shipped gate asserts, so I am
not making that call unattended. One word from you is enough.

---

## The question Mobile & Touch hits the moment this is unblocked

Worth answering in the same pass, because it is measured, not hypothetical:
**PART A's joystick zone and PART B's compass corner cannot both hold at
844×390 with "no intersecting HUD pairs".**

Real rects from the current build at 844×390 (Chromium, `hasTouch`):

```
hudPlayer  12,12  190x81      (so the top-left strip is used down to y=93)
hudWorld   677,12 155x60
```

- PART A puts `#touchStick` over the left 45% × bottom 65% → `x 0..380,
  y 137..390`.
- PART B puts the compass in the top-left corner, under the player card, at
  about 70% → 105px tall, so `y ≈ 97..202` at `x ≈ 10..115`.
- Those two overlap by ~65px, and the proof gate lists **both** elements and
  requires no intersecting pair.

The top strip free of the thumb zone is only 137px tall and the player card
already owns 93px of it, so no 70% compass fits under it. Options, cheapest
first: (a) cap the stick zone's height on short screens so it starts below
the compass (keeps both cards in their corners; the zone becomes ~49% rather
than 65% in landscape only); (b) keep the zone at 65% and let the compass
sit clear of it instead of in the corner; (c) hide the compass on a touch
landscape layout and keep the minimap, which the top-right corner does fit.
I would take **(a)** — it is one `min()` in the media query, landscape-only,
and it keeps every word of PART B. Portrait (390×844) has room for the spec
as written either way.

---

## What is ready to go

Reconnaissance is done, so the next run should not need to repeat it: every
anchor Mobile & Touch needs was located and confirmed unique (viewport meta,
`#game`, the four `raw[XY] ±= 1` movement lines at 12595-12598, the canvas
`mousedown` handler at 12541, `SETTINGS_DEFAULTS`, `secControls`,
`applySettings`/`wireSettingsUI`/`refreshSettingsUI`, `helpLineHtml`,
`updateHUD`, the boot block at 21670). Confirmed along the way: no harness
dispatches `mousedown`, so the `mousedown` → `pointerdown` change breaks no
existing gate; jsdom 30 has `PointerEvent` and `KeyboardEvent` but **no**
`matchMedia` and no `setPointerCapture`, so the coarse-pointer read must be
guarded and the touch gates must stub `matchMedia` themselves.

## Needed from you

1. Blocker 2: fix (1) or fix (2)?
2. Optional, same pass: the 844×390 layout question above — (a), (b) or (c)?

Blocker 1 can be fixed without you; on its own it does not make the night
green.
