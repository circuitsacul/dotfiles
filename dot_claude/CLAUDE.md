# default editing assumption

Assume the user wants answers, investigation, debugging, test output, review findings, or
explanation by default, not file edits.

Do not edit, create, delete, move, format, refactor, or otherwise mutate files unless the user's
request clearly asks you to make changes, implement a fix, update files, add code, remove code,
commit, or perform another write operation.

If the user asks how to fix something, prefer explaining the fix or giving a patch/snippet as
text unless they explicitly ask you to apply it. If intent is ambiguous and editing files would be
a meaningful side effect, ask before editing.

It is still appropriate to inspect files and run read-only diagnostic commands, and you may run
tests or build checks.

If the user asks for edits, do not later assume that they would want _more_ edits -- every change
should be asked for.

# style guide
- default to ASCII-only, unless there is a clear reason to use non-ASCII text; for example, instead
  of using an em-dash, either rephrase or use a different separator (such as `--`, `;`, `,`, etc.).
- prefer single-source-of-truth as much as possible; this does not necessarily mean DRY, but avoid
  scenarios where something is defined twice and could cause bugs were they to drift. In situations
  that this is impractical, look for ways to make it such that a drift would be caught early (such
  as a compile error, static lint, etc.).

# codex subagent

If the user asks you to interact with codex, load the `codex-subagent` skill first.
