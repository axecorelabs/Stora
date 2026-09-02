// One-time (or occasional) way to create a Stora staff account -- there
// is no public signup route in this app at all (see src/lib/betterAuth.js).
// Goes through Better Auth's own signUpEmail() rather than hand-rolling
// the admin_accounts password row directly, so the stored hash/account
// shape is guaranteed to match exactly what auth.api.signInEmail's own
// verify() later expects.
//
// Usage: node scripts/create-admin.mjs <email> <password> "<Full Name>"
// Run from apps/admin, with .env.local already in place.
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const { auth } = await import("../src/lib/betterAuth.js");

const [, , email, password, name] = process.argv;

if (!email || !password || !name) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> "<Full Name>"');
  process.exit(1);
}

try {
  const result = await auth.api.signUpEmail({
    body: { email: email.toLowerCase().trim(), password, name }
  });
  console.log("Admin account created:", { id: result.user.id, email: result.user.email, name: result.user.name });
  process.exit(0);
} catch (error) {
  console.error("Failed to create admin account:", error.message || error);
  process.exit(1);
}
