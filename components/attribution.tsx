"use client";

import { useEffect } from "react";
import { cleanAttribution, type Attribution } from "@/lib/attribution";

const KEY = "heurial-visit-source";

/**
 * Remembers how this visit started (tracking tag, UTM tags, referring website) for the length of the
 * browser tab, so the contact form can include it. No cookies; nothing leaves the browser until someone
 * submits the form.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const p = url.searchParams;
      const tagged = p.has("src") || p.has("utm_source");
      const stored = readVisitSource();
      // The first tracking link wins. A tagged link can replace an untagged first visit, never another tag.
      if (sessionStorage.getItem(KEY) && (stored.src || stored.utmSource || !tagged)) return;
      let referrerHost: string | undefined = stored.referrerHost;
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.host !== url.host) referrerHost = ref.hostname;
      }
      const visit = cleanAttribution({
        src: p.get("src") ?? undefined,
        utmSource: p.get("utm_source") ?? undefined,
        utmMedium: p.get("utm_medium") ?? undefined,
        utmCampaign: p.get("utm_campaign") ?? undefined,
        referrerHost,
        landingPath: url.pathname,
        firstSeen: new Date().toISOString(),
      });
      sessionStorage.setItem(KEY, JSON.stringify(visit));
    } catch {
      // Storage blocked (private mode, strict settings): the form still works without a source.
    }
  }, []);
  return null;
}

export function readVisitSource(): Attribution {
  try {
    return cleanAttribution(JSON.parse(sessionStorage.getItem(KEY) ?? "{}"));
  } catch {
    return {};
  }
}
