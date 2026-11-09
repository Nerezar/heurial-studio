export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function handleError(error: unknown) {
  if (error instanceof RequestError) return reply({ error: error.message }, error.status);
  return reply({ error: "The request could not be completed. Please try again." }, 500);
}

export async function readObject(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const configured = process.env.SITE_URL;
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const allowedOrigin = configured ? new URL(configured).origin : `${url.protocol}//${host}`;
  const origin = request.headers.get("origin");
  if ((origin && origin !== allowedOrigin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestError(403, "This request must come from the HEURIAL site.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError(415, "Send the request as JSON.");
  }
  if (!request.body) throw new RequestError(400, "The request body is required.");
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RequestError(413, "The request is too large.");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new RequestError(413, "The request is too large.");
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestError) throw error;
  } finally {
    reader.releaseLock();
  }
  throw new RequestError(400, "The request must contain a valid JSON object.");
}

export function getText(data: Record<string, unknown>, key: string, label: string, min: number, max: number, multiline = false) {
  const value = data[key] ?? "";
  if (typeof value !== "string") throw new RequestError(400, `${label} must be text.`);
  const text = value.trim();
  const controls = multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u : /[\u0000-\u001F\u007F]/u;
  if (text.length < min || text.length > max || controls.test(text)) {
    throw new RequestError(400, `${label} must contain ${min}–${max} characters of valid text.`);
  }
  return text;
}

// Process-local quota. A public deployment should also limit requests at the edge.
export function makeQuota(limit: number) {
  let used = 0;
  let reset = 0;
  return () => {
    const now = Date.now();
    if (now >= reset) {
      used = 0;
      reset = now + 60_000;
    }
    if (used >= limit) throw new RequestError(429, "The service is busy. Please try again in a minute.");
    used++;
  };
}
