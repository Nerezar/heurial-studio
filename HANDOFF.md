# Handoff — 2026-11-14

Durable rules are in `CLAUDE.md`. This file is current status only.

## Where things stand
- Folder: `~/heurial-dev/heurial-design`
- **Development is ready for transactions and tasks (2026-11-17, main `2578fc8`).** In Catalyst Development: the
  `Transactions` (table 141722000000014664) and `Tasks` (141722000000020458) tables exist with the columns from
  `catalyst/TRACKER-SETUP.md`, GLOBAL scope, and the App User role given no access (new tables default to letting it
  read; both were changed to match the others). `pipeline` was deployed to Development from `2578fc8`. Checked: an
  unkeyed request returns 401, and each table accepted and returned a row shaped like the function's (the two test
  rows were deleted). **Not checked: a keyed request to the new routes.** The Development key is not stored
  locally and was not read into the chat. **Production and the live site are unchanged.** Next: a console
  deployment (Development → Settings → Environments → Deployments → Create Deployment) with Data Store and Functions
  selected, read the diff, then deploy the site from main. A new Production table should be checked for the same
  App User default.
- **Saving for transactions and tasks is built (2026-11-17, branch `two-pages`, pushed, not merged, nothing
  deployed).** Code: `core.js` (both copies) gains `cleanTransaction`, `cleanTask` and their row readers;
  `handler.js` gains `POST /transactions`, `DELETE /transactions/:id`, `POST /tasks`, `PATCH /tasks/:id` (`done`,
  `title`, `due_at`) and `DELETE /tasks/:id`, returns `transactions` and `tasks` from `/data`, and reports
  `services.money` and `services.tasks`; the site's proxy allows the new routes. Money has an Add transaction bar
  and a delete button on hand-added rows; Tasks has "Your tasks" with an add bar, tick boxes, Open / Completed and
  delete. Tasks due today or overdue count in the badge and the Today list. **To switch it on for the real
  tracker, in this order:** 1) create the `Transactions` and `Tasks` tables (columns in `catalyst/TRACKER-SETUP.md`)
  in Development, 2) deploy `pipeline` to Development and test, 3) console deployment to Production with Data
  Store and Functions selected, 4) deploy the site. Until the tables exist the tracker still loads and shows a
  note where each add bar would be. The same function deploy turns on the 1D range. Checked: 24 pipeline tests,
  and add / delete / finish / reopen on the sample-data page at 1440 and 375. Not checked: the real path through
  the site's proxy to a deployed function. Not built: editing a transaction (delete and re-add), tasks linked to
  a lead (follow-ups cover that), tasks in the daily email, workspace settings and notification switches.
- **Tracker regrouped into five sections from the owner's five concept images (2026-11-17, branch `two-pages`,
  pushed, not merged):** the sidebar is Overview, Money, Leads, Tasks, Settings (`SECTIONS` in `tracker.js`).
  Nothing was removed: Leads holds the old Pipeline, Leads, Time and Messages screens as tabs (Board, List, Time,
  Messages) and Settings is the old Connections screen with appearance and export first. **Money** is new: the
  balance card, then a table of every entry with a type filter. **Tasks** is new: the old Needs attention list
  with its buttons, beside follow-ups further out. **Overview** is the balance beside its chart, the three tiles,
  a short Today list, a Leads card and the reports. All of it is built from data the tracker already had; no
  back-end change. **Not built, though the images show them:** Add transaction and Add task buttons, a Completed
  tab, per-task checkboxes, workspace name / currency / time zone, notification switches, a Calendar connection,
  and "Save changes". Each needs storage that does not exist yet. Checked on the sample-data page at 1440 and 375.
  Not checked: the signed-in tracker, the command palette's Go to list, drag and drop after the regroup.
- **Tracker restyled to the owner's concept image (2026-11-17, on branch `two-pages`, pushed, not merged):** the
  tracker's light look is now a soft blue page, a navy sidebar, white cards with soft shadows and glossy blue
  buttons, in a block at the end of `tracker.css` scoped to the light theme. Dark mode is unchanged. Overview now
  leads with the balance and chart full width, then the three tiles, then Needs attention beside the reports. The
  chart shows the starting and current balance as labels, and an Income / Expenses row appears when there are
  deposits or withdrawals. Kept from before, not in the concept: the greeting, the existing six sections (the
  concept's Money, Tasks and Settings sections do not exist), and the stepped line (the concept's wavy line would
  misstate daily balances). The website keeps its paper look, so the tracker no longer matches it. Checked on the
  sample-data page at 1440 and 375, light and dark. Not checked: the signed-in tracker, dialogs, Safari.
