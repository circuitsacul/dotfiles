---
name: codex-debate
description: >-
  Spawn two subagents, one Claude, one Codex, to solve the same problem / answer the same question,
  then have them debate until convergence.
argument-hint: "[max-iterations, mode, task]"
---

# Codex Debate

## Skill Arguments
This skill has two arguments besides the task:
- max-iterations:
  - none -> default to 3
  - 0 -> skip the loop step; don't load a loop file, mode has no meaning -- provide both generated
         artifacts to the user side-by-side.
  - n -> max-iterations becomes an argument to the corresponding loop
- mode (ONLY where max-iterations > 0):
  - `claude-first` -> load `loop-turns.md` with first: claude
  - `codex-first` -> load `loop-turns.md` with first: codex
  - `parallel`, or not provided (the default) -> load `loop-parallel.md`

  Mode is matched by exact token only: if the token after max-iterations is not one of the above,
  it is part of the task, and mode defaults to parallel.

## Steps
1. Load the `codex-subagent` skill -- all calls to codex must pass through this skill.

2. Spawn two subagents:
   - Codex subagent, using the `codex-subagent` skill
   - A Claude subagent. Never pass a model override -- fresh and fork subagents alike must run on
     the current session model.

   The goal is to have Codex solve the problem independently. As such:
   - The prompt MUST reflect what the user has actually said.
   - The prompt MUST NOT include opinionated information from you.
     - Do NOT include your interpretation of the prompt (Claude will re-derive it, and the whole
       point of the Codex sub-agent is to get a different perspective).
     - Do NOT include further questions, requirements, or guidelines that the user did not specify,
       such as steps to complete, items to consider, etc.
   - The prompt MAY include _objective, factual_ information ONLY IF that information is ONLY
     present in the current claude-code session.
   - Besides the below exceptions, the prompt MUST be identical for both Claude and Codex.

   You MAY choose to either spawn a fork Claude subagent, or a fresh Claude subagent. If you spawn
   a fork:
   - you MUST include a clear notice to the Claude subagent that it _is_ the subagent outlined in
     this skill, and MUST ignore this skill (i.e., it must not spawn its own claude/codex subagents
     for the purpose of this skill).
   - you MAY _exclude_ items from the fork subagent's prompt that it would already know as a direct
     result of being a fork.
   - it is additionally recommended that you spawn the codex subagent first.

   Prefer using a fresh subagent without a substantive reason to use a fork.

3. When max-iterations > 0, execute the loop (either `loop-turns.md` or `loop-parallel.md`, based
   on arguments).

   Every round continues the same two agents from step 2 -- reply to the Claude subagent via
   SendMessage (using its agent ID/name), and to Codex via the `threadId` flow in the
   `codex-subagent` skill. NEVER spawn fresh agents mid-debate.

   NOTE: When waiting for agent responses, end your turn -- claude-code will wake you when an
         agent responds.

4. Return to the user:
   - Either both artifacts side-by-side (conflict, or max-iterations = 0), or the merged/final
     artifact.
   - When max-iterations > 0, include any disagreements between the agents, even small ones.
