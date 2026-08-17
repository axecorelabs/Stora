"use client";
import { use } from "react";
import OrderDetailsPageContent from "@/components/orders/OrderDetailsPageContent";

export default function StoreOrderDetailsPage({ params }) {
  const resolvedParams = use(params);
  return <OrderDetailsPageContent slug={resolvedParams.slug} orderId={resolvedParams.id} />;
}
