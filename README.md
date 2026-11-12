# HEURIAL Studio

The website for HEURIAL Studio: Home, How it works, Demos, About, Contact, and Guides. It uses Next.js (App Router), React, and TypeScript, with a hand-written dark "glass" design system and no UI framework.

## Run locally

Use Node.js 20.9 or later.

```sh
npm ci
npm run dev
```

Visit [http://127.0.0.1:3000](http://127.0.0.1:3000). Run `npm run lint` and `npm run build` to check the project. To run the production build locally, use `npm start`.

Keep the project out of iCloud-synced folders (such as Documents with "Optimize Mac Storage" on). iCloud offloads `node_modules`, and builds then hang.

## Where things are

| Area | Files |
| --- | --- |
| Design system: colours, type, chips, buttons, glass cards, notes, forms | `app/globals.css` |
| Navigation pill, footer, page intros, closing panel, page-change motion | `app/shell.css`, `components/shell.tsx`, `components/navigation.tsx`, `components/route-transition.tsx` |
| Homepage sections | `app/page.tsx`, `app/home.css` |
| Interior pages | `app/*/page.tsx`, `app/interiors.css` |
| Hero ring animation | `components/system-field.tsx` |
| "Watch one run" example workflow | `components/workflow-demo.tsx` |
| Time-savings calculator | `components/savings-calculator.tsx` |
| Follow-up tracker: the shared interface (styles and app) | `public/tracker/tracker.css`, `public/tracker/tracker.js` |
| Real tracker at `/admin` (sign-in and the `/api/admin/*` data source) | `public/admin/index.html`, `app/api/admin/`, `lib/admin-auth.ts` |
| Tracker demo (same interface, sample data held in the browser) | `public/demo/tracker/`, `components/demo-frame.tsx` |

Accent colours are the CSS variables `--signal`, `--cyan`, `--green`, `--amber`, `--red`, and `--violet`. A chip, note, or icon tile takes its colour from `--c` (see `lib/style.ts`).

The real tracker and the public demo are one app. Each page only supplies a data source and calls `HeurialTracker.start({ mode, api, auth })`: `/admin` uses the signed-in session and `/api/admin/*`; the demo uses made-up data in memory, with the same logic as the back end (`public/demo/tracker/core.js` is a browser copy of `catalyst/functions/pipeline/core.js`, so keep the two in step). Change the interface once, in `public/tracker/`, and both get it.

The site respects the system's reduced-motion setting: page-change wipes, scroll reveals, the ring, and the example workflow all stop or simplify.

## Time-savings calculator

The calculator is plain arithmetic on the visitor's own numbers. Its assumptions are constants at the top of `components/savings-calculator.tsx` and are shown to the visitor under the sliders: a $495 price, a workflow taking over about 70% of the task, and 50 working weeks a year. If you change a constant, change the sentence under the sliders too.

## Knowledge assistant

The public passages live in [content/knowledge.json](content/knowledge.json). Edit the text, titles, and keywords there. Each record renders on the Guides page and powers the assistant's citations, so keep IDs unique. Keep confidential material out of this file.

The server route ranks passages by keyword overlap and returns the best match, or says it found nothing. A short list of topics the guides don't cover (guarantees, testimonials, and similar) always returns "not found"; see `lib/retrieval.ts`. For optional model reranking, copy `.env.example` to `.env.local` and set `OLLAMA_MODEL` to an installed model. The server calls Ollama on the same machine at `127.0.0.1:11434`, sends the question and up to four retrieved excerpts, and only ever renders the stored text.

## Inquiries

The contact form records how each visitor arrived (`?src=` tag, UTM tags, or the referring site) and saves it with their message. See `lib/attribution.ts`.

- **Live site:** set `INQUIRY_FUNCTION_URL` and `INQUIRY_FUNCTION_KEY`. Inquiries go to the Catalyst function in `catalyst/functions/inquiries`, which saves them in the Data Store. Setup steps are in [catalyst/SETUP.md](catalyst/SETUP.md).
- **Development:** inquiries are appended to `.heurial-data/inquiries.jsonl`, which Git ignores.
- **Neither configured:** the Contact page shows an email link instead of the form.

API limits are per server process. Add rate limiting at the edge for public traffic.

## Site address and branding

Set `SITE_URL` to the final HTTPS origin before building for a public domain. It controls the sitemap, the robots policy, and the form origin check. Without it the site asks crawlers not to index it. The original supplied logo files are preserved under `public/brand/`.
