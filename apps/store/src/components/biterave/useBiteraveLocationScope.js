"use client";
import { useState } from "react";
import { useDeliveryState } from "@/contexts/DeliveryStateContext";

// Biterave-specific default: unlike the rest of Stora (where "deliver to"
// is an opt-in soft preference the shopper has to switch on -- see
// DeliveryStateContext.js's own comment, every vendor there ships
// nationwide), food is inherently local, so Biterave's listings hard-
// filter to the shopper's known state by default whenever one exists --
// IP-guessed by proxy.js, or explicitly picked, either already surfaced
// by the same shared useDeliveryState() the rest of the storefront uses.
//
// `seeAll` is a per-mount override, not a persisted preference -- it's a
// "just this once, show me everything" escape hatch (see
// BiteraveLocationBar), not a changed setting, so navigating to a fresh
// listing goes back to scoped rather than staying silently widened.
export function useBiteraveLocationScope() {
  const { deliveryState, setDeliveryState } = useDeliveryState();
  const [seeAll, setSeeAll] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const scoped = Boolean(deliveryState) && !seeAll;

  return {
    deliveryState,
    setDeliveryState,
    seeAll,
    setSeeAll,
    showPicker,
    setShowPicker,
    scoped,
    // What to actually send to the search APIs -- buyerState is worth
    // sending even when not hard-filtering (deliverableOnly false), since
    // sort=nearest can still use it; deliverableOnly is the hard gate.
    buyerState: deliveryState || undefined,
    deliverableOnly: scoped
  };
}
