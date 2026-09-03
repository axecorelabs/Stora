import BiteraveProductsBrowse from "@/components/biterave/BiteraveProductsBrowse";

export const metadata = {
  title: "All meals - Biterave",
  description: "Browse and search real dishes from real restaurants on Biterave."
};

export default function BiteraveMealsPage() {
  return <BiteraveProductsBrowse type="meals" />;
}
