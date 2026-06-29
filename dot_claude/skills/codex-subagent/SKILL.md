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
   - `threadId: <thread id>` (only when continuing a previous Codex thread -- see steb 6)
   - you may also provide other tool-call overrides, such as `model`

4. The relay runs in the background, and claude-code will wake you when it finishes. Either end
   your turn, or continue parallel work while waiting. When the relay finishes, it will return
   a `threadId`.

5. To read Codex's answer, read back the file from step 2, using an offset = N, where N is the last
   line you wrote. If the `=== CODEX RESPONSE ===` marker is not present, you may not have the full
   output -- re-read the full file in this case.

6. To continue the thread, repeat from step 1 with a new file, passing the `threadId` the relay
   returned.

## Notes
- Track the `(filepath, threadId)` pair for each call: the filepath holds that call's answer, and
  the threadId is how you reply to it.
- Defaults (model, reasoning effort, permission profile) live in Codex config and the `codex-relay`
  definition. Pass overrides only when you need to deviate.
