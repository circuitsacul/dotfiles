#!/usr/bin/env bash

set -euo pipefail

window="lazygit"
session=$(tmux display-message -p '#S')

# Check if the edit window was closed
if ! tmux list-windows -t "$session" | grep -q "$window"; then
  proj=$(realpath "${1:-.}") # project root (arg or CWD)

  tmux new-window -t "$session" -n "$window" "cd \"$proj\"; lazygit"
fi

tmux select-window -t ":$window"
