// This file has been migrated to Supabase
// Re-exporting from supabaseAuth for backward compatibility
// TODO: Update all imports to use supabaseAuth directly

export {
  hashPassword,
  verifyPassword,
  createSession,
  verifyCustomerSession,
  deleteSession,
  logoutCustomer
} from './supabaseAuth';
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

// Validate email format
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
export function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);

  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas,
    checks: {
      length: password.length >= minLength,
      upperCase: hasUpperCase,
      lowerCase: hasLowerCase,
      numbers: hasNumbers,
      specialChars: hasNonalphas,
    }
  };
}
