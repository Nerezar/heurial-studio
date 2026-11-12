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

Status (2026-11-12): the site side (`/admin`, sign-in, `/api/admin/*`) is merged into `main` and tested end to end against
the local stand-in back end. `pipeline` and `daily-digest` are deployed to Catalyst **Development** only. Until the
variables in step 3 are set on the Slate app, `/admin` shows "Sign-in isn't set up yet" and nothing else is reachable.

**Deploy this to Production.** Project-Rainfall's Production environment is active (site at
`heurial-mmoiyutd.onslate.com`, with its own `Inquiries` table). Do every step below in Production, not Development:
the tables, the functions, the variables, the Mail sender and the cron. The CLI's `catalyst deploy` only deploys to
Development, so deploy there first, test, then promote to Production from the Catalyst console the same way the site and
`inquiries` were promoted. `www.heurial.studio` already points to Production, so the tracker must read Production's
`Inquiries` table: use the Production pipeline URL everywhere.

**Deploy the current `functions/pipeline`.** The tracker reads three things from `/data` that older versions don't
return: `time` (every time entry), `messages` (the message log) and `services` (what is connected). With an older
function the tracker still opens, but the Time page is slower and Connections can't show what's connected.

## 1. Create three tables (Catalyst console → CloudScale → Data Store)

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
| `phone`          | Var Char 40   |

**`TimeEntries`**:

| Column       | Type          | Notes                          |
| ------------ | ------------- | ------------------------------ |
| `lead_id`    | Var Char 20   | The lead's ROWID, kept as text |
| `entry_date` | Var Char 10   |                                |
| `hours`      | Double        |                                |
| `note`       | Var Char 300  |                                |

**`Messages`**: the log of notes, calls, emails and texts for each lead:

| Column       | Type          | Notes                                                        |
| ------------ | ------------- | ------------------------------------------------------------ |
| `lead_id`    | Var Char 20   | The lead's ROWID as text. Empty for an unmatched incoming message |
| `direction`  | Var Char 4    | `out` (from you) or `in` (from them)                         |
| `channel`    | Var Char 10   | `note`, `email`, `sms` or `call`                             |
| `subject`    | Var Char 200  | Emails only                                                  |
| `body`       | Text          |                                                              |
| `status`     | Var Char 12   | `logged`, `sent`, `received`, or `draft` (an AI draft waiting for you) |
| `sender`     | Var Char 254  | Who an incoming message came from                            |
| `created_at` | Var Char 30   | ISO date and time                                            |

The tracker works before `Messages` exists and before `Leads` has a `phone` column: Connections shows the message log
as "Not connected", and leads save as long as the phone field is left empty. Add both when you want messages.

**`PushSubscriptions`**: one row per device with notifications turned on (optional, for notifications):

| Column       | Type          | Notes                                                 |
| ------------ | ------------- | ----------------------------------------------------- |
| `endpoint`   | Text          | The browser's push address. Can be longer than 255 characters |
| `p256dh`     | Var Char 200  | The browser's public key                              |
| `auth`       | Var Char 64   | The browser's auth secret                             |
| `device`     | Var Char 120  | A label such as "iPhone or iPad (app)"                |
| `created_at` | Var Char 30   | ISO date and time                                     |

`Inquiries` already exists. The tracker only changes its `status` column (`new` → `converted` or `dismissed`).

For all of these tables, check **Scopes & Permissions**: no end-user role may read or write.

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
|                                        | `MESSAGES_FROM`         | optional: a sender verified in Catalyst Mail. Turns on **Email to leads** |
|                                        | `MESSAGE_WEBHOOK_URL`   | optional: `https://` address of a service that sends a text. Turns on **Text messages** |
|                                        | `MESSAGE_WEBHOOK_KEY`   | optional: sent to that service as `X-Heurial-Key` so it can check the request is yours |
|                                        | `INBOUND_KEY`           | optional: a new random secret. Turns on **Incoming email** (and the generic `/inbound` route) |
|                                        | `TWILIO_ACCOUNT_SID`    | optional: from the Twilio console. With the next two, turns on **Text messages** through Twilio |
|                                        | `TWILIO_AUTH_TOKEN`     | optional: from the Twilio console. Also checks the signature on incoming texts |
|                                        | `TWILIO_FROM`           | optional: your Twilio phone number, e.g. `+15125550100` |
|                                        | `TWILIO_WEBHOOK_URL`    | optional: `<pipeline function URL>/twilio/sms`, exactly as entered in Twilio. Turns on **Incoming texts** |
|                                        | `VAPID_PUBLIC_KEY`      | optional: from `node scripts/make-vapid-keys.mjs`. With the next one, turns on **Notifications** |
|                                        | `VAPID_PRIVATE_KEY`     | optional: from the same command. A secret |
|                                        | `ANTHROPIC_API_KEY`     | optional: an API key from console.anthropic.com. Turns on **AI reply drafts** |
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

### Connecting messages

Each lead has a Messages tab. With nothing connected it is a log: you write a note, log a call, or write an email or
text and send it yourself ("Open in mail app"). The Connections page in the tracker shows what is switched on.

