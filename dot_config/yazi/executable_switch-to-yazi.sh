#!/usr/bin/env bash

set -euo pipefail

window="tree"
session=$(tmux display-message -p '#S')

if ! tmux list-windows -t "$session" | grep -q "$window"; then
  proj=$(tmux show-option -t "$session" -v @project_root)
  focus=$(realpath "${1:-.}")
  tmux new-window -t "$session" -n tree "cd \"$proj\"; yazi \"$focus\""
fi

tmux select-window -t ":$window"

