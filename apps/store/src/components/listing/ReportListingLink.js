"use client";
import { useState } from "react";
import ReportListingModal from "./ReportListingModal";

// Thin client wrapper so the (server-component) ListingShowcase/ListingFooter
// can render this inline without itself needing "use client" -- only the
// open/close state and the modal it triggers are interactive.
export default function ReportListingLink({ storeId }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="hover:text-brand-800">
        Report this listing
      </button>
      <ReportListingModal isOpen={isOpen} onClose={() => setIsOpen(false)} storeId={storeId} />
    </>
  );
}
