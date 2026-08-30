import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { after } from "next/server";
import { redis } from "./redis";
import { sendVerificationEmail, sendPasswordResetEmail, sendLoginAlertEmail } from "./email";
import { parseUserAgent } from "./userAgent";

// Same bcrypt-12 hashing this app has always used (apps/store/src/lib/
// supabaseAuth.js's own hashPassword/verifyPassword) -- overriding Better
// Auth's default (scrypt) with it means every existing customers.password_hash
// value keeps working once backfilled into better_auth_accounts, with no
// forced password reset for anyone.
async function hash(password) {
  return bcrypt.hash(password, 12);
}
async function verify({ password, hash: hashedPassword }) {
  return bcrypt.compare(password, hashedPassword);
}

// Raw node-postgres pool over the same direct Postgres connection already
// used elsewhere (SUPABASE_DB_URL) -- Better Auth's Kysely adapter accepts
// a pg.Pool directly and auto-detects the Postgres dialect from it.
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

// Same apex domain apps/store/src/proxy.js and lib/storeUrl.js use. Only
// scope cookies to the whole apex family when NEXT_PUBLIC_APP_URL actually
// points at that apex -- in local dev it's http://localhost:3001, and a
// browser silently drops any Set-Cookie whose Domain isn't the current host
// or a parent of it, so forcing `.stora.com.ng` there would break every
// local sign-in rather than just Google's cross-subdomain case.
const APEX_DOMAIN = process.env.NEXT_PUBLIC_STORE_APEX_DOMAIN || 'stora.com.ng';
const isApexDeployment = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || '').hostname.endsWith(APEX_DOMAIN);
  } catch {
    return false;
  }
})();

