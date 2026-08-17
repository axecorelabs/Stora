"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import VerifyEmail from "./VerifyEmail";

export default function SignUp({ onToggleMode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signUp } = useAuth();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const passwordChecks = [
    { label: "At least 8 characters", valid: formData.password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(formData.password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(formData.password) },
    { label: "One number", valid: /\d/.test(formData.password) },
    { label: "One special character", valid: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) }
  ];

  const isPasswordValid = passwordChecks.every(check => check.valid);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!isPasswordValid) {
      newErrors.password = "Password does not meet all requirements";
    }
    
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the Terms of Service and Privacy Policy";
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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Show verification page instead of signing up immediately
        setUserEmail(formData.email);
        setShowVerification(true);
      } else {
        setErrors({ submit: data.message });
      }
    } catch (error) {
      setErrors({ submit: "Network error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSuccess = (user) => {
    // User has been verified and logged in automatically
    // The AuthContext will handle the redirect to dashboard
  };

  const handleBackFromVerification = () => {
    setShowVerification(false);
    setUserEmail("");
  };

  // Show verification page if needed
  if (showVerification) {
    return (
      <VerifyEmail
        email={userEmail}
        onBack={handleBackFromVerification}
        onVerified={handleVerificationSuccess}
      />
    );
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
            Create your account
          </h1>
          <p className="text-gray-500 text-sm text-center mt-1.5 mb-8">
            Join Stora and start managing your inventory
          </p>

          {errors.submit && (
            <div className="mb-5 border-l-2 border-red-500 bg-red-50 pl-3 pr-3 py-2.5 rounded-r-md">
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Name and Last Name side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First name"
                  className={`w-full rounded-xl border px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 transition-colors ${
                    errors.firstName
                      ? "border-red-300 focus:ring-red-100"
                      : "border-gray-200 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10"
                  }`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.firstName}</p>
                )}
              </div>
              <div>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last name"
                  className={`w-full rounded-xl border px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 transition-colors ${
                    errors.lastName
                      ? "border-red-300 focus:ring-red-100"
                      : "border-gray-200 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10"
                  }`}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.lastName}</p>
                )}
              </div>
            </div>

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
                  autoComplete="new-password"
                  className={`w-full rounded-xl border px-4 py-3 pr-11 text-[15px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 transition-colors ${
                    errors.password
                      ? "border-red-300 focus:ring-red-100"
                      : "border-gray-200 focus:border-[#0B3B2E] focus:ring-[#0B3B2E]/10"
                  }`}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.password}</p>
              )}

              {/* Password Requirements */}
              {formData.password && (
                <div className="mt-3 space-y-1.5">
                  {passwordChecks.map((check, index) => (
                    <div key={index} className="flex items-center text-xs">
                      <div
                        className={`w-1.5 h-1.5 rounded-full mr-2 ${
                          check.valid ? "bg-[#0B3B2E]" : "bg-gray-300"
                        }`}
                      ></div>
                      <span className={check.valid ? "text-[#0B3B2E]" : "text-gray-500"}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  name="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onChange={handleChange}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#0B3B2E] cursor-pointer"
                />
                I agree to the Terms of Service and Privacy Policy
              </label>
              {errors.agreeToTerms && (
                <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.agreeToTerms}</p>
              )}
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
                  Creating account...
                </>
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or continue with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <a
            href="/api/auth/google/start"
            className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 text-[15px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 01-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.1A12 12 0 0012 24z" />
              <path fill="#FBBC05" d="M5.31 14.32A7.2 7.2 0 014.91 12c0-.8.14-1.58.4-2.32v-3.1H1.3A12 12 0 000 12c0 1.94.46 3.77 1.3 5.42l4.01-3.1z" />
              <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.58l4.01 3.1C6.25 6.85 8.89 4.75 12 4.75z" />
            </svg>
            Continue with Google
          </a>

          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{" "}
            <button
              onClick={onToggleMode}
              className="text-[#0B3B2E] font-semibold hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
