#!/usr/bin/env bash
# ============================================
# Muse — Production Deploy Script (VPS-side)
# ============================================
# This script lives on the VPS at /opt/muse/deploy/deploy-muse.sh
# It's called by CI/CD to deploy the latest code
# ============================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO_DIR="/opt/muse/repo"
SHARED_DIR="/opt/muse/shared"
COMPOSE_FILE="$REPO_DIR/deploy/compose/docker-compose.optimized.yml"
ENV_FILE="$SHARED_DIR/.env"
LOG_FILE="/var/log/muse-deploy.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"
}

# ============================================
# Pre-flight checks
# ============================================

log "=== Muse Production Deploy ==="

if [[ ! -d "$REPO_DIR" ]]; then
    error "Repository directory not found: $REPO_DIR"
    error "Run provision script first"
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    error "Environment file not found: $ENV_FILE"
    error "Create it from .env.example"
    exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
    error "Docker compose file not found: $COMPOSE_FILE"
    exit 1
fi

cd "$REPO_DIR" || exit 1

# ============================================
# Pull latest changes
# ============================================

log "Pulling latest changes from git..."
git fetch --prune
git reset --hard origin/main
git clean -fd

# Get latest commit info
LATEST_COMMIT=$(git rev-parse --short HEAD)
log "Deploying commit: $LATEST_COMMIT"

# ============================================
# Build images
# ============================================

log "Building optimized images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build 2>&1 | tee -a "$LOG_FILE"

# ============================================
# Stop existing services
# ============================================

log "Stopping existing services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down 2>&1 | tee -a "$LOG_FILE" || true

# ============================================
# Start services
# ============================================

log "Starting services with optimized configuration..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d 2>&1 | tee -a "$LOG_FILE"

# ============================================
# Wait for health checks
# ============================================

log "Waiting for services to become healthy..."
sleep 10

# Wait for postgres
log "Checking PostgreSQL..."
for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        pg_isready -U "${POSTGRES_USER:-muse}" >/dev/null 2>&1; then
        log "✓ PostgreSQL is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        error "PostgreSQL failed to start"
        exit 1
    fi
    sleep 2
done

# Wait for redis
log "Checking Redis..."
for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T redis \
        redis-cli ping >/dev/null 2>&1; then
        log "✓ Redis is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        warn "Redis health check failed, but continuing..."
        break
    fi
    sleep 2
done

# Wait for AI Engine
log "Checking AI Engine..."
for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ai-engine \
        curl -fsS http://localhost:8000/ >/dev/null 2>&1; then
        log "✓ AI Engine is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        error "AI Engine failed to start"
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs ai-engine
        exit 1
    fi
    sleep 2
done

# ============================================
# Verify cache is working
# ============================================

log "Verifying cache layer..."
CACHE_STATUS=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ai-engine \
    curl -s http://localhost:8000/api/cache/stats 2>/dev/null || echo "{}")
if echo "$CACHE_STATUS" | grep -q '"status".*"connected"'; then
    log "✓ Cache layer is active"
else
    warn "Cache layer may not be fully operational"
fi

# ============================================
# Run database migrations if needed
# ============================================

if [[ -f "$REPO_DIR/database/migrations/"*.sql ]]; then
    log "Running database migrations..."
    # Add migration logic here if needed
fi

# ============================================
# Cleanup old images
# ============================================

log "Cleaning up old Docker images..."
docker image prune -f --filter "until=24h" 2>&1 | tee -a "$LOG_FILE" || true

# ============================================
# Final status
# ============================================

log "=== Deploy Complete ==="
log "Services running:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

log "Deploy successful! Commit: $LATEST_COMMIT"
exit 0
