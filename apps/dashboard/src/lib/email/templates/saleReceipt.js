import { formatCurrency, formatDate } from '../utils/formatters.js';
import { colors, emailShell, defaultFooter, paragraph, label, card, row } from '../shared/brand.js';

const itemsTable = (items) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
    <thead>
      <tr>
        <th align="left" style="font-size:12px;font-weight:600;color:${colors.brand400};padding:10px;border-bottom:1px solid ${colors.brand100};">Product</th>
        <th align="center" style="font-size:12px;font-weight:600;color:${colors.brand400};padding:10px;border-bottom:1px solid ${colors.brand100};">Qty</th>
        <th align="right" style="font-size:12px;font-weight:600;color:${colors.brand400};padding:10px;border-bottom:1px solid ${colors.brand100};">Price</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `
        <tr>
          <td style="font-size:14px;color:${colors.brand900};padding:10px;border-bottom:1px solid ${colors.brand100};">${item.productName}</td>
          <td align="center" style="font-size:14px;color:${colors.brand900};padding:10px;border-bottom:1px solid ${colors.brand100};">${item.quantity}</td>
          <td align="right" style="font-size:14px;color:${colors.brand900};padding:10px;border-bottom:1px solid ${colors.brand100};">${formatCurrency(item.total)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>`;

// Separate from orderProcessed.js's template on purpose -- that one's copy
// ("ready for delivery", "you'll get a delivery notification") is about a
// shipped online order, which is wrong for an in-person walk-in sale that's
// already fully handed over at the till. Sent from apps/dashboard/src/app/
// api/pos/sales/route.js only for a genuine walk-in sale (never for POS's
// order-processing mode, which already gets its own delivery-flavored email
// via the order status route once marked delivered).
export const getSaleReceiptTemplate = (email, orderData, saleData, storeName = 'Stora Store') => {
  const totalRows = [
    row('Subtotal', formatCurrency(saleData.subtotal)),
    saleData.discount > 0 ? row('Discount', `-${formatCurrency(saleData.discount)}`) : '',
    saleData.tax > 0 ? row('Tax', formatCurrency(saleData.tax)) : '',
  ].join('');

  const body = `
    ${paragraph(`Hi ${orderData.customer.name},`)}
    ${paragraph('Thanks for your purchase! Your receipt is attached to this email.')}
    ${card(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          ${row('Receipt', `#${saleData.transactionId}`)}
          ${row('Date', formatDate(saleData.saleDate))}
          ${row('Payment method', saleData.paymentMethod.charAt(0).toUpperCase() + saleData.paymentMethod.slice(1))}
        </tbody>
      </table>
    `)}
    ${label('Items purchased')}
    ${itemsTable(saleData.items)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tbody>
        ${totalRows}
        ${row('Total', formatCurrency(saleData.total), { emphasize: true })}
      </tbody>
    </table>
    ${paragraph(`<strong>${storeName}</strong>${orderData.customer.phone ? `<br>Phone: ${orderData.customer.phone}` : ''}<br>Email: <a href="mailto:support@stora.com.ng" style="color:${colors.brand700};">support@stora.com.ng</a>`)}
  `;

  const html = emailShell({
    heading: 'Your receipt',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Your receipt -- #${saleData.transactionId}

Hi ${orderData.customer.name},

Thanks for your purchase!

Receipt: #${saleData.transactionId}
Date: ${formatDate(saleData.saleDate)}
Payment Method: ${saleData.paymentMethod}

Items:
${saleData.items.map((item) => `${item.productName} - Qty: ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`).join('\n')}

Subtotal: ${formatCurrency(saleData.subtotal)}
${saleData.discount > 0 ? `Discount: -${formatCurrency(saleData.discount)}\n` : ''}${saleData.tax > 0 ? `Tax: ${formatCurrency(saleData.tax)}\n` : ''}Total: ${formatCurrency(saleData.total)}

${storeName}
${orderData.customer.phone ? `Phone: ${orderData.customer.phone}\n` : ''}Email: support@stora.com.ng

Thank you for your purchase!
  `.trim();

  return { html, text, subject: `Your receipt - #${saleData.transactionId}` };
};
