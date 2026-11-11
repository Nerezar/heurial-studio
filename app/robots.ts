import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.SITE_URL;
  return origin
    ? { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }, sitemap: new URL("/sitemap.xml", origin).href }
    : { rules: { userAgent: "*", disallow: "/" } };
}
