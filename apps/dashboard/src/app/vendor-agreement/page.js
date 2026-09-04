import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Vendor Agreement - Stora",
  description: "The agreement governing your store on Stora."
};

export default function VendorAgreementPage() {
  return (
    <LegalDocument title="Vendor Agreement" lastUpdated="September 4, 2026">
      <p>
        This Vendor Agreement (&quot;Agreement&quot;) is between <strong>Axecore Labs Limited</strong> (RC 9466911), operator of{" "}
        <strong>Stora</strong> and <strong>Biterave</strong> (&quot;Stora,&quot; &quot;we,&quot; &quot;us&quot;), and you, the
        person or business creating a store on the platform (&quot;Vendor,&quot; &quot;you&quot;). By creating a store, you agree
        to this Agreement in addition to our general <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>1. Your relationship with Stora</h2>
      <p>
        You are an <strong>independent seller</strong>, not an employee, agent, partner, or franchisee of Stora. You are solely
        responsible for the products/food you list, their legality, safety, quality, and accuracy of description, and for
        fulfilling orders placed with your store.
      </p>

      <h2>2. Store setup and identity verification</h2>
      <ul>
        <li>You must provide accurate store information (name, description, contact details, address) at setup.</li>
        <li>
          To receive a &quot;Verified by Stora&quot; badge and to enable payouts, you must complete identity verification, which
          requires submitting your NIN and a live selfie for matching via our verification provider, QoreID. This is governed by
          our <Link href="/vendor-kyc-policy">Vendor KYC &amp; Verification Policy</Link>. You may operate a store without
          completing verification, but certain trust signals and payout capabilities may be limited until verification is complete.
        </li>
        <li>You must keep your store information, including delivery areas and contact details, accurate and up to date.</li>
      </ul>

      <h2>3. Commission and payouts</h2>
      <ul>
        <li>
          Stora charges a <strong>commission on completed orders</strong> placed through your store. The exact percentage rate and
          any applicable minimum commission amount will be disclosed to you during store setup and shown in your dashboard
          settings — this Agreement does not fix a single rate, since Stora may adjust it with notice, and different Vendors or
          promotions may carry different rates.
        </li>
        <li>If you&apos;ve entered into a separate negotiated partner agreement with Stora, your commission rate may differ from the standard rate; that separate agreement controls in case of conflict with this section.</li>
        <li>If you display prices in a currency other than Nigerian Naira (NGN) on your storefront, you&apos;re responsible for making sure this isn&apos;t misleading — <strong>all payments are actually charged and settled in NGN</strong> through Paystack.</li>
        <li>You may choose whether the commission is <strong>absorbed by you</strong> (deducted from your settlement) or <strong>passed to the Customer</strong> as part of their order total, subject to whatever choice your dashboard settings allow.</li>
        <li>Payouts are made via <strong>Paystack</strong>, using a payment sub-account created in your name with your provided bank details. Payment settlement timing follows Paystack&apos;s standard schedule.</li>
        <li><strong>The platform commission is non-refundable</strong> — if an order is refunded to a Customer, Stora retains its commission on that transaction.</li>
        <li>If a refund is issued on an order that has already been settled to you, Stora may deduct the refunded amount (net of the retained commission) from a future payout, or invoice you directly for it.</li>
      </ul>

      <h2>4. Orders, fulfillment, and delivery</h2>
      <ul>
        <li>You are responsible for accepting, preparing/packing, and delivering (or arranging delivery of) orders placed at your store, within the delivery areas you configure.</li>
        <li><strong>Stora does not operate a delivery fleet.</strong> You are responsible for your own delivery arrangements — your own staff, riders, or third-party couriers you choose to use.</li>
        <li>If you offer <strong>pay-on-delivery</strong>, you (or your delivery person) are responsible for collecting the delivery fee directly from the Customer and for any cash-handling risk that entails.</li>
        <li>You are responsible for fulfilling orders within a reasonable time and communicating delays to Customers.</li>
        <li>If your store isn&apos;t set up for payment processing through Stora, orders directed to you as &quot;contact-only&quot; are arranged and paid for directly between you and the Customer (e.g. via WhatsApp). <strong>Stora is not involved in collecting or refunding that payment</strong>, and you&apos;re responsible for your own handling of the Customer&apos;s contact details shared with you this way, consistent with applicable data-protection law.</li>
      </ul>

      <h2>5. Food and grocery listings (Biterave)</h2>
      <p>If you list food items:</p>
      <ul>
        <li>You are responsible for accurately declaring allergens, ingredients, and any other food-safety-relevant information in your listing.</li>
        <li>You represent that your food preparation complies with applicable Nigerian food-safety and public-health regulations for your business type and location.</li>
        <li>If you list alcoholic beverages, you represent that you hold any license or permit required to sell alcohol in your state, and you agree to confirm the recipient is at least 18 years old at the point of delivery.</li>
      </ul>

      <h2>6. Refunds and disputes</h2>
      <ul>
        <li>Refund requests from Customers are reviewed by Stora&apos;s support team, in coordination with you. Approved refunds are currently processed manually (not by instant automatic reversal).</li>
        <li>You agree to respond to Stora&apos;s requests for information about a disputed order (e.g., proof of delivery, preparation records) in a timely manner.</li>
        <li>Repeated or unresolved disputes, or a pattern of Customer complaints, may result in store suspension pending review.</li>
      </ul>

      <h2>7. Content and reviews</h2>
      <ul>
        <li>You retain ownership of your store branding, photos, and descriptions, and grant Stora a license to display them for the purpose of operating the marketplace.</li>
        <li>You may not manipulate reviews. Stora reserves the right to remove reviews or listings that violate this Agreement or the Terms of Service.</li>
      </ul>

      <h2>8. Suspension and termination</h2>
      <p>
        We may suspend or deactivate your store for: violation of this Agreement, providing false information, failed or
        repeatedly disputed verification, fraud, or a pattern of Customer harm (e.g., food-safety complaints). You may close your
        store at any time by contacting support; outstanding orders must still be fulfilled or properly refunded first.
      </p>

      <h2>9. Liability</h2>
      <p>
        You agree to indemnify Stora against claims arising from your products, food, delivery arrangements, or breach of this
        Agreement — including claims from Customers relating to food safety, allergic reactions, delivery incidents, or product
        defects. Stora&apos;s role is limited to providing the marketplace platform, payment processing, and order infrastructure.
      </p>

      <h2>10. Governing law</h2>
      <p>
        This Agreement is governed by the laws of the Federal Republic of Nigeria, with disputes subject to the exclusive
        jurisdiction of the courts of Lagos State, consistent with our Terms of Service.
      </p>

      <h2>11. Changes</h2>
      <p>We may update this Agreement from time to time; continued use of your Vendor account after an update constitutes acceptance.</p>

      <h2>12. Contact</h2>
      <p><a href="mailto:support@app.stora.com.ng">support@app.stora.com.ng</a></p>
    </LegalDocument>
  );
}
