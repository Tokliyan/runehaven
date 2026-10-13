---
name: delegate
description: Use during long RuneHaven build sessions (gauntlet stages, big specs) to hand bulk reading, mechanical edits, long test runs and independent reviews to subagents on cheaper models, so the main agent keeps its context and judgement for decisions and verification. Adapted from the idea in oubakiou/delegate-skills (MIT); uses Claude Code's built-in Agent tool, no scripts.
---

# Delegate (RuneHaven)

The idea comes from oubakiou/delegate-skills (MIT): keep the expensive model as the decision-maker, and send routine "read, investigate, fix" work to cheaper workers, so only their short results come back into the main context.

Their version runs a ~280 KB bundled CLI that needs Node 24+ and logged-in child CLIs. We get the same effect with the **built-in Agent tool** (its `model` parameter), with no third-party code to run.

If the Agent tool is not available (for example, in the nightly build), do the work inline. Delegation is an optimisation, never a requirement.

## Who does what

| Work | Agent model | Examples here | Permissions |
|---|---|---|---|
| **Explore** | `haiku` | find every call site of `drawGroundTile`, list every `KEYBINDS` use, read a 4,000-line skill and pull out the MUST-NOT-REGRESS list, grep run4 for gates touching a constant | read-only |
| **Chore** | `haiku` | run run3/run5 and return only PASS/FAIL counts and failing lines, build contact sheets, rename a tunable everywhere it appears | edit files in the scratchpad only |
| **Implement** | `sonnet` | one well-specified part of a spec (e.g. "PART E: lift `#hudMinimap`/`#hudZone` when help is open"), with the exact anchors and acceptance lines pasted in | edit `runehaven.html` / `debug/*`; **no commit, no push** |
| **Visual score** | `sonnet` | read a batch of screenshots and score them on the GAUNTLET.md S2 card, one line per shot | read-only |
| **Review** | `opus` | adversarial, fresh-context review of a diff against its spec (pairs with `doubt-driven-development`: give it the ARTIFACT plus the CONTRACT, never the CLAIM) | read-only |

**The main agent keeps:**
- choosing what to build;
- reconciling findings;
- re-running the full gauntlet itself;
- the visual check;
- the changelog;
- commits, merges, pushes and `NEXT_BUILD.md`.

A worker's "all green" is a claim. The main agent re-runs the gates before anything ships.

## How to delegate

1. **Write one self-contained prompt.** A worker starts cold. Include:
   - the repo path `/home/claude/runehaven`;
   - the exact files, anchors and acceptance lines;
   - what *not* to touch: README specs, `NEXT_BUILD.md`, the bible, live Supabase, git push.
2. **Ask for results in a file, not in chat.** Have the worker write its result to `.temp/delegate/<short-task>.md`, which is gitignored. The file starts with a 5-line index (verdict, files touched, commands run, open questions, where details are). The worker's final message is just the path plus the verdict line.
3. **Read only what you need.** Read the index first, and only the sections you need.
4. **Run independent workers together.** Two explores, or an explore plus a test run, can run in parallel in one message. Never run two implement workers on the same file at once.
5. **Bound it.** Workers do one task each and stop. If a worker reports it is blocked, do not re-send the same prompt; fix the prompt or do the task yourself.

## Prompt template

```
You are a worker on RuneHaven (single-file Canvas game) in /home/claude/runehaven.
TASK: <one sentence>
CONTEXT: <anchors, constants, spec lines, pasted verbatim>
DO: <numbered steps>
DO NOT: commit, push, edit README.md/NEXT_BUILD.md/RUNEHAVEN_BIBLE.md, touch live Supabase,
        weaken or delete any test gate, reformat code you were not asked to change.
DONE WHEN: <acceptance lines>
OUTPUT: write .temp/delegate/<task>.md — first 5 lines: VERDICT / FILES / COMMANDS / QUESTIONS / DETAILS-AT,
        then the details. Final message: the path and the VERDICT line only.
```

## Red flags

- Delegating a decision the spec leaves open. That is the main agent's job, or the owner's.
- Shipping on a worker's word without re-running run3, run4 and run5 yourself.
- An implement worker editing outside its named anchors. Diff its output before keeping it.
- Using `opus` for exploration or `haiku` for review. Cheap models read; the strongest model judges.
