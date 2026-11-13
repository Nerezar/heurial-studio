# Handoff — 2026-11-13

Durable rules are in `CLAUDE.md`. This file is current status only.

## Where things stand
- Folder: `~/heurial-dev/heurial-design`
- **Site plan 2026-11-12** (pasted by the owner): launch blockers first (B1-B6), then conversion work. New tracker
  features are frozen until a real inquiry flows through. Branch `tracker-settings` (Settings screen) is built and
  pushed but parked for that reason.
- **B3 verified 2026-11-13:** a labelled test from www.heurial.studio/contact returned 201 and saved to Production
  `Inquiries` with the right source and attribution; the row was then deleted. Form, server and column limits match
  (name 100, email 254, company 120, source 60, source_detail 200, heard 20; message and attribution are Text).
  No alert was sent for it: there is no inquiry alert yet (B2). Three older test rows from Nov 11-12 are still there.
- **B1 done and live 2026-11-13** (website `665016e`): robots.txt allows crawling on www.heurial.studio, sitemap
  lists the 6 pages, the Slate preview address stays blocked.
- **B2 done and live 2026-11-13** (`bf68c83`, Catalyst deployment "Inquiry alert + daily email (bf68c83)"):
  every inquiry emails hello@heurial.studio (reply-to = visitor); the owner confirmed a live test arrived. The same
  deployment updated `pipeline` in Production and added the `PushSubscriptions` table, the `daily` job pool and the
  `daily_email` schedule (cron `0 7 * * *`, America/Chicago, runs `daily-digest`), switched on. First morning email
  due 2026-11-14 7:00; check it arrived.
- About 12 labelled test inquiries ("TEST ...", example.com addresses) from 2026-11-12/13 are in Production
  `Inquiries` for the owner to dismiss or delete.
- **Live website: `f0c076e`** (redeployed 2026-11-13 to pick up the new pipeline key; code same as `665016e`).
  Functions in Production: `inquiries` and `pipeline` at `bf68c83`. Next: plan step 3 (C2 booking link, C3
  thank-you and acknowledgement email, C1 About content).
- **B5 done 2026-11-13:** both keys rotated. `INQUIRY_KEY` on `inquiries` + `INQUIRY_FUNCTION_KEY` on the site
  (form tested, 201). `PIPELINE_KEY` on `pipeline` and `daily-digest` (Production) + `PIPELINE_FUNCTION_KEY` on the
  site; all three saved values checked by SHA-256 fingerprint. Direct call to `pipeline/data`: new key 200, old key
  401. Secrets: `~/.heurial-secrets/pipeline-production-key` is the new one, `pipeline-production-key.old` the old
  (`pipeline-key`, 44 chars, is an older non-Production value). **Still to confirm:** the owner logs in to /admin
  and sees data, and the 2026-11-14 7:00 morning email arrives (first run with the new key on `daily-digest`).
- Production `pipeline` has only `PIPELINE_KEY`, `DIGEST_FROM`, `DIGEST_TO`, `TIME_ZONE`, `TRACKER_URL`. No VAPID
  keys there, so phone notifications can't work in Production yet. Development `pipeline` shows no variables at all.
- Where the keys live: functions → Serverless → Functions → <fn> → Configuration → "Variable Environment" =
  Production → row ⋯ → Edit. Website → Slate → heurial → expand → **default** deployment → Configuration →
  Environment Variables → row ⋯ (right end, may be off-screen) → Edit. Slate App Settings has no variables.
  A website variable change only applies after `catalyst deploy slate heurial --production`; right after a deploy
  the API can answer 503 for about a minute while it warms up. Prepare both edit boxes before pasting, check the
  saved value's length (43) without reading it, and never screenshot a filled-in key field.
- Console in the browser pane: it only lays out properly with the viewport emulated at 1366x900 (the size resets
  each turn). The Variable Environment dropdown won't open by click; switch it with
  `jQuery('select[data-zcqa="function-env_varaibles"]').val('Production').trigger('change')`. The function variable
  table shows values in plain text, so no screenshots there. Slate's variables sit in an iframe. Simulated Cmd+V is
  blocked, so `pbcopy` the key from the file and the owner presses Cmd+V and Save; check each by fingerprint.
- Notifications prepared in Catalyst **Development** (ChatGPT, 2026-11-12): VAPID keys generated and stored outside
  git, both set on the Development pipeline function, `PushSubscriptions` table created with no App User permissions.
  Production is read-only: the table and settings reach it only by promotion.
- Not set anywhere yet: Anthropic key (optional, costs money), Twilio values, inbound mail provider.

## Merged to main at `88c7400`: calmer tracker design, not deployed
- The user found the tracker too dense and asked for a calmer, roomier look with colour, glow and gradients
  (reference shots: dark dashboards with big figures and rounded cards). Restyled `public/tracker/tracker.css`
  and the frame in `tracker.js`: labelled sidebar with connection status, greeting header, four large stat cards
  instead of the eight-figure strip, rounded panels on a navy background with violet and blue light, one gradient
  for primary buttons. Removed the 14-day schedule grid and the bottom status bar. Light mode and phone layout kept.
