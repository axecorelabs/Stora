import { colors, emailShell, defaultFooter, paragraph, label, button, card } from '../shared/brand.js';

const FEATURES = [
  ['Real-time tracking', 'Monitor stock levels instantly'],
  ['Free website', 'Auto-synced with your inventory'],
  ['POS system', 'Process sales seamlessly'],
  ['WhatsApp checkout', 'Direct order handoff option'],
  ['Advanced analytics', 'Weekly AI-powered insights'],
  ['Smart alerts', 'Low-stock notifications'],
];

// Two-column table, not CSS Grid -- Outlook desktop doesn't support Grid.
const featureGrid = () => {
  const cells = FEATURES.map(
    ([title, desc]) => `
      <td width="50%" style="padding:6px;">
        <div style="background-color:${colors.brand50};border-left:3px solid ${colors.brand600};border-radius:6px;padding:14px;">
          <p style="font-size:14px;font-weight:600;color:${colors.brand900};margin:0 0 4px;">${title}</p>
          <p style="font-size:12px;color:${colors.brand400};margin:0;">${desc}</p>
        </div>
      </td>`
  );
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}${cells[i + 1] || '<td width="50%"></td>'}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${rows.join('')}</table>`;
};

export const getWelcomeEmailTemplate = (firstName, email) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.stora.com.ng';

  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Your account is verified and your 14-day free trial has started -- you’re ready to manage your inventory on Stora.')}
    ${button(`${appUrl}/dashboard`, 'Go to your dashboard')}
    ${label('Your trial includes')}
    ${featureGrid()}
    ${card(`
      <p style="font-size:14px;font-weight:600;color:${colors.brand900};margin:0 0 10px;">Getting started</p>
      <p style="font-size:14px;color:${colors.brand900};line-height:1.9;margin:0;">
        1. Add your first inventory items<br>
        2. Set up your store information<br>
        3. Configure your free website<br>
        4. Start tracking sales with POS<br>
        5. Explore analytics and reports
      </p>
    `)}
    ${paragraph('Need help? Email <a href="mailto:support@app.stora.com.ng" style="color:' + colors.brand700 + ';">support@app.stora.com.ng</a> or use live chat from your dashboard.')}
  `;

  const html = emailShell({
    heading: 'Welcome aboard',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Welcome to Stora

Hi ${firstName},

Your account is verified and your 14-day free trial has started.

Your trial includes:
${FEATURES.map(([title, desc]) => `- ${title}: ${desc}`).join('\n')}

Getting started:
1. Add your first inventory items
2. Set up your store information
3. Configure your free website
4. Start tracking sales with POS
5. Explore analytics and reports

Go to your dashboard: ${appUrl}/dashboard

Need help? Email support@app.stora.com.ng or use live chat from your dashboard.

The Stora Team
  `.trim();

  return { html, text, subject: 'Welcome to Stora -- your trial has started' };
};
