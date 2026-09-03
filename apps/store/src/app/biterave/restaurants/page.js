import BiteraveVendorsBrowse from "@/components/biterave/BiteraveVendorsBrowse";

export const metadata = {
  title: "All restaurants - Biterave",
  description: "Browse and search every restaurant on Biterave."
};

export default function BiteraveRestaurantsPage() {
  return <BiteraveVendorsBrowse type="meals" />;
}
