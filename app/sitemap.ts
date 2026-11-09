import type { MetadataRoute } from "next";
import { links } from "@/components/shell";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.SITE_URL;
  return origin ? links.map(({ href }) => ({ url: new URL(href, origin).href })) : [];
}
