import type { MetadataRoute } from "next";
import { links } from "@/components/shell";
import { siteOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return links.map(({ href }) => ({ url: new URL(href, siteOrigin()).href }));
}
