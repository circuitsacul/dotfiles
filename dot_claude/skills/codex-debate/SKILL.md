---
name: codex-debate
description: >-
  Spawn two subagents, one Opus, one Codex, to solve the same problem / answer the same question,
  then have them debate until convergence.
argument-hint: "[max-iterations, task]"
---

# Codex Debate

## Skill Arguments
This skill has one argument: `max-iterations`. If not provided by the user, default to 3.

## Steps
1. Load the `codex-subagent` skill -- all calls to codex must pass through this skill.

2. Spawn two subagents:
   - Codex subagent, using the `codex-subagent` skill
   - An Opus subagent.

   The goal is to have Codex solve the problem independently. As such:
   - The prompt MUST reflect what the user has actually said.
   - The prompt MUST NOT include opinionated information from you.
     - Do NOT include your interpretation of the prompt (Opus will re-derive it, and the whole
       point of the Codex sub-agent is to get a different perspective).
     - Do NOT include further questions, requirements, or guidelines that the user did not specify,
       such as steps to complete, items to consider, etc.
   - The promt MAY include _objective, factual_ information ONLY IF that information is ONLY
     present in the current claude-code session.
   - Besides the below exceptions, the prompt MUST be identical for both Opus and Codex.

   You MAY choose to either spawn a fork Opus subagent, or a fresh Opus subagent. If you spawn
   a fork:
   - you MUST include a clear notice to the Opus subagent that it _is_ the subagent outlined in
     this skill, and MUST ignore this skill (i.e., it must not spawn its own opus/codex subagents
     for the purpose of this skill).
   - you MAY _exclude_ items from the fork subagents prompt that it would already know as a direct
     result of being a fork.
   - it is additionally recommended that you spawn the codex subagent first.

   Prefer using a fresh subagent without a substantive reason to use a fork.

=== BEGIN LOOP ===

4. Wait for both agents to respond. claude-code will notify you when both agents finish, so you
   can simply end your turn.

5. Provide each agents last response to the other agent. Ask them to take a position, with detailed
   reasoning:
   a) Codex's is best, as-is or with style/insignificant differences;
   b) Claude's is best, as-is or with style/insignificant differences;
   c) Codex's is best, but with modifications (provide modified artifact);
   d) Claude's is best, but with modifications (provide modified artifact);
   e) A middle ground between the two is best (provide new artifact)

   Notes:
   - Choosing position a) or b) does _not_ mean they're choosing the _originally_ generated plan,
     but rather accepting corresponding agents last position as their own, with at most stylistic
     or insignificant differences. You MUST make the agents aware of this understanding.

6. Wait for both agents to respond.
   - If both took the same position a) or b), break the loop with the corresponding artifact.
   - If both chose a different position (any) but their positions are effectively identical in
     content, break with the artifact.
   - If the loop has continued for more than {max-iterations} iterations, break the loop early and
     return both artifacts, along with the disagreement, to the user as a decision.
   - Otherwise, fall through to step 7.

7. This step means one or more of the agents took position c, d, or e. For each agent that did,
   hand its response (reasoning + updated artifact) to the other agent, and ask the receiving agent
   to re-decide its position.

   Continue the loop, back to step 4., to wait for the response.

=== END LOOP ===

8. Return to the user:
   - Either both artifacts side-by-side (conflict), or the merged/final artifact
   - A summary of any remaining disagreements between the agents, no matter how small
