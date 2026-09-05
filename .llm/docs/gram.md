# Gram: Colemak-DH + Helix

Configuration for Gram 3.3.0, using its native `helix_mode` on the `Minimal`
base keymap. This is independent of the old Zed configuration. It does not
change Helix, the normal Yazi/Lazygit configs, or the `yhx` tmux workflow.

## Install and apply

Install [Gram](https://gram-editor.com/), including its `gram` CLI on `PATH`.
The external tools additionally need Bash, Yazi and Lazygit on `PATH`.
The inherited Lazygit diff renderer still expects `difft`.

```sh
chezmoi apply ~/.config/gram ~/bin/gram-tool
gram /path/to/project
```

As with the other GUI apps, `agentbox*` profiles exclude Gram and its helper.
There is no auto-install script and no change to your global `EDITOR`.
The helper targets local projects, not remote/SSH workspaces or Flatpak sandbox
integration. `~/.config/gram` is the normal configuration location; on Linux,
`XDG_CONFIG_HOME` is respected.

## Design

- Bind the letters produced by Colemak-DH, not their QWERTY key positions.
  No `use_key_equivalents` remapping is applied.
- `n/e/i/o` mean left/down/up/right in modal editors and native panel lists.
  Queries, rename fields, completions and terminal applications keep typed text.
- In pickers/menus/completions, **Alt-E / Alt-I** move down/up. Enter confirms,
  Escape cancels. Left/Right move through nested menus; Alt-N/O are reserved for
  tabs. Ctrl-A selects input text without stealing Helix's increment operation
  in the full editor.
- Space is a leader in normal/select mode only. Pause after a prefix for
  which-key help. F1 or Ctrl-Shift-P opens the command palette from anywhere,
  including an empty workspace. Every operation remains available there.
- The main-file settings mirror Helix: Catppuccin Mocha, relative numbers,
  soft wrap, a guide at 100 columns, no indent guides, and modal cursors.
  Plain `y/p` use Gram's internal Vim register; `Space y/p` use the system clipboard.

## Editing

Uppercase below means Shift plus the letter. Unlisted bindings remain Gram's
native Helix bindings (for example `w/b`, `v`, `x`, `s`, `d/c`, `y/p`, `u/U`,
`f/t`, and `m i` / `m a` text objects). Find/replace target characters and text
object keys are deliberately **not** remapped.

| Keys | Operation |
| --- | --- |
| `n e i o` | Left, down, up, right; extends in select mode |
| `h` / `H` | Insert at selection start / first non-whitespace |
| `l` / `L` | Open line below / above |
| `k` / `K` | Next word / WORD end |
| `j` / `J` | Next / previous search match |
| `E` | Join lines |
| `N` / `O` | Previous / next tab (modal aliases for global Alt-N/O) |
| `g g` / `g G` | First / last line |
| `g n` / `g o` | Line start / end |
| `g e` / `g i` | Logical line down / up (ordinary e/i follow soft wraps) |
| `g d` / `g D` / `g y` / `g I` / `g r` | Definition / declaration / type / implementation / references |
| `/` / `?` | Buffer search forward / backward |
| `z e` / `z i` | Scroll one line down / up |
| `z z` / `z t` / `z b` | Center cursor / scroll cursor to top / bottom |
| `z a` / `z f` / `z o` / `z O` | Toggle fold / fold selection / unfold / unfold all |
| `Alt-X` / `Escape` | Leave insert mode |
| `Ctrl-S` / `Ctrl-Shift-S` | Save / save all (not intercepted in terminals) |
| `Ctrl-O` / `Ctrl-I` | Native jump back / forward |

## Leader and workspace navigation

| Keys | Operation |
| --- | --- |
| `Space Space` | Command palette |
| `Space f` / `Space b` | File finder / open-tab picker |
| `Space s` / `Space S` | File / project symbols |
| `Space /` | Project search |
| `Space a` / `Space r` / `Space k` | Code actions / rename / hover |
| `Space d` / `Space D` | Current-file / project diagnostics |
| `Space c` / `Space h` | Toggle comment / select all matches |
| `Space e` / `Space l` | Start/restart Yazi / Lazygit |
| `Space E` / `Space L` | Focus native project / Git panel |
| `Space o` | Focus outline panel |
| `Space t` / `Space T` | Focus terminal dock (create a shell if empty) / task picker |
| `Space q` | Close active tab, prompting for unsaved changes |
| `Space ,` / `Space ?` | Settings file / keymap file |
| `Space w n/e/i/o` | Focus left/down/up/right pane |
| `Space w s` / `Space w v` | Split below / right (horizontal / vertical dividing line) |
| `Space w q` / `Space w z` / `Space w =` | Close tab / zoom pane / equalize panes |

`Ctrl-W` followed by the same window keys is an alias for `Space w` in modal
editors; in terminals it stays with the shell/TUI. Closing a tab is not the
same as closing every tab in a split.

**Available in insert mode and terminals too:**

- `Alt-N/O`: previous/next tab in the focused pane, without entering normal mode.
  In Lazygit this cycles main-area tabs; in the bottom dock it cycles dock tabs.
  Dismiss modal popups such as the command palette/file finder first; their
  inputs are outside the pane's tab-action handlers. Inline search fields work.
- `Shift-Alt-n/e/i/o`: focus left/down/up/right, including from text fields and
  terminals. This replaces the old `Cmd-n/e/i/o`; `Ctrl-Alt-n/e/i/o` remain aliases.
- `Ctrl-Alt-F`: from dock terminals, return to the last center pane; outside
  terminals, choose the first center pane. From a center terminal, this focuses
  the dock instead, so use tab navigation to return to a file. Escape a modal first.
- `Ctrl-T`: show/focus the bottom dock when hidden; hide it when visible,
  preserving its tabs and running processes. Unlike the focus toggle below,
  this hides the dock even when an editor is focused. It replaces shell/TUI
  Ctrl-T handling and the inherited insert-mode indentation shortcut.
- `Ctrl-Alt-T`: toggle focus between the terminal dock and the last center pane,
  preserving the process and its state.
- `Ctrl-Alt-Z`: zoom/unzoom the focused pane or panel.
- `Ctrl-Alt-P`: file finder. `Ctrl-Shift-O`: open a file/directory (outside terminals).
- In terminals, `Ctrl-Alt-[` / `Ctrl-Alt-]`: previous / next tab in that pane,
  including file tabs when the terminal is in the center.
- In terminals, `Cmd-T`: create and focus a new shell tab in the bottom dock.
  This also works from Yazi or Lazygit; it does not replace their processes.
  `Space t` resumes the dock's selected tab, even if that tab is a TUI rather
  than a shell. Gram only auto-creates a shell when the dock has no terminals.
  Cmd means Super on Linux and Command on macOS.

Gram handles these navigation chords before the embedded shell/TUI. They are
not passed to applications running inside Gram's terminals. Standalone Helix
and Zellij are unchanged. `Cmd-Shift-N/O` are left for system desktop switching.

In native panels use `n/e/i/o` and Enter to open. In the project/Git lists,
`q` closes the panel, while Escape switches away without closing it (and keeps
its normal cancel behavior during renames/commit editing). In the outline panel
(`Space o`), Escape closes the panel from either its filter field or its list;
`q` in the list still just switches away.

In project search (`Space /`), `Ctrl-q` closes the search tab while the query,
replacement, or filter field is focused. Escape retains its native search
behavior. From the search results, use `Space w q` as usual.

In the native Git panel, `Ctrl-q` closes the panel from both the changes list
and the commit editor, without submitting or clearing the commit draft.

The project panel has `a/A` for new file/directory, `r` for rename, and `d/D`
for trash/permanent deletion, **with confirmation**. In the Git changes list,
`x` stages/unstages, `X` stages all, and `Alt-Shift-x` unstages all.

## Yazi and Lazygit

Yazi opens in the bottom dock; Lazygit opens as an ordinary main-area tab, not
an editor/terminal split. Opening a file with Lazygit's `h/H` switches to the
file while Lazygit stays running in its own tab. Return via `Space b` and select
`Gram: lazygit`, or use `Alt-N/O` from either the editor or Lazygit. Existing
splits/docks are not rearranged; `Ctrl-Alt-Z` can zoom the pane if needed.

**Start/restart is not resume.** `Space e/l` launch tasks with a reusable tab.
Invoking one again replaces that tool's running terminal; do not use these keys
while a Git operation or unsaved TUI prompt is running. Resume Yazi with
`Ctrl-Alt-T` and Lazygit via its center tab. This avoids a queue of deferred task
launches. Tool tasks never save buffers automatically: save explicitly before
reviewing/staging disk changes.

When upgrading from the dock-based Lazygit task, quit/close its old terminal
before launching it again: Gram reuses an existing task's location even after
`reveal_target` changes.

Yazi starts at the current saved file, falling back to the worktree root. It is
used as a chooser: select files with its normal selection keys and press Enter
(or O) to open them together in Gram and exit. `o` enters directories; it is not
file confirmation. `q` or `E` cancels. Directories in a multi-selection are
ignored. The chooser is private and removed after exit, including failures.
Yazi's newline-delimited chooser format cannot represent filenames containing
literal newlines.

Lazygit retains your Colemak navigation, `h/H` edit/open, diff renderer and WIP
command. Ordinary edits/open operations return immediately and focus the file
in Gram. Wait-required operations (commit/rebase editors, `editAtLineAndWait`)
use `gram --wait`: **save and close the opened tab** to let Git continue.
Do not restart the Lazygit task while it is waiting for an editor.
The worktree directory's open-in-editor action uses Gram's normal directory
routing as well, rather than Lazygit's fallback editor.

`lazygit.yml.tmpl` and `yazi/keymap.toml.tmpl` derive the shared bindings at
chezmoi render time, removing the YHX switch commands. Re-apply Gram after
changing the main Yazi/Lazygit configs. The ordinary copies remain unchanged.
Only the Gram subprocess gets the isolated Yazi config and waiting Git editor.
Lazygit is passed one complete derived config, not an overlay: its overlay
merge appends custom commands and would otherwise leave the tmux shims active.

Gram's CLI routes files by project/workspace matching, not the terminal that
launched it. In ordinary single-window use, files return to that window;
with several overlapping projects/windows, Gram may choose a different one.
There is no originating-window CLI selector. The helper deliberately avoids
`--new` (creates a window) and `--reuse` (replaces a workspace).

## Deliberate limits and differences

Gram's [Helix mode](https://gram-editor.com/docs/helix/) is still incomplete.
This config does not fake unsupported commands:

- Helix's keep/remove selections by regex and join-and-select-space are not
  implemented. `I` is left unbound; `Shift-Alt-I/E` now navigate panes.
- `Alt-N/O` are reserved for tabs, replacing Helix's select-next/select-larger
  syntax-node bindings. Those editor actions remain available in the command
  palette. Nested menus use their native Left/Right rather than Alt-N/O.
- No sticky uppercase `Z` scroll submode is emulated with synthetic keys.
- The inherited `z ^` / `z +` macros are disabled because they replay H/L,
  which now enter insert mode. `Z Q` (discard and close), `Z Z`, and inherited
  Ctrl-W bulk-close variants are disabled explicitly by full sequence.
- Gram still supplies other Vim-derived aliases. Nulling a prefix does not
  remove its child sequences. Which-key can display overridden defaults along
  with custom bindings; the keymap file is the reference for these overrides.
- Split directions correct Gram's reversed Helix Space-W S/V defaults.
  Space-E/L uppercase chooses native panels rather than another external-tool
  starting directory. Direct TUI-to-TUI nesting is replaced by tab/dock navigation.

## Validation

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .llm/tests -v
bash -n bin/executable_gram-tool
```

Tests require Python 3.11+ and chezmoi, not Gram or running TUIs. They check JSONC,
shared-config derivation, task references, pane aliases, deployment profiles,
argument quoting, line/wait callbacks, chooser cancellation and cleanup using
stub executables. GUI checks should additionally cover real pickers, panels,
terminal focus, file opens and task reruns after upgrading Gram. Use `dev: open
key context view` from the command palette when diagnosing key dispatch.
