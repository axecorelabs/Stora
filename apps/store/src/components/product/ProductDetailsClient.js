"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeExtraDefinitions } from "@stora/shared-constants";
import ExtrasSelector from "@/components/product/ExtrasSelector";
import { 
  ArrowLeft, Plus, Minus, ShoppingCart, Heart, MapPin, Tag, Package, Share2, Check, X,
  Shirt, Footprints, Watch, Droplets, UtensilsCrossed, Coffee, Smartphone, 
  BookOpen, Home, Dumbbell, Car, Sparkles, ChevronLeft, ChevronRight
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import SignInModal from "@/components/auth/SignInModal";
import SignUpModal from "@/components/auth/SignUpModal";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";
import VariantSelectionModal from "@/components/product/VariantSelectionModal";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import FloatingCartButton from "@/components/ui/FloatingCartButton";
import Toast from "@/components/ui/Toast";
import StarRating from "@/components/ui/StarRating";
import ProductReviews from "@/components/product/ProductReviews";
import ViewBeacon from "@/components/analytics/ViewBeacon";
import Image from "next/image";
import Link from "next/link";
import { NOTE_PLACEHOLDERS } from "@/components/product/notePlaceholders";

export default function ProductDetailsClient({ store, product: initialProduct, slug }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set only by entry points with no vendor in context (general /products,
  // homepage discovery, site-wide search, the cross-vendor wishlist) -- see
  // each one's own comment. Its absence (a direct link, a share, or
  // genuinely browsing this vendor's own storefront) is the correct default
  // for "back"/"continue shopping" returning to this vendor, unchanged from
  // before this existed.
  const cameFromDiscover = searchParams.get('from') === 'discover';
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  // Map of extra name -> selected quantity (only extras with quantity > 0
  // are considered "selected"), replacing a plain on/off toggle now that
  // each extra can carry its own price and be added more than once.
  const [selectedExtras, setSelectedExtras] = useState({});
  const [itemNote, setItemNote] = useState('');
  const [liked, setLiked] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [checkingWishlist, setCheckingWishlist] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const primaryColor = store?.branding?.primaryColor || '#0D9488';
  const secondaryColor = store?.branding?.secondaryColor || '#F3F4F6';
  const currency = store?.settings?.currency || 'NGN';

  // Get images array (prefer images array over single image)
  const productImages = initialProduct.images && initialProduct.images.length > 0
    ? initialProduct.images
    : initialProduct.image
    ? [{ url: initialProduct.image, isPrimary: true, colorTag: '', altText: initialProduct.productName }]
    : [];

  const currentImage = productImages[currentImageIndex] || { url: initialProduct.image };

  // Simple quantity for non-variant products
  const maxQuantity = initialProduct.availableQuantity || 0;
  const isOutOfStock = maxQuantity === 0;
  const isLowStock = maxQuantity > 0 && maxQuantity <= (initialProduct.reorderLevel || 5);
  const shouldShowStock = isLowStock || isOutOfStock;

  // Update favicon when component mounts - SIMPLIFIED APPROACH
  useEffect(() => {
    const updateFavicon = () => {
      const faviconUrl = initialProduct.image || store?.branding?.logo;
      if (!faviconUrl) return;

      try {
        // Just update existing favicon href, don't remove/add elements
        let iconLink = document.querySelector('link[rel="icon"]');
        if (iconLink) {
          iconLink.href = faviconUrl + `?v=${Date.now()}`;
        } else {
          // Only create if doesn't exist
          iconLink = document.createElement('link');
          iconLink.rel = 'icon';
          iconLink.href = faviconUrl + `?v=${Date.now()}`;
          document.head.appendChild(iconLink);
        }

        // Update apple touch icon
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon) {
          appleIcon.href = faviconUrl + `?v=${Date.now()}`;
        } else {
          appleIcon = document.createElement('link');
          appleIcon.rel = 'apple-touch-icon';
          appleIcon.href = faviconUrl + `?v=${Date.now()}`;
          document.head.appendChild(appleIcon);
        }
      } catch (error) {
        console.error('Favicon update error:', error);
      }
    };

    updateFavicon();

    // Cleanup: restore store favicon
    return () => {
      try {
        const storeFavicon = store?.branding?.logo || '/favicon.ico';
        const iconLink = document.querySelector('link[rel="icon"]');
        if (iconLink) {
          iconLink.href = storeFavicon + `?v=${Date.now()}`;
        }
      } catch (error) {
        console.error('Favicon cleanup error:', error);
      }
    };
  }, [initialProduct.image, store?.branding?.logo]);

  // Check wishlist status
  useEffect(() => {
    const checkWishlistStatus = async () => {
      if (!isAuthenticated || !initialProduct?.id) return;
      
      setCheckingWishlist(true);
      try {
        const response = await fetch('/api/wishlist', {
          credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok && data.success && data.wishlist?.items) {
          const isInWishlist = data.wishlist.items.some(item => 
            (item.product_id || item.product) === initialProduct.id
          );
          setLiked(isInWishlist);
        }
      } catch (error) {
        console.error('Error checking wishlist status:', error);
      } finally {
        setCheckingWishlist(false);
      }
    };

    checkWishlistStatus();
  }, [isAuthenticated, initialProduct?.id]);

  const formatPrice = (price) => {
    if (currency === 'NGN') {
      return `₦${price?.toLocaleString()}`;
    }
    return `$${price?.toLocaleString()}`;
  };

  // Image navigation (independent of color selection)
  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? productImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === productImages.length - 1 ? 0 : prev + 1
    );
  };

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    if (newQuantity > maxQuantity) {
      setQuantity(maxQuantity);
      return;
    }
    setQuantity(newQuantity);
  };

  // Extras + freeform note both fold into the one notes column
  // cart_items/order_items already carry (see hooks/useWishlist.js's
  // neighbor, lib/supabaseCart.js's prepareCartItemData) -- picked extras
  // read as a plain list up front, followed by whatever the shopper typed,
  // so "Extra cheese, No onions -- less spicy please" is one string a
  // vendor can just read, not a second structure they need new UI for.
  const composeItemNotes = () => {
    const parts = [];
    if (selectedExtrasList.length > 0) {
      parts.push(selectedExtrasList.map(e => `${e.quantity}x ${e.name}`).join(', '));
    }
    if (itemNote.trim()) parts.push(itemNote.trim());
    return parts.join(' -- ');
  };

  // Structured counterpart to composeItemNotes() above -- same two inputs,
  // kept queryable (findCartItem's identity check, POS, order views) instead
  // of squashed into one display string. Price is never sent here -- the
  // server resolves and locks it in against the product's own definitions
  // (supabaseCart.js's prepareCartItemData).
  const buildModifiers = () => ({
    extras: selectedExtrasList.map(e => ({ name: e.name, quantity: e.quantity })),
    note: itemNote.trim()
  });

  // Simple add to cart for non-variant products
  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      setShowSignInModal(true);
      return;
    }

    // If product has variants, show variant modal
    if (initialProduct.hasVariants) {
      setShowVariantModal(true);
      return;
    }

    // Simple product add to cart
    setIsAddingToCart(true);
    try {
      const result = await addToCart(initialProduct.id, quantity, { notes: composeItemNotes(), modifiers: buildModifiers() });
      if (result.success) {
        // Picking different extras and adding again creates a second,
        // separately-priced cart line rather than merging into this one
        // (the cart's modifiers-aware line identity already handles
        // this) -- worth a nudge here since nothing else in the UI hints
        // that "add again" is how you get e.g. one plain + one with extras.
        const addAnotherHint = extrasDefinitions.length > 0 ? ' Want it differently? Just add another.' : '';
        setToast({
          message: `${quantity} ${quantity === 1 ? 'item' : 'items'} added to cart successfully!${addAnotherHint}`,
          type: 'success'
        });
        setQuantity(1);
        setSelectedExtras({});
        setItemNote('');
      } else {
        setToast({
          message: result.error || "Failed to add item to cart",
          type: 'error'
        });
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      setToast({
        message: "Please sign in to add items to cart",
        type: 'error'
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Handle variants add to cart from modal
  const handleVariantsAddToCart = async (selectedVariants) => {
    setIsAddingToCart(true);
    try {
      // Add each variant to cart
      for (const variant of selectedVariants) {
        // Pass variant data as the third parameter (metadata)
        const result = await addToCart(
          initialProduct.id, // Use Supabase 'id' field, not MongoDB '_id'
          variant.quantity, // This is the quantity
          {
            variantId: variant.variantId,
            color: variant.color,
            size: variant.size
          }
        );
        
        if (!result.success) {
          setToast({
            message: result.error || `Failed to add ${variant.color} ${variant.size}`,
            type: 'error'
          });
          return;
        }
      }

      const totalItems = selectedVariants.reduce((sum, v) => sum + v.quantity, 0);
      setToast({
        message: `${totalItems} ${totalItems === 1 ? 'item' : 'items'} added to cart successfully!`,
        type: 'success'
      });
    } catch (error) {
      console.error("Error adding variants to cart:", error);
      setToast({
        message: "Failed to add items to cart",
        type: 'error'
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleShare = async () => {
    const productUrl = `${window.location.origin}/${slug}/product/${initialProduct.id}`; // Also fix here
    
    try {
      // Check if Web Share API is available (works on most mobile browsers)
      if (navigator.share) {
        await navigator.share({
          title: initialProduct.productName,
          text: `Check out ${initialProduct.productName} at ${store?.storeName}`,
          url: productUrl,
        });
        return;
      }
      
      // Fallback: Try clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(productUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
        return;
      }
      
      // Final fallback: Create a temporary input and copy manually
      const tempInput = document.createElement('input');
      tempInput.value = productUrl;
      tempInput.style.position = 'fixed';
      tempInput.style.opacity = '0';
      document.body.appendChild(tempInput);
      tempInput.select();
      tempInput.setSelectionRange(0, 99999); // For mobile devices
      
      const successful = document.execCommand('copy');
      document.body.removeChild(tempInput);
      
      if (successful) {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } else {
        // If all methods fail, show the URL in a prompt
        setToast({
          message: `Copy this link: ${productUrl}`,
          type: 'info'
        });
      }
    } catch (error) {
      console.error('Share failed:', error);
      // Show error toast
    //   setToast({
    //     message: 'Could not share. Please copy the URL manually.',
    //     type: 'error'
    //   });
    }
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      setShowSignInModal(true);
      return;
    }

    // Flip immediately for an instant-feeling toggle; only roll back if the
    // request actually fails, rather than making the tap wait on the round trip.
    const wasLiked = liked;
    setLiked(!wasLiked);
    setAddingToWishlist(true);
    try {
      if (wasLiked) {
        const response = await fetch(`/api/wishlist/${initialProduct.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!response.ok) setLiked(true);
      } else {
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            productId: initialProduct.id,
            priority: 'medium',
            notifications: { priceDropAlert: true, backInStockAlert: true }
          })
        });
        if (!response.ok) setLiked(false);
      }
    } catch (error) {
      setLiked(wasLiked);
      console.error('Error updating wishlist:', error);
    } finally {
      setAddingToWishlist(false);
    }
  };

  // Real definitions (price/maxQuantity), not the plain names the chips
  // used to render -- also normalizes any legacy string-only extras still
  // on older products (price 0, maxQuantity 1). A handful of extras at
  // most, so a plain recompute each render isn't worth memoizing.
  const extrasDefinitions = normalizeExtraDefinitions(initialProduct.categoryDetails?.food?.extras);

  // Server re-resolves and prices this for real at add-to-cart time
  // (supabaseCart.js's prepareCartItemData) -- this is only for the live
  // running total shown here, so a shopper never sees the total change
  // silently once the item is actually in their cart.
  const selectedExtrasList = extrasDefinitions
    .map(def => ({ ...def, quantity: selectedExtras[def.name] || 0 }))
    .filter(e => e.quantity > 0);
  const extrasUnitCost = selectedExtrasList.reduce((sum, e) => sum + e.price * e.quantity, 0);

  const totalPrice = (initialProduct.sellingPrice + extrasUnitCost) * quantity;

  // Which colors this product actually comes in -- derived here instead of
  // reading each category's own categoryDetails.<category>.colors field,
  // which the dashboard's create/edit routes never actually persist for
  // any category except Food/Beverages/Books (see
  // apps/dashboard/src/app/api/inventory/route.js). Prefers each variant's
  // own color -- the real, correctly-persisted source once a product has
  // 2+ tagged colors and hasVariants is true, same data VariantSelectionModal
  // uses to drive the actual color picker -- and falls back to the colors
  // tagged directly on the product's images, for a single-color product
  // that never became a variant set.
  const productAvailableColors = (() => {
    const variantList = Array.isArray(initialProduct.variants)
      ? initialProduct.variants
      : (initialProduct.variants && typeof initialProduct.variants === 'object')
        ? Object.values(initialProduct.variants)
        : [];
    const variantColors = [...new Set(variantList.map(v => v.color).filter(Boolean))];
    if (variantColors.length > 0) return variantColors;

    return [...new Set((initialProduct.images || []).map(img => img?.colorTag).filter(Boolean))];
  })();

  // Helper function to render category-specific details
  const renderCategoryDetails = () => {
    // Debug logging
    console.log('Product category:', initialProduct.category);
    console.log('Category details:', initialProduct.categoryDetails);
    console.log('Clothing details direct:', initialProduct.clothingDetails);
    
    const details = initialProduct.categoryDetails;
    
    // If categoryDetails doesn't exist, try to check direct properties as fallback
    if (!details || Object.keys(details).every(key => !details[key])) {
      console.log('No category details found in categoryDetails object');
      
      // Fallback: check direct properties
      if (initialProduct.clothingDetails) {
        const clothing = initialProduct.clothingDetails;
        return (
          <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
            <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shirt className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
              Clothing Specifications
            </h3>
            <div className="space-y-4">
              {clothing.gender && (
                <DetailRow label="Gender" value={clothing.gender} />
              )}
              {clothing.productType && (
                <DetailRow label="Product Type" value={clothing.productType} />
              )}
              {clothing.material && (
                <DetailRow label="Material" value={clothing.material} />
              )}
              {clothing.sizes && Array.isArray(clothing.sizes) && clothing.sizes.length > 0 && (
                <DetailRow label="Available Sizes" value={clothing.sizes.join(' • ')} />
              )}
              {productAvailableColors.length > 0 && (
                <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
              )}
              {clothing.style && Array.isArray(clothing.style) && clothing.style.length > 0 && (
                <DetailRow label="Style" value={clothing.style.join(' • ')} />
              )}
              {clothing.occasion && Array.isArray(clothing.occasion) && clothing.occasion.length > 0 && (
                <DetailRow label="Suitable For" value={clothing.occasion.join(' • ')} />
              )}
            </div>
          </div>
        );
      }
      
      // Shoes fallback
      if (initialProduct.shoesDetails) {
        const shoes = initialProduct.shoesDetails;
        return (
          <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
            <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Footprints className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
              Shoe Specifications
            </h3>
            <div className="space-y-4">
              {shoes.gender && <DetailRow label="Gender" value={shoes.gender} />}
              {shoes.shoeType && <DetailRow label="Shoe Type" value={shoes.shoeType} />}
              {shoes.material && <DetailRow label="Material" value={shoes.material} />}
              {shoes.sizes && Array.isArray(shoes.sizes) && shoes.sizes.length > 0 && (
                <DetailRow label="Available Sizes" value={shoes.sizes.join(' • ')} />
              )}
              {productAvailableColors.length > 0 && (
                <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
              )}
              {shoes.occasion && Array.isArray(shoes.occasion) && shoes.occasion.length > 0 && (
                <DetailRow label="Suitable For" value={shoes.occasion.join(' • ')} />
              )}
            </div>
          </div>
        );
      }
      
      return null;
    }

    // Clothing Details
    if (details.clothing) {
      const clothing = details.clothing;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shirt className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Clothing Specifications
          </h3>
          <div className="space-y-4">
            {clothing.gender && (
              <DetailRow label="Gender" value={clothing.gender} />
            )}
            {clothing.productType && (
              <DetailRow label="Product Type" value={clothing.productType} />
            )}
            {clothing.material && (
              <DetailRow label="Material" value={clothing.material} />
            )}
            {clothing.sizes && Array.isArray(clothing.sizes) && clothing.sizes.length > 0 && (
              <DetailRow label="Available Sizes" value={clothing.sizes.join(' • ')} />
            )}
            {productAvailableColors.length > 0 && (
              <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
            )}
            {clothing.style && Array.isArray(clothing.style) && clothing.style.length > 0 && (
              <DetailRow label="Style" value={clothing.style.join(' • ')} />
            )}
            {clothing.occasion && Array.isArray(clothing.occasion) && clothing.occasion.length > 0 && (
              <DetailRow label="Suitable For" value={clothing.occasion.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Shoes Details
    if (details.shoes) {
      const shoes = details.shoes;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Footprints className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Shoe Specifications
          </h3>
          <div className="space-y-4">
            {shoes.gender && <DetailRow label="Gender" value={shoes.gender} />}
            {shoes.shoeType && <DetailRow label="Shoe Type" value={shoes.shoeType} />}
            {shoes.material && <DetailRow label="Material" value={shoes.material} />}
            {shoes.sizes && Array.isArray(shoes.sizes) && shoes.sizes.length > 0 && (
              <DetailRow label="Available Sizes" value={shoes.sizes.join(' • ')} />
            )}
            {productAvailableColors.length > 0 && (
              <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
            )}
            {shoes.occasion && Array.isArray(shoes.occasion) && shoes.occasion.length > 0 && (
              <DetailRow label="Suitable For" value={shoes.occasion.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Accessories Details
    if (details.accessories) {
      const acc = details.accessories;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Watch className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Accessory Specifications
          </h3>
          <div className="space-y-4">
            {acc.accessoryType && <DetailRow label="Type" value={acc.accessoryType} />}
            {acc.gender && <DetailRow label="Gender" value={acc.gender} />}
            {acc.material && <DetailRow label="Material" value={acc.material} />}
            {productAvailableColors.length > 0 && (
              <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Perfume Details
    if (details.perfume) {
      const perfume = details.perfume;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Droplets className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Perfume Specifications
          </h3>
          <div className="space-y-4">
            {perfume.fragranceType && <DetailRow label="Fragrance Type" value={perfume.fragranceType} />}
            {perfume.gender && <DetailRow label="Gender" value={perfume.gender} />}
            {perfume.volume && <DetailRow label="Volume" value={perfume.volume} />}
            {perfume.scentFamily && <DetailRow label="Scent Family" value={perfume.scentFamily} />}
            {perfume.concentration && <DetailRow label="Concentration" value={perfume.concentration} />}
            {perfume.occasion && Array.isArray(perfume.occasion) && perfume.occasion.length > 0 && (
              <DetailRow label="Suitable For" value={perfume.occasion.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Food Details
    if (details.food) {
      const food = details.food;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Food Information
          </h3>
          <div className="space-y-4">
            {food.foodType && <DetailRow label="Food Type" value={food.foodType} />}
            {food.servingSize && <DetailRow label="Serving Size" value={food.servingSize} />}
            {food.spiceLevel && <DetailRow label="Spice Level" value={food.spiceLevel} />}
            {food.cuisineType && Array.isArray(food.cuisineType) && food.cuisineType.length > 0 && (
              <DetailRow label="Cuisine" value={food.cuisineType.join(' • ')} />
            )}
            {food.ingredients && Array.isArray(food.ingredients) && food.ingredients.length > 0 && (
              <DetailRow label="Ingredients" value={food.ingredients.join(', ')} />
            )}
            {food.allergens && Array.isArray(food.allergens) && food.allergens.length > 0 && (
              <DetailRow label="Allergens" value={food.allergens.join(', ')} badge="warning" />
            )}
            {food.deliveryTime && (
              <DetailRow label="Delivery Time" value={`${food.deliveryTime.value} ${food.deliveryTime.unit}`} />
            )}
            {food.maxOrdersPerDay && (
              <DetailRow label="Max Orders Per Day" value={food.maxOrdersPerDay} />
            )}
          </div>
        </div>
      );
    }

    // Beverages Details
    if (details.beverages) {
      const bev = details.beverages;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Coffee className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Beverage Specifications
          </h3>
          <div className="space-y-4">
            {bev.beverageType && <DetailRow label="Beverage Type" value={bev.beverageType} />}
            {bev.volume && <DetailRow label="Volume" value={bev.volume} />}
            {bev.packaging && <DetailRow label="Packaging" value={bev.packaging} />}
            {bev.isAlcoholic !== undefined && (
              <DetailRow label="Alcoholic" value={bev.isAlcoholic ? 'Yes' : 'No'} badge={bev.isAlcoholic ? 'warning' : 'success'} />
            )}
            {bev.alcoholContent && <DetailRow label="Alcohol Content" value={bev.alcoholContent} />}
            {bev.isCarbonated !== undefined && (
              <DetailRow label="Carbonated" value={bev.isCarbonated ? 'Yes' : 'No'} />
            )}
            {bev.flavorProfile && Array.isArray(bev.flavorProfile) && bev.flavorProfile.length > 0 && (
              <DetailRow label="Flavor Profile" value={bev.flavorProfile.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Electronics Details
    if (details.electronics) {
      const elec = details.electronics;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Electronics Specifications
          </h3>
          <div className="space-y-4">
            {elec.productType && <DetailRow label="Product Type" value={elec.productType} />}
            {elec.brand && <DetailRow label="Brand" value={elec.brand} />}
            {elec.model && <DetailRow label="Model" value={elec.model} />}
            {elec.condition && <DetailRow label="Condition" value={elec.condition} />}
            {elec.specifications?.processor && <DetailRow label="Processor" value={elec.specifications.processor} />}
            {elec.specifications?.ram && <DetailRow label="RAM" value={elec.specifications.ram} />}
            {elec.specifications?.storage && <DetailRow label="Storage" value={elec.specifications.storage} />}
            {elec.specifications?.screenSize && <DetailRow label="Screen Size" value={elec.specifications.screenSize} />}
            {elec.specifications?.batteryCapacity && <DetailRow label="Battery" value={elec.specifications.batteryCapacity} />}
            {elec.specifications?.camera && <DetailRow label="Camera" value={elec.specifications.camera} />}
            {productAvailableColors.length > 0 && (
              <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
            )}
            {elec.warranty && elec.warranty.hasWarranty && (
              <DetailRow label="Warranty" value={`${elec.warranty.duration} - ${elec.warranty.type || 'Standard'}`} badge="success" />
            )}
            {elec.connectivity && Array.isArray(elec.connectivity) && elec.connectivity.length > 0 && (
              <DetailRow label="Connectivity" value={elec.connectivity.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Books Details
    if (details.books) {
      const book = details.books;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Book Information
          </h3>
          <div className="space-y-4">
            {book.bookType && <DetailRow label="Book Type" value={book.bookType} />}
            {book.author && <DetailRow label="Author" value={book.author} />}
            {book.publisher && <DetailRow label="Publisher" value={book.publisher} />}
            {book.isbn && <DetailRow label="ISBN" value={book.isbn} />}
            {book.publicationYear && <DetailRow label="Publication Year" value={book.publicationYear} />}
            {book.language && <DetailRow label="Language" value={book.language} />}
            {book.pages && <DetailRow label="Pages" value={book.pages} />}
            {book.format && <DetailRow label="Format" value={book.format} />}
            {book.condition && <DetailRow label="Condition" value={book.condition} />}
            {book.genre && Array.isArray(book.genre) && book.genre.length > 0 && (
              <DetailRow label="Genre" value={book.genre.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Home & Garden Details
    if (details.homeGarden) {
      const home = details.homeGarden;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Home & Garden Specifications
          </h3>
          <div className="space-y-4">
            {home.productType && <DetailRow label="Product Type" value={home.productType} />}
            {home.material && <DetailRow label="Material" value={home.material} />}
            {home.room && Array.isArray(home.room) && home.room.length > 0 && (
              <DetailRow label="Suitable Room" value={home.room.join(' • ')} />
            )}
            {productAvailableColors.length > 0 && (
              <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
            )}
            {home.dimensions?.length && <DetailRow label="Length" value={home.dimensions.length} />}
            {home.dimensions?.width && <DetailRow label="Width" value={home.dimensions.width} />}
            {home.dimensions?.height && <DetailRow label="Height" value={home.dimensions.height} />}
            {home.dimensions?.weight && <DetailRow label="Weight" value={home.dimensions.weight} />}
            {home.assemblyRequired !== undefined && (
              <DetailRow label="Assembly Required" value={home.assemblyRequired ? 'Yes' : 'No'} badge={home.assemblyRequired ? 'warning' : 'success'} />
            )}
            {home.careInstructions && (
              <DetailRow label="Care Instructions" value={home.careInstructions} />
            )}
          </div>
        </div>
      );
    }

    // Sports Details
    if (details.sports) {
      const sport = details.sports;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Sports Specifications
          </h3>
          <div className="space-y-4">
            {sport.sportType && <DetailRow label="Sport Type" value={sport.sportType} />}
            {sport.productType && <DetailRow label="Product Type" value={sport.productType} />}
            {sport.brand && <DetailRow label="Brand" value={sport.brand} />}
            {sport.material && <DetailRow label="Material" value={sport.material} />}
            {sport.performanceLevel && <DetailRow label="Performance Level" value={sport.performanceLevel} />}
            {sport.sizes && Array.isArray(sport.sizes) && sport.sizes.length > 0 && (
              <DetailRow label="Available Sizes" value={sport.sizes.join(' • ')} />
            )}
            {productAvailableColors.length > 0 && (
              <DetailRow label="Available Colors" value={productAvailableColors.join(' • ')} />
            )}
            {sport.suitableFor && Array.isArray(sport.suitableFor) && sport.suitableFor.length > 0 && (
              <DetailRow label="Suitable For" value={sport.suitableFor.join(' • ')} />
            )}
          </div>
        </div>
      );
    }

    // Automotive Details
    if (details.automotive) {
      const auto = details.automotive;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Car className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Automotive Specifications
          </h3>
          <div className="space-y-4">
            {auto.productType && <DetailRow label="Product Type" value={auto.productType} />}
            {auto.brand && <DetailRow label="Brand" value={auto.brand} />}
            {auto.partNumber && <DetailRow label="Part Number" value={auto.partNumber} />}
            {auto.condition && <DetailRow label="Condition" value={auto.condition} />}
            {auto.warranty && auto.warranty.hasWarranty && (
              <DetailRow label="Warranty" value={auto.warranty.duration} badge="success" />
            )}
            {auto.compatibleVehicles && Array.isArray(auto.compatibleVehicles) && auto.compatibleVehicles.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-500">Compatible Vehicles:</p>
                <div className="flex flex-wrap gap-2">
                  {auto.compatibleVehicles.map((vehicle, idx) => (
                    <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 border border-gray-200">
                      {vehicle.make} {vehicle.model} ({vehicle.year})
                    </span>
                  ))}
                </div>
              </div>
            )}
            {auto.specifications && (
              <DetailRow label="Specifications" value={auto.specifications} />
            )}
          </div>
        </div>
      );
    }

    // Health & Beauty Details
    if (details.healthBeauty) {
      const health = details.healthBeauty;
      return (
        <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
            Health & Beauty Specifications
          </h3>
          <div className="space-y-4">
            {health.productType && <DetailRow label="Product Type" value={health.productType} />}
            {health.brand && <DetailRow label="Brand" value={health.brand} />}
            {health.volume && <DetailRow label="Volume" value={health.volume} />}
            {health.scent && <DetailRow label="Scent" value={health.scent} />}
            {health.isOrganic && <DetailRow label="Organic" value="Yes" badge="success" />}
            {health.expiryDate && (
              <DetailRow label="Expiry Date" value={new Date(health.expiryDate).toLocaleDateString()} />
            )}
            {health.skinType && Array.isArray(health.skinType) && health.skinType.length > 0 && (
              <DetailRow label="Skin Type" value={health.skinType.join(' • ')} />
            )}
            {health.suitableFor && Array.isArray(health.suitableFor) && health.suitableFor.length > 0 && (
              <DetailRow label="Suitable For" value={health.suitableFor.join(' • ')} />
            )}
            {health.applicationArea && Array.isArray(health.applicationArea) && health.applicationArea.length > 0 && (
              <DetailRow label="Application Area" value={health.applicationArea.join(' • ')} />
            )}
            {health.benefits && Array.isArray(health.benefits) && health.benefits.length > 0 && (
              <DetailRow label="Benefits" value={health.benefits.join(', ')} />
            )}
            {health.ingredients && Array.isArray(health.ingredients) && health.ingredients.length > 0 && (
              <DetailRow label="Ingredients" value={health.ingredients.join(', ')} />
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const handleImageError = () => {
    // Try to use first image from images array or fallback
    if (productImages.length > 0) {
      setCurrentImageIndex(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ViewBeacon type="product" productId={initialProduct.id} />
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setIsNavigating(true);
                router.push(cameFromDiscover ? '/products' : `/${slug}`);
              }}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group text-sm"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">
                {cameFromDiscover ? 'Back to shopping' : `Back to ${store?.storeName || 'Store'}`}
              </span>
            </button>

            {store?.branding?.logo && (
              <img
                src={store.branding.logo}
                alt={store.storeName}
                className="h-6 sm:h-8 w-auto object-contain opacity-60"
              />
            )}
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_1px_3px_rgba(11,59,46,0.06)] border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            
            {/* Image Section */}
            <div className="p-4 sm:p-8 lg:p-12 bg-gradient-to-br from-gray-50 to-white">
              <div 
                className="relative w-full aspect-square rounded-xl sm:rounded-2xl overflow-hidden shadow-lg mb-4 sm:mb-6 group"
                style={{ backgroundColor: secondaryColor }}
              >
                {currentImage?.url ? (
                  <>
                    <Image 
                      src={currentImage.url} 
                      alt={currentImage.altText || initialProduct.productName}
                      width={600}
                      height={600}
                      className="w-full h-full object-cover transition-transform duration-500"
                      onError={handleImageError}
                    />
                    
                    {/* Image Navigation Arrows */}
                    {productImages.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                        >
                          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
                        </button>
                        <button
                          onClick={handleNextImage}
                          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                        >
                          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
                        </button>
                      </>
                    )}

                    {/* Image Counter */}
                    {productImages.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
                        {currentImageIndex + 1} / {productImages.length}
                      </div>
                    )}

                    {/* Color Tag Badge (if image has color tag) */}
                    {currentImage.colorTag && (
                      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-900">
                        {currentImage.colorTag}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Package className="w-14 h-14 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-2 sm:mb-3" strokeWidth={1.5} />
                      <p className="text-gray-400 text-xs sm:text-sm">No image available</p>
                    </div>
                  </div>
                )}

                {/* Stock badges */}
                {isOutOfStock && (
                  <div className="absolute top-3 sm:top-6 left-3 sm:left-6 bg-red-600 text-white text-xs sm:text-sm font-semibold px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-sm">
                    Out of stock
                  </div>
                )}
                {isLowStock && !isOutOfStock && (
                  <div className="absolute top-3 sm:top-6 left-3 sm:left-6 bg-gold-600 text-white text-xs sm:text-sm font-semibold px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-sm">
                    Only {maxQuantity} left
                  </div>
                )}

                {/* Share and Wishlist buttons */}
                <div className="absolute top-3 sm:top-6 right-3 sm:right-6 flex gap-2">
                  <button
                    onClick={handleShare}
                    className="w-10 h-10 sm:w-14 sm:h-14 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-110 hover:bg-white transition-all"
                    title="Share product"
                  >
                    {shareSuccess ? (
                      <Check className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    ) : (
                      <Share2 className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                    )}
                  </button>

                  <button
                    onClick={handleWishlistToggle}
                    disabled={addingToWishlist || checkingWishlist}
                    className="w-10 h-10 sm:w-14 sm:h-14 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-110 hover:bg-white transition-all disabled:opacity-50"
                    title={isAuthenticated ? (liked ? "Remove from wishlist" : "Add to wishlist") : "Sign in to add to wishlist"}
                  >
                    {checkingWishlist ? (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Heart
                        className={`w-5 h-5 sm:w-6 sm:h-6 transition-all duration-200 ${liked ? 'fill-current scale-110' : ''}`}
                        style={liked ? { color: primaryColor } : { color: '#6B7280' }}
                        strokeWidth={liked ? 0 : 2}
                        fill={liked ? primaryColor : 'none'}
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Thumbnail Gallery */}
              {productImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {productImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        currentImageIndex === idx 
                          ? 'border-gray-900 scale-105 shadow-lg' 
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.altText || `${initialProduct.productName} - ${idx + 1}`}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                      {/* Color tag indicator on thumbnail */}
                      {/* {img.colorTag && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5 truncate px-1">
                          {img.colorTag}
                        </div>
                      )} */}
                    </button>
                  ))}
                </div>
              )}

              {/* Info Cards */}
              {/* <div className="flex gap-3 sm:grid sm:grid-cols-3 sm:gap-4 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0">
                {shouldShowStock && (
                  <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center hover:shadow-md transition-shadow flex-shrink-0 min-w-[100px] sm:min-w-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mx-auto mb-1 sm:mb-2" />
                    <p className="text-xs text-gray-500 mb-1">In Stock</p>
                    <p className="text-sm sm:text-lg font-bold text-gray-900">{maxQuantity}</p>
                  </div>
                )}
                <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center hover:shadow-md transition-shadow flex-shrink-0 min-w-[100px] sm:min-w-0">
                  <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-500 mb-1">Category</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{initialProduct.category}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center hover:shadow-md transition-shadow flex-shrink-0 min-w-[100px] sm:min-w-0">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-500 mb-1">Location</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{initialProduct.location || 'Store'}</p>
                </div>
              </div> */}
            </div>

            {/* Product Information */}
            <div className="p-4 sm:p-8 lg:p-12 flex flex-col">
              <div className="mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-[11px] font-medium text-gray-600 mb-3 sm:mb-4 uppercase tracking-wide">
                  <Tag className="w-3 h-3" />
                  {initialProduct.category}
                </div>

                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-gray-900 mb-2 sm:mb-3 leading-tight tracking-tight">
                  {initialProduct.productName}
                </h1>

                {initialProduct.totalReviews > 0 && (
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <StarRating rating={initialProduct.averageRating} size={14} />
                    <span className="text-xs sm:text-sm text-gray-500 tabular-nums">
                      {initialProduct.averageRating.toFixed(1)} · {initialProduct.totalReviews} review{initialProduct.totalReviews === 1 ? '' : 's'}
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                  <span>SKU: <span className="font-mono font-medium text-gray-700">{initialProduct.sku || 'N/A'}</span></span>
                  {initialProduct.brand && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span>Brand: <span className="font-medium text-gray-700">{initialProduct.brand}</span></span>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
                <p className="text-sm text-gray-500 mb-2">Price</p>
                <div className="flex items-baseline gap-3">
                  <p className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tabular-nums" style={{ color: primaryColor }}>
                    {formatPrice(initialProduct.sellingPrice)}
                  </p>
                </div>
              </div>

              {initialProduct.description && (
                <div className="mb-6 sm:mb-8">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Description</h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    {initialProduct.description}
                  </p>
                </div>
              )}

              {renderCategoryDetails()}

              {/* Quantity Selection - Only for non-variant products */}
              {!initialProduct.hasVariants && (
                <div className="mb-6 sm:mb-8">
                  <label className="text-sm font-semibold text-gray-900 mb-3 block">
                    Quantity
                  </label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => handleQuantityChange(quantity - 1)}
                        disabled={quantity <= 1 || isOutOfStock}
                        className="px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                        disabled={isOutOfStock}
                        className="w-14 sm:w-16 text-center text-base sm:text-lg font-semibold text-gray-900 bg-transparent focus:outline-none tabular-nums"
                        min="1"
                        max={maxQuantity}
                      />
                      <button
                        onClick={() => handleQuantityChange(quantity + 1)}
                        disabled={quantity >= maxQuantity || isOutOfStock}
                        className="px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    {shouldShowStock && (
                      <p className="text-sm text-gray-500">
                        <span className="font-semibold text-gray-900 tabular-nums">{maxQuantity}</span> available
                      </p>
                    )}
                    {!shouldShowStock && maxQuantity > 0 && (
                      <p className="text-sm text-brand-700 font-medium">
                        In stock
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Extras (vendor-defined quick picks, e.g. Food's "Extra cheese")
                  and a freeform note -- both fold into the one notes string
                  cart_items/order_items carry (see composeItemNotes above).
                  Only for non-variant products, same gating as Quantity above. */}
              {!initialProduct.hasVariants && (
                <div className="mb-6 sm:mb-8 space-y-4">
                  <ExtrasSelector
                    extrasDefinitions={extrasDefinitions}
                    selectedExtras={selectedExtras}
                    onChange={setSelectedExtras}
                    formatPrice={formatPrice}
                    primaryColor={primaryColor}
                  />

                  <div>
                    <label htmlFor="item-note" className="text-sm font-semibold text-gray-900 mb-2 block">
                      Note for the seller <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="item-note"
                      value={itemNote}
                      onChange={(e) => setItemNote(e.target.value)}
                      placeholder={NOTE_PLACEHOLDERS[initialProduct.category] || NOTE_PLACEHOLDERS.default}
                      rows={2}
                      maxLength={300}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-colors resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Total Price and Add to Cart */}
              {!initialProduct.hasVariants && (
                <div className="bg-brand-50/60 border border-brand-100/70 rounded-xl p-4 sm:p-5 mb-6 sm:mb-8">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-600 text-sm">Total</span>
                    <span className="text-xl sm:text-2xl font-bold text-brand-800 tabular-nums">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {quantity} {quantity === 1 ? 'item' : 'items'} × {formatPrice(initialProduct.sellingPrice + extrasUnitCost)}
                    {extrasUnitCost > 0 && ` (${formatPrice(initialProduct.sellingPrice)} + ${formatPrice(extrasUnitCost)} extras)`}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                <button
                  onClick={handleAddToCart}
                  disabled={!initialProduct.hasVariants && (isOutOfStock || isAddingToCart)}
                  className="w-full py-3.5 sm:py-4 px-6 rounded-xl text-white text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 hover:brightness-95 shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isAddingToCart ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding…
                    </>
                  ) : isOutOfStock && !initialProduct.hasVariants ? (
                    'Out of stock'
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      Add to cart
                    </>
                  )}
                </button>

                <button
                  onClick={() => router.push(cameFromDiscover ? '/products' : `/${slug}`)}
                  className="w-full py-3.5 sm:py-4 px-6 border border-gray-200 rounded-xl text-gray-700 text-base font-semibold hover:bg-gray-50 transition-colors"
                >
                  Continue shopping
                </button>
              </div>

              {/* Only shown when the visitor arrived via general browsing --
                  if they came from this vendor's own storefront, the primary
                  actions above already return there, so this would just be
                  a redundant second link. */}
              {cameFromDiscover && (
                <button
                  onClick={() => router.push(`/${slug}`)}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors mt-3 text-center sm:text-left"
                >
                  More from {store?.storeName || 'this store'} →
                </button>
              )}
            </div>
          </div>
        </div>

        {(initialProduct.supplier || initialProduct.notes) && (
          <div className="mt-6 sm:mt-8 bg-white rounded-2xl sm:rounded-3xl shadow-[0_1px_3px_rgba(11,59,46,0.06)] border border-gray-100 p-4 sm:p-8">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Additional information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {initialProduct.supplier && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Supplier</p>
                  <p className="text-gray-900 font-medium">{initialProduct.supplier}</p>
                </div>
              )}
              {initialProduct.unitOfMeasure && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Unit of Measure</p>
                  <p className="text-gray-900 font-medium">{initialProduct.unitOfMeasure}</p>
                </div>
              )}
            </div>
            {initialProduct.notes && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2">Notes</p>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{initialProduct.notes}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 sm:mt-8 bg-white rounded-2xl sm:rounded-3xl shadow-[0_1px_3px_rgba(11,59,46,0.06)] border border-gray-100 p-4 sm:p-8">
          <ProductReviews
            productId={initialProduct.id}
            averageRating={initialProduct.averageRating}
            totalReviews={initialProduct.totalReviews}
            primaryColor={primaryColor}
          />
        </div>
      </div>

      {/* Variant Selection Modal */}
      <VariantSelectionModal
        isOpen={showVariantModal}
        onClose={() => setShowVariantModal(false)}
        product={initialProduct}
        onAddToCart={handleVariantsAddToCart}
        primaryColor={primaryColor}
      />

      {/* Sign In Prompt Modal - Keep this */}
      {showSignInPrompt && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(8, 42, 32, 0.5)' }}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-gray-900">Sign in required</h3>
              <button
                onClick={() => setShowSignInPrompt(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Sign in to add items to your cart and complete your purchase.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowSignInPrompt(false);
                  setShowSignInModal(true);
                }}
                className="w-full py-3 rounded-xl text-white font-semibold transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                Sign in
              </button>
              <button
                onClick={() => setShowSignInPrompt(false)}
                className="w-full py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign In Modal */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        onSwitchToSignUp={() => {
          setShowSignInModal(false);
          setShowSignUpModal(true);
        }}
        onForgotPassword={() => {
          setShowSignInModal(false);
          setShowForgotPasswordModal(true);
        }}
      />

      {/* Sign Up Modal */}
      <SignUpModal
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        onSwitchToSignIn={() => {
          setShowSignUpModal(false);
          setShowSignInModal(true);
        }}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onBackToSignIn={() => {
          setShowForgotPasswordModal(false);
          setShowSignInModal(true);
        }}
      />

      {/* Success Toast for Share - Mobile optimized */}
      {shareSuccess && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">Link copied to clipboard!</span>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Loading Overlay for Navigation */}
      <LoadingOverlay 
        isVisible={isNavigating} 
        color={primaryColor}
        message="Loading..."
      />

      {/* Floating Cart Button */}
      <FloatingCartButton 
        onNavigate={() => setIsNavigating(true)}
        onSignInRequired={() => setShowSignInModal(true)}
      />

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// Helper component for detail rows with better typography
function DetailRow({ label, value, badge }) {
  if (!value) return null;
  
  const badgeColors = {
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200'
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2">
      <dt className="text-sm font-medium text-gray-500 sm:w-1/3 flex-shrink-0">
        {label}
      </dt>
      <dd className="text-sm sm:text-base text-gray-900 font-medium sm:w-2/3">
        {badge ? (
          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${badgeColors[badge] || badgeColors.info}`}>
            {value}
          </span>
        ) : (
          <span className="leading-relaxed">{value}</span>
        )}
      </dd>
    </div>
  );
}

// Keep the old DetailItem for backward compatibility if needed
function DetailItem({ label, value, badge }) {
  if (!value) return null;
  
  const badgeColors = {
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200'
  };

  return (
    <div>
      <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{label}</p>
      {badge ? (
        <span className={`inline-block px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium ${badgeColors[badge] || badgeColors.info}`}>
          {value}
        </span>
      ) : (
        <p className="text-sm sm:text-base text-gray-900 font-medium">{value}</p>
      )}
    </div>
  );
}
