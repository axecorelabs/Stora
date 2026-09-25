// Bulk-seeds unclaimed listings from OpenStreetMap (ODbL-licensed, safe to
// store persistently with attribution -- unlike scraping a competitor
// directory, or the Google Places API, whose terms forbid persistently
// storing anything but place_id/short-lived coordinates). Queries the
// public Overpass API (no .osm.pbf parsing -- every Node pbf parser found
// is 6-10 years unmaintained) scoped to ONE Nigerian state at a time, so
// staff control rollout pace and can sanity-check a state before moving
// to the next. Safe to re-run for the same state: stores.external_source/
// external_id (20260930000005_stores_external_source.sql) makes every
// insert idempotent -- and, for a row still claim_status='unclaimed', a
// re-run REFRESHES it from the latest OSM data (picks up new tags, or a
// script improvement like this file's own email/platform_mode fields)
// rather than just skipping. A row that's been claimed is never touched
// again, regardless of what OSM or this script now says.
//
// Usage: node --env-file=.env.local scripts/import-osm-businesses.mjs --state=Lagos [--dry-run]
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

const { supabaseAdmin } = await import("../src/lib/supabase.js");
const { generateUniqueStoreSlug } = await import("../src/lib/storeSlug.js");
const { NIGERIAN_STATES } = await import("@stora/shared-constants");

const stateArg = process.argv.find((a) => a.startsWith("--state="))?.split("=")[1];
const DRY_RUN = process.argv.includes("--dry-run");

if (!stateArg || !NIGERIAN_STATES.some((s) => s.value === stateArg)) {
  console.error(`Usage: node --env-file=.env.local scripts/import-osm-businesses.mjs --state=<one of: ${NIGERIAN_STATES.map((s) => s.value).join(", ")}> [--dry-run]`);
  process.exit(1);
}

const BATCH_SIZE = 50;
const DELAY_MS = 200;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
// Overpass blocks/406s requests with no identifying User-Agent -- confirmed
// live during planning.
const USER_AGENT = "StoraBusinessImporter/1.0 (unclaimed-listing seeding)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Restaurant/eat-in amenities vs. everything else -- kept as an explicit
// list rather than a broad amenity=* match, since amenity=* alone pulls
// in a huge amount of non-business infrastructure (schools, toilets,
// benches, etc.) that isn't a "business" in any sense relevant here.
const RESTAURANT_AMENITIES = ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court"];
const SERVICE_AMENITIES = ["pharmacy", "bank", "clinic", "hospital", "dentist", "veterinary"];
const SERVICE_TOURISM = ["hotel", "guest_house"];

// NIGERIAN_STATES' `value` is the short/official label Stora uses
// everywhere else (state column, UI) -- OSM's own admin_level=4 boundary
// relation is tagged with the full name for a few of these. Confirmed
// live: querying area["name"="FCT"] returns zero results; the real
// boundary is named "Federal Capital Territory" (ISO3166-2: NG-FC).
const OSM_AREA_NAME_OVERRIDES = {
  FCT: "Federal Capital Territory"
};

function buildOverpassQuery(state) {
  const areaName = OSM_AREA_NAME_OVERRIDES[state] || state;
  const amenityList = [...RESTAURANT_AMENITIES, ...SERVICE_AMENITIES].join("|");
  const tourismList = SERVICE_TOURISM.join("|");
  return `
[out:json][timeout:120];
area["name"="${areaName}"]["admin_level"="4"]["boundary"="administrative"]->.searchArea;
(
  node["shop"]["name"](area.searchArea);
  node["amenity"~"^(${amenityList})$"]["name"](area.searchArea);
  node["office"]["name"](area.searchArea);
  node["craft"]["name"](area.searchArea);
  node["healthcare"]["name"](area.searchArea);
  node["tourism"~"^(${tourismList})$"]["name"](area.searchArea);
  way["shop"]["name"](area.searchArea);
  way["amenity"~"^(${amenityList})$"]["name"](area.searchArea);
);
out center;
`.trim();
}

