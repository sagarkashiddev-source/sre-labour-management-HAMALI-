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

## 4. First deploy — seed the database once

After the first successful deploy, run the seed **once** from your machine
using the Railway CLI, so you get the Admin/Owner/Labour demo accounts and
the 145 cleaned companies:

```bash
railway login
railway link          # pick this project
railway run npm --prefix backend run prisma:seed
```

If you already have real users/companies and just want the companies list
added without touching anything else, use the safer import script instead:

```bash
railway run npm --prefix backend run import:companies
```

## 5. Domain

Railway gives you a free `*.up.railway.app` domain immediately under
**Settings → Networking → Generate Domain**. You can attach a custom
domain from the same screen later (add a CNAME at your DNS provider).

## 6. Logging in

Visit the generated URL — you'll land on `/login`. Use the seeded demo
accounts (`9922297341` / Admin, `9000000001` / Owner, `9000000101` /
Labour, all password `Password123!`) to confirm it's live, then change
those passwords or replace the accounts before handing it to real users.

## A note on Railway itself

Railway is a solid, easy fit for an internal tool like this one — usage-based
pricing, one-click Postgres, auto-deploys on git push. If this ever grows
into something where downtime is costly (this is a live payroll/logistics
tool, so worth keeping an eye on), it's worth periodically checking
Railway's own status page and keeping an eye on your Postgres backups
(Settings → Backups on the database service) regardless of which host you use.
