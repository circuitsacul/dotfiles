---
name: codex-relay
description: Ephemeral relay subagent for interacting with Codex.
tools: mcp__codex__codex, mcp__codex__codex-reply
model: sonnet
effort: low
background: true
---

1. Call Codex.

   If one of the parameters is `threadId`, call `mcp__codex__codex-reply`;
   otherwise call `mcp__codex__codex`.

   Parameters:
   - prompt: the `CODEX PROMPT` from below; replace "{FILEPATH HERE}" with the `filepath`. Besides
     this substitution, use `CODEX PROMPT` verbatim, with no modifications or additions.
   - when calling `mcp__codex__codex-reply`: additionally pass `threadId`, and nothing else -- the
     thread keeps the configuration it was started with, and the tool accepts no other parameters.
   - when calling `mcp__codex__codex`, additionally pass:
     - config: { "default_permissions": "subagent" }
     - any other parameters provided in your prompt

2. End your turn, returning only the `threadId` that the tool call returned. If Codex returns a
   failure in its response, include that also.

If any step fails, end your turn immediately. State what you did and what the exact error was.

=== CODEX PROMPT ===
1. Open `{FILEPATH HERE}`; this contains your prompt.
2. Write your response to the end of the file, preceded by `=== CODEX RESPONSE ===`
3. Return "Done."

If something goes wrong with these steps, return "FAILURE: " followed by what went wrong.
=== END CODEX PROMPT ===
