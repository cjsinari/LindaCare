import { useEffect, useState } from 'react';
import FilterBar from '../dashboard/FilterBar';
import { careRecords } from '../api/endpoints';
import EventsTable from '../dashboard/EventsTable';
import { useFilters } from '../dashboard/FilterContext';

/*
 * The audit log viewer.
 *
 * ── Read-only by construction, not by omission ──
 *
 * There are no edit or delete controls here, and that is not because the
 * interface chose to leave them out. `audit_logs` has a trigger that refuses
 * every DELETE and refuses every UPDATE other than the foreign keys being
 * nulled when an account is removed. The service has no endpoint that could
 * modify a row, so there is nothing for a button to call — an administrator
 * cannot erase the record of their own action even if they find a way past the
 * interface, which is the only version of this guarantee worth having.
 *
 * ── Why this is a separate view from the event feed ──
 *
 * They read the same table. The difference is the question being asked. The
 * event feed is "what is happening on the service"; this is "who did what, and
 * on whose authority" — so it defaults to the longer window and to the acts
 * with a decision-maker behind them, which is what an incident review or an
 * access-accounting request actually needs.
 *
 * ── Quick filters and auto-refresh ──
 *
 * Three one-tap narrowings for watching authorization as it happens: refusals
 * only, care-profile records only, and the last ten minutes. The last one is
 * what keeps a fresh view clean, because older rows cannot be deleted and the
 * time window is the only way to look past them.
 *
 * Auto-refresh re-asks the service every few seconds while it is on, so a row
 * appears while someone acts in the app. The interval stays at four seconds:
 * these requests count against the administrator's own API velocity, and a
 * faster poll could get the presenter's session throttled.
 */
const POLL_MS = 4000;
const RECENT_MS = 10 * 60 * 1000;
export default function AuditLogPage() {
  const { filters, setFilters } = useFilters();

  // Administrator actions and automated decisions are what distinguish this
  // view from the feed; the filter is a default rather than a constraint,
  // because "and what else happened at that moment" is the next question.
  const actorType = filters.actorType || '';

  const [profilesOnly, setProfilesOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [auto, setAuto] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const denyOnly = filters.decision === 'deny';

  useEffect(() => {
    if (!auto) return undefined;
    const timer = setInterval(() => setTick(Date.now()), POLL_MS);
    return () => clearInterval(timer);
  }, [auto]);

  // "Last 10 minutes" is measured from the latest refresh, so the window moves
  // with the clock instead of freezing when the chip was pressed.
  const extraQuery = {
    ...(profilesOnly && { resourceType: 'elderly_profile' }),
    ...(recentOnly && { from: new Date(tick - RECENT_MS).toISOString(), to: undefined }),
  };

  const quick = [
    { key: 'deny', label: 'Decision: deny', on: denyOnly,
      toggle: () => setFilters({ decision: denyOnly ? '' : 'deny' }) },
    { key: 'profiles', label: 'Resource: elderly_profile', on: profilesOnly,
      toggle: () => setProfilesOnly((v) => !v) },
    { key: 'recent', label: 'Last 10 minutes', on: recentOnly,
      toggle: () => { setTick(Date.now()); setRecentOnly((v) => !v); } },
  ];

  return (
    <>
      <FilterBar show={['window', 'severity', 'role', 'search']} />

      <div className="filters" style={{ marginTop: 'calc(var(--s5) * -1 + var(--s3))' }}>
        <div className="segmented" role="group" aria-label="Who acted">
          {[
            { value: '', label: 'Everything' },
            { value: 'administrator', label: 'Administrator actions' },
            { value: 'automated', label: 'Automated decisions' },
            { value: 'user', label: 'Account holders' },
          ].map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              className={`segmented__option${actorType === option.value ? ' segmented__option--on' : ''}`}
              onClick={() => setFilters({ actorType: option.value })}
              aria-pressed={actorType === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters" role="group" aria-label="Quick filters and refresh">
        <div className="segmented" role="group" aria-label="Quick filters">
          {quick.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`segmented__option${chip.on ? ' segmented__option--on' : ''}`}
              onClick={chip.toggle}
              aria-pressed={chip.on}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Auto-refresh">
          <button
            type="button"
            className={`segmented__option${auto ? ' segmented__option--on' : ''}`}
            onClick={() => { setTick(Date.now()); setAuto((v) => !v); }}
            aria-pressed={auto}
          >
            {auto ? `Auto-refresh on (${POLL_MS / 1000}s)` : 'Auto-refresh off'}
          </button>
        </div>
        <CareRecordsProbe />
      </div>

      <EventsTable
        title="Audit log"
        subtitle="Append-only"
        extraQuery={extraQuery}
        refreshKey={tick}
        showResource
        readOnlyNote={
          'This log cannot be edited or deleted — not by hiding the controls, but because the '
          + 'table itself refuses it: a database trigger rejects every delete and every change to '
          + 'a recorded event. An administrator cannot erase the record of their own action. '
          + 'Exporting is recorded here too, since a copy in a file outlives any access control '
          + 'this service has.'
        }
      />
    </>
  );
}

/**
 * Ask for care records with this administrator's token, and show the answer.
 *
 * The expected answer is a refusal: administrators have no clinical access.
 * Shown verbatim (status, code, message) so it can be read against the audit
 * row the same request writes.
 */
function CareRecordsProbe() {
  const [state, setState] = useState(null);

  const run = async () => {
    setState({ busy: true });
    try {
      const data = await careRecords.tryList();
      setState({ status: 200, message: `Allowed: ${data?.count ?? 0} record(s) returned.` });
    } catch (err) {
      setState({ status: err.status, code: err.code, message: err.message });
    }
  };

  const tone = !state || state.busy ? '' : state.status === 200 ? 'ok' : 'refused';

  return (
    <div className="cell-stack">
      <button type="button" className="btn btn--outline btn--sm" onClick={run} disabled={state?.busy}>
        {state?.busy ? 'Asking…' : 'Try to open care records'}
      </button>
      {state && !state.busy && (
        <p role="status" className={`small ${tone === 'refused' ? 'danger' : 'secondary'}`}>
          <strong className="mono">{[state.status, state.code].filter(Boolean).join(' ') || 'No response'}</strong>
          {' '}{state.message}
        </p>
      )}
    </div>
  );
}
