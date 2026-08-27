"use client";
import OrderDetailsContent from "./OrderDetailsContent";

// Modal chrome only -- the actual order-detail view lives in
// OrderDetailsContent, shared with the standalone
// /dashboard/orders/[id] page so both render identically.
export default function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  onStatusUpdate,
  updatingStatus = false
}) {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 sm:p-4">
      {/* Full-screen on mobile (no backdrop margin, no rounded corners,
          fills the viewport) -- restores the original centered-card look
          at sm: and up, unchanged. */}
      <div className="bg-white w-full h-full sm:h-auto sm:rounded-2xl sm:max-w-6xl sm:max-h-[90vh] overflow-hidden flex flex-col">
        <OrderDetailsContent
          order={order}
          onStatusUpdate={onStatusUpdate}
          updatingStatus={updatingStatus}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
