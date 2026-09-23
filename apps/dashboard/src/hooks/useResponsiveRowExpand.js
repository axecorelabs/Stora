"use client";
import { useEffect, useState } from "react";

// Shared by every dashboard table that shows a row's extra detail on
// click (Catalogue, Orders, Sales, Payments, Services) -- desktop expands
// the row in place (kept exactly as it was; that's genuinely fine there),
// but the same rich detail block squeezed into a table cell on a narrow
// phone screen is cramped and hard to use. Below md:, the identical
// detail content instead opens in the shared bottom-sheet Modal, which
// gives it full width and native scroll instead of fighting a table
// layout for space.
export default function useResponsiveRowExpand(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [mobileDetailItem, setMobileDetailItem] = useState(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpointPx);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRow = (id, item) => {
    if (isMobile) {
      setMobileDetailItem(item);
    } else {
      setExpandedId((prev) => (prev === id ? null : id));
    }
  };

  const closeMobileDetail = () => setMobileDetailItem(null);

  return { isMobile, expandedId, mobileDetailItem, toggleRow, closeMobileDetail };
}
