"use client";
import { use } from "react";
import OrderDetailsPageContent from "@/components/orders/OrderDetailsPageContent";

// No vendor slug in context -- OrderDetailsPageContent already renders
// this order fine without one (an order can span multiple vendors either
// way) and keeps every navigation target in Stora's own URL space.
export default function OrderPage({ params }) {
  const resolvedParams = use(params);
  return <OrderDetailsPageContent slug={null} orderId={resolvedParams.id} />;
}
