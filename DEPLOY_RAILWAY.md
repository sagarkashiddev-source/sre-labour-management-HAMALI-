# Deploying to Railway

This app now deploys as **one Railway service** (Express serves both the
API and the built frontend) **plus one Postgres database** — the simplest
and most reliable shape for an app this size, and it sidesteps cross-site
cookie issues entirely since everything is on the same domain.

## 1. Push this to a GitHub repo

Railway deploys from GitHub. Push the whole `sre/` folder (with the new
root `package.json`) as your repo — either as the repo root, or as a
subfolder if it's part of a bigger repo (in that case set the service's
**Root Directory** to `sre/` in Railway's settings).

## 2. Create the Railway project

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → pick your repo.
2. Add a database: **+ New → Database → PostgreSQL**. Railway provisions it
   and exposes its connection details automatically.
3. On your app service, go to **Variables** and add:
   - `DATABASE_URL` — click "Add Reference" and point it at the Postgres
     service's `DATABASE_URL` (don't type it by hand; this keeps it in
     sync if Railway ever rotates it).
   - `JWT_SECRET` — a long random string (e.g. `openssl rand -hex 32`).
   - `JWT_EXPIRES_IN` — `8h` (optional, that's already the default).
   - `NODE_ENV` — `production`.
   - You do **not** need `CORS_ORIGINS` or `VITE_API_URL` for this
     single-service setup — same-origin requests don't need CORS at all.
   - You do **not** need to set `PORT` — Railway injects it, and the app
     already reads `process.env.PORT`.

## 3. Build & start commands

Railway's Nixpacks builder auto-detects the root `package.json` and runs
its `build` then `start` scripts — you shouldn't need to set anything
manually. If it doesn't auto-detect, set these explicitly in
**Settings → Deploy**:

- Build command: `npm run build`
- Start command: `npm run start`

(`npm run build` builds the frontend, then the backend, then generates the
Prisma client. `npm run start` runs `prisma migrate deploy` — applying any
pending migrations against the live database — then starts the server.)

## 4. First deploy — create the real Admin account and companies list

**Do not run `prisma:seed` against this database.** That script creates
demo Admin/Owner/Labour accounts with a fixed, publicly-documented password
(`Password123!`, visible in this repo) — fine for a throwaway local dev
database, but it would mean the real production Admin login is a password
anyone with repo access already knows. The script itself now refuses to
run when `NODE_ENV=production` as a backstop, but don't rely on that guard
— just don't run it here.

Instead, create the one real Admin account with a properly random,
one-time-shown password:

```bash
railway login
railway link          # pick this project
railway run npm --prefix backend run prisma:bootstrap-admin \
  -e ADMIN_NAME="Sagar" -e ADMIN_PHONE="9922297341" -e ADMIN_EMAIL="admin@sre.local"
```

This prints a randomly generated password to your terminal **exactly
once** — copy it into a password manager immediately; it is never stored
anywhere and cannot be recovered by re-running the command. (If you'd
rather supply your own password from a secrets manager instead of a
generated one, set `ADMIN_PASSWORD` — it must be at least 12 characters.)
Running it again after the Admin account already exists is a no-op that
exits with an error rather than silently resetting the password.

Then load the real companies list (safe to run any time — it only adds
missing companies by name, never touches users or existing data):

```bash
railway run npm --prefix backend run import:companies
```

Once the app has an in-app "create user" flow available (Admin → Users),
use the Admin account you just created to add the real Owner and Labour
accounts through the UI, each with their own password — not through a
seed script.

## 5. Domain

Railway gives you a free `*.up.railway.app` domain immediately under
**Settings → Networking → Generate Domain**. You can attach a custom
domain from the same screen later (add a CNAME at your DNS provider).

## 6. Logging in

Visit the generated URL — you'll land on `/login`. Log in with the Admin
phone number and the password `prisma:bootstrap-admin` printed for you in
step 4 (not a fixed demo password — there isn't one on this deployment).

## A note on Railway itself

Railway is a solid, easy fit for an internal tool like this one — usage-based
pricing, one-click Postgres, auto-deploys on git push. If this ever grows
into something where downtime is costly (this is a live payroll/logistics
tool, so worth keeping an eye on), it's worth periodically checking
Railway's own status page and keeping an eye on your Postgres backups
(Settings → Backups on the database service) regardless of which host you use.
