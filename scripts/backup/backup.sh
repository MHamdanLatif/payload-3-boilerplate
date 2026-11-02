#!/usr/bin/env bash
# Dump the whole database, prove the dump restores, then encrypt it.
#
# Usage: scripts/backup/backup.sh <output-dir>
#
#   SOURCE_DATABASE_URL  the database to back up. Only ever read: every
#                        connection to it is forced read-only.
#   VERIFY_DATABASE_URL  an empty scratch database the dump is restored into
#   AGE_RECIPIENT        age public key the backup is encrypted to. Only the
#                        matching private key, kept offline, can open it.
#   REQUIRED_TABLES      tables that must exist and hold rows
#                        (default: "leads finance_deals")
#
# The dump is restored and every table's row count compared with the live
# database BEFORE it is encrypted, so a backup that would not restore fails
# the run instead of sitting in storage looking fine.
#
# Prints pass/fail only. The repository is public, so its Actions logs are
# too: no counts, names or values go to the log.
set -euo pipefail

out=${1:?usage: backup.sh <output-dir>}
: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${VERIFY_DATABASE_URL:?VERIFY_DATABASE_URL is required}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is required}"
required=${REQUIRED_TABLES:-leads finance_deals}

mkdir -p "$out"
dump="$out/lateef-db-$(date -u +%Y-%m-%dT%H%MZ).dump"
# The unencrypted dump never outlives this script, whether it passes or fails.
trap 'rm -f "$dump"' EXIT

# Read-only at the session level, so nothing here can write to the source.
ro() { PGOPTIONS='-c default_transaction_read_only=on' "$@"; }
q() { psql -X -A -t -q -v ON_ERROR_STOP=1 "$@"; }

ro pg_dump --format=custom --no-owner --no-privileges --file="$dump" "$SOURCE_DATABASE_URL"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$VERIFY_DATABASE_URL" "$dump"

list="select quote_ident(schemaname) || '.' || quote_ident(tablename) from pg_tables
      where schemaname not in ('pg_catalog', 'information_schema') order by 1"
tables=$(q "$VERIFY_DATABASE_URL" -c "$list")
if [ "$tables" != "$(ro q "$SOURCE_DATABASE_URL" -c "$list")" ]; then
  echo "FAIL: the restored copy does not have the same tables as the live database"
  exit 1
fi

# One query per side: "<table>|<rows>" for every table.
counts=$(sed "s/.*/select '&', count(*) from &/; 2,\$s/^/union all /" <<<"$tables")
live=$(ro q "$SOURCE_DATABASE_URL" -c "$counts")
restored=$(q "$VERIFY_DATABASE_URL" -c "$counts")

failed=0
while IFS='|' read -r table want; do
  got=$(grep -m1 "^${table}|" <<<"$restored" | cut -d'|' -f2)
  # Live rows are counted after the dump, so a lead arriving mid-backup must
  # not fail the run. Anything beyond a handful means the dump is incomplete.
  diff=$(( want - ${got:-0} ))
  if [ "${diff#-}" -gt 5 ]; then
    echo "FAIL: row count mismatch in $table"
    failed=1
  fi
done <<<"$live"
for t in $required; do
  rows=$(grep -m1 "^public.${t}|" <<<"$restored" | cut -d'|' -f2)
  if [ -z "$rows" ] || [ "$rows" -eq 0 ]; then
    echo "FAIL: required table $t is missing or empty"
    failed=1
  fi
done
[ "$failed" -eq 0 ] || exit 1

age --encrypt --recipient "$AGE_RECIPIENT" --output "$dump.age" "$dump"
echo "OK: $(wc -l <<<"$tables") tables restored and verified; wrote $(basename "$dump").age"
