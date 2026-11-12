import { readSessionCookie, sameOrigin, sessionValid } from "@/lib/admin-auth";
import { handleError, readObject, reply, RequestError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signed-in owner → this server → Catalyst "pipeline" function (with the shared key).
// The browser never sees the key, and only these routes can be reached.
const ROUTES: [string, RegExp][] = [
  ["GET", /^data$/],
  ["POST", /^leads$/],
  ["GET", /^leads\/\d{1,20}$/],
  ["PATCH", /^leads\/\d{1,20}$/],
  ["DELETE", /^leads\/\d{1,20}$/],
  ["GET", /^leads\/\d{1,20}\/time$/],
  ["GET", /^leads\/\d{1,20}\/messages$/],
  ["POST", /^messages$/],
  ["POST", /^leads\/\d{1,20}\/draft$/],
  ["POST", /^messages\/\d{1,20}\/approve$/],
  ["DELETE", /^messages\/\d{1,20}$/],
  ["POST", /^time$/],
  ["DELETE", /^time\/\d{1,20}$/],
  ["POST", /^inbox\/\d{1,20}\/(convert|dismiss)$/],
  ["POST", /^digest$/],
];

function pipelineUrl() {
  const url = process.env.PIPELINE_FUNCTION_URL?.trim() ?? "";
  if (url.startsWith("https://")) return url;
  if (process.env.NODE_ENV === "development" && url.startsWith("http://127.0.0.1")) return url;
  return "";
}

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    if (!sessionValid(readSessionCookie(request))) throw new RequestError(401, "Please sign in.");
    const method = request.method;
    if (method !== "GET" && !sameOrigin(request)) throw new RequestError(403, "Forbidden.");

    const path = (await context.params).path.join("/");
    if (!ROUTES.some(([m, re]) => m === method && re.test(path))) throw new RequestError(404, "Not found.");

    const base = pipelineUrl();
    const key = process.env.PIPELINE_FUNCTION_KEY?.trim();
    if (!base || !key) throw new RequestError(503, "The tracker isn’t connected yet (PIPELINE_FUNCTION_URL and PIPELINE_FUNCTION_KEY).");

    const incoming = new URL(request.url);
    const query = new URLSearchParams();
    for (const name of ["range", "preview"]) {
      const value = incoming.searchParams.get(name);
      if (value && /^[a-z0-9]{1,10}$/.test(value)) query.set(name, value);
    }
    const target = `${base.replace(/\/+$/, "")}/${path}${query.size ? `?${query}` : ""}`;

    let body: string | undefined;
    if (method === "POST" || method === "PATCH") {
      const hasBody = Number(request.headers.get("content-length") ?? "0") > 0 || request.headers.get("content-type")?.includes("json");
      body = hasBody ? JSON.stringify(await readObject(request, 32 * 1024)) : undefined;
    }

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method,
        headers: { "X-Heurial-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
        signal: AbortSignal.timeout(path.endsWith("/draft") ? 45_000 : 15_000), // an AI draft takes longer
        cache: "no-store",
      });
    } catch {
      throw new RequestError(502, "Couldn’t reach the tracker service. Try again in a moment.");
    }
    const text = await upstream.text();
    if (upstream.status === 401) {
      console.error("Tracker service rejected the key; check PIPELINE_FUNCTION_KEY and PIPELINE_KEY match.");
      throw new RequestError(502, "The tracker service isn’t accepting this site’s key.");
    }
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleError(error);
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;

export function OPTIONS() {
  return reply({ error: "Not found." }, 404);
}
