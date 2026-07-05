# Muse VPS Deployment — Quick Start

## Prerequisites Checklist

- [ ] VPS with Ubuntu 22.04+ (2 vCPU / 4 GB RAM minimum)
- [ ] Domain name (A record pointing to VPS IP)
- [ ] SSH access to VPS

## Option A: Deploy from Local Machine

```bash
# Clone the repo (if not already done)
git clone https://github.com/MUNENE1212/Muse.git
cd Muse

# Set up your environment
cp .env.example .env
nano .env  # Edit with your values

# Deploy to VPS (replace with your VPS details)
./deploy/scripts/deploy-remote.sh muse@your-vps-ip
```

## Option B: Deploy Directly on VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Step 1: Provision (install Docker, create user, etc.)
curl -fsSL https://raw.githubusercontent.com/MUNENE1212/Muse/main/deploy/scripts/provision-vps.sh | sudo bash

# Step 2: Configure environment
sudo -u muse nano /opt/muse/shared/.env
# Paste your .env contents

# Step 3: Deploy
cd /opt/muse
sudo -u muse git clone https://github.com/MUNENE1212/Muse.git repo
sudo -u muse ./repo/deploy/scripts/deploy.sh

# Step 4: Enable service
sudo systemctl enable muse-stack
sudo systemctl start muse-stack
```

## Verify Deployment

```bash
# From your local machine
curl https://your-domain.com/

# Or from VPS
sudo /opt/muse/repo/deploy/scripts/health-check.sh
```

## What Gets Deployed

| Component | Description |
|-----------|-------------|
| Caddy | Reverse proxy + auto TLS (Let's Encrypt) |
| Frontend Gateway | Deno.js frontend on port 8000 |
| AI Engine | Python FastAPI backend with GLM AI |
| Blockchain Security | Solana integration service |
| PostgreSQL | Database with migrations |

## Service URLs After Deploy

- Main app: `https://your-domain.com/`
- AI API: `https://your-domain.com/api/ai/*`
- Health check: `https://your-domain.com/api/health`

## Maintenance Commands

```bash
# View logs
sudo journalctl -u muse-stack -f

# Restart stack
sudo systemctl restart muse-stack

# Update to latest
cd /opt/muse && sudo -u muse ./repo/deploy/scripts/deploy.sh

# Health check
sudo /opt/muse/repo/deploy/scripts/health-check.sh
```

## Troubleshooting

### Port 80/443 already in use
```bash
sudo systemctl stop nginx  # or apache
sudo systemctl disable nginx
```

### Database connection failed
```bash
docker logs muse-postgres-1
# Check DATABASE_URL in .env matches postgres credentials
```

### TLS certificate not issued
```bash
# Ensure DNS A record is pointing to VPS
# Then restart Caddy
docker compose -f /opt/muse/repo/deploy/compose/docker-compose.prod.yml restart caddy
```

## Environment Variables Required

See `.env.example` for full list. Critical ones:

```bash
PUBLIC_DOMAIN=yourdomain.com
POSTGRES_PASSWORD=<strong-password>
SESSION_SECRET=<64-char-random-string>
ZHIPU_API_KEY=your_api_key
```

## Security Notes

- Firewall allows only 80, 443, 22
- Services run as non-root user
- Automatic security updates enabled
- fail2ban protects SSH
- Database not exposed publicly
