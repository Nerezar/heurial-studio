import { adminConfigured, createSession, sessionCookieHeader, verifyPassword } from "@/lib/admin-auth";
import { handleError, readObject, reply, RequestError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Slow down password guessing: at most 8 wrong attempts per 15 minutes for this server process.
// A public deployment should also rate-limit /api/admin/login at the edge.
const WINDOW_MS = 15 * 60_000;
let failures: number[] = [];

export async function POST(request: Request) {
  try {
    if (!adminConfigured()) throw new RequestError(503, "Admin sign-in isn’t set up yet.");
    const now = Date.now();
    failures = failures.filter((t) => now - t < WINDOW_MS);
    if (failures.length >= 8) throw new RequestError(429, "Too many attempts. Try again in 15 minutes.");

    const body = await readObject(request, 1024);
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifyPassword(password)) {
      failures.push(now);
      await new Promise((r) => setTimeout(r, 400));
      throw new RequestError(401, "That password isn’t right.");
    }
    const response = reply({ ok: true });
    response.headers.append("Set-Cookie", sessionCookieHeader(createSession()));
    return response;
  } catch (error) {
    return handleError(error);
  }
}
