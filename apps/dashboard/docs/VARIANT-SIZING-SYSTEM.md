# Category-Aware Variant Sizing System

## Overview

The variant system now supports **category-specific sizing inputs** to provide a better user experience and prevent NULL values in the database.

## Sizing Strategy by Category

### 🔹 Clothing
- **Input Type:** Dropdown selection
- **Sizes:** Pre-defined options
  - One Size
  - XS, S, M, L, XL, XXL, XXXL
  - Plus Size
  - Kids 2-4, Kids 5-7, Kids 8-12
- **Usage:** Users can select multiple sizes from a fixed list

### 🔹 Shoes
- **Input Type:** Free text input
- **Sizes:** Flexible formats
  - Numeric: 38, 39, 40, 41...
  - UK sizing: UK 7, UK 8...
  - US sizing: US 9, US 10...
  - Custom formats
- **Usage:** Users enter shoe sizes manually for maximum flexibility

### 🔹 Accessories
- **Input Type:** Auto-set (no user input)
- **Sizes:** "One Size" (automatic)
- **Usage:** System automatically sets all accessory variants to "One Size"
- **UI:** Size selection hidden/disabled for accessories

### 🔹 Other Categories
- **Input Type:** Standard size selection (fallback to Clothing options)
- **Sizes:** One Size, XS-XXL, Plus Size, Custom
- **Usage:** Default behavior for categories without specific sizing needs

## Implementation Details

### Frontend Changes

#### VariantManager Component
**File:** `/src/components/dashboard/Inventory/VariantManager.js`

**New Props:**
```javascript
category // Product category to determine size input type
```

**Key Features:**
- Category-aware size input rendering
- Auto "One Size" for accessories
- Dropdown for Clothing
- Text input for Shoes
- Validation to prevent empty sizes

#### Add Inventory Page
**File:** `/src/app/dashboard/inventory/add/page.js`

**Changes:**
- Passes `category` prop to VariantManager
```javascript
<VariantManager
  category={formData.category}
  // ...other props
/>
```

### Database Changes

#### Migration Script
**File:** `/scripts/add-variant-size-constraint.js`

**Purpose:**
- Prevent NULL values in variant size field
- Set default "One Size" for existing NULL sizes
- Add database validation

**What it does:**
1. Updates existing NULL sizes to "One Size"
2. Creates validation function `validate_variant_sizes()`
3. Creates trigger `check_variant_sizes` on INSERT/UPDATE
4. Enforces non-NULL constraint at database level

**Run the migration:**
```bash
node scripts/add-variant-size-constraint.js
```

## Size Modes

The system supports three size configuration modes:

### 1. One Size Fits All
- All color variants use "One Size"
- Automatically selected for Accessories
- User can manually select for other categories

### 2. Same Sizes for All Variants
- All colors have the same available sizes
- User selects sizes once, applies to all colors
- Different input methods based on category:
  - **Clothing:** Click to select multiple from dropdown
  - **Shoes:** Enter sizes via text input
  - **Accessories:** Auto "One Size"

### 3. Different Sizes per Variant
- Each color can have different available sizes
- User adds sizes individually per color
- Provides maximum flexibility
- Input method varies by category

## Validation Rules

### Frontend Validation
- Size cannot be empty string
- Size is trimmed before saving
- Duplicates prevented within same variant
- Default to "One Size" if no input provided

### Database Validation
- **Trigger:** `check_variant_sizes`
- **Function:** `validate_variant_sizes()`
- **Rule:** Rejects any variant with NULL or empty size
- **Error:** "Variant size cannot be NULL or empty. Use 'One Size' for items without size variations."

## UI/UX Improvements

### Clothing Category
```
┌─────────────────────────────────────┐
│ Select Sizes (will apply to all    │
│ color variants) *                   │
├─────────────────────────────────────┤
│ Click to select/deselect sizes     │
│                                     │
│ [One Size] [XS] [S] [M] [L] [XL]  │
│ [XXL] [XXXL] [Plus Size]           │
│ [Kids 2-4] [Kids 5-7] [Kids 8-12] │
└─────────────────────────────────────┘
```

### Shoes Category
```
┌─────────────────────────────────────┐
│ Add Sizes (will apply to all       │
│ color variants) *                   │
├─────────────────────────────────────┤
│ Enter shoe sizes (e.g., 38, 39,    │
│ UK 7, US 9)                         │
│                                     │
│ [Enter size and press Enter... ] [+]│
│                                     │
│ Added: [38] [39] [UK 7] [US 9]     │
└─────────────────────────────────────┘
```

### Accessories Category
```
┌─────────────────────────────────────┐
│ 🎨 Color Variants Detected!         │
├─────────────────────────────────────┤
│ Accessories automatically use       │
│ "One Size" for all colors           │
│                                     │
│ Detected Colors: Black, Brown, Blue │
└─────────────────────────────────────┘
```

## Testing Checklist

- [ ] **Clothing**: Create variants with dropdown size selection
- [ ] **Shoes**: Create variants with custom text sizes
- [ ] **Accessories**: Verify auto "One Size" application
- [ ] **Same Mode**: All colors get selected sizes
- [ ] **Different Mode**: Each color has unique sizes
- [ ] **One Size Mode**: All colors have "One Size"
- [ ] **Validation**: Try to save without sizes (should default to "One Size")
- [ ] **Database**: Run migration script
- [ ] **Trigger**: Verify database rejects NULL sizes

## Benefits

✅ **Better UX**: Category-appropriate input methods  
✅ **Data Integrity**: No NULL sizes in database  
✅ **Flexibility**: Shoes can use any size format  
✅ **Simplicity**: Accessories auto-handled  
✅ **Validation**: Both frontend and database level  
✅ **Consistency**: Default "One Size" fallback  

## Migration Notes

### Before Migration
- Variants may have NULL or empty sizes
- No database-level validation
- Frontend handled validation only

### After Migration
- All existing NULL sizes updated to "One Size"
- Database trigger prevents future NULL sizes
- Validation function enforces data integrity
- Safer, more reliable variant management

## Rollback (if needed)

To rollback the database changes:

```sql
-- Drop the trigger
DROP TRIGGER IF EXISTS check_variant_sizes ON inventory;

-- Drop the validation function
DROP FUNCTION IF EXISTS validate_variant_sizes();
```

Note: This only removes validation. Size values remain unchanged.
