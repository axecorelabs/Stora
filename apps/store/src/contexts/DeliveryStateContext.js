"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

const DeliveryStateContext = createContext();
const COOKIE_NAME = "stora_deliver_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function writeCookie(value) {
  if (typeof document === "undefined") return;
  document.cookie = value
    ? `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
    : `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function patchPreferredState(state) {
  fetch("/api/customers/preferred-state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ state: state || null })
  }).catch(() => {
    // Fire-and-forget -- the cookie is already the source of truth for
    // this browser; a failed profile sync just means cross-device carry
    // doesn't happen until the next successful change, not a broken UI.
  });
}

// A buyer's "Deliver to" state -- a soft discovery preference, not an
// eligibility gate (every vendor ships nationwide). Cookie-only, no
// localStorage: nothing here needs to be read server-side pre-hydration,
// so one source of truth avoids a two-store reconciliation problem for no
// benefit. See each rule below for why cookie and profile are merged the
// way they are, not just "last write wins."
export function DeliveryStateProvider({ children }) {
  const { customer, isAuthenticated } = useAuth();
  const [deliveryState, setDeliveryStateInternal] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);

  // Rule 1: the cookie wins immediately on mount -- no network wait before
  // the header can render a value.
  useEffect(() => {
    setDeliveryStateInternal(readCookie());
    setHasHydrated(true);
  }, []);

  // Rule 2: once the logged-in customer's profile resolves, adopt it ONLY
  // if the cookie was empty -- this is the actual cross-device payoff (a
  // second device with no cookie yet picks up the saved value). A cookie
  // that already has a value is never silently overwritten by a passive
  // page load.
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !customer?.preferredState) return;
    if (!readCookie()) {
      writeCookie(customer.preferredState);
      setDeliveryStateInternal(customer.preferredState);
    }
  }, [hasHydrated, isAuthenticated, customer?.preferredState]);

  // Rule 3: explicit picker change -- cookie updates immediately
  // (optimistic), profile sync is fire-and-forget.
  const setDeliveryState = useCallback((value) => {
    writeCookie(value);
    setDeliveryStateInternal(value || "");
    if (isAuthenticated) patchPreferredState(value);
  }, [isAuthenticated]);

  // Rule 4: on successful login/signup specifically, push a guest-set
  // cookie value onto the profile once, unconditionally -- the only path
  // that carries "I set a state before creating an account" onto the new
  // account, since rule 2 only ever flows profile -> cookie.
  const syncToProfileOnAuth = useCallback(() => {
    const cookieValue = readCookie();
    if (cookieValue) patchPreferredState(cookieValue);
  }, []);

  const value = { deliveryState, setDeliveryState, syncToProfileOnAuth };

  return <DeliveryStateContext.Provider value={value}>{children}</DeliveryStateContext.Provider>;
}

export function useDeliveryState() {
  const context = useContext(DeliveryStateContext);
  if (!context) {
    throw new Error("useDeliveryState must be used within a DeliveryStateProvider");
  }
  return context;
}
