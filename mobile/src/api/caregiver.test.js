import { care, careApiSource, __resetCareApiForTests } from './caregiver';
import { api, ApiError } from './client';
import { mockCaregiverApi } from './mock/caregiverData';

/*
 * Which source the caregiver screens read from.
 *
 * The behaviour worth pinning down is not "the mock works" -- it is *when* the
 * app is allowed to fall back to it. Falling back too eagerly is the dangerous
 * direction: a caregiver who is shown three invented patients and a schedule
 * that is not theirs, because the service had a bad five seconds, is being
 * actively misled. An error message is the correct answer there, and these
 * tests are what stop a future "just retry with the mock" from being added
 * without noticing.
 */

jest.mock('./client', () => {
  const actual = jest.requireActual('./client');
  return {
    ...actual,
    api: { authed: { get: jest.fn(), post: jest.fn(), delete: jest.fn() }, get: jest.fn(), post: jest.fn() },
  };
});

const notFound = () => new ApiError('Not Found', { status: 404 });
const serverError = () => new ApiError('Internal Server Error', { status: 500 });
const offline = () => new ApiError('Could not reach LindaCare.', { code: 'NETWORK' });

beforeEach(() => {
  jest.clearAllMocks();
  __resetCareApiForTests(null);     // back to 'auto'
  mockCaregiverApi.latencyMs = 0;
});

describe('deciding where the data comes from', () => {
  /*
   * The roster is not care-module data and is not faked.
   *
   * This is the regression test for the bug where a caregiver with one real
   * assignment was shown the fixture's three invented patients on "My
   * Assignments" while "Care Profiles" showed the real one. The caseload comes
   * from GET /profiles, which auth-service has always answered and already
   * scopes to this caregiver's active assignments.
   */
  it('reads the real caseload from the service when there is no care module', async () => {
    api.authed.get
      .mockRejectedValueOnce(notFound())                    // no care module
      .mockResolvedValueOnce({
        count: 1,
        profiles: [{
          id: 'p1',
          fullName: 'George Tike',
          homeAddress: 'Karen, Nairobi',
          dateOfBirth: '1959-12-08',
          medicalNotes: 'Takes a walk most mornings.',
        }],
      });

    const result = await care.assignments();

    expect(careApiSource()).toBe('mock');
    expect(api.authed.get).toHaveBeenNthCalledWith(1, '/care/health');
    expect(api.authed.get).toHaveBeenNthCalledWith(2, '/profiles');

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].fullName).toBe('George Tike');
    expect(result.recipients[0].address).toBe('Karen, Nairobi');
  });

  it('invents nothing about a person it only has a profile for', async () => {
    api.authed.get
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({
        count: 1,
        profiles: [{ id: 'p1', fullName: 'George Tike', medicalNotes: 'Walks daily.' }],
      });

    const [person] = (await care.assignments()).recipients;

    // Every one of these is a claim the service is in no position to make, so
    // each comes back absent for the screen to draw as absent. A `status` of
    // 'stable' or a `visitCount` of 0 would read as an assessment nobody made.
    expect(person.status).toBeNull();
    expect(person.visitCount).toBeNull();
    expect(person.lastVisitAt).toBeNull();
    expect(person.since).toBeNull();
    // Free text the family typed is not a list of coded conditions.
    expect(person.conditions).toEqual([]);
  });

  it('does not show the fixture caseload to a caregiver who has a real one', async () => {
    api.authed.get
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ count: 0, profiles: [] });

    const result = await care.assignments();

    expect(result.recipients).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('probes once and remembers the answer', async () => {
    api.authed.get.mockRejectedValueOnce(notFound());
    api.authed.get.mockResolvedValue({ count: 0, profiles: [] });

    await care.assignments();
    await care.dashboard();
    await care.visits();

    const probes = api.authed.get.mock.calls.filter(([path]) => path === '/care/health');
    expect(probes).toHaveLength(1);
  });

  it('uses the service when the care module is there', async () => {
    api.authed.get
      .mockResolvedValueOnce({ ok: true })                                   // the probe
      .mockResolvedValueOnce({ count: 1, active: 1, recipients: [{ id: 'x', fullName: 'Ada Nyong' }] });

    const result = await care.assignments();

    expect(careApiSource()).toBe('live');
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].fullName).toBe('Ada Nyong');
    expect(api.authed.get).toHaveBeenLastCalledWith('/care/assignments');
  });

  it('does NOT fall back when the service is merely broken', async () => {
    api.authed.get.mockRejectedValueOnce(serverError());

    // A 500 is not "no care module". Showing fixture data here would be the
    // app quietly lying about whose patients these are.
    await expect(care.assignments()).rejects.toThrow('Internal Server Error');
    expect(careApiSource()).toBe('unresolved');
  });

  it('does NOT fall back when the network is down', async () => {
    api.authed.get.mockRejectedValueOnce(offline());

    await expect(care.dashboard()).rejects.toThrow('Could not reach LindaCare.');
    expect(careApiSource()).toBe('unresolved');
  });

  it('falls back for a single route the module has not implemented yet', async () => {
    api.authed.get
      .mockResolvedValueOnce({ ok: true })        // the module is there
      .mockRejectedValueOnce(notFound())          // but /care/assignments is not
      .mockResolvedValueOnce({ count: 1, profiles: [{ id: 'p1', fullName: 'George Tike' }] });

    const result = await care.assignments();

    expect(result.recipients).toHaveLength(1);
    expect(careApiSource()).toBe('mock');
  });

  /*
   * Whoever is on the list has to be openable from it. The fixture store has
   * never heard of a real profile id and throws when asked, so without its own
   * fallback, tapping your own assignment was an error screen.
   */
  it('opens a real assignment from the list', async () => {
    api.authed.get
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ profile: { id: 'p1', fullName: 'George Tike' } });

    const person = await care.recipient('p1');

    expect(api.authed.get).toHaveBeenLastCalledWith('/profiles/p1');
    expect(person.fullName).toBe('George Tike');
  });
});

