"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordChecks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /\d/.test(password) },
    { label: "One special character", valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];
  const isPasswordValid = passwordChecks.every((check) => check.valid);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid. Please request a new one.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet all requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => router.push("/"), 2500);
      } else {
        setError(data.message || "Failed to reset password");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
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

          {success ? (
            <>
              <h1
                className="text-[28px] leading-tight font-bold text-[#0B3B2E] text-center tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Password reset
              </h1>
              <p className="text-gray-500 text-sm text-center mt-1.5">
                You can now sign in with your new password. Taking you there
                now...
              </p>
            </>
          ) : (
            <>
              <h1
                className="text-[28px] leading-tight font-bold text-[#0B3B2E] text-center tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Set a new password
              </h1>
              <p className="text-gray-500 text-sm text-center mt-1.5 mb-8">
                Choose a new password for your Stora account.
              </p>

              {!token && (
                <div className="mb-5 border-l-2 border-red-500 bg-red-50 pl-3 pr-3 py-2.5 rounded-r-md">
                  <p className="text-red-700 text-sm">
                    This reset link is invalid or incomplete. Please request a
                    new one from the sign in page.
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-5 border-l-2 border-red-500 bg-red-50 pl-3 pr-3 py-2.5 rounded-r-md">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New password"
                      autoComplete="new-password"
                      disabled={!token}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-11 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10 transition-colors disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {password && (
                    <div className="mt-3 space-y-1.5">
                      {passwordChecks.map((check, index) => (
                        <div key={index} className="flex items-center text-xs">
                          <div
                            className={`w-1.5 h-1.5 rounded-full mr-2 ${
                              check.valid ? "bg-[#0B3B2E]" : "bg-gray-300"
                            }`}
                          ></div>
                          <span
                            className={
                              check.valid ? "text-[#0B3B2E]" : "text-gray-500"
                            }
                          >
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    disabled={!token}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-11 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !token}
                  className="w-full bg-[#0B3B2E] text-white py-3.5 px-4 rounded-xl font-medium hover:bg-[#0F4A38] hover:shadow-[0_10px_30px_-10px_rgba(198,161,91,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? "Resetting..." : "Reset password"}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-gray-600 mt-6">
            <button
              onClick={() => router.push("/")}
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
