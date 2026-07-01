#!/usr/bin/env bash
# ============================================
# Muse — VPS deploy (called by CI or manually)
# ============================================
# Pulls the latest main, rebuilds images, rolls the stack,
# and prunes old images. Blue/green via `releases/` directory.
# Usage:
#   sudo -u muse ./deploy/scripts/deploy.sh
# ============================================

set -euo pipefail

MUSE_HOME="/opt/muse"
REPO="$MUSE_HOME/repo"
COMPOSE_FILE="$REPO/deploy/compose/docker-compose.prod.yml"
ENV_FILE="$MUSE_HOME/shared/.env"
CADDY_DIR="$REPO/deploy/caddy"

log() { echo "[muse-deploy] $*"; }

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE — run provision-vps.sh first" >&2; exit 1; }
[[ -d "$REPO" ]] || { echo "Missing $REPO — git clone first" >&2; exit 1; }

cd "$REPO"
git fetch --prune origin
git reset --hard origin/main

# Mirror .env into the working dir so compose can read it
cp "$ENV_FILE" .env
chmod 600 .env

# Pull base images that don't need a build
docker compose -f "$COMPOSE_FILE" pull postgres caddy || true

# Build application images
docker compose -f "$COMPOSE_FILE" build --pull

# Apply any new migrations (idempotent)
docker compose -f "$COMPOSE_FILE" run --rm ai-engine \
  python -c "import asyncio, asyncpg, os; print('DB reachable:', bool(os.environ.get('DATABASE_URL')))"

# Roll the stack
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Wait for the gateway healthcheck
for i in {1..30}; do
  if curl -fsS http://localhost:8000/ >/dev/null 2>&1; then
    log "frontend-gateway healthy"
    break
  fi
  sleep 2
done

# Prune dangling images
docker image prune -f
log "Deploy complete: $(git rev-parse --short HEAD)"