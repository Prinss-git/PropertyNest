# Deploying PropertyNest

Everything needed to put PropertyNest online, in order. Allow 1–2 days the first time, mostly waiting on
account approvals (SMS sender name, email domain verification, DNS).

## What runs where

| Piece | What it does | Recommended service |
|---|---|---|
| **Web app** | Pages and API (`npm start`) | Render, Railway or Fly.io (Singapore region) |
| **Worker** | SMS, email, alerts, map lookups, listing expiry (`npm run worker`) | Same host, second service |
| **Database** | PostgreSQL 15+ | Neon or Supabase (Singapore region) |
| **Photos** | Uploaded listing photos | Cloudflare R2 |
| **Domain, DNS, CDN, firewall** | propertynest.ph in front of everything | Cloudflare |
| **SMS** | Login codes, inquiry alerts | Semaphore |
| **Email** | Confirmations, password resets, alerts | Resend |
| **Maps** | Map tiles and nearby places | Geoapify |

Rough monthly cost at launch: about $25–60 (two small app services, a starter database plan, R2 and
Geoapify mostly within free tiers), plus SMS at Semaphore's per-message rate and the domain. These are
estimates; check each provider's current pricing.

Both the web app and the worker must run all the time. On Vercel, run only the web app there and the worker
on Railway or Render; the view counter batches in memory, which suits always-on servers best.

## 1. Accounts to create

- [ ] **Domain**: e.g. propertynest.ph from a .ph registrar, with DNS moved to Cloudflare.
- [ ] **Database**: Neon or Supabase project in Singapore. Copy the connection string.
- [ ] **Cloudflare R2**: a bucket (e.g. `propertynest-photos`) and an API token with read/write on it.
      Optional: connect a custom domain like `media.propertynest.ph` to the bucket for faster photos.
- [ ] **Semaphore**: account, API key, and a registered sender name (approval takes a few days).
- [ ] **Resend**: account, API key, and verify the domain you send from (DNS records in Cloudflare).
- [ ] **Geoapify**: account and API key (map tiles and nearby places).
- [ ] **Google** (optional, for "Log in with Google"): OAuth client of type *Web application* in Google
      Cloud Console, with redirect URI `https://propertynest.ph/api/auth/google/callback`.
- [ ] **Support mailbox**: e.g. support@propertynest.ph (Cloudflare Email Routing can forward it for free).
- [ ] **Hosting**: Render, Railway or Fly.io account connected to the GitHub repository.

## 2. Settings

Every setting is listed and explained in [`.env.example`](.env.example). For a live site:

| Setting | Live value |
|---|---|
| `DATABASE_URL` | Connection string from Neon/Supabase: the **direct** one, not the "pooled" one (migrations need it) |
| `SITE_URL` | `https://propertynest.ph` (this turns on the live-site safety checks) |
| `OTP_SECRET`, `IP_HASH_SALT` | New random values (command in `.env.example`); never reuse development ones |
| `OTP_DEV_ECHO` | **Not set** |
| `SMS_PROVIDER`, `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER` | `semaphore`, your key, your approved sender name |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | `resend`, your key, e.g. `PropertyNest <noreply@propertynest.ph>` |
| `SUPPORT_EMAIL` | e.g. `support@propertynest.ph` |
| `STORAGE_DRIVER`, `S3_*` | `s3`; `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto` |
| `MEDIA_BASE_URL` | Optional: `https://media.propertynest.ph` if you connected a domain to the bucket |
| `NEXT_PUBLIC_MAP_TILE_URL` | `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=YOUR_KEY` |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | `Powered by Geoapify \| © OpenStreetMap contributors` |
| `NEARBY_PROVIDER`, `GEOAPIFY_API_KEY` | `geoapify`, your key |
| `CLIENT_IP_HEADER` | `x-forwarded-for` (default), or `cf-connecting-ip` only if the host accepts traffic from Cloudflare alone |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional |
| `NEXT_PUBLIC_SENTRY_DSN` | Error alerts: the DSN from your Sentry project (recommended) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional: readable error traces (source maps) |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | Visitor statistics: the token from Cloudflare Web Analytics |

The web app and the worker **refuse to start** on an https `SITE_URL` if something required is missing or
unsafe (for example on-screen login codes still turned on), and print exactly what to fix.

`NEXT_PUBLIC_*` values and `DATABASE_URL` must also be available **when building**: the build pre-renders
the home page and sitemap from the database, and puts the map tile address into the browser code.

