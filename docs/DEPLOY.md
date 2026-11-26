# Deploying LindaCare

Target: one VPS running everything in Docker, HTTPS from Caddy, real SMS from Africa's
Talking, and an Android APK built by EAS.

```
 phone (APK)   ─┐
 browser (web) ─┼─ HTTPS ─▶ Caddy :443 ─┬─ /              dashboard (static)
 Expo web app  ─┘                       ├─ /api/*         ▶ auth-service :3000 ─┬▶ postgres :5432
   (app.<domain>)                       └─ app.<domain>     Expo web (static)   ├▶ redis :6379
                                                                               └▶ ml-engine :5000
```

Only Caddy publishes ports (80, 443). Everything else lives on the internal Docker network.

| Piece | Address | Runs as |
|---|---|---|
| Dashboard + API | `https://<DOMAIN>` and `https://<DOMAIN>/api` | Caddy → auth-service (Node 22) |
| Mobile app, web build | `https://<APP_DOMAIN>` | Caddy, static files |
| Mobile app, Android | APK from EAS (link + QR) | `ke.co.lindacare.app` |
| Risk model | internal only | ml-engine (Python 3.14, Gunicorn) |
| Data | internal only | Postgres, Redis (volumes on the VPS) |

**Status of this setup.** The dashboard build was run from a clean install and passes. The
Docker images, the compose file, the Caddyfile, the scripts and the Expo web export have not
been run (no Docker in the authoring environment), so the first `docker compose up --build`
is their first test. Section 8 lists the likely failures.

---

## 1. On your laptop first

These cannot be done from the VPS.

**1a. Commit the work the service needs.** The auth service will not start from a clean
checkout today: `authController.js` requires `probeGuard.js`, which is still untracked. The
Docker build for the web image also runs `npm ci` for `mobile/`, which fails if
`mobile/package.json` and `package-lock.json` are not committed together.

```powershell
git status
git add auth-service/src/services/probeGuard.js auth-service/index.js auth-service/src/controllers/authController.js auth-service/src/services/securityLayers.js
git add ml-engine/src/app.py ml-engine/models mobile/app.json mobile/package.json mobile/package-lock.json
git add deploy docs docker-compose.yml .dockerignore .gitattributes auth-service/Dockerfile auth-service/.dockerignore ml-engine/Dockerfile ml-engine/.dockerignore ml-engine/requirements-prod.txt mobile/app.config.js mobile/eas.json
```

Check that `git status` shows no `.env` file staged, then commit and push.

**1b. Export the database schema.** The repo's SQL files are migrations on top of a base
schema that is not in any file. Without this step the VPS database is empty.

```powershell
.\deploy\export-schema.ps1
git add deploy/db/initdb/00-schema.sql
git commit -m "chore(deploy): export database schema"
```

Note the PostgreSQL version it prints and set `PG_MAJOR` to the same major in step 4. Read the
table list it prints: if a table holds rows the app needs to start (not accounts or logs), the
VPS needs that data too.

**1c. Africa's Talking, live account.** `OTP_DEV_MODE` is ignored in production, so every code
is a real SMS. Check before anything else:
- You have the **live** app's username and API key (not `sandbox`) and some credit.
- A test SMS to your own number from the AT dashboard arrives.
- Each sign-in costs one SMS; a new device or browser costs two (code, then step-up code).

