# dotfiles

personal dotfiles

`~/.config/chezmoi/chezmoi.toml`:
```toml
[data]
profile = "..."
platform = "linux"
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
