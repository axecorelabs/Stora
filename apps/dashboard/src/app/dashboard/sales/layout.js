import RequireCommerceAccessLayout from '@/components/dashboard/RequireCommerceAccessLayout';

export default function SalesLayout({ children }) {
  return <RequireCommerceAccessLayout>{children}</RequireCommerceAccessLayout>;
}
