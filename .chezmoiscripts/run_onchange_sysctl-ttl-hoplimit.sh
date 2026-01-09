#!/bin/sh
set -eu

sudo tee /etc/sysctl.d/99-ttl-hoplimit.conf >/dev/null <<'EOF'
net.ipv4.ip_default_ttl = 65
net.ipv6.conf.all.hop_limit = 65
net.ipv6.conf.default.hop_limit = 65
EOF

# load just this file now (optional)
sudo sysctl -p /etc/sysctl.d/99-ttl-hoplimit.conf
