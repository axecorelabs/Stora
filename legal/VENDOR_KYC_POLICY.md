# Vendor KYC & Verification Policy

**Last updated: September 4, 2026**

This policy explains what happens when a Vendor completes identity verification on Stora, operated by **Axecore Labs Limited** (RC 9466911). It supplements our [Vendor Agreement](./VENDOR_AGREEMENT.md) and [Privacy Policy](./PRIVACY_POLICY.md).

## 1. Why we verify Vendors

Verification lets us confirm that a store is run by a real, identifiable person, and lets us show a "Verified by Stora" badge to Customers as a trust signal. Verification is presented with an explicit consent step before any data is submitted.

## 2. What we collect and send

To verify your identity, you submit:
- Your **National Identification Number (NIN)**;
- A **live selfie photo**, taken at the time of verification (not uploaded from your gallery).

This information is sent to our verification provider, **QoreID**, which performs two checks: (1) confirms your name matches the name on record for that NIN, and (2) matches your live selfie against the photo associated with your NIN.

## 3. What we retain — and what we don't

**We do not store your full NIN or your selfie image after verification.** Our systems retain only:
- The **last 4 digits** of your NIN (for reference/support purposes);
- Whether your name matched (yes/no);
- A face-match confidence score;
- A reference ID from QoreID for that verification attempt.

We also do not log the raw contents of QoreID's response in our systems, specifically to avoid incidentally storing sensitive data in logs.

## 4. Consent

We only submit your NIN and selfie to QoreID after you actively check a consent box confirming you understand and agree to this data sharing. You may decline verification, though certain features (the "Verified" badge, and potentially payout eligibility) may depend on completing it.

## 5. QoreID's role

QoreID acts as our data processor for this specific check. QoreID's own handling of the data you submit to them is governed by QoreID's privacy policy, which we encourage you to review before proceeding.

## 6. Failed verification

If your NIN or selfie doesn't match, verification fails and you may be prompted to retry. Repeated mismatches may require you to contact support for manual review.

## 7. Your rights

You may ask us what verification data we hold about you, or request it be deleted (noting that the last-4-digit reference and match result may need to be retained for a period for fraud-prevention/audit purposes). Contact **support@app.stora.com.ng**.

---
*This document was drafted based on the actual QoreID integration (NIN + live selfie, name-match and face-match checks, masked/derived data retention only) as verified in the codebase. It has not yet been reviewed by a licensed Nigerian solicitor — recommend legal review before publishing.*
