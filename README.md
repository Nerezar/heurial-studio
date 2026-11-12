# HEURIAL

HEURIAL’s local site includes Home, Studio, Learn, About, Contact, and a follow-up tracker demo. It uses Next.js App Router, React, TypeScript, and a custom CSS design system. The demo (`public/demo/tracker`) runs entirely in the browser on made-up sample data; nothing is saved or sent.

The [reference audit](REFERENCE-AUDIT.md) records the source observations behind the redesign. The homepage uses an original SVG wireframe and a scroll-linked workflow diagram. Page changes use browser view transitions when supported, and the site respects the system’s reduced-motion setting.

## Run locally

Use Node.js 20.9 or later. Open this directory in VS Code and run:

```sh
npm ci
npm run dev
```

Visit [http://127.0.0.1:3000](http://127.0.0.1:3000). Run `npm run lint` and `npm run build` to check the project. To run the production build locally, use `npm start`.

## Knowledge assistant

The public passages live in [content/knowledge.json](content/knowledge.json). Edit the text, titles, and keywords there. Keep each ID unique and stable because the same records render the public source pages and power citations. Keep confidential material out of this file.

The default server route ranks passages by keyword overlap and returns the top matching excerpt or a no-match result. For optional model reranking, copy `.env.example` to `.env.local` and set `OLLAMA_MODEL` to an installed model. The server calls the [Ollama chat API](https://docs.ollama.com/api/chat) on the same machine at `127.0.0.1:11434`. It sends the question and up to four retrieved public excerpts. It accepts only IDs from those excerpts and renders the stored text and citations. If the model is unavailable or its response is invalid, keyword retrieval takes over. Keep Ollama bound to loopback.

## Inquiry inbox

Development stores submitted inquiries at `.heurial-data/inquiries.jsonl`. This directory is ignored by Git and is outside the public assets folder. Each saved line contains the inquiry reference, time, and submitted fields. The form confirms receipt after the server writes and syncs the record. It does not send an email or trigger a notification.

For a production server, set `CONTACT_FILE` to an absolute file path in a private persistent volume writable by the app. Arrange for an operator to review that file and handle retention. Without a configured path, the production contact page reports the inbox as unavailable. Stateless hosting needs a persistent inquiry backend before enabling the form. API limits are process-local. Add rate limiting at the edge for public traffic.

## Site and branding

Set `SITE_URL` to the final HTTPS origin before building for a public domain. It controls the sitemap, robots policy, and browser form origin. Without it the site disallows crawler indexing. The original supplied horizontal SVG is preserved under `public/brand/`. The interface uses background-free SVGs that preserve the original tiger, wordmark, and signature paths.

See [Next.js installation and script reference](https://nextjs.org/docs/app/getting-started/installation) for framework details.
