import { adminConfigured, readSessionCookie, sameOrigin, sessionCookieHeader, sessionValid } from "@/lib/admin-auth";
import { reply } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Is the owner signed in? The tracker page asks this before loading anything. */
export async function GET(request: Request) {
  return reply({ configured: adminConfigured(), signedIn: sessionValid(readSessionCookie(request)) });
}

/** Sign out: clears the cookie in this browser. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Forbidden" }, 403);
  const response = reply({ ok: true });
  response.headers.append("Set-Cookie", sessionCookieHeader("", 0));
  return response;
}
