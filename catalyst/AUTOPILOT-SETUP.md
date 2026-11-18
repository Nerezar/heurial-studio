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

**Done 2026-11-18** in the Stripe sandbox "Autopilot test" (`acct_1UdHF9Ay2bctLMlY`), not in live mode. Placeholder
prices until real ones are decided:

| Plan | Product | Price (monthly, placeholder) |
| --- | --- | --- |
| Starter | `prod_VeaSbrHZgDjnM5` | `price_1UdHHLAy2bctLMlYEn9ocOBb` ($49) |
| Pro | `prod_VeaSSzgNgnkCCb` | `price_1UdHHMAy2bctLMlYjo1MdlW8` ($99) |
| Business | `prod_VeaSnqZbf0sRoe` | `price_1UdHHNAy2bctLMlYyJc4enPU` ($199) |

Webhook `we_1UdHH5Ay2bctLMlYKbWNdchq` points at the Development function with the four events below. Customer
portal `bpc_1UdHHYAy2bctLMlYbob9GtyB` allows switching between the three plans, card updates, invoices and cancel at
period end. An earlier single "Autopilot" product with three prices is archived (the portal needs one product per plan).

The steps, for a new sandbox or for live later:

1. In Stripe, switch to test mode (or a sandbox). Make three products (Autopilot Starter, Pro, Business), one monthly price each
   (the portal needs one product per plan). Placeholder amounts are fine until prices are decided.
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

## Not in this step

- My own business as tenant #1: the tracker still runs on the old single-business tables. Moving it means adding
  `tenant_id` to live rows, so it's its own step with a backup first.
- The Autopilot screens still show sample data. The Engine step wires them to the account.
- Queries read whole tables and filter (marked `shortcut:` in the code). Fine for pilots; switch to ZCQL before
  many businesses.
- An edge rate limit and terms and privacy policy, before open sign-up.
