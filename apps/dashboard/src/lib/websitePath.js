import { supabaseAdmin } from './supabase';

// Kept in sync with workers/subdomain-router/wrangler.toml's
// RESERVED_SUBDOMAINS -- if one changes, so must the other. These already
// have their own DNS records in the zone (or, like "storage", are a
// public host for something else entirely), so a vendor claiming one as
// their website address would mean that name isn't reachable as a
// vendor subdomain at all.
// Exported so generateUniqueStoreSlug (apps/dashboard/src/app/api/stores/
// route.js) can skip these too -- a store's DEFAULT public subdomain is its
// store_slug (transformStore falls back to it whenever no custom
// websitePath is set), so the very same reserved words need blocking right
// where that slug is first generated, not just on the separate opt-in
// custom-address path this file was originally written for.
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'mail', 'admin', 'support', 'help', 'status',
  'cdn', 'assets', 'blog', 'docs', 'storage'
]);

// Same DNS-label shape check workers/subdomain-router's Cloudflare Worker
// and apps/store/src/proxy.js both use -- a website address is a literal
// subdomain now, not just a URL path segment, so it has to be valid
// wherever DNS is involved, not just wherever a browser is involved.
const VALID_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeWebsitePath(raw) {
  return (raw || '').trim().toLowerCase();
}

// Returns a user-facing error string, or null if the shape is fine.
// Doesn't check availability -- that's a separate (async, DB-hitting)
// step, kept apart so a pure shape check can run on every keystroke
// without hitting the database each time.
export function getWebsitePathShapeError(path) {
  if (!path) return 'Website address is required';
  if (path.length > 63) return 'Must be 63 characters or fewer';
  if (RESERVED_SUBDOMAINS.has(path)) return 'This address is reserved and can\'t be used';
  if (!VALID_LABEL.test(path)) return 'Use only lowercase letters, numbers and hyphens (not at the start or end)';
  return null;
}

// True if some OTHER active store already has this as their store_slug or
// their own custom websitePath -- excludeStoreId lets a store re-save its
// own current value (whichever field it's currently resolved from)
// without tripping over itself.
export async function isWebsitePathTaken(path, { excludeStoreId } = {}) {
  const { data: bySlug, error: slugError } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('store_slug', path)
    .eq('is_active', true)
    .maybeSingle();

  if (slugError) {
    console.error('Error checking website path against store_slug:', slugError);
    throw new Error('Failed to check website address availability');
  }
  if (bySlug && bySlug.id !== excludeStoreId) return true;

  const { data: byPath, error: pathError } = await supabaseAdmin
    .from('stores')
    .select('id')
    .contains('website', { websitePath: path })
    .eq('is_active', true)
    .maybeSingle();

  if (pathError) {
    console.error('Error checking website path against websitePath:', pathError);
    throw new Error('Failed to check website address availability');
  }
  if (byPath && byPath.id !== excludeStoreId) return true;

  return false;
}
