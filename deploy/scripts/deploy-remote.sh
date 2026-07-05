#!/usr/bin/env bash
# ============================================
# Muse — Remote Deploy Script (run from local)
# ============================================
# Deploy to your VPS from your local machine
# Usage: ./deploy/scripts/deploy-remote.sh user@your-vps-ip
# ============================================

set -euo pipefail

VPS_HOST="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <user@vps-host>"
    echo ""
    echo "Example:"
    echo "  $0 muse@192.168.1.100"
    echo "  $0 root@yourdomain.com"
    exit 1
}

[[ -z "$VPS_HOST" ]] && usage

echo -e "${GREEN}=== Muse Remote Deployment ===${NC}"
echo "Target: $VPS_HOST"
echo ""

# Check if we can SSH to the VPS
echo "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$VPS_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${YELLOW}Warning: Could not establish SSH connection${NC}"
    echo "Make sure:"
    echo "  1. You have SSH access to $VPS_HOST"
    echo "  2. Your SSH key is added to the VPS"
    exit 1
fi

# Step 1: Provision (if not already done)
echo ""
echo "Step 1: Checking if VPS is provisioned..."
if ssh "$VPS_HOST" "test -f /opt/muse/shared/.env" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} VPS already provisioned"
else
    echo "VPS not provisioned. Running provision script..."
    ssh "$VPS_HOST" "curl -fsSL https://raw.githubusercontent.com/MUNENE1212/Muse/main/deploy/scripts/provision-vps.sh | sudo bash"
fi

# Step 2: Copy .env if it doesn't exist
echo ""
echo "Step 2: Checking environment configuration..."
if ! ssh "$VPS_HOST" "test -s /opt/muse/shared/.env" 2>/dev/null; then
    echo "Environment file missing or empty."
    echo "Creating from .env.example..."

    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        echo "Using local .env file..."
        scp "$PROJECT_ROOT/.env" "$VPS_HOST:/tmp/muse.env"
        ssh "$VPS_HOST" "sudo mv /tmp/muse.env /opt/muse/shared/.env && sudo chown muse:muse /opt/muse/shared/.env && sudo chmod 600 /opt/muse/shared/.env"
    else
        echo "Please create .env file first:"
        echo "  cp .env.example .env"
        echo "  nano .env  # Edit with your values"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Environment file exists"
fi

# Step 3: Clone/update repo
echo ""
echo "Step 3: Updating repository on VPS..."
if ssh "$VPS_HOST" "test -d /opt/muse/repo" 2>/dev/null; then
    echo "Repository exists, fetching latest..."
    ssh "$VPS_HOST" "cd /opt/muse/repo && sudo -u muse git fetch --prune origin && sudo -u muse git reset --hard origin/main"
else
    echo "Cloning repository..."
    ssh "$VPS_HOST" "sudo -u muse git clone https://github.com/MUNENE1212/Muse.git /opt/muse/repo"
fi

# Step 4: Deploy
echo ""
echo "Step 4: Deploying application..."
ssh "$VPS_HOST" "cd /opt/muse && sudo -u muse ./repo/deploy/scripts/deploy.sh"

# Step 5: Health check
echo ""
echo "Step 5: Running health check..."
sleep 5  # Give services time to start
ssh "$VPS_HOST" "sudo /opt/muse/repo/deploy/scripts/health-check.sh"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo "Your Muse stack should now be running at:"
echo "  https://$(ssh "$VPS_HOST" "grep PUBLIC_DOMAIN /opt/muse/shared/.env | cut -d'=' -f2" 2>/dev/null || echo "your-domain.com")"
