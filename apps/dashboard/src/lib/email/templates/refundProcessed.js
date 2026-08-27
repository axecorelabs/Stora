import { formatCurrency } from '../utils/formatters.js';
import { emailShell, defaultFooter, paragraph, card, row, notice } from '../shared/brand.js';

// Sent to the customer once a vendor records a refund. Deliberately never
// includes the vendor's free-text reason verbatim -- that note is written
// for the vendor's own bookkeeping, not phrased for a customer to read.
export const getRefundCustomerTemplate = (email, { orderNumber, customerName, storeName, amount, isFullRefund }) => {
  const body = `
    ${paragraph(`Hi ${customerName},`)}
    ${paragraph(`${storeName} has issued a ${isFullRefund ? 'full' : 'partial'} refund for your order.`)}
    ${card(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          ${row('Order', `#${orderNumber}`)}
          ${row('Store', storeName)}
          ${row('Amount refunded', formatCurrency(amount), { emphasize: true })}
        </tbody>
      </table>
    `)}
    ${notice(`This refund is arranged directly with ${storeName} -- it does not automatically reverse the original card charge. If you have questions about timing or method, contact ${storeName} directly.`)}
  `;

  const html = emailShell({
    heading: 'Refund issued',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Refund issued -- #${orderNumber}

Hi ${customerName},

${storeName} has issued a ${isFullRefund ? 'full' : 'partial'} refund for your order.

Order: #${orderNumber}
Store: ${storeName}
Amount refunded: ${formatCurrency(amount)}

This refund is arranged directly with ${storeName} -- it does not automatically reverse the original card charge. If you have questions about timing or method, contact ${storeName} directly.
  `.trim();

  return { html, text, subject: `Refund issued -- Order #${orderNumber}` };
};

// Sent to the vendor as a record of the refund they just submitted --
// their own confirmation, not a customer-facing document.
export const getRefundVendorTemplate = (email, { orderNumber, customerName, amount, isFullRefund, note, restockedItemNames }) => {
  const body = `
    ${paragraph(`Hi,`)}
    ${paragraph(`This confirms the ${isFullRefund ? 'full' : 'partial'} refund you recorded for order #${orderNumber}.`)}
    ${card(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          ${row('Order', `#${orderNumber}`)}
          ${row('Customer', customerName)}
          ${row('Amount refunded', formatCurrency(amount), { emphasize: true })}
          ${row('Reason', note)}
          ${restockedItemNames.length > 0 ? row('Restocked', restockedItemNames.join(', ')) : ''}
        </tbody>
      </table>
    `)}
    ${paragraph('This amount was recorded for your own records -- Stora does not move money as part of this action. Arrange any actual payment with your customer directly.')}
  `;

  const html = emailShell({
    heading: 'Refund recorded',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Refund recorded -- #${orderNumber}

This confirms the ${isFullRefund ? 'full' : 'partial'} refund you recorded for order #${orderNumber}.

Order: #${orderNumber}
Customer: ${customerName}
Amount refunded: ${formatCurrency(amount)}
Reason: ${note}
${restockedItemNames.length > 0 ? `Restocked: ${restockedItemNames.join(', ')}\n` : ''}
This amount was recorded for your own records -- Stora does not move money as part of this action. Arrange any actual payment with your customer directly.
  `.trim();

  return { html, text, subject: `Refund recorded -- Order #${orderNumber}` };
};
