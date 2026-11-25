# Living World v2 — daily slices (owner-set Mon 2026-11-23)

One slice a day, seven days a week. NIGHT slices run in the 5am nightly build (see NEXT_BUILD.md rules). DAY slices are done with the owner in a live session because they involve look or design decisions. A slice marked ★ needs the owner to approve its before-and-after GIFs. Status: QUEUED, AWAITING, APPROVED, DONE.

Branch for all S4 work: `s4/breathing-land` (head e7c746b at time of writing). The owner's current look direction ("Living Diorama": no scenery outlines, cool shadows, time-of-day grade, fewer trees, five-second rule) is NOT yet in the README, so no NIGHT slice may implement it. DAY slice 2 locks it.

| # | Owner | Slice | Status |
|---|---|---|---|
| 1a | NIGHT | **S4 Plains gates** on `s4/breathing-land`. Report: `docs/nightly/1a.md` on that branch. 14 gates in run4 and 2 in run6, 29 of 29 mutations caught, the 2 foam failures fixed in the code, run3-run6 green (run4 2192 PASS / 0 FAIL, run6 25 PASS / 0 FAIL). Correction recorded: the foam block is in `render()`, not `drawGroundTile`. | DONE |
| 1b | NIGHT | **S4 Plains close-out** on `s4/breathing-land`, after 1a (done). Do not change how Plains looks and leave `plains: false`. Steps, pushing after each: (1) Fresh-context review of the WHOLE branch diff against main (1a only reviewed the foam repair); fix real findings inside Plains scope; report the rest. (2) Changelog, art-style skill and GAUNTLET_PROGRESS entries for S4 Plains. (3) GIFs with the tools already on the branch: `node debug/s4cap.js <dir> runehaven.html plains <dayT> <frames> <pb> - <gapMs>` where pb is `plains` (after) or `off` (before, equals main), then `python3 debug/s4gif.py <before_dir> <after_dir> <out.gif> <cx> <cy> <w> <h> "BEFORE (main)" "AFTER (S4 Plains)" <ms>`. Make four GIFs in `docs/nightly/`: plains-day (dayT 0.25), plains-dusk (0.45), plains-night (pick a dayT where nightAlpha is at least 0.6 and say which), and plains-wind-closeup (a 300x200 crop, 24+ frames, 80 ms gap). Make a fifth, plains-border, with spot `border:plains:forest`. Look at the frames yourself before committing: a GIF where nothing moves or nothing differs is a failed GIF. (4) Frame cost on vs off using the existing run6 or `debug/_s4fast6.js` method, limit 1.15x; report the cold-chunk bake figure from 1a (5.9 ms idle, 9.2 ms loaded) as a number and do NOT change PB_FORCE_PER_FRAME: that is the owner's call. (5) Report in `docs/nightly/1b.md`, status AWAITING. Do not touch the coast tide (see notes below). | QUEUED ★ |
| 2 | DAY | Lock Living Diorama look and the five-second rule into README, art skill and bible. Terrain v2 spike on Plains. | QUEUED |
| 3 | DAY | Terrain v2 go or fallback, then Plains in the Diorama look. | QUEUED |
| 4+ | NIGHT | Meadow, Forest, Dark Forest, sand, coast, night life, S4 close-out, one a night, each ★. Specs get added here after slice 3. | WAITING on 3 |

## Notes the coast slice must start from (from the 1a review, 2026-11-24; do NOT change these in a Plains slice)
1. The tide swash (`PB_AIR_TIDE_A` 0.12 tiles) is bigger than the bright foam line's inset (0.08), so at the crest the line sits on the LAND side of the shore edge for ~27% of every 14 s cycle. The art skill records "foam on the grass of vertical shores" as a fixed defect. Clamp the swash or move the inset, with a gate.
2. The tide ignores the Wind motion setting (only Reduce motion stops it). Design call: is the tide "wind motion"?
3. The tide's screen offsets are not snapped to whole backing pixels, unlike the rest of the S4 air module.
4. The wet-sand band under north and west foam has no tide term while south and east does.
5. The air module draws foam on the SOUTH and EAST shores, but the art skill's locked rule says south and east shores carry no foam. Owner decision before the coast slice.
