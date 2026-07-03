---
name: codex-also
description: >-
  Answer a question or solve a problem yourself while also asking Codex the same thing in
  parallel, then present both perspectives together. No Claude subagents, no debate loop --
  just you plus a second opinion. Use when the user asks to "also ask codex", wants your
  answer and Codex's side-by-side, or asks a question with codex CC'd.
argument-hint: "[task]"
---

# Codex Also

Like `codex-debate` with no loop, except the "Claude side" is just you, in this session -- do
not spawn a Claude subagent for the task.

## Steps
1. Load the `codex-subagent` skill -- all calls to codex must pass through this skill.

2. Spawn a codex subagent with the task. The goal is an independent second opinion, so keep the
   prompt unopinionated:
   - It should reflect what the user actually asked, not your interpretation of it.
   - Don't add questions, requirements, or guidelines the user didn't give.
   - Objective, factual context is fine if it only exists in this session (Codex can read the
     repo itself).

3. Work on the task yourself while codex runs. If you finish first, don't poll for codex -- end
   your turn and claude-code will wake you when it responds.

4. Once you have both answers, present them naturally:
   - If codex finished before you wrapped up, feel free to weave its answer into your thinking
     and say so.
   - If your answer was already formed, present codex's as the second opinion it is.
   - Either way, the user should be able to tell which conclusions are yours, which are codex's,
     and where you agree or differ. A merged answer with attribution is fine; so is
     side-by-side. Use judgment based on how similar the answers are.
   - Don't paper over disagreements -- call them out, even small ones.

5. Keep the codex `(filepath, threadId)` pair around and offer to follow up with codex --
   clarifications, disagreements, or a deeper dive -- if the user wants.
