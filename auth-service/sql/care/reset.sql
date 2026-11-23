-- Care-profile teardown: remove the seeded profiles so seed.sql can run again.
--
--   psql -d mzazicare_auth -f auth-service/sql/care/reset.sql
--
-- Deletes every care profile whose name starts with "Sample " -- the two the
-- seed creates and any made by hand while working on the module -- and nothing
-- else. Their assignments go with them: assignments.elderly_profile_id is
-- ON DELETE CASCADE.
--
-- Left alone, on purpose:
--   the seeded accounts, so any session signed in with them keeps working;
--   audit_logs, which is append-only (a trigger refuses DELETE), and whose
--     rows describing these profiles are meant to outlive them --
--     resource_id is deliberately not a foreign key. Narrow the dashboard's
--     time window to look past earlier runs.

\set ON_ERROR_STOP on

BEGIN;

WITH gone AS (
  DELETE FROM elderly_profiles WHERE full_name LIKE 'Sample %' RETURNING id, full_name
)
SELECT count(*) AS profiles_deleted FROM gone;

COMMIT;
