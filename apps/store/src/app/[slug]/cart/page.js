"use client";
import { use } from "react";
import CartPageContent from "@/components/cart/CartPageContent";

export default function StoreCartPage({ params }) {
  const resolvedParams = use(params);
  return <CartPageContent slug={resolvedParams.slug} />;
}
