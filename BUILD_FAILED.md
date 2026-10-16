# BUILD FAILED — 2026-10-16 nightly (Mobile & Touch not attempted)

**Status: RED, stopped before any patch. `runehaven.html` is untouched.**

`NEXT_BUILD.md` points at *"Confirmed, locked spec for a future version
(Mobile & Touch)"*, and that spec is clear and does apply to the current file.
It was **not** the blocker.

The blocker is that **the gate is already red before this build starts.** The
standard process (README step 4) requires `run4` to be all `PASS` / zero `FAIL`
before anything ships, and step 5 makes a real harness `FAIL` a RED that is
"never overridden". On the tip of `claude/stoic-tesla-0ghg7i` (`e66b2d0`), run
twice for determinism with identical results:

| harness | result |
|---|---|
| `node debug/run3.js runehaven.html` | `CAUGHT ERROR: none` — clean |
| `node debug/run4.js runehaven.html` | **1857 PASS / 3 FAIL** — exit 1 |
| `node debug/run5.js runehaven.html` | `CAUGHT: none` — clean |

All three failures come from the already-committed `5253d28` *"Gauntlet S2
round 2+3 (**work in progress**)"*, which landed on this branch via PR #2
(`e66b2d0`). None of them is on `main`, and none of them is anything Mobile &
Touch touches. Fixing them is Gauntlet S2 work, and the routine is explicitly
told never to pick its own build — so this stops here rather than quietly
widening into someone else's unfinished round.

Each failure is diagnosed below, with the measurement that proves it. **Nothing
below has been applied.**

---

## 1. `WCF G: no plate or vent sits in front of higher ground` — stale gate anchor, not a game bug

This is a **harness bug only**. The measured half of the gate passes: it reports
`0 of 27418 overlaid tiles`, and it needs `drawn > 1000 && overRim === 0`. Both
hold.

What fails is one of its three source-text anchors. `debug/run4.js:10998`
greps for:

```
const crusted = interiorLava && lavaCrustAt(tx, ty);
```

…and S2 R3 deliberately rewrote that very line. `runehaven.html:19101` now reads:

```
const crusted = interiorLava && lavaCrustAt(tx, ty) && !inConeMoat(tx, ty);   // S2 R3: the cone's foot stays molten
```

`grep -c` for the old string returns **0**; the other two anchors in the same
gate still return 1 each. The S2 R3 commit added its *own* new gate (run4.js
~11388) greping the *new* string and left this older gate greping the old one,
so run4 now contradicts itself about the same line.

**The fix is one anchor, not a code change** — the game is correct here. Either
relax the older gate's anchor to the stable prefix (e.g. grep
`const crusted = interiorLava && lavaCrustAt(tx, ty)` without the `;`), or
update it to the full new line. Left undone on purpose: editing a gate to go
green is exactly what `gate-integrity` exists to catch, and this gate belongs
to S2's round, not to this build.

## 2 & 3. The volcano cone's base is not entirely on lava — one corner tile

- `S2 R2: and it stands only on lava — every tile under its base is LAVA`
- `S2 R3: the cone is five tiers and 96px to the crater, its whole base still on lava`

These are the **same assertion at the same seed** (run4 sets `123456789` for the
whole S2 block at line 11115), so they fail together for one reason.

Measured directly, booting the real file through the run3 path at seed
`123456789`:

```
cone site: {"x":2506.5,"y":845.5}
VOLCANO:   {"x":2502,"y":845}
footprint: 1 of 121 tiles are NOT lava
offenders: -5,-5=SHALLOW
```

`volcanoConeSite()` picks `(2506.5, 845.5)`. Both gates then sweep the 11×11
footprint `dx,dy ∈ [-5,5]` and demand every tile be `B.LAVA`. Exactly **one**
tile — the far `-5,-5` corner — is `B.SHALLOW`. 120 of 121 are lava. The cone is
4.7 tiles off the Volcano centre, so the distance gate above it passes fine.

This one is a **real game-side finding, not a stale anchor**: the siting search
is allowed to settle on a spot whose corner clips shallow water. Two shapes of
fix, both of which are S2 round-3 design calls and so are **not** made here:

1. Tighten `volcanoConeSite()` so a candidate is rejected unless its whole
   11×11 footprint is lava (same radius the gates check), rather than only its
   centre/near tiles.
