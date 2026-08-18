// Single source of truth for Nigeria's 36 states + FCT, shared between
// apps/dashboard and apps/store. Previously duplicated independently in
// AddPhysicalStoreModal.js, CreateStoreModal.js, dashboard/store/page.js,
// and store/OrderModal.js -- those now import from here instead.
//
// STATE_TO_ZONE mirrors fn_ng_state_zone() in
// apps/dashboard/supabase/migrations/20260818000004_vendor_state_and_zone.sql
// byte-for-byte on the `value` strings (e.g. 'FCT', not 'Federal Capital
// Territory'). If a state is ever added/renamed here, update that SQL
// function too -- there is no single shared source across JS and SQL.
export const NIGERIAN_STATES = [
  { value: 'Abia', label: 'Abia' },
  { value: 'Adamawa', label: 'Adamawa' },
  { value: 'Akwa Ibom', label: 'Akwa Ibom' },
  { value: 'Anambra', label: 'Anambra' },
  { value: 'Bauchi', label: 'Bauchi' },
  { value: 'Bayelsa', label: 'Bayelsa' },
  { value: 'Benue', label: 'Benue' },
  { value: 'Borno', label: 'Borno' },
  { value: 'Cross River', label: 'Cross River' },
  { value: 'Delta', label: 'Delta' },
  { value: 'Ebonyi', label: 'Ebonyi' },
  { value: 'Edo', label: 'Edo' },
  { value: 'Ekiti', label: 'Ekiti' },
  { value: 'Enugu', label: 'Enugu' },
  { value: 'FCT', label: 'Federal Capital Territory' },
  { value: 'Gombe', label: 'Gombe' },
  { value: 'Imo', label: 'Imo' },
  { value: 'Jigawa', label: 'Jigawa' },
  { value: 'Kaduna', label: 'Kaduna' },
  { value: 'Kano', label: 'Kano' },
  { value: 'Katsina', label: 'Katsina' },
  { value: 'Kebbi', label: 'Kebbi' },
  { value: 'Kogi', label: 'Kogi' },
  { value: 'Kwara', label: 'Kwara' },
  { value: 'Lagos', label: 'Lagos' },
  { value: 'Nasarawa', label: 'Nasarawa' },
  { value: 'Niger', label: 'Niger' },
  { value: 'Ogun', label: 'Ogun' },
  { value: 'Ondo', label: 'Ondo' },
  { value: 'Osun', label: 'Osun' },
  { value: 'Oyo', label: 'Oyo' },
  { value: 'Plateau', label: 'Plateau' },
  { value: 'Rivers', label: 'Rivers' },
  { value: 'Sokoto', label: 'Sokoto' },
  { value: 'Taraba', label: 'Taraba' },
  { value: 'Yobe', label: 'Yobe' },
  { value: 'Zamfara', label: 'Zamfara' }
];

export const NG_ZONES = [
  'North Central',
  'North East',
  'North West',
  'South East',
  'South South',
  'South West'
];

export const STATE_TO_ZONE = {
  Benue: 'North Central',
  Kogi: 'North Central',
  Kwara: 'North Central',
  Nasarawa: 'North Central',
  Niger: 'North Central',
  Plateau: 'North Central',
  FCT: 'North Central',

  Adamawa: 'North East',
  Bauchi: 'North East',
  Borno: 'North East',
  Gombe: 'North East',
  Taraba: 'North East',
  Yobe: 'North East',

  Jigawa: 'North West',
  Kaduna: 'North West',
  Kano: 'North West',
  Katsina: 'North West',
  Kebbi: 'North West',
  Sokoto: 'North West',
  Zamfara: 'North West',

  Abia: 'South East',
  Anambra: 'South East',
  Ebonyi: 'South East',
  Enugu: 'South East',
  Imo: 'South East',

  'Akwa Ibom': 'South South',
  Bayelsa: 'South South',
  'Cross River': 'South South',
  Delta: 'South South',
  Edo: 'South South',
  Rivers: 'South South',

  Ekiti: 'South West',
  Lagos: 'South West',
  Ogun: 'South West',
  Ondo: 'South West',
  Osun: 'South West',
  Oyo: 'South West'
};

export function isValidNigerianState(value) {
  return NIGERIAN_STATES.some((s) => s.value === value);
}
