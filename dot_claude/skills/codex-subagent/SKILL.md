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
2. Then, spawn a new Sonnet subagent. If you're replying to a previous codex thread, use the prompt
   template from `reply-relay-prompt.md`, otherwise `start-relay-prompt.md`.
3. The relay subagent will run in the background; you can either continue work or stop and wait for
   it to finish.
4. When the relay finishes, it will return a file pointer to codex's verbatim response, as well as
   the thread ID.
5. Replying to a codex thread should follow the same steps, starting from 1, using the returned
   thread ID.
