import { emailShell, defaultFooter, paragraph, card, row } from '../shared/brand.js';

export const getSubscriptionUpdateTemplate = (firstName, email, subscriptionDetails) => {
  const { plan, status, endDate } = subscriptionDetails;
  const dateLabel = status === 'active' ? 'Next billing date' : 'Expires on';

  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Your Stora subscription has been updated.')}
    ${card(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          ${row('Plan', plan)}
          ${row('Status', status.charAt(0).toUpperCase() + status.slice(1))}
          ${row(dateLabel, new Date(endDate).toLocaleDateString())}
        </tbody>
      </table>
    `)}
    ${paragraph('You can manage your subscription anytime from your dashboard.')}
  `;

  const html = emailShell({
    heading: 'Subscription update',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Subscription update

Hi ${firstName},

Your Stora subscription has been updated.

Plan: ${plan}
Status: ${status}
${dateLabel}: ${new Date(endDate).toLocaleDateString()}

You can manage your subscription anytime from your dashboard.

The Stora Team
  `.trim();

  return { html, text, subject: `Stora Subscription Update - ${plan} Plan` };
};
