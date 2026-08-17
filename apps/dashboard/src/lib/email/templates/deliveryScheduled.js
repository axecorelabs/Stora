import { formatCurrency, formatDateLong, getTimeSlotText, getDeliveryMethodText } from '../utils/formatters.js';
import { colors, emailShell, defaultFooter, paragraph, label, card, notice, row } from '../shared/brand.js';

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

// This template's html field was previously an unfinished placeholder
// comment -- every delivery-scheduled email shipped with an empty body,
// with only the plain-text fallback actually carrying content. Rebuilt
// here from the complete (but orphaned and never-imported) sibling
// implementation in templates/delivery.js.
export const getDeliveryScheduledTemplate = (email, deliveryData, saleData, storeName = 'Stora Store') => {
  const detailRows = [
    row('Order number', saleData.transactionId),
    row('Delivery date', formatDateLong(deliveryData.scheduledDate)),
    row('Time slot', getTimeSlotText(deliveryData.timeSlot)),
    row('Delivery method', getDeliveryMethodText(deliveryData.deliveryMethod)),
    ['urgent', 'high'].includes(deliveryData.priority)
      ? row('Priority', deliveryData.priority.toUpperCase())
      : '',
  ].join('');

  const total = (saleData.total || 0) + (deliveryData.deliveryFee || 0);
  const totalRows = [
    row('Subtotal', formatCurrency(saleData.subtotal || saleData.total)),
    deliveryData.deliveryFee > 0 ? row('Delivery fee', formatCurrency(deliveryData.deliveryFee)) : '',
    row('Total', formatCurrency(total), { emphasize: true }),
    deliveryData.paymentStatus !== 'paid'
      ? row('Payment status', deliveryData.paymentStatus.replace('_', ' '))
      : '',
  ].join('');

  const body = `
    ${paragraph(`Hi ${deliveryData.customerName},`)}
    ${paragraph('Your delivery has been scheduled and confirmed -- here are the details.')}
    ${card(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tbody>${detailRows}</tbody>
      </table>
    `)}
    ${label('Delivery address')}
    <p style="font-size:14px;color:${colors.brand900};line-height:1.6;margin:0 0 24px;">
      ${deliveryData.address.fullAddress}<br>
      ${deliveryData.address.city}, ${deliveryData.address.state}${deliveryData.address.postalCode ? ` ${deliveryData.address.postalCode}` : ''}
    </p>
    ${label('Items in your order')}
    ${itemsTable(saleData.items)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tbody>${totalRows}</tbody>
    </table>
    ${deliveryData.notes ? notice(`<strong>Special instructions:</strong> ${deliveryData.notes}`) : ''}
    <p style="font-size:14px;color:${colors.brand900};line-height:1.9;margin:0 0 20px;">
      Our delivery team will contact you before arriving -- please have someone available to
      receive the order.${deliveryData.paymentStatus === 'cash_on_delivery' ? ' Payment will be collected on delivery.' : ''}
      For any changes, contact us right away.
    </p>
    ${paragraph(`<strong>${storeName}</strong>${deliveryData.customerPhone ? `<br>Phone: ${deliveryData.customerPhone}` : ''}<br>Email: <a href="mailto:support@app.stora.com.ng" style="color:${colors.brand700};">support@app.stora.com.ng</a>`)}
  `;

  const html = emailShell({
    heading: 'Delivery scheduled',
    bodyHtml: body,
    footerHtml: defaultFooter(email),
  });

  const text = `
Delivery scheduled

Hi ${deliveryData.customerName},

Your delivery has been scheduled and confirmed.

Delivery Information:
- Order Number: ${saleData.transactionId}
- Delivery Date: ${formatDateLong(deliveryData.scheduledDate)}
- Time Slot: ${getTimeSlotText(deliveryData.timeSlot)}
- Delivery Method: ${getDeliveryMethodText(deliveryData.deliveryMethod)}

Delivery Address:
${deliveryData.address.fullAddress}
${deliveryData.address.city}, ${deliveryData.address.state}

Items in Your Order:
${saleData.items.map((item) => `${item.productName} - Qty: ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`).join('\n')}

Total: ${formatCurrency(total)}
${deliveryData.paymentStatus !== 'paid' ? `Payment Status: ${deliveryData.paymentStatus.replace('_', ' ')}` : ''}

${deliveryData.notes ? `Special Instructions: ${deliveryData.notes}` : ''}

Thank you for shopping with us!

${storeName} Team
  `.trim();

  return {
    html,
    text,
    subject: `Delivery Scheduled - Order ${saleData.transactionId}`,
  };
};
