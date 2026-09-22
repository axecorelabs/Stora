"use client";
import { Send, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import TelegramForm from "./TelegramForm";

// Wraps the exact same TelegramForm the onboarding wizard already embeds
// (QR code + deep link + poll-until-connected) -- see VerificationModal's
// identical reasoning.
export default function TelegramModal({ isOpen, onClose, onConnected }) {
  const router = useRouter();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Telegram"
      subtitle="Get new order alerts instantly"
      icon={Send}
      footer={
        <button
          onClick={() => router.push('/dashboard/settings?tab=telegram')}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-1"
        >
          Manage in Settings <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <TelegramForm
        onConnected={() => {
          onConnected?.();
          onClose();
        }}
      />
    </Modal>
  );
}
