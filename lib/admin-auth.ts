import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Owner sign-in for the private /admin tracker. One password, stored only as a scrypt hash.
//   ADMIN_PASSWORD_HASH   made with: node scripts/hash-admin-password.mjs
//   ADMIN_SESSION_SECRET  long random string (32+ characters); changing it signs everyone out

export const SESSION_COOKIE = "heurial_admin";
export const SESSION_PATH = "/api/admin";
const MAX_AGE_SECONDS = 12 * 60 * 60;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

function secret() {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD_HASH?.startsWith("scrypt$") && secret().length >= 32);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string) {
  const [scheme, salt, hash] = (process.env.ADMIN_PASSWORD_HASH ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash || typeof password !== "string" || password.length > 200) return false;
  const expected = Buffer.from(hash, "base64url");
  if (expected.length < 16) return false;
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, SCRYPT);
  return timingSafeEqual(expected, actual);
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSession() {
  const payload = `${Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function sessionValid(token: string | undefined) {
  if (!token || !adminConfigured()) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const given = Buffer.from(parts[2]);
  const good = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  if (given.length !== good.length || !timingSafeEqual(given, good)) return false;
  return Number(parts[0]) > Date.now() / 1000;
}

export function readSessionCookie(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

export function sessionCookieHeader(value: string, maxAge = MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=${SESSION_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

/** Same-site check for requests that change things (the cookie is also SameSite=Strict). */
export function sameOrigin(request: Request) {
  const configured = process.env.SITE_URL;
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const allowed = configured ? new URL(configured).origin : `${url.protocol}//${host}`;
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  return !origin || origin === allowed;
}
