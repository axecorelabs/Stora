import { colors, emailShell, defaultFooter, paragraph, card } from '../shared/brand.js';

export const getVerificationEmailTemplate = (verificationCode, firstName, email) => {
  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Thanks for signing up! To complete your registration and start managing your inventory, verify your email address using the code below.')}
    ${card(`<p style="font-size:32px;font-weight:700;letter-spacing:8px;color:${colors.brand800};margin:0;text-align:center;font-family:'Courier New',monospace;">${verificationCode}</p>`)}
    ${paragraph('This code expires in <strong>15 minutes</strong>.')}
    ${paragraph('Once verified, you’ll get instant access to your 14-day free trial: real-time inventory tracking, a free synced website, POS, WhatsApp checkout, and advanced reporting.')}
    ${paragraph('If you didn’t create this account, you can safely ignore this email.')}
  `;

  const html = emailShell({
    heading: 'Verify your email',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Verify your Stora account

Hi ${firstName},

Thanks for signing up! Use this code to verify your email address:

${verificationCode}

This code expires in 15 minutes.

If you didn't create this account, you can safely ignore this email.

The Stora Team
  `.trim();

  return { html, text, subject: 'Verify Your Stora Account' };
};
