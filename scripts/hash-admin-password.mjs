// Makes ADMIN_PASSWORD_HASH and a fresh ADMIN_SESSION_SECRET for the private /admin tracker.
// Usage: node scripts/hash-admin-password.mjs
// It asks for the password without showing it, and never writes it anywhere.
import { randomBytes, scryptSync } from "node:crypto";
import { stdin, stdout } from "node:process";

function ask(prompt) {
  return new Promise((resolve) => {
    stdout.write(prompt);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false); stdin.pause(); stdin.off("data", onData); stdout.write("\n"); resolve(value);
      } else if (ch === "\u0003") {
        process.exit(1);
      } else if (ch === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await ask("New admin password (12+ characters): ");
if (password.length < 12) { console.error("Use at least 12 characters."); process.exit(1); }
const again = await ask("Type it again: ");
if (again !== password) { console.error("They don't match."); process.exit(1); }

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
console.log("\nAdd these to the Slate app's environment variables:\n");
console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
