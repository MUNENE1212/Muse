#!/usr/bin/env bash
# ============================================
# Muse — Health Check Script
# ============================================
# Run this on the VPS to verify all services are healthy
# Usage: sudo ./deploy/scripts/health-check.sh
# ============================================

set -euo pipefail

MUSE_HOME="/opt/muse"
REPO="$MUSE_HOME/repo"
ENV_FILE="$MUSE_HOME/shared/.env"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() { echo -e "${GREEN}✓${NC} $1"; }
check_fail() { echo -e "${RED}✗${NC} $1"; }
check_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "=== Muse Stack Health Check ==="
echo ""

# Check systemd service
if systemctl is-active --quiet muse-stack; then
    check_pass "muse-stack service is running"
else
    check_fail "muse-stack service is not running"
fi

# Check environment file
if [[ -f "$ENV_FILE" ]]; then
    check_pass ".env file exists"
else
    check_fail ".env file missing at $ENV_FILE"
fi

# Check Docker
if command -v docker >/dev/null 2>&1; then
    check_pass "Docker is installed ($(docker --version | head -1))"
else
    check_fail "Docker is not installed"
fi

# Check running containers
echo ""
echo "=== Docker Containers ==="
if docker compose -f "$REPO/deploy/compose/docker-compose.prod.yml" ps 2>/dev/null | grep -q "Up"; then
    docker compose -f "$REPO/deploy/compose/docker-compose.prod.yml" ps
else
    check_fail "No containers running"
fi

# Service health checks
echo ""
echo "=== Service Health Checks ==="

# Caddy
if curl -fsS http://localhost:80 >/dev/null 2>&1; then
    check_pass "Caddy responding on port 80"
else
    check_fail "Caddy not responding on port 80"
fi

# Frontend Gateway
if curl -fsS http://localhost:8000/ >/dev/null 2>&1; then
    check_pass "Frontend Gateway healthy"
else
    check_fail "Frontend Gateway not healthy"
fi

# AI Engine
if curl -fsS http://localhost:8001/api/health >/dev/null 2>&1; then
    check_pass "AI Engine healthy"
elif curl -fsS http://localhost:8001/ >/dev/null 2>&1; then
    check_pass "AI Engine responding"
else
    check_fail "AI Engine not healthy"
fi

# PostgreSQL
if docker exec muse-postgres-1 pg_isready -U muse >/dev/null 2>&1; then
    check_pass "PostgreSQL healthy"
else
    check_fail "PostgreSQL not healthy"
fi

# Check disk space
echo ""
echo "=== Disk Space ==="
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -lt 80 ]]; then
    check_pass "Disk usage: ${DISK_USAGE}%"
elif [[ $DISK_USAGE -lt 90 ]]; then
    check_warn "Disk usage: ${DISK_USAGE}% (getting high)"
else
    check_fail "Disk usage: ${DISK_USAGE}% (critical)"
fi

# Check memory
echo ""
echo "=== Memory ==="
MEM_INFO=$(free | awk 'NR==2{printf "%.1f/%.1f GB (%.1f%%)\n", $3/1024, $2/1024, $3*100/$2}')
echo "Memory usage: $MEM_INFO"

# Recent logs
echo ""
echo "=== Recent Logs (last 10 lines) ==="
sudo journalctl -u muse-stack -n 10 --no-pager

echo ""
echo "=== Health Check Complete ==="
