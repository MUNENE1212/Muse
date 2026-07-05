#!/usr/bin/env bash
# ============================================
# Muse — Pre-Deployment Readiness Check
# ============================================
# Run this before deploying to catch common issues
# Usage: ./deploy/scripts/pre-deploy-check.sh
# ============================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check_pass() { echo -e "${GREEN}✓${NC} $1"; }
check_fail() { echo -e "${RED}✗${NC} $1"; }
check_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
check_info() { echo -e "${BLUE}ℹ${NC} $1"; }

ERRORS=0
WARNINGS=0

echo -e "${BLUE}=== Muse Pre-Deployment Readiness Check ===${NC}"
echo ""

# Check .env file
echo "1. Environment Configuration"
if [[ -f ".env" ]]; then
    check_pass ".env file exists"

    # Check for required variables
    if grep -q "PUBLIC_DOMAIN=" .env && ! grep -q "PUBLIC_DOMAIN=muse.example.com" .env; then
        check_pass "PUBLIC_DOMAIN is set"
    else
        check_fail "PUBLIC_DOMAIN not set properly"
        ((ERRORS++))
    fi

    if grep -q "POSTGRES_PASSWORD=" .env && ! grep -q "POSTGRES_PASSWORD=<" .env; then
        check_pass "POSTGRES_PASSWORD is set"
    else
        check_fail "POSTGRES_PASSWORD not set"
        ((ERRORS++))
    fi

    if grep -q "SESSION_SECRET=" .env && ! grep -q "SESSION_SECRET=<" .env; then
        check_pass "SESSION_SECRET is set"
    else
        check_fail "SESSION_SECRET not set (generate with: openssl rand -hex 32)"
        ((ERRORS++))
    fi
else
    check_fail ".env file missing. Run: cp .env.example .env"
    ((ERRORS++))
fi

echo ""
echo "2. Docker Configuration"

# Check docker-compose syntax
if docker compose -f deploy/compose/docker-compose.prod.yml config --quiet 2>/dev/null; then
    check_pass "docker-compose.prod.yml syntax valid"
else
    check_fail "docker-compose.prod.yml has syntax errors"
    ((ERRORS++))
fi

# Check Caddyfile syntax
if docker run --rm -e PUBLIC_DOMAIN=localhost \
    -v "$(pwd)/deploy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
    caddy:2.7-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    check_pass "Caddyfile syntax valid"
else
    check_warn "Could not validate Caddyfile (Docker may not be running locally)"
    ((WARNINGS++))
fi

echo ""
echo "3. Service Files"

if [[ -f "deploy/systemd/muse-stack.service" ]]; then
    check_pass "systemd unit file exists"
else
    check_fail "systemd unit file missing"
    ((ERRORS++))
fi

if [[ -f "deploy/scripts/deploy.sh" ]]; then
    check_pass "deploy script exists"
else
    check_fail "deploy script missing"
    ((ERRORS++))
fi

if [[ -f "deploy/scripts/provision-vps.sh" ]]; then
    check_pass "provision script exists"
else
    check_fail "provision script missing"
    ((ERRORS++))
fi

echo ""
echo "4. Docker Images"

# Check if images can be built (quick check)
if docker buildx build --load -q -f ai-engine/Dockerfile --target builder ai-engine/ 2>/dev/null; then
    check_pass "ai-engine Dockerfile valid"
else
    check_warn "Could not validate ai-engine Dockerfile locally"
    ((WARNINGS++))
fi

if docker buildx build --load -q -f frontend-gateway/Dockerfile --target builder frontend-gateway/ 2>/dev/null; then
    check_pass "frontend-gateway Dockerfile valid"
else
    check_warn "Could not validate frontend-gateway Dockerfile locally"
    ((WARNINGS++))
fi

echo ""
echo "5. Script Permissions"

for script in deploy/scripts/*.sh; do
    if [[ -x "$script" ]]; then
        check_pass "$(basename "$script") is executable"
    else
        check_warn "$(basename "$script") not executable (will be executable on VPS)"
        ((WARNINGS++))
    fi
done

echo ""
echo "6. Git Configuration"

if git rev-parse --git-dir >/dev/null 2>&1; then
    check_pass "Git repository initialized"
    BRANCH=$(git branch --show-current)
    check_info "Current branch: $BRANCH"

    if [[ -n "$(git status --porcelain)" ]]; then
        check_warn "Uncommitted changes detected"
        ((WARNINGS++))
    else
        check_pass "No uncommitted changes"
    fi
else
    check_warn "Not a git repository (OK for first-time setup)"
fi

echo ""
echo "=== Summary ==="

if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "Deploy to VPS:"
    echo "  ./deploy/scripts/deploy-remote.sh muse@your-vps-ip"
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    echo -e "${YELLOW}$WARNINGS warning(s) found. Review above.${NC}"
    echo "You may proceed with deployment, but address warnings if possible."
    exit 0
else
    echo -e "${RED}$ERRORS error(s) found. Must fix before deploying.${NC}"
    exit 1
fi
