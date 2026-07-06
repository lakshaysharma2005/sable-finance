// Usage: node scripts/hash-password.mjs "your password"
// Prints an APP_PASSWORD_HASH value (scrypt, salt:hash hex).
import { randomBytes, scryptSync } from "crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your password"');
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`${salt}:${hash}`);
