<#
  Exports the database SCHEMA (no rows) from your working local database so the VPS
  can start from the same structure: tables, constraints, indexes, the append-only
  audit trigger and everything the migrations in auth-service/sql/ added.

  Why this exists: the repo's SQL files are migrations on top of a base schema
  (users, otps, sessions, audit_logs, elderly_profiles, assignments, ...) that was
  created by hand and is not in any file. Without this dump a fresh database cannot
  be built.

  Run from the repo root in PowerShell:
      .\deploy\export-schema.ps1
      .\deploy\export-schema.ps1 -Db mzazicare_auth -User postgres

  Needs pg_dump and psql on PATH (they ship with PostgreSQL).
#>
param(
  [string]$Db = "mzazicare_auth",
  [string]$User = "postgres"
)

$ErrorActionPreference = "Stop"
$out = "deploy/db/initdb/00-schema.sql"

Write-Host "PostgreSQL version (set PG_MAJOR in the VPS .env to this major version):"
psql -U $User -d $Db -tAc "SHOW server_version;"

pg_dump -U $User -d $Db --schema-only --no-owner --no-privileges -f $out
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }

Write-Host ""
Write-Host "Wrote $out"
Write-Host "Tables and current row counts. Any table that holds reference data the app needs"
Write-Host "to start (not accounts or logs) must be added to the VPS separately:"
psql -U $User -d $Db -c "SELECT relname AS table_name, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY relname;"
