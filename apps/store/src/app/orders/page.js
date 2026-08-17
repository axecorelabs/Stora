import OrdersListContent from "@/components/orders/OrdersListContent";

// No vendor slug in context -- OrdersListContent already fetches the
// customer's full, cross-vendor order history regardless, and keeps every
// navigation target in Stora's own URL space rather than borrowing
// whichever vendor happens to be first in the list.
export default function OrdersPage() {
  return <OrdersListContent slug={null} />;
}
