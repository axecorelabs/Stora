"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";

const SIDEBAR_COLLAPSED_KEY = "stora-sidebar-collapsed";

// Read the saved preference synchronously so the very first render already
// has the right state -- each dashboard page remounts this layout on
// navigation, and restoring the preference in a post-mount effect meant the
// sidebar visibly opened, then immediately snapped shut, on every tab switch
function getInitialCollapsedState() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

export default function DashboardLayout({ children, title, subtitle }) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialCollapsedState);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  // The two onboarding hard-blockers (legal name + store creation) aren't
  // done yet -- every dashboard page routes through this layout, so this
  // is the one place that needs to catch it, rather than each sign-in/
  // sign-up entry point redirecting conditionally. The wizard page itself
  // isn't wrapped in DashboardLayout, so there's no redirect loop here.
  useEffect(() => {
    if (!loading && isAuthenticated && user && !user.onboardingCompletedAt) {
      router.push('/dashboard/onboarding');
    }
  }, [isAuthenticated, loading, user, router]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated, or if onboarding isn't complete yet --
  // both cases render nothing while the effects above navigate away, to
  // avoid a flash of dashboard content first.
  if (!isAuthenticated || (user && !user.onboardingCompletedAt)) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Fixed Sidebar */}
      <DashboardSidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />

      {/* Fixed Header */}
      <DashboardHeader title={title} subtitle={subtitle} isSidebarCollapsed={isSidebarCollapsed} />

      {/* Main Content with margins for fixed sidebar and header */}
      <div className={`flex-1 pt-20 bg-white transition-[margin] duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
