# Privacy Policy

**Last updated: September 4, 2026**

This Privacy Policy explains how **Axecore Labs Limited** (RC 9466911), operating **Stora** (stora.com.ng) and **Biterave** (biterave.stora.com.ng), collects, uses, and shares information when you use our platform as a Customer or Vendor. It's written to match what the platform actually does today, not a generic template.

We are the data controller for the personal data described below, in accordance with the Nigeria Data Protection Act 2023 (NDPA).

## 1. Information we collect

**If you're a Customer:**
- Account details: first name, last name, email address, phone number (optional), password (stored hashed, never in plain text).
- Delivery details you enter at checkout: street address, city, state, and any landmark you provide.
- Order history, wishlist items, and any product reviews you write.
- Any free-text notes you add at checkout, such as delivery instructions or product-customization requests — these are shared directly with the Vendor fulfilling your order.
- If you sign in with Google, the basic profile information Google provides (name, email).
- If you complete a promotional product-matching quiz, your answers, used to recommend products and to determine which promotional campaign (if any) is credited for your order.

**If you're a Vendor:**
- Store details: store name, description, phone, email, address, tax rate, and any social/website links you add.
- **Identity verification data**: if you complete Vendor verification, we collect your National Identification Number (NIN) and a live selfie photo, and send both to our identity-verification provider, **QoreID**, to confirm your name matches your NIN and that your selfie matches the photo on record. **We do not store your full NIN or your selfie image** — our systems only retain the last 4 digits of your NIN, a match result, and a reference ID from QoreID. This only happens after you've given explicit consent on the verification form. See our [Vendor KYC & Verification Policy](./VENDOR_KYC_POLICY.md) for details.
- Bank account details you provide for payout, used to set up your payment sub-account with Paystack.

**Automatically collected:**
- **Cookies**: a cookie remembering your delivery-state preference (`stora_deliver_state`), plus a companion flag (`stora_deliver_state_is_guess`) marking whether that preference was auto-guessed from your IP address or one you confirmed yourself; your login session cookie, which keeps you signed in; and, if you complete a promotional product quiz, an attribution cookie (`stora_campaign_attribution`) recording which campaign referred your order — this is used for our own promotion tracking and to determine vendor commission arrangements, not for advertising or cross-site tracking.
- We do **not** use Google Analytics, Meta/Facebook Pixel, or similar advertising trackers on the customer-facing Stora/Biterave storefront. (Our separate Vendor dashboard uses a product-analytics tool, PostHog, to understand how Vendors use dashboard features — this does not apply to Customer browsing on the storefront.)
- Your IP address may be used briefly (a few seconds) to prevent abuse of page-view counters, and is not retained long-term for tracking purposes.
- We do not use precise/live location (e.g. GPS) — only the state-level delivery preference described above.

## 2. How we use your information

- To create and manage your account, process orders, and enable payments.
- To show you delivery availability relevant to your state.
- To verify Vendor identity before allowing a store to sell on the platform, and to display a "Verified" badge to Customers where applicable.
- To respond to support requests, send order/transaction emails, and (for Vendors) operational notifications.
- To power AI-assisted search: when you use AI search, the text you type is sent to Google's Gemini AI model (via the routing service OpenRouter) to interpret your intent and find matching products — see "Third parties" below.
- To detect and prevent fraud, abuse, and unauthorized access (e.g., failed-login tracking).

## 3. Third parties we share data with

We use the following providers to operate Stora. Each only receives the data needed for its function:

| Provider | Purpose | What they receive |
|---|---|---|
| **Paystack** | Payment processing, Vendor payouts | Payment details you enter directly with Paystack; Vendor bank account details for payout setup |
| **QoreID** | Vendor identity verification | Vendor's NIN and selfie photo (submitted only with consent, not stored by us afterward) |
| **Google (Gemini AI, via OpenRouter)** | AI-assisted product/vendor search | The text of your search query only — not your name, email, or account details |
| **Supabase** | Database and account hosting | All platform data described in this policy, as our hosting provider |
| **Upstash (Redis)** | Short-term caching (sessions, search cache, abuse prevention) | Email (for login-attempt tracking), IP address (briefly, for abuse prevention), cached search results |
| **Cloudflare R2** | Image/file storage | Product photos, store logos/banners you or Vendors upload |
| **Vercel** | Hosting and content delivery | Standard web request data, including an approximate location derived from your IP to guess your delivery state |
| **Google** | "Sign in with Google" | Basic profile info, only if you choose this sign-in method |
| **Email provider (ZeptoMail or Resend)** | Sending transactional emails (order confirmations, verification codes, receipts) | Your email address and the content of the email |

We do not sell your personal data to third parties, and we do not share it for third-party advertising purposes.

Some of these providers may process or store data outside Nigeria. Where this happens, we rely on the provider's own data-protection safeguards and only share what's necessary for the service to function.

**Off-platform vendor contact.** For orders placed with a Vendor who hasn't set up payment processing through Stora, your order details and contact information may be shared with that Vendor via WhatsApp or another social platform they list, so you can complete payment and fulfillment directly with them. Once that hand-off happens, that Vendor's own handling of your information is outside Stora's systems and this policy.

**Internal access.** Stora staff may access your account, order, and store information as needed to provide customer support, verify Vendors, investigate disputes or suspected fraud, or enforce our Terms of Service.

## 4. Data retention and deletion

We keep your account data for as long as your account is active. **To request deletion of your account and associated personal data, email support@stora.com.ng.** We will process deletion requests within **30 days**, subject to any records we're legally required to retain (for example, transaction records for tax or dispute purposes).

Note: as of today, account deletion is a manual, request-based process rather than an automated self-service feature — we're telling you this plainly rather than implying a "delete account" button exists in the app yet.

## 5. Your rights

Under the NDPA, you have the right to:
- Access the personal data we hold about you;
- Request correction of inaccurate data;
- Request deletion of your data (see above);
- Object to certain processing;
- Withdraw consent where processing is based on consent (e.g., Vendor identity verification).

To exercise any of these rights, contact **support@stora.com.ng**.

## 6. Children's privacy

Stora is not directed at, and should not be used by, anyone under 18. We do not knowingly collect data from children.

## 7. Security

We use industry-standard measures to protect your data, including hashed passwords, encrypted connections, and access controls on sensitive verification data. No system is 100% secure, and we encourage you to use a strong, unique password.

## 8. Changes to this policy

We may update this Privacy Policy from time to time. Material changes will be highlighted where practical.

## 9. Contact

Questions about this policy or your data: **support@stora.com.ng**

---
*This document was drafted based on the platform's actual data flows as of the date above (see engineering audit: cookies, third-party integrations, and retention practices were verified against the codebase, not assumed). It has not yet been reviewed by a licensed Nigerian solicitor or a data-protection specialist — recommend legal review before publishing.*
