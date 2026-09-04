import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Refund Policy - Stora",
  description: "How cancellations and refunds work on Stora and Biterave."
};

export default function RefundPolicyPage() {
  return (
    <LegalDocument title="Refund, Cancellation & Returns Policy" lastUpdated="September 4, 2026">
      <p>
        This policy explains how cancellations and refunds work on Stora and Biterave, operated by{" "}
        <strong>Axecore Labs Limited</strong> (RC 9466911). It supplements our <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>1. How refunds work today</h2>
      <p>
        Every order on Stora is placed with an independent Vendor. If something goes wrong — a missing item, a wrong order, food
        that arrives in an unacceptable condition, or a failed delivery — contact our support team at{" "}
        <a href="mailto:support@stora.com.ng">support@stora.com.ng</a> with your order number and a description of the issue.
      </p>
      <p>
        <strong>Refunds are reviewed and processed manually by our support team, in coordination with the Vendor</strong> — they
        are not instant or fully automated. Once a refund is approved:
      </p>
      <ul>
        <li>We aim to complete processing promptly, though exact timing can vary depending on your bank or payment method.</li>
        <li>Refunds are returned via the original payment method where possible.</li>
        <li><strong>Stora&apos;s platform service fee is not refunded</strong>, even where the rest of your order value is.</li>
      </ul>

      <h2>2. Cancelling an order</h2>
      <ul>
        <li>You may cancel an order before the Vendor has begun preparing or dispatching it. Contact the Vendor or Stora support as soon as possible.</li>
        <li><strong>Prepared food and perishable grocery items cannot generally be cancelled once preparation or packing has started</strong>, since these items can&apos;t be resold. Refunds for meals/perishables are handled as quality or fulfillment issues (see below), not as a general &quot;change of mind&quot; cancellation.</li>
        <li>Non-perishable goods may be eligible for cancellation or return depending on the Vendor&apos;s own listing terms, shown on the product or store page where applicable.</li>
      </ul>

      <h2>3. Refund-eligible situations</h2>
      <p>You&apos;re generally entitled to raise a refund request when:</p>
      <ul>
        <li>Your order was not delivered at all;</li>
        <li>You received the wrong items;</li>
        <li>Items arrived damaged, spoiled, or not as described;</li>
        <li>The order was significantly delayed beyond the Vendor&apos;s estimate, and you no longer want it.</li>
      </ul>

      <h2>4. Pay-on-delivery orders</h2>
      <p>
        If you paid the delivery fee in cash or by transfer directly to the Vendor&apos;s rider (pay-on-delivery), refunds of that
        fee are arranged directly with the Vendor, since Stora did not collect that payment.
      </p>

      <h3>Off-platform (&quot;contact-only&quot;) orders</h3>
      <p>
        If your order was placed with a Vendor who directed you to pay them directly (e.g. via WhatsApp, bank transfer, or in
        person), <strong>Stora did not process that payment and cannot issue or mediate a refund for it.</strong> You&apos;ll need
        to resolve payment disputes for these orders directly with the Vendor.
      </p>

      <h2>5. Disputed refunds</h2>
      <p>
        If a Vendor disputes a refund request, Stora support will review the available information (order details, any evidence
        you or the Vendor provide) and make a final decision. Stora&apos;s decision on a refund dispute is final.
      </p>

      <h2>6. Contact</h2>
      <p><a href="mailto:support@stora.com.ng">support@stora.com.ng</a></p>
    </LegalDocument>
  );
}
