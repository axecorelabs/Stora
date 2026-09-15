import RequireCommerceAccessLayout from '@/components/dashboard/RequireCommerceAccessLayout';

export default function OrdersLayout({ children }) {
  return <RequireCommerceAccessLayout>{children}</RequireCommerceAccessLayout>;
}