- Checks pass; looked at Overview, Pipeline, Leads, lead panel, phone, light mode and the demo page in the preview.

## Merged to main at `fb0e919`: installable app and notifications, not deployed
- PWA: `public/admin/manifest.webmanifest`, icons in `public/admin/icons/`, `public/admin-sw.js` (scope `/admin`,
  notifications only, no caching). Apple meta tags in `public/admin/index.html`.
- Web Push in the pipeline (`push.js`, `web-push` dep): `GET push/key`, `POST push/subscribe|unsubscribe|test`,
  `POST notify/inquiry` (called by `lib/contact.ts` after an inquiry is saved). Incoming email/text also notifies.
  Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`node scripts/make-vapid-keys.mjs`) and a `PushSubscriptions` table.
- Tracker: Connections → This device (install, notifications on/off/test); notification links
  `/admin#lead=ID&tab=messages` open that lead. Phone header layout fixed.
- Checks: tsc, eslint, build, 19 function tests. Preview: manifest and worker served, worker registers, device rows,
  deep link, phone layout. A real request reached Google's push service (fake address, rejected and cleaned up as
  designed). Not tested: receiving a notification on a real phone (the preview browser blocks notifications).

## Merged to main at `7f79e72`, not deployed
- AI reply drafts: `catalyst/functions/pipeline/draft.js` (`claude-opus-5-5`, structured output, server-side refusal
  fallback, refusals and errors become plain messages). `POST /leads/:id/draft` saves a `draft` message;
  `POST /messages/:id/approve` sends (or logs) it. Nothing is ever sent without approval.
- Twilio: `adapters.js` sends texts (`TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM`) and `POST /twilio/sms` takes incoming
  texts with a signature check (`TWILIO_WEBHOOK_URL`). The old `MESSAGE_WEBHOOK_URL` still works as a fallback.
- Inbound email: `POST /inbound/email?key=INBOUND_KEY` accepts Postmark JSON or Mailgun/SendGrid forms, strips quoted text.
- Tracker: "Draft with AI" in the composer, editable draft card with Approve and send / Mark as sent / Discard,
  Connections rows for texts, incoming texts, incoming email and AI drafts. Demo page returns a labelled sample draft.
- Site proxy allows the two new routes; drafts get 45 s instead of 15 s.
- Docs: `catalyst/TRACKER-SETUP.md` (settings table, Connecting messages, AI reply drafts).
- Checks: tsc, eslint, `next build`, 16 function tests pass. Tried in the preview against the stand-in (sample
  drafter, no API calls): draft, edit, approve and send, text draft, discard, Connections, demo page.
- Not tested against real Anthropic, Twilio or a mail provider. Catalyst function timeout for a ~10-30 s draft is unverified.

## Done and merged to main
- Editorial site, blended with the earlier glass redesign.
- Smooth 60fps hero animation.
- Tracker workspace (Overview, Pipeline, Leads, Time, Messages, Connections) with a lead panel (Details, Messages, Time) and a Cmd/Ctrl+K command bar.
- Messages back end: `/messages`, `/leads/:id/messages`, and `/inbound` with its own key. 10 function tests pass.
- Polish pass from the ChatGPT review (readability, attention first, honest chart label).
- HEURIAL brand: tiger emblem, wordmark, IBM Plex Sans.

## Deployment status
- A check on 2026-11-12 showed `www.heurial.studio` and `heurial-mmoiyutd.onslate.com` both serving the editorial home page and the new tracker files (`/tracker/tracker.js` contains the workspace and brand code). `/admin` returns a 307 redirect.
- Not verified: whether the `pipeline` and `daily-digest` functions on Catalyst match this code, and whether they are on Production or Development only. Earlier notes said Development only.

## Still to do for live use
- Confirm or deploy the `pipeline` function.
- Create the Messages table and the `phone` column on Leads (`catalyst/TRACKER-SETUP.md`).
- The user runs the password-hash script.
- Set the Slate environment variables.
- Verify the Mail sender.
- Set up the daily-digest cron.
- Test `/admin` against live Catalyst. The tracker has only been tested against the local stand-in.

## Unresolved
- Never tested against live Catalyst.
- Preview screenshots are low resolution.
- AI drafts, Twilio and inbound email are built on `tracker-ai` but untested against the real services.

## Next task
1. With the user's go-ahead: promote Development to Production (table + pipeline settings) and deploy `88c7400`. Each feature stays off until its settings exist.
2. Then on a phone: install the app from `/admin`, Connections → Notifications → Turn on → Send test.
3. Later, when the user wants to pay for them: Anthropic key, Twilio, inbound email provider.
4. Later (if clients want it): the tracker as a delivered workflow per client, then a multi-tenant app.
