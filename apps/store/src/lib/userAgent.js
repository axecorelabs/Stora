// Best-effort "Browser on OS" summary for the login-notification email --
// not device fingerprinting, just enough for a customer to recognize (or
// not recognize) a session. Order matters: Edge/Opera/Chrome UAs all
// contain "Safari/", and Edge/Opera also contain "Chrome/", so the more
// specific checks have to run first.
export function parseUserAgent(userAgent) {
  if (!userAgent) return { browser: 'Unknown browser', os: 'Unknown device' };

  let os = 'Unknown device';
  if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'iOS';
  else if (/Mac OS X/i.test(userAgent)) os = 'Mac';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  let browser = 'Unknown browser';
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(userAgent)) browser = 'Opera';
  else if (/Chrome\//i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/Safari\//i.test(userAgent)) browser = 'Safari';

  return { browser, os };
}
