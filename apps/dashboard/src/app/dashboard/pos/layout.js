import RequireCommerceAccessLayout from '@/components/dashboard/RequireCommerceAccessLayout';

export default function PosLayout({ children }) {
  return <RequireCommerceAccessLayout>{children}</RequireCommerceAccessLayout>;
}
