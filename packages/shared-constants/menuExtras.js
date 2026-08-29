// Single source of truth for menu-item "extras" (Restaurant Mode add-ons
// like "Extra sausage") -- their definitions (name/price/maxQuantity), how
// a shopper's or cashier's selection is validated and priced against those
// definitions, and how two modifier selections are compared for cart-line
// identity. Shared between apps/store (storefront cart) and apps/dashboard
// (POS) so both apps price and validate extras identically instead of
// maintaining separate copies that could silently drift.
//
// Extras used to be a plain array of strings with no price and no limit --
// legacy data in that shape is normalized here as {price: 0, maxQuantity: 1}
// so nothing breaks for items nobody has re-saved since this change.

export function normalizeExtraDefinition(extra) {
  if (typeof extra === 'string') {
    return { name: extra, price: 0, maxQuantity: 1 };
  }
  const name = typeof extra?.name === 'string' ? extra.name.trim() : '';
  const price = Math.max(0, Number(extra?.price) || 0);
  const maxQuantityRaw = extra?.maxQuantity;
  const maxQuantity = maxQuantityRaw === undefined || maxQuantityRaw === null
    ? 1
    : Math.max(0, Math.floor(Number(maxQuantityRaw) || 0));
  return { name, price, maxQuantity };
}

// Dedupes by name, last one wins -- matches the existing dedup-by-string
// convention for extras/allergens/cuisineType elsewhere in the dashboard.
export function normalizeExtraDefinitions(extras) {
  if (!Array.isArray(extras)) return [];
  const byName = new Map();
  for (const extra of extras) {
    const normalized = normalizeExtraDefinition(extra);
    if (!normalized.name) continue;
    byName.set(normalized.name, normalized);
  }
  return [...byName.values()];
}

// Resolves a customer/cashier's requested extras ({name, quantity}[]) against
// the product's own real extras definitions. Price is ALWAYS taken from
// `definitions`, never from `requestedExtras` -- the client only ever gets
// to say which extras and how many, never what they cost, the same trust
// boundary this codebase already applies to batch/variant pricing.
//
// Returns { unitCost, snapshot, errors }:
// - unitCost: total added price for ONE unit of the product (multiply by
//   the cart line's quantity for the line's full extras contribution).
// - snapshot: [{name, price, quantity}] with server-resolved price, locked
//   in at selection time -- this is what gets persisted in modifiers.extras,
//   so a later price/limit change never retroactively rewrites past orders.
// - errors: human-readable strings for any requested extra that doesn't
//   exist or exceeds its maxQuantity, to surface as a 400/rejection.
export function resolveExtrasSelection(definitions, requestedExtras) {
  const defsByName = new Map(normalizeExtraDefinitions(definitions).map(d => [d.name, d]));

  // Dedupe-and-sum by name BEFORE checking maxQuantity, so a client can't
  // split one large request (e.g. {Sausage: 5}) into several smaller ones
  // to slip under a limit the sum would violate.
  const requestedByName = new Map();
  for (const req of (Array.isArray(requestedExtras) ? requestedExtras : [])) {
    const name = typeof req?.name === 'string' ? req.name.trim() : '';
    const quantity = Math.floor(Number(req?.quantity) || 0);
    if (!name || quantity <= 0) continue;
    requestedByName.set(name, (requestedByName.get(name) || 0) + quantity);
  }

  const errors = [];
  const snapshot = [];
  let unitCost = 0;

  for (const [name, quantity] of requestedByName) {
    const def = defsByName.get(name);
    if (!def || def.maxQuantity <= 0) {
      errors.push(`"${name}" is not a valid extra for this item`);
      continue;
    }
    if (quantity > def.maxQuantity) {
      errors.push(`Only up to ${def.maxQuantity} ${name} allowed per item`);
      continue;
    }
    snapshot.push({ name, price: def.price, quantity });
    unitCost += def.price * quantity;
  }

  return { unitCost, snapshot, errors };
}

// Normalizes a {extras, note} modifiers payload for equality comparison --
// order of extras and incidental whitespace in the note shouldn't create a
// "different" line item. Collapses an empty/no-op selection to null so it
// compares equal to a cart item that never had modifiers at all. `extras`
// is quantity-aware: compares as sorted {name, quantity} pairs (price is
// deliberately excluded -- a repriced extra shouldn't split an otherwise
// identical line, same as base sellingPrice already isn't part of identity).
export function normalizeModifiers(modifiers) {
  if (!modifiers) return null;
  const extras = Array.isArray(modifiers.extras)
    ? modifiers.extras
        .map(e => (typeof e === 'string'
          ? { name: e, price: 0, quantity: 1 }
          : { name: e?.name, price: Number(e?.price) || 0, quantity: Number(e?.quantity) || 0 }))
        .filter(e => e.name && e.quantity > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const note = (modifiers.note || '').trim();
  if (extras.length === 0 && !note) return null;
  return { extras, note };
}

export function modifiersEqual(a, b) {
  const na = normalizeModifiers(a);
  const nb = normalizeModifiers(b);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  if (na.note !== nb.note) return false;
  if (na.extras.length !== nb.extras.length) return false;
  return na.extras.every((extra, i) => extra.name === nb.extras[i].name && extra.quantity === nb.extras[i].quantity);
}
