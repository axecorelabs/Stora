import { colors, emailShell, defaultFooter, paragraph, notice, card, row } from '../shared/brand.js';

export const getLoginAlertTemplate = ({ firstName, email, browser, os, ipAddress, time }) => {
  const formattedTime = time.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }) + ' UTC';

  const detailsTable = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Time', formattedTime)}
      ${row('Device', `${browser} on ${os}`)}
      ${row('IP address', ipAddress || 'Unknown')}
    </table>`;

  const body = `
    ${paragraph(`Hi ${firstName},`)}
    ${paragraph('Your Stora account was just signed into. If this was you, no action is needed.')}
    ${card(detailsTable)}
    ${notice(`If you don't recognize this activity, <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:${colors.gold700};font-weight:700;">sign in</a> and reset your password right away.`)}
  `;

  const html = emailShell({
    heading: 'New sign-in to your account',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
New sign-in to your Stora account

Hi ${firstName},

Your Stora account was just signed into. If this was you, no action is needed.

Time: ${formattedTime}
Device: ${browser} on ${os}
IP address: ${ipAddress || 'Unknown'}

If you don't recognize this activity, sign in and reset your password right away: ${process.env.NEXT_PUBLIC_APP_URL}

The Stora Team
  `.trim();

  return { html, text, subject: 'New sign-in to your Stora account' };
};
