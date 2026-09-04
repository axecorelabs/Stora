import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Terms of Service - Stora",
  description: "The terms governing your use of Stora and Biterave."
};

// Same content as apps/store/src/app/terms/page.js -- Vendors are subject
// to the same platform-wide Terms as Customers, on top of the
// Vendor-specific obligations in the Vendor Agreement. Kept as a second
// copy (not a shared package) since this is a separate Next app/deployment
// with no shared page-rendering layer between them.
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://stora.com.ng";

export default function TermsOfServicePage() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated="September 4, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) are a legal agreement between you and <strong>Axecore Labs Limited</strong> (RC 9466911),
        a company registered in Nigeria, operating the online marketplace platforms <strong>Stora</strong> (stora.com.ng) and{" "}
        <strong>Biterave</strong> (biterave.stora.com.ng), together referred to as &quot;Stora,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our.&quot;
        Biterave is a food-and-grocery section of the same Stora platform, not a separate legal entity or service.
      </p>
      <p>
        By creating an account, browsing, or placing an order on Stora or Biterave, you agree to these Terms. If you do not agree,
        do not use the platform. If you&apos;re creating a store to sell on Stora, our <Link href="/vendor-agreement">Vendor Agreement</Link>{" "}
        also applies to you.
      </p>

      <h2>1. What Stora is</h2>
      <p>
        Stora is a <strong>marketplace platform</strong> that lets independent, third-party vendors (&quot;Vendors&quot;) list and sell
        physical goods, groceries, and food directly to customers (&quot;you,&quot; &quot;Customer&quot;). <strong>Stora is not the seller,
        manufacturer, or preparer of any product listed by a Vendor.</strong> Each Vendor is solely responsible for the accuracy of
        their listings, the quality, safety, and legality of what they sell, and fulfilling your order. Stora provides the platform,
        payment processing, and order infrastructure connecting you to Vendors.
      </p>

      <h2>2. Eligibility and your account</h2>
      <ul>
        <li>You must be at least <strong>18 years old</strong> to create an account or place an order. By registering, you confirm you meet this requirement.</li>
        <li>You are responsible for keeping your login credentials confidential and for all activity under your account.</li>
        <li>You must provide accurate registration and delivery information. Inaccurate delivery details are your responsibility if they cause a failed or misdirected delivery.</li>
        <li>We may suspend or deactivate accounts that violate these Terms, are used fraudulently, or where required by law.</li>
      </ul>

      <h3>Age-restricted items (alcohol)</h3>
      <p>
        Some Vendors may list alcoholic beverages. <strong>You must be at least 18 years old to purchase alcoholic beverages on Stora
        or Biterave</strong>, and by placing such an order you represent that you meet this requirement. Vendors listing alcoholic
        beverages represent to us that they hold any licenses or permits required to sell such items in their state, and are
        responsible for confirming the recipient&apos;s age at the point of delivery.
      </p>

      <h2>3. Orders and payment</h2>
      <ul>
        <li>Prices, availability, and product descriptions are set by the Vendor, not Stora.</li>
        <li>Payments are processed through <strong>Paystack</strong>. Stora does not receive or store your full card details.</li>
        <li>Depending on the Vendor&apos;s settings, a platform service fee may be reflected in your order total, or absorbed by the Vendor into their listed prices.</li>
        <li>An order is a contract of sale between you and the Vendor. Stora facilitates the transaction and payment but is not a party to that sale.</li>
        <li><strong>All payments are charged in Nigerian Naira (NGN) through Paystack</strong>, regardless of any other currency symbol shown for reference on a Vendor&apos;s storefront.</li>
      </ul>

      <h2>4. Delivery</h2>
      <p>
        Delivery is <strong>arranged and fulfilled by the Vendor</strong>, not by Stora. Stora does not operate its own delivery
        fleet or riders. See the Customer-facing{" "}
        <a href={`${STORE_URL}/delivery-policy`} target="_blank" rel="noopener noreferrer">Delivery Policy</a> for details.
      </p>

      <h2>5. Cancellations and refunds</h2>
      <p>
        See the Customer-facing{" "}
        <a href={`${STORE_URL}/refund-policy`} target="_blank" rel="noopener noreferrer">Refund, Cancellation &amp; Returns Policy</a>.
        Refund requests are reviewed by our support team in coordination with the Vendor; Stora&apos;s platform service fee is
        non-refundable.
      </p>

      <h2>6. Reviews</h2>
      <ul>
        <li>Reviews are only left by Customers with a delivered order, tying reviews to verified purchases.</li>
        <li>Public reviews display a Customer&apos;s first name and last initial only, never their full name.</li>
        <li>Reviews must be honest. We may remove reviews that are fraudulent, defamatory, or otherwise violate these Terms.</li>
      </ul>

      <h2>7. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the platform for any unlawful purpose, or to list or purchase illegal, stolen, counterfeit, or unsafe goods;</li>
        <li>Post fake, incentivized, or purchased reviews, or otherwise manipulate ratings;</li>
        <li>Attempt to scrape, reverse-engineer, or interfere with the platform&apos;s normal operation;</li>
        <li>Impersonate another person, or misuse another user&apos;s account;</li>
        <li>Harass, threaten, or abuse other users, Vendors, or Stora staff.</li>
      </ul>

      <h2>8. Intellectual property</h2>
      <p>
        &quot;Stora,&quot; &quot;Biterave,&quot; associated logos, and platform content (excluding Vendor-supplied product content)
        are owned by Axecore Labs Limited. Vendors retain ownership of their own store branding, product photos, and descriptions,
        and grant Stora a license to display that content on the platform for the purpose of operating the marketplace.
      </p>

      <h2>9. Third-party services</h2>
      <p>
        Certain features rely on third-party providers, including payment processing (Paystack), identity verification for
        Vendors (QoreID), and AI-assisted search (which sends search text to Google&apos;s Gemini AI model via OpenRouter). Use of
        these features is subject to this document and our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>10. Disclaimers and limitation of liability</h2>
      <ul>
        <li>Stora provides the platform &quot;as is.&quot; We do not guarantee that products listed by Vendors are accurately described, safe, or of merchantable quality — this is the Vendor&apos;s responsibility.</li>
        <li><strong>Food and grocery items are prepared, packed, and handled by the Vendor, not Stora.</strong></li>
        <li>To the maximum extent permitted by Nigerian law, Stora&apos;s aggregate liability to you for any claim is limited to the amount you paid to Stora in connection with the order giving rise to the claim.</li>
      </ul>

      <h2>11. Indemnification</h2>
      <p>You agree to indemnify and hold Stora harmless from claims arising out of your breach of these Terms, misuse of the platform, or violation of applicable law.</p>

      <h2>12. Termination</h2>
      <p>We may suspend or terminate your account for violation of these Terms, suspected fraud, or as required by law.</p>

      <h2>13. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the <strong>Federal Republic of Nigeria</strong>. Any dispute is subject to the
        exclusive jurisdiction of the courts sitting in <strong>Lagos State, Nigeria</strong>.
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>We may update these Terms from time to time. Continued use of the platform after an update constitutes acceptance of the revised Terms.</p>

      <h2>15. Contact</h2>
      <p>Questions about these Terms: <a href="mailto:support@app.stora.com.ng">support@app.stora.com.ng</a></p>
    </LegalDocument>
  );
}
