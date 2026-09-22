"use client";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import VerificationForm from "./VerificationForm";

// Wraps the exact same VerificationForm the onboarding wizard already
// embeds -- no separate "quick" version to maintain, just this form in a
// mobile-first shell instead of a full page navigation.
export default function VerificationModal({ isOpen, onClose, onVerified }) {
  const router = useRouter();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Get verified"
      subtitle="Earn the “Verified by Stora” badge"
      icon={ShieldCheck}
      iconTone="gold"
      footer={
        <button
          onClick={() => router.push('/dashboard/settings?tab=verification')}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-1"
        >
          Manage in Settings <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <VerificationForm
        onVerified={() => {
          onVerified?.();
          onClose();
        }}
      />
    </Modal>
  );
}
