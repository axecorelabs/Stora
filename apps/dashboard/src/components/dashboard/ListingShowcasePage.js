"use client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import StoreBrandingModal from "@/components/dashboard/StoreBrandingModal";
import SectionHeader from "@/components/ui/SectionHeader";
import StoreQrCode from "@/components/dashboard/StoreQrCode";
import Button from "@/components/ui/Button";
import { useWebsiteData } from "@/hooks/useWebsiteData";
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Palette,
  Eye,
  EyeOff,
  AlertCircle,
  Images,
  Clock,
  Settings,
  Store,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Twitter,
  MessageCircle,
  Share2,
  Info,
  Users,
  BarChart3,
} from "lucide-react";

export default function ListingShowcasePage({ store, onBrandingUpdated }) {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toggleWebsite, isTogglingWebsite } = useWebsiteData();

  const { data: websiteStats } = useQuery({
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
  const isVisible = store?.website?.isEnabled;
  const stats = websiteStats?.stats;
  const galleryItems = galleryData?.data || [];

  const copyUrl = async () => {
    if (!store?.websiteUrl) return;
    try {
      await navigator.clipboard.writeText(store.websiteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const toggleVisibility = async () => {
    if (!isLive) return;
    try {
      await toggleWebsite(isVisible ? 'inactive' : 'active');
      queryClient.invalidateQueries({ queryKey: ['store'] });
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  const handleBrandingUpdatedInternal = () => {
    setIsBrandingModalOpen(false);
    onBrandingUpdated?.();
  };

  const socialMediaLinks = useMemo(() => {
    if (!store?.onlineStoreInfo?.socialMedia) return [];
    const links = [];
    const s = store.onlineStoreInfo.socialMedia;
    if (s.whatsapp) {
      const n = s.whatsapp.replace(/\D/g, '');
      const fmt = n.startsWith('234') ? n : `234${n.startsWith('0') ? n.slice(1) : n}`;
      links.push({ platform: 'WhatsApp', icon: MessageCircle, value: s.whatsapp, url: `https://wa.me/${fmt}`, color: 'text-green-600', bgColor: 'bg-green-100' });
    }
    if (s.instagram) links.push({ platform: 'Instagram', icon: Instagram, value: s.instagram, url: `https://instagram.com/${s.instagram.replace('@', '')}`, color: 'text-pink-600', bgColor: 'bg-pink-100' });
    if (s.facebook) links.push({ platform: 'Facebook', icon: Facebook, value: s.facebook, url: `https://facebook.com/${s.facebook.replace('@', '')}`, color: 'text-blue-600', bgColor: 'bg-blue-100' });
    if (s.twitter) links.push({ platform: 'Twitter', icon: Twitter, value: s.twitter, url: `https://twitter.com/${s.twitter.replace('@', '')}`, color: 'text-blue-400', bgColor: 'bg-blue-100' });
    return links;
  }, [store?.onlineStoreInfo?.socialMedia]);

  return (
    <DashboardLayout title="Showcase" subtitle="Your public business listing page">

      {/* Header card -- same structure as website page */}
      <div className="mb-4 lg:mb-6 bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 lg:p-3 bg-brand-100 rounded-2xl">
              <Globe className="w-8 h-8 text-brand-800" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{store?.storeName}</h1>
              <div className="flex items-center flex-wrap gap-2 mt-1">
                <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                  isLive && isVisible ? 'bg-green-100 text-green-800' :
                  isLive && !isVisible ? 'bg-gray-100 text-gray-700' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {isLive && isVisible ? 'Live & Active' : isLive && !isVisible ? 'Hidden' : 'Subscription required'}
                </span>
                {store?.websiteFullPath && (
                  <span className="text-sm text-gray-500">{store.websiteFullPath}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setIsBrandingModalOpen(true)}>
              <Palette className="w-4 h-4" />
              <span>Customize Design</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-5 pt-5 border-t border-gray-100">
          {/* URL */}
          {store?.websiteUrl ? (
            <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-4 py-2 min-w-0">
              <span className="text-sm text-gray-600 truncate">{store.websiteUrl}</span>
              <button onClick={copyUrl} className="p-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0" title="Copy URL">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
              {isLive && isVisible && (
                <a href={store.websiteUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0" title="Visit showcase">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-400">No URL assigned yet</span>
          )}

          {/* Visibility toggle */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Showcase visible</span>
              <button
                onClick={toggleVisibility}
                disabled={!isLive || isTogglingWebsite}
                title={!isLive ? 'Requires an active subscription' : undefined}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-800 focus:ring-offset-2 ${
                  isVisible && isLive ? 'bg-brand-800' : 'bg-gray-200'
                } ${!isLive || isTogglingWebsite ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isVisible && isLive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              {isTogglingWebsite && <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-brand-800" />}
            </div>
            <p className="text-xs text-gray-400">
              {!isLive ? 'Requires an active subscription' : 'May take a few minutes to update'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4 lg:mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {[
            { icon: Eye, tone: 'brand', label: 'Total Views', value: stats?.totalViews ?? 0 },
            { icon: Users, tone: 'gold', label: 'Monthly Views', value: stats?.monthlyViews ?? 0 },
            { icon: Images, tone: 'brand', label: 'Gallery', value: `${galleryItems.length}/10` },
            {
              icon: Clock, tone: 'gold', label: 'Last Visit',
              value: stats?.lastVisit ? new Date(stats.lastVisit).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '—'
            }
          ].map(({ icon: Icon, tone, label, value }) => (
            <div key={label} className="p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-sm text-gray-500">{label}</span>
              </div>
              <p className="text-xl lg:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
        {/* Left -- gallery preview + store info */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-8">

          {/* Gallery preview -- replaces product preview */}
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <SectionHeader
              icon={Images}
              title="Gallery Preview"
              right={
                <a href="/dashboard/gallery" className="flex items-center space-x-2 text-sm text-brand-800 hover:text-brand-900 transition-colors">
                  <span>Manage gallery</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              }
            />

            {galleryItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {galleryItems.slice(0, 6).map((item) => (
                  <div key={item.id} className="aspect-video rounded-xl overflow-hidden bg-gray-100">
                    <img src={item.image_url} alt={item.caption || ''} className="w-full h-full object-cover" />
                  </div>
                ))}
                {galleryItems.length === 0 && [...Array(3)].map((_, i) => (
                  <div key={i} className="aspect-video rounded-xl bg-gray-100 flex items-center justify-center">
                    <Images className="w-6 h-6 text-gray-300" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center mt-4">
                <Images className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">No gallery images yet</p>
                <p className="text-xs text-gray-400 mb-3">Upload photos of your work to showcase to potential customers</p>
                <a href="/dashboard/gallery" className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:text-brand-900">
                  Add images <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Business info -- same as website page */}
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <SectionHeader icon={Store} title="Business Information" tone="gold" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-3">Basic Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Store className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium text-gray-600">{store?.storeName}</span>
                  </div>
                  {store?.storePhone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium text-gray-600">{store.storePhone}</span>
                    </div>
                  )}
                  {store?.storeEmail && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-gray-600">{store.storeEmail}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-3">Location</h3>
                <div className="space-y-2 text-sm">
                  {store?.fullAddress ? (
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                      <p className="font-medium text-gray-600">{store.fullAddress}</p>
                    </div>
                  ) : store?.state ? (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-600">{store.state}</span>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs">No address set — add one in Settings</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column -- QR + social + tips */}
        <div className="space-y-6">
          <StoreQrCode store={store} />

          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <SectionHeader icon={Share2} title="Social Media Links" />
            {socialMediaLinks.length > 0 ? (
              <>
                <div className="space-y-3">
                  {socialMediaLinks.map((social, i) => {
                    const Icon = social.icon;
                    return (
                      <button key={i} onClick={() => window.open(social.url, '_blank', 'noopener,noreferrer')}
                        className={`w-full flex items-center justify-between p-3 ${social.bgColor} rounded-xl hover:opacity-80 transition-all group`}>
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 bg-white rounded-lg ${social.color}`}><Icon className="w-4 h-4" /></div>
                          <div className="text-left">
                            <p className={`text-sm font-medium ${social.color}`}>{social.platform}</p>
                            <p className="text-xs text-gray-600">{social.value}</p>
                          </div>
                        </div>
                        <ExternalLink className={`w-4 h-4 ${social.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600 flex items-center">
                    <Info className="w-3 h-3 mr-1 shrink-0" />
                    Click any link to visit your profile on that platform
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <Share2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-1">No social media linked yet</p>
                <p className="text-xs text-gray-400 mb-3">Add your Instagram or WhatsApp to help customers reach you</p>
                <a href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:text-brand-900">
                  Add social links <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          <div className="bg-brand-50 rounded-2xl p-4 lg:p-6 border border-brand-200">
            <h4 className="text-sm font-medium text-brand-900 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" /> Tips
            </h4>
            <div className="text-xs text-brand-800 space-y-2">
              <p><strong>Branding:</strong> Use "Customize Design" to update your logo, banner, and brand colours.</p>
              <p><strong>Gallery:</strong> Add up to 10 photos of your work — they appear on your showcase page.</p>
              <p><strong>Contact:</strong> Your phone, WhatsApp, and email from Settings are displayed to visitors.</p>
            </div>
          </div>
        </div>
      </div>

      <StoreBrandingModal
        isOpen={isBrandingModalOpen}
        store={store}
        onClose={() => setIsBrandingModalOpen(false)}
        onBrandingUpdated={handleBrandingUpdatedInternal}
      />
    </DashboardLayout>
  );
}
