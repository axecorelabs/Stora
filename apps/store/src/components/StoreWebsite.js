"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import StoreHeader from "./store/StoreHeader";
import StoreFooter from "./store/StoreFooter";
import StoreTrustStrip from "./store/StoreTrustStrip";
import Reveal from "./ui/Reveal";
import { deriveStoreTheme } from "@/lib/storeTheme";
import ProductCard from "./store/ProductCard";
import ProductCardMobile from "./store/ProductCardMobile";
import ServicesSection from "./store/ServicesSection";
import CategoryFilterModal from "./store/CategoryFilterModal";
import PriceFilterModal from "./store/PriceFilterModal";
import AvailabilityFilterModal from "./store/AvailabilityFilterModal";
import MobileFilterDropdown from "./ui/MobileFilterDropdown";
import { 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Shirt,
  Smartphone,
  UtensilsCrossed,
  BookOpen,
  ToyBrick,
  Sparkles,
  Dumbbell,
  Gem,
  Armchair,
  Palette,
  ShoppingBag,
  Watch,
  Pill,
  PawPrint,
  Flower2,
  Car,
  Music,
  Home,
  ChefHat,
  Briefcase,
  Baby,
  Scissors,
  Package,
  Search,
  SearchX,
  X,
  MapPin,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useDeliveryState } from "@/contexts/DeliveryStateContext";
