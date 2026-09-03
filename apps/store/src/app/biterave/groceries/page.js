import BiteraveProductsBrowse from "@/components/biterave/BiteraveProductsBrowse";

export const metadata = {
  title: "All groceries - Biterave",
  description: "Browse and search real groceries from real vendors on Biterave."
};

export default function BiteraveGroceriesPage() {
  return <BiteraveProductsBrowse type="groceries" />;
}
