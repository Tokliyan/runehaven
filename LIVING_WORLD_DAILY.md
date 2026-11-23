# Living World v2 — daily slices (owner-set Mon 2026-11-23)

One slice a day, seven days a week. NIGHT slices run in the 5am nightly build (see NEXT_BUILD.md rules). DAY slices are done with the owner in a live session because they involve look or design decisions. A slice marked ★ needs the owner to approve its before-and-after GIFs. Status: QUEUED, AWAITING, APPROVED, DONE.

Branch for all S4 work: `s4/breathing-land` (head e7c746b at time of writing). The owner's current look direction ("Living Diorama": no scenery outlines, cool shadows, time-of-day grade, fewer trees, five-second rule) is NOT yet in the README, so no NIGHT slice may implement it. DAY slice 2 locks it.

| # | Owner | Slice | Status |
|---|---|---|---|
| 1 | NIGHT | **S4 Plains close-out** on `s4/breathing-land`. Do not change how Plains looks. (a) The S4 gates DO NOT EXIST YET (no wind, scenery-forge, tuft, life or air checks are in run4/run5/run6): write them from the README "Gates added (they only ever rise)" and "Performance budget" lists for Plains only, using the existing `debugPbInfo`, `debugSetPb`, `debugSetDayT` and `debugSetWeather` hooks; the other five biomes get theirs when each is built. (b) Mutation-check every new gate (break the code, confirm the gate fails, restore). (c) run3-run6 green, gate-integrity check (counts only rise from the main baseline: run4 2178 PASS, run6 22 PASS plus its 1 known baseline FAIL). (d) Fresh-context review of the branch diff against main; fix real findings. (e) Changelog, art-style skill and GAUNTLET_PROGRESS entries. (f) Plains day, night, border and wind-closeup before-and-after GIFs (`plains` true vs false) and frame cost on vs off (limit 1.15x). Leave `plains: false` in the code; the owner flips it after approval. The README gate "outline present" stays as written for now: the owner is moving to a no-outline look, and a DAY slice amends that gate with him later. | QUEUED ★ |
| 2 | DAY | Lock Living Diorama look and the five-second rule into README, art skill and bible. Terrain v2 spike on Plains. | QUEUED |
| 3 | DAY | Terrain v2 go or fallback, then Plains in the Diorama look. | QUEUED |
| 4+ | NIGHT | Meadow, Forest, Dark Forest, sand, coast, night life, S4 close-out, one a night, each ★. Specs get added here after slice 3. | WAITING on 3 |
