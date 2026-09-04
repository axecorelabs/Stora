import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";

export const metadata = {
  title: "Delivery Policy - Stora",
  description: "How delivery works on Stora and Biterave."
};

export default function DeliveryPolicyPage() {
  return (
    <LegalDocument title="Delivery Policy" lastUpdated="September 4, 2026">
      <p>
        This policy explains how delivery works on Stora and Biterave, operated by <strong>Axecore Labs Limited</strong> (RC 9466911).
        It supplements our <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>1. Stora does not deliver your order</h2>
      <p>
        <strong>Stora does not operate its own delivery fleet, riders, or logistics network.</strong> Every order is delivered by
        the Vendor themselves — their own staff, riders, or a courier they choose to use. Stora provides the ordering and payment
        platform; the Vendor is responsible for getting your order to you.
      </p>

      <h2>2. Delivery areas</h2>
      <p>
        Each Vendor sets their own list of Nigerian states they deliver to. We show you this information before and during
        checkout. If your delivery address falls outside a Vendor&apos;s stated delivery states, we&apos;ll warn you before you
        complete an order — but you&apos;re responsible for confirming delivery is actually possible to your address with the
        Vendor if there&apos;s any doubt.
      </p>

      <h2>3. Delivery timing</h2>
      <p>
        Estimated delivery/preparation times shown on a listing are provided by the Vendor and are estimates, not guarantees.
        Actual delivery time can vary due to order volume, weather, traffic, or other factors outside Stora&apos;s control.
      </p>

      <h2>4. How delivery fees are charged</h2>
      <p>Vendors use one of two models:</p>
      <ul>
        <li><strong>Collected at checkout</strong>: the delivery fee is charged together with your order total through Paystack.</li>
        <li><strong>Pay-on-delivery</strong>: the delivery fee is collected in cash or by transfer directly by the Vendor&apos;s delivery person when your order arrives. In this case, Stora is not involved in that specific payment.</li>
      </ul>
      <p>
        If a Vendor hasn&apos;t priced delivery to your state at all, you&apos;ll be told at checkout that delivery isn&apos;t free
        there — the fee will be confirmed with you and paid directly to the Vendor or rider when your order arrives.
      </p>

      <h2>5. Address accuracy</h2>
      <p>
        You&apos;re responsible for providing an accurate, complete delivery address (street, city, state, and any landmark needed
        to find you). Failed delivery due to an incorrect or incomplete address may not be eligible for a refund — see our{" "}
        <Link href="/refund-policy">Refund Policy</Link>.
      </p>

      <h2>6. Risk during delivery</h2>
      <p>
        Once an order leaves the Vendor for delivery, responsibility for safe handling in transit rests with the Vendor and their
        delivery arrangement. If your order arrives damaged, missing items, or not as ordered, contact support — see our{" "}
        <Link href="/refund-policy">Refund Policy</Link> for how we handle this.
      </p>

      <h2>7. Off-platform orders</h2>
      <p>
        For a small number of Vendors not yet set up for payment processing through Stora, delivery is arranged entirely
        off-platform, directly with the Vendor (see our <Link href="/terms">Terms of Service</Link>). This policy&apos;s
        Stora-facilitated protections (delivery-area warnings shown at checkout aside) don&apos;t extend to arrangements made
        after that hand-off.
      </p>

      <h2>8. Contact</h2>
      <p>For delivery issues, contact <a href="mailto:support@stora.com.ng">support@stora.com.ng</a> with your order number.</p>
    </LegalDocument>
  );
}
