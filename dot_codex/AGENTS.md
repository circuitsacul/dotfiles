# claude subagent

If the user asks you to interact with claude, use the `claude-subagent` skill first.

# sandboxing

Never pass `-s`/`--sandbox` flags to codex commands; permission profiles (`default_permissions`,
`[permissions.<name>]`) govern the sandbox, and the old-style flags silently switch that system
off.
