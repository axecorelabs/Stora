"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/customer/me", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.customer) {
            setCustomer(data.customer);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/customer/me", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.customer) {
          setCustomer(data.customer);
          setIsAuthenticated(true);
        }
      } else {
        setCustomer(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setCustomer(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData) => {
    try {
      setError(null);
      const response = await fetch("/api/auth/customer/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // Set customer data
      setCustomer(data.customer);

      return { success: true, customer: data.customer };
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
  };

  const setRedirectAfterLogin = (path) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("redirectAfterLogin", path);
    }
  };

  // Adopts a customer that has already been authenticated by a call this
  // context didn't make itself -- specifically, VerifyEmailModal's own POST
  // to /api/auth/customer/verify-email, which (via
  // emailVerification.autoSignInAfterVerification) already set a real
  // session cookie and returned the sanitized customer. SignInModal used to
  // immediately call login() again with the password it had saved for this
  // exact purpose -- functionally harmless (the account is verified by
  // then, so it succeeded), but a wasted round-trip that also fired a
  // second "new sign-in" notification email for one logical action.
  const adoptVerifiedSession = (customer) => {
    setCustomer(customer);
    setIsAuthenticated(true);

    if (typeof window !== "undefined") {
      const redirect = sessionStorage.getItem("redirectAfterLogin");
      if (redirect) {
        sessionStorage.removeItem("redirectAfterLogin");
        window.location.href = redirect;
      }
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/auth/customer/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCustomer(data.customer);
        setIsAuthenticated(true);

        // Handle redirect after login
        if (typeof window !== "undefined") {
          const redirect = sessionStorage.getItem("redirectAfterLogin");
          if (redirect) {
            sessionStorage.removeItem("redirectAfterLogin");
            window.location.href = redirect;
          }
        }

        return { success: true, customer: data.customer };
      } else if (data.needsVerification) {
        // User exists but email not verified
        setError(data.message);
        return { 
          success: false, 
          needsVerification: true, 
          error: data.message 
        };
      } else {
        setError(data.message);
        return { success: false, error: data.message };
      }
    } catch (error) {
      const errorMessage = "Login failed. Please try again.";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/customer/logout", {
        method: "POST",
        credentials: "include",
      });

      setCustomer(null);
      setIsAuthenticated(false);
      setError(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updateCustomer = (updatedData) => {
    setCustomer((prev) => ({ ...prev, ...updatedData }));
  };

  const value = {
    customer,
    isAuthenticated,
    isLoading,
    error,
    login,
    adoptVerifiedSession,
    register,
    logout,
    setRedirectAfterLogin,
    updateCustomer,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
