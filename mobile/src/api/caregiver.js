import { api } from './client';
import { route, careApiMode } from './careSource';
import { profiles as profilesApi } from './endpoints';
import { mockCaregiverApi } from './mock/caregiverData';
import { yearsOld } from '../utils/datetime';

/*
 * Every call the caregiver screens make.
 *
 * Where the answers come from -- the service's care module, or the mock that
 * stands in for it until the module exists -- is decided once, in
 * careSource.js, for both portals. Read that file for why the whole module
 * reads from one source rather than mixing live and fixture data, and why it
 * falls back on a 404 but never on a 500 or a dead network.
 *
 * Re-exported here so the code and tests written against this file in #44 do
 * not have to move.
 */
export { careApiSource, __resetCareApiForTests } from './careSource';

/*
 * ─────────────────────────── shape adapters ───────────────────────────
 *
 * The service answers in snake_case and the screens read camelCase, and the
 * translation belongs here rather than in a component. Each one is written
 * against the shape the care module is specified to return; if it returns
 * something else, this is the file that is wrong, which is the point.
 */

const asRecipient = (row) => ({
  id: row.id,
  reference: row.reference ?? null,
  fullName: row.fullName ?? row.full_name,
  age: row.age ?? null,
  dateOfBirth: row.dateOfBirth ?? row.date_of_birth ?? null,
  conditions: row.conditions ?? [],
  status: row.status ?? 'stable',
  address: row.address ?? row.homeAddress ?? row.home_address ?? null,
  since: row.since ?? row.startDate ?? row.start_date ?? null,
  visitCount: row.visitCount ?? row.visit_count ?? 0,
  lastVisitAt: row.lastVisitAt ?? row.last_visit_at ?? null,
  medications: row.medications ?? [],
  careNotes: row.careNotes ?? row.care_notes ?? [],
  emergencyContacts: row.emergencyContacts ?? row.emergency_contacts ?? [],
});

const asVisit = (row) => ({
  id: row.id,
  recipientId: row.recipientId ?? row.recipient_id,
  recipientName: row.recipientName ?? row.recipient_name ?? null,
  recipientReference: row.recipientReference ?? row.recipient_reference ?? null,
  recipientStatus: row.recipientStatus ?? row.recipient_status ?? null,
  recipientAddress: row.recipientAddress ?? row.recipient_address ?? null,
  kind: row.kind ?? 'Visit',
  location: row.location ?? null,
  scheduledFor: row.scheduledFor ?? row.scheduled_for,
  status: row.status ?? 'upcoming',
  checkInAt: row.checkInAt ?? row.check_in_at ?? null,
  checkOutAt: row.checkOutAt ?? row.check_out_at ?? null,
  tasks: (row.tasks ?? []).map((t) => ({
    id: t.id, label: t.label, done: Boolean(t.done),
  })),
});

/*
 * ───────────────────── the roster, without a care module ─────────────────────
 *
 * ── The bug this exists to fix ──
 *
 * Who a caregiver is assigned to is not care-module data. It is in
 * auth-service today, in `assignments`, and GET /profiles already answers it
 * scoped to the caller -- resourceAccess.listAccessibleProfiles joins through
 * active, in-window assignments and returns nothing else.
 *
 * Before this, "My Assignments" did not ask. The care module is not mounted,
 * so `route` sent the whole call to the fixture, and a caregiver with one real
 * assignment was shown three people who do not exist while "Care Profiles",
 * two taps away, showed the one who does. Two screens, one account, two
 * different answers to "who do I look after" -- and the fictional one was the
 * screen you file a visit report from.
 *
 * ── Why this is not the mixing careSource.js warns about ──
 *
 * That warning is about a screen where the name is real and the visit count is
 * invented, with no way to tell which is which. Nothing here is invented. The
 * roster is real, and every fact the service does not have comes back `null`
 * -- no status, no visit count, no last visit, no date the assignment began --
 * for the screens to render as absent. An unknown shown as unknown is not the
 * failure mode; a 'stable' nobody assessed would be.
 *
 * ── When it does and does not apply ──
 *
 * Only when the mode is 'auto' and the fallback happened because the care
 * module answered 404. Pinned to 'mock' the app is a demo, possibly with no
 * service behind it at all, and it keeps the full fixture caseload; see
 * careApiMode.
 */

