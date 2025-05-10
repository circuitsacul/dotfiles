#!/usr/bin/env bash
# ~/.config/yazi/open-in-hx.sh
#
#  ─ Arguments ──────────────────────────────────────────────────────────────
#    0..n file paths. If none are given we read newline‑separated paths
#    from stdin.  Yazi exports $YAZI_FILES that way when you use %f.
#
#  ─ Behaviour ──────────────────────────────────────────────────────────────
#    • For each path     → send  :open "<file>"  to the Helix window
#    • After queuing all → flip tmux view to that window
#
#  ─ Requirements ───────────────────────────────────────────────────────────
#    • tmux session already running, window named “edit”
#    • Helix in Normal mode (first Escape guarantees it)

set -euo pipefail

target=":edit" # window 'edit' in *current* session
files=("$@")

# Collect paths
# if [[ $# -gt 0 ]]; then
#   files=("$@")
# else
#   # read from stdin into the array (handles $YAZI_FILES)
#   while IFS= read -r line; do
#     [[ -n $line ]] && files+=("$line")
#   done
# fi

[[ ${#files[@]} -eq 0 ]] && exit 0 # nothing to open

# Bring Helix window to the foreground
tmux select-window -t "$target"

# Push :open commands into Helix
for f in "${files[@]}"; do
  tmux send-keys -t "$target" Escape
  tmux send-keys -t "$target" ":open \"$f\"" Enter
done
