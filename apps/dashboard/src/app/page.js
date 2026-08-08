"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import SignIn from "../components/SignIn";
import SignUp from "../components/SignUp";

export default function Home() {
  const [authMode, setAuthMode] = useState("signin");
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const toggleAuthMode = () => {
    setAuthMode(authMode === "signin" ? "signup" : "signin");
  };

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  // Show auth pages when not authenticated
  return authMode === "signin" ? (
    <SignIn onToggleMode={toggleAuthMode} />
  ) : (
    <SignUp onToggleMode={toggleAuthMode} />
  );
}
