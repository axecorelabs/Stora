import RequireCommerceAccessLayout from '@/components/dashboard/RequireCommerceAccessLayout';

export default function InventoryLayout({ children }) {
  return <RequireCommerceAccessLayout>{children}</RequireCommerceAccessLayout>;
}
