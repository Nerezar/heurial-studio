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
- **B5 done 2026-11-13:** both keys rotated. `INQUIRY_KEY` on `inquiries` + `INQUIRY_FUNCTION_KEY` on the site
  (form tested, 201). `PIPELINE_KEY` on `pipeline` and `daily-digest` (Production) + `PIPELINE_FUNCTION_KEY` on the
  site; all three saved values checked by SHA-256 fingerprint. Direct call to `pipeline/data`: new key 200, old key
  401. Secrets: `~/.heurial-secrets/pipeline-production-key` is the new one, `pipeline-production-key.old` the old
  (`pipeline-key`, 44 chars, is an older non-Production value). **Still to confirm:** the owner logs in to /admin
  and sees data, and the 2026-11-14 7:00 morning email arrives (first run with the new key on `daily-digest`).
- Production `pipeline` now also has `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (added by ChatGPT 2026-11-13;
  both match `~/.heurial-secrets/vapid.env` by fingerprint). The live function reads them: `push/key` returns the
  matching public key. No redeploy needed; the console's "not deployed" flag is misleading. Still untested on a real
  phone, and no device has subscribed. Development `pipeline` shows no variables at all.
- **C3 thank-you screen live 2026-11-13** (website `f4466a7`, merged to main): after a successful send the contact
  form is replaced by a thank-you panel; the live bundle was checked for it (no live test inquiry was sent).
  **Confirmation email to the visitor live 2026-11-13:** console deployment "Visitor confirmation email
  (f4466a7)" moved only `inquiries` to Production (Serverless only; Job Scheduling, CloudScale and Settings were
  unticked). `ACK_REPLY` = `on` added on Production `inquiries` (Development view → Create Variable → Production).
  Live form test: 201 with `acknowledged: true` (took 6.7 s; the notify step to `pipeline` alone takes about 3.7 s
  now that the VAPID keys are set).
- **Incident 2026-11-13, fixed:** the website's `INQUIRY_FUNCTION_KEY` and `PIPELINE_FUNCTION_KEY` were found
  swapped (each held the other's value), so the contact form answered 503 and /admin could not load data from the
  `f4466a7` deploy until the fix about 40 minutes later. `PIPELINE_FUNCTION_KEY` was correct when checked earlier
  that day; what changed it is unknown. Both corrected by fingerprint and the site redeployed. Slate swaps any 503
  from the app for its own "origin server unavailable" page, so a fast 503 on the form means the site refused
  (wrong key or address), not that the server is down. After any key change, send a real test through the form.
- Two more labelled test rows from this ("TEST Confirmation", "TEST Live Form") are in Production `Inquiries`.
- **C2 booking link live 2026-11-13** (website and `main` at `9ae952c`): Zoho Bookings (owner's account, trial of
  the paid plan ends about 2026-11-28; what it drops to is unchecked). Event type "Free 20-min call", 20 min,
  Google Meet. Hours Mon-Fri 2:50-6:00 pm, Sat-Sun 9:00 am-6:00 pm, America/Chicago (slots show on the quarter
  hour, so weekdays start 3:00). Link `https://heurial.zohobookings.com/4948260000000038065` is `BOOKING_URL` in
  `lib/site.ts` (contact page "Pick a time" and the thank-you screen) and the default `BOOKING_URL` in `inquiries`
  (one line in the confirmation email). Console deployment "Booking link in confirmation (9ae952c)" moved only
  `inquiries`; `ACK_REPLY` and `INQUIRY_KEY` survived. Live form test: 201, `acknowledged: true`, 4.9 s. One more
  test row ("TEST Booking Link"). No test booking has been made, so the Meet link and invite are unverified.
- **Live website: `dcd870f`** (interactive hero, see below). Production `inquiries` matches it; `pipeline` and `daily-digest` are still `bf68c83`.
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

## Live 2026-11-13: interactive hero (`dcd870f`)
- Merged to main and deployed to Slate Production. `components/flow-board.tsx` replaces the abstract canvas in the
  hero (`system-field.tsx` is kept, unused, so switching back is a two-line change in `app/page.tsx`). Three tasks on
  the left, the workflow in the middle, four tools on the right; replies wait for an Approve tap (the demo taps by
  itself after 3.8 s). On phones it sits below the hero buttons.
- Checked live on www.heurial.studio: the board renders, tasks run, no console errors; /contact 200, /admin 307.
  Unchecked: reduced motion, a real phone, and a contact-form send after this deploy (no keys changed).

