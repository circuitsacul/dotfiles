---
name: claude-subagent
description: >-
  Run Claude Code as a background subagent via the claude CLI, billed to the user's subscription.
  Use when the user asks to ask Claude, consult Claude, get a second opinion from Claude, run
  Claude in parallel, or continue a prior Claude session. Not for work you should do yourself.
---

# Claude Subagent

How to run Claude Code without blocking your work and without losing its output.

## Why
1. `claude -p` is a long-running foreground command. Run it under your shell tool with a long
   initial wait; if it outlives the wait you get a process handle to poll later. Never detach it
   (`nohup`, `setsid`, trailing `&`) -- process lifetime and cleanup belong to the harness.
2. stdout is redirected to a file because truncated terminal output is unrecoverable here, and
   Claude's full response must stay available. Reading the file costs the same as reading stdout
   would, and the file survives for later rounds and follow-ups.
3. Claude has the same filesystem read access you do. Prompts only need context that exists
   solely in this session; Claude reads the repo and files itself.

## Usage
1. Pick a fresh, uniquely-named output file under `/tmp`, e.g.
   `OUT=$(mktemp /tmp/claude-XXXXXX.out)`. Unique names keep parallel calls from clobbering
   each other. (The sandbox grants writes only under `/tmp` and Claude's own state directories.)

2. From the workspace root (do not `cd` -- Claude sessions are scoped to the invocation cwd), run:

   ```
   CLAUDE_CONFIG_DIR="$HOME/.claude" \
   claude -p --output-format json --permission-mode bypassPermissions \
     --append-system-prompt 'You are a subagent driven by another agent through the CLI. Your output is consumed by that agent, not shown directly to a human. Answer directly and completely, without asking clarifying questions. Do not modify any files unless your prompt explicitly asks for file changes.' \
     > "$OUT" 2> "$OUT.err" <<'CLAUDE_PROMPT'
   ...the prompt...
   CLAUDE_PROMPT
   ```

   Add `--model <model>` only when the user asks for a specific model. The prompt can also be
   composed with a pipeline instead of a heredoc, e.g. splicing in an earlier response with
   `jq -r .result earlier.out`.

3. Poll the process handle until it exits; do other work or wait in between. On a nonzero exit,
   read `$OUT.err`.

4. The output file is a single JSON object:
   - `jq -r .session_id "$OUT"` -- the handle for continuing this session.
   - `jq -r .result "$OUT"` -- Claude's answer; read it only when you need the content (check
     `.is_error` first).

5. To continue a session, repeat from step 1 with a new output file, adding `--resume <session-id>`
   to the command in step 2, from the same cwd.

## Notes
- Track the `(output file, session_id)` pair for each call: the file holds that call's answer,
  and the session_id is how you reply to it.
- Keep the model consistent across one session unless the user asks otherwise.
- The `--permission-mode bypassPermissions` is deliberate: headless Claude cannot answer
  permission prompts, and the sandbox already bounds what it can touch. The appended system
  prompt tells it not to edit files.
- `CLAUDE_CONFIG_DIR` keeps Claude's top-level config inside `~/.claude`; without it, Claude
  writes `~/.claude.json`, which the sandbox cannot grant (directory grants only).
- For a very large deliverable (a long plan, report, or review), you may additionally ask Claude
  in the prompt to write it to a specific `/tmp` path as clean text. That is a prompt-level
  choice for that call; the redirect above stays the transport either way.
