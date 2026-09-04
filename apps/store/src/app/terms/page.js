import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Terms of Service - Stora",
  description: "The terms governing your use of Stora and Biterave."
};

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
        do not use the platform.
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
        responsible for confirming the recipient&apos;s age at the point of delivery. Stora does not itself perform digital age
        verification at checkout today; this is a policy requirement placed on both Customers and Vendors, and Stora may introduce
        further verification steps in future.
      </p>

      <h2>3. Orders and payment</h2>
      <ul>
        <li>Prices, availability, and product descriptions are set by the Vendor, not Stora.</li>
        <li>Payments are processed through <strong>Paystack</strong>. Stora does not receive or store your full card details — card entry happens directly within Paystack&apos;s own secure checkout.</li>
        <li>Depending on the Vendor&apos;s settings, a platform service fee may be reflected in your order total, or absorbed by the Vendor into their listed prices. Where charged to you, this is disclosed before you complete checkout.</li>
        <li>Some Vendors offer <strong>pay-on-delivery</strong>, where the delivery fee (not the cost of goods) is collected by the Vendor&apos;s own delivery person at the time of drop-off.</li>
        <li>An order is a contract of sale between you and the Vendor. Stora facilitates the transaction and payment but is not a party to that sale.</li>
        <li><strong>Prices may be displayed in USD, EUR, or GBP for reference on some Vendors&apos; storefronts, but all payments are charged in Nigerian Naira (NGN) through Paystack.</strong> The NGN amount shown at checkout is the amount you&apos;re charged.</li>
      </ul>

      <h3>Off-platform (&quot;contact-only&quot;) orders</h3>
      <p>
        Some Vendors have not yet set up payment processing through Stora. If you order from such a Vendor, your order is recorded
        on Stora, but <strong>you&apos;ll be directed to complete payment and arrange fulfillment directly with the Vendor</strong> —
        typically via WhatsApp or another contact method they provide. For these orders, <strong>Stora does not process your payment
        and cannot mediate a refund</strong>, since no payment passed through our systems. Any dispute over such an order is between
        you and the Vendor directly.
      </p>

      <h2>4. Delivery</h2>
      <p>
        Delivery is <strong>arranged and fulfilled by the Vendor</strong>, not by Stora. Stora does not operate its own delivery
        fleet or riders. See our <Link href="/delivery-policy">Delivery Policy</Link> for details on delivery areas, timing, and
        responsibility for loss or damage in transit.
      </p>

      <h2>5. Cancellations and refunds</h2>
      <p>
        See our <Link href="/refund-policy">Refund, Cancellation &amp; Returns Policy</Link>. In summary: refund requests are
        reviewed by our support team in coordination with the Vendor, and approved refunds are processed manually rather than
        instantly. Stora&apos;s platform service fee is non-refundable.
      </p>

      <h2>6. Reviews</h2>
      <ul>
        <li>You may only leave a review for a product or store if you have an order marked delivered from that store, tying reviews to verified purchases.</li>
        <li>Public reviews display your first name and last initial only (e.g., &quot;John D.&quot;), never your full name.</li>
        <li>Reviews must be honest and based on your own experience. We may remove reviews that are fraudulent, defamatory, contain personal data of others, or otherwise violate these Terms.</li>
      </ul>

      <h2>7. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the platform for any unlawful purpose, or to list or purchase illegal, stolen, counterfeit, or unsafe goods;</li>
        <li>Post fake, incentivized, or purchased reviews, or otherwise manipulate ratings;</li>
        <li>Attempt to scrape, reverse-engineer, or interfere with the platform&apos;s normal operation, including circumventing security or rate-limiting measures;</li>
        <li>Impersonate another person, or misuse another user&apos;s account;</li>
        <li>Harass, threaten, or abuse other users, Vendors, or Stora staff;</li>
        <li>Use the AI-powered search feature to submit content that is unlawful, or attempt to extract system prompts or manipulate the underlying AI model in ways not intended for ordinary search use.</li>
      </ul>
      <p>We may suspend accounts or remove content that violates this section.</p>

      <h2>8. Intellectual property</h2>
      <p>
        &quot;Stora,&quot; &quot;Biterave,&quot; associated logos, and platform content (excluding Vendor-supplied product content)
        are owned by Axecore Labs Limited. Vendors retain ownership of their own store branding, product photos, and descriptions,
        and grant Stora a license to display that content on the platform for the purpose of operating the marketplace.
      </p>

      <h2>9. Third-party services</h2>
      <p>
        Certain features rely on third-party providers, including payment processing (Paystack), identity verification for
        Vendors (QoreID), and AI-assisted search (which sends your search text, not your account details, to Google&apos;s Gemini
        AI model via OpenRouter). Use of these features is subject to this document and our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>10. Disclaimers and limitation of liability</h2>
      <ul>
        <li>Stora provides the platform &quot;as is.&quot; We do not guarantee that products listed by Vendors are accurately described, safe, or of merchantable quality — this is the Vendor&apos;s responsibility.</li>
        <li><strong>Food and grocery items are prepared, packed, and handled by the Vendor, not Stora.</strong> Allergen and ingredient information, where provided, is supplied by the Vendor. If you have a food allergy or sensitivity, check the listed allergen information and confirm directly with the Vendor before ordering; Stora is not responsible for Vendor errors in labeling, preparation, or cross-contamination.</li>
        <li>To the maximum extent permitted by Nigerian law, Stora&apos;s aggregate liability to you for any claim arising from your use of the platform is limited to the amount you paid to Stora (i.e., the platform service fee) in connection with the order giving rise to the claim. Stora is not liable for a Vendor&apos;s acts or omissions, including product quality, food safety, or delivery failures — these are the Vendor&apos;s responsibility.</li>
      </ul>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold Stora harmless from claims arising out of your breach of these Terms, misuse of the
        platform, or violation of applicable law.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using Stora at any time. We may suspend or terminate your account for violation of these Terms, suspected
        fraud, or as required by law. Provisions that by their nature should survive (e.g., liability limits, intellectual
        property, dispute resolution) survive termination.
      </p>

      <h2>13. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the <strong>Federal Republic of Nigeria</strong>. Any dispute arising from these
        Terms or your use of Stora is subject to the exclusive jurisdiction of the courts sitting in <strong>Lagos State, Nigeria</strong>.
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the platform after an update constitutes acceptance of the
        revised Terms. Material changes will be highlighted where practical.
      </p>

      <h2>15. Contact</h2>
      <p>Questions about these Terms: <a href="mailto:support@stora.com.ng">support@stora.com.ng</a></p>
    </LegalDocument>
  );
}
