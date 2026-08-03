---
name: codex-subagent
description: >-
  Route explicit requests to use Codex as a background verifier, reviewer, second opinion, or
  continuation thread through the Codex MCP relay workflow. Use when the user asks to ask Codex,
  consult Codex, run Codex in parallel, continue a prior Codex thread, or avoid blocking the main
  Claude Code session while Codex works.
argument-hint: "[prompt, or thread-id + prompt]"
---

# Codex Subagent

How to run Codex without blocking this session, and without paying for Codex's prompt or response
in this session's token budget.

## Why
1. claude-code subagents run asynchronously -- they do not block this session.
2. the Codex MCP tool blocks its caller, so Codex is always called through the `codex-relay`
   subagent, which backgrounds it.
3. Codex has the same filesystem access you do. The relay passes Codex its prompt via a file and
   has Codex write its response back to that same file. So neither the prompt nor the response
   passes through the relay -- it only ever sees a filepath and a thread ID.

## Usage
1. Formulate the prompt for Codex. Include only what Codex cannot get on its own (context that
   exists only in this session); it can read the repo and files itself.

2. Write that prompt to a fresh, uniquely-named file under `/tmp` (e.g. your session scratchpad
   directory). It MUST be under `/tmp`: Codex writes its response into this file, and its
   permission profile only grants write access to `/tmp`. Use a new filename for every call so
   calls never clobber each other.

3. Spawn the `codex-relay` subagent (Agent tool, `subagent_type: codex-relay`). The codex-relay
   subagent expects a prompt where each line is `parameter: value`. Pass these parameters:
   - `filepath: absolute path to the file from step 2`
   - `threadId: <thread id>` (only when continuing a previous Codex thread -- see step 6)
   - optionally, tool-call overrides from the "Tool-call parameters" section below (new threads
     only -- continuations keep the configuration the thread was started with)

4. The relay runs in the background, and claude-code will wake you when it finishes. Either end
   your turn, or continue parallel work while waiting. When the relay finishes, it will return
   a `threadId`.

5. To read Codex's answer, read back the file from step 2, using an offset = N, where N is the last
   line you wrote. If the `=== CODEX RESPONSE ===` marker is not present, you may not have the full
   output -- re-read the full file in this case.

6. To continue the thread, repeat from step 1 with a new file, passing the `threadId` the relay
   returned.

## Tool-call parameters

The relay forwards every `parameter: value` line other than `filepath` and `threadId` verbatim
onto the `mcp__codex__codex` tool call. That tool rejects unknown keys, so use these exact names;
do not invent shorthands (e.g. there is no top-level `effort` parameter):

- `model`: model name override, e.g. `gpt-5.2` or `gpt-5.2-codex`.
- `sandbox`: `read-only`, `workspace-write`, or `danger-full-access`.
- `approval-policy`: approval policy for shell commands: `untrusted`, `on-request`, or `never`.
- `cwd`: working directory for the session.
- `base-instructions`: replaces Codex's default base instructions.
- `developer-instructions`: injected as a developer-role message.
- `compact-prompt`: prompt used when Codex compacts its conversation.
- `config`: JSON object of `config.toml` overrides -- any setting without a dedicated parameter
  above goes here. Most common: reasoning effort, e.g.
  `config: { "default_permissions": "subagent", "model_reasoning_effort": "xhigh" }`
  (effort values: `low`, `medium`, `high`, `xhigh`).

The relay adds `config: { "default_permissions": "subagent" }` to every new-thread call on its
own. If you pass your own `config`, include `"default_permissions": "subagent"` in it so the
result does not depend on how the relay merges the two objects.

This list mirrors the `mcp__codex__codex` tool schema and the `codex-relay` definition
(`~/.claude/agents/codex-relay.md`); those remain the source of truth. If a call fails parameter
validation, this list has drifted -- re-check the schema (ToolSearch `select:mcp__codex__codex`)
and the relay definition instead of guessing.

## Notes
- Track the `(filepath, threadId)` pair for each call: the filepath holds that call's answer, and
  the threadId is how you reply to it.
- Defaults (model, reasoning effort, permission profile) live in Codex config and the `codex-relay`
  definition. Pass overrides only when you need to deviate.
