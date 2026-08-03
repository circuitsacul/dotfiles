Delegate work to subagents or manage agent definitions.

ENVIRONMENT (pre-verified): `delegate` is the only enabled agent, and it is
confirmed executable/non-disabled. The safety bullet below about calling
{ action: "list" } before execution is therefore already satisfied -- launch
`delegate` directly, do NOT call { action: "list" } first. Use list only to
debug an "Unknown agent" error or to look for custom agents/chains.

House rules (details in the `subagents` skill): always pass async:true, then
END YOUR TURN -- even when your answer depends on the child result; pi wakes
you on completion and the user can keep interacting meanwhile. Call the wait
tool only in non-interactive runs (`pi -p`) or skills that must complete in
one turn, where ending the turn would abandon the children. Give `delegate` a
role-specific prompt (reviewer, scout, researcher, planner, worker) instead
of expecting a role agent; one writer per cwd/worktree; resolve loose model
names with `pi --list-models` via bash first.

EXECUTION (use exactly ONE mode; omit action):
• SINGLE: { agent: "delegate", task, async: true }
• PARALLEL: { tasks: [{agent:"delegate", task, count?, output?, reads?, progress?}, ...], concurrency?, worktree?, async: true }
• CHAIN: { chain: [{agent:"delegate", task}, {parallel:[...]}], async: true }
• context: "fresh" (delegate default) or "fork" (branched thread inheriting parent history)
• timeoutMs / maxRuntimeMs cap runtime; turnBudget { maxTurns, graceTurns } and toolBudget { soft?, hard, block? } soft-cap children
• Chain templates: {task}, {previous}, {chain_dir}, {outputs.name} (via as:"name" on a step)
• acceptance: { level: "none", reason: "..." } when the parent reviews output directly; omit for unattended runs

CONTROL (action field, no execution fields):
• { action: "status", id?, view?: "fleet" | "transcript", index?, lines? } - inspect runs
• { action: "interrupt", id? } - soft-interrupt; leaves the run paused
• { action: "resume", id, message, index? } - follow up with a live child or revive a completed one
• { action: "steer", id, message, index? } - queue non-terminal guidance for a live child

MANAGEMENT (rarely needed):
• get, create, update, delete, eject, disable, enable, reset - agent definition management
• { action: "models" } - builtin model mapping only; the full catalog is `pi --list-models` via bash
• { action: "list" } - troubleshooting/custom-agent discovery only, never a pre-launch step
• { action: "doctor" } - read-only setup/discovery/intercom diagnostics
