# Living World v2 — daily slices (owner-set Mon 2026-11-23)

One slice a day, seven days a week. NIGHT slices run in the 5am nightly build (see NEXT_BUILD.md rules). DAY slices are done with the owner in a live session because they involve look or design decisions. A slice marked ★ needs the owner to approve its before-and-after GIFs. Status: QUEUED, AWAITING, APPROVED, DONE.

Branch for all S4 work: `s4/breathing-land` (head e7c746b at time of writing). The owner's current look direction ("Living Diorama": no scenery outlines, cool shadows, time-of-day grade, fewer trees, five-second rule) is NOT yet in the README, so no NIGHT slice may implement it. DAY slice 2 locks it.

| # | Owner | Slice | Status |
|---|---|---|---|
| 1 | NIGHT | **S4 Plains close-out** on `s4/breathing-land`. Do not change how Plains looks. Run run3–run6 with mutation checks on the new S4 gates (wind, scenery forge, tufts, life, air), run the gate-integrity check, get a fresh-context review of the branch diff and fix its findings, add the changelog, art-style skill and GAUNTLET_PROGRESS entries. Capture Plains day, night, border and wind-closeup before-and-after GIFs (PIXEL_BIOMES.plains true vs false). Measure frame cost on vs off (limit 1.15x). Leave `plains: false` in the code; the owner flips it after approval. | QUEUED ★ |
| 2 | DAY | Lock Living Diorama look and the five-second rule into README, art skill and bible. Terrain v2 spike on Plains. | QUEUED |
| 3 | DAY | Terrain v2 go or fallback, then Plains in the Diorama look. | QUEUED |
| 4+ | NIGHT | Meadow, Forest, Dark Forest, sand, coast, night life, S4 close-out, one a night, each ★. Specs get added here after slice 3. | WAITING on 3 |
