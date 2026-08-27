// Centralized list of product colors for the inventory color-tagging step
// (apps/dashboard/src/components/dashboard/Inventory/ImageUploadSection.js,
// used by AddInventoryModal, EditInventoryModal, and the standalone
// inventory/add page). Previously this list lived inline in
// ImageUploadSection.js as ~30 basic names -- moved here so it's a single,
// importable source of truth, and expanded well past "the 12 crayon
// colors" so a vendor tagging a real product (rust, sage, chestnut,
// champagne, ash blonde...) actually finds their color instead of picking
// the closest approximation.
//
// `hex` is only used to render a small swatch next to each name in the
// dropdown -- it's an indicative shade, not a brand color spec, so exact
// values aren't load-bearing.
//
// Grouped by family purely for maintainability (easy to see what's
// covered / add more of a given family later) -- consumers should treat
// this as one flat, deduplicated list via PRODUCT_COLORS.
const COLOR_GROUPS = {
  neutrals: [
    { name: 'Black', hex: '#000000' },
    { name: 'Off Black', hex: '#1A1A1A' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Off White', hex: '#F5F3EE' },
    { name: 'Ivory', hex: '#FFFFF0' },
    { name: 'Pearl White', hex: '#F8F6F0' },
    { name: 'Cream', hex: '#FFFDD0' },
    { name: 'Beige', hex: '#E8DCC8' },
    { name: 'Tan', hex: '#D2B48C' },
    { name: 'Khaki', hex: '#C3B091' },
    { name: 'Taupe', hex: '#B8A99A' },
    { name: 'Stone', hex: '#C6BDAE' },
    { name: 'Sand', hex: '#E0D0A8' },
    { name: 'Ecru', hex: '#EFE4CC' },
    { name: 'Gray', hex: '#808080' },
    { name: 'Light Gray', hex: '#D3D3D3' },
    { name: 'Dark Gray', hex: '#4A4A4A' },
    { name: 'Charcoal', hex: '#36454F' },
    { name: 'Silver', hex: '#C0C0C0' },
    { name: 'Slate Gray', hex: '#708090' },
  ],
  reds: [
    { name: 'Red', hex: '#E30613' },
    { name: 'Scarlet', hex: '#FF2400' },
    { name: 'Crimson', hex: '#DC143C' },
    { name: 'Cherry Red', hex: '#990024' },
    { name: 'Brick Red', hex: '#A6321C' },
    { name: 'Rust', hex: '#B7410E' },
    { name: 'Maroon', hex: '#800000' },
    { name: 'Burgundy', hex: '#6D071A' },
    { name: 'Wine', hex: '#722F37' },
    { name: 'Ruby', hex: '#9B111E' },
    { name: 'Cardinal Red', hex: '#C41E3A' },
  ],
  pinks: [
    { name: 'Pink', hex: '#FFC0CB' },
    { name: 'Baby Pink', hex: '#F9C6D0' },
    { name: 'Blush Pink', hex: '#F1C6C0' },
    { name: 'Dusty Pink', hex: '#D6A3A3' },
    { name: 'Hot Pink', hex: '#FF69B4' },
    { name: 'Fuchsia', hex: '#FF00FF' },
    { name: 'Magenta', hex: '#D6008C' },
    { name: 'Salmon Pink', hex: '#F79E8E' },
    { name: 'Rose', hex: '#C08081' },
    { name: 'Coral Pink', hex: '#F88379' },
    { name: 'Mauve', hex: '#B784A7' },
  ],
  oranges: [
    { name: 'Orange', hex: '#FF7A00' },
    { name: 'Burnt Orange', hex: '#CC5500' },
    { name: 'Peach', hex: '#FFDAB9' },
    { name: 'Apricot', hex: '#FBCEB1' },
    { name: 'Tangerine', hex: '#F28500' },
    { name: 'Amber', hex: '#FFBF00' },
    { name: 'Coral', hex: '#FF7F50' },
    { name: 'Terracotta', hex: '#C46A4B' },
  ],
  yellows: [
    { name: 'Yellow', hex: '#FFD400' },
    { name: 'Mustard', hex: '#D4AC0D' },
    { name: 'Gold Yellow', hex: '#F5C518' },
    { name: 'Lemon Yellow', hex: '#FFF44F' },
    { name: 'Canary Yellow', hex: '#FFEF00' },
    { name: 'Honey', hex: '#E8A317' },
    { name: 'Sunflower Yellow', hex: '#FFC512' },
  ],
  greens: [
    { name: 'Green', hex: '#2E8B47' },
    { name: 'Olive Green', hex: '#708238' },
    { name: 'Army Green', hex: '#4B5320' },
    { name: 'Forest Green', hex: '#228B22' },
    { name: 'Hunter Green', hex: '#355E3B' },
    { name: 'Emerald Green', hex: '#50C878' },
    { name: 'Mint Green', hex: '#98F5C1' },
    { name: 'Sage Green', hex: '#9CAF88' },
    { name: 'Lime Green', hex: '#8CD211' },
    { name: 'Pistachio', hex: '#93C572' },
    { name: 'Jade Green', hex: '#00A86B' },
    { name: 'Teal Green', hex: '#00827F' },
    { name: 'Sea Green', hex: '#2E8B78' },
  ],
  blues: [
    { name: 'Blue', hex: '#0057B7' },
    { name: 'Navy Blue', hex: '#0A1F44' },
    { name: 'Royal Blue', hex: '#4169E1' },
    { name: 'Sky Blue', hex: '#87CEEB' },
    { name: 'Baby Blue', hex: '#BFE3F3' },
    { name: 'Powder Blue', hex: '#B0E0E6' },
    { name: 'Cobalt Blue', hex: '#0047AB' },
    { name: 'Denim Blue', hex: '#1560BD' },
    { name: 'Steel Blue', hex: '#4682B4' },
    { name: 'Teal', hex: '#008080' },
    { name: 'Turquoise', hex: '#30D5C8' },
    { name: 'Aqua', hex: '#00C4CC' },
    { name: 'Cyan', hex: '#00B7EB' },
    { name: 'Indigo', hex: '#3F0F7C' },
    { name: 'Petrol Blue', hex: '#0F4C5C' },
  ],
  purples: [
    { name: 'Purple', hex: '#7A3EA1' },
    { name: 'Lavender', hex: '#B497D6' },
    { name: 'Lilac', hex: '#C8A2C8' },
    { name: 'Violet', hex: '#8F00FF' },
    { name: 'Plum', hex: '#673147' },
    { name: 'Orchid', hex: '#DA70D6' },
    { name: 'Amethyst', hex: '#9966CC' },
    { name: 'Grape', hex: '#6F2DA8' },
  ],
  browns: [
    { name: 'Brown', hex: '#6B3F1D' },
    { name: 'Chocolate Brown', hex: '#3D2314' },
    { name: 'Coffee Brown', hex: '#4B3621' },
    { name: 'Camel', hex: '#C19A6B' },
    { name: 'Chestnut', hex: '#8B4A2B' },
    { name: 'Mahogany', hex: '#4E2A1E' },
    { name: 'Walnut', hex: '#5C4033' },
    { name: 'Caramel', hex: '#A5691E' },
    { name: 'Cognac', hex: '#9A463D' },
    { name: 'Espresso', hex: '#2E1D14' },
  ],
  metallics: [
    { name: 'Gold', hex: '#D4AF37' },
    { name: 'Rose Gold', hex: '#B76E79' },
    { name: 'Bronze', hex: '#8C7853' },
    { name: 'Copper', hex: '#B87333' },
    { name: 'Pewter', hex: '#8E8E8C' },
    { name: 'Platinum', hex: '#E5E4E2' },
    { name: 'Gunmetal', hex: '#2A3439' },
    { name: 'Champagne', hex: '#F7E7CE' },
  ],
  // Wigs & Hair is one of the categories color tagging is offered on --
  // these are the shades a vendor listing hair actually reaches for, not
  // covered by the general palette above.
  hair: [
    { name: 'Blonde', hex: '#E8C58A' },
    { name: 'Platinum Blonde', hex: '#EDE0C8' },
    { name: 'Ash Blonde', hex: '#D8C8A8' },
    { name: 'Honey Blonde', hex: '#C9922F' },
    { name: 'Strawberry Blonde', hex: '#D7A46A' },
    { name: 'Auburn', hex: '#7A3B2E' },
    { name: 'Copper Red', hex: '#B25C2D' },
    { name: 'Dark Brown', hex: '#3B2A20' },
    { name: 'Light Brown', hex: '#8A5A34' },
    { name: 'Jet Black', hex: '#0A0A0A' },
    { name: 'Silver Grey', hex: '#C4C4C4' },
    { name: 'Salt and Pepper', hex: '#7D7A75' },
    { name: 'Ombre', hex: '#8A6A4F' },
  ],
  // Practical catch-alls that don't fit a single hue but come up constantly
  // in real listings.
  other: [
    // hex here is a full CSS `background` value, not a single color --
    // the swatch renderer uses `background`, not `background-color`, for
    // exactly this reason (see ColorDropdown/CustomDropdown).
    { name: 'Multicolor', hex: 'linear-gradient(135deg, #E30613, #FFD400, #2E8B47, #0057B7, #7A3EA1)' },
    { name: 'Clear / Transparent', hex: '#FFFFFF' },
    { name: 'Nude', hex: '#E3BC9A' },
  ],
};

export const PRODUCT_COLORS = Object.values(COLOR_GROUPS).flat();

// Quick lookup for rendering a swatch next to a color's name elsewhere
// (e.g. an already-saved product's color tag) without re-flattening
// PRODUCT_COLORS at every call site.
export const PRODUCT_COLOR_HEX = Object.fromEntries(
  PRODUCT_COLORS.map(({ name, hex }) => [name, hex])
);
