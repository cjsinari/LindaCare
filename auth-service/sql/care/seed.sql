-- Care-profile seed: a known starting state for the /profiles routes.
--
-- Brings a local or test database to the state the care-profile module's
-- authorization paths need: a family account that owns two profiles, a
-- caregiver account that is assigned to one of them, and nothing else.
--
-- Safe to run more than once: every step looks before it writes, so a second
-- run leaves the same two profiles and the same single assignment.
--
-- The phone numbers are passed in, never committed. Use the E.164 form the
-- service stores (+2547...), and sign in with those numbers through the normal
-- OTP flow afterwards; this script creates no codes, tokens or sessions.
--
-- PowerShell:
--   psql -d mzazicare_auth -v family_phone=+254700000101 -v caregiver_phone=+254700000202 `
--        -f auth-service/sql/care/seed.sql
--
-- What it guarantees:
--   a family account on family_phone, active;
--   a caregiver account on caregiver_phone, active and phone-verified (the
--     assign endpoint accepts nothing less);
--   two profiles owned by the family account, "Sample Elder One" and
--     "Sample Elder Two", with made-up details;
--   one active assignment: the caregiver to Elder One. Elder Two has none, so
--     a request for it from the caregiver is the unreachable-record 404 that
--     the ownership middleware is meant to answer, and the row a scoped
--     listing must leave out.
--
-- An existing account on either number keeps its name; it is only made active
-- (and, for the caregiver, verified). If the number belongs to the other role,
-- the script stops rather than changing anyone's role.

\set ON_ERROR_STOP on

-- psql variables are not visible inside a DO block, so they go in as settings.
SELECT set_config('care.family_phone', :'family_phone', false) AS family,
       set_config('care.caregiver_phone', :'caregiver_phone', false) AS caregiver
\gset seed_

BEGIN;

DO $$
DECLARE
  fam_phone  text := current_setting('care.family_phone');
  care_phone text := current_setting('care.caregiver_phone');
  fam_id     uuid;
  care_id    uuid;
  one_id     uuid;
  two_id     uuid;
  wrong      text;
BEGIN
  IF fam_phone = care_phone THEN
    RAISE EXCEPTION 'family_phone and caregiver_phone must be different numbers';
  END IF;

  SELECT role INTO wrong FROM users WHERE phone_number = fam_phone AND role <> 'family';
  IF FOUND THEN
    RAISE EXCEPTION '% already belongs to a % account; use another number', fam_phone, wrong;
  END IF;
  SELECT role INTO wrong FROM users WHERE phone_number = care_phone AND role <> 'caregiver';
  IF FOUND THEN
    RAISE EXCEPTION '% already belongs to a % account; use another number', care_phone, wrong;
  END IF;

  INSERT INTO users (phone_number, full_name, role, account_status, phone_verified)
  VALUES (fam_phone, 'Sample Family Member', 'family', 'active', TRUE)
  ON CONFLICT (phone_number) DO UPDATE
    SET account_status = 'active', phone_verified = TRUE, updated_at = NOW()
  RETURNING id INTO fam_id;

  INSERT INTO users (phone_number, full_name, role, account_status, phone_verified,
                     verification_status, country_code)
  VALUES (care_phone, 'Sample Caregiver', 'caregiver', 'active', TRUE, 'verified', 'KE')
  ON CONFLICT (phone_number) DO UPDATE
    SET account_status = 'active', phone_verified = TRUE,
        verification_status = 'verified', updated_at = NOW()
  RETURNING id INTO care_id;

  SELECT id INTO one_id FROM elderly_profiles
   WHERE family_member_id = fam_id AND full_name = 'Sample Elder One'
   ORDER BY created_at LIMIT 1;
  IF one_id IS NULL THEN
    INSERT INTO elderly_profiles (family_member_id, full_name, home_address, date_of_birth, medical_notes)
    VALUES (fam_id, 'Sample Elder One', 'House 1, Sample Estate, Nairobi', '1944-05-12',
            'Fictional record, not real clinical data. Type 2 diabetes; metformin with breakfast.')
    RETURNING id INTO one_id;
  END IF;

  SELECT id INTO two_id FROM elderly_profiles
   WHERE family_member_id = fam_id AND full_name = 'Sample Elder Two'
   ORDER BY created_at LIMIT 1;
  IF two_id IS NULL THEN
    INSERT INTO elderly_profiles (family_member_id, full_name, home_address, date_of_birth, medical_notes)
    VALUES (fam_id, 'Sample Elder Two', 'House 2, Sample Estate, Kisumu', '1939-11-03',
            'Fictional record, not real clinical data. Hypertension; walks with a frame.')
    RETURNING id INTO two_id;
  END IF;

  -- The one active assignment. The partial unique index allows only one live
  -- row per caregiver and profile, so "if none" is also what keeps a re-run
  -- from failing.
  IF NOT EXISTS (SELECT 1 FROM assignments
                  WHERE caregiver_id = care_id AND elderly_profile_id = one_id AND status = 'active') THEN
    INSERT INTO assignments (caregiver_id, elderly_profile_id, status, start_date)
    VALUES (care_id, one_id, 'active', CURRENT_DATE);
  END IF;
END $$;

COMMIT;

-- The profile ids, and which of them the caregiver may reach. Elder Two's id is
-- the one to ask for as the caregiver: a record that exists and is not theirs
-- must answer exactly as one that does not exist.
SELECT p.full_name AS profile, p.id,
       EXISTS (SELECT 1 FROM assignments a JOIN users c ON c.id = a.caregiver_id
                WHERE a.elderly_profile_id = p.id AND a.status = 'active'
                  AND c.phone_number = :'caregiver_phone') AS caregiver_assigned
  FROM elderly_profiles p JOIN users f ON f.id = p.family_member_id
 WHERE f.phone_number = :'family_phone' AND p.full_name IN ('Sample Elder One', 'Sample Elder Two')
 ORDER BY p.full_name;
