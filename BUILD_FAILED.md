# BUILD FAILED — Performance (Ground Cache & Quiet HUD) — 2026-10-21

**RED, by one number, and the decision is yours rather than mine.**

`runehaven.html` is byte-identical to where it started. Nothing shipped, no
gate was relaxed, no tunable was quietly moved, no bible content was invented.

The spec `NEXT_BUILD.md` points at — README, *"Confirmed, locked spec for a
future version (Performance — Ground Cache & Quiet HUD)"* — is **fully built
and proven**, except for one of its own proof gates: the frame rate. The
finished work is in `performance_ground_cache.patch` at the repo root. It needs
one decision from you, not another night of building.

---

## 1. What blocks it

> **Frame rate (Playwright, required when available).** In one session, at the
> Colosseum and Bazaar spots, fps with the cache on must be at least 1.4× fps
> with it off. Print both.

Measured, headless Chromium 1280×720, software rendering:

| spot | cache off | cache on | **ratio** | bar |
|---|---|---|---|---|
| Ruined Colosseum | 28.9 fps | 32.5 fps | **1.12×** | 1.40× |
| Grand Bazaar | 28.9 fps | 37.4 fps | **1.30×** | 1.40× |

Across **five** independent runs and **two** measurement methods the ratio came
out 1.12×, 1.16×, 1.18×, 1.24×, 1.25×, 1.30×, 1.33× — never once 1.40×. At
1920×1080 it is 1.16–1.20×.

The cache **is** faster everywhere it was measured — at the Bazaar it takes
34.62 ms of render down to 26.71 ms, nearly 8 ms a frame. It is just not 1.4×
faster, and it cannot be.

## 2. Why this is not a coding problem

I measured the ceiling: the same frame with the ground pass drawing **nothing
at all** — the cached pass still scans, culls and looks up every chunk, the
seam underlay is still painted, only the ground itself is skipped.

| spot | ratio with a **completely free** ground pass |
|---|---|
| Colosseum | 1.28× – 1.60× |
| Bazaar | ~1.37× – 1.44× |
| Spawn | ~1.32× |

The ground pass is now only about a quarter to a third of a frame. Even at the
top of that range the margin left for *compositing the cached ground back* is
roughly 0.9–1.1 ms. One cached frame copies 1.46M pixels onto a 0.92M pixel
screen — already cut down from 4.2M by splitting each chunk's blit into bands
that follow the diamond it actually paints — and that copy costs several
milliseconds. **Even a perfect, zero-overdraw, single screen-sized copy would
not fit in the budget.** No arrangement of the spec's chunk-and-blit design
reaches 1.4× on this build.

## 3. Why the bar no longer fits the file

The spec's own premise, measured **2026-10-12**:

> **CPU profile at the Colosseum:** 51.5% native canvas rasterising … **Why:**
> the ground pass redraws every visible tile's diamond and cliff faces from
> scratch every frame.

True when written. Since then the whole Gauntlet S2 run landed — the
Colosseum's columns, lintels and seating, the Ancient Forge, the volcano cone
and its crack network, continuous surf, actor discs, the nameplate overlay
pass, bird flocks, leaves, butterflies, rabbits, the seam underlay. None of
that is the ground pass, and it is what the frame is now spent on. At the
Bazaar the non-ground part of a frame is about 25 ms of 35 ms.

**This is worth more than the cache itself: the ground pass is no longer
RuneHaven's bottleneck.** Whatever happens before launch, the next performance
work belongs in the entity, overlay and particle passes — not here.

## 4. What is built and proven

Every other clause, and every other proof gate, passes.

**PART A — the ground cache.** `GROUND_CACHE`, `GC_TILES` 16, `GC_MAX` 48,
`GC_BAKE_PER_FRAME` 2, exactly as specified. Chunks are baked by the existing
`drawGroundTile()` in the live pass's own diagonal order, padded by
`GROUND_UP`/`GROUND_DOWN`, composited back to front by `cx + cy`, and any chunk
not yet baked paints its own tiles directly in its own turn, so nothing pops
in. Cleared wherever `tileCache.clear()` runs. Interiors never touch it.

