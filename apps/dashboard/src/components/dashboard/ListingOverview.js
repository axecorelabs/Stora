"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Button from "@/components/ui/Button";
import {
  Images,
  Eye,
  Calendar,
  Clock,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  BadgeCheck,
  ExternalLink
} from "lucide-react";

function getCurrentDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export default function ListingOverview({ store }) {
  const router = useRouter();
  const { secureApiCall, user } = useAuth();

  const { data: websiteStats, isLoading: statsLoading } = useQuery({
    queryKey: ['website-stats'],
    queryFn: () => secureApiCall('/api/stores/website/stats'),
    staleTime: 2 * 60 * 1000
  });

  const { data: galleryData } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => secureApiCall('/api/gallery'),
    staleTime: 2 * 60 * 1000
  });

  const isLive = store?.subscriptionStatus === 'active';
  const stats = websiteStats?.stats;
  const galleryCount = galleryData?.data?.length || 0;

  const statRows = [
    {
      key: 'total-views',
      icon: Eye,
      tone: 'brand',
      label: 'Total views',
      value: statsLoading ? null : (stats?.totalViews ?? 0),
      sub: 'All-time showcase visits',
      onClick: null
    },
    {
      key: 'monthly-views',
      icon: Calendar,
      tone: 'brand',
      label: 'This month',
      value: statsLoading ? null : (stats?.monthlyViews ?? 0),
      sub: 'Views in the last 30 days',
      onClick: null
    },
    {
      key: 'gallery',
      icon: Images,
      tone: 'gold',
      label: 'Gallery',
      value: `${galleryCount} / 10`,
      sub: 'Images uploaded',
      onClick: () => router.push('/dashboard/gallery')
    }
  ];

  const lastVisit = stats?.lastVisit
    ? new Date(stats.lastVisit).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <DashboardLayout title="Dashboard Overview" subtitle={getCurrentDate()}>
      <div className="space-y-4 lg:space-y-6">

        {/* Not-live alert */}
        {!isLive && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Your listing is not live</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {store?.subscriptionStatus === 'past_due'
                  ? 'Your last payment failed — renew to restore visibility.'
                  : 'Subscribe for ₦500/month to make your showcase page public.'}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => router.push('/dashboard/subscription')}
              className="text-xs px-3 py-1.5 flex-shrink-0"
            >
              {store?.subscriptionStatus === 'past_due' ? 'Renew' : 'Subscribe'}
            </Button>
          </div>
        )}

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 rounded-2xl lg:rounded-3xl p-5 lg:p-8 overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <img src="/stora.png" alt="" aria-hidden="true" className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 lg:w-80 lg:h-80 object-contain opacity-10 pointer-events-none select-none" />

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3 lg:mb-4">
              <Sparkles className="w-5 h-5 text-gold-500" />
              <p className="text-gold-500 text-sm font-semibold tracking-wide">
                {getGreeting()}, {user?.firstName || 'there'}
              </p>
            </div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white mb-2 lg:mb-3 leading-tight">
              {store?.storeName}<br />
              <span className="text-gold-500">Showcase</span>
            </h1>
            {isLive && store?.websiteFullPath ? (
              <a
                href={`https://${store.websiteFullPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white mb-6 lg:mb-8"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {store.websiteFullPath}
              </a>
            ) : (
              <p className="text-sm lg:text-base text-gray-300 mb-6 lg:mb-8 max-w-md">
                Your public showcase page — gallery, contact info, and business details.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/dashboard/gallery')}
                className="group bg-gold-500 text-brand-900 px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gold-400 transition-all shadow-lg flex items-center gap-2"
              >
                <span>Manage Gallery</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
              <button
                onClick={() => router.push('/dashboard/subscription?upgrade=1')}
                className="group bg-white/10 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <BadgeCheck className="w-4 h-4" />
                <span>Upgrade to full store</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {statRows.map((row) => {
              const Icon = row.icon;
              const inner = (
                <div className={`text-left p-4 lg:p-5 w-full ${row.onClick ? 'hover:bg-gray-50 transition-colors cursor-pointer' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${row.tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm text-gray-500">{row.label}</span>
                  </div>
                  {row.value === null ? (
                    <span className="inline-block w-12 h-7 bg-gray-100 animate-pulse rounded" />
                  ) : (
                    <p className="text-xl lg:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.value}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{row.sub}</p>
                </div>
              );
              return row.onClick
                ? <button key={row.key} onClick={row.onClick}>{inner}</button>
                : <div key={row.key}>{inner}</div>;
            })}
          </div>
        </div>

        {/* Two-column: last visit + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Last visit */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-100 text-brand-800">
                <Clock className="w-4 h-4" />
              </span>
              <span className="text-sm text-gray-500">Last showcase visit</span>
            </div>
            {statsLoading ? (
              <div className="h-7 w-32 bg-gray-100 animate-pulse rounded" />
            ) : lastVisit ? (
              <p className="text-xl lg:text-2xl font-bold text-gray-900">{lastVisit}</p>
            ) : (
              <p className="text-sm text-gray-400">No visits recorded yet</p>
            )}
            {isLive && (
              <p className="text-xs text-gray-400 mt-1">Your page is live and discoverable</p>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6 space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Quick actions</p>
            <button
              onClick={() => router.push('/dashboard/gallery')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Images className="w-4 h-4 text-brand-800" />
                <span className="text-sm font-medium text-gray-900">Gallery</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-brand-800 transition-colors" />
            </button>
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <BadgeCheck className="w-4 h-4 text-brand-800" />
                <span className="text-sm font-medium text-gray-900">Subscription</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isLive ? 'text-green-700 bg-green-100' : 'text-amber-700 bg-amber-100'}`}>
                {isLive ? 'Active' : 'Inactive'}
              </span>
            </button>
            <button
              onClick={() => router.push('/dashboard/settings')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Eye className="w-4 h-4 text-brand-800" />
                <span className="text-sm font-medium text-gray-900">Business details & contact</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-brand-800 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
