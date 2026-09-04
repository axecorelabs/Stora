import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Privacy Policy - Stora",
  description: "How Stora collects, uses, and shares your information."
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated="September 4, 2026">
      <p>
        This Privacy Policy explains how <strong>Axecore Labs Limited</strong> (RC 9466911), operating <strong>Stora</strong>{" "}
        (stora.com.ng) and <strong>Biterave</strong> (biterave.stora.com.ng), collects, uses, and shares information when you use
        our platform as a Customer or Vendor. It&apos;s written to match what the platform actually does today, not a generic template.
      </p>
      <p>
        We are the data controller for the personal data described below, in accordance with the Nigeria Data Protection Act 2023 (NDPA).
      </p>

      <h2>1. Information we collect</h2>
      <p><strong>If you&apos;re a Customer:</strong></p>
      <ul>
        <li>Account details: first name, last name, email address, phone number (optional), password (stored hashed, never in plain text).</li>
        <li>Delivery details you enter at checkout: street address, city, state, and any landmark you provide.</li>
        <li>Order history, wishlist items, and any product reviews you write.</li>
        <li>Any free-text notes you add at checkout, such as delivery instructions or product-customization requests — these are shared directly with the Vendor fulfilling your order.</li>
        <li>If you sign in with Google, the basic profile information Google provides (name, email).</li>
        <li>If you complete a promotional product-matching quiz, your answers, used to recommend products and to determine which promotional campaign (if any) is credited for your order.</li>
      </ul>
      <p><strong>If you&apos;re a Vendor:</strong></p>
      <ul>
        <li>Store details: store name, description, phone, email, address, tax rate, and any social/website links you add.</li>
        <li>
          <strong>Identity verification data</strong>: if you complete Vendor verification, we collect your National Identification
          Number (NIN) and a live selfie photo, and send both to our identity-verification provider, <strong>QoreID</strong>, to
          confirm your name matches your NIN and that your selfie matches the photo on record.{" "}
          <strong>We do not store your full NIN or your selfie image</strong> — our systems only retain the last 4 digits of your
          NIN, a match result, and a reference ID from QoreID. This only happens after you&apos;ve given explicit consent on the
          verification form.
        </li>
        <li>Bank account details you provide for payout, used to set up your payment sub-account with Paystack.</li>
      </ul>

      <p><strong>Automatically collected:</strong></p>
      <ul>
        <li>
          <strong>Cookies</strong>: a cookie remembering your delivery-state preference (<code>stora_deliver_state</code>), plus a
          companion flag (<code>stora_deliver_state_is_guess</code>) marking whether that preference was auto-guessed from your IP
          address or one you confirmed yourself; your login session cookie, which keeps you signed in; and, if you complete a
          promotional product quiz, an attribution cookie (<code>stora_campaign_attribution</code>) recording which campaign
          referred your order — this is used for our own promotion tracking and to determine vendor commission arrangements, not
          for advertising or cross-site tracking.
        </li>
        <li>
          We do <strong>not</strong> use Google Analytics, Meta/Facebook Pixel, or similar advertising trackers on the
          customer-facing Stora/Biterave storefront. (Our separate Vendor dashboard uses a product-analytics tool, PostHog, to
          understand how Vendors use dashboard features — this does not apply to Customer browsing on the storefront.)
        </li>
        <li>Your IP address may be used briefly (a few seconds) to prevent abuse of page-view counters, and is not retained long-term for tracking purposes.</li>
        <li>We do not use precise/live location (e.g. GPS) — only the state-level delivery preference described above.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To create and manage your account, process orders, and enable payments.</li>
        <li>To show you delivery availability relevant to your state.</li>
        <li>To verify Vendor identity before allowing a store to sell on the platform, and to display a &quot;Verified&quot; badge to Customers where applicable.</li>
        <li>To respond to support requests, send order/transaction emails, and (for Vendors) operational notifications.</li>
        <li>To power AI-assisted search: when you use AI search, the text you type is sent to Google&apos;s Gemini AI model (via the routing service OpenRouter) to interpret your intent and find matching products.</li>
        <li>To detect and prevent fraud, abuse, and unauthorized access (e.g., failed-login tracking).</li>
      </ul>

      <h2>3. Third parties we share data with</h2>
      <p>We use the following providers to operate Stora. Each only receives the data needed for its function:</p>
      <table>
        <thead>
          <tr><th>Provider</th><th>Purpose</th><th>What they receive</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Paystack</strong></td><td>Payment processing, Vendor payouts</td><td>Payment details you enter directly with Paystack; Vendor bank account details for payout setup</td></tr>
          <tr><td><strong>QoreID</strong></td><td>Vendor identity verification</td><td>Vendor&apos;s NIN and selfie photo (submitted only with consent, not stored by us afterward)</td></tr>
          <tr><td><strong>Google (Gemini AI, via OpenRouter)</strong></td><td>AI-assisted product/vendor search</td><td>The text of your search query only — not your name, email, or account details</td></tr>
          <tr><td><strong>Supabase</strong></td><td>Database and account hosting</td><td>All platform data described in this policy, as our hosting provider</td></tr>
          <tr><td><strong>Upstash (Redis)</strong></td><td>Short-term caching (sessions, search cache, abuse prevention)</td><td>Email (for login-attempt tracking), IP address (briefly, for abuse prevention), cached search results</td></tr>
          <tr><td><strong>Cloudflare R2</strong></td><td>Image/file storage</td><td>Product photos, store logos/banners you or Vendors upload</td></tr>
          <tr><td><strong>Vercel</strong></td><td>Hosting and content delivery</td><td>Standard web request data, including an approximate location derived from your IP to guess your delivery state</td></tr>
          <tr><td><strong>Google</strong></td><td>&quot;Sign in with Google&quot;</td><td>Basic profile info, only if you choose this sign-in method</td></tr>
          <tr><td><strong>Email provider (ZeptoMail or Resend)</strong></td><td>Sending transactional emails (order confirmations, verification codes, receipts)</td><td>Your email address and the content of the email</td></tr>
        </tbody>
      </table>
      <p>We do not sell your personal data to third parties, and we do not share it for third-party advertising purposes.</p>
      <p>Some of these providers may process or store data outside Nigeria. Where this happens, we rely on the provider&apos;s own data-protection safeguards and only share what&apos;s necessary for the service to function.</p>
      <p>
        <strong>Off-platform vendor contact.</strong> For orders placed with a Vendor who hasn&apos;t set up payment processing
        through Stora, your order details and contact information may be shared with that Vendor via WhatsApp or another social
        platform they list, so you can complete payment and fulfillment directly with them. Once that hand-off happens, that
        Vendor&apos;s own handling of your information is outside Stora&apos;s systems and this policy.
      </p>
      <p>
        <strong>Internal access.</strong> Stora staff may access your account, order, and store information as needed to provide
        customer support, verify Vendors, investigate disputes or suspected fraud, or enforce our Terms of Service.
      </p>

      <h2>4. Data retention and deletion</h2>
      <p>
        We keep your account data for as long as your account is active. <strong>To request deletion of your account and
        associated personal data, email support@stora.com.ng.</strong> We will process deletion requests within{" "}
        <strong>30 days</strong>, subject to any records we&apos;re legally required to retain (for example, transaction records
        for tax or dispute purposes).
      </p>
      <p>
        Note: as of today, account deletion is a manual, request-based process rather than an automated self-service feature —
        we&apos;re telling you this plainly rather than implying a &quot;delete account&quot; button exists in the app yet.
      </p>

      <h2>5. Your rights</h2>
      <p>Under the NDPA, you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you;</li>
        <li>Request correction of inaccurate data;</li>
        <li>Request deletion of your data (see above);</li>
        <li>Object to certain processing;</li>
        <li>Withdraw consent where processing is based on consent (e.g., Vendor identity verification).</li>
      </ul>
      <p>To exercise any of these rights, contact <a href="mailto:support@stora.com.ng">support@stora.com.ng</a>.</p>

      <h2>6. Children&apos;s privacy</h2>
      <p>Stora is not directed at, and should not be used by, anyone under 18. We do not knowingly collect data from children.</p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures to protect your data, including hashed passwords, encrypted connections, and access
        controls on sensitive verification data. No system is 100% secure, and we encourage you to use a strong, unique password.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>We may update this Privacy Policy from time to time. Material changes will be highlighted where practical.</p>

      <h2>9. Contact</h2>
      <p>Questions about this policy or your data: <a href="mailto:support@stora.com.ng">support@stora.com.ng</a></p>
    </LegalDocument>
  );
}
