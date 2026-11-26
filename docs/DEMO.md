# LindaCare defence demo

About 8 minutes live. The steps in section 3 are the checklist from the "care-profile screens,
defence-ready" spec (Nov 16, 12 rows), updated for what is actually built. Rows 5 to 10 only work
with demo mode on, because the normal caregiver interface has no Edit, Delete, Care team or New
profile buttons. That is the point of the demo build: the buttons are there, and the server
refuses anyway.

## 1. Before the panel arrives (do this 30 minutes ahead)

1. `deploy/smoke-test.sh` on the VPS: all PASS.
2. `deploy/seed-demo.sh <family> <caregiver> reset` and note Elder Two's id. Paste it into a
   notes file you can reach from the demo machine.
3. Three windows, each signed in **once** now, so the SMS codes (and the one-off step-up code on
   a new browser) are out of the way:
   - **A. Dashboard**, administrator: `https://<DOMAIN>`. Audit log page, **Auto-refresh** on,
     time filter **Last 10 minutes**, **Decision: deny** chip ready.
   - **B. Family member**, normal browser window: `https://<APP_DOMAIN>`. Care Profiles tab.
   - **C. Caregiver**, a **private window** (or a second browser profile): same address.
     On web the session lives in the tab's memory, so **never reload a tab**: it signs out.
4. One account can only be signed in on one device at a time (signing in again ends the other
   session). Do not sign the caregiver in on the phone as well as in window C.
5. The phone with the APK installed, signed in as someone not used above or left on the
   sign-in screen, as proof that the app is a real build.
6. Put windows A and B or C side by side, so the audit rows appear while you act.

## 2. The story in one minute

"LindaCare is passwordless. Three layers protect it: a risk model at sign-in, session
monitoring after it, and ownership checks on every record. I will show the third live, because
that is where a mistake exposes an elderly person's health record, and show the first two from
the audit trail."

## 3. Live walk-through

Say each expected result out loud before you show it.

| # | Window | Do | Expect | Audit row (window A) |
|---|---|---|---|---|
| 1 | B family | New profile, name it **Sample Elder Three** (so `reset` removes it), save | `201`, profile in the list | `profile_created`, allow |
| 2 | B family | Open it, Care team, assign the caregiver's phone | `201` | caregiver assigned |
| 3 | C caregiver | Open Care Profiles | Elder One and Elder Three only, never Elder Two | none (listing is not audited) |
| 4 | C caregiver | Open Elder One | `200`, badge "Assigned caregiver, read-only" | `read`, allow |
| 5 | C caregiver | Edit, change a field, save | `403` in the banner | `write`, deny |
| 6 | C caregiver | Delete, confirm | `403` | `delete`, deny |
| 7 | C caregiver | Care team, try to assign a number | `403` or `404` | `manage`, deny |
| 8 | C caregiver | Open profile by ID, paste **Elder Two's id** | `404` "Care profile not found." | `read`, deny |
| 9 | C caregiver | Open profile by ID, paste a random UUID | `404`, **identical** message to row 8 | `read`, deny, resource id empty |
| 10 | C caregiver | New profile | `403` | `create`, deny |
| 11 | B family | Open Elder Two | `200`, badge "Family owner" | `read`, allow |
| 12 | A admin | Try to open care records (the probe on the dashboard) | `403`, no clinical access | `list`, deny |

What to say at the points that matter:

- **After row 5 and 6:** "The button is only here because this is the demo build. The refusal
  comes from the service, and the profile is unchanged." Open Elder One again to show it.
- **After row 9:** "Rows 8 and 9 are word for word the same. A caller cannot tell a record that
  exists and is not theirs from one that does not exist, so the ID cannot be used to find out
  who is in the system."
- **After row 12:** "Even the administrator cannot read clinical records. Security operators
  see events, not health data."
- On window A, press **Decision: deny**: every refusal you caused is there with its reason.

If a row does not match, do not explain it away. Read the banner aloud, then carry on: the
Chapter 5 text already says defects are reported, not hidden.

## 4. Layers 1 and 2 (about 2 minutes)

Layer 1, sign-in risk. Show a scored sign-in in the audit log or anomaly review: the risk score,
the action taken (allow, step-up or block) and the plain-language reason. If time allows,
sign in from a browser or profile that has never been used. It asks for a second code
(step-up), and the row appears with "unrecognised device".

Layer 2, session monitoring. Use the Chapter 5 evidence (MT-3 and MT-4 screenshots and audit
rows) rather than running it live: 60 requests per minute throttles, 150 flags the session, and
a 6,800 km jump in two minutes ends it. The deployed proxy rewrites `X-Forwarded-For`, so the
impossible-travel test cannot be forged live here by design. To run the velocity test live
anyway, get an access token first, then:

```powershell
$env:BASE_URL = "https://<DOMAIN>/api"; node velocity-test.mjs <accessToken>
```

(`velocity-test.mjs` reads `BASE_URL`, and falls back to `http://localhost:3000`.)

## 5. Questions to expect

| Question | Short answer |
|---|---|
| Why show Edit to a caregiver at all? | Demo mode only. It proves the server, not the screen, is the authority. Hiding a button is usability, not security. |
| Is the care data real? | Profiles, assignments and the audit trail are real and enforced in the database. Visits, tasks and care notes in the app are a stateful mock, because the care module is out of scope. |
| Why 404 and not 403 for Elder Two? | To avoid revealing that a record exists. |
| Why no passwords? | Sign-in is by SMS code, with the risk model deciding when a second code is needed. A password field would be a secret the service never checks. |
| What if the SMS does not arrive? | There is a flagged logging mode for development, documented; it is off in production. |
| What is not covered? | Encryption of address and notes at rest, an account-approval workflow, and the care module itself (stated in scope). |

## 6. If something breaks

| Problem | Do |
|---|---|
| No SMS arrives | Switch to log codes (DEPLOY.md, section 9), about a minute. |
| Venue network blocks the site | Phone hotspot. Or the local stack: auth service, ML engine, Redis and Postgres on the laptop, `apiBaseUrl` set to `http://localhost:3000`, `npx expo start --web -c`, dashboard on 5173. |
| A window signed itself out | Sign in again (SMS), then continue from the row you were on. |
| `429` | You or the room hit the IP limit. Wait a minute, or switch to mobile data. |
| Rows stop appearing in window A | Auto-refresh is off or the tab was signed out. Toggle it, or reload window A only. |
| Rows get confusing after rehearsals | Window A time filter to **Last 10 minutes**. The audit table is append-only, so old rows cannot be deleted. |

Rehearse the whole of section 3 twice before the defence, once ending with `seed-demo.sh ... reset`
so you know the clean-up works.
