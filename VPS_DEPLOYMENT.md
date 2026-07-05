# Muse VPS Deployment Guide

## Quick Start (5 minutes)

### Prerequisites
- VPS with Ubuntu 22.04+ (2 vCPU / 4 GB RAM / 40 GB SSD minimum)
- Domain name pointed to VPS IP
- SSH access to VPS

### Step 1: Provision the VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Run the provision script
curl -fsSL https://raw.githubusercontent.com/MUNENE1212/Muse/main/deploy/scripts/provision-vps.sh | sudo bash
```

This installs:
- Docker + Docker Compose v2
- Firewall (ufw) with ports 80, 443, 22 open
- `muse` user for running the application
- systemd service for Muse stack
- fail2ban and automatic security updates

### Step 2: Add SSH Key for CI/CD Deployments

```bash
# Add your CI/CD public key (GitHub Actions, etc.)
sudo -u muse nano /opt/muse/.ssh/authorized_keys
# Paste your public key and save
```

### Step 3: Configure Environment

```bash
# Create environment file from template
sudo -u muse nano /opt/muse/shared/.env
```

Copy this template and fill in your values:

```bash
# Database
POSTGRES_DB=muse
POSTGRES_USER=muse
POSTGRES_PASSWORD=<generate-strong-password>
DATABASE_URL=postgres://muse:<password>@postgres:5432/muse

# Application
PORT=8000
AI_ENGINE_URL=http://ai-engine:8000
BLOCKCHAIN_URL=http://blockchain-security:3000
SESSION_SECRET=<generate-40-char-random-string>
NODE_ENV=production

# AI Services
GROQ_API_KEY=your_groq_key_here
ZHIPU_API_KEY=your_zhipu_key_here
GLM_MODEL=glm-4
NLP_ENGINE_TYPE=glm_enriched
SYNTHESIS_PROVIDER=glm

# Domain
PUBLIC_DOMAIN=yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com

# Blockchain
SOLANA_RPC_URL=https://api.devnet.solana.com

# Logging
LOG_LEVEL=info
```

### Step 4: Initial Deploy

```bash
# Clone the repo
sudo -u muse git clone https://github.com/MUNENE1212/Muse.git /opt/muse/repo
cd /opt/muse

# Run deploy script
sudo -u muse ./deploy/scripts/deploy.sh
```

### Step 5: Enable and Start Service

```bash
sudo systemctl enable muse-stack
sudo systemctl start muse-stack
```

### Step 6: Verify Deployment

```bash
# Check service status
sudo systemctl status muse-stack

# Check all containers
docker ps

# Test the application
curl -fsS https://yourdomain.com/
```

## Architecture

```
Internet → Caddy (443) → Frontend Gateway (8000)
                          ↓                    ↓
                       AI Engine (8000)    Blockchain (3000)
                          ↓                    ↓
                       PostgreSQL (5432) ←───────────┘
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Caddy | 80, 443 | Reverse proxy + auto-TLS |
| frontend-gateway | 8000 | Deno frontend |
| ai-engine | 8000 | Python AI backend |
| blockchain-security | 3000 | Solana integration |
| postgres | 5432 | Database |

## Maintenance

### View Logs

```bash
# All services
sudo journalctl -u muse-stack -f

# Specific service
docker logs -f ai-engine
docker logs -f frontend-gateway
```

### Update Deployment

```bash
cd /opt/muse
sudo -u muse ./deploy/scripts/deploy.sh
```

### Backup

```bash
# Automated backup script
sudo -u muse /opt/muse/repo/deploy/scripts/backup.sh
```

### Restart Services

```bash
# Full stack
sudo systemctl restart muse-stack

# Individual service
docker compose -f /opt/muse/repo/deploy/compose/docker-compose.prod.yml restart ai-engine
```

## Security

- Firewall only allows 80, 443, 22
- fail2ban protects SSH
- Automatic security updates enabled
- All services run as non-root `muse` user
- Database not exposed publicly

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u muse-stack -n 50

# Check environment file
cat /opt/muse/shared/.env

# Validate docker-compose
docker compose -f /opt/muse/repo/deploy/compose/docker-compose.prod.yml config
```

### Database connection issues

```bash
# Check postgres is healthy
docker exec -it muse-postgres-1 pg_isready -U muse

# View postgres logs
docker logs muse-postgres-1
```

### TLS certificate issues

```bash
# Check Caddy logs
docker logs muse-caddy-1

# Force certificate renewal
docker compose -f /opt/muse/repo/deploy/compose/docker-compose.prod.yml restart caddy
```

## CI/CD Setup (GitHub Actions)

Add these secrets to your GitHub repository:

1. `VPS_SSH_KEY` - Private SSH key for deployment
2. `VPS_HOST` - VPS hostname or IP
3. `VPS_USER` - Deployment user (muse)
4. `PUBLIC_DOMAIN` - Your domain name

The workflow in `.github/workflows/deploy.yml` will automatically deploy on push to `main`.
