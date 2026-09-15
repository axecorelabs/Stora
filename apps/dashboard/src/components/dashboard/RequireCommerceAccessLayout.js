import { redirect } from 'next/navigation';
import { getDashboardAccessContext } from '@/lib/storeAccess';

export default async function RequireCommerceAccessLayout({ children }) {
  const { user, store } = await getDashboardAccessContext();

  if (!user) {
    redirect('/');
  }

  if (!store) {
    redirect('/dashboard/onboarding');
  }

  if (store.platform_mode === 'listing') {
    redirect('/dashboard/overview');
  }

  return children;
}
