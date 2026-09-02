# Deploying to Render

This app deploys as **one Render Web Service** (Express serves both the
API and the built frontend — see `backend/src/index.ts`'s static-serving
block) talking to a **Render Postgres** database. Since your Postgres is
already on Render (`hamaliadatabase`, per the migration logs), this is
actually a more natural fit than the earlier Railway setup — everything
lives in one place, and you avoid any cross-provider network hop between
the app and the DB.

One service, not two: you do **not** need a separate Static Site for the
frontend. The backend serves `frontend/dist` itself on the same origin,
which matters because the login cookie is `sameSite: 'lax'` — that only
works reliably same-origin.

## 1. Push this to a GitHub repo

Render deploys from GitHub (or GitLab/Bitbucket). Push the whole `sre/`
folder, including the root `package.json` — either as the repo root, or as
a subfolder (in that case set **Root Directory** to `sre` in step 3).

## 2. Confirm your existing Postgres database

You already have `hamaliadatabase` running on Render
(`dpg-dab6nbjtqb8s73eve4qg-a.ohio-postgres.render.com`, per the deploy
logs) — nothing to create here. Open that database in the Render
dashboard and copy its **Internal Database URL** from the Connect tab (use
the *internal* one, not external — the web service and the database will
be in the same Render region, so internal networking is faster and free).
Keep this tab open; you'll paste it as `DATABASE_URL` in step 4.

If you're starting fresh instead: **New → PostgreSQL**, pick a name/region/plan,
then use its Internal Database URL the same way.

## 3. Create the Web Service

1. **New → Web Service** → connect your repo.
2. **Root Directory**: `sre` (or leave blank if the repo root *is* `sre/`).
3. **Runtime**: Node.
4. **Build Command**:
   ```
   npm run build
   ```
5. **Start Command**:
   ```
   npm run start
   ```
   (This runs `prisma migrate deploy` first, then starts the server — same
   as the Railway setup. See `package.json` at the repo root.)
6. **Instance Type**: whatever plan fits (Free tier works for testing, but
   spins down on idle — expect a ~30–60s cold-start delay on the first
   request after inactivity; upgrade to a paid instance before real use.)

Render auto-detects Node and injects `PORT` itself — the app already reads
`process.env.PORT` in `backend/src/config/env.ts`, so you don't set that
yourself.

## 4. Environment variables

On the Web Service → **Environment**, add:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Internal Database URL from step 2 |
| `JWT_SECRET` | a long random string — generate one with `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | `8h` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | leave empty/unset for now (same-origin deploy doesn't need it — see note below) |

**Do not set `PORT` yourself** — Render assigns it and the app already
respects whatever value it gets.

> `CORS_ORIGINS` only matters if you ever split the frontend onto a
> different origin (a separate Static Site, a custom domain that doesn't
> match, etc.). For this one-service setup, requests never cross origins,
> so it can stay empty. If you later add one, set it to that origin's full
> URL (e.g. `https://sre-admin.onrender.com`).

## 5. First deploy — create the real Admin account

Deploy the service (Render does this automatically once you save the
settings above). Watch the **Logs** tab.

**If you see `Error: P3009` in a crash loop** — a migration is stuck in a
failed state from a previous deploy attempt (this exact thing happened on
the Railway deploy against this same database — see
`DEPLOY_RAILWAY.md`'s troubleshooting section for the full explanation).
Fix it once via Render's **Shell** tab (or your own machine with
`DATABASE_URL` set to the *external* connection string temporarily):

```bash
npm --prefix backend run prisma:migrate:resolve-rolled-back -- 20260821_add_duplicate_entry_guard
```

Then trigger a redeploy (**Manual Deploy → Deploy latest commit**).

Once it deploys cleanly, create the real Admin account — **never** run
`prisma:seed` here (see its own guard/warning; it's demo-only, fixed
password). Use Render's **Shell** tab on the running service:

```bash
ADMIN_NAME="Sagar" ADMIN_PHONE="9922297341" ADMIN_EMAIL="admin@sre.local" \
  npm --prefix backend run prisma:bootstrap-admin
```

This prints a randomly generated password **once** — save it immediately,
it's not recoverable afterwards. (Or set `ADMIN_PASSWORD` yourself first if
you'd rather supply one from your own secrets manager.)

Then load the companies list (safe to re-run anytime):

```bash
npm --prefix backend run import:companies
```

## 6. Health check (recommended)

Render can ping a path to know the service is actually up before routing
traffic to it. On the Web Service → **Settings → Health Check Path**, set:

```
/health
```

(Already implemented in `backend/src/index.ts` — returns `{ ok: true }`.)

## 7. Domain

Render gives you `<service-name>.onrender.com` automatically. For a custom
domain: **Settings → Custom Domains → Add**, then follow the DNS
instructions Render shows you (a `CNAME` for a subdomain, or Render's
anycast IPs for an apex domain).

## 8. Logging in

Visit the service's URL — you'll land on `/login`. Log in with the Admin
phone number and the password `prisma:bootstrap-admin` printed in step 5.

## Keeping Railway and Render in sync (if running both)

If you're moving from Railway to Render rather than running both, just
point DNS/your custom domain at the new Render service and can tear down
the Railway one once you've confirmed Render is healthy. If you genuinely
want both running against the same database temporarily (e.g. to compare),
that's fine — they're stateless app servers hitting the same Postgres, no
conflict — just be aware both will attempt `prisma migrate deploy` on
every deploy, so avoid deploying both at the exact same moment the first
time you add a new migration (whichever runs first wins that race; the
second's `migrate deploy` will just see everything already applied and
proceed normally).

## Troubleshooting: "Error: P3009 — migrate found failed migrations"

Same issue, same fix as documented in `DEPLOY_RAILWAY.md` — see that file's
dedicated section. Short version: a migration is recorded as
started-but-never-finished in `_prisma_migrations`, `migrate deploy`
refuses to proceed at all until you explicitly resolve it, and that's a
one-time manual step (`prisma migrate resolve --rolled-back <name>`), not
something a redeploy fixes on its own.
