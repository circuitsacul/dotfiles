---
name: codex-subagent
description: >-
  Route explicit requests to use Codex as a background verifier, reviewer, second opinion, or
  continuation thread through the Codex MCP relay workflow. Use when the user asks to ask Codex,
  consult Codex, run Codex in parallel, continue a prior Codex thread, or avoid blocking the main
  Claude Code session while Codex works.
argument-hint: "[prompt or thread-id + prompt]"
---

# Codex Subagent
These instructions explain how to use codex as a subagent.

## Key Details
1. claude-code subagents (both new and forks) run _asynchronously_, meaning that they do not block
   the primary session while running.
2. by contrast, the codex MCP tool _does_ block the primary session. Because of this, all calls
   into codex should pass through a relay subagent.

## Usage
1. First, formulate the prompt you want to give to codex. Remember that codex has _equal_ access to
   the filesystem as you. Only include in the prompt what codex _can't_ get on its own (i.e.,
   context only present in the claude-code session.)
2. Then, spawn a new Sonnet subagent. Use the correct prompt template (
   `## reply-relay-prompt-template` to reply to a prevous codex thread,
   `## start-relay-prompt-template` to start a new codex thread.)
3. The relay subagent will run in the background; you can either continue work or stop and wait for
   it to finish.
4. When the relay finishes, it will return a file pointer to codex's verbatim response, as well as
   the thread ID.
5. Replying to a codex thread should follow the same steps, starting from 1, using the returned
   thread ID.

## reply-relay-prompt-template
Use this prompt template as the prompt to a new relay agent when you want to reply to a previous
codex thread.

template variables:
- {thread-id}: the thread ID of the codex thread you're replying to
- {prompt}: the exact prompt you want sent to codex
- {output-file}: the exact filepath you want codex's answer to be put in. Choose a unique filepath
                 per call, to prevent different calls from clobbering each other.

=== PROMPT TEMPLATE START ===
You are a relay subagent. Your only job is to call the codex MCP tool with the prompt I give you,
wait for codex to finish, write codex's reply and thread ID to a file, and return the filepath
and thread ID.

=== CODEX PROMPT START ===
{prompt}
=== CODEX PROMPT END ===

Steps:

1. Load the codex MCP tool: ToolSearch query "select:mcp__codex__codex-reply"

2. Call codex: `mcp__codex__codex-reply` with
   - `threadId`: "{thread-id}"
   - `prompt`: the exact CODEX PROMPT from above

3. When codex responds, capture its full output, as well as the returned top-level `threadId`.

4. Using the `Write` tool;
   at this filepath: `{output-file}`;
   write these exact contents:
      line 1: the returned top-level `threadId` (format: `threadId: <thread ID>`)
      line 2: blank
      line 3: codex's full, verbatim, non-summarized output

   Do not put anything else in the file.

5. Return the filepath that you wrote to, the top-level `threadId`, and a short note. Never include
   _any_ part of codex's response, or any summary of it, in your response.

Note: if at any point a step fails, return what you did and the exact error, and stop.
=== PROMPT TEMPLATE END ===

## start-relay-prompt-template
Use this prompt template as the prompt to a new relay agent when you want to start a new codex
thread.

template variables:
- {model}: the codex model to use (e.g. `gpt-5.5` or `gpt-5.3-codex-spark` -- default to `gpt-5.5`)
- {effort}: the effort the codex model should use (e.g. `high` or `xhigh` -- default to `high`)
- {sandbox}: the sandbox mode to use (e.g. `read-only` or `workspace-write` -- default to `read-only`)
- {prompt}: the exact prompt you want sent to codex
- {output-file}: the exact filepath you want codex's answer to be put in. Choose a unique filepath
                 per call, to prevent different calls from clobbering each other.

=== PROMPT TEMPLATE START ===
You are a relay subagent. Your only job is to call the codex MCP tool with the prompt I give you,
wait for codex to finish, write codex's reply and thread ID to a file, and return the filepath
and thread ID.

=== CODEX PROMPT START ===
{prompt}
=== CODEX PROMPT END ===

Steps:

1. Load the codex MCP tool: ToolSearch query "select:mcp__codex__codex"

2. Call codex: `mcp__codex__codex` with
   - prompt: the exact CODEX PROMPT from above
   - model: "{model}"
   - config: { "model_reasoning_effort": "{effort}" }
   - approval-policy: "on-request"
   - sandbox: "{sandbox}"

3. When codex responds, capture its full output, as well as the returned top-level `threadId`.

4. Using the `Write` tool;
   at this filepath: `{output-file}`;
   write these exact contents:
      line 1: the returned top-level `threadId` (format: `threadId: <thread ID>`)
      line 2: blank
      line 3: codex's full, verbatim, non-summarized output

   Do not put anything else in the file.

5. Return the filepath that you wrote to, the top-level `threadId`, and a short note. Never include
   _any_ part of codex's response, or any summary of it, in your response.

Note: if at any point a step fails, return what you did and the exact error, and stop.
=== PROMPT TEMPLATE END ===
