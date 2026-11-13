/** The public address of the site. SITE_URL can override it; nothing breaks when SITE_URL isn't set. */
export const CANONICAL_ORIGIN = "https://www.heurial.studio";

export function siteOrigin() {
  const configured = process.env.SITE_URL?.trim();
  return configured && /^https?:\/\//.test(configured) ? new URL(configured).origin : CANONICAL_ORIGIN;
}

/**
 * True when a request came in on the real domain (www or bare), as opposed to the Slate preview address or a local
 * server. Only the real domain is opened to search engines, so the same pages aren't indexed twice.
 */
export function isPublicHost(host: string | null | undefined) {
  const name = String(host ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const canonical = new URL(siteOrigin()).hostname;
  const bare = canonical.replace(/^www\./, "");
  return name === canonical || name === bare;
}
