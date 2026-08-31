#!/usr/bin/env bash
# Sauvegarde de la base, à lancer depuis un poste ou une tâche planifiée.
#
#   ./scripts/backup.sh                  # écrit dans ./backups
#   BACKUP_DIR=/ailleurs ./scripts/backup.sh
#
# Le fournisseur hébergé prend déjà des sauvegardes automatiques ; celle-ci est
# la copie que le studio garde chez lui, et sur laquelle on teste la restauration.
set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump introuvable. macOS : brew install libpq && brew link --force libpq" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  # shellcheck disable=SC1091
  [ -f .env ] && export "$(grep -E '^DATABASE_URL=' .env | tail -1 | sed 's/"//g')"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL absent." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/studio-crm-$STAMP.dump"

# Format custom : restaurable sélectivement avec pg_restore.
pg_dump --format=custom --no-owner --no-privileges --file="$TARGET" "$DATABASE_URL"

echo "Sauvegarde écrite : $TARGET"
echo "Restauration : pg_restore --clean --no-owner --dbname=\"\$DATABASE_URL\" \"$TARGET\""

# On garde les 14 dernières.
ls -1t "$BACKUP_DIR"/studio-crm-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
