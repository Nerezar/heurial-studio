# Autopilot accounts: setup (Foundation step)

Code: `catalyst/functions/pipeline/accounts.js` (routes `app/*` and `stripe/webhook`), `lib/app-auth.ts` and
`app/api/app/[...path]/route.ts` on the site, page at `/app` (`public/app/`). Plan: `AUTOPILOT-PLAN.md`.

Do everything in **Development** first. Production only on the owner's go-ahead.

## 1. Data Store tables (Catalyst console)

| Table | Columns (all text unless noted) |
| --- | --- |
| `Tenants` | `name`, `plan`, `billing_status`, `created_at`, `time_zone`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_event_at` |
| `Users` | `tenant_id`, `email`, `role`, `created_at` |
| `LoginTokens` | `token_hash`, `user_id`, `email`, `created_at`, `expires_at`, `used_at` |

Give each table the same permissions as `Leads`. Only hashes of sign-in links are stored, never the link.

## 2. Stripe (test mode)

1. In Stripe, switch to test mode (or a sandbox). Make one product, "Autopilot", with three monthly prices:
   Starter, Pro, Business. Placeholder amounts are fine until prices are decided.
2. Add a webhook endpoint: `https://<function URL>/server/pipeline/stripe/webhook`, events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
3. Turn on the customer portal (Settings → Billing → Customer portal), allowing plan switches between the three prices.

## 3. Function environment variables (Catalyst console, never in git)

- `APP_URL`: `https://www.heurial.studio/app` (Development: the Development site's `/app`)
- `STRIPE_SECRET_KEY`: the `sk_test_…` key. The page says "test mode" while it is one.
- `STRIPE_WEBHOOK_SECRET`: the endpoint's `whsec_…`
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`: the `price_…` ids
- `DIGEST_FROM` must be set: sign-in links go out through that Catalyst Mail sender.

## 4. Site environment variable (Slate)

- `APP_SESSION_SECRET`: a long random string, 32+ characters. Make one with `openssl rand -hex 32`.

## 5. Check (Development)

1. Open `/app`, sign up with a real inbox, open the emailed link: the business shows with "Plan: none yet".
2. Choose Pro, pay with Stripe's test card `4242 4242 4242 4242`: back on `/app` the plan reads Pro within a minute.
3. Manage billing → cancel: the plan goes back to none.
4. A second sign-up with another email can't see the first business.

## Local

`dev-server.js` keeps accounts in memory and prints sign-in links in its log instead of emailing them. Set
`STRIPE_SECRET_KEY=sk_test_…` and the three `STRIPE_PRICE_…` ids to try real Stripe test checkout locally.

## Engine step

Code: `engine.js` (events, Outbox, tick), `autopilot.js` (routes), `autopilot-core.js` (a copy of
`public/autopilot/core.js`; a test fails if they differ, so copy the file over after any change).

Tables, with the same permissions as `Leads` (all text unless noted):

| Table | Columns |
| --- | --- |
| `Contacts` | `tenant_id`, `first_name`, `phone`, `email`, `opted_out_at` |
| `AutomationSettings` | `tenant_id`, `automation`, `enabled`, `approve`, `message` |
| `Events` | `tenant_id`, `trigger`, `contact_id`, `payload`, `dedupe_key`, `received_at` |
| `Outbox` | `tenant_id`, `event_id`, `automation`, `contact_id`, `channel`, `body`, `status`, `reason`, `send_at`, `sending_at`, `sent_at`, `attempts` (number), `provider_id`, `error`, `created_at` |

Add to `Tenants`: `hours_open`, `hours_close` (like `08:00`, `20:00`), `booking_link`, `review_link`, `pay_link`.
Make `Events.dedupe_key` unique together with `tenant_id` if the console allows it.

Cron: a job every 5 minutes that sends `POST …/server/pipeline/autopilot/tick` with the `X-Heurial-Key` header.

Check (Development): turn an automation on with `POST app/autopilot/settings/missed-call`, send a test event to
`POST autopilot/events` (`tenant_id`, `trigger`, `contact_id`, `dedupe_key`), run the tick, and the text arrives once.

The signed-in app is `/app/autopilot` (`public/app/autopilot.html`): the demo's screens (`public/autopilot/app.js`)
started with an `api`, so it shows the business's own data. `/autopilot` stays the sample business.

Not in the Engine step yet: nothing writes the AI messages (they wait in Approvals empty), time-based
triggers aren't fired by the tick, and every business sends from the one shared number and mail sender.

## Not in this step

- My own business as tenant #1: the tracker still runs on the old single-business tables. Moving it means adding
  `tenant_id` to live rows, so it's its own step with a backup first.
- Queries read whole tables and filter (marked `shortcut:` in the code). Fine for pilots; switch to ZCQL before
  many businesses.
- An edge rate limit and terms and privacy policy, before open sign-up.
