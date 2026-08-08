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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // Secure API call function for JSON requests
  const secureApiCall = async (url, options = {}) => {
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal, // Pass through abort signal
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 401) {
        // Unauthorized - clear user session but don't throw for auth endpoints
        setUser(null);
        setIsAuthenticated(false);
        
        // Only throw error for protected endpoints, not auth endpoints
        if (url.includes('/auth/signin') || url.includes('/auth/signup')) {
          const errorData = await response.json().catch(() => ({}));
          return { success: false, message: errorData.message || 'Authentication failed' };
        }
        
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // For auth endpoints, return the error instead of throwing
        if (url.includes('/auth/signin') || url.includes('/auth/signup')) {
          return { success: false, message: errorData.message || `HTTP ${response.status}` };
        }
        
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // Don't log or throw AbortError - it's intentional
      if (error.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      
      console.error('API call error:', error);
      throw error;
    }
  };

  // Secure API call function for FormData/multipart requests
  const secureFormDataCall = async (url, formData, options = {}) => {
    const defaultOptions = {
      method: 'POST',
      credentials: 'include',
      // Don't set Content-Type header for FormData - let browser set it
    };

    const config = {
      ...defaultOptions,
      ...options,
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Unauthorized - clear user session
        setUser(null);
        setIsAuthenticated(false);
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('FormData API call failed:', error);
      throw error;
    }
  };

  // Sign in function
  const signIn = async (credentials) => {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setIsAuthenticated(true);
        // Redirect to dashboard after successful signin
        router.push('/dashboard');
        return { success: true, user: data.user };
      } else {
        // Return error without throwing, include errorType if present
        return { 
          success: false, 
          message: data.message || 'Sign in failed',
          errorType: data.errorType 
        };
      }
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  };

  // Sign up function
  const signUp = async (userData) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setIsAuthenticated(true);
        // Redirect to dashboard after successful signup
        router.push('/dashboard');
        return { success: true, user: data.user };
      } else {
        // Return error without throwing
        return { success: false, message: data.message || 'Sign up failed' };
      }
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      setUser(null);
      setIsAuthenticated(false);
      // Redirect to home page after signout
      router.push('/');
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      // Clear local state even if API call fails
      setUser(null);
      setIsAuthenticated(false);
      router.push('/');
      return { success: false, message: 'Sign out failed' };
    }
  };

  // Add verify email function
  const verifyEmail = async (email, code) => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, verificationCode: code }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setIsAuthenticated(true);
        // Redirect to dashboard after successful verification
        router.push('/dashboard');
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message || 'Verification failed' };
      }
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  };

  // Check authentication status on app load
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
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
        // User not authenticated - this is normal, don't log as error
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      // Network or other errors
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
    verifyEmail,
    secureApiCall,
    secureFormDataCall,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
