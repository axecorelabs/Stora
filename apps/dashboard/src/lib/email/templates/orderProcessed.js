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

export const getOrderProcessedTemplate = (email, orderData, saleData, storeName = 'Stora Store') => {
  const totalRows = [
    row('Subtotal', formatCurrency(saleData.subtotal)),
    saleData.discount > 0 ? row('Discount', `-${formatCurrency(saleData.discount)}`) : '',
    saleData.tax > 0 ? row('Tax', formatCurrency(saleData.tax)) : '',
  ].join('');

  const body = `
    ${paragraph(`Hi ${orderData.customer.name},`)}
    ${paragraph('Your order has been processed and is ready for delivery. Your receipt is attached to this email.')}
    ${card(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          ${row('Order', `#${orderData.orderNumber}`)}
          ${row('Processed', formatDate(saleData.saleDate))}
          ${row('Transaction ID', saleData.transactionId)}
          ${row('Payment method', saleData.paymentMethod.charAt(0).toUpperCase() + saleData.paymentMethod.slice(1))}
        </tbody>
      </table>
    `)}
    ${label('Order items')}
    ${itemsTable(saleData.items)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tbody>
        ${totalRows}
        ${row('Total', formatCurrency(saleData.total), { emphasize: true })}
      </tbody>
    </table>
    ${label('Next steps')}
    <p style="font-size:14px;color:${colors.brand900};line-height:1.9;margin:0 0 20px;">
      Your order is being prepared for delivery. You&#39;ll get a delivery notification soon --
      please make sure someone&#39;s available to receive it.
    </p>
    ${paragraph(`<strong>${storeName}</strong>${orderData.customer.phone ? `<br>Phone: ${orderData.customer.phone}` : ''}<br>Email: <a href="mailto:support@app.stora.com.ng" style="color:${colors.brand700};">support@app.stora.com.ng</a>`)}
  `;

  const html = emailShell({
    heading: 'Order processed',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Order processed -- #${orderData.orderNumber}

Hi ${orderData.customer.name},

Your order has been processed and is ready for delivery.

Order Information:
- Order Number: ${orderData.orderNumber}
- Processed Date: ${formatDate(saleData.saleDate)}
- Transaction ID: ${saleData.transactionId}
- Payment Method: ${saleData.paymentMethod}

Order Items:
${saleData.items.map((item) => `${item.productName} - Qty: ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`).join('\n')}

Subtotal: ${formatCurrency(saleData.subtotal)}
${saleData.discount > 0 ? `Discount: -${formatCurrency(saleData.discount)}\n` : ''}${saleData.tax > 0 ? `Tax: ${formatCurrency(saleData.tax)}\n` : ''}Total: ${formatCurrency(saleData.total)}

Your order is being prepared for delivery. You'll get a delivery notification soon.

${storeName}
${orderData.customer.phone ? `Phone: ${orderData.customer.phone}\n` : ''}Email: support@app.stora.com.ng

Thank you for your purchase!
  `.trim();

  return { html, text, subject: `Order Processed - #${orderData.orderNumber}` };
};
