"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StarRating from '@/components/ui/StarRating';
import StarRatingInput from '@/components/product/StarRatingInput';

function formatReviewDate(value) {
  try {
    return new Date(value).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

export default function BusinessProfileReviews({
  storeId,
  initialAverageRating = 0,
  initialTotalReviews = 0
}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState({
    averageRating: Number(initialAverageRating || 0),
    totalReviews: Number(initialTotalReviews || 0)
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [eligibility, setEligibility] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadReviews = useCallback(async (page, replace) => {
    if (!storeId) return;

    if (replace) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`/api/listings/${storeId}/reviews?page=${page}`);
      const data = await res.json();

      if (data.success) {
        setReviews((prev) => (replace ? data.reviews : [...prev, ...data.reviews]));
        setPagination(data.pagination);
        if (data.summary) {
          setSummary({
            averageRating: Number(data.summary.averageRating || 0),
            totalReviews: Number(data.summary.totalReviews || 0)
          });
        }
      }
    } catch (error) {
      console.error('Error loading listing reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [storeId]);

  const loadEligibility = useCallback(async () => {
    if (!storeId || !isAuthenticated) {
      setEligibility({ canReview: false, alreadyReviewed: false, existingReview: null });
      return;
    }

    try {
      const res = await fetch(`/api/listings/${storeId}/reviews/eligibility`, { credentials: 'include' });
      const data = await res.json();
      if (!data.success) return;

      setEligibility(data);
      if (data.existingReview) {
        setFormRating(data.existingReview.rating || 0);
        setFormComment(data.existingReview.comment || '');
      } else {
        setFormRating(0);
        setFormComment('');
      }
    } catch (error) {
      console.error('Error checking listing review eligibility:', error);
    }
  }, [storeId, isAuthenticated]);

  useEffect(() => {
    loadReviews(1, true);
  }, [loadReviews]);

  useEffect(() => {
    if (!authLoading) {
      loadEligibility();
    }
  }, [authLoading, loadEligibility]);

  const ratingLabel = useMemo(() => {
    if (summary.totalReviews <= 0) return 'No ratings yet';
    return `${summary.averageRating.toFixed(1)} · ${summary.totalReviews} review${summary.totalReviews === 1 ? '' : 's'}`;
  }, [summary]);

  const handleSubmit = async () => {
    setSubmitError('');

    if (formRating < 1 || formRating > 5) {
      setSubmitError('Pick a star rating');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${storeId}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: formRating, comment: formComment })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.message || 'Failed to save review');
        return;
      }

      setShowForm(false);
      await loadReviews(1, true);
      await loadEligibility();
    } catch (error) {
      console.error('Error saving listing review:', error);
      setSubmitError('Failed to save review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!eligibility?.existingReview) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/listing-reviews/${eligibility.existingReview.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.message || 'Failed to delete review');
        return;
      }

      setShowForm(false);
      setFormRating(0);
      setFormComment('');
      await loadReviews(1, true);
      await loadEligibility();
    } catch (error) {
      console.error('Error deleting listing review:', error);
      setSubmitError('Failed to delete review');
    } finally {
      setSubmitting(false);
    }
  };

  const loadMore = () => {
    if (!pagination?.hasMore || loadingMore) return;
    loadReviews(pagination.page + 1, false);
  };

  return (
    <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-gray-900">Business ratings</h2>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-900">
          <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
          {ratingLabel}
        </div>
      </div>

      {summary.totalReviews > 0 && (
        <div className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
          <StarRating rating={summary.averageRating} size={15} />
          <span>{summary.averageRating.toFixed(1)} average rating</span>
        </div>
      )}

      {!authLoading && (
        <div className="mt-4">
          {!isAuthenticated ? (
            <p className="text-sm text-gray-500">Sign in to leave a rating for this business.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="rounded-xl border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
              >
                {eligibility?.alreadyReviewed ? 'Edit your rating' : 'Rate this business'}
              </button>
              {eligibility?.alreadyReviewed && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  Remove rating
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && isAuthenticated && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="mb-2 text-sm font-medium text-gray-800">Your rating</p>
          <StarRatingInput value={formRating} onChange={setFormRating} size={24} />

          <textarea
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Optional comment about your experience"
            className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none ring-brand-800/20 transition focus:ring"
          />

          {submitError && <p className="mt-2 text-sm text-red-600">{submitError}</p>}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save rating
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-gray-500">No ratings yet. Be the first to rate this business.</p>
        ) : (
          <>
            {reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{review.reviewerName}</p>
                  <p className="text-xs text-gray-500">{formatReviewDate(review.createdAt)}</p>
                </div>
                <div className="mt-1">
                  <StarRating rating={review.rating} size={14} />
                </div>
                {review.comment && <p className="mt-2 text-sm text-gray-700">{review.comment}</p>}
              </article>
            ))}

            {pagination?.hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-100 px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load more ratings'}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}