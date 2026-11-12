import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
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
    }];
  },
};

export default config;
