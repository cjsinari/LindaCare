#!/usr/bin/env bash
# Seed (or reset and re-seed) the demo care profiles on the running stack.
#   deploy/seed-demo.sh +254700000101 +254700000202          seed
#   deploy/seed-demo.sh +254700000101 +254700000202 reset    remove "Sample " profiles, then seed
# Both numbers must be real phones you control: sign-in codes arrive by SMS.
set -euo pipefail
cd "$(dirname "$0")/.."

[ $# -ge 2 ] || { echo "usage: $0 <family_phone> <caregiver_phone> [reset]"; exit 1; }

psql_in() { docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "$@"; }

if [ "${3:-}" = "reset" ]; then
  psql_in < auth-service/sql/care/reset.sql
fi
psql_in -v family_phone="$1" -v caregiver_phone="$2" < auth-service/sql/care/seed.sql
