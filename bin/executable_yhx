#!/usr/bin/env bash

proj=$(realpath "${1:-.}") # project root (arg or CWD)
sess=$(echo "$proj" | tr -c '[:alnum:]' '_' | tr -s '_')

if tmux has-session -t="$sess" 2>/dev/null; then
  tmux attach -t "$sess"
else
  # create session (detached)
  tmux new-session -s "$sess" -n tree -d "cd \"$proj\"; yazi"

  # set the project path (assume we started in root) so other apps can be
  # opened with the current root (e.g. lazygit and helix)
  tmux set-option -t "$sess" @project_root "$proj"

  # start on the Yazi window
  tmux select-window -t "$sess:tree"
  tmux attach -t "$sess"
fi
