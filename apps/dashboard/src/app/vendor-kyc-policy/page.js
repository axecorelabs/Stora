import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Vendor KYC Policy - Stora",
  description: "What happens when you verify your identity as a Stora Vendor."
};

export default function VendorKycPolicyPage() {
  return (
    <LegalDocument title="Vendor KYC & Verification Policy" lastUpdated="September 4, 2026">
      <p>
        This policy explains what happens when a Vendor completes identity verification on Stora, operated by{" "}
        <strong>Axecore Labs Limited</strong> (RC 9466911). It supplements our{" "}
        <Link href="/vendor-agreement">Vendor Agreement</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. Why we verify Vendors</h2>
      <p>
        Verification lets us confirm that a store is run by a real, identifiable person, and lets us show a &quot;Verified by
        Stora&quot; badge to Customers as a trust signal. Verification is presented with an explicit consent step before any data
        is submitted.
      </p>

      <h2>2. What we collect and send</h2>
      <p>To verify your identity, you submit:</p>
      <ul>
        <li>Your <strong>National Identification Number (NIN)</strong>;</li>
        <li>A <strong>live selfie photo</strong>, taken at the time of verification (not uploaded from your gallery).</li>
      </ul>
      <p>
        This information is sent to our verification provider, <strong>QoreID</strong>, which performs two checks: (1) confirms
        your name matches the name on record for that NIN, and (2) matches your live selfie against the photo associated with
        your NIN.
      </p>

      <h2>3. What we retain — and what we don&apos;t</h2>
      <p><strong>We do not store your full NIN or your selfie image after verification.</strong> Our systems retain only:</p>
      <ul>
        <li>The <strong>last 4 digits</strong> of your NIN (for reference/support purposes);</li>
        <li>Whether your name matched (yes/no);</li>
        <li>A face-match confidence score;</li>
        <li>A reference ID from QoreID for that verification attempt.</li>
      </ul>
      <p>We also do not log the raw contents of QoreID&apos;s response in our systems, specifically to avoid incidentally storing sensitive data in logs.</p>

      <h2>4. Consent</h2>
      <p>
        We only submit your NIN and selfie to QoreID after you actively check a consent box confirming you understand and agree
        to this data sharing. You may decline verification, though certain features (the &quot;Verified&quot; badge, and
        potentially payout eligibility) may depend on completing it.
      </p>

      <h2>5. QoreID&apos;s role</h2>
      <p>
        QoreID acts as our data processor for this specific check. QoreID&apos;s own handling of the data you submit to them is
        governed by QoreID&apos;s privacy policy, which we encourage you to review before proceeding.
      </p>

      <h2>6. Failed verification</h2>
      <p>If your NIN or selfie doesn&apos;t match, verification fails and you may be prompted to retry. Repeated mismatches may require you to contact support for manual review.</p>

      <h2>7. Your rights</h2>
      <p>
        You may ask us what verification data we hold about you, or request it be deleted (noting that the last-4-digit reference
        and match result may need to be retained for a period for fraud-prevention/audit purposes). Contact{" "}
        <a href="mailto:support@app.stora.com.ng">support@app.stora.com.ng</a>.
      </p>
    </LegalDocument>
  );
}
