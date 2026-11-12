// Makes the key pair for phone and desktop notifications (Web Push "VAPID" keys).
//   node scripts/make-vapid-keys.mjs
// Put both values on the Catalyst "pipeline" function as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
// The private key is a secret: don't commit it or paste it into chat. Making new keys means every device
// has to turn notifications on again.
import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log("\nAdd these to the pipeline function's environment variables:\n");
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
const priv = ecdh.getPrivateKey(); // can be shorter than 32 bytes when it starts with zeros
console.log(`VAPID_PRIVATE_KEY=${Buffer.concat([Buffer.alloc(32 - priv.length), priv]).toString("base64url")}`);
console.log("");
