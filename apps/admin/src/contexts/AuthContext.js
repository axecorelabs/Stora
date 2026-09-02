"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Trimmed version of apps/dashboard's own AuthContext -- same
// secureApiCall/signIn/signOut/checkAuth shape (so anyone who's worked in
// that app already knows this one), minus PostHog identify (not wired up
// in this app) and signUp/verifyEmail (no self-service signup here at
// all -- see betterAuth.js).
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  const secureApiCall = async (url, options = {}) => {
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        setUser(null);
        setIsAuthenticated(false);
        if (url.includes('/auth/signin')) {
          const errorData = await response.json().catch(() => ({}));
          return { success: false, message: errorData.message || 'Authentication failed' };
        }
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (url.includes('/auth/signin')) {
          return { success: false, message: errorData.message || `HTTP ${response.status}` };
        }
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      console.error('API call error:', error);
      throw error;
    }
  };

  const signIn = async (credentials) => {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setIsAuthenticated(true);
        router.push('/overview');
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || 'Sign in failed' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      router.push('/login');
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await checkAuth();
    })();
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    signIn,
    signOut,
    secureApiCall,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
