import RequireCommerceAccessLayout from '@/components/dashboard/RequireCommerceAccessLayout';

export default function PaymentsLayout({ children }) {
  return <RequireCommerceAccessLayout>{children}</RequireCommerceAccessLayout>;
}
