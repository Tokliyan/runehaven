# NEXT_BUILD — Living World v2, daily slices (owner-set Mon 2026-11-23)

Build the FIRST slice in `LIVING_WORLD_DAILY.md` whose owner is NIGHT and whose status is QUEUED, and only if every slice above it is APPROVED, DONE or DAY-DONE. If the first unfinished slice above it is owned by DAY, or is AWAITING approval, report "idle: waiting on <slice>" and stop. That is a normal night, not a failure.

Overrides of the README standard process for these slices (owner decision, they win over README):
1. Work on the branch named in the slice. NEVER merge or fast-forward to main. NEVER push to main. The owner approves before-and-after GIFs first, and the owner (day session) does the merge.
2. Every PIXEL_BIOMES switch stays exactly as the slice says (default false unless the slice says otherwise).
3. Do not touch anything outside the slice's scope. Do not decide design questions: if the spec does not settle one, stop and write BUILD_FAILED.md on the branch.
4. Gates: run3, run4, run5 and run6 all green, plus the gate-integrity check (counts only rise). run6's Colosseum frame-rate FAIL is a known baseline under CPU load; re-run it once and record both numbers, do not "fix" it.
5. Finish by committing a report to `docs/nightly/<slice>.md` (what changed, gate counts, frame-cost on/off, anything surprising) and before/after GIFs in `docs/nightly/`. Then update the slice's status in `LIVING_WORLD_DAILY.md` to AWAITING (needs owner approval) or DONE (nothing to approve) and push the branch.
6. Save work as you go: commit AND push to the slice's branch after every numbered step in the slice, not only at the end. The usage limit has killed a night mid-slice before and everything unpushed was lost. If a slice already has pushed work, resume from its first unfinished step instead of starting over.
7. Keep a night to what fits: if the slice is too big to finish, finish and push the steps you can, mark the slice "PARTIAL: steps done / steps left" in `LIVING_WORLD_DAILY.md`, and stop cleanly.