- **Three pages (owner changed it back the same day):** Demos (`/products`) is restored with the tracker demo in
  its frame, minus its link to the deleted Guides page. The nav is Overview, Demos, Contact.
- **Site cut down, branch `two-pages` (2026-11-17), pushed, not merged, not deployed. It sits on top of
  `tracker-editorial`, so merging it brings the tracker restyle and money chart with it.** The owner asked for
  three things. Fonts: Newsreader is gone everywhere (site and tracker); headings and labels are Inter Tight again
  and the font files are deleted. Page change: a fade to white and back (380 ms in, 560 ms out) in place of the
  wipe. Pages: only the overview (`/`) and Contact remain. Deleted: About, Questions, Demos, Guides, the knowledge
  assistant and its `/api/ask` route, `lib/retrieval.ts`, `content/knowledge.json`, the FAQ and demo-frame
  components, and their styles. `/about`, `/services`, `/products` and `/resources` redirect to `/`. The tracker
  demo file is still at `/demo/tracker` but nothing on the site links to it. Checked in the preview at 1440 and
  375: both pages, the nav, the redirects, the sitemap (2 addresses) and a page change. Not checked: Safari, a real
  phone, how the fade feels at full speed (the preview pane throttles timers).
- **Tracker in the site's look, branch `tracker-editorial` (2026-11-17), pushed, not merged, not deployed:** the
  tracker and its demo now start in a light theme with the website's paper, ink, blue and Newsreader titles
  (`public/tracker/tracker.css`, light is the default in both HTML pages and `tracker.js`). Dark mode is still one
  click away and anyone who chose it keeps it. The drifting blue light behind the page is gone. Every tool is
  unchanged. The frame around the demo on the Demos page is light too, and `/demo/tracker` (which returned 404)
  now redirects to the demo file. The installed app's colours in `public/admin/manifest.webmanifest` are light.
  Checked in the preview on the sample-data page: all six sections, a lead panel, the theme switch, 1440 and 375
  wide, and the `/admin` sign-in card. Not checked: the signed-in real tracker, dialogs other than the lead panel,
  the installed phone app, Safari.
  **Money chart reworked on the same branch (owner's spec, 2026-11-17):** blue thin line with a soft blue fill and
  an eased rise into each entry (each day's balance is still exact); range buttons are 1D, 1W, 1M, 3M, 1Y, ALL;
  the percentage is hidden when the starting balance makes it meaningless. The chart's data now lives in
  `public/tracker/money.js` (pure, tested by `node --test tracker/money.test.mjs`); `tracker.js` only draws it.
  Entries are earnings (paid leads), deposits or withdrawals: deposits and withdrawals move the balance but never
  count as earned, and the "Won so far" tile is earnings only. The real API sends no transactions yet, so the real
  tracker still shows paid leads alone; the demo has three sample ones, labelled "(sample)". To connect real ones,
  return `transactions: [{ date, amount_cents, kind, label }]` from `/api/data`.
  **Deploy order matters:** 1D needs `core.js` in the `pipeline` function (it now accepts range `1`), so deploy and
  promote the function before the site, or 1D on the real tracker answers "Bad range". Not checked: the empty
  chart message, a balance below zero (the scale starts at $0).
- **Finishing pass live 2026-11-17 (website `4781994`):** merged to main and deployed to Slate Production, both on the
  owner's go-ahead. Live check: every public page 200, `/admin` 307, `/about` 307 to the home page (the config-file
  redirect works on Slate), no About link in the page or sitemap, the ribbon and ink logos are served. What changed: About is off the site
  for now (out of the nav, footer and sitemap; `/about` redirects home from `next.config.ts`; the page file is
  untouched). The header and footer logo is the H mark plus the wordmark in ink (`public/brand/*-ink.svg`), no CSS
  filter. The page-change wipe is the brand blue. The silver band is now a twisting ribbon with nothing behind it
  (`<Silver ribbon />`): one runs full width under the home hero, one comes in from the right and passes behind the
  closing button on every page. Every primary button has a silver edge that travels round it. Checked in the
  preview at 1440 and 375. Not checked: Safari, a real phone, the share image (still the old dark card).
- **Editorial redesign live 2026-11-17 (website `b9166c0`):** merged to main and deployed to Slate Production, both on
  the owner's go-ahead. Live check: every public page 200, `/admin` 307, the home page serves the glass panels,
  example flow and silver canvas, the serif font file loads. Still not checked: an assistant answer on Guides, the
  contact thank-you state, Safari, a real phone. What was built, from the branch notes: the home page follows
  the owner's concept "02 Editorial": warm paper background, ink text, one blue, Newsreader serif headings, mono
  labels with a blue rule. The hero is copy on the left and tilted glass panels on the right (drawn in CSS, a sample
  lead follow-up workflow). "How it works" is three numbered rows, followed by a card linking to Guides. Copy,
  prices and promises are unchanged. The theme is scoped to the home page with `body:has(.ed)` in `app/home.css`;
  the other pages are still dark until the owner approves the look. Left in place and now unused on the home page:
  `components/flow-board.tsx`, its styles in `home.css`, and the `.steps` rail styles in `globals.css`. Checked in
  the preview at 1440 and 375 wide: no sideways scroll, no console errors. Not checked: Safari, a real phone.
  **Motion added the same day (owner asked for a lively site):** the glass panels drift, lean toward the pointer,
  and the dark panel's four names swap the front sheet's sample screen; a highlight walks along its three steps.
  A band of flowing silver sits under the hero and in the Guides card (`components/silver.tsx`, a small WebGL
  shader that pauses off screen). "A simple example" (`components/example-flow.tsx`) steps through Inquiry,
  Follow-up, Booking until a visitor picks one. All of it holds still for reduced motion. Not checked: frame rate
  on a slow phone, Safari.
  **Whole site converted the same day (owner said yes):** the theme moved from the home page into
  `app/globals.css` and `app/shell.css`, so About, Contact, Demos, Questions, Guides and the 404 page share it. The
  tracker demo window on Demos stays dark, as does the tracker itself. Deleted as unused: `components/flow-board.tsx`
  and the board, "watch one run", calculator, demo-card and steps-rail styles. Checked every page in the preview at
  1440 wide and Contact and Home at 375. Not checked: an assistant answer on Guides (needs the live function), the
  contact form's thank-you state.
- **Design pass live 2026-11-14 (website `cf3026f`, branch `refero-direction`):** merged to main and deployed to Slate
  Production, both on the owner's go-ahead. A full design pass on the website,
  guided by the Refero Styles guides for Linear, Ramp and Intercom (rules now in `CLAUDE.md`). Home: the hero is a
  headline and pitch over the workflow board as one wide window, with three facts under it; "Tasks it fits" is
  folded into the problems rows; the calculator is one panel with the result first and a chart legend; pricing is a
  rate card on paper (one row per package, the $49 plan as the last row, one booking button); the price digit roll
  is gone. Site-wide: 1200px width, smaller display type, flat panels, one blue action colour, the page-change
  wipe kept but about twice as fast (300 ms in, 420 ms out), quicker scroll reveals, `components/system-field.tsx` (unused) deleted.
  Contact, About and Guides lost their glows; the Contact form button is secondary so "Pick a time" is the one
  primary. Prices, package contents and promises are unchanged. Checked in the preview on every page at 1440 and
  375 wide and Home at 900: no sideways scroll, no console errors. Not checked: a real phone, Safari, the intro
  at full speed (the preview pane throttles timers), the tracker (untouched). **Live check after the deploy:** every
  public page 200, `/admin` 307, the home page serves the new markup at 1200px wide with the blue primary button and
  no failed requests. The first request after the deploy took 6.0 s, the rest under 1 s.
- The live site's slow first load is the host waking up, not the app: `/` is prerendered static in the build. A
  separate session started on 2026-11-14 to find the cause and a fix; nothing from it is merged yet.
- The Catalyst CLI prints a warning on every deploy: the Node.js it runs on (v26.0.0) has high-severity security
  bugs fixed in v26.12.1. **Upgraded 2026-11-15:** Homebrew Node is now v26.13.1; the CLI (1.29.1) runs and the
  pipeline tests pass. An old v22.14.0 at `/usr/local/bin/node` comes later on PATH and is unused.
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
  due 2026-11-14 7:00; the owner confirmed on 2026-11-15 that it arrives.
- **Test inquiries deleted 2026-11-15** (owner's go-ahead): all 18 Production `Inquiries` rows named "TEST ..." were
  removed by ROWID in the ZCQL console. Left: 6 rows (Brianna Belton, three "HEURIAL ... Test", and "Oliver" and
  "Uriyah Moore", both dismissed). The 4 test **leads** in `Leads` were kept; the tracker still loads (inbox 0, 5 leads).
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
- Two more labelled test rows from this ("TEST Confirmation", "TEST Live Form"); deleted 2026-11-15.
- **C2 booking link live 2026-11-13** (website and `main` at `9ae952c`): Zoho Bookings (owner's account, trial of
  the paid plan ends about 2026-11-28; what it drops to is unchecked). Event type "Free 20-min call", 20 min,
  Google Meet. Hours Mon-Fri 2:50-6:00 pm, Sat-Sun 9:00 am-6:00 pm, America/Chicago (slots show on the quarter
  hour, so weekdays start 3:00). Link `https://heurial.zohobookings.com/4948260000000038065` is `BOOKING_URL` in
  `lib/site.ts` (contact page "Pick a time" and the thank-you screen) and the default `BOOKING_URL` in `inquiries`
  (one line in the confirmation email). Console deployment "Booking link in confirmation (9ae952c)" moved only
  `inquiries`; `ACK_REPLY` and `INQUIRY_KEY` survived. Live form test: 201, `acknowledged: true`, 4.9 s. One more
  test row ("TEST Booking Link"). No test booking has been made, so the Meet link and invite are unverified.
- **Live website: `7a8e598`** (see "Live 2026-11-13" below). Production `inquiries` matches it; `pipeline` and `daily-digest` are still `bf68c83`.
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

## Live 2026-11-16: shorter, direct home page (`58ad95d`, merged and deployed on the owner's go-ahead)

The owner asked to remove anything unnecessary, drop the "AI" wording and be direct. Home is now five sections:
hero, the problems rows, the three steps, the four promises, pricing, then the closing. Removed from Home: "Watch
one run" (`components/workflow-demo.tsx`, deleted), the savings calculator (`components/savings-calculator.tsx`,
deleted) and the "See what's possible" demo cards (the Demos and Guides pages are still in the menu). The promises
moved above pricing so the paper and dark bands still alternate; the problems section is dark now. "AI" is gone from
the hero, page titles, share text, About and the assistant's first passage. It stays in one place on purpose: the
promise to say which AI services touch a client's data (Home, Questions, the assistant). Their styles in
`app/home.css` are left in place, unused. Positioning under discussion with the owner: roofing companies, starting
with their father's company; the copy is not changed for that yet.

## Live 2026-11-15: ribbon H mark (`7b6217f`, merged and deployed on the owner's go-ahead)

The owner supplied a flat white "H" whose crossbar is a ribbon (two slanted posts, the band twisting between them),
made from their own glossy chrome version. It replaces the plain "H" from the release below wherever a mark is
used: browser tab (`brand/mark-icon.png`), phone (`brand/mark-touch.png`), tracker app and notification icons
(`admin/icons/mark-*.png`), and the hero board hub (`brand/mark.png`, transparent, in the brand grey). The header,
footer, About plate and share image keep the wordmark. All PNGs are made from the owner's 1254px artwork with
`sharp` (brightness becomes transparency); there is no vector version. The owner was told to run a reverse image
search on the mark before relying on it.

## Live 2026-11-15: tiger emblem removed (`63ec686`, merged and deployed on the owner's go-ahead)

The owner found The Gnar Company (thegnar.com, a Boston AI and software consultancy) using a fire-breathing tiger
logo very close to ours and asked to remove all emblems. The brand is now the HEURIAL wordmark alone.
- Header and footer: `wordmark.svg` (the header used `signature.svg`, wordmark plus tiger). About page plate: the
  wordmark. Hero board hub: `h-mark.svg`, the "H" from the wordmark.
- Browser tab, phone and app icons: a plain "H" on near-black (`brand/icon.svg`, `brand/touch-icon.png`,
  `admin/icons/h-192.png`, `h-512.png`, `h-maskable-512.png`; also the notification icon in `admin-sw.js`). New file
  names because Slate caches `public/` files for a year.
- Share image: `brand/share-card-2.jpg`, the old card with the tiger painted out.
- Tracker: the emblem beside the wordmark is gone (sign-in and side rail).
- **The opening animation is gone** (`components/intro.tsx` and its styles): it was the tiger breathing fire. It is
  in git history if a new emblem ever wants an intro.
- Deleted: `emblem.svg`, `01-Tiger-Emblem.svg`, `03-Primary-Horizontal.svg`, `signature.svg`,
  `apple-touch-icon.png`, `share-card.jpg`, the old admin icons.
- Checked: tsc, eslint, `next build`; Home at 1366 and 375 wide, About, the tracker demo; no broken images, no
  sideways scroll. Not checked: `/admin` signed in, an installed phone app (it keeps its old icon until reinstalled),
  how link previews look on LinkedIn or iMessage (they cache old images).
- Not legal advice was given; a trademark search for the name HEURIAL (tmsearch.uspto.gov) is still to do.

## Live 2026-11-14: $49 workflow plan and package examples (`2342fec`)

Website only. Pricing section has a $49 "workflow plan" strip above the three packages (one task, a one-page plan, the
$49 comes off any package), and each package has a "For example" line. Hero fact reads "Start from $49". "Get a plan"
goes to `/contact?plan=1`, which pre-fills the message; the thank-you note says a payment link follows and the plan
arrives within three working days of payment (wording approved by the owner). The assistant's pricing passage
includes the plan.

**Payment links (2026-11-15, Stripe account "Heurial", made in the dashboard):** $49 workflow plan
`https://buy.stripe.com/5kQ3cufIt73DddW8EM8AE00`; deposits (half up front) Quick fix $147.50
`https://buy.stripe.com/eVqaEW1RD1Jj0racV28AE01`, One workflow $247.50
`https://buy.stripe.com/4gMcN40Nzew51vedZ68AE02`, Two workflows $447.50
`https://buy.stripe.com/7sYaEW53P5Zz4HqbQY8AE03`. Second halves are sent as Stripe invoices by hand. Each link
collects email and name; tax category Consulting Services; "Collect tax automatically" is on (owner to check with an
accountant). Stripe was still reviewing the account (2-3 days) when they were made. **Live 2026-11-15 (`aead99b`,
merged and deployed on the owner's go-ahead):** after a plan request the thank-you panel shows a primary **Pay $49** button
(`PLAN_PAYMENT_URL` in `lib/site.ts`, the visitor's email pre-filled with `?prefilled_email=`); "Pick a time" becomes
secondary there. The confirmation email (`inquiries` function) does not include the link yet. The business plan spreadsheet is at `~/heurial-dev/plan/HEURIAL-plan.xlsx` (outside
the repo).

## Live 2026-11-14: intro skipped on phones and tablets (`c33b4d8`)

Website only. The `100lvh` height fix below did **not** remove the strip at the bottom on the owner's iPhone, and there
is no iPhone or simulator on this Mac to test another attempt (the simulator needs a full Xcode install). The intro's
inline script now also returns under `(hover: none) and (pointer: coarse)`, so touch devices go straight to the page.
Computers are unchanged. To bring it back on phones: reproduce in a simulator first, then fix.

## Live 2026-11-14: intro phone fix and three review changes (`9f9dd4b`)

Website only (Slate Production); no Catalyst function or table change. Branches `intro-phone-height` and
`review-quick-wins`, both merged.

- **Intro on phones:** the veil was sized from `window.innerHeight`, so a strip of the page showed at the bottom on a
  phone. `.intro` is now `100lvh` tall (`min-height: 100vh` for browsers without `lvh`) and the canvases take their
  height from it. Not reproducible in the preview (no browser bars); **needs a look on a real phone**.
- **Assistant pricing answer:** `content/knowledge.json` passage `founding-offer` is now prices and terms only; what each
  package includes is a new passage `packages` right after it. Passages may contain line breaks (`white-space: pre-line`
  in the chat and the source list).
- **Demos page:** `PageIntro` has a `compact` option, used on `/products` so the tracker starts on the first screen.
- **Book a call:** every "Book a free call" button opens `BOOKING_URL` in a new tab (`ButtonLink` renders a plain link
  for an `http` address). Contact stays in the navigation for messages.

Checked live: all public pages 200, `/admin` 307, `/api/ask` returns the short pricing answer, the compact intro and
the `.intro` height rule are served. Not checked: a real phone, the Zoho calendar itself.

Still open from the same review (each needs the owner first): tracker project page, package examples and limits,
support and reliability section, About photo and video, Zoho Bookings branding. Left out on purpose: three guided
buttons above the demo, and the three practical guides.

## Live 2026-11-14: paid date on leads (`e1ce08a`)
Released on the owner's go-ahead, in this order:
1. **Column in Development:** `Leads.paid_at` created through the Catalyst connector (`Create_Column`: varchar, max
   length 10, not mandatory, not unique, no search index, no audit), the same shape as `booked_at`. Proved with a
   test row in Development: a date stored, changed, then cleared with an empty string; the row was deleted.
2. **Function to Development:** `catalyst deploy --only functions:pipeline` from `e1ce08a`. Development `pipeline`
   has no `PIPELINE_KEY`, so every request there answers 401 and a keyed test is not possible in Development.
3. **Console deployment "Paid date on leads (e1ce08a)":** Serverless and CloudScale ticked, Job Scheduling and
   Settings unticked. The diff listed exactly two entities, `pipeline` Updated and `Leads.paid_at` Added, and
   nothing else. Deployment Successful.
4. **Production checked:** the connector lists `paid_at` on Production `Leads`; the function answers 401 without a
   key and 200 with it, and every lead in the reply carries a `paid_at` field (5 leads, none paid yet). Its key
   survived the deployment.
5. **Website:** main fast-forwarded to `e1ce08a` and deployed to Slate Production. All public pages 200, `/admin`
   redirects, tracker files reload under fingerprint `7236813f8e`. On the live demo a lead moved to Paid gets
   today as Paid on, and Total earned, Won so far and the payments list move together. No console errors.
- Not checked: `/admin` after sign-in, and marking a real lead Paid in Production (that would change real data).

### What that release changed
Built on the money view that went live at `1bd524b`. Main (`8eff53c`) is merged in, so this branch fast-forwards.
Asked for: the money line should put each payment on the day it was paid, not the day its call was booked.
- **New lead field `paid_at`** (`YYYY-MM-DD`, optional) in `core.js` and its browser copy (in sync). The rule lives in
  one function, `withPaidDate`: moving a lead to Paid stamps today unless a date is given; while it is Paid the date
  can be changed or emptied; **leaving Paid clears it**, and paying again stamps the day you do it. So a card dragged
  out of Paid and back by mistake needs its Paid on corrected. A paid date sent for an unpaid lead is dropped.
- **Tracker** (`tracker.js`): `moneyPath()` uses `paid_at` and falls back to `booked_at` for a lead with none. The
  payments list shows the paid date. The lead panel has **Paid on** beside the value, shown only for the Paid stage
  (it starts on today for a lead that is just becoming paid). The CSV export has a `paid_at` column.
- **Won so far changed source.** It used the server's revenue figure, which counts leads *booked* in the period. That
  no longer matches a line drawn by paid date, so the tile now reads the line itself: what the period added, and its
  arrow compares with the period before. Line, Total earned, Won so far and the payments list are one calculation.
- **Footnote:** the "sits on the day its call was booked" line is gone. A footnote appears only while payments in view
  have no paid date, with the count, and says how to fix it (fill in Paid on).
- **Left alone on purpose:** Conversion, Sources, Earned per hour, the Pipeline and Leads lists and the daily email
  still group by the day the call was booked ("of the calls booked in this period..."). Their revenue for a period can
  differ from Won so far. Say so if the owner wants those moved to paid dates too.
- Also fixed: the panel now refreshes from every lead, not just those booked in the chosen period. Before, a lead
  opened from outside the period kept showing its old values after a save.

**Catalyst: done 2026-11-14 (see above).** The steps below are how a column reaches Production, kept for the next schema change.
- **Development:** console → Project-Rainfall → Development → CloudScale → Data Store → `Leads` → **Schema View** →
  **+ New Column** → Column Name `paid_at`, Data Type **Var Char**, Max Length `10`, everything else off or empty →
  **Create**. (Button names are from Catalyst's help page; I did not click through the console.)
- **Production:** read-only, so there is no direct step. After the Development column exists: Settings (gear) →
  Environments → Deployments → **Create Deployment** → tick **CloudScale** (and **Serverless** to move `pipeline` in
  the same deployment) → **Generate Diff** → check it lists the `Leads` column and the `pipeline` change and nothing
  unexpected → **Initiate Deployment** → **Yes, Proceed**.
- Existing rows are left as they are. A lead already marked Paid has no paid date until Paid on is filled in.
- **Safe before the column exists.** The function saves the lead first and the paid date in a second update. If
  Catalyst refuses that one, the lead is still saved, the reply carries `paid_at_saved: false`, and the tracker says
  "The paid date wasn't saved: the Leads table may still need its paid_at column." A save that doesn't change the
  paid date never writes the column at all. A test makes the store refuse the column and checks all of this.
- **Release order:** column in Development → `pipeline` to Development → console deployment (CloudScale + Serverless)
  → website. Other orders don't break anything; paid dates are just not kept until column and function are both
  live. With the new website and the old function, Paid on shows but is dropped without a warning, so do the
  function first.
- Checks: tsc, eslint, `next build`, 21 pipeline tests (2 new). In the preview (`/demo/tracker/index.html`): all
  five periods agree (Month: Total earned $6,765, $4,090 from 4 payments, Won so far $4,090); editing Paid on moves
  the payment; choosing Paid in the panel and the Move menu both land on today, not the booked date; leaving Paid
  clears the date; emptying Paid on brings back the booked date and the footnote; the warning shows on all three
  save paths (tried with a stand-in reply); phone width stacks the fields.
- Not checked: `/admin` signed in (the local dev setup has no sign-in values now), the real Catalyst refusal (the
  code does not depend on its wording), a real phone, Safari, light mode for the new field.

## Live 2026-11-14: assistant chat and tracker money view (`1bd524b`)
- Merged to main by fast-forward (main had not moved) and deployed to Slate Production on the owner's go-ahead.
- Checked live on www.heurial.studio: every public page returns 200 and `/admin` still redirects; the assistant on
  `/resources` answered "What does it cost?" with its source chip; the tracker demo loads the new files (fingerprint
  `0ec69d7818`) and shows the three tiles, Total earned and the payment steps; no console errors.
- Not checked: `/admin` after sign-in. It now makes a second request (`/api/data?range=all`) on every refresh, the
  same request the All button has always made.
- **Deploying while another session uses the dev folder:** a second session (branch `paid-date`, adding a paid
  date to leads) had `~/heurial-dev/heurial-design` checked out on its own branch, and a deploy builds whatever is in
  the folder. So this release was built from a clean copy: `git worktree add --detach ~/heurial-dev/heurial-release
  <sha>`, `cp -cR node_modules` into it, copy `.catalyst/`, `.catalystrc` and `catalyst.json` (all untracked), deploy
  from there, then remove the copy. Check `git status` and the branch before any deploy.

### What that release changed
Asked for: the real knowledge assistant and the real tracker should look and move like their previews on the home
page, and the tracker should be simpler, with lines that "follow the path of your money".
- **Assistant** (`components/assistant.tsx`, `app/interiors.css`): a chat. Questions on the right, answers on the
  left with a chip linking to the passage used, earlier turns kept, suggested questions asked on tap.
- **Tracker look** (`public/tracker/tracker.css`): the site's font (Inter Tight) and colours, flat panels, hairline
  borders, 8-10px corners, paper-coloured main button. Glows and the gradient button are gone. Light mode still works.
- **Overview** (`tracker.js`): three tiles as in the preview (Open leads, Due today, Won so far), then the money
  panel: Total earned, what the chosen period added, a green step line that rises on the day of each paid lead, and
  the list of those payments. Then Needs attention and the reports. Removed: the sparkline, the calls-booked bars
  under the chart, and the Per hour tile (still in the Earned per hour report).
- **How the line is built:** `moneyPath()` in the browser, from every paid lead. `load()` now also requests
  `/api/data?range=all` so the line can start from what was earned before the period. No back-end change in this
  release: `core.js` and its browser copy were untouched.
- **Limit, answered on `paid-date` (above):** in this release a lead has no paid date, so a payment sits on the day
  its call was booked and the panel says so.
- **Pipeline:** plain columns; each card has a dot (red late, amber due today, blue upcoming, green paid, grey
  nothing set), name, business, next step and the Move menu. The stage-mix bar is gone. A card that changes column
  travels there with a lifted blue edge (after a drop, from where it was let go).
- **Sample data** (`public/demo/tracker/index.html`): nine paid projects over four months instead of four.
- Checked in the preview: Overview, Pipeline, Leads, the lead panel, light mode, 375px wide, the framed demo on
  `/products`, and the `/admin` sign-in screen. tsc, eslint, `next build` and the 19 pipeline tests pass.
- Not checked: `/admin` after sign-in with real data, a real phone, Safari.

## Live 2026-11-14: opening animation (`b6a2888`)
- Merged to main by fast-forward (main had not moved) and deployed to Slate Production on the owner's go-ahead.
  Checked live on www.heurial.studio: the intro shows on first load, ends by itself about 2.0 seconds after first
  paint, no console errors; `/contact` and `/services` return 200 and `/admin` still redirects.
- Deploy note: the first deploy run printed nothing and exited 1 when its output was piped through `grep | tail`.
  Run again with the output written to a file, it built and went live. Write the deploy output to a file, then read it.
- Opening animation on the home page only, about two seconds: the tiger lands and breathes blue pixel fire. The fire
  flies into the page's own words and buttons, burns there as pixels, cools into code characters, and leaves the real
  page. `components/intro.tsx`, styles at the end of `app/home.css`, one line in `app/page.tsx`.
- The owner rejected the first version (soft, realistic orange fire that spread as a ring): "too hard to look real".
  Asked for pixelated and code-like, blue, and for the fire to end up in the text and buttons instead of flying off.
- How it knows where the text is: at the moment the fire starts it redraws the visible text, letter by letter where
  the browser placed it, plus `.button`, `button` and the header logo, onto a small hidden canvas and marks the grid
  squares that have ink (`contentMap`). Nothing in the page needs marking up for this.
- Shows once per browser tab (sessionStorage `heurial-intro`), never under reduced motion, never on a page change
  back to home. Any tap, key or scroll skips it. To see it again: open the site in a new tab.
- It is hidden by default and an inline script shows it during page load, so with scripts off the page is just the
  page. If the script that runs it never arrives, CSS fades it out after 4 seconds. A cap ends it at 2.6 seconds of
  animation whatever happens.
- The emblem path is copied into `intro.tsx` (split into body and mouth flame). If `public/brand/emblem.svg` ever
  changes, update `BODY`, `WISP` and `MOUTH` there.
- Checked in the preview at 1440x900, 583x744 and 375x812: about 2.0 seconds from first paint, 60 frames a second,
  no console errors; skip, reload, page change and the CSS fallback all behave. Not checked: a real phone, Safari,
  reduced-motion mode.

## Live 2026-11-13: interactive hero (`dcd870f`)
- Merged to main and deployed to Slate Production. `components/flow-board.tsx` replaces the abstract canvas in the
  hero (`system-field.tsx` is kept, unused, so switching back is a two-line change in `app/page.tsx`). Three tasks on
  the left, the workflow in the middle, four tools on the right; replies wait for an Approve tap (the demo taps by
  itself after 3.8 s). On phones it sits below the hero buttons.
- Checked live on www.heurial.studio: the board renders, tasks run, no console errors; /contact 200, /admin 307.
  Unchecked: reduced motion, a real phone, and a contact-form send after this deploy (no keys changed).

## Live 2026-11-13 (`47d2cf4`): everything in the branch notes below except `site-font`
- Merged to main (fast-forward from `contact-polish`) and deployed to Slate Production with the owner's go-ahead,
  which also confirmed the three package details. Website only; no Catalyst function changed.
- Checked live on www.heurial.studio: home (hero board, steps rail, calculator, three price cards, demo previews),
  Questions page (11 questions, menu label), Contact (booking card, form), the demo tracker (period labels, Revenue
  $1,500 equals the chart total, no console errors); /admin 307; `/api/contact` answers 400 to an empty body.
- Live form test after this deploy (owner approved): sent as "TEST Release Check" with the owner's own address,
  saved in about 5 s, thank-you screen shown with the confirmation line. One more test row to dismiss.
- Unchecked after this deploy: a test booking (the Meet invite is still unverified), signing in to /admin with the
  new tracker files, a real phone, light mode in the tracker.
- **Font live 2026-11-13 (`7a8e598`):** `site-font` merged and deployed with the owner's go-ahead. All site text is
  Inter Tight, numbers in sentences included. Standalone figures (class `num`: prices, totals, counters) are
  Helvetica. The first version left digits out of the font so they fell back to Helvetica everywhere, which made
  numbers in sentences look heavier than the words around them; that was changed before release. Checked on every
  page at desktop and on Home, Contact and Questions at phone size: no overflow or cut-off text. The tracker keeps
  its own font (IBM Plex Sans). **Mistake and fix:** the first font file (`inter-tight.woff2`, shipped in
  `2003c60`) was a single light weight, so bold text and headings rendered regular on the live site for about ten
  minutes. Caught in the live check by measuring text width at several weights; replaced with the variable file
  under a new name (`inter-tight-var.woff2`, because Slate caches `public/` files for a year) and redeployed. When
  adding a font, confirm the width changes with weight.
- Still not merged: `tracker-settings` (parked).

## Branch notes for that release (all merged except `site-font`)
- `home-polish` (`649723f`) combines `calc-impact`, `flow-polish` and `steps-polish`. `pricing-packages` is built on
  top of it, so it carries all four changes and is the one to release.
- `contact-polish` is built on `booking-simple`, so it carries everything below and is the one to release. The
  contact page's two cards are now matching "window" cards (title bar, blue corner light). The booking card has a
  clock dial with 20 of 60 minutes filled, three steps on a small rail (pick a time, tell me the task, get a
  straight answer) and a larger "Pick a time" button. The form sits in the second card with softer fields and a
  blue focus ring. Same form fields and `/api/contact`; no test message or booking was sent.
- `booking-simple` is built on `tracker-ease`, so it carries everything below. Contact page: booking is now the
  main card ("Pick a time", primary button to Zoho Bookings) and the form is the second choice ("Or send me a
  message"). The "What to include" list is gone. The form has the same fields and field names, in a new order
  (name, email, task, then business and how-heard marked optional), a "Send message" button, and the saved-data
  note under the button. `/api/contact` is untouched; no test message was sent.
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
