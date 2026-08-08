"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import ForgotPassword from "./ForgotPassword";

export default function SignIn({ onToggleMode }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const { signIn } = useAuth();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    // Clear submit error when user makes changes
    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    const result = await signIn(formData);

    if (!result.success) {
      setErrors({ submit: result.message, errorType: result.errorType });
    }

    setIsSubmitting(false);
  };

  if (showForgotPassword) {
    return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
  }

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

            <h1
              className="text-[28px] leading-tight font-bold text-[#0B3B2E] text-center tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sign in to your account
            </h1>
            <p className="text-gray-500 text-sm text-center mt-1.5 mb-8">
              Welcome back — let's get you to your dashboard.
            </p>

            {errors.submit && (
              <div className="mb-5 border-l-2 border-red-500 bg-red-50 pl-3 pr-3 py-2.5 rounded-r-md">
                <p className="text-red-700 text-sm">{errors.submit}</p>
                {errors.errorType === "USER_NOT_FOUND" && (
                  <p className="text-gray-600 text-xs mt-1.5">
                    Don't have an account?{" "}
                    <button
                      onClick={onToggleMode}
                      className="text-[#0B3B2E] font-semibold hover:underline"
                    >
                      Create one here
                    </button>
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  autoComplete="email"
                  className={`w-full rounded-xl border px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 transition-colors ${
                    errors.email
                      ? "border-red-300 focus:ring-red-100"
                      : "border-gray-200 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10"
                  }`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.email}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    autoComplete="current-password"
                    className={`w-full rounded-xl border px-4 py-3 pr-11 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 transition-colors ${
                      errors.password
                        ? "border-red-300 focus:ring-red-100"
                        : "border-gray-200 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10"
                    }`}
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
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:bg-[#0B3B2E] checked:border-[#0B3B2E] transition-colors cursor-pointer"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-[#0B3B2E] font-medium hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#0B3B2E] text-white py-3.5 px-4 rounded-xl font-medium hover:bg-[#0F4A38] hover:shadow-[0_10px_30px_-10px_rgba(198,161,91,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-6">
              Don't have an account?{" "}
              <button
                onClick={onToggleMode}
                className="text-[#0B3B2E] font-semibold hover:underline"
              >
                Sign Up
              </button>
            </p>
          </div>
      </div>
    </div>
  );
}
