"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import StoreHeader from "./store/StoreHeader";
import StoreFooter from "./store/StoreFooter";
import ProductCard from "./store/ProductCard";
import ProductCardMobile from "./store/ProductCardMobile";
import CategoryFilterModal from "./store/CategoryFilterModal";
import PriceFilterModal from "./store/PriceFilterModal";
import AvailabilityFilterModal from "./store/AvailabilityFilterModal";
import MobileFilterDropdown from "./ui/MobileFilterDropdown";
import { 
  ChevronDown,
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
  ShieldCheck,
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
import StarRating from "./ui/StarRating";
import ViewBeacon from "./analytics/ViewBeacon";
import { useProducts } from "@/hooks/useProducts";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function StoreWebsite({ store }) {
  const router = useRouter();
  
  // Replace products fetch with TanStack Query
  const { data: products = [], isLoading: loading, error } = useProducts(store.id);
  const { deliveryState } = useDeliveryState();

  const [isMobile, setIsMobile] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Add carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  
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
        if (selectedAvailability === "in-stock") {
          return p.quantityInStock > p.reorderLevel;
        } else if (selectedAvailability === "low-stock") {
          return p.quantityInStock > 0 && p.quantityInStock <= p.reorderLevel;
        } else if (selectedAvailability === "out-of-stock") {
          return p.quantityInStock === 0;
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
  const mainRef = useRef(null);
  const bannerRef = useRef(null);
  const filtersRef = useRef(null);
  const productsGridRef = useRef(null);
  const backgroundShapesRef = useRef(null);
  const loadingRef = useRef(null);
  const emptyStateRef = useRef(null);

  // GSAP Animation Effects
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ctx = gsap.context(() => {
      // Initial page load animation
      const tl = gsap.timeline();

      // Animate background shapes on desktop
      if (!isMobile && backgroundShapesRef.current) {
        gsap.set(backgroundShapesRef.current.children, { 
          scale: 0,
          opacity: 0 
        });
        
        gsap.to(backgroundShapesRef.current.children, {
          scale: 1,
          opacity: 1,
          duration: 2,
          stagger: 0.2,
          ease: "back.out(1.7)"
        });

        // Floating animation for background shapes
        gsap.to(backgroundShapesRef.current.children, {
          y: "random(-20, 20)",
          x: "random(-10, 10)",
          rotation: "random(-5, 5)",
          duration: "random(3, 6)",
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: {
            amount: 1,
            from: "random"
          }
        });
      }

      // Mobile banner animation
      if (isMobile && bannerRef.current) {
        gsap.fromTo(bannerRef.current, 
          { 
            y: -100,
            opacity: 0,
            scale: 0.95
          },
          { 
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: "back.out(1.7)",
            delay: 0.3
          }
        );

        // Animate banner content
        const bannerContent = bannerRef.current.querySelector('.banner-content');
        if (bannerContent) {
          gsap.fromTo(bannerContent.children,
            {
              y: 30,
              opacity: 0
            },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              stagger: 0.1,
              delay: 0.8,
              ease: "power2.out"
            }
          );
        }
      }

      // Filters animation
      if (filtersRef.current) {
        gsap.fromTo(filtersRef.current.children,
          {
            y: 50,
            opacity: 0,
            scale: 0.8
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            delay: isMobile ? 1.2 : 0.5,
            ease: "back.out(1.7)"
          }
        );
      }

    }, mainRef);

    return () => ctx.revert();
  }, [isMobile]);

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

  // Auto-play carousel effect
  useEffect(() => {
    if (!isMobile || !isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isAutoPlaying]);

  // Carousel slides data -- trimmed to just the store's own banner for now
  // (the second "Stora trust" slide is parked pending a better replacement).
  const carouselSlides = [
    {
      type: 'store',
      title: store.storeName,
      description: store.storeDescription,
      badge: store.storeType === 'physical' ? 'Physical store' : 'Online store',
      showLogo: true
    }
  ];

  const handleDotClick = (index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // Resume autoplay after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <div className="min-h-screen bg-white relative">
      <ViewBeacon type="store" storeId={store.id} />
      <StoreHeader
        store={store}
        onSignInClick={() => setShowSignInModal(true)}
      />

      {/* Desktop Storefront Hero -- this page didn't have one at all before
          (just decorative blur shapes behind a search bar); this is a
          vendor's own shop window, so it leads with their name, their
          description, their own color -- Stora's presence is the small
          "Verified" mark, not a competing visual layer. */}
      {!isMobile && (
        <div className="relative overflow-hidden border-b border-gray-100 min-h-[220px] lg:min-h-[260px] flex items-center">
          {/* Banner image, when the vendor has one -- same blurred color-wash
              treatment the mobile carousel already uses for consistency,
              just given real room to breathe on desktop. Falls back to a
              flat vendor-tinted card when there's no banner to show. */}
          {store.branding?.banner ? (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center scale-105"
                style={{ backgroundImage: `url(${store.branding.banner})` }}
              />
              <div
                className="absolute inset-0 backdrop-blur-md"
                style={{ backgroundColor: `${primaryColor}66` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{ backgroundColor: `${primaryColor}E6` }} />
              <div
                className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-20 pointer-events-none bg-white"
              />
            </>
          )}

          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-14 relative w-full">
            <div className="flex items-center gap-5">
              {store.branding?.logo && (
                <img
                  src={store.branding.logo}
                  alt={store.storeName}
                  className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl object-cover bg-white border border-white/40 shadow-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                {/* Tied to the vendor's real QoreID-based verification
                    (store.isVerified, from buildPublicStoreData) -- this
                    used to render unconditionally, which is exactly the
                    kind of trust signal an impersonator would want to
                    fake. No production store has actually verified yet
                    (see findFeaturedStores' comment on the same field),
                    so this currently shows for nobody -- expected, not a
                    regression, until vendors start completing it. */}
                {store.isVerified && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-gold-400/40 mb-2.5">
                    <ShieldCheck className="w-3 h-3 text-gold-400" />
                    <span className="text-[10.5px] font-semibold text-gold-400 tracking-wide uppercase">
                      Verified by Stora
                    </span>
                  </div>
                )}
                <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-white tracking-tight truncate drop-shadow-sm">
                  {store.storeName}
                </h1>
                {/* Store names aren't unique (see CreateStoreModal's
                    name-collision warning) -- the slug is, and it's what
                    the URL/subdomain actually is, so surfacing it here
                    gives a shopper a real way to tell two same-named
                    stores apart, or to notice one isn't who it claims. */}
                <p className="text-white/70 text-[13px] font-mono truncate drop-shadow-sm">@{store.storeSlug}</p>
                {/* Always renders now (the delivery segment has no
                    condition of its own -- every store either ships
                    nationwide or to a specific list, always worth
                    showing), where before this row only appeared once a
                    review or a state existed. */}
                <div className="flex items-center gap-1.5 mt-1">
                  {store.totalReviews > 0 && (
                    <>
                      <StarRating rating={store.averageRating} size={13} />
                      <span className="text-white/80 text-[12.5px] tabular-nums drop-shadow-sm">
                        {store.averageRating.toFixed(1)} · {store.totalReviews} review{store.totalReviews === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                  {store.state && (
                    <span className="text-white/80 text-[12.5px] drop-shadow-sm">
                      {store.totalReviews > 0 && <span className="text-white/40 mx-0.5">·</span>}
                      Based in {store.state}
                    </span>
                  )}
                  <span className="text-white/80 text-[12.5px] drop-shadow-sm">
                    {(store.totalReviews > 0 || store.state) && <span className="text-white/40 mx-0.5">·</span>}
                    {store.deliveryStates && store.deliveryStates.length > 0
                      ? `Delivers to ${store.deliveryStates.length > 3
                          ? `${store.deliveryStates.slice(0, 3).join(', ')} +${store.deliveryStates.length - 3} more`
                          : store.deliveryStates.join(', ')}`
                      : 'Delivers nationwide'}
                  </span>
                </div>
                {store.storeDescription && (
                  <p className="text-white/85 text-[15px] mt-1.5 max-w-xl line-clamp-2 drop-shadow-sm">
                    {store.storeDescription}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className={`max-w-7xl mx-auto px-6 lg:px-8 ${isMobile ? 'pt-0' : 'pt-8'} pb-8 relative z-10 min-h-screen`}>
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

        {/* Enhanced Mobile Store Banner with Carousel */}
        {isMobile && (
          <div className="mb-6 -mx-6 relative overflow-hidden" ref={mainRef}>
            {/* Carousel Container - full-bleed on mobile, no rounding */}
            <div className="relative h-64 overflow-hidden" ref={bannerRef}>
              {/* Slides */}
              <div 
                className="flex transition-transform duration-500 ease-out h-full"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {carouselSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`min-w-full h-64 relative flex-shrink-0 ${slide.type !== 'store' ? 'bg-gradient-to-br from-brand-800 to-brand-900' : ''}`}
                    style={
                      slide.type === 'store'
                        ? {
                            backgroundImage: store.branding?.banner ? `url(${store.branding.banner})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundColor: `${primaryColor}12`
                          }
                        : undefined
                    }
                  >
                    {slide.type === 'store' && (
                      <div
                        className="absolute inset-0 backdrop-blur-md"
                        style={{ backgroundColor: `${primaryColor}25` }}
                      />
                    )}

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-center px-6 banner-content">
                      <div className="flex items-center gap-2 mb-1.5">
                        {slide.type === 'store' && slide.showLogo && store.branding?.logo && (
                          <img
                            src={store.branding.logo}
                            alt={store.storeName}
                            className="h-7 w-7 object-cover bg-white/90 backdrop-blur-sm rounded-lg p-0.5 flex-shrink-0"
                          />
                        )}
                        {slide.type !== 'store' && (
                          <ShieldCheck className="w-5 h-5 text-gold-400 flex-shrink-0" />
                        )}
                        <h1 className="text-lg font-bold text-white drop-shadow-lg font-display truncate">
                          {slide.title}
                        </h1>
                      </div>

                      {slide.description && (
                        <p className="text-white/85 text-xs leading-relaxed drop-shadow-md line-clamp-2">
                          {slide.description}
                        </p>
                      )}

                      <div className="mt-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15 backdrop-blur-sm text-white border border-white/25">
                          {slide.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              

              {/* Pause/Play indicator (optional) */}
              {!isAutoPlaying && (
                <div className="absolute top-2 right-2 z-20">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-medium border border-white/30">
                    Paused
                  </div>
                </div>
              )}
            </div>

            {/* Carousel Dots - only meaningful with more than one slide */}
            {carouselSlides.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3 z-20">
              {carouselSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className="transition-all duration-300"
                  aria-label={`Go to slide ${index + 1}`}
                >
                  <div 
                    className={`rounded-full transition-all duration-300 ${
                      currentSlide === index 
                        ? 'w-6 h-2' 
                        : 'w-2 h-2'
                    }`}
                    style={{
                      backgroundColor: currentSlide === index 
                        ? primaryColor
                        : 'rgba(156, 163, 175, 0.5)' // gray-400 with opacity
                    }}
                  />
                </button>
              ))}
            </div>
            )}
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
            header instead of being duplicated here. */}
        {isMobile && (
          <div className="mb-8 relative z-40" >
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, brands, categories…"
                  className="w-full pl-10 pr-10 py-3 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all text-base bg-gray-50/70 focus:bg-white"
                  style={{ '--tw-ring-color': primaryColor }}
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
                    style={{ color: primaryColor }}
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

        {/* Products Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-xl md:text-2xl font-semibold text-gray-900">
              {isMobile ? 'Products' : 'All products'}
            </h3>
            <span className="text-sm text-gray-500 tabular-nums">
              {displayedProducts.length} of {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </span>
          </div>

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
                      currency={store.settings?.currency || "NGN"}
                      onNavigate={() => setIsNavigating(true)}
                      onSignInRequired={() => setShowSignInModal(true)}
                    />
                  ) : (
                    <ProductCard
                      key={product.id}
                      product={product}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      currency={store.settings?.currency || "NGN"}
                      onNavigate={() => setIsNavigating(true)}
                      onSignInRequired={() => setShowSignInModal(true)}
                    />
                  )
                ))}
              </div>

              {/* See All Button - Only show if there are more than 8 products */}
                <div className="flex items-center justify-center mt-12">
                  <button
                    onClick={() => {
                      setIsNavigating(true);
                      router.push(storeHref(store.storeSlug, '/products'));
                    }}
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 text-white rounded-xl font-semibold text-sm hover:brightness-95 transition-all shadow-sm hover:shadow-md"
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
      </main>

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
