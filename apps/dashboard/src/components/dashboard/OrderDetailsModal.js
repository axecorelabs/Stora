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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
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
