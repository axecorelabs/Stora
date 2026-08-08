"use client";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function InventoryDetailsHeader({ item }) {
  const router = useRouter();

  return (
    <div className="mb-6">
      <button
        onClick={() => router.push('/dashboard/inventory')}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back to Inventory</span>
      </button>
      <div className="mt-2 flex items-center text-sm text-gray-500">
        <span>Inventory</span>
        <ChevronLeft className="w-4 h-4 mx-1 rotate-180" />
        <span className="font-medium text-gray-900">{item?.productName}</span>
      </div>
    </div>
  );
}
