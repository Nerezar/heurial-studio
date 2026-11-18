import { adminConfigured, createSession, sessionCookieHeader, verifyPassword } from "@/lib/admin-auth";
import { handleError, readObject, reply, RequestError } from "@/lib/http";
import { loginThrottle, visitorScope } from "@/lib/login-throttle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!adminConfigured()) throw new RequestError(503, "Admin sign-in isn’t set up yet.");
    // Wrong attempts are counted per visitor and kept outside this process: see lib/login-throttle.ts.
    const scope = visitorScope(request);
    if (await loginThrottle(scope, "check")) throw new RequestError(429, "Too many attempts. Try again in 15 minutes.");

    const body = await readObject(request, 1024);
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifyPassword(password)) {
      await Promise.all([loginThrottle(scope, "fail"), new Promise((r) => setTimeout(r, 400))]);
      throw new RequestError(401, "That password isn’t right.");
    }
    await loginThrottle(scope, "ok");
    const response = reply({ ok: true });
    response.headers.append("Set-Cookie", sessionCookieHeader(createSession()));
    return response;
  } catch (error) {
    return handleError(error);
  }
}
