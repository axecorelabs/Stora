// Maps a raw `stores` DB row (snake_case) to the camelCase shape the
// dashboard client expects. Extracted out of api/stores/route.js so the
// claim flow (api/claims/[storeId]/verify/route.js) can hand the wizard
// the same shape CreateBusinessModal's onStoreCreated already does,
// instead of a second, drifting copy of this mapping.
export function transformStore(store) {
  if (!store) return null;

  const websiteData = typeof store.website === 'string' ? JSON.parse(store.website) : store.website;
  const websitePath = websiteData?.websitePath || store.store_slug;
  const storeBaseUrl = process.env.NEXT_PUBLIC_STORE_URL || 'https://stora.com.ng';
  const parsedAddress = typeof store.address === 'string' ? JSON.parse(store.address) : store.address;

  return {
    id: store.id,
    mongoId: store.mongo_id,
    userId: store.owner_id,
    storeName: store.store_name,
    storeSlug: store.store_slug,
    storeDescription: store.store_description,
    storeType: store.store_type,
    storePhone: store.store_phone,
    storeEmail: store.store_email,
    state: store.state,
    deliveryStates: store.delivery_states && store.delivery_states.length > 0 ? store.delivery_states : null,
    deliveryNationwide: !store.delivery_states || store.delivery_states.length === 0,
    deliveryFees: (typeof store.delivery_fees === 'string' ? JSON.parse(store.delivery_fees) : store.delivery_fees) || {},
    fulfillmentMethod: store.fulfillment_method === 'pay_on_delivery' ? 'pay_on_delivery' : 'platform_collected',
    restaurantMode: !!store.restaurant_mode,
    sellsProducts: !!store.sells_products,
    offersServices: !!store.offers_services,
    businessCategory: store.business_category || null,
    businessSubcategory: store.business_subcategory || null,
    businessSubcategories: Array.isArray(store.business_subcategories)
      ? store.business_subcategories
      : (store.business_subcategory ? [store.business_subcategory] : []),
    businessTags: Array.isArray(store.business_tags) ? store.business_tags : [],
    address: parsedAddress,
    fullAddress: parsedAddress
      ? [parsedAddress.street, parsedAddress.city, parsedAddress.state, parsedAddress.postalCode, parsedAddress.country].filter(Boolean).join(', ')
      : '',
    onlineStoreInfo: typeof store.online_store_info === 'string' ? JSON.parse(store.online_store_info) : store.online_store_info,
    branding: typeof store.branding === 'string' ? JSON.parse(store.branding) : store.branding,
    businessHours: typeof store.business_hours === 'string' ? JSON.parse(store.business_hours) : store.business_hours,
    settings: typeof store.settings === 'string' ? JSON.parse(store.settings) : store.settings,
    bankDetails: typeof store.bank_details === 'string' ? JSON.parse(store.bank_details) : store.bank_details,
    isActive: store.is_active,
    isVerified: store.is_verified,
    verificationStatus: store.verification_status,
    isPartner: !!store.is_partner,
    telegramConnected: !!store.telegram_chat_id,
    deliveryDigestEnabled: !!store.delivery_digest_enabled,
    temporarilyClosed: !!store.temporarily_closed,
    totalSales: parseFloat(store.total_sales) || 0,
    totalOrders: store.total_orders || 0,
    averageRating: parseFloat(store.average_rating) || 0,
    totalReviews: store.total_reviews || 0,
    website: websiteData,
    websitePath,
    websiteUrl: websitePath ? `https://${websitePath}.${storeBaseUrl.replace(/^https?:\/\//, '')}` : null,
    websiteFullPath: websitePath ? `${websitePath}.${storeBaseUrl.replace(/^https?:\/\//, '')}` : null,
    platformMode: store.platform_mode || 'store',
    subscriptionStatus: store.subscription_status || 'none',
    subscriptionPaystackCode: store.subscription_paystack_code || null,
    subscriptionNextPaymentDate: store.subscription_next_payment_date || null,
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };
}