/** A GET /profiles row, as the caregiver screens read a recipient. */
const asAssignedProfile = (row) => ({
  id: row.id,
  // The service has no assignment reference to show.
  reference: null,
  fullName: row.fullName ?? row.full_name,
  age: yearsOld(row.dateOfBirth ?? row.date_of_birth),
  dateOfBirth: row.dateOfBirth ?? row.date_of_birth ?? null,
  // `medicalNotes` is one free-text field the family typed. It is not a list
  // of coded conditions and must not be served as one.
  conditions: [],
  medicalNotes: row.medicalNotes ?? row.medical_notes ?? null,
  // Null rather than 'stable'. A care status is a judgement somebody makes
  // about a person, and no one has made this one.
  status: null,
  address: row.homeAddress ?? row.home_address ?? null,
  since: null,
  visitCount: null,
  lastVisitAt: null,
  medications: [],
  careNotes: [],
  emergencyContacts: [],
});

/**
 * The caregiver's real caseload, from the service.
 *
 * `active` equals the count on purpose: /profiles only returns assignments
 * that are active and inside their window, so every row here is an active one.
 */
async function rosterFromProfiles() {
  const payload = await profilesApi.list();
  const recipients = (payload.profiles ?? []).map(asAssignedProfile);
  return {
    count: payload.count ?? recipients.length,
    active: recipients.length,
    recipients,
  };
}

/** The fixture caseload for a demo, the real one for a service with no care module. */
const rosterFallback = () => (
  careApiMode() === 'mock' ? mockCaregiverApi.assignments() : rosterFromProfiles()
);

/**
 * A write, when the care data it would change does not exist.
 *
 * The fixture store can only accept a write about somebody it holds, and a
 * real assignment is not one of its three invented patients -- so it answers
 * "that care recipient is not on your list", which is now exactly backwards:
 * they are the only person on it. The honest answer is that there is nowhere
 * to file this yet, and it is said once here rather than guessed at by each
 * screen's error banner.
 *
 * A demo keeps the fixture's own message, because in a demo it is true.
 */
const NO_CARE_MODULE =
  'Visit reports and care notes need the care module, which is not running yet. Nothing was saved.';

const writeFallback = async (run) => {
  if (careApiMode() === 'mock') return run();
  try {
    return await run();
  } catch (err) {
    if (err?.code !== 'MOCK_FAILURE') throw err;
    const replacement = new Error(NO_CARE_MODULE);
    replacement.code = 'NO_CARE_MODULE';
    replacement.status = 503;
    throw replacement;
  }
};

/*
 * ─────────────────────────── the calls ───────────────────────────
 */

