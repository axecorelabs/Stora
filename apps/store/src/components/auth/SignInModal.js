"use client";
import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, X, Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import VerifyEmailModal from "./VerifyEmailModal";

export default function SignInModal({ isOpen, onClose, onSwitchToSignUp, onForgotPassword, onSuccess }) {
  const { login, setRedirectAfterLogin } = useAuth();
  const pathname = usePathname();
  const googleStartUrl = `/api/auth/google/start?returnTo=${encodeURIComponent(pathname || "/")}`;
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState("");
  const [savedPassword, setSavedPassword] = useState("");

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        // Reset form
        setFormData({
          email: "",
          password: "",
          rememberMe: false,
        });
        setSavedPassword("");

        // Close modal
        onClose();
        onSuccess?.(result.customer);

        // Context will handle redirect if set
      } else if (result.needsVerification) {
        // User needs email verification - save credentials for auto-login after verification
        setEmailToVerify(formData.email);
        setSavedPassword(formData.password);
        setShowVerifyEmail(true);
        setErrors({ submit: result.error || "Please verify your email to continue" });
      } else {
        setErrors({ submit: result.error || "Login failed" });
      }
    } catch (error) {
      setErrors({ submit: "An unexpected error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        email: "",
        password: "",
        rememberMe: false,
      });
      setErrors({});
      setShowVerifyEmail(false);
      setEmailToVerify("");
      setSavedPassword("");
      onClose();
    }
  };

  const handleVerified = async (customer) => {
    // After verification, reset errors and automatically sign in
    setShowVerifyEmail(false);
    setErrors({});
    setIsSubmitting(true);
    
    try {
      // Automatically login with saved credentials
      const result = await login(emailToVerify, savedPassword);
      
      if (result.success) {
        // Reset form
        setFormData({
          email: "",
          password: "",
          rememberMe: false,
        });
        setSavedPassword("");
        setEmailToVerify("");

        // Close the sign-in modal
        onClose();
        onSuccess?.(result.customer);
      } else {
        // Show error if auto-login fails
        setErrors({ submit: result.error || "Login failed. Please try signing in again." });
      }
    } catch (error) {
      setErrors({ submit: "An unexpected error occurred. Please try signing in again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackFromVerify = () => {
    setShowVerifyEmail(false);
    setEmailToVerify("");
    setSavedPassword("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center shrink-0">
              <Image src="/stora-icon.png" alt="" width={18} height={21} className="h-5 w-auto" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-gray-900">Sign In</h2>
              <p className="text-sm text-gray-500 mt-0.5">Welcome back to Stora</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border text-gray-900 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm pr-10 ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } disabled:opacity-50`}
                />
                <div className="absolute right-3 top-2.5">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border text-gray-900 rounded-lg focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sm pr-10 ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isSubmitting}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="h-4 w-4 text-brand-700 focus:ring-brand-700/30 border-gray-300 rounded disabled:opacity-50"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onForgotPassword();
                }}
                className="text-sm text-brand-700 hover:text-brand-800"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-700 hover:bg-brand-800 text-white py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <a
              href={googleStartUrl}
              className="mt-4 flex items-center justify-center gap-3 w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-gray-700 font-medium text-sm">
                Sign in with Google
              </span>
            </a>
          </div>

          {/* Sign Up Link */}
          <div className="text-center mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <button
                onClick={onSwitchToSignUp}
                className="text-brand-700 font-medium hover:text-brand-800"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Verify Email Modal */}
      <VerifyEmailModal
        isOpen={showVerifyEmail}
        email={emailToVerify}
        onClose={handleClose}
        onVerified={handleVerified}
        onBack={handleBackFromVerify}
      />
    </div>
  );
}
