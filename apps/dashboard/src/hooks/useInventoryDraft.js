import { useEffect, useRef, useState, useCallback } from "react";
import { saveDraft, loadDraft, clearDraft } from "@/lib/inventoryDraft";

// Debounced while typing (~800ms, tuned for slower Android devices so
// autosave writes don't thrash), but flushed immediately -- no debounce
// -- on visibilitychange/pagehide. Deliberately not relying on
// beforeunload alone: iOS Safari doesn't reliably fire it when a
// backgrounded tab gets reclaimed, which is the realistic "reload" this
// is actually protecting against on mobile.
const AUTOSAVE_DEBOUNCE_MS = 800;

function isNonTrivialDraft(draft) {
  if (!draft) return false;
  return !!draft.formData?.productName?.trim() || (draft.imagePreviews?.length || 0) > 0;
}

// Shared by AddInventoryModal.js, add/page.js and add-menu-item/page.js --
// all three hold the identical formData/selectedImages/imagePreviews/
// variants/detectedColorVariants/currentStep shape. `ownerId` scopes the
// draft to the logged-in vendor (every inventory write is already scoped
// server-side by session, not a client-passed store id, so there's
// nothing more specific to key on); `context` separates the plain
// add-product flow from add-menu-item so they never collide.
//
// variants/detectedColorVariants are optional: add-menu-item/page.js has
// no variant-color machinery at all (every menu item gets the single
// default variant the API creates when none is sent), so it simply
// doesn't pass these -- defaulted here rather than forcing every caller
// to fake empty state for a concept that doesn't apply to it.
const NOOP = () => {};

export function useInventoryDraft({
  ownerId,
  context,
  formData,
  setFormData,
  selectedImages,
  setSelectedImages,
  imagePreviews,
  setImagePreviews,
  variants = [],
  setVariants = NOOP,
  detectedColorVariants = [],
  setDetectedColorVariants = NOOP,
  currentStep,
  setCurrentStep
}) {
  const draftKey = ownerId ? `${ownerId}:${context}` : null;

  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftProductName, setDraftProductName] = useState('');
  const [draftImageCount, setDraftImageCount] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  // Gates autosave until any existing draft has been explicitly resumed
  // or discarded -- without this, the form's blank initial state would
  // autosave over (silently wiping) a just-loaded draft before the
  // vendor ever gets to choose.
  const readyRef = useRef(false);
  const pendingDraftRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!draftKey) return;
    let cancelled = false;

    loadDraft(draftKey)
      .then((draft) => {
        if (cancelled) return;
        if (isNonTrivialDraft(draft)) {
          pendingDraftRef.current = draft;
          setHasDraft(true);
          setDraftSavedAt(draft.savedAt || null);
          setDraftProductName(draft.formData?.productName?.trim() || '');
          setDraftImageCount(draft.imagePreviews?.length || 0);
        } else {
          readyRef.current = true;
        }
      })
      .catch(() => {
        // IndexedDB unavailable (private browsing, disabled storage) --
        // fail soft, the form works exactly as it does without drafting.
        readyRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  const resumeDraft = useCallback(() => {
    const draft = pendingDraftRef.current;
    if (!draft) return;

    setFormData(draft.formData || {});
    setSelectedImages(draft.selectedImages || []);
    setImagePreviews(
      (draft.imagePreviews || []).map((preview) => ({
        ...preview,
        url: preview.file ? URL.createObjectURL(preview.file) : preview.url
      }))
    );
    setVariants(draft.variants || []);
    setDetectedColorVariants(draft.detectedColorVariants || []);
    if (typeof draft.currentStep === 'number') setCurrentStep(draft.currentStep);

    pendingDraftRef.current = null;
    setHasDraft(false);
    readyRef.current = true;
  }, [setFormData, setSelectedImages, setImagePreviews, setVariants, setDetectedColorVariants, setCurrentStep]);

  const discardDraft = useCallback(async () => {
    if (draftKey) {
      try {
        await clearDraft(draftKey);
      } catch {
        // Already gone, or storage unavailable -- either way there's
        // nothing left to protect against.
      }
    }
    pendingDraftRef.current = null;
    setHasDraft(false);
    readyRef.current = true;
  }, [draftKey]);

  // Autosave -- debounced on every meaningful change, once a pending
  // resume/discard decision (if any) has been resolved.
  useEffect(() => {
    if (!draftKey || !readyRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraft(draftKey, {
        formData,
        selectedImages,
        imagePreviews,
        variants,
        detectedColorVariants,
        currentStep
      })
        .then(() => {
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
        })
        .catch(() => {
          // Quota exceeded or storage unavailable -- fail soft, no
          // user-facing error. The form keeps working either way.
        });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(saveTimerRef.current);
  }, [draftKey, formData, selectedImages, imagePreviews, variants, detectedColorVariants, currentStep]);

  // Immediate flush on backgrounding -- the actual mobile "reload"
  // scenario (OS reclaims a backgrounded tab's memory). beforeunload
  // alone misses this on iOS Safari.
  useEffect(() => {
    if (!draftKey) return;

    const flush = () => {
      if (!readyRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveDraft(draftKey, {
        formData,
        selectedImages,
        imagePreviews,
        variants,
        detectedColorVariants,
        currentStep
      }).catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [draftKey, formData, selectedImages, imagePreviews, variants, detectedColorVariants, currentStep]);

  const clearDraftOnSuccess = useCallback(() => {
    if (!draftKey) return Promise.resolve();
    // readyRef deliberately stays true here (unlike discardDraft, which
    // resets a pending-resume decision): AddInventoryModal.js stays
    // mounted across opens (isOpen just toggles) and resets its own
    // formData/images/etc. back to blank right after this resolves --
    // autosave needs to keep working for whatever the vendor adds next,
    // not get permanently wedged off after the first successful submit.
    return clearDraft(draftKey).catch(() => {});
  }, [draftKey]);

  return {
    hasDraft,
    draftSavedAt,
    draftProductName,
    draftImageCount,
    justSaved,
    resumeDraft,
    discardDraft,
    clearDraftOnSuccess
  };
}
