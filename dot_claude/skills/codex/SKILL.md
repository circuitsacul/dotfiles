---
name: codex
description: Interact with codex to get second opinions and refine outputs.
argument-hint: "[pair|refine] [codex-effort] [*task]"
---

# codex

Run an interactive dialogue with a codex agent.

- Use one persistent codex thread: `codex` to start, then `codex-reply` to continue. Capture the
  `threadId` returned by the first `codex` call and pass it to every `codex-reply`.
- Default to model `gpt-5.5` (no `-codex` variant). Set reasoning effort to `high`, unless your
  effort is set to `max` _or_ dynamic workflows / ultracode is enabled; in those cases, use
  `xhigh`. This bullet is the single source of truth for the effort default. The tool has no
  `effort` parameter -- pass both via `model: "gpt-5.5"` and the config override
  `config: { "model_reasoning_effort": "high" }` (or `"xhigh"`).
- Always use `approval-policy: on-request`, unless there is a very strong reason to run codex
  fully non-interactively, in which case use `never` (codex never prompts; the sandbox is then
  the only limit on what it can do).
- Prefer using read-only sandbox, unless codex would reasonably need to mutate the working dir
  (e.g., `cargo build` or `cargo check`, which write artifacts); in that case, use workspace-write.
- Don't defer to codex -- treat it as a peer, but you remain the driver and decider.

## calling codex without blocking

The codex MCP tools (`codex` / `codex-reply`) block their caller unconditionally for codex's
entire turn; there is no async variant. Subagent spawns, by contrast, are async -- the `Agent`
tool returns immediately and notifies on completion, for both fork and fresh (non-fork) subagents.
So to call codex without freezing the parent, push the codex call into a subagent that absorbs the
block.

Pattern: any time you want to call codex _without_ blocking the parent, spawn a fresh `sonnet`
subagent whose only job is to relay between the parent and codex.

- Spawn a **new** sonnet subagent for **every** codex call -- including replies to the same codex
  thread. Never resume an old relay subagent.
- The relay is stateless and disposable: the codex thread lives in the MCP server keyed by
  `threadId`, so a fresh relay can continue any thread by id.
- First call (new thread): the relay invokes the `codex` tool with the configured model / effort /
  approval-policy / sandbox (see the header rules), then returns codex's response _and_ the
  `threadId` to the parent.
- Continuing a thread: the parent spawns a new relay and hands it the `threadId` plus the message;
  the relay calls `codex-reply` with that `threadId` and returns codex's response.
- The relay does no task work of its own and adds no commentary -- it passes the parent's message
  to codex verbatim and returns codex's output verbatim. This keeps codex independent, which
  `pair` mode depends on.
- The parent owns the `threadId` and all orchestration, consistent with the header rule to capture
  the `threadId` and pass it to every `codex-reply`.
- Approvals work through the relay (tested): with `approval-policy: on-request`, when codex requests
  an escalation the prompt surfaces to the **user** in the primary session -- the relay never sees
  it, doesn't hang, and you stay in control. So keep `on-request` (per the header rule) even in the
  relay path; no special handling needed.

## skill arguments

This section only applies if the skill was user-invoked.

arguments: $ARGUMENTS

Parse the arguments into mode, codex-effort, and task. All arguments are optional.

- if mode is not defined
  - if task (inferred or not) is net-new -> pair
  - if task (inferred or not) is one you've completed, or a request to verify your output -> refine
- codex-effort: if not passed, use the default from the header rule above (`high`, or `xhigh`
  for the `max` / dynamic-workflow / ultracode cases)
- if task is not defined, attempt to infer it from context

Once you've parsed the (possible) arguments:
- If you're confident you understand, explain your understanding anyways and ask for confirmation
  via a question.
- If there are multiple possible interpretations, ask the user to choose the correct one via a
  question.
