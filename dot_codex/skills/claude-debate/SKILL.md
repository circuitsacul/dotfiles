---
name: claude-debate
description: >-
  Spawn two solvers, one Claude Code subagent and one codex subagent, to solve the same problem /
  answer the same question independently, then have them debate until convergence.
---

# Claude Debate

Invocation: `$claude-debate [max-iterations] [mode] task`

## Skill Arguments
This skill has two arguments besides the task:
- max-iterations:
  - none -> default to 3
  - 0 -> skip the loop step; don't load a loop file, mode has no meaning -- provide both
         generated artifacts to the user side-by-side.
  - n -> max-iterations becomes an argument to the corresponding loop
- mode (only when max-iterations > 0):
  - `claude-first` -> load `references/loop-turns.md` with first: Claude
  - `codex-first` -> load `references/loop-turns.md` with first: Codex
  - `parallel`, or not provided (the default) -> load `references/loop-parallel.md`

  Mode is matched by exact token only: if the token after max-iterations is not one of the above,
  it is part of the task, and mode defaults to parallel.

## Steps
1. Use the `claude-subagent` skill for every call to Claude.

2. Spawn two solvers ("Claude" and "Codex" in the loop files):
   - Claude: a Claude subagent, via the `claude-subagent` skill.
   - Codex: a native codex subagent. Leave model/config at defaults.

   The goal is two independent solutions, so both solvers get the identical prompt, and it stays
   unopinionated:
   - It reflects what the user actually said -- not your interpretation of it (each solver
     re-derives its own, which is the point).
   - It adds no questions, requirements, or guidelines the user didn't give.
   - Objective, factual context is fine if it exists only in this session; both solvers can read
     the repo themselves.

3. When max-iterations > 0, execute the loop (`references/loop-turns.md` or
   `references/loop-parallel.md`, based on arguments).

   Every round continues the same two agents from step 2 -- resume the Claude session via its
   session_id, and send follow-ups to the same codex subagent. Don't spawn new agents
   mid-debate. Wait for the agents' responses; do parallel work in between if you have any.

   Avoid re-emitting artifacts you already have on disk: Claude's last response lives in its
   output file, so point the codex subagent at that path (it can read `/tmp`), or splice it
   into Claude's next round prompt with `jq -r .result <file>` in a pipeline.

4. Return to the user:
   - Either both artifacts side-by-side (conflict, or max-iterations = 0), or the merged/final
     artifact.
   - When max-iterations > 0, include any disagreements between the agents, even small ones.
