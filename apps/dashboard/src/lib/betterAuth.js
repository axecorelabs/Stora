import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { after } from "next/server";
import { redis } from "./redis";
import { sendVerificationEmail, sendPasswordResetEmail, sendLoginAlertEmail } from "./email";
import { parseUserAgent } from "./email/utils/userAgent";

// Same bcrypt-12 hashing this app has always used (apps/dashboard/src/lib/
// auth.js's own hashPassword/verifyPassword) -- overriding Better Auth's
// default (scrypt) with it means every existing users.password_hash value
// keeps working once backfilled into dashboard_better_auth_accounts, with
// no forced password reset for anyone.
async function hash(password) {
  return bcrypt.hash(password, 12);
}
async function verify({ password, hash: hashedPassword }) {
  return bcrypt.compare(password, hashedPassword);
}

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

// Every new vendor account gets the same 14-day free trial, regardless of
// whether they signed up with a password or Google -- previously
// duplicated in verify-email/route.js (password path) and
// google/callback/route.js (createUserFromGoogle), with an explicit
// comment on the Google copy that it "must not skip it". A single
// database hook now covers both paths at their one common point (a new
// row actually landing in `users`) instead of two copies that could drift.
async function createTrialSubscription(userId) {
  const now = new Date();
  const trialEndDate = new Date(now);
  trialEndDate.setDate(trialEndDate.getDate() + 14);

  const { rows } = await pool.query(
    `INSERT INTO subscriptions (
      id, user_id, plan_type, plan_name, status, billing_cycle, price, currency,
      start_date, end_date, features, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, 'free', 'Trial Plan - Full Access', 'trial', 'trial', 0, 'USD',
      $2, $3, $4, $2, $2
    ) RETURNING id`,
    [userId, now.toISOString(), trialEndDate.toISOString(), JSON.stringify({
      realTimeStockTracking: true,
      advancedReporting: true,
      freeWebsite: true,
      whatsappCheckout: true,
      aiReports: true,
      unlimitedUsers: true,
      stockAlerts: true,
      purchaseOrders: true,
      multiLocation: true,
      cloudBackup: true,
      prioritySupport: true
    })]
  );

  await pool.query(
    `UPDATE users SET is_subscribed = true, date_subscribed = $2, current_subscription_id = $3, updated_at = $2 WHERE id = $1`,
    [userId, now.toISOString(), rows[0].id]
  );
}

