import { betterAuth } from "better-auth";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Same bcrypt-12 hashing apps/dashboard uses -- no particular need to
// match it here (there's no legacy password_hash column to stay
// compatible with, unlike that app's own retrofit), but no reason to
// pick anything different either.
async function hash(password) {
  return bcrypt.hash(password, 12);
}
async function verify({ password, hash: hashedPassword }) {
  return bcrypt.compare(password, hashedPassword);
}

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

// Deliberately a fraction of apps/dashboard's own betterAuth.js -- almost
// everything there (trial-subscription hooks, Google OAuth, login-alert
// emails, email-OTP signup, Redis secondary storage) is vendor-signup
// business logic with no equivalent here. Staff accounts are always
// pre-provisioned (by another admin, or the one-time bootstrap script --
// see scripts/create-admin.mjs), never self-signed-up, so there's no
// signup/verification flow to wire up at all. Plain Postgres-backed
// sessions (no Redis secondaryStorage) are plenty for this app's traffic.
export const auth = betterAuth({
  database: pool,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,

  advanced: {
    database: { generateId: false }
  },

  user: {
    modelName: "admin_users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  session: {
    modelName: "admin_sessions",
    storeSessionInDatabase: true,
    fields: {
      token: "token",
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  account: {
    modelName: "admin_accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  emailAndPassword: {
    enabled: true,
    password: { hash, verify },
    requireEmailVerification: false
  }
});
