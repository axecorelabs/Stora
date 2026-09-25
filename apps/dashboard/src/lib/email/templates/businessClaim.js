import { colors, emailShell, defaultFooter, paragraph, card } from '../shared/brand.js';

// Sent to the BUSINESS's own listed email (stores.store_email), not the
// claimant's personal account email -- this is the actual verification
// signal: whoever can read this inbox controls the contact info already
// publicly listed for the business, which is what "claiming" is meant to
// prove. See apps/dashboard/src/app/api/claims/[storeId]/send-code/route.js.
export const getBusinessClaimEmailTemplate = (verificationCode, storeName, email) => {
  const body = `
    ${paragraph(`Someone is claiming <strong>${storeName}</strong> on Stora using this email address.`)}
    ${paragraph('If this is you, enter the code below to verify and take ownership of your business listing.')}
    ${card(`<p style="font-size:32px;font-weight:700;letter-spacing:8px;color:${colors.brand800};margin:0;text-align:center;font-family:'Courier New',monospace;">${verificationCode}</p>`)}
    ${paragraph('This code expires in <strong>10 minutes</strong>.')}
    ${paragraph('If you did not request this, or this is not your business, you can safely ignore this email -- no changes will be made without the code above.')}
  `;

  const html = emailShell({
    heading: 'Verify your business',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Verify your business on Stora

Someone is claiming ${storeName} on Stora using this email address.

If this is you, use this code to verify and take ownership of your listing:

${verificationCode}

This code expires in 10 minutes.

If you did not request this, you can safely ignore this email -- no changes will be made without the code above.

The Stora Team
  `.trim();

  return { html, text, subject: `Verify your claim to ${storeName} on Stora` };
};
