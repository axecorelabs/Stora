# Legal documents — drafts

Draft legal documents for Stora/Biterave, operated by **Axecore Labs Limited** (RC 9466911). These were drafted against the actual codebase (data flows, payment/commission mechanics, cookies, third-party integrations, KYC process) rather than generic templates — see each document's footer for what it's grounded in.

| Document | Covers |
|---|---|
| [Terms of Service](./TERMS_OF_SERVICE.md) | Customer-facing master agreement: eligibility, age/alcohol policy, orders, reviews, acceptable use, IP, liability, governing law |
| [Privacy Policy](./PRIVACY_POLICY.md) | Data collected, cookies, all third-party processors (Paystack, QoreID, AI search, Supabase, Redis, R2, Vercel, Google, email), retention/deletion, NDPA rights |
| [Vendor Agreement](./VENDOR_AGREEMENT.md) | Vendor onboarding, commission & payouts, fulfillment/delivery responsibility, food-safety representations, suspension/termination |
| [Vendor KYC & Verification Policy](./VENDOR_KYC_POLICY.md) | What's collected/sent to QoreID (NIN + selfie), what's retained (masked data only), consent |
| [Refund, Cancellation & Returns Policy](./REFUND_POLICY.md) | How refunds/cancellations actually work today (manual, support-mediated), non-refundable commission |
| [Delivery Policy](./DELIVERY_POLICY.md) | Vendor-fulfilled delivery model, no Stora fleet, fee-collection models, address/risk responsibility |

## Still open — needs a decision before publishing

1. **Commission-clawback clause** (Vendor Agreement §3): reserves Stora's right to deduct a refunded, already-settled amount from a future payout. This is standard for marketplace agreements but isn't something the code currently automates — flag to ops/finance so it's understood as a contractual right, not a live feature.
2. **Legal review**: none of these have been reviewed by a licensed Nigerian solicitor yet. Recommend that pass before publishing, especially the liability/indemnification language and the alcohol-sales clause (which is a policy backstop — the product itself has no age-verification gate at checkout yet, so flag that to engineering as a follow-up).
3. **Off-platform "contact-only" orders** (ToS, Refund Policy §4a, Vendor Agreement, Delivery Policy §7): orders placed with Vendors who haven't set up Paystack are handed off to WhatsApp/social for payment and fulfillment, entirely outside Stora's systems. The docs now disclose this and disclaim Stora's involvement — worth confirming this is the position you actually want (vs., say, requiring Paystack setup before a store can go live) before publishing.
4. **Vendor "partner" contracts** (Vendor Agreement §3): a subset of Vendors may have negotiated commission rates outside the standard rate. If this is a meaningfully different commercial relationship, it may warrant its own short Partner Addendum rather than a single sentence here — worth a decision on how formal that needs to be.

## Resolved since first draft

- **Currency display mismatch**: fixed at the source rather than just disclosed around. The USD/EUR/GBP storefront display-currency option has been removed from the vendor dashboard entirely, and the API now forces `currency: 'NGN'` server-side on every save — a non-NGN value can no longer be set even via a direct API call. All storefront price displays are hardcoded to ₦. Confirmed zero existing stores had a non-NGN value saved, so no backfill was needed. The ToS/Vendor Agreement clauses about non-NGN display can be removed as dead language next time these are edited, or left as a harmless "belt and suspenders" disclosure.
- **AI search provider name**: now names Google's Gemini model (via OpenRouter) explicitly, in both the Privacy Policy and Terms of Service.
- **Perishable-food cancellation window**: confirmed as an intended business policy. The document now says so plainly, and notes it's applied manually by support today rather than enforced by any code path — worth a future engineering ticket if you want checkout itself to block a cancellation once a Vendor has started preparing an order.
- **Publish dates**: all six documents now carry a real "Last updated: September 4, 2026" date.
- **Pages wired up**: `/terms`, `/privacy`, `/refund-policy`, and `/delivery-policy` now exist as real pages on the store app; `/terms`, `/privacy`, `/vendor-agreement`, and `/vendor-kyc-policy` exist on the dashboard app. See "Wiring into the app" below for exactly what was built.
- **Acceptance logging**: a `legal_acceptances` table now records every time a customer or vendor accepts these documents (signup, and the vendor KYC consent step) — see below.
- **Google OAuth sign-up bypassing the acceptance checkbox**: closed. The "Continue with Google" button on both signup forms is now disabled (with a tooltip) until the Terms/Privacy checkbox is checked, and — since a *sign-in* attempt by someone with no existing account is functionally a signup with no checkbox at all — a one-time "review and accept" interstitial now catches every account Google creates fresh, in either app, regardless of which button was clicked. See "Wiring into the app" below for exactly how.

## Not drafted here (not documents, but action items)

- **CAC registration** — already done (RC 9466911).
- **Trademark filing** for "Stora"/"Biterave" — an application you'd file with the Trademarks Registry, not a document to draft.
- **NDPA compliance filing/DPO designation**, if your data volume requires it under NDPA thresholds — worth checking with counsel.

