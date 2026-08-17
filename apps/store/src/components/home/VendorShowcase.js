"use client";
import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import VendorCard from "./VendorCard";

export default function VendorShowcase() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stores/featured?limit=10");
        const data = await res.json();
        if (!cancelled && data.success) setStores(data.stores || []);
      } catch (error) {
        console.error("Error loading featured stores:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[220px] h-[180px] rounded-2xl bg-gray-50 border border-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="text-center py-12">
        <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-gray-500 text-sm">New vendors are joining Stora every week -- check back soon.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
      {stores.map((store) => (
        <VendorCard key={store.id} store={store} />
      ))}
    </div>
  );
}
