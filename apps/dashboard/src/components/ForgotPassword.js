"use client";
import { useState } from "react";

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.message || "Something went wrong. Please try again.");
      }
    } catch (err) {
      setError("Network error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full grid lg:grid-cols-2 overflow-hidden animate-rise-in bg-white">
      {/* Hero panel */}
      <div className="hidden lg:block relative">
        <img
          src="/stora3.png"
          alt="Stora — manage your store, grow your business"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-8 py-12 sm:px-14 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex justify-center lg:hidden mb-6">
            <div className="w-12 h-12 rounded-xl overflow-hidden">
              <img
                src="/stora.png"
                alt="Stora Logo"
                className="object-contain w-full h-full"
              />
            </div>
          </div>

          {submitted ? (
            <>
              <h1
                className="text-[28px] leading-tight font-bold text-[#0B3B2E] text-center tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Check your email
              </h1>
              <p className="text-gray-500 text-sm text-center mt-1.5 mb-8">
                If an account exists for{" "}
                <span className="text-gray-700 font-medium">{email}</span>, a
                password reset link is on its way. It expires in 15 minutes.
              </p>
            </>
          ) : (
            <>
              <h1
                className="text-[28px] leading-tight font-bold text-[#0B3B2E] text-center tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Reset your password
              </h1>
              <p className="text-gray-500 text-sm text-center mt-1.5 mb-8">
                Enter the email on your account and we'll send you a reset
                link.
              </p>

              {error && (
                <div className="mb-5 border-l-2 border-red-500 bg-red-50 pl-3 pr-3 py-2.5 rounded-r-md">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10 transition-colors"
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#0B3B2E] text-white py-3.5 px-4 rounded-xl font-medium hover:bg-[#0F4A38] hover:shadow-[0_10px_30px_-10px_rgba(198,161,91,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? "Sending..." : "Send reset link"}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-gray-600 mt-6">
            <button
              onClick={onBack}
              className="text-[#0B3B2E] font-semibold hover:underline"
            >
              Back to sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