// Best-guess default, corrected once the eventual claimant edits their own
// listing -- same "seeded data is a starting point, not gospel" posture
// Part B's manually-created stubs already have.
function mapCategory(tags) {
  if (tags.shop) return "retail";
  if (tags.amenity && RESTAURANT_AMENITIES.includes(tags.amenity)) return "restaurant";
  if (tags.amenity && SERVICE_AMENITIES.includes(tags.amenity)) return "services";
  if (tags.office || tags.craft || tags.healthcare) return "services";
  if (tags.tourism && SERVICE_TOURISM.includes(tags.tourism)) return "services";
  return "other";
}

// OSM's own free-text description tag exists but is genuinely rare
// (confirmed live: ~1 in 20 elements in a real sample) -- not something
// worth relying on alone. When absent, generate a short, real one from
// data every element DOES have: the specific raw tag value (finer-grained
// than our own broad business_category -- "supermarket"/"hairdresser"/
// "fast_food", not just "retail"/"services") plus city/state. Beats a
// single hardcoded string repeated across every unbranded card -- still
// a placeholder, corrected once the eventual claimant writes their own,
// same as every other seeded field.
function prettifyTagValue(value) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function buildDescription(tags, city, state) {
  if (tags.description?.trim()) {
    const text = tags.description.trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  const kind = tags.shop || tags.amenity || tags.office || tags.craft || tags.healthcare || tags.tourism;
  const location = [city, state].filter(Boolean).join(", ");
  if (!kind) return location ? `A business in ${location}.` : null;

  return location ? `${prettifyTagValue(kind)} in ${location}.` : `${prettifyTagValue(kind)}.`;
}

// GNS (US NGA GEOnet Names Server) bulk-imported thousands of geographic
// features -- shoals, sandbanks, ridges -- into OSM years ago, some
// mistagged with office=company/etc. Confirmed live during planning:
// several Lagos "office=company" nodes are actually named sandbanks. Any
// GNS-sourced tag is a strong signal this isn't a real, locally-mapped
// business, regardless of what category tag it happens to carry.
function isGnsJunk(tags) {
  if (tags.source === "GNS") return true;
  return Object.keys(tags).some((key) => key.startsWith("GNS:"));
}

// stores.store_phone is VARCHAR(20) -- confirmed live that OSM's phone tag
// regularly exceeds that (multiple numbers separated by ;/,, or a longer
// international format), which silently dropped otherwise-good businesses
// (e.g. "Commodore Hotel") on insert. Take the first number only and
// truncate as a last-resort safety net -- a possibly-truncated phone is
// still better than losing the whole listing over it, and the claimant
// corrects it same as every other seeded field.
function normalizePhone(raw) {
  if (!raw) return null;
  const first = raw.split(/[;,/]/)[0].trim();
  return first ? first.slice(0, 20) : null;
}

// Nodes carry lat/lon directly; ways/relations only get one because the
// query uses `out center;`, which adds a synthesized `center` object
// instead. Real, free coordinates OSM already computed -- no geocoding
// needed, just reading what's already in the response we were discarding.
function getCoordinates(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { latitude: el.lat, longitude: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { latitude: el.center.lat, longitude: el.center.lon };
  }
  return { latitude: null, longitude: null };
}

function buildAddress(tags) {
  const address = {};
  if (tags["addr:street"]) address.street = tags["addr:street"];
  if (tags["addr:city"]) address.city = tags["addr:city"];
  return address;
}

async function fetchOverpassElements(state) {
  const query = buildOverpassQuery(state);
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`
  });
  if (!response.ok) {
    throw new Error(`Overpass request failed: HTTP ${response.status}`);
  }
  const json = await response.json();
  return json.elements || [];
}

async function run() {
  console.log(`Fetching OSM business POIs for ${stateArg}${DRY_RUN ? " (dry run)" : ""}...`);
  const elements = await fetchOverpassElements(stateArg);
  console.log(`Overpass returned ${elements.length} raw elements`);

  const counts = { inserted: 0, updated: 0, skippedClaimed: 0, skippedNoName: 0, skippedGnsJunk: 0, byCategory: {} };
  const sample = [];
  const toInsert = [];

  for (const el of elements) {
    const name = el.tags?.name?.trim();
    if (!name) {
      counts.skippedNoName += 1;
      continue;
    }
    if (isGnsJunk(el.tags)) {
      counts.skippedGnsJunk += 1;
      continue;
    }

    const externalId = `${el.type}/${el.id}`;
    const category = mapCategory(el.tags);
    counts.byCategory[category] = (counts.byCategory[category] || 0) + 1;
    if (sample.length < 15) sample.push(`${name} [${category}]`);

    const address = buildAddress(el.tags);
    toInsert.push({
      externalId,
      storeName: name,
      businessCategory: category,
      storePhone: normalizePhone(el.tags.phone || el.tags["contact:phone"]),
      storeEmail: el.tags.email || el.tags["contact:email"] || null,
      address,
      storeDescription: buildDescription(el.tags, address.city, stateArg),
      ...getCoordinates(el)
    });
  }

  if (DRY_RUN) {
    console.log("\n--- DRY RUN: nothing written ---");
    console.log("Counts:", JSON.stringify(counts, null, 2));
    console.log("Sample:", sample.join(", "));
    return;
  }

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);

    const externalIds = batch.map((b) => b.externalId);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("stores")
      .select("id, external_id, claim_status")
      .eq("external_source", "osm")
      .in("external_id", externalIds);
    if (existingError) throw existingError;
    const existingById = new Map((existing || []).map((r) => [r.external_id, r]));

    for (const item of batch) {
      const existingRow = existingById.get(item.externalId);

      if (existingRow) {
        if (existingRow.claim_status !== "unclaimed") {
          counts.skippedClaimed += 1;
          continue;
        }
        // Still unclaimed -- safe to refresh from the latest OSM data.
        const { error: updateError } = await supabaseAdmin
          .from("stores")
          .update({
            store_phone: item.storePhone,
            store_email: item.storeEmail,
            address: item.address,
            store_description: item.storeDescription,
            business_category: item.businessCategory,
            platform_mode: "listing",
            website: { status: "active", isEnabled: true },
            latitude: item.latitude,
            longitude: item.longitude
          })
          .eq("id", existingRow.id);
        if (updateError) {
          console.error(`Failed to refresh "${item.storeName}" (${item.externalId}):`, updateError.message);
          continue;
        }
        counts.updated += 1;
        continue;
      }

      const storeSlug = await generateUniqueStoreSlug(item.storeName);
      const { error: insertError } = await supabaseAdmin.from("stores").insert({
        owner_id: null,
        claim_status: "unclaimed",
        claimed_at: null,
        store_name: item.storeName,
        store_slug: storeSlug,
        store_phone: item.storePhone,
        store_email: item.storeEmail,
        state: stateArg,
        address: item.address,
        store_description: item.storeDescription,
        business_category: item.businessCategory,
        platform_mode: "listing",
        is_active: true,
        website: { status: "active", isEnabled: true },
        external_source: "osm",
        external_id: item.externalId,
        latitude: item.latitude,
        longitude: item.longitude
      });
      if (insertError) {
        console.error(`Failed to insert "${item.storeName}" (${item.externalId}):`, insertError.message);
        continue;
      }
      counts.inserted += 1;
    }

    await sleep(DELAY_MS);
    console.log(`Processed ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length}...`);
  }

  console.log("\n--- Done ---");
  console.log("Counts:", JSON.stringify(counts, null, 2));
}

run().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});
