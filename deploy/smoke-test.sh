#!/usr/bin/env bash
# Run on the VPS after `docker compose up -d --build`. Every line should say PASS.
set -uo pipefail
cd "$(dirname "$0")/.."

DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d= -f2-)
APP_DOMAIN=$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2-)
fail=0
run() { local name=$1; shift; if "$@" >/dev/null 2>&1; then echo "PASS  $name"; else echo "FAIL  $name"; fail=1; fi; }

t_containers()  { [ "$(docker compose ps --status running --services | wc -l)" -eq 5 ]; }
t_schema()      { n=$(docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from pg_stat_user_tables"' | tr -d '[:space:]'); [ "${n:-0}" -ge 10 ]; }
t_ml()          { docker compose exec -T ml-engine python -c 'import urllib.request,json,sys; d=json.load(urllib.request.urlopen("http://127.0.0.1:5000/health")); sys.exit(0 if d["model_loaded"] and d["scaler_loaded"] and d["calibration_loaded"] else 1)'; }
t_api()         { curl -fsS "https://$DOMAIN/api/health" | grep -q 'Auth service running'; }
t_dashboard()   { curl -fsS "https://$DOMAIN/" | grep -qi 'id="root"'; }
t_redirect()    { curl -sI "http://$DOMAIN/" | grep -qi '^location: https://'; }
t_mobileweb()   { curl -fsS "https://$APP_DOMAIN/" | grep -qi '<html'; }
t_cors_ok()     { curl -sI -X OPTIONS "https://$DOMAIN/api/auth/otp/request" -H "Origin: https://$APP_DOMAIN" -H 'Access-Control-Request-Method: POST' | grep -qi "access-control-allow-origin: https://$APP_DOMAIN"; }
t_cors_refused(){ ! curl -sI -X OPTIONS "https://$DOMAIN/api/auth/otp/request" -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST' | grep -qi 'access-control-allow-origin'; }
t_no_ports()    { ! docker compose ps --format '{{.Ports}}' | grep -Eq '(5432|6379|5000|3000)->'; }

run "five containers running"                              t_containers
run "database holds the exported schema (10+ tables)"      t_schema
run "ML engine loaded model, scaler and calibration"       t_ml
run "https://$DOMAIN/api/health answers"                   t_api
run "dashboard served at https://$DOMAIN/"                 t_dashboard
run "http redirects to https"                              t_redirect
run "mobile web served at https://$APP_DOMAIN/"            t_mobileweb
run "CORS allows the mobile web origin"                    t_cors_ok
run "CORS refuses an unknown origin"                       t_cors_refused
run "Postgres, Redis, ML engine, auth service not published" t_no_ports

if [ $fail -eq 0 ]; then echo "All checks passed."; else echo "Some checks failed: see docs/DEPLOY.md, section 8."; fi
exit $fail
