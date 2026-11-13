import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isPublicHost, siteOrigin } from "@/lib/site";

// Search engines may index the real domain only. The Slate preview address and local servers stay blocked.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  if (!isPublicHost(h.get("x-forwarded-host") ?? h.get("host"))) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
