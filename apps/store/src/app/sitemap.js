import { supabaseAdmin } from '@/lib/supabase';
import { isPubliclyVisibleStore } from '@/lib/supabaseStore';

const SITE_URL = 'https://stora.com.ng';

const STATIC_ROUTES = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  { path: '/products', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/vendors', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/sell', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/campaigns', changeFrequency: 'daily', priority: 0.7 },
  { path: '/biterave', changeFrequency: 'daily', priority: 0.8 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/delivery-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/refund-policy', changeFrequency: 'monthly', priority: 0.3 },
];

function resolveWebsitePath(store) {
  if (!store) return null;
  const website = store.website;
  if (website && typeof website === 'object' && website.websitePath) {
    return website.websitePath;
  }
  if (typeof website === 'string') {
    try {
      const parsed = JSON.parse(website);
      if (parsed?.websitePath) return parsed.websitePath;
    } catch {
      return null;
    }
  }
  return store.store_slug || null;
}

async function getStoreUrls() {
  if (!supabaseAdmin) return { urls: [], storePathById: new Map() };

  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('id, store_slug, website, updated_at, is_active, platform_mode, subscription_status, full_store_subscription_status, full_store_subscription_grace_ends_at');

  if (error || !data) {
    console.error('Sitemap stores query error:', error);
    return { urls: [], storePathById: new Map() };
  }

  const visibleStores = data.filter(isPubliclyVisibleStore);
  const storePathById = new Map();

  const storeUrls = visibleStores
    .map((store) => {
      const path = resolveWebsitePath(store);
      if (!path) return null;
      storePathById.set(store.id, path);
      return {
        url: `${SITE_URL}/${path}`,
        lastModified: store.updated_at ? new Date(store.updated_at) : new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      };
    })
    .filter(Boolean);

  const profileUrls = visibleStores
    .filter((store) => (store.platform_mode || 'store') === 'store')
    .map((store) => {
      const path = resolveWebsitePath(store);
      if (!path) return null;
      return {
        url: `${SITE_URL}/${path}/profile`,
        lastModified: store.updated_at ? new Date(store.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
      };
    })
    .filter(Boolean);

  return { urls: [...storeUrls, ...profileUrls], storePathById };
}

async function getProductUrls(storePathById) {
  if (!supabaseAdmin || storePathById.size === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('id, store_id, updated_at, is_active, web_visibility')
    .eq('is_active', true)
    .limit(5000);

  if (error || !data) {
    console.error('Sitemap inventory query error:', error);
    return [];
  }

  return data
    .filter((item) => item.web_visibility !== 'hidden')
    .map((item) => {
      const storePath = storePathById.get(item.store_id);
      if (!storePath) return null;
      return {
        url: `${SITE_URL}/${storePath}/product/${item.id}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      };
    })
    .filter(Boolean);
}

// Campaigns live at the top level (/campaigns/[campaignId], not nested
// under a vendor slug -- see that page's own comment: a campaign can pool
// several vendors now), so this is a plain, un-joined query, same shape as
// the campaign page's own generateMetadata gate (status = 'active', which
// already has a partial index).
async function getCampaignUrls() {
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, updated_at')
    .eq('status', 'active');

  if (error || !data) {
    console.error('Sitemap campaigns query error:', error);
    return [];
  }

  return data.map((campaign) => ({
    url: `${SITE_URL}/campaigns/${campaign.id}`,
    lastModified: campaign.updated_at ? new Date(campaign.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
}

export default async function sitemap() {
  const staticUrls = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const { urls: storeUrls, storePathById } = await getStoreUrls();
  const productUrls = await getProductUrls(storePathById);
  const campaignUrls = await getCampaignUrls();

  return [...staticUrls, ...storeUrls, ...productUrls, ...campaignUrls];
}