// Fires for every new session row -- password sign-in, Google sign-in, and
// the auto-login right after email verification all create one the same
// way, so one hook covers every login path instead of duplicating the send
// across signin/route.js and the Google callback. Deferred via after() (the
// same pattern every other transactional email in this app already uses)
// so a slow SMTP send never adds latency to the sign-in response itself.
async function sendLoginAlert(session) {
  try {
    const { rows } = await pool.query("SELECT email, first_name FROM users WHERE id = $1", [session.userId]);
    const user = rows[0];
    if (!user) return;

    const { browser, os } = parseUserAgent(session.userAgent);
    await sendLoginAlertEmail(user.email, user.first_name || "there", {
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
    user: {
      create: {
        after: async (user) => {
          try {
            await createTrialSubscription(user.id);
          } catch (error) {
            console.error('Failed to create trial subscription for new user:', error);
          }
        }
      }
    },
    session: {
      create: {
        after: async (session) => {
          after(() => sendLoginAlert(session));
        }
      }
    }
  },

  advanced: {
    database: { generateId: false }
  },

  // Maps directly onto the existing users table -- no new user table, no
  // data migration. full_name is a writable column kept in sync from
  // first_name/last_name by a trigger (see migration
  // 20260827000003_better_auth_dashboard_scaffolding.sql).
  user: {
    modelName: "users",
    fields: {
      name: "full_name",
      email: "email",
      emailVerified: "is_email_verified",
      image: "avatar",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  // Maps onto the existing sessions table. storeSessionInDatabase is
  // required alongside secondaryStorage below -- otherwise Better Auth
  // keeps sessions in Redis only, and this app's own hourly pg_cron
  // cleanup job (which already targets both sessions and
  // customer_sessions) would see nothing.
  session: {
    modelName: "sessions",
    storeSessionInDatabase: true,
    fields: {
      token: "session_id",
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  // New table (this migration) -- Better Auth expects credential
  // passwords and OAuth-linked accounts here, one row per auth method per
  // user, not columns/a google_id on the user row itself.
  account: {
    modelName: "dashboard_better_auth_accounts",
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
      // Matches the existing google/callback route's own auto-link
      // behavior -- Google is the only trusted provider here since it's
      // the only one whose email-verified claim this app already relies
      // on.
      trustedProviders: ["google"],
      // Without this, Better Auth ALSO requires the existing local users
      // row to already have is_email_verified=true before letting a
      // trusted provider auto-link (confirmed live on the store app: a
      // real customer with is_verified=true still got "account not
      // linked" on a fresh Google sign-in). Google's own email_verified
      // claim is a stronger proof of ownership than our own
      // click-a-link verification, so it should be sufficient on its own
      // -- this was always the intent of listing google as a trusted
      // provider above, not an additional gate on top of it.
      requireLocalEmailVerified: false
    }
  },

  // New table (this migration) -- backs the emailOTP plugin's 6-digit
  // codes plus Better Auth's own password-reset token flow.
  // storeInDatabase is required alongside secondaryStorage, same reason
  // as session.storeSessionInDatabase above (confirmed on the store app:
  // without it, values only ever land in Redis).
  verification: {
    modelName: "dashboard_better_auth_verifications",
    storeInDatabase: true,
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },

  // Upstash Redis, same physical client/namespace this app's own session
  // cache already used (apps/dashboard/src/lib/redis.js, 'dashboard:'
  // prefix) -- Better Auth's secondary-storage interface is a plain
  // get/set/delete/getAndDelete/increment shape, which @upstash/redis's
  // client already satisfies almost directly.
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
    // Matches the existing reset-password/route.js exactly: an
    // unauthenticated reset kills every session for the account.
    revokeSessionsOnPasswordReset: true,
    // Matches the existing forgot-password/route.js exactly: a raw token
    // in a reset link (not an OTP code) -- Better Auth's own core reset
    // flow, deliberately not the emailOTP plugin's 'forget-password' OTP
    // type, since the existing email is a clickable link, not a 6-digit
    // code, and shouldn't change.
    resetPasswordTokenExpiresIn: 15 * 60,
    sendResetPassword: async ({ user, token }) => {
      // getPasswordResetTemplate builds the reset URL itself from the raw
      // token (apps/dashboard/src/lib/email/templates/passwordReset.js) --
      // unlike the store app's version, this one doesn't need a URL built
      // here, just the token passed straight through.
      await sendPasswordResetEmail(user.email, token, user.name);
    }
  },

  // Core-level triggers for *when* a verification email goes out --
  // separate from the emailOTP plugin below, which only controls *how*
  // (an OTP code vs. Better Auth's default link) once triggered.
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    // Matches the existing verify-email/route.js: verifying the code logs
    // the vendor straight in.
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
      // Matches the existing signup/route.js exactly: a 6-digit code,
      // 15-minute expiry (this app's own verification code lives longer
      // than the store app's 10-minute one).
      otpLength: 6,
      expiresIn: 15 * 60,
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") return;
        // firstName isn't part of the OTP callback's payload -- a direct
        // query keeps this module independent of auth.js (which is being
        // rewritten into a thin wrapper *around* this file, so this file
        // can't import back from it without a cycle).
        const { rows } = await pool.query("SELECT first_name FROM users WHERE email = $1", [email]);
        // Note the dashboard email helper's arg order: (email, code,
        // firstName) -- different from the store app's
        // (email, firstName, code).
        await sendVerificationEmail(email, otp, rows[0]?.first_name || "there");
      }
    })
  ]
});
