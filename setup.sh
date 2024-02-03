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

########
# Apps #
########
# zed
brew install zed
mkdir -p ~/.config/zed
ln -s $PWD/zed/settings.json ~/.config/zed/settings.json

# iterm2
brew install iterm2
cp $PWD/iterm2/com.googlecode.iterm2.plist ~/Library/Preferences/com.googlecode.iterm2.plist

# warp
brew install warp

# other
brew install orbstack
brew install arc
brew install signal
brew install enpass
brew install mullvadvpn
brew install rectangle
brew install shottr
brew install clop
sudo xattr -r -d com.apple.quarantine /Applications/Clop.app
brew install gpg-suite

###################
# General Tooling #
###################

# helix
git clone https://github.com/pinelang/helix-tree-explorer.git
cd helix-tree-explore
git checkout tree_explore

cargo install --path helix-term --locked

mkdir -p ~/.config/helix
ln -s $PWD/runtime ~/.config/helix/runtime
ln -s $PWD/helix/config.toml ~/.config/helix/config.toml
ln -s $PWD/helix/languages.toml ~/.config/helix/languages.toml
hx --grammar fetch
hx --grammar build

cd ..

# zsh4humans
sh -c "$(curl -fsSL https://raw.githubusercontent.com/romkatv/zsh4humans/v5/install)"

######################################
# Language Servers & Related Tooling #
######################################
# NOTE: these are only used by helix
#       zed downloads its own language servers

# python language servers
pipx install pyright  # and pyright-langserver
pipx install ruff-lsp

pipx install ruff

############
# Commands #
############

brew install bat
cargo install just
cargo install sqlx-cli