**1d. Three real phones.** The administrator, a family member and a caregiver each need a
different number that can receive SMS (yours, a teammate's, a second SIM).

---

## 2. The VPS

- Ubuntu 24.04, **2 vCPU and 4 GB RAM** (Hetzner CX22, DigitalOcean 4 GB, or similar). The
  Expo web build needs about 2 GB while building. With less, add swap:
  `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`
- Firewall: allow 22, 80, 443 (and 443/udp). Nothing else.
- Install Docker: `curl -fsSL https://get.docker.com | sh`
- Names. With no domain, use sslip.io, which resolves a name to the IP inside it. For a VPS at
  `203.0.113.7`: `DOMAIN=203-0-113-7.sslip.io` and `APP_DOMAIN=app.203-0-113-7.sslip.io`.
  A real domain is better if you have one: point two A records at the VPS.

## 3. Get the code onto it

```bash
git clone <your repo url> lindacare && cd lindacare
```

A private repo needs a deploy key or a personal access token. Without git access on the VPS,
`scp -r` the repo folder from your laptop instead (leave out `node_modules`, `venv`, `.git`).

## 4. Configure

```bash
cp deploy/stack.env.example .env
nano .env
```

Fill every value. Generate secrets with `openssl rand -hex 32`: one each for `JWT_SECRET`,
`OTP_SECRET`, `NATIONAL_ID_SECRET` and `DB_PASSWORD`. Use **new** values, not the ones from
your laptop. Then `chmod 600 .env`.

## 5. Start

```bash
docker compose up -d --build
docker compose logs -f auth-service      # wait for: Auth service running on port 3000
```

The first build takes 10 to 15 minutes. Caddy gets the certificates on first use, once DNS
resolves and ports 80 and 443 are open.

## 6. Create the accounts

```bash
deploy/create-admin.sh +2547XXXXXXXX "Ops Administrator"
deploy/seed-demo.sh +2547FAMILY +2547CAREGIVER
```

The second command prints the two profile ids and which one the caregiver may reach. Keep
Elder Two's id for the demo. To start again clean, add `reset` as a third argument.

## 7. Check it

```bash
deploy/smoke-test.sh
```

Then by hand: open `https://<DOMAIN>`, sign in as the administrator (SMS, then a second SMS the
first time on a new browser) and look at the audit log. Open `https://<APP_DOMAIN>` and sign in
as the family member.

## 8. When something fails

| Symptom | Cause and fix |
|---|---|
| Certificate invalid or not issued | DNS has not reached the VPS yet, or 80/443 are blocked. `docker compose logs web` shows the ACME error. |
| `auth-service` restarts in a loop | `docker compose logs auth-service`. `Cannot find module '../services/probeGuard'` means step 1a was skipped. `FATAL: JWT_SECRET` means the secret is under 32 characters. |
| `relation "users" does not exist` | The schema file was missing when Postgres first started. It only runs on an empty volume: `docker compose down -v`, add `00-schema.sql`, start again. |
| Postgres exits at first start with a syntax error from the schema file | `PG_MAJOR` is older than the database the dump came from. Set it to the same major and start again from an empty volume. |
| `npm ci` fails in the web image | `mobile/package.json` and `package-lock.json` are out of step. Run `npm install` in `mobile/`, commit both. |
| No SMS arrives | `docker compose logs auth-service \| grep -i sms`. Usual causes: username still `sandbox`, no credit, a number not in `+254…` form. Use the fallback in section 9. |
| Web app cannot reach the service | `APP_DOMAIN` missing from the CORS list, or the web image was built before `DOMAIN` was set. Fix `.env`, then `docker compose up -d --build`. |
| `429` everywhere | The per-IP limit is 600 requests per 15 minutes, and a room full of people on one Wi-Fi shares an address. Wait, or use mobile data. |
| `docker compose build` is killed | Out of memory while building Expo web. Add swap (section 2). |

## 9. Fallback: codes in the logs instead of SMS

If SMS delivery fails on the day, uncomment these two lines in `.env`:

```
APP_ENV=staging
OTP_DEV_MODE=true
```

then `docker compose up -d auth-service`. Codes now print in `docker compose logs -f auth-service`
and nothing is sent. Say so if asked, and do not leave it on after the defence.

## 10. Android APK

Start this **tonight**: the free EAS queue can take 15 to 40 minutes per build.

```powershell
cd mobile
npm install -g eas-cli
eas login
eas init
```

1. If `eas init` says it cannot write the project id, paste it into `mobile/app.json` as
   `expo.extra.eas.projectId`.
2. In `mobile/eas.json`, replace `REPLACE_WITH_DOMAIN` with your `DOMAIN` in both profiles. The
   build refuses to run while the placeholder is there, on purpose.
3. `eas build -p android --profile demo`. Demo mode is on: every role sees every button and
   responses show their status code. Use `--profile preview` for the normal interface.
4. Open the link or QR code from the build page on the phone and allow "install unknown apps".

The APK talks to `https://<DOMAIN>/api` and nothing else. Test sign-in on it over mobile data,
not Wi-Fi, so you know it does not depend on your laptop's network.

## 11. After changes, and after the defence

- Redeploy: `git pull && docker compose up -d --build`
- Database backup: `docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql`
- After the defence: `docker compose down -v` and delete the VPS. With `DEMO_MODE=true` the
  public web app offers every action to every role (the server still refuses them), and the
  data is sample data only.

## 12. Things to know about this deployment

- `TRUST_PROXY=1` is right here because Caddy sits directly in front and replaces any
  client-supplied `X-Forwarded-For`. That is also why impossible travel cannot be forged with a
  header on the deployed system. Test it from a phone on a VPN, or on the local stack as
  Chapter 5's MT-4 did.
- In the mobile app the caregiver's list of assigned people comes from the real `/profiles`
  route. Visits, tasks and care notes are still the stateful mock (`careApi: auto` falls back
  because the service has no care module). Say so plainly if asked.
