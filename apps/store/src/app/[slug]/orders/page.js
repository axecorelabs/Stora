"use client";
import { use } from "react";
import OrdersListContent from "@/components/orders/OrdersListContent";

export default function StoreOrdersPage({ params }) {
  const resolvedParams = use(params);
  return <OrdersListContent slug={resolvedParams.slug} />;
}
