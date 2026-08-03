---
name: subagents
description: |
  Local guide for delegating work to pi subagents (@gotgenes/pi-subagents):
  background-first orchestration (run_in_background: true, then end-turn
  wake), result retrieval within the eviction window, resume/steer, model
  resolution, and file-based agent authoring. Use whenever you launch a
  subagent, coordinate parallel background agents, or create/edit agents.
---

# Subagents

This skill is for the main parent orchestrator only. Do not inject or follow
it inside spawned child subagents. The parent session owns delegation, review
fanout, and fix-worker launches; children get concrete role-specific tasks
and cannot run their own subagents (they never receive the subagent tools).

## House rules

These override anything else in this file when they conflict.

1. **Pick the agent for the job.** Available types, and what they default
   to -- choose whichever fits the task best:
   - `general-purpose`: all 7 builtin tools, inherits the parent model and
     the parent's full system prompt (a "parent twin" -- same rules and
     project conventions). The choice for anything that writes, mixes
     reading and writing, or needs the session's house style.
   - `Explore`: read-only (read, bash, grep, find, ls), replace-mode file
     search specialist prompt; defaults to `openai-codex/gpt-5.3-codex-spark`
     in this setup. Fast codebase recon, search, and code understanding.
   - `Plan`: read-only (read, bash, grep, find, ls), replace-mode software
     architect prompt; inherits the parent model. Implementation planning.
   Unknown types fall back to `general-purpose` with a note. Write the role
   into the prompt when a task needs framing the agent's default prompt
   does not provide (e.g. adversarial reviewer on `general-purpose`).
2. **Launch in the background, then end your turn.** Pass
   `run_in_background: true` on every spawn unless you specifically need a
   blocking foreground run. Then:
   - *Interactive session (the default)*: finish any independent work, tell
     the user what was launched, and END YOUR TURN -- even when your answer
     depends on the child result. Completion is delivered as a follow-up
     message that wakes you; the user can keep interacting meanwhile.
   - *Non-interactive (`pi -p`) or a skill that must run to completion in
     one turn*: block with `get_subagent_result({ agent_id, wait: true })`;
     there is no next turn, and ending the turn would abandon the children.
   - Foreground calls run strictly sequentially -- only one executes at a
     time -- so never use them for parallel work.
3. **Collect promptly: completed agents are evicted after ~10 minutes.**
   Records also do not survive a session switch or pi restart. Retrieve
   results (and the transcript, if needed) soon after the completion
   notification. Worst case the transcript file survives on disk (see
   Inspecting below).
4. **Resolve model IDs before model-specific launches.** When the user names
   models loosely ("sonnet", "haiku", version nicknames), run
   `pi --list-models` via bash (the full output is short) and confirm
   identifiers before launching. `model` accepts `provider/modelId` or a
   fuzzy name matched against available models; set reasoning effort with
   the separate `thinking` parameter (`off`..`xhigh`), NOT a `:suffix` on
   the model string.

## When to use subagents

- **Advisory review**: a fresh `general-purpose` agent prompted as an
  adversarial reviewer (`inherit_context: true` only when inherited
  decisions matter).
- **Recon and research**: `Explore` for codebase recon and search; a
  `general-purpose` agent prompted for web research.
- **Planning**: `Plan` for architecture and implementation planning.
- **Parallel exploration**: multiple non-conflicting read/research tasks,
  one background spawn each.
- **Long-running work**: background agents capped with `max_turns` (children
  get a wrap-up warning before the hard stop).
- **Second opinions**: an independent perspective from another model with
  different failure modes.

## Launching runs

### Single

```typescript
subagent({
  subagent_type: "general-purpose",
  description: "Review current diff",
  prompt: "You are a fresh-context code reviewer. Review the current diff for correctness. Do not modify project/source files.",
  run_in_background: true
})
```

`description` (3-5 words) labels the run in the UI. Returns the agent id
immediately; completion arrives as a follow-up message.

### Parallel

One call per agent, each with `run_in_background: true`. Agents run
concurrently up to the limit (default 4, `maxConcurrent` in settings) and
queue FIFO beyond it. There is no batched multi-task call; results return
inline per agent, not as files.

### Options

- `model`: `"provider/modelId"` or fuzzy name; omit to use the agent
  type's default (`general-purpose` and `Plan` inherit the parent model).
