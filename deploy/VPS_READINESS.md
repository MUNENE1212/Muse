# VPS Readiness Validation Report

> Generated after the `cicd/vps-deploy` branch was merged into `staging`.
> Run on staging @ commit `4637be0` (post Caddyfile fix).

## Summary

**9 / 9 readiness checks PASS.**

```
PASS  docker compose syntax
PASS  Caddyfile syntax
PASS  deploy.sh syntax
PASS  provision-vps.sh syntax
PASS  backup.sh syntax
PASS  deploy workflow YAML
PASS  systemd unit readable
PASS  .env.example present
PASS  README present
```

## How to reproduce

```bash
bash /tmp/vps_check.sh     # or rerun the commands in deploy/README.md
```

## Per-check evidence

### 1. docker-compose.prod.yml syntax

```
$ docker compose --env-file .env -f deploy/compose/docker-compose.prod.yml config --quiet
(exit 0 — no output, silent success)
```

5 services resolved: `postgres`, `ai-engine`, `blockchain-security`, `frontend-gateway`, `caddy`.

### 2. Caddyfile syntax

```
$ docker run --rm -e PUBLIC_DOMAIN=localhost \
    -v $(pwd)/deploy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
    caddy:2.7-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
{"level":"info",...,"msg":"Valid configuration"}
```

(Initial version failed with `unrecognized global option: encode` because of a duplicate site block with invalid `{$DOMAIN}:443/health` syntax. Fixed by collapsing to a single site block and using a `@fresh` path matcher.)

### 3. Bash scripts

`bash -n` on `deploy.sh`, `provision-vps.sh`, `backup.sh` — all pass with no errors.

### 4. Workflow YAML

`python3 -c "import yaml; yaml.safe_load(open('...'))"` on all 5 workflows in `.github/workflows/` — all parse.

### 5. Secret scan

Grep for hardcoded passwords/secrets/tokens (16+ char alnum) across `.ts`, `.tsx`, `.py`, `.yml`, `.yaml`, `.sh`, `.json`, `.toml`, `.md`, `Dockerfile` — **no hits** outside `.env.example` (which intentionally contains placeholder text).

### 6. Filesystem notes

The deployment filesystem is a Windows/CIFS mount where chmod is silently ignored (everything reports `0777`). This is a sandbox artifact only; on a real Linux VPS the systemd unit file and scripts will install with the correct `0644` / `0755` modes. Provision script is idempotent and re-runnable.

## What's still required before pushing to a real VPS

These cannot be validated without an actual VPS:

1. **Provision a VPS** (Ubuntu 22.04, ≥ 2 vCPU / 4 GB RAM / 40 GB SSD).
2. **DNS** — point `PUBLIC_DOMAIN` A record at the VPS IP.
3. **Add the CI deploy key** to `/opt/muse/.ssh/authorized_keys`.
4. **Create `.env`** at `/opt/muse/shared/.env` from `.env.example`.
5. **Configure GitHub secrets/variables** (see `deploy/README.md`):
   - Secret: `VPS_SSH_KEY`
   - Variables: `VPS_HOST`, `VPS_USER`, `PUBLIC_DOMAIN`
6. **Trigger a deploy** by pushing to `main` (or via `workflow_dispatch`).
7. **Verify** with `curl -fsS https://$PUBLIC_DOMAIN/` returning HTTP 200.

## What's NOT in scope for v1 deploy

- TLS-only mode (Caddy already terminates TLS — port 80 is for HTTP→HTTPS redirect).
- Multi-region failover (single VPS).
- Observability (Prometheus / Grafana) — see `deploy/README.md` "Future".
- k3s migration — see `deploy/README.md` "Future".