# Hosted tracker and daily email: setup

The follow-up tracker, online at `https://www.heurial.studio/admin`, behind your own password.

```
You (browser) ──sign in──▶ /admin page on the site
                             │  every request checks your session cookie
                             ▼
                     /api/admin/* on the site's server ──X-Heurial-Key──▶ Catalyst function "pipeline"
                                                                              │
                                        Data Store: Leads, TimeEntries, Inquiries (from the website form)

Catalyst job "daily-digest" (every morning) ──▶ pipeline /digest ──▶ Catalyst Mail ──▶ your inbox
```

- Website inquiries land in **Needs you → New from the website**. You choose **Add to pipeline** (it becomes a lead,
  with the source carried over and a "Reply to schedule the call" follow-up for today) or **Dismiss**. Nothing turns
  into a lead without you.
- The daily email lists new inquiries, calls that need a status, overdue and today's follow-ups, the week ahead, and the
  last 7 days' numbers. **Email preview** in the tracker shows it first. Nothing sends automatically except the
  scheduled job you set up.
- The browser never sees the pipeline key. Search engines are told not to index `/admin`.

Status (2026-11-11): built and tested locally against a stand-in back end. **Not deployed.** Nothing below has been run
against Project-Rainfall.

## 1. Create two tables (Catalyst console → CloudScale → Data Store)

**`Leads`**: all optional, no public access:

| Column           | Type          |
| ---------------- | ------------- |
| `name`           | Var Char 120  |
| `business`       | Var Char 120  |
| `email`          | Var Char 254  |
| `source`         | Var Char 60   |
| `status`         | Var Char 20   |
| `booked_at`      | Var Char 10   |
| `call_at`        | Var Char 10   |
| `follow_up_at`   | Var Char 10   |
| `follow_up_note` | Var Char 300  |
| `value_cents`    | BigInt        |
| `notes`          | Text          |
| `inquiry_id`     | Var Char 36   |

**`TimeEntries`**:

| Column       | Type          | Notes                          |
| ------------ | ------------- | ------------------------------ |
| `lead_id`    | Var Char 20   | The lead's ROWID, kept as text |
| `entry_date` | Var Char 10   |                                |
| `hours`      | Double        |                                |
| `note`       | Var Char 300  |                                |

`Inquiries` already exists. The tracker only changes its `status` column (`new` → `converted` or `dismissed`).

For all three tables, check **Scopes & Permissions**: no end-user role may read or write.

## 2. Deploy the two functions (from `catalyst/`)

```sh
cd functions/pipeline && npm install && node --test && cd ../..
catalyst deploy --only functions:pipeline,functions:daily-digest
```

The pipeline tests run without Catalyst. `dev-server.js` is a local stand-in for development only. Catalyst ignores
it (the entry point is `index.js`), but don't point anything real at it.

## 3. Secrets and settings

Make a new secret for the pipeline (different from the inquiry key):

```sh
umask 077; node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" > ~/.heurial-secrets/pipeline-key
pbcopy < ~/.heurial-secrets/pipeline-key
```

| Where                                  | Variable                | Value                                                     |
| -------------------------------------- | ----------------------- | --------------------------------------------------------- |
| Function `pipeline`                    | `PIPELINE_KEY`          | the pipeline secret                                       |
|                                        | `DIGEST_FROM`           | a sender address verified in **Catalyst Mail**            |
|                                        | `DIGEST_TO`             | where the daily email goes (e.g. hello@heurial.studio)    |
|                                        | `TRACKER_URL`           | `https://www.heurial.studio/admin`                        |
|                                        | `TIME_ZONE`             | `America/Chicago` (the default)                           |
| Function `daily-digest`                | `PIPELINE_FUNCTION_URL` | the pipeline function URL, ending in `/server/pipeline/`  |
|                                        | `PIPELINE_KEY`          | the pipeline secret                                       |
| Slate app **HEURIAL Studio**           | `PIPELINE_FUNCTION_URL` | same pipeline URL                                         |
|                                        | `PIPELINE_FUNCTION_KEY` | the pipeline secret                                       |
|                                        | `ADMIN_PASSWORD_HASH`   | from `node scripts/hash-admin-password.mjs`               |
|                                        | `ADMIN_SESSION_SECRET`  | from the same command                                     |

`scripts/hash-admin-password.mjs` asks for your tracker password without showing it and prints only the hash and a
session secret. Use a new password of 12+ characters that you don't use anywhere else. Changing
`ADMIN_SESSION_SECRET` signs out every browser.

**Catalyst Mail:** add and verify the sender address (`DIGEST_FROM`) in the console before the first send.

## 4. Schedule the daily email

Catalyst console → **Job Scheduling**: create a job pool, add a job that runs `daily-digest`, and a **cron** that runs
it **daily** (for example 7:30 AM Central). Then run it once by hand and check your inbox.

## 5. Deploy the site and check

Merge branch `tracker-cloud`, redeploy the Slate app, then:

1. Open `/admin`. It should ask for your password.
2. Sign in. The dashboard should load (empty at first) and show any website inquiries under **New from the website**.
3. Add one inquiry to the pipeline, open **Email preview**, then try **Send now** once to confirm Mail works.
4. Sign out. `/admin` should ask for the password again.

## Things to confirm on the first deploy

These follow the Catalyst SDK's own type definitions (`@zcatalyst/datastore`, `@zcatalyst/mail` 1.0.0) and the
job template the CLI generates, but haven't run against your project yet:

- `getPagedRows` paging on real tables, and `getRow` on a missing ID (the store treats a "not found" error as missing).
- `BigInt` and `Double` columns come back as text or numbers. The code accepts both.
- `new Mail().sendMail({ from_email, to_email, subject, content, html_mode: true })` with your verified sender.
- How the Advanced I/O `req.url` looks for nested routes like `/server/pipeline/leads/123`. The handler accepts the
  path with or without the `/server/pipeline` prefix.

## Moving to Production: checklist

Catalyst Development and Production are separate environments with their own data, function URLs and settings.
When promoting:

1. Create the same tables (Inquiries, Leads, TimeEntries) in Production, with no public access.
2. Deploy `inquiries`, `pipeline` and `daily-digest` to Production. Note the new function URLs (no `.development`).
3. Set each function's variables in Production. Use **new** secrets, not the Development ones.
4. Update the Slate app's `INQUIRY_FUNCTION_URL`/`KEY` and `PIPELINE_FUNCTION_URL`/`KEY` to the Production values.
5. Verify the Mail sender in Production. Recreate the job pool and daily cron there.
6. Redeploy the site. Send a `?src=referral` test inquiry, find it in `/admin`, dismiss it.
7. Development rows (including test inquiries) don't move over by themselves. Copy any real ones you want to keep.
