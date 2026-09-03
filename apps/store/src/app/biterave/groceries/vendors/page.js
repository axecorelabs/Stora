import BiteraveVendorsBrowse from "@/components/biterave/BiteraveVendorsBrowse";

export const metadata = {
  title: "Grocery vendors - Biterave",
  description: "Browse and search every grocery vendor on Biterave."
};

export default function BiteraveGroceryVendorsPage() {
  return <BiteraveVendorsBrowse type="groceries" />;
}
