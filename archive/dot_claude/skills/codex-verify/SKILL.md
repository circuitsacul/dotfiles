---
name: codex-verify
description: >-
  Perform a task or answer a question as normal, but verify your plan, the output of the action,
  or your response with codex before returning. Use any time the user asks you to verify with
  Codex.
---

# Codex Verify

## Steps
1. Load the `codex-subagent` skill -- all calls to codex must pass through this skill.

2. Determine what "artifact" it is that should be verified. Some examples:
   - Q&A: The final answer is your artifact; draft it, then continue to step 3.
   - Action: You should split requests-for-action into two steps: a lightweight planning stage,
     and an action stage. Formulate the plan first -- that is your artifact. You can then
     automatically perform the action once you've exited the loop.
   - Planning: Similar to Q&A, what you return to the user -- the plan here -- is the artifact.

3. Using the `codex-subagent` skill, spawn a new codex thread to ask it to verify your artifact.

=== BEGIN LOOP ===

4. Wait for codex to respond, and/or continue other, parallel work while waiting.

5. When codex responds: if and ONLY IF codex has NO FINDINGS, stop the loop.

6. For every finding/correction codex provides, decide whether
   - you agree,
   - want clarification from codex,
   - disagree,
   - or want user clarification.

   Don't be afraid to disagree on the basis of out-of-scope, user intent, etc. Always verify things
   yourself before deciding -- don't take Codex's findings as authoritative.

7. For every item that you _agree_ with codex on, apply the changes.

8. For any item you need user clarification for, ask the user. Don't continue until you have
   answers.

9. At this point:
   - if the loop has gone for more than 10 iterations, stop
   - if the loop has continued for 2 or more iterations with no change in findings or agreement
     (i.e., the findings codex returns are the same, and yours and codex's position on every item
     is unchanged), stop
   - if all of the findings codex returned were nits, you may choose to break the loop (e.g., you
     agree with all of them, or even if you disagree; small items are not worth arguing over and
     you may just ignore codex on these.)

10. Reply to codex with the following:
   - (required) your updated artifact
   - (optional) any user-provided clarification
   - (optional) any items you disagree on, and _why_
   - (optional) any items you want clarification on

11. Repeat the loop, starting from step 4.

=== END LOOP ===

12. You now have your codex-verified artifact. Depending on the mode, return it to the user, or
    perform the action.

13. CRUCIAL: in your final reply to the user, you MUST include any remaining disagreements you and
    codex had, even nits.