describe('pinned to live', () => {
  beforeEach(() => __resetCareApiForTests('live'));

  it('never reaches for the mock, even on a 404', async () => {
    api.authed.get.mockRejectedValueOnce(notFound());

    // What CI runs once the care module exists: a missing route fails the
    // build instead of being papered over by a fixture that always works.
    await expect(care.assignments()).rejects.toThrow();
    expect(careApiSource()).toBe('live');
  });
});

describe('pinned to mock', () => {
  beforeEach(() => __resetCareApiForTests('mock'));

  it('never touches the service at all', async () => {
    const result = await care.dashboard();

    expect(api.authed.get).not.toHaveBeenCalled();
    expect(result.counts.assigned).toBeGreaterThan(0);
  });

  /*
   * A demo keeps the full fixture caseload. 'mock' means there may be no
   * service at all behind the app, so there is no real roster to prefer --
   * which is the distinction careApiMode exists to draw.
   */
  it('keeps the fixture caseload', async () => {
    const result = await care.assignments();

    expect(api.authed.get).not.toHaveBeenCalled();
    expect(result.recipients.map((r) => r.fullName)).toContain('Margaret Wanjiku');
  });
});

describe('shape translation', () => {
  beforeEach(() => __resetCareApiForTests('live'));

  it('reads a snake_case service as happily as a camelCase one', async () => {
    api.authed.get.mockResolvedValueOnce({
      visits: [{
        id: 'v1',
        recipient_id: 'r1',
        recipient_name: 'Margaret Wanjiku',
        scheduled_for: '2026-11-13T11:00:00.000Z',
        check_in_at: null,
        tasks: [{ id: 't1', label: 'Medication', done: 1 }],
      }],
    });

    const { visits } = await care.visits();

    expect(visits[0]).toMatchObject({
      id: 'v1',
      recipientId: 'r1',
      recipientName: 'Margaret Wanjiku',
      scheduledFor: '2026-11-13T11:00:00.000Z',
      checkInAt: null,
      status: 'upcoming',
    });
    // `done: 1` from a database driver has to arrive as a boolean, or a
    // checkbox renders ticked and reports itself as unticked.
    expect(visits[0].tasks[0].done).toBe(true);
  });
});
