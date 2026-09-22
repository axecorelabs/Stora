"use client";
import { useState, useEffect } from "react";
import { Truck, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import StoreDeliveryTab from "@/components/dashboard/store/StoreDeliveryTab";

// Same editing logic as DeliverySettingsCard.js (Deliveries page's own
// collapsible card) reused here in the shared Modal shell instead --
// StoreDeliveryTab itself is the one genuinely shared piece, not
// duplicated; only the small handler/state layer around it is, since
// DeliverySettingsCard's is tightly coupled to its own collapsible-card
// lifecycle rather than something worth extracting for one more caller.
export default function DeliveryFeesModal({ isOpen, onClose, store, onSaved }) {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const [editData, setEditData] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (isOpen && store) {
      setEditData({
        deliveryNationwide: store.deliveryNationwide,
        deliveryStates: store.deliveryStates || [],
        deliveryFees: store.deliveryFees || {}
      });
      setErrors({});
      setSaveError(null);
    }
  }, [isOpen, store]);

  if (!editData) return null;

  const setDeliveryNationwide = (nationwide) => {
    setEditData(prev => ({ ...prev, deliveryNationwide: nationwide }));
    if (errors.deliveryStates) setErrors(prev => ({ ...prev, deliveryStates: '' }));
  };

  const toggleDeliveryState = (states) => {
    setEditData(prev => ({ ...prev, deliveryStates: states }));
    if (errors.deliveryStates) setErrors(prev => ({ ...prev, deliveryStates: '' }));
  };

  const setDeliveryFee = (state, amount) => {
    setEditData(prev => ({ ...prev, deliveryFees: { ...prev.deliveryFees, [state]: amount } }));
  };

  const setDeliveryFeeForZone = (statesInZone, amount) => {
    setEditData(prev => {
      const nextFees = { ...prev.deliveryFees };
      for (const state of statesInZone) {
        if (nextFees[state] === undefined) nextFees[state] = amount;
      }
      return { ...prev, deliveryFees: nextFees };
    });
  };

  const handleSave = async () => {
    if (!editData.deliveryNationwide && (editData.deliveryStates || []).length === 0) {
      setErrors(prev => ({ ...prev, deliveryStates: 'Select at least one state, or choose Nationwide' }));
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await secureApiCall('/api/stores', {
        method: 'PUT',
        body: JSON.stringify({
          deliveryStates: editData.deliveryNationwide ? null : editData.deliveryStates,
          deliveryFees: editData.deliveryFees || {}
        })
      });
      if (response.success) {
        onSaved?.(response.data);
        onClose();
      } else {
        setSaveError(response.message || 'Failed to save delivery settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set delivery fees"
      subtitle="Get paid for shipping"
      icon={Truck}
      size="lg"
      footer={
        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 transition-colors disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save delivery settings'}
          </button>
          {saveError && <p className="text-red-500 text-xs text-center">{saveError}</p>}
          <button
            onClick={() => router.push('/dashboard/deliveries')}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-1"
          >
            Go to Deliveries <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      <StoreDeliveryTab
        store={store}
        isEditing
        editData={editData}
        errors={errors}
        setDeliveryNationwide={setDeliveryNationwide}
        toggleDeliveryState={toggleDeliveryState}
        setDeliveryFee={setDeliveryFee}
        setDeliveryFeeForZone={setDeliveryFeeForZone}
        hideInstantToggles
      />
    </Modal>
  );
}
