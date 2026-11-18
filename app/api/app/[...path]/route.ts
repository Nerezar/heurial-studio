import { sameOrigin } from "@/lib/admin-auth";
import { appConfigured, appCookieHeader, createAppSession, readAppSession } from "@/lib/app-auth";
import { handleError, readObject, reply, RequestError } from "@/lib/http";
import { pipelineBase } from "@/lib/login-throttle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Customer (Autopilot) routes → this server → Catalyst "pipeline" function at app/*, with the site key.
// Signed-out routes ask for and use sign-in links; the rest pass the signed-in user and business along.
const OPEN: [string, string][] = [["POST", "signup"], ["POST", "login"], ["POST", "verify"]];
const SIGNED_IN: [string, string][] = [["GET", "me"], ["POST", "billing/checkout"], ["POST", "billing/portal"]];

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    if (!appConfigured()) throw new RequestError(503, "Accounts aren’t set up yet.");
    const method = request.method;
    if (method !== "GET" && !sameOrigin(request)) throw new RequestError(403, "Forbidden.");
    const path = (await context.params).path.join("/");

    if (path === "logout" && method === "POST") {
      const res = reply({ ok: true });
      res.headers.append("Set-Cookie", appCookieHeader("", 0));
      return res;
    }

    const open = OPEN.some(([m, p]) => m === method && p === path);
    const session = open ? null : readAppSession(request);
    if (!open && !SIGNED_IN.some(([m, p]) => m === method && p === path)) throw new RequestError(404, "Not found.");
    if (!open && !session) throw new RequestError(401, "Please sign in.");

    const base = pipelineBase();
    const key = process.env.PIPELINE_FUNCTION_KEY?.trim();
    if (!base || !key) throw new RequestError(503, "Accounts aren’t connected yet (PIPELINE_FUNCTION_URL and PIPELINE_FUNCTION_KEY).");

    const body = method === "POST" ? JSON.stringify(await readObject(request, 4 * 1024)) : undefined;
    let upstream: Response;
    try {
      upstream = await fetch(`${base.replace(/\/+$/, "")}/app/${path}`, {
        method,
        headers: {
          "X-Heurial-Key": key,
          ...(session ? { "X-Heurial-User": session.userId, "X-Heurial-Tenant": session.tenantId } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      throw new RequestError(502, "Couldn’t reach the accounts service. Try again in a moment.");
    }
    const text = await upstream.text();
    if (upstream.status === 401 && text.includes("\"Unauthorized\"")) {
      console.error("Accounts service rejected the key; check PIPELINE_FUNCTION_KEY and PIPELINE_KEY match.");
      throw new RequestError(502, "The accounts service isn’t accepting this site’s key.");
    }
    const res = new Response(text, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

    // A good sign-in link: keep who signed in, and send the page only what it shows.
    if (path === "verify" && upstream.ok) {
      const data = JSON.parse(text) as { user: { id: string }; tenant: { id: string } };
      res.headers.append("Set-Cookie", appCookieHeader(createAppSession(data.user.id, data.tenant.id)));
    }
    // The function no longer knows this user or business: drop the cookie.
    if (!open && upstream.status === 401) res.headers.append("Set-Cookie", appCookieHeader("", 0));
    return res;
  } catch (error) {
    return handleError(error);
  }
}

export const GET = forward;
export const POST = forward;
