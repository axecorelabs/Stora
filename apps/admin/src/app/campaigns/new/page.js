"use client";
import { useRouter } from "next/navigation";
import CampaignBuilderForm from "@/components/CampaignBuilderForm";
import AdminLayout from "@/components/AdminLayout";

function NewCampaignPageContent() {
  const router = useRouter();
  return <CampaignBuilderForm onSaved={(campaign) => router.push(`/campaigns/${campaign.id}/edit`)} />;
}

export default function NewCampaignPage() {
  return (
    <AdminLayout title="New campaign" subtitle="Build a quiz that recommends products pooled across one or more partner vendors.">
      <NewCampaignPageContent />
    </AdminLayout>
  );
}
