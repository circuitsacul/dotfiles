#!/usr/bin/env bash

set -euo pipefail

files=("$@")

window="edit"
session=$(tmux display-message -p '#S')

# Check if the edit window was closed
if ! tmux list-windows -t "$session" | grep -q "$window"; then
  proj=$(realpath "${1:-.}") # project root (arg or CWD)

  tmux new-window -t "$session" -n "$window" "cd \"$proj\"; hx ."

  sleep 0.1;
fi

# Bring Helix window to the foreground
tmux select-window -t ":$window"

if [ ${#files[@]} -gt 0 ]; then
  # Push :open commands into Helix
  tmux send-keys -t ":$window" Escape
  tmux send-keys -t ":$window" ":open ${files[*]}" Enter
fi
