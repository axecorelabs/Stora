import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Privacy Policy - Stora",
  description: "How Stora collects, uses, and shares your information."
};

// Same content as apps/store/src/app/privacy/page.js -- one Privacy
// Policy governs data collected on either app. Kept as a second copy for
// the same reason as this app's /terms page.
export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated="September 4, 2026">
      <p>
        This Privacy Policy explains how <strong>Axecore Labs Limited</strong> (RC 9466911), operating <strong>Stora</strong>{" "}
        (stora.com.ng) and <strong>Biterave</strong> (biterave.stora.com.ng), collects, uses, and shares information when you use
        our platform as a Customer or Vendor.
      </p>
      <p>We are the data controller for the personal data described below, in accordance with the Nigeria Data Protection Act 2023 (NDPA).</p>

      <h2>1. Information we collect</h2>
      <p><strong>If you&apos;re a Vendor:</strong></p>
      <ul>
        <li>Store details: store name, description, phone, email, address, tax rate, and any social/website links you add.</li>
        <li>
          <strong>Identity verification data</strong>: if you complete Vendor verification, we collect your National Identification
          Number (NIN) and a live selfie photo, and send both to our identity-verification provider, <strong>QoreID</strong>, to
          confirm your name matches your NIN and that your selfie matches the photo on record.{" "}
          <strong>We do not store your full NIN or your selfie image</strong> — our systems only retain the last 4 digits of your
          NIN, a match result, and a reference ID from QoreID. See our <Link href="/vendor-kyc-policy">Vendor KYC &amp; Verification Policy</Link> for details.
        </li>
        <li>Bank account details you provide for payout, used to set up your payment sub-account with Paystack.</li>
      </ul>
      <p><strong>If you&apos;re a Customer</strong> (browsing or ordering on the Stora storefront):</p>
      <ul>
        <li>Account details: first name, last name, email, phone (optional), password (hashed, never stored in plain text).</li>
        <li>Delivery details entered at checkout, order history, wishlist items, and any product reviews.</li>
      </ul>

      <p><strong>Automatically collected (this dashboard):</strong></p>
      <ul>
        <li>Your login session cookie, which keeps you signed in.</li>
        <li>Product-analytics data via <strong>PostHog</strong>, used to understand how Vendors use dashboard features (not used on the Customer-facing storefront).</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To create and manage your account, store, and orders, and to enable payouts.</li>
        <li>To verify your identity before enabling certain trust signals and payout capabilities.</li>
        <li>To respond to support requests and send operational notifications.</li>
        <li>To detect and prevent fraud, abuse, and unauthorized access.</li>
      </ul>

      <h2>3. Third parties we share data with</h2>
      <table>
        <thead>
          <tr><th>Provider</th><th>Purpose</th><th>What they receive</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Paystack</strong></td><td>Payment processing, Vendor payouts</td><td>Payment details; Vendor bank account details for payout setup</td></tr>
          <tr><td><strong>QoreID</strong></td><td>Vendor identity verification</td><td>Vendor&apos;s NIN and selfie photo (submitted only with consent, not stored by us afterward)</td></tr>
          <tr><td><strong>Supabase</strong></td><td>Database and account hosting</td><td>All platform data described in this policy</td></tr>
          <tr><td><strong>PostHog</strong></td><td>Product analytics (dashboard only)</td><td>Usage events, not linked to Customer data</td></tr>
          <tr><td><strong>Google</strong></td><td>&quot;Sign in with Google&quot;</td><td>Basic profile info, only if you choose this sign-in method</td></tr>
          <tr><td><strong>Email provider (ZeptoMail or Resend)</strong></td><td>Transactional emails</td><td>Your email address and the content of the email</td></tr>
        </tbody>
      </table>
      <p>We do not sell your personal data to third parties, and we do not share it for third-party advertising purposes.</p>
      <p>
        <strong>Internal access.</strong> Stora staff may access your account, order, and store information as needed to provide
        support, verify Vendors, investigate disputes or suspected fraud, or enforce our <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>4. Data retention and deletion</h2>
      <p>
        We keep your account data for as long as your account is active. To request deletion, email{" "}
        <a href="mailto:support@app.stora.com.ng">support@app.stora.com.ng</a>. We will process deletion requests within{" "}
        <strong>30 days</strong>, subject to any records we&apos;re legally required to retain.
      </p>

      <h2>5. Your rights</h2>
      <p>Under the NDPA, you have the right to access, correct, or request deletion of your data, object to certain processing, and withdraw consent where processing is based on consent (e.g., identity verification).</p>
      <p>To exercise any of these rights, contact <a href="mailto:support@app.stora.com.ng">support@app.stora.com.ng</a>.</p>

      <h2>6. Security</h2>
      <p>We use industry-standard measures to protect your data, including hashed passwords, encrypted connections, and access controls on sensitive verification data.</p>

      <h2>7. Changes to this policy</h2>
      <p>We may update this Privacy Policy from time to time. Material changes will be highlighted where practical.</p>

      <h2>8. Contact</h2>
      <p>Questions about this policy or your data: <a href="mailto:support@app.stora.com.ng">support@app.stora.com.ng</a></p>
    </LegalDocument>
  );
}
