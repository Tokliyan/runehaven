Build exactly per "Confirmed, locked spec for a future version — Consumables" in README.md.

ECC IS NOW MERGED INTO main (.claude/settings.json, project scope, standard hooks). This is the first build to run with it actually active — use it for real, not just let the hooks passively ride along:

1. Before marking this build done, run ECC's fresh-context review workflow against the diff this version produces. A genuinely separate pass, not the same context that wrote the code — its whole value is catching what the implementing session cannot see about its own work.
2. Report exactly what that review found, even if the answer is "nothing new" — that is itself a real, useful data point about whether ECC is worth continuing to invoke.
3. Do not let ECC block or override the existing README/SKILL.md gate discipline (RED means RED, proof gates as already defined) — this is an additional check layered on top, not a replacement for what already works.
4. If any ECC hook (GateGuard or otherwise) intercepts a normal command, comply with what it actually asks for rather than finding a way around it, the same discipline already shown when merging the ECC branch itself.
