'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PartnershipProposalProvider } from '@/contexts/PartnershipProposalContext';
import { useState } from 'react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

// Rendered once, inside both providers, so it's never torn down/recreated by
// per-page navigation (unlike DashboardLayout, which remounts on every
// route change) -- the SSE connection stays open across the whole session
// instead of reconnecting every time a vendor clicks between tabs.
function RealtimeNotificationsBridge() {
  const { isAuthenticated } = useAuth();
  useRealtimeNotifications(isAuthenticated);
  return null;
}

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        cacheTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeNotificationsBridge />
        {/* Same "mounted once here, not in the outer root layout" reasoning
            as RealtimeNotificationsBridge above -- this app has two
            AuthProvider instances (this one, and a separate one in
            app/layout.js above Providers); signIn/signOut only ever update
            THIS instance's state (the one the actual page tree, including
            the login form, reads from), so anything that needs a real
            isAuthenticated/secureApiCall has to live inside this one, not
            the outer one. */}
        <PartnershipProposalProvider>
          {children}
        </PartnershipProposalProvider>
      </AuthProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
