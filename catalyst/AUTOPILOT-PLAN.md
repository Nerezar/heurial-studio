# Autopilot: the real back end (plan)

Status: plan only, 2026-11-18. The demo at `/autopilot` (`public/autopilot/`) shows the product; nothing below is
built yet. Decisions marked **Decide** need the owner.

## What exists today, and what it can't do yet

The tracker's back end is one Catalyst function (`catalyst/functions/pipeline`) for one business: mine.

- One password (`ADMIN_PASSWORD_HASH`) and one key between the site and the function. No customer accounts.
- Tables have no owner column, and `store.list()` reads a whole table. Fine for one business; unsafe and slow for many.
- It already does the hard pieces once: Twilio texts in and out (signature-checked), email out through Catalyst Mail,
  inbound email by webhook, AI drafts that wait for approval, a message saved as `sending` before it goes out, push
  notifications, a daily cron.

The plan keeps all of that and adds what many businesses need: accounts, separated data, billing, and an engine that
runs automations on its own.

## Shape

```
Customer (browser) ── sign in ──▶ site /app ──▶ /api/app/* (session → tenant) ──▶ Catalyst function "autopilot"
                                                                                     │
  Twilio (calls, texts) ──webhooks──▶ /hooks/twilio/*  ─┐                            │ every query scoped to tenant
  Email provider (inbound) ──────────▶ /hooks/email   ─┼──▶ Events ──▶ core.plan ──▶ Outbox ──▶ (approval?) ──▶ send
  Stripe (subscriptions) ────────────▶ /hooks/stripe  ─┘                               ▲
  Catalyst cron, every 5 min ──▶ /tick: due Outbox rows, scheduled triggers ──────────┘
```

- **Events**: everything that happens (a missed call, a form, a paid job, "2 days since the quote") becomes one row,
  with a dedupe key so a retried webhook never runs twice.
- **core.plan**: the same rules as the demo (`public/autopilot/core.js`, already tested): plan unlocks, opt-outs,
  business hours, AI credits, approval. It moves to the function and the browser keeps a copy, the way
  `demo/tracker/core.js` mirrors `pipeline/core.js` today.
- **Outbox**: every message is a row before it goes anywhere: `approval → queued → sending → sent | failed`, or
  `skipped` with a reason. The app's Approvals and Activity screens read this table. A crash between "sending" and
  "sent" is found by the next tick and checked with the provider, never blindly resent.
- **Tick**: one cron job every 5 minutes sends what's due, fires time-based triggers (quote quiet for 2 days, reminder
  the day before, invoice 3/7/14 days late), and retries failures with a limit.

## Data (Catalyst Data Store)

Every table gets `tenant_id`. One wrapper in the function adds `WHERE tenant_id = ?` to every read and sets it on
every write; route code never touches the raw store. A test proves tenant A can't read, change or send for tenant B.

| Table | Holds |
| --- | --- |
| `Tenants` | business name, plan, Stripe customer and subscription ids, time zone, hours, links, status |
| `Users` | tenant, email, role (owner, staff) |
| `Contacts` | tenant, name, phone, email, `opted_out_at`, consent and where it came from |
| `Leads`, `Messages`, `Transactions`, `TimeEntries` | today's tables, plus `tenant_id` |
| `AutomationSettings` | tenant, automation id, on/off, message, approve-first |
| `Events` | tenant, trigger, contact, payload, dedupe key, received |
| `Outbox` | tenant, automation, contact, channel, body, status, send-at, attempts, provider id, error |
| `Usage` | tenant, month, AI drafts used (the credit meter) |
| `Connections` | tenant, kind (number, email domain, Stripe, Google), status, external ids; secrets encrypted |
| `Audit` | who changed what, for support and disputes |

Reads use ZCQL queries with a tenant filter instead of `list()`. **Check first:** ZCQL's row limit per query and the
function timeout, and page or narrow queries to fit.

My own business becomes tenant #1, so the tracker I use every day runs on the same code as customers'.

