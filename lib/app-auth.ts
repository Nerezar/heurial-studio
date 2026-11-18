import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Customer sign-in for Autopilot (/app). The pipeline function checks the emailed link; this site then keeps
// who is signed in, and for which business, in a signed http-only cookie.
//   APP_SESSION_SECRET  long random string (32+ characters); changing it signs every customer out

export const APP_COOKIE = "heurial_app";
const APP_PATH = "/api/app";
const MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
const ID = /^\d{1,20}$/;

const secret = () => process.env.APP_SESSION_SECRET ?? "";
export const appConfigured = () => secret().length >= 32;
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createAppSession(userId: string, tenantId: string) {
  if (!ID.test(userId) || !ID.test(tenantId)) throw new Error("bad session ids");
  const payload = `${Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS}.${userId}.${tenantId}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

/** The signed-in user and business, or null. */
export function readAppSession(request: Request): { userId: string; tenantId: string } | null {
  if (!appConfigured()) return null;
  let token = "";
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === APP_COOKIE) token = rest.join("=");
  }
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const given = Buffer.from(parts[4]);
  const good = Buffer.from(sign(parts.slice(0, 4).join(".")));
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  if (Number(parts[0]) <= Date.now() / 1000 || !ID.test(parts[1]) || !ID.test(parts[2])) return null;
  return { userId: parts[1], tenantId: parts[2] };
}

export function appCookieHeader(value: string, maxAge = MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${APP_COOKIE}=${value}; Path=${APP_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
