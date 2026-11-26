# LindaCare

**Multi-layer authentication and Isolation Forest anomaly detection for a caregiving platform.**

LindaCare is a passwordless sign-in and session-security system for a platform that connects families with the caregivers who look after their elderly relatives. Care records are some of the most sensitive data a family has, so the platform assumes that a correct one-time code is not, on its own, proof that the right person is signing in. Every sign-in is scored by a machine-learning model, every session is watched while it is open, and every access to a care record is checked against who owns it.

---

## Contents

- [How it works](#how-it-works)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [The anomaly detection model](#the-anomaly-detection-model)
- [Security](#security)
- [Current status and known gaps](#current-status-and-known-gaps)

---

## How it works

```
 ┌──────────────────┐     ┌──────────────────────┐
 │  Mobile app      │     │  Admin dashboard     │
 │  (Expo / RN)     │     │  (React + Vite)      │
 │  family, careg.  │     │  administrators      │
 └────────┬─────────┘     └──────────┬───────────┘
          │        HTTPS / JSON      │
          └────────────┬─────────────┘
                       ▼
            ┌─────────────────────┐   POST /score    ┌────────────────────┐
            │  auth-service       │ ───────────────▶ │  ml-engine         │
            │  Node + Express     │ ◀─────────────── │  Flask + sklearn   │
            └───┬────────────┬────┘  risk + reason   └────────────────────┘
                │            │
        ┌───────▼───┐   ┌────▼──────┐      SMS: Africa's Talking
        │ PostgreSQL│   │   Redis   │      (codes print to the console in dev)
        └───────────┘   └───────────┘
```

There are no passwords. Registration and sign-in are both a one-time code sent by SMS.

### Three layers of defence

| Layer | When it runs | What it does |
|---|---|---|
| **1. Pre-login anomaly detection** | After the correct code is entered, before a session is issued | Builds five behavioural features for the attempt (hour, time deviation from the account's usual pattern, known/unknown country and city, login velocity) and asks the ML engine for a risk score from 0 to 100. Low risk is allowed, medium triggers a **step-up** (a second code), high is **blocked**. An unrecognised device always forces a step-up through a deterministic rule, and impossible travel since the last session can raise the response further; the model can only raise the response, never lower it. |
| **2. Session monitoring** | On every request while a session is open | **Impossible travel**: on token refresh the request's location (offline `geoip-lite`) is compared with the session's last-seen location, and a jump faster than a plausible flight ends the session. **API velocity**: a soft limit returns `429 API_VELOCITY_EXCEEDED`, a hard limit flags the session as abusive and ends it. |
| **3. Resource authorisation** | On every care-record request | Ownership and assignment checks read the caller's role and relationship from PostgreSQL on every request, never from the token alone. Administrators have **no** access to care records. |

Everything the layers decide is written to an append-only **audit trail** with a human-readable explanation (for example "login from an unfamiliar country, unusually high login frequency"), and administrators review it in the dashboard.

Failure modes are chosen on purpose: ownership checks **fail closed** (a database error is a 503, never an allow); velocity checks **fail open** (a Redis outage must not become a full outage); and if the ML engine is slow or down, a sign-in falls back to a medium-risk step-up rather than an error.

---

## Repository layout

```
auth-service/    Node.js + Express API: OTP auth, sessions, the three security layers,
                 admin API, SQL migrations, seed script and integration test runner
ml-engine/       Flask scoring service, trained Isolation Forest + scaler, training
                 notebooks and the synthetic anomaly dataset
frontend/        Administrator dashboard ("Security Console"): React 19 + Vite
mobile/          LindaCare mobile app: Expo / React Native (caregiver and family portals)
SECURITY.md      OWASP Top 10 review of the dashboard and admin API
```

Each of `frontend/` and `mobile/` has its own README with design notes and decisions.

---

## Tech stack

| Part | Technology |
|---|---|
| Auth service | Node.js, Express 5, PostgreSQL (`pg`), Redis (`ioredis`), JWT (HS256), Zod, Helmet, `geoip-lite`, Africa's Talking SMS, Nodemailer (optional email recovery channel) |
| ML engine | Python 3.10+, Flask, scikit-learn (Isolation Forest), pandas, NumPy, joblib |
| Admin dashboard | React 19, Vite, React Router, Recharts, Leaflet, Vitest, Playwright |
| Mobile app | Expo, React Native, React Navigation, React Hook Form, `expo-secure-store`, Jest |

---

## Getting started

### Prerequisites

- Node.js 20 or newer (22 LTS recommended)
- Python 3.10 or newer
- PostgreSQL
- Redis
- For the mobile app: the Expo Go app or an Android emulator

### 1. Clone and install

```bash
git clone https://github.com/cjsinari/LindaCare.git
cd LindaCare

(cd auth-service && npm install)
(cd frontend && npm install)
(cd mobile && npm install)

cd ml-engine
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 2. Create the database

Create a database (for example `lindacare_auth`), then apply the migrations in `auth-service/sql/`.

> **The base schema is not in this repository yet.** The files below are incremental migrations that extend tables such as `users`, `otps`, `sessions` and `audit_logs`, which must already exist. See [Current status and known gaps](#current-status-and-known-gaps).

Apply them in this order:

```bash
cd auth-service
for f in otp_and_lock risk_scoring session_anomaly resource_authz account_actions \
         admin_dashboard anomaly_review hardening mobile_registration account_settings; do
  psql -d lindacare_auth -f sql/$f.sql
done
```

`account_recovery.sql` is deliberately left out: `account_settings.sql` re-states the same OTP purpose list with `phone_change` added, so running `account_recovery.sql` afterwards would remove it and break phone-number changes. The migrations are idempotent, so re-running one is harmless.

To work on the care-profile screens locally, `sql/care/seed.sql` creates a known starting state (a family account with two profiles and an assigned caregiver). It takes phone numbers as arguments; read its header for the `psql` invocation. `sql/care/reset.sql` removes what it created.

### 3. Configure the auth service

Create `auth-service/.env` (it is gitignored). The service refuses to start if `JWT_SECRET` or `OTP_SECRET` is shorter than 32 characters.

```bash
# Generate each secret with:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```ini
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=lindacare_auth
DB_USER=postgres
DB_PASSWORD=<your password>

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

JWT_SECRET=<64 hex chars>
OTP_SECRET=<64 hex chars>
NATIONAL_ID_SECRET=<64 hex chars>

ML_ENGINE_URL=http://localhost:5000

# Development: print codes to the console instead of sending SMS
OTP_DEV_MODE=true
```

A full list of options is in [Configuration](#configuration).

### 4. Run everything

Start each in its own terminal:

```bash
# ML engine (http://localhost:5000)
cd ml-engine && python src/app.py

# Auth service (http://localhost:3000)
cd auth-service && npm run dev

# Admin dashboard (http://localhost:5173, proxies /api to the auth service)
cd frontend && npm run dev

# Mobile app
cd mobile && npm start        # press "a" for Android, or scan the QR code
```

With `OTP_DEV_MODE=true` (and `NODE_ENV` not `production`), one-time codes are printed in the auth-service console instead of being sent by SMS, so no Africa's Talking account is needed to try the system.

### 5. Create an administrator

Administrators cannot self-register: `POST /auth/register` only accepts the `family` and `caregiver` roles. Provision one directly:

```sql
INSERT INTO users (phone_number, full_name, role, account_status, phone_verified, consent_at)
VALUES ('+254700000001', 'Ops Administrator', 'administrator', 'active', TRUE, NOW())
ON CONFLICT (phone_number) DO UPDATE
  SET role = 'administrator', account_status = 'active', phone_verified = TRUE;
```

Sign in to the dashboard with that number and enter the code from the service console. The first sign-in from a new machine asks for a second code (step-up); the device is remembered afterwards.

### Dashboard demo data

The dashboard is only meaningful with a few weeks of traffic in it. The seed script writes realistic security events straight into the database (it refuses to run against a database whose name does not look like a dev or test one unless `--force` is given):

```bash
cd auth-service
node seed.js --days 30          # add data
node seed.js --reset            # remove exactly what was seeded
```

### Pointing the mobile app at the service

Set `expo.extra.apiBaseUrl` in `mobile/app.json`:

| Where the app runs | Value |
|---|---|
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |
| Physical device on the same Wi-Fi | `http://<your-LAN-IP>:3000` |

A physical device also needs the service reachable on your LAN and port 3000 open in the firewall. See [`mobile/README.md`](mobile/README.md) for details.

---

## Configuration

Selected `auth-service` environment variables. Everything except the secrets and database settings has a default.

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET`, `OTP_SECRET` | required, ≥ 32 chars | Token signing and OTP hashing |
| `NATIONAL_ID_SECRET` | required for registration | Key for the HMAC of caregivers' national ID numbers (the ID itself is never stored) |
| `OTP_DEV_MODE` | `false` | Print codes to the console instead of sending SMS or email (ignored when `NODE_ENV=production`) |
| `OTP_TTL_MINUTES` | `5` | Code lifetime |
| `OTP_MAX_REQUESTS` | `3` | Code requests per number per window |
| `TRUST_PROXY` | unset | Number of proxy hops in front of the service. Required for correct client IPs behind a proxy; leave unset when directly exposed |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated browser origin allowlist |
| `ML_ENGINE_URL` / `ML_TIMEOUT_MS` | `http://localhost:5000` / `800` | Where to score logins, and how long to wait |
| `GEO_MIN_DISTANCE_KM` / `GEO_MAX_SPEED_KMH` | `500` / `1000` | Impossible-travel thresholds |
| `API_VELOCITY_SOFT` / `API_VELOCITY_HARD` | `60` / `150` | Per-session requests per window (throttle, then flag and end) |
| `API_VELOCITY_USER_SOFT` / `API_VELOCITY_USER_HARD` | `120` / `300` | Same, per user across sessions |
| `API_VELOCITY_WINDOW_SECONDS` | `60` | Velocity window |
| `SECURITY_FREEZE_ON_BLOCK` | `true` | Freeze an account when the risk engine blocks a sign-in |
| `SECURITY_FREEZE_RISK_THRESHOLD`, `SECURITY_FREEZE_ON_SEVERITIES`, `SECURITY_END_SESSIONS_ON_FREEZE`, `SECURITY_ADMINS_CAN_FREEZE_ADMINS` | see `src/config/securityPolicy.js` | What an anomaly costs an account |
| `AFRICAS_TALKING_USERNAME`, `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_SENDER_ID` | unset | Live SMS delivery |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | unset | Optional email channel for account recovery |

The dashboard reads `frontend/.env.example` (`VITE_API_BASE_URL`, `AUTH_SERVICE_URL`, `VITE_IDLE_TIMEOUT_MINUTES`). The ML engine reads `FLASK_HOST` (default `127.0.0.1`; set `0.0.0.0` only if another container or machine must reach it), `FLASK_PORT` (default `5000`), `FLASK_DEBUG` (off unless set to `1`; never enable it on a server, because Flask's debugger allows remote code execution), `MODEL_PATH` and `SCALER_PATH`.

---

## Testing

| Suite | Command | Notes |
|---|---|---|
| Auth service, integration | `cd auth-service && node runtest.js` | Runs the service against a stubbed ML engine and exercises all three layers, including the admin endpoints and their role checks. Needs a `.env.test` pointing at a throwaway database, plus Redis. (`npm test` in this folder is a placeholder.) |
| Dashboard, unit and component | `cd frontend && npm test` | Vitest. Includes source scans that fail the build if a token is written to browser storage or unsafe HTML APIs are introduced. |
| Dashboard, end to end | `cd frontend && npm run test:e2e` | Playwright. Starts the auth service itself and reads the sign-in codes from its console, so it needs the same `.env.test` database and Redis as the integration suite. Seed first with `npm run seed`. |
| Mobile | `cd mobile && npm test` | Jest (`jest-expo`) |

---

## The anomaly detection model

The scoring service (`ml-engine/src/app.py`) wraps an **Isolation Forest**: an unsupervised model that isolates unusual points with fewer random splits than ordinary ones. It was chosen because labelled attack data for a caregiving platform does not exist, and because it can flag behaviour that has never been seen before.

| | |
|---|---|
| Features (5) | `login_hour`, `time_deviation`, `is_known_country`, `is_known_city`, `login_velocity` |
| Model | 200 trees, `max_features=0.8`, scikit-learn 1.9.1 |
| Training data | Baselines from the [RBA dataset](https://www.kaggle.com/datasets/dasgroup/rba-dataset) (Wiefling et al., 2021) plus calibrated synthetic anomaly injections (12,999 rows) |
| Risk bands | up to 58.9 allow, 58.9 to 88 step-up, above 88 block |
| Selected over | One-Class SVM, Local Outlier Factor and Elliptic Envelope, which it beat on precision, recall, F1 and false-positive rate |

Held-out test performance on the synthetic evaluation set:

| | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|
| Escalation (step-up or block) | 0.596 | 0.556 | 0.58 | 3.8% |
| Block only | 0.900 | 0.244 | n/a | 0.27% |

The two tiers are tuned for different costs. A step-up costs a genuine user one extra code, so escalation favours **recall**. A block locks a genuine user out, so blocking favours **precision**. As a result, 96.2% of normal logins are allowed outright, 3.5% are stepped up and 0.3% are blocked.

Detection depends heavily on the kind of anomaly:

| Anomaly type | Detected |
|---|---|
| Velocity (login bursts) | 100% |
| Combined (several signals at once) | 100% |
| Location (unfamiliar country or city) | 59.0% |
| Time (unusual hour) | 17.5% |
| Device only | 5.3% |

Device-only anomalies are indistinguishable from a user's new phone in the model's feature space, so `is_known_device` and the three features derived from other signals were removed from the model (`login_day_of_week`, `is_foreign_login`, `location_anomaly_score`; the reasons are recorded in the metadata). Unrecognised devices are handled by the auth service's step-up rule instead. The device flag is still sent to `/score` so the explanation text can mention it.

These figures come from a **synthetic** evaluation set, so they describe how the model behaves on injected anomalies, not on real attackers. The dashboard records an administrator's verdict on each flagged event so that the false-positive rate can later be measured on real use rather than quoted from training.

Every score comes with a plain-language reason, for example *"Flagged as medium risk due to: unfamiliar country, unusually high login frequency."* Raw datasets are not committed (see [`ml-engine/data/README.md`](ml-engine/data/README.md) for how to regenerate them); the trained model, scaler and metadata are, in `ml-engine/models/`. The notebooks in `ml-engine/notebooks/` cover exploration, feature engineering, training and synthetic anomaly injection, in order.

---

## Security

[`SECURITY.md`](SECURITY.md) reviews the dashboard and admin API against the OWASP Top 10 (2021) and says plainly where something is not done and why. Highlights:

- One-time codes are stored as HMAC-SHA256 digests, refresh tokens as SHA-256 digests; refresh tokens rotate on every use and a replay ends the session.
- Access tokens are HS256 with the algorithm pinned at verification.
- The dashboard keeps its token in memory only: never in `localStorage`, `sessionStorage` or a readable cookie. The cost is that a page reload returns to the sign-in screen.
- The mobile app stores tokens in the OS keystore via `expo-secure-store`, in a single item.
- CORS is an explicit allowlist; the API's content security policy denies everything.
- Every administrator action requires a recorded reason, and every refusal is audited.
- Phone numbers are masked in administrator lists, and national IDs are never stored.

---

## Current status and known gaps

- **Base database schema.** The migrations in `auth-service/sql/` extend tables that are created elsewhere and are not yet committed. A fresh clone cannot build the database from this repository alone.
- **Tests.** The mobile build and test pass (issue #47) is still to come.
- **Audit trail and database role.** The service connects to PostgreSQL as the database owner, so the append-only audit trigger protects against application bugs, not against someone with superuser access. Moving to a restricted role is the documented next step in `SECURITY.md`.

---

## Author

Cyril-John Sinari ([@cjsinari](https://github.com/cjsinari))
Bsc. Informatics and Computer Science, 2026
Strathmore University
