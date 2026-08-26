"use client";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import OrderDetailsContent from "@/components/dashboard/OrderDetailsContent";
import { useOrderDetails } from "@/hooks/useOrderDetails";

// A direct, bookmarkable/shareable link to exactly one order -- what the
// "View order" button in the new-order-received email needs (it used to
// link here before this page existed, 404ing every time -- see
// apps/store/src/emails/NewOrderNotification.jsx). The Orders list page's
// own row-click/modal flow is untouched; this is an additional route, not
// a replacement for it.
export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const { order, isLoading, isError, updateStatus, isUpdating } = useOrderDetails(id);

  const backToOrders = () => router.push('/dashboard/orders');

  if (isLoading) {
    return (
      <DashboardLayout title="Order Details" subtitle="Loading...">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !order) {
    return (
      <DashboardLayout title="Order Details" subtitle="">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-gray-900 text-lg font-semibold mb-2">Order not found</p>
            <p className="text-gray-500 text-sm mb-6">
              This order doesn't exist, or you don't have access to it.
            </p>
            <button
              onClick={backToOrders}
              className="px-6 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors font-medium"
            >
              Back to Orders
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Order #${order.orderNumber}`} subtitle="Order details">
      <button
        onClick={backToOrders}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
        <OrderDetailsContent
          order={order}
          onStatusUpdate={updateStatus}
          updatingStatus={isUpdating}
        />
      </div>
    </DashboardLayout>
  );
}
