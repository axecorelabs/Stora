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
  X
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import useStoreStore from "@/stores/storeStore";
import SignInModal from "./auth/SignInModal";
import SignUpModal from "./auth/SignUpModal";
import ForgotPasswordModal from "./auth/ForgotPasswordModal";
import LoadingOverlay from "./ui/LoadingOverlay";
import FloatingCartButton from "./ui/FloatingCartButton";
import { useProducts } from "@/hooks/useProducts";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function StoreWebsite({ store }) {
  const router = useRouter();
  
  // Replace products fetch with TanStack Query
  const { data: products = [], isLoading: loading, error } = useProducts(store.id);
  
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
    router.push(`/${store.storeSlug}/products?category=${encodeURIComponent(categoryName)}`);
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

      // Floating animation for emoji
      const emoji = emptyStateRef.current.querySelector('.empty-emoji');
      if (emoji) {
        gsap.to(emoji, {
          y: -20,
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      }

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
      setCurrentSlide((prev) => (prev + 1) % 4); // 4 slides total
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [isMobile, isAutoPlaying]);

  // Carousel slides data
  const carouselSlides = [
    {
      type: 'store',
      title: `Welcome to ${store.storeName}`,
      description: store.storeDescription,
      badge: store.storeType === 'physical' ? '🏪 Physical Store' : '🌐 Online Store',
      showLogo: true,
      showLogo: false
    },
    {
      type: 'stora',
      title: "Nigeria's #1 Marketplace",
      description: "Shop from thousands of verified stores across Nigeria",
      badge: '🇳🇬 Trusted by Nigerians',
      showLogo: false,
      showLogo: true,
      gradient: 'from-emerald-500 to-teal-600',
      backgroundImage: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop'
    },
    {
      type: 'stora-features',
      title: "Why Shop on Stora?",
      description: "Secure payments • Fast delivery • Quality products • 24/7 support",
      badge: '✨ Your Shopping Companion',
      showLogo: false,
      showLogo: true,
      gradient: 'from-blue-500 to-indigo-600',
      backgroundImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&h=400&fit=crop'
    },
    {
      type: 'stora-discover',
      title: "Discover Amazing Deals",
      description: "Browse thousands of products from local Nigerian stores",
      badge: '🎉 Shop Local, Shop Smart',
      showLogo: false,
      showLogo: true,
      gradient: 'from-purple-500 to-pink-600',
      backgroundImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop'
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
      {/* Animated Background Shapes */}
      {!isMobile && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" >
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: secondaryColor }} />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: secondaryColor }} />
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full opacity-15 blur-2xl" style={{ backgroundColor: secondaryColor }} />
          <div className="absolute top-1/2 -right-20 w-56 h-56 rounded-full opacity-15 blur-2xl" style={{ backgroundColor: secondaryColor }} />
          <div className="absolute bottom-40 right-1/4 w-40 h-40 rounded-full opacity-10 blur-xl" style={{ backgroundColor: secondaryColor }} />
          <div className="absolute top-1/3 left-1/4 w-48 h-48 rounded-full opacity-10 blur-xl" style={{ backgroundColor: secondaryColor }} />
        </div>
      )}

      <StoreHeader 
        store={store} 
        onSignInClick={() => setShowSignInModal(true)}
      />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8 relative z-10 min-h-screen">
        {/* Enhanced Mobile Store Banner with Carousel */}
        {isMobile && (
          <div className="mb-6 -mx-6 mx-auto relative overflow-hidden" ref={mainRef}>
            {/* Carousel Container - Increased height and border radius */}
            <div className="relative h-40 rounded-2xl overflow-hidden" ref={bannerRef}>
              {/* Slides */}
              <div 
                className="flex transition-transform duration-500 ease-out h-full"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {carouselSlides.map((slide, index) => (
                  <div 
                    key={index}
                    className="min-w-full h-40 relative flex-shrink-0"
                    style={{
                      backgroundImage: slide.type === 'store' && store.branding?.banner 
                        ? `url(${store.branding.banner})` 
                        : slide.backgroundImage 
                          ? `url(${slide.backgroundImage})`
                          : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: slide.type === 'store' && store.branding?.banner 
                        ? 'transparent' 
                        : slide.type === 'store' 
                          ? `${primaryColor}10` 
                          : 'transparent'
                    }}
                  >
                    {/* Gradient Background for Stora slides */}
                    {slide.type !== 'store' && (
                      <div 
                        className={`absolute inset-0 bg-gradient-to-br ${slide.gradient}`}
                        style={{ opacity: 0.85 }}
                      />
                    )}

                    {/* Backdrop Blur Overlay */}
                    <div 
                      className="absolute inset-0 backdrop-blur-sm"
                      style={{ 
                        backgroundColor: slide.type === 'store' 
                          ? `${primaryColor}20` 
                          : 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px) saturate(120%)'
                      }}
                    />
                    
                    {/* Content - Scaled down text sizes */}
                    <div className="absolute inset-0 flex flex-col justify-center px-6 banner-content">
                      <div className="flex items-center gap-2 mb-1.5">
                        {/* Store Logo - Slightly smaller */}
                        {slide.showLogo && store.branding?.logo && (
                          <img 
                            src={store.branding.logo} 
                            alt={store.storeName} 
                            className="h-7 w-auto object-contain bg-white/20 backdrop-blur-sm rounded-lg p-1" 
                          />
                        )}
                        
                        {/* Stora Logo - Slightly smaller */}
                        {slide.showLogo && (
                          <img 
                            src="/favicon-16x16.png"
                            alt="Stora Logo" 
                            className="h-7 w-auto object-contain bg-white/90 backdrop-blur-sm rounded-lg p-1.5" 
                          />
                        )}
                        
                        {/* Fallback Icon - Smaller */}
                        {slide.type !== 'store' && !slide.showLogo && (
                          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-base">
                            🛍️
                          </div>
                        )}
                        
                        {/* Title - Scaled down from text-xl to text-base */}
                        <h1 className="text-lg font-bold text-white drop-shadow-lg">
                          {slide.title}
                        </h1>
                      </div>
                      
                      {/* Description - Scaled down from text-sm to text-xs */}
                      {slide.description && (
                        <p className="text-white/90 text-xs leading-relaxed drop-shadow-md line-clamp-2">
                          {slide.description}
                        </p>
                      )}
                      
                      {/* Badge - Scaled down padding and text */}
                      <div className="mt-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/20 backdrop-blur-sm text-white border border-white/30">
                          {slide.badge}
                        </span>
                      </div>
                    </div>
                    
                    {/* Gradient Overlay */}
                    {slide.type === 'store' && (
                      <div 
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: `linear-gradient(45deg, ${primaryColor}60, transparent 70%)`
                        }}
                      />
                    )}
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

            {/* Carousel Dots - Now outside with dark styling */}
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
          </div>
        )}

        {/* Mobile Categories Section - Only show if more than 1 category */}
        {isMobile  && categoriesWithCounts.length > 1 && (
          <div className="mb-6 -mx-6">
            <div className="px-6 flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">Category</h3>
              <button
                onClick={() => {
                  setIsNavigating(true);
                  router.push(`/${store.storeSlug}/products`);
                }}
                className="text-sm font-medium"
                style={{ color: primaryColor }}
              >
                See All
              </button>
            </div>
            
            {/* Horizontal Scrollable Categories */}
            <div className="overflow-x-auto scrollbar-hide px-6">
              <div className="flex gap-4 pb-2">
                {categoriesWithCounts.map((category, index) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleCategoryClick(category.name)}
                      className={`flex flex-col items-center flex-shrink-0 transition-all duration-200 ${
                        selectedCategory === category.name ? 'scale-105' : ''
                      }`}
                    >
                      <div 
                        className="w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-all duration-200"
                        style={{ 
                          backgroundColor: selectedCategory === category.name 
                            ? `${primaryColor}20` 
                            : `${primaryColor}10`,
                          border: selectedCategory === category.name 
                            ? `2px solid ${primaryColor}` 
                            : 'none'
                        }}
                      >
                        <IconComponent 
                          className="w-5 h-7" 
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

        {/* Search Bar - Icon moved outside to the right */}
        <div className="mb-8 relative z-40" >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="  Search products, brands, categories..."
                className="w-full pl-4 pr-10 py-3 text-gray-900 placeholder-gray-400 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all text-sm sm:text-base shadow-sm"
                style={{ 
                  backgroundColor: `${primaryColor}05`,
                  borderColor: searchQuery ? primaryColor : `${primaryColor}`,
                  '--tw-ring-color': primaryColor
                }}
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
            
            {/* Search Icon Button - Outside */}
            <button
              onClick={() => {
                // Optional: trigger search action
                console.log('Searching for:', searchQuery);
              }}
              className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all hover:opacity-90 shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {/* Search Results Count */}
          {searchQuery && (
            <div className="mt-3 flex items-center justify-between px-2">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold" style={{ color: primaryColor }}>
                  {filteredProducts.length}
                </span> {filteredProducts.length === 1 ? 'result' : 'results'} for "{searchQuery}"
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
            <h3 className="text-2xl font-semibold text-gray-900">
              {isMobile ? 'Products' : ''}
            </h3>
            <span className="text-sm text-gray-600">
              {displayedProducts.length} of {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-20">
                        <div 
                          className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-4 mb-4"
                          style={{ borderTopColor: primaryColor }}
                        ></div>
                        <p className="text-gray-600">Loading products...</p>
                      </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="text-8xl mb-4">⚠️</div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Products</h4>
              <p className="text-sm text-gray-600 mb-4">{error.message}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Retry
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20" ref={emptyStateRef}>
              <div className="empty-emoji text-8xl mb-4">
                {searchQuery ? '🔍' : '📦'}
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No Results Found' : 'No Products Found'}
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                {searchQuery 
                  ? `We couldn't find any products matching "${searchQuery}"` 
                  : 'Try adjusting your filters to see more products'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                >
                  Clear Search
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
                    />
                  ) : (
                    <ProductCard
                      key={product.id}
                      product={product}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      currency={store.settings?.currency || "NGN"}
                      onNavigate={() => setIsNavigating(true)}
                    />
                  )
                ))}
              </div>

              {/* See All Button - Only show if there are more than 8 products */}
                <div className="flex items-center justify-center mt-12">
                  <button
                    onClick={() => {
                      setIsNavigating(true);
                      router.push(`/${store.storeSlug}/products`);
                    }}
                    className="inline-flex items-center gap-2 px-8 py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Package className="w-5 h-5" />
                    <span>See All Products</span>
                    <span 
                      className="ml-2 px-2.5 py-0.5 bg-white/20 rounded-full text-sm font-bold"
                    >
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

      {/* Loading Overlay */}
      <LoadingOverlay 
        isVisible={loading || isNavigating} 
        color={primaryColor}
        message={isNavigating ? "Loading product..." : "Loading products..."}
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
