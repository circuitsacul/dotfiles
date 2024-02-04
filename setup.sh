xcode-select --install

####################
# Package Managers #
####################

# homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# pipx
brew install pipx

# poetry
pipx install poetry
mkdir -p ~/Library/Application\ Support/pypoetry
ln -s $PWD/poetry/config.toml ~/Library/Application\ Support/pypoetry/config.toml

###################
# General Tooling #
###################

# helix
git clone https://github.com/pinelang/helix-tree-explorer.git
cd helix-tree-explorer
git checkout tree_explore

cargo install --path helix-term --locked

mkdir -p ~/.config/helix
cp -r $PWD/runtime ~/.config/helix/runtime
cd ..
ln -s $PWD/helix/config.toml ~/.config/helix/config.toml
ln -s $PWD/helix/languages.toml ~/.config/helix/languages.toml
hx --grammar fetch
hx --grammar build

rm -rf helix-tree-explore

######################################
# Language Servers & Related Tooling #
######################################
# NOTE: these are only used by helix
#       zed downloads its own language servers

# python language servers
pipx install pyright  # and pyright-langserver
pipx install ruff-lsp

pipx install ruff

########
# Apps #
########
# zed
brew install --cask zed
mkdir -p ~/.config/zed
ln -s $PWD/zed/settings.json ~/.config/zed/settings.json

# iterm2
brew install --cask iterm2
cp $PWD/iterm2/com.googlecode.iterm2.plist ~/Library/Preferences/com.googlecode.iterm2.plist

# warp
brew install --cask warp

# other
brew install --cask orbstack
brew install --cask arc
brew install --cask signal
brew install --cask enpass
brew install --cask mullvadvpn
brew install --cask rectangle
brew install --cask shottr
brew install --cask clop
sudo xattr -r -d com.apple.quarantine /Applications/Clop.app
brew install --cask gpg-suite
brew install --cask httpie
brew install --cask raycast
# there's new brew formula for charmstone
echo "install charmstone!"

############
# Commands #
############

brew install bat
brew install just
brew install sqlx-cli
brew install git
brew install httpie
brew install pandoc

# difftastic
brew install difftastic
ln -s $PWD/git/.gitconfig ~/.gitconfig

##############
# zsh4humans #
##############

# we put this last since it requests that we restart the terminal mid-way
sh -c "$(curl -fsSL https://raw.githubusercontent.com/romkatv/zsh4humans/v5/install)"