## Pushed, not merged (2026-11-13)
- `home-polish` (`649723f`) combines `calc-impact`, `flow-polish` and `steps-polish`. `pricing-packages` is built on
  top of it, so it carries all four changes and is the one to release.
- `tracker-ease` (`f018e72`) is built on `questions-page` and adds an ease-of-use pass on the tracker
  (`public/tracker/`, so it changes the real /admin too, not just the demo). The owner asked for a full redo for
  older users; this is the targeted version. Text is about 2 px larger everywhere; buttons and fields are 40-46 px
  tall; period buttons say Week / Month / 3 months / Year / All; the Overview chart covers the chosen period and is
  built from the same leads as the Revenue figure (they used to disagree: 30 days vs a fixed 12 weeks); the chart
  draws in when its numbers change; sections change with a view transition; a slow faint blue light drifts behind
  the page; the Overview panels no longer overlap. The lead you just changed is highlighted after a save, move or
  drag; the Save button turns green and says Saved for about two seconds; finished items in Needs attention slide
  away; the four headline figures roll to their values. `core.js` is untouched and the lead form itself (fields,
  steps to save) is unchanged. Release `questions-page` on its own if the tracker changes should wait.
- `questions-page` is built on `services-polish`, so it carries everything below and is the one to release. The
  owner found the three steps shown twice (home section and the How it works page) and chose to turn the page into
  **Questions**: `/services` now holds only the FAQ, grown from 4 to 11 questions (every answer restates something
  the site already says), the menu label is "Questions", and the steps live only on the home page. The address is
  still `/services`. Also: links to a section on another page (like `/#how-it-works` from About) now land on that
  section (`components/route-transition.tsx`); the assistant's "After handoff" text lists support per package.
- `services-polish` is built on `demos-polish`. Its step restyle of the old page is superseded by the line above;
  what remains from it is the shared steps styles in `app/globals.css`. On the
  How it works page the three steps now use the same rail, numerals, time tags and "You get" line as the home page
  (the steps styles moved from `app/home.css` to `app/globals.css`; the old timeline styles are deleted), and the
  intro and page description say "fixed price from $295" instead of only the $495 offer. FAQ and banner untouched.
- `demos-polish` is built on `pricing-packages` and carries all five home-page changes. It restyles "See what's possible": each demo card has a window bar and a small live-looking preview (a
  tracker board where one card moves a column; a chat that types an answer). They play once on scroll and loop on
  hover. The whole card is the link. The violet chips are gone (the owner wants no purple anywhere).
- `pricing-packages`: three packages chosen by the owner on 2026-11-13: Quick fix $295 (one simple automation, a few
  days, 7 days of support), One workflow $495 (the founding offer, unchanged), Two workflows $895 (two connected
  workflows, about two weeks, 30 days of support). Home pricing section (`app/page.tsx`, `#pricing`) shows three
  cards with digits that roll into place on scroll. Also updated: the services page cost answer and the assistant's
  `content/knowledge.json`. Unchanged and still true: the hero's "$495 founding price" and the calculator's $495
  example. **Owner to confirm before release:** half to start / half at handoff applies to all three; the extra
  bullet lines on the $295 and $895 cards (setup in your tools, guide, handoff call); "first three clients" is
  shown on the $495 card only.
- `calc-impact`: home page calculator reworked. New "People who do it" slider (1-10, default 1). The chart now
  compares a year of the task by hand with the same year with a $495 workflow; the shaded gap is what is kept. The
  hours are restated as work weeks (40 h), value of time, and a multiple of the price. All figures are the same
  arithmetic (70% of the task, 50 weeks); the fine print says the money is the value of time, not cash.
- `flow-polish`: "Watch one run" restyled (`components/workflow-demo.tsx`, the flow block in `app/home.css`). The
  step list is now a run log on a rail with times; the window lost the fake traffic-light dots and has an app name,
  time and a blue corner light; each step shows a little more (tags, a typing caret, a tap ring, row numbers, a week
  strip). Same story, same timing and controls. On phones the rail runs sideways and the Source column is dropped.
- `steps-polish`: home "One annoying task, handled." steps restyled (`app/page.tsx`, the Steps block in
  `app/home.css`). A rail with three dots, large 01-03 numerals, a time tag per step and a "You get" line (wording
  taken from the services page). The rail draws with scrolling where the browser supports scroll-driven animation
  and is shown complete elsewhere. On phones the rail runs down the left; the section is about 350 px taller there.
- `site-font` (`10e116b`): site text in Inter Tight (owner's pick), digits fall back to Helvetica. Only the top of
  Home was looked at.

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
