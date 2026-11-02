#!/usr/bin/env bash
# CI helper: install age and the PostgreSQL client tools for one major
# version, and put them first on PATH for later workflow steps.
#
# Usage: scripts/backup/install-tools.sh <postgres-major-version>
#
# The client must match the server's major version: a newer pg_dump writes
# settings an older server rejects on restore, and an older one refuses to
# dump a newer server.
set -euo pipefail
major=${1:?usage: install-tools.sh <postgres-major-version>}

sudo apt-get update -qq
sudo apt-get install -y -qq postgresql-common age >/dev/null
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null
sudo apt-get install -y -qq "postgresql-client-$major" >/dev/null
echo "/usr/lib/postgresql/$major/bin" >>"${GITHUB_PATH:-/dev/null}"
"/usr/lib/postgresql/$major/bin/pg_dump" --version