- **Pixel match: 0 differing pixels.** Not "under 0.5%" — *zero*, at all six
  cameras (Spawn, a coastline, the volcano rim, a forest edge, **and the two
  frame-rate cameras**), of 921,600, and zero again at 1920×1080 of 2,073,600.
  The noise floor — two cache-off renders — is also 0, which is what makes the
  comparison mean anything.
- LRU never exceeds `GC_MAX` (measured: 48 held, 752 evicted across a long walk).
- Never more than `GC_BAKE_PER_FRAME` bakes in one frame.
- A real world reset empties it, driven through the real `performWorldReset()`.
- The cached pass scans and draws **exactly** the tiles the direct pass does
  (2009 drawn / 5396 scanned, both modes), so the existing cull proof still
  proves the ground.
- Nothing a bake paints falls outside its chunk canvas: measured over 1096
  recorded coordinates, tightest margin 19px.

**PART B — the quiet HUD.** Over 120 frames standing still: **0** DOM writes,
360 skipped, **0** compass rebuilds, 3 minimap redraws in 802 ms against the
250 ms floor. Moving one tile redraws the minimap; a changed bearing rebuilds
the dial.

**PART C — the pixel-ratio decision**, recorded with `RENDER_SCALE = 1` read by
`resize()`, and a comment saying why CSS pixels are the deliberate choice —
and what else would have to change before that dial could actually be turned.

**Harnesses, on the patched build:** `run3` CAUGHT ERROR none · `run4`
**1898 PASS / 0 FAIL** (1870 before, +28 gates, none removed) · `run5` CAUGHT
none · `shot.js` tour renders correctly with the cache live.

## 5. What I need from you — three options

1. **Re-cut the bar to a measured number.** The honest one is **≥ 1.1× at both
   spots**, which this build clears in every run; ≥ 1.25× would be clipping the
   Colosseum. One line in README and the patch ships as-is. *My recommendation.*
2. **Replace the ratio with an absolute floor** — e.g. "the cached ground pass
   must cost at least 3 ms/frame less than the direct one". Measured: 3.8 ms at
   the Colosseum, 7.9 ms at the Bazaar. This does not pretend a ratio is stable
   when the rest of the frame keeps growing.
3. **Keep 1.4× and re-aim the spec at what is actually slow.** Then the ground
   cache is not the work; the entity/overlay/particle passes are. Say so and I
   will spec and build that. Keeping 1.4× *and* the ground cache is not
   possible — the ceiling is below it at the Colosseum.

I did not pick one myself, because deciding what "fast enough before launch"
means is a decision about your game, and because quietly lowering a locked
acceptance bar is exactly what `.claude/skills/gate-integrity` exists to catch.

## 6. The work itself

    git apply performance_ground_cache.patch

Three files and nothing else:

| file | what |
|---|---|
| `runehaven.html` | PARTS A, B and C |
| `debug/run4.js` | 28 new gates; one existing gate re-anchored (below) |
| `debug/perf.js` | **new** — the two Playwright gates jsdom cannot run |

`debug/perf.js` only means anything with the patch applied, which is why it is
in the patch rather than loose in `debug/`. Run it with
`node debug/perf.js runehaven.html [width] [height]`.

### Gate integrity

- **Gate count 1870 → 1898, none removed.**
- **One existing gate changed, not relaxed.** The S2 seam gate took
  `gameScript.indexOf('drawGroundTile(ctx, tx, ty);')` with no start offset, to
  prove the underlay is painted immediately above the ground loop. The cache
  adds a second such call site earlier in the file, so the unanchored search
  began measuring to the wrong one. It is now anchored *after* the underlay
  call: same claim, same 2500-character bound, measured 1435.
- **No tunable the spec did not name was changed.** `GC_BAND` (32) and
  `GC_PAD_SLACK` (24) are new constants belonging to this feature.
- Parse floor intact. No `service_role` key, no new secret.
- **One new `catch`**, around `document.createElement("canvas")` in the bake.
  Declared because the spec did not ask for it.

### Two implementation decisions you should know about

