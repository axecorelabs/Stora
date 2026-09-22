"use client";
import { useState } from "react";
import { Globe, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

// "Set up your website" turns out to just be a single enable toggle
// (PUT /api/stores/website/toggle, the same call the full website page's
// own toggleWebsiteStatus makes) -- everything else on that page
// (branding, sections, preview) is optional polish reachable afterward,
// not a prerequisite. So the quick action here really is one button, not
// a slimmed-down builder.
export default function WebsiteQuickSetupModal({ isOpen, onClose, isListingMode, onEnabled }) {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState(null);

  const handleEnable = async () => {
    setIsEnabling(true);
    setError(null);
    try {
      const response = await secureApiCall('/api/stores/website/toggle', {
        method: 'PUT',
        body: JSON.stringify({ status: true })
      });
      if (response.success) {
        onEnabled?.();
        onClose();
      } else {
        setError(response.message || 'Could not enable your website');
      }
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set up your website"
      subtitle={isListingMode ? 'Make your showcase visible' : 'Make your store visible online'}
      icon={Globe}
      footer={
        <button
          onClick={() => router.push('/dashboard/website')}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-1"
        >
          Go to Website Builder <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {isListingMode
            ? 'Turn your showcase website on so customers can find your listing. You can customize branding, photos, and layout anytime afterward.'
            : 'Turn your website on so buyers can find and order from you online. You can customize branding, sections, and layout anytime afterward.'}
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button variant="primary" onClick={handleEnable} disabled={isEnabling} className="w-full">
          {isEnabling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isEnabling ? 'Enabling…' : 'Enable my website'}
        </Button>
      </div>
    </Modal>
  );
}
