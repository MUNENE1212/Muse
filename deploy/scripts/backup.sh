#!/usr/bin/env bash
# ============================================
# Muse — Postgres backup (called by cron)
# ============================================
# Usage:
#   /opt/muse/repo/deploy/scripts/backup.sh
# Crontab entry (muse user):
#   0 3 * * * /opt/muse/repo/deploy/scripts/backup.sh >> /var/log/muse-backup.log 2>&1
# ============================================

set -euo pipefail

BACKUP_DIR="/opt/muse/backups"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

source /opt/muse/shared/.env

# pg_dump from the running postgres container
docker compose -f /opt/muse/repo/deploy/compose/docker-compose.prod.yml \
  exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$BACKUP_DIR/muse-$TIMESTAMP.sql.gz"

chmod 600 "$BACKUP_DIR/muse-$TIMESTAMP.sql.gz"

# Optional: ship to S3 (requires awscli + creds in env)
if [[ -n "${BACKUP_S3_BUCKET:-}" ]] && command -v aws >/dev/null; then
  aws s3 cp "$BACKUP_DIR/muse-$TIMESTAMP.sql.gz" "s3://$BACKUP_S3_BUCKET/$TIMESTAMP.sql.gz"
fi

# Retention
find "$BACKUP_DIR" -name 'muse-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "[backup] OK: muse-$TIMESTAMP.sql.gz"