**The ground is drawn on whole pixels.** A raster cannot be moved half a pixel
without resampling, so the frame's ground offset is rounded once and applied as
a translate — in *both* cache modes, which is why the cached and direct paths
are bit-identical. The ground therefore scrolls in whole pixels while entities
keep their sub-pixel positions. The spec's pixel gate cannot see this, because
it compares snapped against snapped, so I measured it separately against the
**pre-build** file: at three cameras **0.00%, 0.00% and 0.07%** of pixels
differ by more than 8 — inside the spec's own 0.5% bar, and that is an upper
bound, since two page loads also differ slightly in world epoch. It is a real
if invisible rendering change, and it is what makes the cache possible at all.

**The blit is banded.** The spec says "blit visible chunks back to front by
`cx + cy`". A chunk's tiles form a diamond but its canvas is the bounding box
plus the cliff-face pad, so one rectangle per chunk copies ~2.8× the area it
paints, onto neighbours already blitted — 4.2M pixels a frame for a 0.92M pixel
screen. Each chunk now records at bake time how far it paints in each
horizontal band and the blit copies those bands: same pixels, 1.46M instead of
4.2M.

## 7. Findings from the doubt pass that are NOT fixed

Two fresh-context adversarial reviewers were given only the diff and the spec
text, never my reasoning. They confirmed the lattice algebra and the pad
arithmetic. Everything actionable they found is fixed in the patch — the LRU
now refuses to evict a chunk the current frame still needs (a plain LRU
*inverts* into a permanent loss above ~2560×1440, where more than 48 chunks are
visible); a canvas-allocation refusal now clears the cache instead of stranding
63 MiB; a bake success resets the refusal count; `updateUnmakingHud()` and
`updateBossHud()` now go through the same compare; the map key names its world.
These are open:

1. **`drawArenaFloorDetail`'s raked grain reaches ±28px from a tile centre**
   (`(gu - gv) * IW2` with `gu, gv ∈ [-0.6, 0.6]`), past `IW2` = 22, and unlike
   the sand grain 11 lines earlier it has no containment guard. This is a
   **pre-existing** bug, not one the cache introduces: the ground cull already
   drops such a tile at the screen edge while its fleck belonged on screen. It
   also means the "two chunks on one `cx + cy` diagonal never overlap" claim
   holds with zero margin rather than the 6px the gate computes. No visible
   consequence found — the pixel gate reads 0 at the Colosseum, the only place
   this paint exists — and a 1.6×1.4px fleck is the whole stake. Worth a guard
   next time something touches that function.
2. **`GC_MAX = 48` is sized for 1080p.** Measured: ~19 chunks at 1280×720, 34 at
   1920×1080, both comfortable. Above ~2560×1440 more than 48 are visible, and
   the excess now degrades (those chunks draw directly) instead of thrashing —
   but 48 is a number to raise before you ship to large desktop monitors. 48
   chunks is also 63 MiB of offscreen canvas, independent of viewport, which is
   over-allocated ~4× for a phone.
3. **A browser that silently hands back a discarded (transparent) backing store
   is not detected.** iOS Safari does this under memory pressure. The guard
   catches a *throw*, not a canvas that lies. No integrity check on a baked
   chunk exists.
4. **`RENDER_SCALE` is a record, not a working dial.** Raising it would also
   need the input path fixed (`screenToWorld(e.clientX, …)` mixes CSS and
   device pixels) and `applyHelpLift()`'s rect comparison. The spec asked for
   the constant and the comment, which is what is there; the comment now says
   this.
5. **My own first frame-rate method was wrong and is replaced.** Counting
   requestAnimationFrame callbacks looks like honest fps and is not: calibrated
   against injected per-frame work, this browser reports a flat ~57 fps for
   every real cost from 0 to 16 ms, and is non-monotone in that band. The
   numbers in section 1 come from forced-raster render timing with
   counterbalanced condition order. Both methods agree the gate fails; they
   disagree about by how much.

*Cross-model skipped: non-interactive context.*

## 8. Process

Standard process followed: `runehaven-art-style/SKILL.md` read first; surgical
patches only, every anchor count asserted before replacing; run3/run4/run5 all
green on the patched build; doubt pass and gate-integrity run; visual check
run. `NEXT_BUILD.md` was not edited and nothing was built that it does not name.
