# dotfiles

personal dotfiles

`~/.config/chezmoi/chezmoi.toml`:
```toml
[data]
profile = "..."
platform = "linux"
timezone = "America/New_York"  # optional; defaults to "Etc/UTC"
hunk_radicle = "/home/you/dev/hunk-radicle"  # optional
litellm_master_key = "sk-litellm-secret"
fireworks_api_key = "fw-..."

[data.git]
name = "Your Name"
email = "you@example.com"
gpgsign = true
defaultBranch = "master"

# optional
[data.notebook]
moxide = "/home/you/notebook/moxide"
root = "/home/you/notebook/moxide"
```