// Fires for every new session row -- password sign-in, Google sign-in, and
// the auto-login right after email verification all create one the same
// way, so one hook covers every login path instead of duplicating the send
// across login/route.js and the Google callback. Deferred via after() (the
// same pattern every other transactional email in this app already uses)
// so a slow SMTP send never adds latency to the sign-in response itself.
async function sendLoginAlert(session) {
  try {
    const { rows } = await pool.query("SELECT email, first_name FROM customers WHERE id = $1", [session.userId]);
    const customer = rows[0];
    if (!customer) return;

    const { browser, os } = parseUserAgent(session.userAgent);
    await sendLoginAlertEmail(customer.email, customer.first_name || "there", {
      browser,
      os,
      ipAddress: session.ipAddress,
      time: new Date()
    });
  } catch (error) {
    console.error('Failed to send login alert email:', error);
  }
}

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          after(() => sendLoginAlert(session));
        }
      }
    }
  },

  // Let Postgres generate ids (every table here already has
  // `DEFAULT gen_random_uuid()`) instead of Better Auth's own JS-side id
  // generator, whose default format isn't a UUID -- this matters because
  // customers.id/every FK in this schema is uuid-typed.
  advanced: {
    database: { generateId: false },
    // Google's redirect_uri is pinned to baseURL (see socialProviders.google
    // below and api/auth/callback/google/route.js), so every Google sign-in
    // completes on the apex host regardless of which vendor subdomain the
    // customer started from. Without this, the session cookie Better Auth
    // sets at that step is host-only to the apex and invisible on the
    // vendor's own subdomain -- the customer ends up looking signed-out on
    // their own store right after "successfully" signing in. Scoping the
    // cookie to the whole apex family (`.stora.com.ng`) instead makes it
    // valid on every vendor subdomain too. Matches apps/store/src/proxy.js
    // and lib/storeUrl.js's own APEX_DOMAIN.
    crossSubDomainCookies: {
      enabled: isApexDeployment,
      domain: `.${APEX_DOMAIN}`
    }
  },

  // Maps directly onto the existing customers table -- no new user table,
  // no data migration. full_name is a generated column (see migration
  // 20260827000000_better_auth_store_scaffolding.sql) kept in sync from
  // first_name/last_name automatically.
  user: {
    modelName: "customers",
    fields: {
      name: "full_name",
      email: "email",
      emailVerified: "is_verified",
      image: "avatar",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    // Not part of Better Auth's own user schema -- the existing
    // register/route.js accepts an optional phone number at signup, and
    // this lets signUpEmail's body pass it straight through to the
    // customers.phone column (same name, no mapping needed).
    additionalFields: {
      phone: { type: "string", required: false }
    }
  },

  // Maps onto the existing customer_sessions table. storeSessionInDatabase
  // is required alongside secondaryStorage below -- otherwise Better Auth
  // keeps sessions in Redis only, and the existing hourly pg_cron cleanup
  // job (and anything else that reads this table directly) would see
  // nothing.
  session: {
    modelName: "customer_sessions",
    storeSessionInDatabase: true,
    fields: {
      token: "session_id",
      userId: "customer_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  // New table (this migration), not the customers table -- Better Auth
  // expects credential passwords and OAuth-linked accounts to live here,
  // one row per auth method per user, not columns on the user row itself.
  account: {
    modelName: "better_auth_accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    accountLinking: {
      enabled: true,
      // Matches the existing google/callback route's own "Google has
      // already proven ownership of this email" auto-link behavior --
      // Google is the only trusted provider here since it's the only one
      // whose email-verified claim this app already relies on.
      trustedProviders: ["google"],
      // Without this, Better Auth ALSO requires the existing local
      // customers row to already have is_verified=true before letting a
      // trusted provider auto-link (confirmed live: a real customer with
      // is_verified=true still got "account not linked" on a fresh Google
      // sign-in). Google's own email_verified claim is a stronger proof of
      // ownership than our own click-a-link verification, so it should be
      // sufficient on its own -- this was always the intent of listing
      // google as a trusted provider above, not an additional gate on top
      // of it.
      requireLocalEmailVerified: false
    }
  },

  // New table (this migration) -- backs the emailOTP plugin's 6-digit
  // codes plus Better Auth's own password-reset token flow. Same
  // storeInDatabase requirement as session.storeSessionInDatabase above:
  // with secondaryStorage configured, Better Auth writes verification
  // values to Redis only by default (confirmed live -- without this flag,
  // an OTP was emailed successfully but no row ever appeared here).
  verification: {
    modelName: "better_auth_verifications",
    storeInDatabase: true,
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  // Upstash Redis, same physical client/namespace this app's own session
  // cache already used (apps/store/src/lib/redis.js) -- Better Auth's
  // secondary-storage interface is a plain get/set/delete/getAndDelete/
  // increment shape, which @upstash/redis's client already satisfies
  // almost directly.
  secondaryStorage: {
    get: async (key) => redis.get(key),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, { ex: ttl });
      else await redis.set(key, value);
    },
    delete: async (key) => { await redis.del(key); },
    getAndDelete: async (key) => {
      const value = await redis.get(key);
      await redis.del(key);
      return value;
    },
    increment: async (key, ttl) => {
      const value = await redis.incr(key);
      if (ttl) await redis.expire(key, ttl);
      return value;
    }
  },

  emailAndPassword: {
    enabled: true,
    password: { hash, verify },
    requireEmailVerification: true,
    // Matches the existing reset-password/route.js exactly: an unauthenticated
    // reset kills every session for the account, including whatever a
    // possible attacker was using.
    revokeSessionsOnPasswordReset: true,
    // Matches the existing forgot-password/route.js exactly: a raw token
    // in a reset link (not an OTP code) -- this is Better Auth's own core
    // reset flow, deliberately not the emailOTP plugin's 'forget-password'
    // OTP type, since the existing customer-facing email is a clickable
    // link, not a 6-digit code, and shouldn't change.
    resetPasswordTokenExpiresIn: 15 * 60,
    sendResetPassword: async ({ user, token }) => {
      // Built manually (not Better Auth's own default `url`) to keep the
      // exact link shape the existing /reset-password page already reads
      // (?token=<raw token>) -- the frontend page and its POST back to
      // this same API route don't change at all. The token itself is the
      // same real one Better Auth will check on submission either way.
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl, 15);
    }
  },

  // Core-level triggers for *when* a verification email goes out --
  // separate from the emailOTP plugin below, which only controls *how*
  // (an OTP code vs. Better Auth's default link) once triggered. Both
  // matter: sendOnSignUp matches the existing register/route.js (mails a
  // code right after account creation); sendOnSignIn matches the existing
  // login/route.js's "unverified? mail a fresh code and 403" behavior.
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    // Matches the existing verify-email/route.js: verifying the code logs
    // the customer straight in, rather than requiring a separate login
    // right after.
    autoSignInAfterVerification: true
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  },

  plugins: [
    emailOTP({
      // Matches the existing register/route.js exactly: a 6-digit code,
      // 10-minute expiry. overrideDefaultEmailVerification is what
      // actually makes emailVerification.sendOnSignUp/sendOnSignIn above
      // send an OTP instead of Better Auth's default verification link --
      // sendVerificationOnSignUp is deliberately NOT set here, since the
      // plugin's own send-on-signup hook only fires when
      // overrideDefaultEmailVerification is false (they're mutually
      // exclusive paths to the same behavior; confirmed by reading the
      // plugin's own source after sendVerificationOnSignUp alone silently
      // sent nothing).
      otpLength: 6,
      expiresIn: 10 * 60,
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") return;
        // firstName isn't part of the OTP callback's payload -- a direct
        // query keeps this module independent of supabaseAuth.js (which
        // is being rewritten into a thin wrapper *around* this file, so
        // this file can't import back from it without a cycle).
        const { rows } = await pool.query("SELECT first_name FROM customers WHERE email = $1", [email]);
        await sendVerificationEmail(email, rows[0]?.first_name || "there", otp);
      }
    })
  ]
});
