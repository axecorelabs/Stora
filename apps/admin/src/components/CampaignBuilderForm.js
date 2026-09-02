"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Plus, Trash2, Save, Image as ImageIcon, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function newQuestion() {
  return { id: crypto.randomUUID(), text: "", options: [newOption()] };
}
function newOption() {
  return { id: crypto.randomUUID(), label: "", tags: [] };
}

// Shared by both the "new campaign" and "edit campaign" pages --
// `initialCampaign` is null for a fresh campaign, or the loaded campaign
// record when editing. `onSaved` is called with the server's response
// after a successful save so the caller can navigate/refresh.
//
// A campaign now pools one or more partner vendors (campaign_stores),
// not exactly one -- so the AI recommendation at quiz-completion time has
// a much larger real catalog to match against. Attribution still only
// ever credits whichever specific vendor's product was actually
// recommended to a given customer, never every pooled member (see
// apps/store/src/lib/campaignAttribution.js) -- this form just controls
// who's eligible to be pooled in the first place.
export default function CampaignBuilderForm({ initialCampaign, onSaved }) {
  const { secureApiCall } = useAuth();
  const isEditing = !!initialCampaign;
  const fileInputRef = useRef(null);

  const [partners, setPartners] = useState([]);
  const [storeIds, setStoreIds] = useState(initialCampaign?.storeIds || []);
  const [title, setTitle] = useState(initialCampaign?.title || "");
  const [attributionWindowHours, setAttributionWindowHours] = useState(initialCampaign?.attributionWindowHours || 48);
  const [status, setStatus] = useState(initialCampaign?.status || "draft");
  const [bannerUrl, setBannerUrl] = useState(initialCampaign?.bannerUrl || "");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [resultsHeading, setResultsHeading] = useState(initialCampaign?.config?.resultsHeading || "Your personalized picks");
  const [resultsIntro, setResultsIntro] = useState(
    initialCampaign?.config?.resultsIntro || "Based on your answers, here's what we recommend."
  );
  const [maxRecommendations, setMaxRecommendations] = useState(initialCampaign?.config?.maxRecommendations || 3);
  const [questions, setQuestions] = useState(
    initialCampaign?.config?.questions?.length ? initialCampaign.config.questions : [newQuestion()]
  );
  const [availableTags, setAvailableTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await secureApiCall("/api/partners");
        if (data.success) setPartners(data.stores.filter((s) => s.isPartner));
      } catch (err) {
        console.error("Error loading partner vendors:", err);
      }
    })();
  }, [secureApiCall]);

  useEffect(() => {
    (async () => {
      if (storeIds.length === 0) {
        setAvailableTags((prev) => (prev.length ? [] : prev));
        return;
      }
      try {
        const data = await secureApiCall(`/api/campaigns/store-tags?${storeIds.map((id) => `storeId=${id}`).join("&")}`);
        if (data.success) setAvailableTags(data.tags);
      } catch (err) {
        console.error("Error loading store tags:", err);
      }
    })();
  }, [storeIds, secureApiCall]);

  const tagCount = useCallback(
    (tag) => availableTags.find((t) => t.tag === tag)?.productCount ?? 0,
    [availableTags]
  );

  const toggleStore = (storeId) => {
    setStoreIds((prev) => (prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]));
  };

  const handleBannerSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("banner", file);
      const response = await fetch("/api/campaigns/banner", { method: "POST", body: formData, credentials: "include" });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || "Failed to upload banner");
        return;
      }
      setBannerUrl(data.url);
    } catch (err) {
      console.error("Error uploading campaign banner:", err);
      setError("Failed to upload banner");
    } finally {
      setUploadingBanner(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateQuestion = (qIndex, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)));
  };
  const updateOption = (qIndex, oIndex, patch) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, ...patch } : o)) } : q
      )
    );
  };
  const addQuestion = () => setQuestions((prev) => [...prev, newQuestion()]);
  const removeQuestion = (qIndex) => setQuestions((prev) => prev.filter((_, i) => i !== qIndex));
  const addOption = (qIndex) => updateQuestion(qIndex, { options: [...questions[qIndex].options, newOption()] });
  const removeOption = (qIndex, oIndex) =>
    updateQuestion(qIndex, { options: questions[qIndex].options.filter((_, j) => j !== oIndex) });

  const handleSave = async (nextStatus) => {
    setSaving(true);
    setError(null);
    try {
      const config = {
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options.map((o) => ({ id: o.id, label: o.label, tags: o.tags }))
        })),
        resultsHeading,
        resultsIntro,
        maxRecommendations: Number(maxRecommendations) || 3
      };

      const payload = {
        title,
        config,
        attributionWindowHours: Number(attributionWindowHours) || 48,
        status: nextStatus,
        bannerUrl: bannerUrl || null
      };
      const data = isEditing
        ? await secureApiCall(`/api/campaigns/${initialCampaign.id}`, { method: "PATCH", body: JSON.stringify({ ...payload, storeIds }) })
        : await secureApiCall("/api/campaigns", { method: "POST", body: JSON.stringify({ ...payload, storeIds }) });

      if (!data.success) {
        setError(data.message || "Failed to save campaign");
        return;
      }
      onSaved?.(data.campaign);
    } catch (err) {
      console.error("Error saving campaign:", err);
      setError("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Partner vendors</label>
        <p className="text-xs text-gray-400 mb-2">
          Pool one or more partner vendors into this campaign -- the AI recommends across all of their products, but each
          vendor only ever earns (or owes commission on) a sale if their own product was actually recommended to that customer.
        </p>
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {partners.length === 0 && <p className="p-3 text-sm text-gray-400">No partner vendors yet.</p>}
          {partners.map((p) => (
            <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={storeIds.includes(p.id)}
                onChange={() => toggleStore(p.id)}
                className="rounded border-gray-300 text-brand-800 focus:ring-brand-300"
              />
              <span className="text-gray-800">{p.storeName}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Campaign banner</label>
        <p className="text-xs text-gray-400 mb-2">Used as the social-share image and on-site placement (homepage, footers).</p>
        {bannerUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-[16/9] max-w-sm">
            <img src={bannerUrl} alt="Campaign banner" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setBannerUrl("")}
              className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingBanner}
            className="flex items-center gap-2 px-4 py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            {uploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {uploadingBanner ? "Uploading..." : "Upload a banner image"}
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBannerSelect} className="hidden" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attribution window (hours)</label>
          <input
            type="number"
            min="1"
            value={attributionWindowHours}
            onChange={(e) => setAttributionWindowHours(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Campaign title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Find your signature scent"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
        />
      </div>

      <datalist id="campaign-tag-options">
        {availableTags.map((t) => (
          <option key={t.tag} value={t.tag} />
        ))}
      </datalist>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Questions</h2>
        {questions.map((q, qIndex) => (
          <div key={q.id} className="border border-gray-100 rounded-2xl p-4 space-y-3 bg-white">
            <div className="flex items-start gap-2">
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
                placeholder={`Question ${qIndex + 1}`}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
              {questions.length > 1 && (
                <button type="button" onClick={() => removeQuestion(qIndex)} className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-2 pl-3 border-l-2 border-brand-100">
              {q.options.map((o, oIndex) => (
                <div key={o.id} className="flex items-start gap-2">
                  <input
                    type="text"
                    value={o.label}
                    onChange={(e) => updateOption(qIndex, oIndex, { label: e.target.value })}
                    placeholder="Answer label"
                    className="w-40 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    list="campaign-tag-options"
                    value={o.tags.join(", ")}
                    onChange={(e) =>
                      updateOption(qIndex, oIndex, {
                        tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                      })
                    }
                    placeholder="tags, comma-separated"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                  />
                  <div className="flex flex-wrap gap-1 items-center pt-1.5 w-32 shrink-0">
                    {o.tags.map((t) => (
                      <span
                        key={t}
                        className={`text-[11px] px-1.5 py-0.5 rounded-full ${tagCount(t) > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
                      >
                        {t}: {tagCount(t)}
                      </span>
                    ))}
                  </div>
                  {q.options.length > 1 && (
                    <button type="button" onClick={() => removeOption(qIndex, oIndex)} className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(qIndex)}
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add answer
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900 font-medium"
        >
          <Plus className="w-4 h-4" /> Add question
        </button>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Results screen</h2>
        <input
          type="text"
          value={resultsHeading}
          onChange={(e) => setResultsHeading(e.target.value)}
          placeholder="Results heading"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
        />
        <textarea
          value={resultsIntro}
          onChange={(e) => setResultsIntro(e.target.value)}
          placeholder="Results intro copy"
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
        />
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">Max products shown</label>
          <input
            type="number"
            min="1"
            max="10"
            value={maxRecommendations}
            onChange={(e) => setMaxRecommendations(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          disabled={saving || storeIds.length === 0 || !title.trim()}
          onClick={() => handleSave("draft")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save as draft
        </button>
        <button
          type="button"
          disabled={saving || storeIds.length === 0 || !title.trim()}
          onClick={() => handleSave("active")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {status === "active" ? "Save" : "Publish"}
        </button>
      </div>
    </div>
  );
}
