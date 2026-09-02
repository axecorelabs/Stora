"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-400"
};

function CampaignsPageContent() {
  const { secureApiCall } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await secureApiCall("/api/campaigns");
        if (data.success) setCampaigns(data.campaigns);
      } catch (error) {
        console.error("Error loading campaigns:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [secureApiCall]);

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-brand-700 animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No campaigns yet.</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}/edit`}
              className="flex items-center justify-between px-4 py-3 hover:bg-brand-50/40 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{campaign.title}</p>
                <p className="text-xs text-gray-400">{campaign.storeName}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[campaign.status] || STATUS_STYLES.draft}`}>
                {campaign.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <AdminLayout title="Campaigns" subtitle="Marketing quizzes built for partner vendors.">
      <CampaignsPageContent />
    </AdminLayout>
  );
}
