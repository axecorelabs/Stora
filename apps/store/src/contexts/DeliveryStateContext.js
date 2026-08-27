"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

const DeliveryStateContext = createContext();
const COOKIE_NAME = "stora_deliver_state";
// Set alongside COOKIE_NAME only when proxy.js wrote it from an IP-geo
// guess (see resolveDeliverStateCookie there) -- a guess is quiet and
// low-confidence, so it must never outrank a real signal: the logged-in
// customer's actual saved preference (rule 2 below) or an explicit pick
// (rule 3). Absent/cleared means "whatever's in COOKIE_NAME is a real,
// confirmed value," which is the state this cookie defaults to for
// anyone middleware never touched (this app's own writes below always
// clear it alongside setting a real value).
const GUESS_COOKIE_NAME = "stora_deliver_state_is_guess";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

// Always writes/clears both cookies together -- every call site here
// represents a real, confirmed value (an explicit pick, or a profile
// adopted because nothing more authoritative existed), so the guess flag
// is always cleared alongside it. Only proxy.js ever sets the flag on its
// own, for the one case (a bare IP guess) this app never confirms itself.
function writeCookie(value) {
  if (typeof document === "undefined") return;
  // Secure is gated on the page's own protocol, not NODE_ENV: a cookie
  // written with `; Secure` over plain http is silently dropped by the
  // browser, which would break local dev (http://localhost). Prod is
  // always https, so this lands on the same behavior as proxy.js's own
  // NODE_ENV-gated writes for these same two cookies.
  const secureSuffix = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = value
    ? `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secureSuffix}`
    : `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureSuffix}`;
  document.cookie = `${GUESS_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureSuffix}`;
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
// way they are, not just "last write wins" -- and see GUESS_COOKIE_NAME
// above for why a bare IP-geo guess (proxy.js) is deliberately weaker
// than every rule here, not just another write to the same cookie.
export function DeliveryStateProvider({ children }) {
  const { customer, isAuthenticated } = useAuth();
  const [deliveryState, setDeliveryStateInternal] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);

  // Rule 1: the cookie wins immediately on mount -- no network wait before
  // the header can render a value. May be a guess (proxy.js) as well as a
  // real one; either way it's the best available value until rule 2 (if
  // it applies) resolves and potentially overrides it.
  useEffect(() => {
    setDeliveryStateInternal(readCookie(COOKIE_NAME));
    setHasHydrated(true);
  }, []);

  // Rule 2: once the logged-in customer's profile resolves, adopt it if
  // the cookie was empty OR only ever an IP guess -- the real cross-device
  // payoff (a second device with no cookie yet, or one that only has
  // proxy.js's low-confidence guess, picks up the actual saved value). A
  // cookie holding a real, confirmed value (an explicit pick, or a
  // previously-adopted profile value) is never silently overwritten by a
  // passive page load.
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !customer?.preferredState) return;
    if (!readCookie(COOKIE_NAME) || readCookie(GUESS_COOKIE_NAME)) {
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
  // account, since rule 2 only ever flows profile -> cookie. Skipped for a
  // bare IP guess the guest never actually confirmed -- rule 2 already
  // handles that case correctly (adopts the real profile value, if any,
  // over the guess) without this pushing the guess onto the profile first.
  const syncToProfileOnAuth = useCallback(() => {
    if (readCookie(GUESS_COOKIE_NAME)) return;
    const cookieValue = readCookie(COOKIE_NAME);
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
