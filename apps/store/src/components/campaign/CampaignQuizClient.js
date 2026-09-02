"use client";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles, ShoppingBag, Check } from "lucide-react";
import PrefetchLink from "@/components/ui/PrefetchLink";
import { storeHref } from "@/lib/storeUrl";
import { useCart } from "@/contexts/CartContext";

// One question at a time -> submits all answers on the final question ->
// shows AI-matched recommendations pooled across every vendor in this
// campaign. Completing this quiz is what sets the attribution cookie
// (via the /complete route) that orders/create/route.js later checks to
// apply each recommended vendor's own partner-contract rate -- the
// actual matching/attribution logic lives server-side
// (openrouter.js/campaignScoring.js + the route handler), this
// component is purely the question flow + results display.
export default function CampaignQuizClient({ campaign, bannerUrl }) {
  const { addToCart } = useCart();
  const questions = campaign.config?.questions || [];
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("quiz"); // quiz | submitting | results | error
  const [results, setResults] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);
  const [addError, setAddError] = useState(null);

  const currentQuestion = questions[stepIndex];
  const isLastQuestion = stepIndex === questions.length - 1;

  const selectOption = async (optionId) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: optionId };
    setAnswers(nextAnswers);

    if (!isLastQuestion) {
      setStepIndex((i) => i + 1);
      return;
    }

    setPhase("submitting");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers })
      });
      const data = await res.json();
      if (!data.success) {
        setPhase("error");
        return;
      }
      setResults(data);
      setPhase("results");
    } catch (error) {
      console.error("Error completing campaign quiz:", error);
      setPhase("error");
    }
  };

  const handleAddToCart = async (product) => {
    setAddingId(product.id);
    setAddError(null);
    try {
      const result = await addToCart(product.id, 1);
      if (result.success) {
        setAddedIds((prev) => new Set(prev).add(product.id));
      } else {
        setAddError(result.error || "Failed to add to cart");
      }
    } catch (error) {
      console.error("Error adding recommended product to cart:", error);
      setAddError("Failed to add to cart");
    } finally {
      setAddingId(null);
    }
  };

  const progress = questions.length > 0 ? Math.round(((stepIndex + (phase === "quiz" ? 0 : 1)) / questions.length) * 100) : 0;

  if (!currentQuestion && phase === "quiz") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {bannerUrl && phase !== "results" && (
        <div className="w-full h-40 sm:h-56 bg-brand-900 overflow-hidden">
          <img src={bannerUrl} alt="" className="w-full h-full object-cover opacity-90" />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          Stora Quiz
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-8">{campaign.title}</h1>

        {phase === "quiz" && currentQuestion && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400">
                Question {stepIndex + 1} of {questions.length}
              </p>
              <p className="text-xs text-gray-400">{progress}%</p>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full mb-6 overflow-hidden">
              <div className="h-full bg-gold-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{currentQuestion.text}</h2>
            <div className="space-y-2">
              {(currentQuestion.options || []).map((option) => (
                <button
                  key={option.id}
                  onClick={() => selectOption(option.id)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50/40 transition-colors text-sm font-medium text-gray-800"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "submitting" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="w-6 h-6 text-brand-700 animate-spin" />
            <p className="text-sm text-gray-400">Finding your matches...</p>
          </div>
        )}

        {phase === "error" && (
          <p className="text-sm text-red-600">
            Something went wrong finishing the quiz. Please try again.
          </p>
        )}

        {phase === "results" && results && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{results.resultsHeading}</h2>
            <p className="text-sm text-gray-500 mb-6">{results.resultsIntro}</p>
            {addError && (
              <p className="text-sm text-red-600 mb-4">{addError}</p>
            )}
            {results.recommendedProducts.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No matches found -- try a different set of answers.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.recommendedProducts.map((product) => {
                  const isAdded = addedIds.has(product.id);
                  return (
                    <div
                      key={product.id}
                      className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] transition-shadow duration-200"
                    >
                      <PrefetchLink href={storeHref(product.storeSlug, `/product/${product.id}?from=campaign&campaign=${campaign.id}`)}>
                        {product.image && (
                          <div className="aspect-square bg-gray-50">
                            <img src={product.image} alt={product.productName} className="w-full h-full object-cover" />
                          </div>
                        )}
                      </PrefetchLink>
                      <div className="p-4 flex flex-col flex-1">
                        {product.storeName && (
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-600 mb-1 truncate">{product.storeName}</p>
                        )}
                        <p className="text-sm font-semibold text-gray-900 truncate">{product.productName}</p>
                        <p className="text-sm text-gray-500 mt-1 mb-3">
                          ₦{Number(product.sellingPrice || 0).toLocaleString("en-NG")}
                        </p>
                        <div className="mt-auto flex items-center gap-2">
                          <PrefetchLink
                            href={storeHref(product.storeSlug, `/product/${product.id}?from=campaign&campaign=${campaign.id}`)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                          >
                            View <ArrowRight className="w-3 h-3" />
                          </PrefetchLink>
                          {!product.hasVariants && (
                            <button
                              onClick={() => handleAddToCart(product)}
                              disabled={addingId === product.id || isAdded}
                              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-70 ${
                                isAdded ? "bg-green-50 text-green-700" : "bg-brand-800 text-white hover:bg-brand-900"
                              }`}
                            >
                              {addingId === product.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isAdded ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <ShoppingBag className="w-3.5 h-3.5" />
                              )}
                              {isAdded ? "Added" : "Add to cart"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