- If you're not sure, don't guess; explain, and end the turn (don't use a question).

## steps

1. Complete the task yourself. Exceptions: requests for verifications of your output, or tasks that
   you've already completed. If the skill mode is "pair", then complete the task in a claude
   subagent (decide whether a fork or fresh agent makes the most sense.) Pair mode runs two
   independent tracks in parallel: this claude subagent, and the codex track (driven via the relay
   pattern in `## calling codex without blocking`). The claude work subagent may be persistent and
   resumed across rounds, since it holds its own analysis; each codex interaction, by contrast, is
   a fresh relay. Otherwise (the skill mode is "refine",) choose whether to use the current
   session, or a subagent (and whether fresh or fork). If you're not sure, just ask the user.

<when skill mode is "pair">
2. Spawn a relay subagent to start a new codex thread (this is the "codex subagent" named in
   step 3 -- do not call codex from the orchestrator); formulate the prompt with the following:

   a. Context; e.g., where an issue comes from, how/if codex can reproduce, where/if source code
      is available, and any other context that would clarify that codex should also self-verify.
   b. Any relevant work you've already done in the session, so long as 1) it is not directly an
      output of a similar task you've completed to the task for this skill, and 2) it is not in
      the scope of verification (when the task is to verify some output of yours).

      The goal of "pair" is to verify your output by having codex _independently_ produce its own
      output, so it defeats the purpose if you provide it directly.
   c. Ask that it provide a detailed answer with reasoning and references.
   d. General instructions; explicitly state that it should not modify source files or otherwise
      directly solve the issue.

3. Once both the claude subagent and codex subagent have finished, give each agent the other's
   output, with a request for refutation. In each subsequent round, relay each agent's latest
   reply to the other; continue until you stop (see `## converging`). Each codex round is a fresh
   relay subagent (a new sonnet) calling `codex-reply` with the parent-held `threadId`; the claude
   side can be the same subagent, resumed. Since at each step the agents are operating
   independently, it is your job as the orchestrator to determine consensus.

   It may also make sense for this step to morph into a back-and-forth, rather than constant
   parallelism. For example, this can happen if one agent no longer has any feedback to provide,
   but the other is continuing to provide novel insight. This is your job as the orchestrator to
   decide.

</when>

<when the skill mode is "refine">
2. Start a new codex thread; formulate the prompt with the following:

   a. Context; e.g., where an issue comes from, how/if codex can reproduce, where/if source code
      is available, and any other context that would clarify that codex should also self-verify.
   b. Any relevant work you've already done in the session.
   c. Your own output, with explanation and rationale.
   d. A request for a detailed _refutation_ of your output, with alternatives, reasoning, and
      references.
   e. General instructions; explicitly state that it should not modify source files or otherwise
      directly solve the issue.

3. When codex responds: if you used a subagent in step 1, provide codex's output to it (with
   the context that it's from this skill.) Otherwise, _you_ are the one that should reason over it.
   Provide your feedback/pushback to codex as a reply. Continue this step until you stop (see
   `## converging`).
</when>

4. Synthesize the final response.
   If codex materially affected the answer, include up to 5 bullet points summarizing its
   contribution at the end of your output. Keep them concise.

## converging
Run the loop (step 3) until one of three stop conditions, which differ in what they leave behind:
- *consensus* -- the two agree; nothing to surface, just synthesize.
- *diminishing returns* -- rounds stop adding new arguments or evidence, but differences remain.
- *continued disagreement* -- a hard crux on the *same* point that neither will concede.
The latter two both leave unresolved differences: surface them to the user (both positions, the
crux, your recommendation). Consensus does not.

Every round must add new information. Don't fold just because codex pushed back -- make the
reasoning convince you; equally, don't dig in out of stubbornness. The goal is the best answer, not
winning.

## edge cases
1. Task is a request for action: follow this loop for the _planning_ stage, before
   implementation. Then, additionally reply to codex, requesting verification of the changes.
2. Plan mode: while you're in plan mode, even if the user phrases the task as a request for
   action, the plan _is_ the "output". In such cases, you can disregard edge case 1.
3. Dynamic workflows / ultracode effort: For the first step (initial task completion), the dynamic
   workflow _is_ the claude-code subagent; however, do not provide codex's response back to a
   dynamic workflow for later steps; either use the current session, or use a regular claude
   subagent.

   Default to codex-effort: xhigh, and if the skill is agent-invoked, more strongly prefer `pair`
   mode.
