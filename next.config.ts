import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// The host caches every file in public/ for a year and ignores the headers below for them. So the tracker's files
// are loaded with ?v=<fingerprint of their contents>, which changes whenever they do and makes browsers fetch them again.
const TRACKER_FILES = ["tracker/tracker.css", "tracker/tracker.js", "tracker/money.js", "demo/tracker/core.js", "demo/tracker/index.html", "admin/index.html"];
const trackerVersion = createHash("sha256")
  .update(TRACKER_FILES.map((f) => readFileSync(`public/${f}`)).join("\0"))
  .digest("hex").slice(0, 10);

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  env: { TRACKER_VERSION: trackerVersion },
  async redirects() {
    return [
      // The site is three pages for now: the overview, Demos and Contact. The old addresses go to the overview.
      ...["/about", "/services", "/resources"].map((source) => ({ source, destination: "/", permanent: false })),
      // The demo is a file, so its folder address needs pointing at it.
      { source: "/demo/tracker", destination: "/demo/tracker/index.html", permanent: false },
    ];
  },
  async headers() {
    const privateArea = [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    // Keep the frame rule disjoint from the embedded demo. Slate serves the
    // first matching X-Frame-Options header, unlike the local Next server.
    {
      source: "/:path((?!demo/tracker(?:/|$)).*)",
      headers: [{ key: "X-Frame-Options", value: "DENY" }],
    },
    // The sample-data tracker demo is shown inside the Demos page, so this one path may be framed by this site only.
    {
      source: "/demo/tracker/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Robots-Tag", value: "noindex" },
      ],
    },
    // The private tracker: never indexed, never cached.
    { source: "/admin", headers: privateArea },
    { source: "/admin/:path*", headers: privateArea },
    { source: "/api/admin/:path*", headers: privateArea },
    // The tracker's notification helper: always fetched fresh, so an update reaches installed apps.
    { source: "/admin-sw.js", headers: privateArea }];
  },
  // The private tracker page is a static file; its data comes from /api/admin/* after sign-in.
  async rewrites() {
    return [{ source: "/admin", destination: "/admin/index.html" }];
  },
};

export default config;
