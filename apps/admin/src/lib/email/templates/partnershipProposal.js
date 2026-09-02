import { colors, emailShell, defaultFooter, paragraph, label, button, card, row } from '../shared/brand.js';

function formatRate(rateType, rateValue) {
  return rateType === 'flat'
    ? `₦${Number(rateValue).toLocaleString()} per campaign-driven order`
    : `${(Number(rateValue) * 100).toFixed(0)}% of each campaign-driven sale`;
}

// Sent when an admin proposes a partner_contracts row (see
// apps/admin/src/app/api/partners/[storeId]/contracts/route.js). The
// vendor reviews and accepts/declines from a modal in their own
// dashboard (apps/dashboard's PartnershipProposalModal) -- this email is
// just the notification, not the acceptance flow itself.
export const getPartnershipProposalTemplate = (firstName, { storeName, rateType, rateValue, terms }) => {
  const appUrl = process.env.VENDOR_DASHBOARD_URL || 'https://app.stora.com.ng';

  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph(`Stora would like to propose a partnership for <strong>${storeName}</strong> -- we'll drive customers to you through a marketing campaign, in exchange for the terms below on any sale it generates.`)}
    ${label('Proposed terms')}
    ${card(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Store', storeName)}
        ${row('Rate on campaign-driven sales', formatRate(rateType, rateValue), { emphasize: true })}
        ${row('Platform fee on these sales', 'Always covered by the customer, never you')}
      </table>
      ${terms ? `<p style="font-size:13px;color:${colors.brand900};margin:14px 0 0;line-height:1.6;">${terms}</p>` : ''}
    `)}
    ${button(`${appUrl}/dashboard/overview`, 'Review the proposal')}
    ${paragraph(`Log into your dashboard to review the full terms and accept or decline -- nothing changes for your store until you do.`)}
  `;

  const html = emailShell({
    heading: 'A partnership proposal from Stora',
    bodyHtml: body,
    footerHtml: defaultFooter()
  });

  const text = `
A partnership proposal from Stora

Hi ${firstName},

Stora would like to propose a partnership for ${storeName} -- we'll drive customers to you through a marketing campaign, in exchange for the terms below on any sale it generates.

Proposed terms:
- Rate on campaign-driven sales: ${formatRate(rateType, rateValue)}
- Platform fee on these sales: always covered by the customer, never you
${terms ? `\n${terms}\n` : ''}
Log into your dashboard to review and accept or decline: ${appUrl}/dashboard/overview

Nothing changes for your store until you respond.

The Stora Team
  `.trim();

  return { html, text, subject: `Stora partnership proposal for ${storeName}` };
};
