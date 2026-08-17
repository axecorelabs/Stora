import CartPageContent from "@/components/cart/CartPageContent";

// No vendor slug in context (e.g. reached from the homepage header) --
// CartPageContent already handles this: it groups items by store
// regardless, and every navigation target it builds stays in Stora's own
// URL space rather than borrowing whichever vendor happens to be first in
// the cart.
export default function CartPage() {
  return <CartPageContent slug={null} />;
}
