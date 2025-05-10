xcode-select --install

#########
# Fixes #
#########
# Some apps add info to .profile instaed of .zprofile
touch ~/.zprofile
touch ~/.profile
echo 'source ~/.profile' >>~/.zprofile

####################
# Package Managers #
####################

# homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# python
curl -LsSf https://astral.sh/uv/install.sh | sh

source "$HOME/.cargo/env"
echo $(uv generate-shell-completion zsh) >>~/.zshrc

# # pipx
# brew install pipx
# echo 'eval "$(register-python-argcomplete pipx)"' >>~/.zshrc
#
# # poetry
# pipx install poetry
# mkdir -p ~/Library/Application\ Support/pypoetry
# ln -s $PWD/poetry/config.toml ~/Library/Application\ Support/pypoetry/config.toml

# # rye
# brew install rye
# ln -s $PWD/rye/config.toml ~/.rye/config.toml

# node
brew install npm
brew install pnpm

###################
# General Tooling #
###################

# helix tree explore
# git clone https://github.com/pinelang/helix-tree-explorer.git
# cd helix-tree-explorer
# git checkout tree_explore
#
# cargo install --path helix-term --locked
#
# mkdir -p ~/.config/helix
# cp -r $PWD/runtime ~/.config/helix/runtime
# cd ..
# ln -s $PWD/helix/config.toml ~/.config/helix/config.toml
# ln -s $PWD/helix/languages.toml ~/.config/helix/languages.toml
# hx --grammar fetch
# hx --grammar build
#
# rm -rf helix-tree-explore

# lazyvim
ln -s ~/src/local/dotfiles/nvim ~/.config/nvim
brew install nvim

# yazi
ln -s "$PWD/yazi" ~/.config/yazi
ln -s "$PWD/yazi/open-in-hx.sh" ~/bin/open-in-hx
ln -s "$PWD/yazi/yazihx.sh" ~/bin/yhx
brew install yazi

# tmux
ln -s "$PWD/tmux" ~/.config/tmux

mkdir -p ~/.config/tmux/plugins/catppuccin
git clone -b v2.1.3 https://github.com/catppuccin/tmux.git ~/.config/tmux/plugins/catppuccin/tmux

brew install tmux

########
# Apps #
########
# zed
# brew install --cask zed
# mkdir -p ~/.config/zed
# ln -s $PWD/zed/settings.json ~/.config/zed/settings.json

# iterm2
brew install --cask iterm2
cp $PWD/iterm2/com.googlecode.iterm2.plist ~/Library/Preferences/com.googlecode.iterm2.plist

# other
brew install --cask orbstack
brew install --cask librewolf --no-quarantine
brew install --cask signal
# brew install --cask whatsapp
# brew install --cask telegram
brew install --cask element
# brew install --cask bitwarden
# disabled b/c app-store version is required for browser biometrics
echo "install bitwarden from appstore"
brew install --cask mullvadvpn
brew install --cask rectangle
brew install --cask shottr
brew install --cask clop
sudo xattr -r -d com.apple.quarantine /Applications/Clop.app
brew install --cask gpg-suite
brew install --cask httpie
# brew install --cask raycast
brew install --cast appcleaner
# brew install --cask utm
# brew install --cask charmstone
# disabled b/c I already paid for app store version
echo "install charmstone from app store"
brew install --cask dropshare

############
# Commands #
############

brew install bat
brew install just
brew install sqlx-cli
brew install git
brew install httpie
brew install pandoc
brew install gh
brew install bitwarden-cli

# language servers (only needed for helix editor)
# uv tool install pyright
# uv tool install ruff
# uv tool install ruff-lsp

# difftastic
brew install difftastic
ln -s $PWD/git/.gitconfig ~/.gitconfig

# libpq (psql)
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >>~/.zshrc

##############
# zsh4humans #
##############

# we put this last since it requests that we restart the terminal mid-way
sh -c "$(curl -fsSL https://raw.githubusercontent.com/romkatv/zsh4humans/v5/install)"
