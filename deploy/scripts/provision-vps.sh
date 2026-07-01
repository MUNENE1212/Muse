#!/usr/bin/env bash
# ============================================
# Muse — VPS initial provision (Ubuntu 22.04+)
# ============================================
# Idempotent. Run as root. Re-runnable.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/MUNENE1212/Muse/main/deploy/scripts/provision-vps.sh | sudo bash
#   — or —
#   sudo ./deploy/scripts/provision-vps.sh
# ============================================

set -euo pipefail

MUSE_USER="muse"
MUSE_HOME="/opt/muse"
LOG_PREFIX="[muse-provision]"

log()  { echo "${LOG_PREFIX} $*"; }
fail() { echo "${LOG_PREFIX} FAIL: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "must run as root (sudo)"

# ── 1. OS sanity ─────────────────────────────
. /etc/os-release
[[ "$ID" == "ubuntu" ]] || fail "Ubuntu required (got $ID)"
log "OS: $PRETTY_NAME"

# ── 2. apt update + base packages ───────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg lsb-release \
    ufw fail2ban unattended-upgrades \
    jq rsync

# ── 3. Docker engine + Compose v2 ───────────
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker…"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker --version
docker compose version

# ── 4. muse user + workspace ───────────────
if ! id -u "$MUSE_USER" >/dev/null 2>&1; then
  log "Creating user $MUSE_USER"
  adduser --system --group --home "$MUSE_HOME" --shell /bin/bash "$MUSE_USER"
fi
mkdir -p "$MUSE_HOME"/{releases,shared,backups}
chown -R "$MUSE_USER:$MUSE_USER" "$MUSE_HOME"

# ── 5. SSH key for deploys ─────────────────
mkdir -p "$MUSE_HOME/.ssh"
touch "$MUSE_HOME/.ssh/authorized_keys"
chown -R "$MUSE_USER:$MUSE_USER" "$MUSE_HOME/.ssh"
chmod 700 "$MUSE_HOME/.ssh"
chmod 600 "$MUSE_HOME/.ssh/authorized_keys"
log "Add your CI public key to $MUSE_HOME/.ssh/authorized_keys before running deploy."

# ── 6. Firewall ─────────────────────────────
ufw allow OpenSSH || true
ufw allow 80/tcp  || true
ufw allow 443/tcp || true
ufw --force enable

# ── 7. Automatic security updates ──────────
dpkg-reconfigure -plow unattended-upgrades || true

# ── 8. systemd unit (compose stack) ────────
install -m 0644 "$(dirname "$0")/../systemd/muse-stack.service" /etc/systemd/system/muse-stack.service
systemctl daemon-reload
systemctl enable muse-stack.service

log "Provision complete."
log "Next steps:"
log "  1. Add CI public key:  sudo -u $MUSE_USER nano $MUSE_HOME/.ssh/authorized_keys"
log "  2. Place .env at:      $MUSE_HOME/shared/.env"
log "  3. Trigger first deploy: cd /opt/muse && sudo -u muse ./deploy/scripts/deploy.sh"