## Accounts and sign-in

**Decide:** Catalyst Authentication (built in: sign-up, email verification, password reset) if it works with the
Slate-hosted site, which I'd check first; otherwise email magic links sent through the email provider. Either way the
site keeps the session in an http-only cookie and passes the tenant to the function, as `/api/admin` does now.

## Billing (Stripe)

- Stripe Checkout to subscribe, Stripe's customer portal to change plan or card, and a webhook that sets
  `Tenants.plan` from the subscription. The app never trusts the browser about the plan.
- AI credits: `Usage` counts drafts per month; a plan's allowance is a hard cap, and a draft is only written if a
  credit is left (the demo's rule). Extra credit packs can be one-time Stripe payments later.
- Unpaid subscriptions: automations pause, data stays, and the owner is told. Nothing is deleted.
- **Decide:** prices for Starter, Pro and Business, and the AI allowance in each. Set them after measuring what a
  draft costs, and what each customer costs in Twilio and email fees.

## Connections

- **Texts and calls (Twilio).** **Decide:** I'd use a Twilio subaccount per customer, so I buy their number, see
  their usage and bill for it, and one customer's problem can't affect another. Every business that texts in the US
  needs A2P 10DLC registration (their business details plus a description of the messages); it takes days and has
  fees. For the first customers I register them by hand in the console; later the sign-up form submits it through
  Twilio's API. Missed calls: the number forwards to the owner's phone, and an unanswered call fires `missed_call`.
- **Email.** **Decide:** Catalyst Mail needs each sender verified by hand, which doesn't scale. I'd use a provider
  with inbound email and a domains API (Postmark, or similar): each tenant gets a forwarding address, and sends from
  their own domain once they add its DNS records.
- **Stripe or QuickBooks, Google Business Profile.** Later, for the Pro and Business automations that need them.

## Rules that protect customers (and me)

- **Consent.** Replies to someone who called or wrote in are conversational. Marketing texts (seasonal campaigns,
  re-book reminders, birthdays) need the contact's prior written consent under US rules, so those automations email
  by default and only text contacts with consent recorded. Everything else respects `opted_out_at`.
- **STOP** and the other stop words opt a contact out at once (Twilio also enforces this on its side).
- **Approval** stays the default for anything AI writes. Incoming messages are data, never instructions (as `draft.js`
  does now).
- **Limits** per tenant: texts per hour, AI drafts per month, so one runaway automation can't burn a bill.
- **Secrets** (tokens for connected services) are encrypted at rest and never sent to the browser.
- **Terms and privacy policy** before the first paying customer. **Decide:** who writes them.

## Order of work

1. **Foundation.** Tenants and users, sign-in, the tenant-scoped store with its isolation test, Stripe test-mode
   subscriptions setting the plan, my business moved to tenant #1. Done when two test tenants can't see each other
   and a test-mode subscription unlocks Pro.
2. **Engine.** Events, Outbox, the tick job, `core.plan` on the server, and the Autopilot screens reading the real API
   (the tracker's `start({ mode, api })` pattern, so the demo keeps working). Done when a test missed call in
   Development produces a text through Twilio's test credentials, and an AI draft waits in Approvals.
3. **Connections.** Twilio subaccounts and numbers, the email provider (inbound and sending domains), the
   web-inquiry form endpoint. Registration by hand at first.
4. **Starter's 8 automations, live** for my business and 1 to 3 pilot customers I set up with them on a call.
5. **Pro's 11, then Business's 11,** in the order pilots ask for them.
6. **Self-serve.** Open sign-up, the setup wizard (number, registration form, email, hours, links), credit packs.

Each step is its own branch, tested in Development first, and goes to Production only on the owner's go-ahead.

## Costs that exist per customer

A phone number, each text and call, the 10DLC registration, email sending, AI drafts, and Catalyst usage. Prices have
to cover these with room left over; measure them on the pilots before opening sign-up.
