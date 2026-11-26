#!/usr/bin/env bash
# Provision the administrator account for the dashboard (admins are never self-registered).
#   deploy/create-admin.sh +254700000001 "Ops Administrator"
set -euo pipefail
cd "$(dirname "$0")/.."

[ $# -ge 1 ] || { echo "usage: $0 <phone> [full name]"; exit 1; }

docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v phone="$1" -v name="$2"' sh "$1" "${2:-Ops Administrator}" <<'SQL'
INSERT INTO users (phone_number, full_name, role, account_status, phone_verified, consent_at)
VALUES (:'phone', :'name', 'administrator', 'active', TRUE, NOW())
ON CONFLICT (phone_number) DO UPDATE
  SET role = 'administrator', account_status = 'active', phone_verified = TRUE;
SELECT phone_number, full_name, role, account_status FROM users WHERE phone_number = :'phone';
SQL
