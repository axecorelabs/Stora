"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";

export default function VerifyEmail({ email, onBack, onVerified }) {
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  const { verifyEmail } = useAuth();

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCooldown]);

  const handleInputChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) nextInput.focus();
    }

    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
        const newCode = [...verificationCode];
        newCode[index - 1] = "";
        setVerificationCode(newCode);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const newCode = pastedData.split("").concat(Array(6).fill("")).slice(0, 6);
    setVerificationCode(newCode);
    
    // Focus the last filled input or first empty input
    const lastFilledIndex = Math.min(pastedData.length - 1, 5);
    const targetInput = document.getElementById(`code-${lastFilledIndex}`);
    if (targetInput) targetInput.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const code = verificationCode.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const result = await verifyEmail(email, code);

    if (result.success) {
      // AuthContext will handle the redirect to dashboard
      onVerified(result.user);
    } else {
      setError(result.message || "Verification failed");
      // Clear the code on error
      setVerificationCode(["", "", "", "", "", ""]);
      const firstInput = document.getElementById("code-0");
      if (firstInput) firstInput.focus();
    }

    setIsSubmitting(false);
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCanResend(false);
        setResendCooldown(60);
        setError("");
        // Show success message briefly
        setError("New code sent to your email!");
        setTimeout(() => setError(""), 3000);
      } else {
        setError(data.message || "Failed to resend code");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Background with subtle pattern */}
      <div className="absolute inset-0 z-0 bg-white">
        {/* Subtle Gradient Accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50"></div>

        {/* Subtle Blur Spots for Depth */}
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-30 blur-3xl bg-gray-100"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-30 blur-3xl bg-gray-100"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl bg-green-50"></div>
      </div>

      {/* Header */}
      <div className="p-6 relative z-10">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-md">
          {/* Email Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-3xl mb-6 shadow-lg border border-gray-200">
              <Mail className="w-10 h-10 text-green-600" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Check your inbox!
            </h1>
            
            <p className="text-gray-600 text-sm leading-relaxed">
              We've sent a 6-digit verification code to<br />
              <span className="font-semibold text-gray-900">{email}</span>
            </p>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code Input */}
            <div className="flex justify-center space-x-3">
              {verificationCode.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-12 text-center text-lg font-semibold bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                  autoComplete="off"
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-center">
                <p className={`text-sm ${error.includes("sent") ? "text-green-400" : "text-red-400"}`}>
                  {error}
                </p>
              </div>
            )}

            {/* Verify Button */}
            <button
              type="submit"
              disabled={isSubmitting || verificationCode.join("").length !== 6}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-black hover:shadow-lg hover:shadow-green-500/30 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          {/* Resend Code */}
          <div className="text-center mt-6 space-y-4">
            <p className="text-sm text-gray-600">
              Didn't receive it?{" "}
              <button
                onClick={handleResendCode}
                disabled={!canResend}
                className={`font-medium underline ${
                  canResend
                    ? "text-green-600 hover:text-green-700"
                    : "text-gray-400 cursor-not-allowed"
                }`}
              >
                {canResend ? "Resend Code" : `Resend Code (${resendCooldown}s)`}
              </button>
            </p>

            <button
              onClick={onBack}
              className="text-sm text-gray-600 hover:text-gray-900 underline font-medium"
            >
              Change email address
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 relative z-10">
        <div className="flex justify-center space-x-6 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-700">Help Center</a>
          <a href="#" className="hover:text-gray-700">Privacy Policy</a>
          <a href="#" className="hover:text-gray-700">Support</a>
        </div>
      </div>
    </div>
  );
}