- `thinking`: `off | minimal | low | medium | high | xhigh`.
- `max_turns`: cap agentic turns; the child gets a graceful wrap-up turn.
- `inherit_context: true`: prepends a text snapshot of the parent
  conversation to the child. It is NOT a live session fork -- use it for
  "know what we discussed", not for continuing work in place.
- Agent frontmatter is authoritative: fields set in the agent file
  (`model`, `thinking`, `max_turns`, ...) lock those values; tool params
  only fill what the file leaves unspecified.

## Collecting results

```typescript
get_subagent_result({ agent_id: "..." })                  // status + final output
get_subagent_result({ agent_id: "...", wait: true })      // block until complete
get_subagent_result({ agent_id: "...", verbose: true })   // + full child conversation
```

Reading a result marks it consumed and suppresses the duplicate completion
notification. Use `verbose: true` when you need to audit how the child got
its answer, within the eviction window.

## Resume and steering

```typescript
subagent({ resume: "<agent-id>", subagent_type: "general-purpose", description: "Follow up", prompt: "..." })
steer_subagent({ agent_id: "...", message: "Focus on the parser, skip the CLI." })
```

- `resume` continues a completed agent's session with full prior context.
  It runs in the FOREGROUND: the call blocks until the resumed run finishes
  and returns its output directly. It only works while the record is still
  in memory (before the ~10-minute eviction, same pi session).
- `steer_subagent` injects a mid-run message into a RUNNING background
  agent (delivered after its current tool call). Not for completed agents.

## Inspecting

- Child transcripts persist on disk under the parent session's directory:
  `<session-dir>/<parent-session-basename>/tasks/`. After eviction, read
  the session file there with ordinary file tools.
- `/subagents:sessions` (human-facing) opens any child transcript, running
  or evicted, in pi's read-only viewer.

## Agent files and settings

Agent files (frontmatter + system prompt body) live in:

- `~/.pi/agent/agents/*.md` -- global scope
- `.pi/agents/*.md` -- project scope (wins over global on name collisions)

New/changed files are picked up per call, no restart needed. Frontmatter
fields: `description`, `display_name`, `tools` (csv of read, bash, edit,
write, grep, find, ls; `none` for no tools), `model`, `thinking`,
`max_turns`, `prompt_mode` (`append` = parent-prompt base with agent
instructions appended, the default; `replace` = body appended last with
full control), `inherit_context`, `run_in_background`, `enabled`
(`false` disables an agent). A file with a default's name replaces that
default WHOLESALE (no field merge) -- this setup overrides `Explore` that
way just to change its default model, so the file carries a full copy of
the stock config; re-check it against the package defaults after updating
@gotgenes/pi-subagents. There is no management API (create/update/disable
actions); edit the files.

Settings are layered: global `~/.pi/agent/subagents.json`, project
`.pi/subagents.json` (project overrides). Fields: `maxConcurrent`,
`defaultMaxTurns`, `graceTurns`. Edit the GLOBAL file by hand --
`/subagents:settings` persists to `.pi/subagents.json` in the project cwd,
which this setup avoids.

## Constraints

- **Children are in-process**: they die with the pi process; nothing
  survives a restart except transcript files on disk.
- **No nesting**: children never receive `subagent`/`get_subagent_result`/
  `steer_subagent`; do not ask them to orchestrate.
- **No file-based task plumbing**: no per-task output files, progress
  files, chains, or acceptance gates. Sequence multi-step work yourself:
  spawn, collect, feed the output into the next spawn (or `resume` the
  same agent when its context should carry over).
- **Advisory agents are not second decision-makers**; the parent keeps
  conversational authority.

## Troubleshooting

- "Agent not found / may have been cleaned up" -> the record was evicted
  (10 min), the session was switched, or pi restarted. Fall back to the
  on-disk transcript; spawn a fresh agent for follow-ups (paste the prior
  output into the prompt).
- "No active session to resume" -> the child's session was never persisted
  or was disposed; spawn fresh with context in the prompt.
- Unknown `subagent_type` -> falls back to `general-purpose` with a note;
  check the agent file's location and name (filename = type).
- Queued but not starting -> concurrency limit reached; raise
  `maxConcurrent` in `~/.pi/agent/subagents.json` or let the queue drain.