## 3. Deploy

The same code runs both services. On Render or Railway, create two services from the repository with the
root directory set to `web`:

| | Web service | Worker service |
|---|---|---|
| Build command | `npm ci && npx prisma generate && npm run build` | `npm ci && npx prisma generate` |
| Start command | `npm start` | `npm run worker` |
| Release / pre-deploy command | `npx prisma migrate deploy` | – |
| Health check path | `/api/health` | – |
| Settings | all of section 2 | the same settings |

With Docker instead: see the comments at the top of the [`Dockerfile`](Dockerfile). The image hasn't been
built during development (Docker wasn't installed); build it once locally or in CI before relying on it.

**Never run `npm run db:seed` on the live database.** It deletes everything and loads sample data; it refuses
to run on an https site unless `ALLOW_SEED=1` is set.

## 4. First admin

After the first deploy, open a shell on the web service (or run locally with the live `DATABASE_URL`):

```bash
npm run create-admin -- --email you@propertynest.ph --name "Your Name"
```

It prints a one-time password. Log in, then change it under **Account settings**. Add moderators later from
**Moderation → Users** (change their role).

## 5. Domain and Cloudflare

1. Add the domain to Cloudflare; point `propertynest.ph` (and `www`) at the web service as the host instructs.
2. SSL/TLS mode: **Full (strict)**. Turn on "Always use HTTPS".
3. Keep the orange cloud (proxy) on, so Cloudflare caches static files and blocks bad traffic.
4. Add the Resend DNS records for email, and SPF/DKIM so emails don't land in spam.

## 6. Check after going live

Before pointing the real domain at it, run the load test against the deployed copy (from your own computer):
`npm run loadtest -- https://<the host's address>`. It only reads pages. Every row should say "ok".

- [ ] `https://propertynest.ph/api/health` shows `"status":"ok"`.
- [ ] Sign up with a real mobile number: the SMS code arrives.
- [ ] Sign up with email: the confirmation email arrives (check spam too) and the link works.
- [ ] Post a listing with photos and a map pin. Photos appear in the R2 bucket. The listing waits in **Moderation → Review queue**.
- [ ] Approve it: you get the "now live" SMS; the map shows nearby places within a minute.
- [ ] Send an inquiry from another phone: the poster gets an SMS and an email.
- [ ] **Moderation → Jobs** shows scheduled maintenance ran in the last 10 minutes and no failed jobs.
- [ ] The Contact page message arrives at `SUPPORT_EMAIL`.
- [ ] Sentry shows the site as connected: in the Sentry project, use **Verify installation**, or open a page that
      crashes on purpose if you add one; the error should appear within a minute.
- [ ] Cloudflare Web Analytics shows your own visit within a few minutes.

## 7. Keeping it running

- **Backups**: turn on point-in-time recovery on the database (Neon and Supabase include it on paid plans).
  Once a month, restore a backup into a temporary database and check it opens: an untested backup is a guess.
- **Uptime alerts**: point a free monitor (UptimeRobot, Better Stack) at `/api/health`, alerting by SMS or email.
- **Error alerts (Sentry)**: create a free account at sentry.io → new project → platform **Next.js** → copy the DSN into
  `NEXT_PUBLIC_SENTRY_DSN` and redeploy. In the project's **Alerts**, keep "new issue" emails on. Errors on pages, API
  calls, visitors' browsers and background jobs that give up all arrive there, without visitors' IPs or cookies.
- **Visitor statistics (Cloudflare Web Analytics)**: Cloudflare dashboard → **Analytics & Logs → Web Analytics** → add
  the site → copy the token into `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` and redeploy. It counts visits, pages, countries and
  devices with no cookies, so no consent banner is needed. Give your client read access in Cloudflare to see it.
- **Daily glance**: **Moderation → Jobs** (worker alive, no failed jobs) and the Review queue and Support inbox.
- **Logs**: the host's log viewer. Errors on pages show visitors an "Error reference", which matches a log line.

## 8. Updating

1. Work on a branch; push it. GitHub runs the tests (`.github/workflows/ci.yml`).
2. Merge to `master` only when the tests are green. The host deploys `master`.
3. Database changes ship as migrations (`prisma/migrations`) and run automatically through the release command.

To roll back, redeploy the previous version from the host's dashboard. Migrations only ever add things in
this project so far, so the previous version keeps working with the newer database.