2. Or decide the corner of an 11×11 box is not really "under the base" — the
   cone's drawn tiers are `[[9.6,…],[7.6,…],[5.8,…],[4.2,…],[2.8,…]]`, so the
   widest tier is 9.6 wide, not 11 — and narrow the gates' sweep to the
   footprint the cone actually covers.

Option 2 is a gate change and must not be chosen just because it is the shorter
one; if the drawn base genuinely never reaches that corner, it is the honest
fix, but that is the owner's call to make, not the nightly's.

---

## What the owner needs to decide

1. Whether to **finish or revert S2 round 2+3** on this branch. Until run4 is
   back to zero FAIL, *every* nightly stops here the same way — the blocker is
   the branch state, not any one spec.
2. Whether **Mobile & Touch should build off `main`** instead while S2 is
   unfinished. `main` (`969f42e`) does not carry any of these three failures.
   The nightly will not re-point its own base: that would mean discarding seven
   unmerged commits on the designated branch, which it has no authority to do.

Worth knowing for option 2: `main`'s own `debug/run4.js` paired with `main`'s
`runehaven.html` does not finish in this environment either — it dies with
`SIM ERROR: TypeError: Cannot read properties of null (reading 'onended')` at
its line 1996, because that older harness has no fake `musicSource`. The
branch's `run4.js` fixed that (it builds one at line 2007). So "build off main"
means **main's html with the branch's harness**, not main's harness.

## Mobile & Touch itself — no blockers found

So the next night does not re-do this: the spec was read in full against the
current file first, and it is buildable as written. Everything it names exists
and was located.

- `runehaven.html` has **0** `@media` rules, **0** `pointerdown`/`touchstart`
  handlers — the spec's premise still holds exactly.
- PART A's key path is there as described: one `keydown` (12488) / `keyup`
  (12533) pair, both `KEYBINDS`-driven with `e.repeat` guards, and all 17
  actions the ☰ menu and thumb cluster need are real `KEYBIND_DEFAULTS` entries
  (`up down left right interact attack inventory craft pets dive block ability
  mount build character travel give`). Help has no binding — it is
  `#helpToggle` — which matches the spec listing Help without a key.
- The joystick's insertion point is exact: `runehaven.html:12594-12598`, the
  four `if (keys[KEYBINDS.*] || keys["arrow*"]) raw* ±= 1;` lines, with
  `let dx = rawX + rawY, dy = rawY - rawX;` immediately after.
- Tap-to-attack: `canvas.addEventListener("mousedown", …)` at 12541 is the only
  `mousedown` in the file, body already
  `screenToWorld(e.clientX, e.clientY)` → `tryAttack(wx, wy)`.
- The Settings row fits the existing machinery with no new code: a string
  setting like `touchControls: "auto"` is loaded by the type-checked
  `SETTINGS_DEFAULTS` loop and persisted to `rh_settings` in the existing
  try/catch, and `TEXT_SIZES`' three-button row is the ready-made pattern for
  Auto / On / Off.
- PART B's targets all exist with the offsets the spec assumes: `#hudMinimap`
  (bottom-left, 150px), `#hudMap` (bottom-right), `#hudZone` / `#hudPrompt`
  (bottom-centre, on the `--help-lift-*` variables), `#hudHelp` (bottom-left),
  `.panel` (`top: 70px`, `width: 300px`, `max-height: 70vh`), `#login h1`
  (`font-size: 58px`).
- PART E's phone shots are a smaller job than the spec assumes: `debug/shot.js`
  already opens a `hasTouch: true, isMobile: true` context at 844×390 and
  390×844 for `50-phone-landscape` / `51-phone-portrait`. `MOBILE=1` needs the
  tour re-pointed at that context and the `50-m-*` naming, plus the new
  `getBoundingClientRect()` intersection print. Playwright and Chromium are
  both available here, so PART E's gate can really run.

One note for whoever builds it: `jsdom` is not checked in (`node_modules/` is
ignored) and must be installed with `npm install` before any harness runs, and
jsdom has no `PointerEvent` — PART A's proof gates have to dispatch
`pointerdown`/`pointerup` as plain events, and the game code must not construct
a `PointerEvent` either.

---

*Gates at the stop: run3 clean, run4 1857 PASS / **3 FAIL**, run5 clean.
`runehaven.html` unchanged. `NEXT_BUILD.md` unchanged — the nightly never
edits it.*
