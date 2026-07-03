---
name: claude-also
description: >-
  Answer a question or solve a problem yourself while also asking Claude the same thing in
  parallel, then present both perspectives together. No debate loop -- just you plus a second
  opinion. Use when the user asks to "also ask claude", wants your answer and Claude's
  side-by-side, or asks a question with claude CC'd.
---

# Claude Also

Like `claude-debate` with no loop, except the "Codex side" is just you, in this session -- do
not spawn a codex subagent for the task.

## Steps
1. Use the `claude-subagent` skill for the Claude call.

2. Spawn a Claude subagent with the task. The goal is an independent second opinion, so keep the
   prompt unopinionated:
   - It should reflect what the user actually asked, not your interpretation of it.
   - Don't add questions, requirements, or guidelines the user didn't give.
   - Objective, factual context is fine if it only exists in this session (Claude can read the
     repo itself).

3. Work on the task yourself while Claude runs, checking its process handle between your own
   steps rather than blocking on it.

4. Once you have both answers, present them naturally:
   - If Claude finished before you wrapped up, feel free to weave its answer into your thinking
     and say so.
   - If your answer was already formed, present Claude's as the second opinion it is.
   - Either way, the user should be able to tell which conclusions are yours, which are Claude's,
     and where you agree or differ. A merged answer with attribution is fine; so is
     side-by-side. Use judgment based on how similar the answers are.
   - Don't paper over disagreements -- call them out, even small ones.

5. Keep Claude's `(output file, session_id)` pair around and offer to follow up with Claude --
   clarifications, disagreements, or a deeper dive -- if the user wants.