import useStoreStore from "@/stores/storeStore";
import { storeHref } from "@/lib/storeUrl";
import SignInModal from "./auth/SignInModal";
import SignUpModal from "./auth/SignUpModal";
import ForgotPasswordModal from "./auth/ForgotPasswordModal";
import LoadingOverlay from "./ui/LoadingOverlay";
import FloatingCartButton from "./ui/FloatingCartButton";
import ViewBeacon from "./analytics/ViewBeacon";
import { useProducts } from "@/hooks/useProducts";
import { attachAutoScroll } from "@/lib/autoScroll";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function StoreWebsite({ store, gallery = [] }) {
  const router = useRouter();
  
  // Replace products fetch with TanStack Query
  const { data: products = [], isLoading: loading, error } = useProducts(store.id);
  const { deliveryState } = useDeliveryState();

  const [isMobile, setIsMobile] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPrice, setSelectedPrice] = useState("all");
  const [selectedAvailability, setSelectedAvailability] = useState("all");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // Auth modal states
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const { addToCart } = useCart();

  // Set store in Zustand
  const { setStore } = useStoreStore();

  // Get branding colors from store or use defaults
  const primaryColor = store.branding?.primaryColor || "#0D9488";
  const secondaryColor = store.branding?.secondaryColor || "#F3F4F6";
  // Every derived tint/border/contrast-safe-text value the hero, trust
  // strip, and CTA below need, computed once from this vendor's own
  // accent -- see storeTheme.js for why this replaces the old
  // `${primaryColor}66` string-concat pattern.
  const theme = useMemo(() => deriveStoreTheme(primaryColor), [primaryColor]);
  const hasBanner = !!store.branding?.banner;

  // Screen size detection function
  const detectScreenSize = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // 768px is the md breakpoint in Tailwind
    }
    return false;
  };

  // Screen size detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(detectScreenSize());
    };

    // Set initial value
    setIsMobile(detectScreenSize());

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set store in Zustand when component mounts
  useEffect(() => {
    if (store) {
      setStore(store);
    }
  }, [store, setStore]);

  // Function to get category icon - NOW USING LUCIDE ICONS
  const getCategoryIcon = (category) => {
    const categoryLower = category.toLowerCase();
    const iconMap = {
      'clothing': Shirt,
      'electronics': Smartphone,
      'food': UtensilsCrossed,
      'books': BookOpen,
      'toys': ToyBrick,
      'beauty': Sparkles,
      'sports': Dumbbell,
      'jewelry': Gem,
      'furniture': Armchair,
      'art': Palette,
      'shoes': ShoppingBag,
      'bags': ShoppingBag,
      'accessories': Watch,
      'health': Pill,
      'pets': PawPrint,
      'garden': Flower2,
      'automotive': Car,
      'music': Music,
      'home': Home,
      'kitchen': ChefHat,
      'office': Briefcase,
      'baby': Baby,
      'crafts': Scissors,
      'default': Package
    };
    
    // Find matching icon or use default
    for (const [key, Icon] of Object.entries(iconMap)) {
      if (categoryLower.includes(key)) {
        return Icon;
      }
    }
    
    return iconMap.default;
  };

  // Get unique categories from products
  const categoryOptions = useMemo(() => {
    const categories = [...new Set(products.map((p) => p.category))];
    return [
      { value: "all", label: "All Categories" },
      ...categories.map((cat) => ({ value: cat, label: cat })),
    ];
  }, [products]);

  // Get unique categories with counts - NOW getCategoryIcon is defined
  const categoriesWithCounts = useMemo(() => {
    if (products.length === 0) return [];
    
    const categoryMap = {};
    products.forEach(product => {
      if (product.category) {
        if (!categoryMap[product.category]) {
          categoryMap[product.category] = {
            name: product.category,
            count: 0,
            icon: getCategoryIcon(product.category)
          };
        }
        categoryMap[product.category].count++;
      }
    });
    
    return Object.values(categoryMap);
  }, [products]);

  // Price range options
  const priceOptions = [
    { value: "all", label: "All Prices" },
    { value: "0-5000", label: "Under ₦5,000" },
    { value: "5000-20000", label: "₦5,000 - ₦20,000" },
    { value: "20000-50000", label: "₦20,000 - ₦50,000" },
    { value: "50000+", label: "Above ₦50,000" },
  ];

  // Availability options
  const availabilityOptions = [
    { value: "all", label: "All Products" },
    { value: "in-stock", label: "In Stock" },
    { value: "low-stock", label: "Low Stock" },
    { value: "out-of-stock", label: "Out of Stock" },
  ];

  // Filter products - NOW INCLUDING SEARCH
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => 
        p.productName.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Filter by price
    if (selectedPrice !== "all") {
      const [min, max] = selectedPrice.split("-").map((v) => v.replace("+", ""));
      filtered = filtered.filter((p) => {
        if (max) {
          return p.sellingPrice >= Number(min) && p.sellingPrice <= Number(max);
        } else {
          return p.sellingPrice >= Number(min);
        }
      });
    }

    // Filter by availability
    if (selectedAvailability !== "all") {
      filtered = filtered.filter((p) => {
        const isMadeToOrder = !!p.isUnlimited;
        const availableQuantity = p.availableQuantity ?? p.quantityInStock ?? 0;
        const reorderLevel = p.reorderLevel ?? 5;

        if (isMadeToOrder) {
          return selectedAvailability === "in-stock";
        }

        if (selectedAvailability === "in-stock") {
          return availableQuantity > reorderLevel;
        } else if (selectedAvailability === "low-stock") {
          return availableQuantity > 0 && availableQuantity <= reorderLevel;
        } else if (selectedAvailability === "out-of-stock") {
          return availableQuantity <= 0;
        }
        return true;
      });
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, selectedPrice, selectedAvailability]);

  const handleCategoryClick = (categoryName) => {
    // Navigate to products page with category filter
    setIsNavigating(true);
    router.push(storeHref(store.storeSlug, `/products?category=${encodeURIComponent(categoryName)}`));
  };

  // Get current filter labels
  const getCategoryLabel = () => {
    const option = categoryOptions.find(c => c.value === selectedCategory);
    return option?.label || "Category";
  };

  const getPriceLabel = () => {
    const option = priceOptions.find(p => p.value === selectedPrice);
    return option?.label || "Price";
  };

  const getAvailabilityLabel = () => {
    const option = availabilityOptions.find(a => a.value === selectedAvailability);
    return option?.label || "Availability";
  };

  // Animation refs
  const productsGridRef = useRef(null);
  const loadingRef = useRef(null);
  const emptyStateRef = useRef(null);

  // Products grid animation
  useEffect(() => {
    if (typeof window === "undefined" || loading || !productsGridRef.current) return;

    const ctx = gsap.context(() => {
      const productCards = productsGridRef.current.children;
      
      if (productCards.length === 0) return;

      // Reset any existing animations
      gsap.set(productCards, { 
        y: 30,
        opacity: 0
      });

      // Animate products in - NO STAGGER, all at once
      gsap.to(productCards, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
        delay: 0.2
      });

      // Add hover animations for desktop
      if (!isMobile) {
        Array.from(productCards).forEach((card) => {
          const handleMouseEnter = () => {
            gsap.to(card, {
              y: -5,
              scale: 1.02,
              duration: 0.3,
              ease: "power2.out"
            });
          };

          const handleMouseLeave = () => {
            gsap.to(card, {
              y: 0,
              scale: 1,
              duration: 0.3,
              ease: "power2.out"
            });
          };

          card.addEventListener('mouseenter', handleMouseEnter);
          card.addEventListener('mouseleave', handleMouseLeave);

          // Cleanup
          return () => {
            card.removeEventListener('mouseenter', handleMouseEnter);
            card.removeEventListener('mouseleave', handleMouseLeave);
          };
        });
      }

      // Scroll-triggered animations for products - simplified
      ScrollTrigger.batch(productCards, {
        onEnter: (elements) => {
          gsap.fromTo(elements,
            {
              y: 20,
              opacity: 0.8
            },
            {
              y: 0,
              opacity: 1,
              duration: 0.4,
              ease: "power2.out"
            }
          );
        },
        onLeave: (elements) => {
          gsap.to(elements, {
            opacity: 0.9,
            duration: 0.2
          });
        },
        onEnterBack: (elements) => {
          gsap.to(elements, {
            opacity: 1,
            duration: 0.2
          });
        }
      });

    }, productsGridRef);

    return () => ctx.revert();
  }, [filteredProducts, loading, isMobile]);

  // Loading animation
  useEffect(() => {
    if (typeof window === "undefined" || !loading || !loadingRef.current) return;

    const ctx = gsap.context(() => {
      // Spinner animation
      const spinner = loadingRef.current.querySelector('.loading-spinner');
      if (spinner) {
        gsap.to(spinner, {
          rotation: 360,
          duration: 1,
          repeat: -1,
          ease: "none"
        });
      }

      // Pulsing text animation
      const loadingText = loadingRef.current.querySelector('.loading-text');
      if (loadingText) {
        gsap.to(loadingText, {
          opacity: 0.5,
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      }

    }, loadingRef);

    return () => ctx.revert();
  }, [loading]);

  // Empty state animation
  useEffect(() => {
    if (typeof window === "undefined" || loading || filteredProducts.length > 0 || !emptyStateRef.current) return;

    const ctx = gsap.context(() => {
      const elements = emptyStateRef.current.children;
      
      gsap.fromTo(elements,
        {
          y: 50,
          opacity: 0,
          scale: 0.8
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: "back.out(1.7)"
        }
      );

    }, emptyStateRef);

    return () => ctx.revert();
  }, [filteredProducts, loading]);

  // Filter animation when filters change - simplified
  useEffect(() => {
    if (typeof window === "undefined" || loading) return;

    const ctx = gsap.context(() => {
      // Animate filter change - NO STAGGER
      if (productsGridRef.current) {
        const productCards = productsGridRef.current.children;
        
        if (productCards.length > 0) {
          // Quick fade out and in effect
          gsap.to(productCards, {
            opacity: 0.6,
            scale: 0.98,
            duration: 0.15,
            ease: "power2.inOut",
            onComplete: () => {
              gsap.to(productCards, {
                opacity: 1,
                scale: 1,
                duration: 0.3,
                ease: "back.out(1.7)"
              });
            }
          });
        }
      }
    }, productsGridRef);

    return () => ctx.revert();
  }, [selectedCategory, selectedPrice, selectedAvailability]);

  // Cleanup ScrollTrigger on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        ScrollTrigger.getAll().forEach(trigger => trigger.kill());
      }
    };
  }, []);

  // Limit displayed products to 8
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, 8);
  }, [filteredProducts]);

  const hasMoreProducts = filteredProducts.length > 8;
  const showLocationMap = store?.website?.settings?.locationMap !== false;
  const galleryItems = useMemo(() => {
    if (!Array.isArray(gallery)) return [];
    return gallery.filter((item) => item?.image_url);
  }, [gallery]);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(null);
  const activeGalleryItem = activeGalleryIndex === null ? null : galleryItems[activeGalleryIndex];
  const galleryTouchStartXRef = useRef(null);
  const galleryScrollRef = useRef(null);
  const galleryPausedRef = useRef(false);
  const galleryDirectionRef = useRef(1);

  const showPreviousGalleryImage = useCallback(() => {
    setActiveGalleryIndex((current) => {
      if (current === null || galleryItems.length === 0) return current;
      return (current - 1 + galleryItems.length) % galleryItems.length;
    });
  }, [galleryItems.length]);

  const showNextGalleryImage = useCallback(() => {
    setActiveGalleryIndex((current) => {
      if (current === null || galleryItems.length === 0) return current;
      return (current + 1) % galleryItems.length;
    });
  }, [galleryItems.length]);

  const closeGalleryViewer = useCallback(() => setActiveGalleryIndex(null), []);

  const pauseGalleryScroll = () => { galleryPausedRef.current = true; };
  const resumeGalleryScroll = () => { galleryPausedRef.current = false; };

  const handleGalleryTouchStart = (event) => {
    galleryTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleGalleryTouchEnd = (event) => {
    if (galleryTouchStartXRef.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? galleryTouchStartXRef.current;
    const delta = endX - galleryTouchStartXRef.current;
    galleryTouchStartXRef.current = null;

    if (Math.abs(delta) < 45) return;
    if (delta > 0) showPreviousGalleryImage();
    else showNextGalleryImage();
  };

  const storeAddressText = useMemo(() => {
    const address = store?.address;
    if (!address || typeof address !== 'object') return null;

    const parts = [address.street, address.city, address.state || store.state, address.postalCode]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean);

    return parts.length ? parts.join(', ') : null;
  }, [store?.address, store?.state]);

  const storeMapUrl = showLocationMap && storeAddressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddressText)}`
    : null;

  const storeMapEmbedUrl = showLocationMap && storeAddressText
    ? `https://maps.google.com/maps?q=${encodeURIComponent(storeAddressText)}&t=&z=14&ie=UTF8&iwloc=&output=embed`
    : null;

  useEffect(() => {
    if (galleryItems.length < 2) return () => {};
    const speed = isMobile ? 0.55 : 0.8;
    return attachAutoScroll(galleryScrollRef, galleryPausedRef, galleryDirectionRef, speed);
  }, [galleryItems.length, isMobile]);

  useEffect(() => {
    if (activeGalleryIndex === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeGalleryViewer();
      if (event.key === "ArrowLeft") showPreviousGalleryImage();
      if (event.key === "ArrowRight") showNextGalleryImage();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeGalleryIndex, closeGalleryViewer, showPreviousGalleryImage, showNextGalleryImage]);

  useEffect(() => {
    if (activeGalleryIndex === null) return;
    if (activeGalleryIndex >= galleryItems.length) setActiveGalleryIndex(null);
  }, [activeGalleryIndex, galleryItems.length]);

  // Scrolls to the products (or services) grid further down this same
  // page -- the hero's CTA doesn't navigate anywhere, since the full
  // catalog already lives right here, not on a separate "shop" page.
  const scrollToShop = () => {
    const targetId = store.sellsProducts || store.restaurantMode ? "products" : "services";
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-white relative">
      <ViewBeacon type="store" storeId={store.id} />
      <StoreHeader
        store={store}
        onSignInClick={() => setShowSignInModal(true)}
      />

      {/* Storefront hero -- a vendor's own shop window, so it leads with
          their name, their photo (real and crisp, not blurred under a
          color wash), and their own accent color, with a single clear
          action rather than a page-load of scattered facts. One
          responsive block instead of separate mobile/desktop
          implementations -- the old mobile version was a "carousel" of
          exactly one slide, dead complexity for no visual difference. */}
      <div className="relative overflow-hidden border-b" style={{ borderColor: theme.border }}>
        {hasBanner ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center scale-105"
              style={{ backgroundImage: `url(${store.branding.banner})` }}
            />
            {/* Soft-focus + accent wash over the banner -- guarantees text
                legibility against any photo (busy or not) since blur
                erases the underlying detail entirely rather than betting
                on a gradient alone. Same recipe the previous hero used,
                just carried into the bigger hero below. */}
            <div className="absolute inset-0 backdrop-blur-md" style={{ backgroundColor: `${primaryColor}66` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: theme.tintStrong }} />
        )}

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-14 sm:py-20 lg:py-28 min-h-[320px] sm:min-h-[420px] lg:min-h-[500px] flex flex-col justify-end">
          <Reveal>
            <div className="flex items-center gap-3 mb-4">
              {store.branding?.logo && (
                <img
                  src={store.branding.logo}
                  alt={store.storeName}
                  className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl object-cover bg-white border border-white/40 shadow-lg flex-shrink-0"
                />
              )}
              {/* Store names aren't unique (see CreateStoreModal's
                  name-collision warning) -- the slug is, and it's what the
                  URL/subdomain actually is, so surfacing it here gives a
                  shopper a real way to tell two same-named stores apart. */}
              <p
                className="font-mono text-[11px] tracking-[0.16em] uppercase truncate"
                style={{ color: hasBanner ? 'rgba(255,255,255,0.75)' : `${theme.ink}99` }}
              >
                @{store.storeSlug}
              </p>
            </div>

            <h1
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight max-w-2xl"
              style={{ color: hasBanner ? '#FFFFFF' : theme.ink }}
            >
              {store.storeName}
            </h1>

            {store.storeDescription && (
              <p
                className="mt-4 max-w-xl text-base sm:text-lg leading-relaxed line-clamp-2"
                style={{ color: hasBanner ? 'rgba(255,255,255,0.88)' : `${theme.ink}CC` }}
              >
                {store.storeDescription}
              </p>
            )}

            {(store.sellsProducts || store.restaurantMode || store.offersServices) && (
              <button
                onClick={scrollToShop}
                className="mt-8 inline-flex items-center px-7 py-3.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow-md hover:brightness-95 transition-all"
                style={{ backgroundColor: theme.accent, color: theme.onAccent }}
              >
                {store.restaurantMode ? 'View menu' : store.sellsProducts ? 'Shop now' : 'View services'}
              </button>
            )}
          </Reveal>
        </div>
      </div>

      <StoreTrustStrip store={store} theme={theme} />

      <main className={`max-w-7xl mx-auto px-6 lg:px-8 ${isMobile ? 'pt-6 pb-0' : 'pt-8 pb-8'} relative z-10 min-h-screen`}>
        {/* Proactive heads-up, not a hard block -- this store still takes
            the order, delivery just needs to be worked out directly (same
            spirit as store.deliveryStates elsewhere: a real list is a
            declared preference, not a platform-enforced eligibility gate).
            Only shows once the buyer's delivery state is known AND the
            vendor's declared list doesn't include it -- silent for
            nationwide vendors (deliveryStates null/empty) and silent until
            the buyer's state is known at all. */}
        {deliveryState && store.deliveryStates && store.deliveryStates.length > 0 &&
          !store.deliveryStates.includes(deliveryState) && (
          <div className="mb-6 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{store.storeName}</span> delivers to {store.deliveryStates.length > 3
                ? `${store.deliveryStates.slice(0, 3).join(', ')} +${store.deliveryStates.length - 3} more`
                : store.deliveryStates.join(', ')}, not listed for {deliveryState}. Contact the vendor to confirm before ordering.
            </p>
          </div>
        )}

        {/* Categories Section -- desktop already has search in the sticky
            header (StoreHeader.js), so this space is category browsing
            instead of a second, redundant search box. Mobile keeps the
            horizontal-scroll treatment (no room to wrap); desktop wraps
            since there's width to spare. */}
        {categoriesWithCounts.length > 1 && (
          <div className={`mb-6 ${isMobile ? '-mx-6' : ''}`}>
            <div className={`flex items-center justify-between mb-3 ${isMobile ? 'px-6' : ''}`}>
              <h3 className="text-base font-semibold text-gray-900">Shop by category</h3>
              <button
                onClick={() => {
                  setIsNavigating(true);
                  router.push(storeHref(store.storeSlug, '/products'));
                }}
                className="text-sm font-medium"
                style={{ color: primaryColor }}
              >
                See all
              </button>
            </div>

            <div className={isMobile ? 'overflow-x-auto scrollbar-hide px-6' : ''}>
              <div className={isMobile ? 'flex gap-4 pb-2' : 'flex flex-wrap gap-4'}>
                {categoriesWithCounts.map((category, index) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleCategoryClick(category.name)}
                      className={`flex flex-col items-center flex-shrink-0 transition-transform duration-200 ${
                        selectedCategory === category.name ? 'scale-105' : ''
                      }`}
                    >
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-all duration-200"
                        style={{
                          backgroundColor: selectedCategory === category.name
                            ? `${primaryColor}20`
                            : `${primaryColor}0D`,
                          border: selectedCategory === category.name
                            ? `2px solid ${primaryColor}`
                            : '1px solid transparent'
                        }}
                      >
                        <IconComponent
                          className="w-6 h-6"
                          style={{
                            color: selectedCategory === category.name
                              ? primaryColor
                              : '#6B7280'
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-medium text-center max-w-[70px] truncate"
                        style={{
                          color: selectedCategory === category.name
                            ? primaryColor
                            : '#374151'
                        }}
                      >
                        {category.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Search Bar -- mobile only; desktop's search lives in the sticky
            header instead of being duplicated here. Suppressed for a
            services-only business: it searches the (always-empty)
            products array, so showing it would just be a dead control. */}
        {isMobile && (store.sellsProducts || store.restaurantMode) && (
          <div className="mb-8 relative z-40">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${store.storeName}…`}
                className="peer w-full pl-11 pr-10 py-3.5 text-[15px] rounded-md border outline-none transition-colors placeholder:text-gray-400 focus:bg-white focus:[border-color:var(--accent)]"
                style={{ backgroundColor: theme.tintFaint, borderColor: theme.border, color: theme.ink, '--accent': theme.accent }}
              />
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-colors peer-focus:[color:var(--accent)]"
                style={{ '--accent': theme.accent }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Search Results Count */}
            {searchQuery && (
              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-sm text-gray-500">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'} for &ldquo;{searchQuery}&rdquo;
                </p>
                {filteredProducts.length > 0 && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-xs font-medium hover:underline"
                    style={{ color: theme.accent }}
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* COMMENTED OUT: Filters Bar */}
        {/* <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8 relative z-40" ref={filtersRef}>
          {isMobile && ( <div className="w-full sm:hidden relative z-50">
            <MobileFilterDropdown
              categoryOptions={categoryOptions}
              priceOptions={priceOptions}
              availabilityOptions={availabilityOptions}
              selectedCategory={selectedCategory}
              selectedPrice={selectedPrice}
              selectedAvailability={selectedAvailability}
              onCategorySelect={setSelectedCategory}
              onPriceSelect={setSelectedPrice}
              onAvailabilitySelect={setSelectedAvailability}
              onCategoryModalOpen={() => setShowCategoryModal(true)}
              onPriceModalOpen={() => setShowPriceModal(true)}
              onAvailabilityModalOpen={() => setShowAvailabilityModal(true)}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
            />
          </div>)}

          { !isMobile && ( <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:opacity-90 transition-colors flex items-center gap-2"
              style={{ backgroundColor: secondaryColor }}
            >
              {getCategoryLabel()}
              <ChevronDown className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowPriceModal(true)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:opacity-90 transition-colors flex items-center gap-2"
              style={{ backgroundColor: secondaryColor }}
            >
              {getPriceLabel()}
              <ChevronDown className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowAvailabilityModal(true)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:opacity-90 transition-colors flex items-center gap-2"
              style={{ backgroundColor: secondaryColor }}
            >
              {getAvailabilityLabel()}
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>)}
        </div> */}

        {/* Products Section -- suppressed entirely for a services-only
            business (no products, no food): its empty state ("No products
            yet") is product-specific copy that would be misleading to a
            shopper who came for a service, not a missing catalog. */}
        {(store.sellsProducts || store.restaurantMode) && (
        <div id="products" className="py-10 sm:py-14 scroll-mt-20">
          <Reveal className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-[11px] tracking-[0.16em] uppercase mb-1.5" style={{ color: theme.accent }}>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: theme.ink }}>
                {store.restaurantMode ? 'The menu' : isMobile ? 'Products' : 'Shop the collection'}
              </h3>
            </div>
            <span className="text-sm text-gray-500 tabular-nums hidden sm:inline">
              {displayedProducts.length} of {filteredProducts.length}
            </span>
          </Reveal>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-[3px] border-brand-100 border-t-brand-700 mb-4"></div>
              <p className="text-brand-800/60 text-sm">Loading products…</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-500" strokeWidth={1.5} />
              </div>
              <h4 className="font-display text-lg font-semibold text-gray-900 mb-1.5">Couldn&apos;t load products</h4>
              <p className="text-sm text-gray-500 mb-5">{error.message}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 text-white rounded-xl text-sm font-medium bg-brand-700 hover:bg-brand-800 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20" ref={emptyStateRef}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                {searchQuery ? (
                  <SearchX className="w-7 h-7 text-brand-600" strokeWidth={1.5} />
                ) : (
                  <Package className="w-7 h-7 text-brand-600" strokeWidth={1.5} />
                )}
              </div>
              <h4 className="font-display text-lg font-semibold text-gray-900 mb-1.5">
                {searchQuery ? 'No results found' : 'No products yet'}
              </h4>
              <p className="text-sm text-gray-500 mb-5">
                {searchQuery
                  ? `Nothing matched "${searchQuery}" — try a different search.`
                  : 'This store hasn’t listed anything yet. Check back soon.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-6 py-2.5 text-white rounded-xl text-sm font-medium bg-brand-700 hover:bg-brand-800 transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <div 
                className={`grid ${
                  isMobile 
                    ? 'grid-cols-2 gap-3' 
                    : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8'
                }`}
                ref={productsGridRef}
              >
                {displayedProducts.map((product) => (
                  isMobile ? (
                    <ProductCardMobile
                      key={product.id}
                      product={product}
                      primaryColor={primaryColor || "#0D9488"} // Ensure fallback
                      secondaryColor={secondaryColor || "#F3F4F6"} // Ensure fallback
                      onNavigate={() => setIsNavigating(true)}
                      onSignInRequired={() => setShowSignInModal(true)}
                    />
                  ) : (
                    <ProductCard
                      key={product.id}
                      product={product}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      onNavigate={() => setIsNavigating(true)}
                      onSignInRequired={() => setShowSignInModal(true)}
                    />
                  )
                ))}
              </div>

              {/* See All Button - Only show if there are more than 8 products */}
                <div className="flex items-center justify-center mt-12 mb-10">
                  <button
                    onClick={() => {
                      setIsNavigating(true);
                      router.push(storeHref(store.storeSlug, '/products'));
                    }}
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 mx-3 text-white rounded-xl font-semibold text-sm hover:brightness-95 transition-all shadow-sm hover:shadow-md"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>See all products</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold tabular-nums">
                      {filteredProducts.length}
                    </span>
                  </button>
                </div>
            </>
          )}
        </div>
        )}

        {store.offersServices && (
          <div id="services" className="scroll-mt-20">
            <ServicesSection store={store} isMobile={isMobile} />
          </div>
        )}

        {galleryItems.length > 0 && (
          <Reveal as="section" id="gallery" className="mt-16 scroll-mt-20 -mx-6 border-y border-gray-200 bg-white py-5 sm:mx-0 sm:rounded-2xl sm:border sm:px-6 sm:py-6">
            <div className="mb-4 flex items-center justify-between gap-3 px-4 sm:px-0">
              <div>
                <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase mb-1" style={{ color: theme.accent }}>Look inside</p>
                <h3 className="font-display text-lg font-semibold" style={{ color: theme.ink }}>Gallery</h3>
              </div>
              <span className="text-xs font-medium text-gray-500 tabular-nums">
                {galleryItems.length} photo{galleryItems.length === 1 ? "" : "s"}
              </span>
            </div>

            <div
              ref={galleryScrollRef}
              onMouseEnter={pauseGalleryScroll}
              onMouseLeave={resumeGalleryScroll}
              onTouchStart={pauseGalleryScroll}
              onTouchEnd={resumeGalleryScroll}
              className="overflow-x-auto px-4 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex w-max gap-3 sm:gap-4 pr-4 sm:pr-0">
                {galleryItems.map((item, index) => (
                  <button
                    key={item.id || `${item.image_url}-${index}`}
                    type="button"
                    onClick={() => setActiveGalleryIndex(index)}
                    className="group relative h-40 w-64 sm:h-48 sm:w-80 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-700/60"
                    aria-label={`Open gallery image ${index + 1}`}
                  >
                    <img
                      src={item.image_url}
                      alt={item.caption || `Gallery image ${index + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 via-black/20 to-transparent" />
                    {item.caption && (
                      <span className="absolute left-3 right-3 bottom-2.5 line-clamp-1 text-left text-xs font-medium text-white/90 drop-shadow-sm">
                        {item.caption}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {storeMapEmbedUrl && (
          <Reveal as="section" className="mt-16 -mx-6 rounded-none border-y border-gray-200 bg-white p-4 pb-0 sm:mx-0 sm:rounded-2xl sm:border sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase mb-1" style={{ color: theme.accent }}>Visit in person</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4.5 w-4.5" style={{ color: theme.accent }} />
                  <h3 className="font-display text-lg font-semibold" style={{ color: theme.ink }}>Location</h3>
                </div>
              </div>
              <a
                href={storeMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:brightness-95"
                style={{ borderColor: theme.border, color: theme.accent }}
              >
                Open in Maps
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mb-3 text-sm text-gray-600">{storeAddressText}</p>
            <div className="-mx-4 h-64 overflow-hidden border-y border-gray-200 bg-gray-100 sm:mx-0 sm:h-72 sm:rounded-xl sm:border">
              <iframe
                title="Store location map"
                src={storeMapEmbedUrl}
                className="block h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>
        )}
      </main>

      {activeGalleryItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90"
          onTouchStart={handleGalleryTouchStart}
          onTouchEnd={handleGalleryTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image preview"
        >
          <button type="button" aria-label="Close image preview" className="absolute inset-0 cursor-default" onClick={closeGalleryViewer} />
          <div className="relative z-10 w-full max-w-6xl px-4">
            <button
              type="button"
              aria-label="Close image preview"
              onClick={closeGalleryViewer}
              className="absolute right-6 top-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-black shadow-lg"
            >
              <X className="h-6 w-6" />
            </button>

            {galleryItems.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={showPreviousGalleryImage}
                  className="absolute left-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-lg sm:left-6 sm:h-12 sm:w-12"
                >
                  <ChevronLeft className="h-5 w-5 stroke-[2.6] sm:h-6 sm:w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={showNextGalleryImage}
                  className="absolute right-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-lg sm:right-6 sm:h-12 sm:w-12"
                >
                  <ChevronRight className="h-5 w-5 stroke-[2.6] sm:h-6 sm:w-6" />
                </button>
              </>
            )}

            <div className="relative h-[82vh] w-full">
              <img
                src={activeGalleryItem.image_url}
                alt={activeGalleryItem.caption || `Gallery image ${(activeGalleryIndex || 0) + 1}`}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="mx-auto mt-4 max-w-3xl text-center text-sm font-medium text-white/80">
              {activeGalleryItem.caption || `${(activeGalleryIndex || 0) + 1} of ${galleryItems.length}`}
            </div>
          </div>
        </div>
      )}

      <StoreFooter />

      {/* Auth Modals */}
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

      <SignUpModal
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        onSwitchToSignIn={() => {
          setShowSignUpModal(false);
          setShowSignInModal(true);
        }}
      />

      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onBackToSignIn={() => {
          setShowForgotPasswordModal(false);
          setShowSignInModal(true);
        }}
      />

      {/* Filter Modals - Outside main to avoid z-index stacking context issues */}
      {/* Debug: Modal States */}
      {/* <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg text-xs z-[10000] border border-gray-300">
        <div className="font-bold mb-2">🐛 Modal Debug</div>
        <div>Category: {showCategoryModal ? '✅ OPEN' : '❌ CLOSED'}</div>
        <div>Price: {showPriceModal ? '✅ OPEN' : '❌ CLOSED'}</div>
        <div>Availability: {showAvailabilityModal ? '✅ OPEN' : '❌ CLOSED'}</div>
      </div> */}

      <CategoryFilterModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categoryOptions}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <PriceFilterModal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        priceRanges={priceOptions}
        selectedPrice={selectedPrice}
        onSelect={setSelectedPrice}
      />

      <AvailabilityFilterModal
        isOpen={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
        availabilityOptions={availabilityOptions}
        selectedAvailability={selectedAvailability}
        onSelect={setSelectedAvailability}
      />

      {/* Loading Overlay -- only for in-app navigation (e.g. to a product
          page); the initial product grid load already has its own inline
          spinner below, so this doesn't need to double up on it. */}
      <LoadingOverlay
        isVisible={isNavigating}
        color={primaryColor}
        message="Loading product..."
      />

      {/* Floating Cart Button */}
      <FloatingCartButton 
        onNavigate={() => setIsNavigating(true)}
        onSignInRequired={() => setShowSignInModal(true)}
      />

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
