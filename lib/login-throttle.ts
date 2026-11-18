import { createHmac } from "node:crypto";

// Slows down password guessing on /api/admin/login: at most 8 wrong attempts per visitor in 15 minutes.
// The count is kept by the pipeline function in the Data Store (table LoginAttempts), so it survives restarts and
// is shared by every copy of this site. If that can't be reached, or the table doesn't exist yet, this process
// keeps its own count per visitor as a fallback: weaker, but never open.
// A public deployment should still rate-limit this route at the edge.

const WINDOW_MS = 15 * 60_000, EACH = 8, ALL = 60;
const local = new Map<string, number[]>();

export function pipelineBase() {
  const url = process.env.PIPELINE_FUNCTION_URL?.trim() ?? "";
  if (url.startsWith("https://")) return url;
  if (process.env.NODE_ENV === "development" && url.startsWith("http://127.0.0.1")) return url;
  return "";
}

/** A visitor's key: a keyed hash of their address, so no address is stored anywhere. */
export function visitorScope(request: Request) {
  // shortcut: trusts the first X-Forwarded-For hop, which the host sets; behind a proxy that passes a client's own header through, guesses could be spread across made-up addresses (the ceiling across all visitors still applies).
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.ADMIN_SESSION_SECRET ?? "").update(`login:${ip}`).digest("hex").slice(0, 32);
}

function localCount(scope: string, event: "check" | "fail" | "ok") {
  const now = Date.now();
  for (const [key, times] of local) {
    const live = times.filter((t) => now - t < WINDOW_MS);
    if (live.length) local.set(key, live); else local.delete(key);
  }
  if (event === "ok") local.delete(scope);
  if (event === "fail") local.set(scope, [...(local.get(scope) ?? []), now]);
  let total = 0;
  for (const times of local.values()) total += times.length;
  return (local.get(scope)?.length ?? 0) >= EACH || total >= ALL;
}

/** Record an event for this visitor and say whether they are blocked right now. */
export async function loginThrottle(scope: string, event: "check" | "fail" | "ok"): Promise<boolean> {
  const here = localCount(scope, event);
  const base = pipelineBase(), key = process.env.PIPELINE_FUNCTION_KEY?.trim();
  if (!base || !key) return here;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/auth/throttle`, {
      method: "POST",
      headers: { "X-Heurial-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ scope, event }),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    const body = (await res.json()) as { persistent?: boolean; blocked?: boolean };
    return res.ok && body.persistent ? Boolean(body.blocked) || here : here;
  } catch {
    return here;
  }
}
