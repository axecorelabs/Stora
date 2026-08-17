"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, MessageSquareText, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import StarRating from "@/components/ui/StarRating";
import StarRatingInput from "./StarRatingInput";

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Lives on the product detail page, inside one specific vendor's
// storefront -- unlike the cross-vendor discovery cards, using that
// vendor's own primaryColor here is correct, not a brand-boundary
// violation (see components/home/DiscoveryProductCard.js's comment on
// the same distinction).
export default function ProductReviews({ productId, averageRating, totalReviews, primaryColor }) {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [eligibility, setEligibility] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fetchReviews = useCallback(async (page, replace) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews?page=${page}`);
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => (replace ? data.reviews : [...prev, ...data.reviews]));
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews(1, true);
  }, [fetchReviews]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEligibility(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}/reviews/eligibility`, { credentials: "include" });
        const data = await res.json();
        if (!cancelled && data.success) setEligibility(data);
      } catch (error) {
        console.error("Error checking review eligibility:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, isAuthenticated]);

  const openForm = () => {
    if (eligibility?.existingReview) {
      setFormRating(eligibility.existingReview.rating);
      setFormComment(eligibility.existingReview.comment || "");
    } else {
      setFormRating(0);
      setFormComment("");
    }
    setSubmitError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formRating < 1) {
      setSubmitError("Pick a star rating");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating: formRating, comment: formComment })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.message || "Failed to save review");
        return;
      }
      setShowForm(false);
      setEligibility((prev) => ({ ...prev, alreadyReviewed: true, existingReview: data.review }));
      fetchReviews(1, true);
    } catch (error) {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!eligibility?.existingReview) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${eligibility.existingReview.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        setEligibility((prev) => ({ ...prev, alreadyReviewed: false, existingReview: null }));
        setShowForm(false);
        fetchReviews(1, true);
      }
    } catch (error) {
      console.error("Error deleting review:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchReviews(pagination.page + 1, false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-gray-900 mb-1.5">Reviews</h2>
          {totalReviews > 0 ? (
            <div className="flex items-center gap-2">
              <StarRating rating={averageRating} size={15} />
              <span className="text-sm text-gray-500 tabular-nums">
                {averageRating.toFixed(1)} · {totalReviews} review{totalReviews === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No reviews yet</p>
          )}
        </div>

        {eligibility?.canReview && !showForm && (
          <button
            onClick={openForm}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex-shrink-0 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            <Pencil className="w-3.5 h-3.5" />
            {eligibility.alreadyReviewed ? "Edit your review" : "Write a review"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2">Your rating</p>
          <StarRatingInput value={formRating} onChange={setFormRating} />

          <p className="text-sm font-medium text-gray-700 mt-4 mb-2">Your review (optional)</p>
          <textarea
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            placeholder="What did you think of this product?"
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 resize-none"
          />

          {submitError && <p className="text-sm text-red-600 mt-2">{submitError}</p>}

          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? "Saving…" : eligibility?.alreadyReviewed ? "Save changes" : "Submit review"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            {eligibility?.alreadyReviewed && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-50 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquareText className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Be the first to review this product.</p>
        </div>
      ) : (
        <>
          <div className="space-y-5">
            {reviews.map((review) => (
              <div key={review.id} className="pb-5 border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-sm font-semibold text-gray-900">{review.reviewerName}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(review.createdAt)}</span>
                </div>
                <StarRating rating={review.rating} size={13} />
                {review.comment && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{review.comment}</p>
                )}
              </div>
            ))}
          </div>

          {pagination?.hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? "Loading…" : "Load more reviews"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
