"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import CampaignBuilderForm from "@/components/CampaignBuilderForm";

function EditCampaignPageContent() {
  const { campaignId } = useParams();
  const { secureApiCall } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await secureApiCall(`/api/campaigns/${campaignId}`);
        if (data.success) setCampaign(data.campaign);
      } catch (error) {
        console.error("Error loading campaign:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, secureApiCall]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-5 h-5 text-brand-700 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-center py-24 text-sm text-gray-400">Campaign not found.</p>;
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-gray-400 mb-6">{campaign.storeName}</p>
      <CampaignBuilderForm initialCampaign={campaign} onSaved={(updated) => setCampaign(updated)} />
    </div>
  );
}

export default function EditCampaignPage() {
  return (
    <AdminLayout title="Edit campaign">
      <EditCampaignPageContent />
    </AdminLayout>
  );
}