## Wiring into the app

**Live pages** (hand-authored JSX, not a copy of these `.md` files at runtime — see "A note on keeping these in sync" below):
- Store app (`apps/store`): `/terms`, `/privacy`, `/refund-policy`, `/delivery-policy`.
- Dashboard app (`apps/dashboard`): `/terms`, `/privacy`, `/vendor-agreement`, `/vendor-kyc-policy`.
- The dashboard's sign-up checkbox (`SignUp.js`) previously had no links at all (plain text, unlike the store app's version) — now links to the dashboard's own `/terms`/`/privacy`. The vendor KYC consent checkbox (`VerificationForm.js`) now links to `/vendor-kyc-policy` too.

**Google OAuth gap, fully closed** (both apps):
- **Button gating**: on both signup forms, "Continue with Google" is dimmed and blocked (a click does nothing) until the Terms/Privacy checkbox is checked, with a native tooltip on hover explaining why. Sign-*in* forms are untouched — there's no checkbox there to gate on, and existing users linking Google to an already-consented account shouldn't be re-prompted.
- **Review-and-accept interstitial**: Better Auth has a first-class `newUserCallbackURL` option that fires only when a Google login actually creates a brand-new account (not when it links to an existing one) — set in both `google/start/route.js` files, pointed at a new `/auth/review-and-accept` page in each app. This is what catches "Sign in with Google" by someone who doesn't have an account yet, which is functionally a signup with no checkbox at all.
- **Fail-safe enforcement, not just a redirect on the way in**: a new `legal_review_pending_at` column (migration `20260909000000_legal_review_pending.sql`, applied) is set to `NOW()` by a `databaseHooks.user.create.after` hook on **every** new account, any creation path — a deliberately paranoid default. Email/password signup and the review-and-accept page are the only two places that clear it, right after actually recording consent. A gate mounted on every page (`LegalReviewGate.js` on the store app; the existing `DashboardLayout.js` onboarding-gate pattern, extended, on the dashboard) redirects anyone with the flag still set back to the review page — covering a closed tab, a bookmark, or anything else that could otherwise leave an account permanently unreviewed. If a future signup path is ever added and nobody remembers to wire consent-clearing into it, it fails *closed* (user stays gated) rather than silently exempt, which is what actually happened with Google before this.
- Live-tested end-to-end with a disposable test account: registered normally (confirmed the flag was set by the hook, then correctly cleared), then manually re-flagged (simulating what a fresh Google signup looks like) and called the new `/api/auth/legal/accept` route directly with a real session cookie — confirmed it logged both documents under a distinct `oauth_first_login` context and cleared the flag. Then deleted.

**Acceptance logging** — a new `legal_acceptances` table (migration `20260908000000_legal_acceptances.sql`, applied) records every acceptance: `actor_type` (`customer`/`vendor_user`), `actor_id`, `document`, `document_version` (the page's own "Last updated" date), `context` (`signup`/`kyc_verification`), IP address, user agent, and timestamp. Wired into:
- Customer signup (`apps/store/.../auth/customer/register/route.js`) — logs `terms_of_service` + `privacy_policy`.
- Vendor signup (`apps/dashboard/.../auth/signup/route.js`) — logs `terms_of_service` + `privacy_policy`. This route previously had **no server-side check at all** for the terms checkbox (unlike the store app's equivalent, which already rejected a request with `agreeToTerms` missing) — a request that skipped the client-side check could create a vendor account with nothing recorded. Both the missing validation and the missing log are now fixed.
- Vendor KYC verification (`apps/dashboard/.../stores/verification/route.js`) — logs `vendor_kyc_policy`, alongside the pre-existing `vendor_verifications.consent_given_at` column (kept as-is; the new table is a second, cross-document view of the same event, not a replacement).
- All three were live-tested end-to-end with disposable `zzz-playwright-test+...@example.com` accounts (created, confirmed a row landed in `legal_acceptances` with the right actor/document/IP, then fully deleted) rather than just reviewed by reading the code.

**Known gap, not yet fixed**: Google OAuth sign-up (both apps) bypasses the acceptance checkbox and therefore logs nothing — see item 5 above. Fixing this is a product decision (what the interstitial looks like, when it interrupts a returning user), not something folded into this pass.

**A note on keeping these in sync**: the live pages are hand-written JSX (no markdown renderer was added — these are the only 8 documents that need one, so a new dependency for it wasn't worth it), not generated from these `.md` files. Treat the `.md` files here as the reviewable draft/reference copy, and the actual page files (`apps/store/src/app/{terms,privacy,refund-policy,delivery-policy}/page.js`, `apps/dashboard/src/app/{terms,privacy,vendor-agreement,vendor-kyc-policy}/page.js`) as what's actually live. An edit to one won't automatically appear in the other — update both, and bump `LEGAL_DOCUMENT_VERSIONS` in `apps/store/src/lib/legalAcceptance.js` / `apps/dashboard/src/lib/legalAcceptance.js` (and the page's own "Last updated" date) whenever a document changes materially.