- **Email to leads** (`MESSAGES_FROM`): the tracker sends the email through Catalyst Mail and marks it "Sent". If
  sending fails, nothing is saved, so the log never claims an email went out when it didn't.
- **Text messages** (Twilio): set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. Texts go out through
  Twilio's Messages API from your Twilio number. US numbers written any common way are sent as `+1…`; other countries
  need the `+` and country code in the lead's phone field. If Twilio refuses the text, nothing is saved.
  Without Twilio, `MESSAGE_WEBHOOK_URL` still works: the function POSTs
  `{ "channel": "sms", "to": "<the lead's phone>", "body": "...", "lead": { "id": "...", "name": "..." } }` to that
  address (with `MESSAGE_WEBHOOK_KEY` as `X-Heurial-Key`), and any 2xx answer counts as sent.
- **Incoming texts** (Twilio): in the Twilio console, open your number → Messaging → "A message comes in" → Webhook,
  HTTP POST, and enter `<pipeline function URL>/twilio/sms`. Put the same address, character for character, in
  `TWILIO_WEBHOOK_URL`: Twilio signs each request with your auth token and that exact URL, and the function refuses
  anything whose signature doesn't match. No automatic reply is sent back.
- **Incoming email** (`INBOUND_KEY`): use a mail provider with an inbound webhook (Postmark, Mailgun or SendGrid
  Inbound Parse). Point it at `<pipeline function URL>/inbound/email?key=<INBOUND_KEY>`, and send replies to the
  inbound address it gives you (for example by setting it as the Reply-To on emails you send). The function takes the
  sender, subject and the new part of the reply; quoted earlier messages and attachments are dropped. The key is in
  the URL because these providers can't add headers, so treat that URL like a password.
- **Any other service** (`INBOUND_KEY`): can post to `<pipeline function URL>/inbound` with the header
  `X-Heurial-Inbound-Key: <INBOUND_KEY>` and a JSON body
  `{ "channel": "email" | "sms", "from": "...", "subject": "...", "body": "..." }`.

Incoming messages are matched to a lead by email address, or by the last 10 digits of the phone number, and appear in
that lead's thread. Anything that doesn't match is kept and listed under Messages as "not matched to a lead". The
inbound key and the Twilio signature can only add incoming messages; they can't read or change anything else. These
routes are called directly on the function, not through the website.

### AI reply drafts

With `ANTHROPIC_API_KEY` set, a lead's Messages tab shows **Draft with AI** when you choose Email or Text. Claude
(`claude-opus-5-5`) reads the lead's details and the last 20 messages in the thread and writes the next message.
Anything typed in the message box first is passed along as instructions ("say yes to Tuesday, ask for their booking
link").

The draft is saved to the thread as a draft. Nothing is sent on its own. You can edit it, then:
- **Approve and send** when sending for that channel is connected and the lead has an address or number;
- **Mark as sent** otherwise (after "Open in mail app" or sending it yourself); or
- **Discard** it.

Messages from leads are treated as data, not instructions, and a draft never goes anywhere without your approval.
Each draft is one API call, billed to the Anthropic account that owns the key. If Claude declines a request, the
tracker says so and you write that one yourself. The website allows up to 45 seconds for a draft.

### The app on your phone, and notifications

The tracker installs as an app (a PWA): its own icon, full screen, no App Store.
- **iPhone or iPad:** open `https://www.heurial.studio/admin` in Safari, tap Share, then **Add to Home Screen**.
  Open it from the Home Screen and sign in once.
- **Android, Chrome or Edge on a computer:** open `/admin` and choose **Install** (Connections → This device has a
  button when the browser offers it).

Notifications need `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and the `PushSubscriptions` table. Then, on each device,
open Connections → This device → Notifications → **Turn on**, and **Send test**. On iPhone this only works from the
installed app (iOS 16.4 or later). You get a notification for:
- a new website inquiry (the website asks the pipeline function after it saves one);
- an incoming email or text from a lead, or from an unmatched sender.

Tapping a notification opens the tracker on that lead's messages. Notifications carry the sender's name and the
first line of the message; they are encrypted between the function and your device. The service worker
(`/admin-sw.js`) shows notifications only and caches nothing. Making new VAPID keys means turning notifications on
again on every device.

## 4. Schedule the daily email

Catalyst console → **Job Scheduling**: create a job pool, add a job that runs `daily-digest`, and a **cron** that runs
it **daily** (for example 7:30 AM Central). Then run it once by hand and check your inbox.

## 5. Deploy the site and check

The site code is already on `main`. Redeploy the Slate app with the step 3 variables set, then:

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
8. Point the custom domain `www.heurial.studio` at the **Production** Slate deployment, then repeat the test from step 6
   on `www.heurial.studio`. Until this is done, real visitors' inquiries keep landing in Development.

Progress: steps 1–6 are done for the site and `inquiries`, and step 8 is done (`www.heurial.studio` serves Production,
reported by ChatGPT on 2026-11-11). For the tracker (2026-11-12): `pipeline` and `daily-digest` are deployed to
Development only; the `Leads` and `TimeEntries` tables, the variables, the Mail sender and the cron still need to be set up
in Production, and the functions promoted there.
