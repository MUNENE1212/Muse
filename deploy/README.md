# Muse — VPS Deployment

Target: self-hosted VPS running Ubuntu 22.04+, Docker 24+, Compose v2.

## Layout

```
deploy/
├── compose/
│   └── docker-compose.prod.yml     # full production stack
├── caddy/
│   └── Caddyfile                    # reverse proxy + auto-TLS
├── env/
│   └── .env.example                 # template — copy to /opt/muse/shared/.env
├── scripts/
│   ├── provision-vps.sh             # one-time bootstrap (run as root)
│   ├── deploy.sh                    # called by CI on push to main
│   └── backup.sh                    # cron-driven pg_dump
└── systemd/
    └── muse-stack.service          # manages docker compose up/down
```

## First-time setup

```bash
# 1. SSH into VPS as root
ssh root@your-vps

# 2. Run provision script
curl -fsSL https://raw.githubusercontent.com/MUNENE1212/Muse/main/deploy/scripts/provision-vps.sh | sudo bash

# 3. Add your CI public key
sudo -u muse nano /opt/muse/.ssh/authorized_keys

# 4. Clone the repo
sudo -u muse git clone git@github.com:MUNENE1212/Muse.git /opt/muse/repo

# 5. Create the .env
sudo -u muse cp /opt/muse/repo/deploy/env/.env.example /opt/muse/shared/.env
sudo -u muse nano /opt/muse/shared/.env   # fill in real values

# 6. Bring up the stack
sudo -u muse bash /opt/muse/repo/deploy/scripts/deploy.sh
```

## GitHub secrets / variables

| Type | Name | Example |
|---|---|---|
| Secret | `VPS_SSH_KEY` | contents of `~/.ssh/id_ed25519` on CI runner |
| Variable | `VPS_HOST` | `muse.example.com` |
| Variable | `VPS_USER` | `muse` |
| Variable | `PUBLIC_DOMAIN` | `muse.example.com` |

## Backups

```bash
# Install cron for the muse user
sudo -u muse crontab -e
# Add:
0 3 * * * /opt/muse/repo/deploy/scripts/backup.sh >> /var/log/muse-backup.log 2>&1
```

## Rollback

```bash
# Pin to a known-good SHA
cd /opt/muse/repo
git fetch --all
git reset --hard <known-good-sha>
bash deploy/scripts/deploy.sh
```

## Health endpoints

- Frontend: `https://$PUBLIC_DOMAIN/`
- Backend health: `https://$PUBLIC_DOMAIN/api/health/services`
- AI engine: `https://$PUBLIC_DOMAIN/api/ai/*` (proxied via Caddy)

## Future

- Migrate to k3s or Nomad if a single VPS becomes a bottleneck.
- Add Prometheus + Grafana via `deploy/observability/` (not in v1).
- Wire Sentry DSN once `SENTRY_DSN` secret is set.