export const care = {
  /**
   * Everything the home dashboard draws, in one request.
   *
   * One call rather than four, because the dashboard has four sections and a
   * caregiver opening the app on a bad connection should wait once, not watch
   * four spinners resolve at four different moments.
   */
  dashboard: () => route(
    async () => {
      const payload = await api.authed.get('/care/dashboard');
      return {
        sessionRisk: payload.sessionRisk ?? null,
        counts: payload.counts ?? { assigned: 0, visitsToday: 0, completedToday: 0 },
        recipients: (payload.recipients ?? []).map((r) => ({
          ...asRecipient(r),
          nextVisitAt: r.nextVisitAt ?? r.next_visit_at ?? null,
          nextVisitId: r.nextVisitId ?? r.next_visit_id ?? null,
        })),
        visits: (payload.visits ?? []).map(asVisit),
        alerts: payload.alerts ?? [],
      };
    },
    /*
     * The same roster, so the dashboard and "My Assignments" cannot disagree
     * about who this caregiver looks after -- which was half of the bug.
     *
     * Everything else on this screen genuinely is care-module data, so without
     * the module it comes back empty rather than invented: no visits today, no
     * alerts, no session risk. A caregiver sees their real people and an
     * honestly empty day.
     */
    async () => {
      if (careApiMode() === 'mock') return mockCaregiverApi.dashboard();
      const { count, recipients } = await rosterFromProfiles();
      return {
        sessionRisk: null,
        counts: { assigned: count, visitsToday: 0, completedToday: 0 },
        recipients: recipients.map((r) => ({ ...r, nextVisitAt: null, nextVisitId: null })),
        visits: [],
        alerts: [],
      };
    }
  ),

  /**
   * The people this caregiver is assigned to.
   *
   * Scoping is the service's job, not a filter applied here: GET /profiles
   * already resolves to the caregiver's active assignments at the database,
   * and the care module's /care/assignments is specified to do the same. A
   * client-side filter would be a check that anyone with the app can remove.
   */
  assignments: () => route(
    async () => {
      const payload = await api.authed.get('/care/assignments');
      const recipients = (payload.recipients ?? payload.profiles ?? []).map(asRecipient);
      return {
        count: payload.count ?? recipients.length,
        active: payload.active ?? recipients.filter((r) => r.status !== 'inactive').length,
        recipients,
      };
    },
    rosterFallback
  ),

  recipient: (id) => route(
    async () => asRecipient((await api.authed.get(`/care/recipients/${id}`)).recipient),
    // Whoever is on the list has to be openable from it. Without this the
    // fixture store is asked for a real profile id it has never heard of and
    // throws, so tapping your own assignment would be an error screen.
    async () => {
      if (careApiMode() === 'mock') return mockCaregiverApi.recipient(id);
      return asAssignedProfile((await profilesApi.get(id)).profile);
    }
  ),

  visits: (params = {}) => route(
    async () => {
      const query = params.recipientId ? `?recipientId=${encodeURIComponent(params.recipientId)}` : '';
      const payload = await api.authed.get(`/care/visits${query}`);
      return { visits: (payload.visits ?? []).map(asVisit) };
    },
    () => mockCaregiverApi.visits(params)
  ),

  visit: (id) => route(
    async () => asVisit((await api.authed.get(`/care/visits/${id}`)).visit),
    () => mockCaregiverApi.visit(id)
  ),

  /** Tick or untick one task. The caller has already drawn the new state; see useOptimisticTasks. */
  setTask: (visitId, taskId, done) => route(
    async () => asVisit((await api.authed.post(`/care/visits/${visitId}/tasks/${taskId}`, { done })).visit),
    () => writeFallback(() => mockCaregiverApi.setTask(visitId, taskId, done))
  ),

  checkIn: (visitId) => route(
    async () => asVisit((await api.authed.post(`/care/visits/${visitId}/check-in`, {})).visit),
    () => writeFallback(() => mockCaregiverApi.checkIn(visitId))
  ),

  checkOut: (visitId) => route(
    async () => asVisit((await api.authed.post(`/care/visits/${visitId}/check-out`, {})).visit),
    () => writeFallback(() => mockCaregiverApi.checkOut(visitId))
  ),

  /** File a visit report. Closes the visit and appends its note to the care record. */
  submitReport: (payload) => route(
    async () => (await api.authed.post('/care/reports', payload)).report,
    () => writeFallback(() => mockCaregiverApi.submitReport(payload))
  ),

  /** A care note, or -- with kind: 'incident' -- an incident report. */
  addCareNote: (payload) => route(
    async () => (await api.authed.post(`/care/recipients/${payload.recipientId}/notes`, payload)).note,
    () => writeFallback(() => mockCaregiverApi.addCareNote(payload))
  ),
};
