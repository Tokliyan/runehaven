# BUILD FAILED — 2026-08-21 (Expansion 2a, viewport-based ground rendering)

**Nothing shipped. `runehaven.html` is unchanged, byte for byte, at
commit `eeec1a6`.** This file is the only change in this commit.

## The blocker in one line

`node debug/run4.js runehaven.html` is **already red on `main`, before
anything was touched tonight** — 735 PASS / **6 FAIL** — and the README's
RED rule ("any `run4` line is `FAIL` … never overridden") stops the build.

## What is actually failing

All six are **stale hard-coded numbers in `debug/run4.js`**, left behind by
the previous build. Commit `41cfd47` ("World Expansion: N 240->320") changed
**only `runehaven.html`** — `git show --stat 41cfd47` shows one file, 39
insertions, 24 deletions — and never updated the harness's scale-bound pins,
despite its commit message claiming "741 PASS/0 FAIL". `debug/run4.js` has
not been touched since `cbf6475` (v39).

| `run4.js` | assertion | pinned at | the file actually has |
|---|---|---|---|
| 943 | `N scaled to 240 (was 80)` | `N === 240` | `N = 320` |
| 944 | `SAFE_RADIUS scaled to 27 (was 9)` | `SR === 27` | `SAFE_RADIUS = 36` |
| 354 | `Dark Forest band untouched` | `dark === 763` | 1528 tiles (seed 123456789) |
| 999 | `Ruin-to-Zone separation is 24` | `RUIN_ZONE_SEP === 24` | `RUIN_ZONE_SEP = 32` |
| 1000 | `every other separation unchanged` | `RUIN_SEP === 40 && ZONE_SEP === 40` | both `53` |
| 2963 | `it stands near the Tower the orb comes from` | `dist(altar, tower) < 40` | `DRAGON_ALTAR_DIST = 45` |

## Why this was not fixed forward tonight

Three independent reasons, any one of which is enough:

1. **The README's RED rule is absolute.** A red `run4` is the mechanical,
   objective stop signal and is explicitly "never overridden".
2. **Expansion 2a is forbidden from touching these systems.** Its PART D
   says: "Confirm no regression in any existing worldgen, landmark, or biome
   proof gate — *this version must not touch those systems at all*." All six
   failures sit in exactly those gates. Editing their assertions to go green
   is the one thing the spec rules out.
3. **Re-pinning them correctly is the World Expansion's verification work,
   not this version's.** The project's rule is that a scale-bound pin is
   *updated, not relaxed* — v19 re-measured the Dark Forest band to 875 and
   proved the invariant still held, rather than pasting in whatever number
   came out. Doing that honestly for 1528 tiles, a 45-tile altar distance and
   the 53/53/32 separations means re-establishing what each value *should* be
   at N=320. Typing the observed numbers in without that is relaxing the
   gates, which would quietly retire six real invariants.

Per the README: unsure which zone something belongs in → treat it as RED.
This one is not even borderline.

## What a human needs to decide in the morning

Whether those six numbers above are the **correct** N=320 values, or whether
any of them is a symptom the World Expansion missed. Two look like pure
arithmetic (`N` 320, `SAFE_RADIUS` 36) and are safe to re-pin on sight. The
other four each guard a real invariant and want one line of reasoning apiece:

- **Dark Forest 763 → 1528.** The invariant is "the rare-variant noise fields
  never touch the Dark Forest band; only landmark overrides do." 763 × (320/240)²
  = 1356, so 1528 is **not** simple area scaling — worth understanding before
  it is pinned, since v19's own note says this number moves when carves change.
- **`RUIN_SEP`/`ZONE_SEP` 40 → 53 and `RUIN_ZONE_SEP` 24 → 32.** Consistent
  with a ×4/3 scale-up; confirm that was the intent and not a partial pass.
- **`DRAGON_ALTAR_DIST` 34 → 45.** v39's changelog describes the altar as
  "34 tiles from the Tower". Confirm 45 is wanted, then move the `< 40` pin.

Once `run4` is 741/0 again, Expansion 2a can be built as specced — the spec
still applies cleanly to the current file (see below).

## State of Expansion 2a itself

The spec was verified against the real file before stopping, and **every
claim it makes is still true** — nothing here is what blocked the build:

- `bakeTerrain()` is genuinely complex as described (elevation cliff faces
  reading `heightAt(tx,ty+1)`/`heightAt(tx+1,ty)`, jittered PEAK tops,
  N-relative world-edge DEEP darkening, distinct VOLROCK/LAVA, CALDERA and
  UNDERCAVE face colouring). Confirmed, not assumed.
- `terrainBake`/`bakeOX`/`bakeOY` appear in exactly the 13 places the spec
  says, all accounted for: the two `let`s, the bake's own setup and `bx`/`by`
  helpers, the two call sites (login, world reset), and the three-line blit
  in `drawWorld()`.
- The entity pass's corner-based bounds exist at `drawWorld()` and are
  reusable for the ground pass as the spec requires.
- The conversion is algebraically clean: the bake's `bx/by` origin and the
  blit offset cancel exactly, so `worldToScreen(tx+0.5, ty+0.5, zTop)` lands
  a tile on the same pixel the baked canvas did. Visual equivalence is a
  provable identity here, not a hope.
- **PART B needs a call the spec anticipated.** The corner bounds are an
  axis-aligned box in *tile* space around a *diamond*-shaped screen, so the
  raw box is ~5900 tiles at 1280×820 — well over the spec's proposed ~2000
  assertion. Roughly half of it is off-screen and draws into nothing. A cheap
  per-tile screen-rect reject before `drawGroundTile()` brings the real drawn
  count back to the ~2000 the spec's own estimate implies, and paints exactly
  the same pixels. Flagging it here because the number in PART B is a
  *proposal* and the honest answer is "the bound holds, but only with the
  reject" — that is the judgment call whoever builds this should confirm.
- **The margin maths checks out at the spec's proposed 3 tiles.** A tile
  paints at most `IW2` sideways and one full four-level drop (~73 px) below
  its own centre, which is 4.3 tiles of slack in each world axis; the entity
  bounds already carry 2–3 of that, so +3 clears it in every direction. No
  cliff face can pop at the viewport edge.
- **`run5` will need its coverage note revisited.** Three of its checks lean
  on "`bakeTerrain()` paints EVERY tile of the map at boot" (`run5.js` ~275,
  and the UWCAVE/ABYSSAL/CALDERA checks after it). That stops being true the
  moment ground is viewport-only — the checks still pass, because they only
  count biome tiles, but they stop proving the branch ever drew. Once
  `drawGroundTile(c, tx, ty)` exists as a callable function, sweeping one
  tile of each biome through it directly is a strictly stronger gate and is
  the natural place to extend coverage for this version.

## Untouched, and deliberately so

`NEXT_BUILD.md` (never edited from here), `runehaven.html`, `SKILL.md`, and
every file under `debug/`. `NEXT_BUILD.md` still points at Expansion 2a, so
once `run4` is green the next run picks this straight back up with no
further instruction.
