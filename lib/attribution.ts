// Where a lead came from. Shared by the browser (capture) and the server (validation + labelling).

/** Tracking-link tags you put in each channel, e.g. heurial.studio/?src=instagram */
export const SOURCE_TAGS: Record<string, string> = {
  referral: "Referral",
  network: "Personal network",
  "cold-email": "Cold outreach",
  outreach: "Cold outreach",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  partner: "Partner",
  newsletter: "Newsletter",
  event: "Event",
  website: "Website",
};

/** Answers to "How did you hear about HEURIAL?" on the contact form. */
export const HEARD_OPTIONS: Record<string, string> = {
  referral: "Someone referred me",
  network: "I know Uriyah",
  search: "Google or another search",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  "cold-email": "An email from HEURIAL",
  other: "Somewhere else",
};

const HEARD_TO_SOURCE: Record<string, string> = {
  referral: "Referral", network: "Personal network", search: "Search", instagram: "Instagram",
  linkedin: "LinkedIn", "cold-email": "Cold outreach", other: "Other",
};

const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|search\.yahoo)\./;
const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com|m\.facebook\.com)$/, "Facebook"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)(tiktok\.com)$/, "TikTok"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "X / Twitter"],
];

export type Attribution = {
  src?: string; // ?src= tag
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string; // only the website name, never the full address
  landingPath?: string;
  firstSeen?: string; // ISO time of the first page view this visit
};

export const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const HOST = /^[a-z0-9.-]{1,253}$/;
const PATH = /^\/[\w\-./%]{0,199}$/;

/** Keep only well-formed fields; anything else is dropped rather than trusted. */
export function cleanAttribution(raw: unknown): Attribution {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const pick = (k: string, re: RegExp) => {
    const v = typeof r[k] === "string" ? (r[k] as string).trim().toLowerCase() : "";
    return v && re.test(v) ? v : undefined;
  };
  const path = typeof r.landingPath === "string" && PATH.test(r.landingPath) ? r.landingPath : undefined;
  const firstSeen = typeof r.firstSeen === "string" && !Number.isNaN(Date.parse(r.firstSeen)) ? new Date(r.firstSeen).toISOString() : undefined;
  return {
    src: pick("src", SLUG),
    utmSource: pick("utmSource", SLUG),
    utmMedium: pick("utmMedium", SLUG),
    utmCampaign: pick("utmCampaign", SLUG),
    referrerHost: pick("referrerHost", HOST),
    landingPath: path,
    firstSeen,
  };
}

const titleCase = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Decide one source label. Order: tracking tag, UTM source, referring website, what they told us, then Direct.
 * Returns the label plus how it was decided, so a wrong guess can be spotted in the tracker.
 */
export function resolveSource(a: Attribution, heard?: string): { source: string; sourceDetail: string } {
  const tag = a.src || a.utmSource;
  if (tag) {
    const how = a.src ? `tracking link ?src=${a.src}` : `utm_source=${a.utmSource}`;
    const campaign = a.utmCampaign ? `, campaign ${a.utmCampaign}` : "";
    return { source: SOURCE_TAGS[tag] ?? `Campaign: ${titleCase(tag)}`, sourceDetail: how + campaign };
  }
  if (a.referrerHost) {
    const host = a.referrerHost.replace(/^www\./, "");
    if (SEARCH_HOSTS.test(host)) return { source: "Search", sourceDetail: `came from ${host}` };
    const social = SOCIAL_HOSTS.find(([re]) => re.test(host));
    if (social) return { source: social[1], sourceDetail: `came from ${host}` };
    return { source: "Website link", sourceDetail: `link on ${host}` };
  }
  if (heard && HEARD_TO_SOURCE[heard]) return { source: HEARD_TO_SOURCE[heard], sourceDetail: "they told us on the form" };
  return { source: "Direct", sourceDetail: "typed the address or no source was recorded" };
}
