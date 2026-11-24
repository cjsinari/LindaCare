import { useAuth } from '../../auth/AuthContext';
import { isDemoMode } from '../../config/demo';

/*
 * What the care-profile screens share.
 *
 * ── Which buttons to draw is not who may press them ──
 *
 * `useProfilePermissions` decides what the interface offers, from what the
 * service already said: `accessVia` on a profile it returned, and the role in
 * the access token. That is usability -- a caregiver is not shown an Edit
 * button the service will refuse.
 *
 * It is never the check. Every action goes to the service, which decides
 * again, and in demo mode every button is drawn for every role precisely so
 * that decision can be watched.
 */

export const ACCESS_LABEL = {
  family_owner: 'Family owner',
  caregiver_assignment: 'Assigned caregiver, read-only',
};

export const ROLE_LABEL = {
  family: 'Family member',
  caregiver: 'Caregiver',
  administrator: 'Administrator',
};

export function useProfilePermissions(profile) {
  const { role } = useAuth();
  const demo = isDemoMode();
  const owner = profile?.accessVia === 'family_owner';
  return {
    role,
    demo,
    canCreate: demo || role === 'family',
    canManage: demo || owner,
  };
}

/** The four editable fields, as the service names them. */
export const PROFILE_FIELDS = ['fullName', 'dateOfBirth', 'homeAddress', 'medicalNotes'];

export const emptyForm = () => ({ fullName: '', dateOfBirth: '', homeAddress: '', medicalNotes: '' });

export const formFrom = (profile) => ({
  fullName: profile?.fullName || '',
  dateOfBirth: profile?.dateOfBirth || '',
  homeAddress: profile?.homeAddress || '',
  medicalNotes: profile?.medicalNotes || '',
});

/**
 * The request body for a form. Blank optional fields are sent as null, which
 * is how the service clears them; the name is always trimmed.
 */
export function bodyFrom(form, { only } = {}) {
  const body = {};
  for (const key of PROFILE_FIELDS) {
    if (only && !only.includes(key)) continue;
    const value = String(form[key] ?? '').trim();
    body[key] = key === 'fullName' ? value : (value || null);
  }
  return body;
}

/** The fields whose value differs from the profile's. */
export function changedFields(form, profile) {
  const before = formFrom(profile);
  return PROFILE_FIELDS.filter((key) => String(form[key] ?? '').trim() !== String(before[key]).trim());
}

/** The service's field-level complaints, keyed by field: `{ fullName: '...' }`. */
export function fieldErrors(err) {
  const out = {};
  for (const d of err?.details || []) {
    if (d?.field && !out[d.field]) out[d.field] = d.message;
  }
  return out;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
