import { supabaseAdmin } from './supabase.js';

// Duplicated from apps/dashboard/src/app/api/stores/route.js +
// apps/dashboard/src/lib/websitePath.js, matching this codebase's existing
// convention of small per-app server helper duplication (see
// legalAcceptance.js, which exists separately per app) rather than a new
// shared package for a ~20-line function. Keep in sync if either changes.
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'mail', 'admin', 'support', 'help', 'status',
  'cdn', 'assets', 'blog', 'docs', 'storage', 'biterave',
  'meals', 'groceries', 'restaurants'
]);

export async function generateUniqueStoreSlug(storeName) {
  const base = storeName
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'store';

  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix}`;
    if (RESERVED_SUBDOMAINS.has(candidate)) continue;
    const { data: existing } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('store_slug', candidate)
      .maybeSingle();
    if (!existing) return candidate;
  }
}
