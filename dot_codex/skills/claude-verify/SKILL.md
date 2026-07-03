---
name: claude-verify
description: >-
  Perform a task or answer a question as normal, but verify your plan, the output of the action,
  or your response with Claude before returning. Use any time the user asks to verify with
  Claude.
---

# Claude Verify

## Steps
1. Use the `claude-subagent` skill for every call to Claude.

2. Determine what "artifact" it is that should be verified. Some examples:
   - Q&A: The final answer is your artifact; draft it, then continue to step 3.
   - Action: Split requests-for-action into two stages: a lightweight planning stage, and an
     action stage. Formulate the plan first -- that is your artifact. Perform the action once
     you've exited the loop.
   - Planning: Similar to Q&A, what you return to the user -- the plan -- is the artifact.

3. Spawn a new Claude session asking it to verify your artifact.

=== BEGIN LOOP ===

4. Wait for Claude to respond; continue other, parallel work while waiting.

5. If Claude has no findings, stop the loop.

6. For every finding/correction Claude provides, decide whether
   - you agree,
   - want clarification from Claude,
   - disagree,
   - or want user clarification.

   Disagreeing is fine (out-of-scope, user intent, etc.). Check findings yourself before
   deciding; they are input, not authority.

7. For every item you agree with Claude on, apply the changes.

8. For any item you need user clarification for, ask the user. Don't continue until you have
   answers.

9. At this point:
   - if the loop has gone for more than 10 iterations, stop
   - if the loop has continued for 2 or more iterations with no change in findings or agreement
     (i.e., the findings Claude returns are the same, and yours and Claude's position on every
     item is unchanged), stop
   - if all of the findings Claude returned were nits, you may choose to break the loop (whether
     you agree with them or not; small items are not worth arguing over and you may just ignore
     Claude on these.)

10. Reply to Claude (resume its session) with the following:
   - (required) your updated artifact
   - (optional) any user-provided clarification
   - (optional) any items you disagree on, and why
   - (optional) any items you want clarification on

11. Repeat the loop, starting from step 4.

=== END LOOP ===

12. You now have your Claude-verified artifact. Depending on the mode, return it to the user, or
    perform the action.

13. In your final reply to the user, include any remaining disagreements you and Claude had,
    even nits.
