#!/usr/bin/env bash
# Restore an encrypted database backup into a NEW, EMPTY database.
#
# Usage: scripts/backup/restore.sh <lateef-db-....dump.age> <age-identity-file> <target-database-url>
#
# The identity file is the private key printed when the backup key was made
# (a line starting AGE-SECRET-KEY-). The target must have no tables: the
# script refuses anything else, so it can never be pointed at production and
# overwrite live data. Restore into a fresh database, check it, then switch
# the app's DATABASE_URI over to it.
#
# Use a PostgreSQL server of the same major version as the one backed up (or
# newer), with pg_restore from that version.
set -euo pipefail

file=${1:?usage: restore.sh <backup.dump.age> <identity-file> <target-database-url>}
identity=${2:?identity file required}
target=${3:?target database URL required}

existing=$(psql -X -A -t -q -v ON_ERROR_STOP=1 "$target" -c \
  "select count(*) from pg_tables where schemaname not in ('pg_catalog', 'information_schema')")
if [ "$existing" != "0" ]; then
  echo "Refusing: the target database already has $existing tables. Restore into a new, empty database."
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
age --decrypt --identity "$identity" --output "$tmp" "$file"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$target" "$tmp"
echo "Restored $(basename "$file")"
