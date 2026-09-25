import SuggestBusinessForm from "@/components/business/SuggestBusinessForm";

export const metadata = {
  title: "Suggest a Business - Stora",
  description: "Know a business that should be on Stora? Tell us about it.",
};

export const dynamic = "force-dynamic";

export default function SuggestBusinessPage() {
  return <SuggestBusinessForm />;
}
