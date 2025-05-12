#!/usr/bin/env bash

set -euo pipefail

target=":tree"
window="tree"

session=$(tmux display-message -p '#S')

if ! tmux list-windows -t "$session" | grep -q "$window"; then
  proj=$(realpath "${1:-.}") # project root (arg or CWD)

  tmux new-window -t "$session" -n tree "cd \"$proj\"; yazi"

  sleep 0.1;
fi

tmux select-window -t "$target"

