import { supabaseAdmin } from './supabase';

// Reshape the normalized services/service_items/service_availability/
// service_locations/service_addons tables back into the nested
// { storeId, services: [{...item, availability, serviceLocations, addOns}] }
// shape the dashboard UI expects, matching the old Mongo embedded-document shape.
export async function loadServiceDocument(storeId) {
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle();

  if (!service) return null;

  const { data: items } = await supabaseAdmin
    .from('service_items')
    .select('*')
    .eq('service_id', service.id)
    .order('created_at', { ascending: true });

  const itemIds = (items || []).map(i => i.id);
  let availabilityByItem = {};
  let locationsByItem = {};
  let addonsByItem = {};

  if (itemIds.length > 0) {
    const [{ data: availability }, { data: locations }, { data: addons }] = await Promise.all([
      supabaseAdmin.from('service_availability').select('*').in('service_item_id', itemIds),
      supabaseAdmin.from('service_locations').select('*').in('service_item_id', itemIds),
      supabaseAdmin.from('service_addons').select('*').in('service_item_id', itemIds)
    ]);
    (availability || []).forEach(a => {
      (availabilityByItem[a.service_item_id] ||= []).push({
        day: a.day_of_week, isAvailable: a.is_available, openingTime: a.opening_time, closingTime: a.closing_time
      });
    });
    (locations || []).forEach(l => {
      if (!locationsByItem[l.service_item_id]) {
        locationsByItem[l.service_item_id] = { coverAllNigeria: false, states: [] };
      }
      if (l.cover_all_nigeria) locationsByItem[l.service_item_id].coverAllNigeria = true;
      if (l.state) {
        locationsByItem[l.service_item_id].states.push({
          state: l.state, coverAllCities: l.cover_all_cities, cities: l.cities || []
        });
      }
    });
    (addons || []).forEach(a => {
      (addonsByItem[a.service_item_id] ||= []).push({ name: a.name, price: a.price });
    });
  }

  return {
    _id: service.id,
    storeId: service.store_id,
    services: (items || []).map(item => ({
      _id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      subCategory: item.sub_category,
      price: item.price,
      duration: item.duration,
      durationUnit: item.duration_unit,
      yearsOfExperience: item.years_of_experience,
      homeServiceAvailable: item.home_service_available,
      discount: item.discount,
      timeSlotDuration: item.time_slot_duration,
      maxBookingsPerDay: item.max_bookings_per_day,
      portfolioImages: item.portfolio_images || [],
      isActive: item.is_active,
      availability: availabilityByItem[item.id] || [],
      serviceLocations: locationsByItem[item.id] || { coverAllNigeria: false, states: [] },
      addOns: addonsByItem[item.id] || []
    }))
  };
}
