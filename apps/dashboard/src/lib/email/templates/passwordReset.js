import { colors, emailShell, defaultFooter, paragraph, button, notice } from '../shared/brand.js';

export const getPasswordResetTemplate = (resetToken, firstName, email) => {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.stora.com.ng'}/reset-password?token=${resetToken}`;

  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('We received a request to reset your Stora account password. Click below to choose a new one.')}
    ${button(resetUrl, 'Reset password')}
    <p style="font-size:13px;color:${colors.brand400};margin:4px 0 8px;">Or paste this link into your browser:</p>
    <p style="font-size:12px;color:${colors.brand800};background-color:${colors.brand50};border-radius:6px;padding:12px;word-break:break-all;margin:0 0 20px;">${resetUrl}</p>
    ${notice('This link expires in <strong>15 minutes</strong>. If you didn’t request this, your password is unchanged -- just ignore this email.')}
    ${paragraph('Having trouble? Contact <a href="mailto:support@app.stora.com.ng" style="color:' + colors.brand700 + ';">support@app.stora.com.ng</a>.')}
  `;

  const html = emailShell({
    heading: 'Reset your password',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Reset your Stora password

Hi ${firstName},

We received a request to reset your Stora account password.

Reset it here: ${resetUrl}

This link expires in 1 hour. If you didn't request this, your password is unchanged -- just ignore this email.

Having trouble? Contact support@app.stora.com.ng

The Stora Team
  `.trim();

  return { html, text, subject: 'Reset Your Stora Password' };
};
