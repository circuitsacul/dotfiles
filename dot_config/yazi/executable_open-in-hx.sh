#!/usr/bin/env bash

set -euo pipefail

# --line=N must be first (if present)
line=""
if [[ ${1:-} == --line=* ]]; then
  line="${1#--line=}"
  shift
fi

files=("$@")

window="edit"
session=$(tmux display-message -p '#S')

# Check if the edit window was closed
if ! tmux list-windows -t "$session" | grep -q "$window"; then
  proj=$(tmux show-option -t "$session" -v @project_root)

  tmux new-window -t "$session" -n "$window" "cd \"$proj\"; hx ."

  sleep 0.1
fi

# Bring Helix window to the foreground
tmux select-window -t ":$window"

if [ ${#files[@]} -gt 0 ]; then
  # Push :open commands into Helix
  tmux send-keys -t ":$window" Escape
  tmux send-keys -t ":$window" ":open ${files[*]}" Enter

  # goto line number
  if [[ -n $line ]]; then
    tmux send-keys -t ":$window" ":goto ${line}" Enter
  fi
fi
