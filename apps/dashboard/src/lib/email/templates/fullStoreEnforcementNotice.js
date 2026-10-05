import { colors, emailShell, defaultFooter, paragraph, button } from '../shared/brand.js';

// One-time notice to existing full-store vendors ahead of
// evaluateFullStoreCommerceAccess's 'none'-status enforcement switch
// (apps/dashboard/src/lib/fullStoreSubscription.js) -- storefront/POS/
// inventory/payouts stay fully open until the stated date; this is the
// 7-day notice that IS the grace period for a first-time subscription
// requirement (no additional grace runs after the date the way a lapsed
// payment gets).
const ENFORCEMENT_DATE_LABEL = 'Monday, October 12, 2026';

// Each tier as its own bordered "card" (nested tables, inline styles only --
// the Outlook-safe pattern every template in this app already uses, no
// flexbox/grid) rather than the plain label/value table rows the first
// draft used -- large price, a struck-through monthly-equivalent for
// contrast, and a solid "SAVE X%" pill matching the dashboard picker's own
// gold badge treatment (FullStorePlanPicker.js).
const TIERS = [
  { label: 'Monthly', cadence: 'Billed every month', price: '₦3,500', was: null, savePercent: null, best: false },
  { label: '3 Months', cadence: 'Billed once every 3 months', price: '₦10,000', was: '₦10,500', savePercent: 5, best: false },
  { label: '6 Months', cadence: 'Billed once every 6 months', price: '₦20,000', was: '₦21,000', savePercent: 5, best: false },
  { label: 'Annual', cadence: 'Billed once a year', price: '₦39,000', was: '₦42,000', savePercent: 7, best: true }
];

// A reassurance card, not a warning -- brand.js's shared notice() is gold
// (this system's "pay attention" signal, already spent on the urgent
// subject line/intro above it), so stacking another gold box right after
// an "action needed" intro reads as doubling down on alarm instead of the
// calming "but not yet" it's meant to convey. Brand green + a checkmark
// instead, with a short bold headline and a lighter supporting line.
function reassuranceCard(headline, body) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="padding:16px 18px;background-color:${colors.brand50};border:1px solid ${colors.brand100};border-radius:10px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;width:26px;">
                <div style="width:20px;height:20px;border-radius:50%;background-color:${colors.brand600};color:#ffffff;font-size:12px;font-weight:700;text-align:center;line-height:20px;">&#10003;</div>
              </td>
              <td style="vertical-align:top;padding-left:10px;">
                <p style="font-size:14px;font-weight:700;color:${colors.brand900};margin:0 0 4px;">${headline}</p>
                <p style="font-size:13px;color:${colors.brand700};margin:0;line-height:1.5;">${body}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function tierCard(tier) {
  const borderColor = tier.best ? colors.gold400 : colors.brand100;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
      <tr>
        <td style="padding:16px 18px;background-color:#ffffff;border:1px solid ${borderColor};border-radius:10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;">
                ${tier.best ? `<p style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${colors.gold700};margin:0 0 4px;">Best value</p>` : ''}
                <p style="font-size:15px;font-weight:700;color:${colors.brand900};margin:0;">${tier.label}</p>
                <p style="font-size:12px;color:${colors.brand400};margin:4px 0 0;">${tier.cadence}</p>
              </td>
              <td style="vertical-align:top;text-align:right;" width="140">
                ${tier.savePercent ? `<span style="display:inline-block;background-color:${colors.gold700};color:#ffffff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;">SAVE ${tier.savePercent}%</span>` : ''}
                <p style="font-size:20px;font-weight:800;color:${colors.brand900};margin:${tier.savePercent ? '8px' : '0'} 0 0;">${tier.price}</p>
                ${tier.was ? `<p style="font-size:12px;color:${colors.brand400};text-decoration:line-through;margin:2px 0 0;">${tier.was}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export const getFullStoreEnforcementNoticeTemplate = (storeName, email) => {
  const greeting = storeName ? `Hi ${storeName},` : 'Hi there,';

  const body = `
    ${paragraph(greeting)}
    ${paragraph(`Starting <strong>${ENFORCEMENT_DATE_LABEL}</strong>, keeping your full store active on Stora will require an active subscription -- your storefront, POS, inventory, and payouts stay fully open until then, no action needed yet.`)}

    ${reassuranceCard(
      `Nothing changes before ${ENFORCEMENT_DATE_LABEL}`,
      'Your storefront, POS, inventory, and payouts stay fully active until then -- this is advance notice, not a charge.'
    )}

    <p style="font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${colors.brand400};margin:28px 0 12px;">Choose your plan</p>
    ${TIERS.map(tierCard).join('')}

    <div style="margin:24px 0 20px;">
      ${button('https://app.stora.com.ng/dashboard/subscription', 'Subscribe now')}
    </div>

    ${paragraph("Questions about the change? Just reply to this email -- we're happy to help.")}
  `;

  const html = emailShell({
    heading: 'Your full-store subscription starts soon',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Your full-store subscription starts soon

${greeting}

Starting ${ENFORCEMENT_DATE_LABEL}, keeping your full store active on Stora will require an active subscription -- your storefront, POS, inventory, and payouts stay fully open until then, no action needed yet.

Nothing changes before ${ENFORCEMENT_DATE_LABEL}. This is a heads-up, not an immediate charge.

Choose your plan:
${TIERS.map((t) => `- ${t.label} (${t.cadence}): ${t.price}${t.was ? ` (was ${t.was}, save ${t.savePercent}%)` : ''}${t.best ? ' -- Best value' : ''}`).join('\n')}

Subscribe: https://app.stora.com.ng/dashboard/subscription

Questions about the change? Just reply to this email -- we're happy to help.

The Stora Team
  `.trim();

  return { html, text, subject: `Action needed by ${ENFORCEMENT_DATE_LABEL}: keep your Stora store active` };
};
