import { formatCurrency, formatDate, getTimeSlotText, getDeliveryMethodText } from '../utils/formatters.js';

export const getDeliveryScheduledTemplate = (email, deliveryData, saleData, storeName = 'IVMA Store') => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          width: 60px;
          height: 60px;
          background: #0d9488;
          border-radius: 12px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        h1 {
          color: #111827;
          margin: 0;
          font-size: 24px;
        }
        .success-badge {
          background: #d1fae5;
          color: #065f46;
          padding: 8px 16px;
          border-radius: 20px;
          display: inline-block;
          font-size: 14px;
          font-weight: 600;
          margin: 20px 0;
        }
        .delivery-details {
          background: #f3f4f6;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: #6b7280;
          font-size: 14px;
        }
        .detail-value {
          color: #111827;
          font-weight: 500;
          font-size: 14px;
        }
        .items-section {
          margin: 20px 0;
        }
        .item {
          display: flex;
          justify-content: space-between;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .item-info {
          flex: 1;
        }
        .item-name {
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
        }
        .item-quantity {
          color: #6b7280;
          font-size: 13px;
        }
        .item-price {
          font-weight: 600;
          color: #111827;
        }
        .address-box {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .address-title {
          font-weight: 600;
          color: #92400e;
          margin-bottom: 8px;
        }
        .address-text {
          color: #78350f;
          font-size: 14px;
        }
        .total-section {
          border-top: 2px solid #e5e7eb;
          padding-top: 15px;
          margin-top: 15px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 14px;
        }
        .total-row.grand-total {
          font-size: 18px;
          font-weight: bold;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          margin-top: 10px;
        }
        .info-box {
          background: #dbeafe;
          border-left: 4px solid #3b82f6;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Delivery Scheduled!</h1>
          <div class="success-badge">✓ Confirmed</div>
        </div>
        
        <p>Hi ${deliveryData.customerName},</p>
        
        <p>Great news! Your delivery has been scheduled and confirmed. We'll deliver your order on the date and time specified below.</p>
        
        <div class="delivery-details">
          <h3 style="margin-top: 0; color: #111827;">Delivery Information</h3>
          <div class="detail-row">
            <span class="detail-label">Order Number:</span>
            <span class="detail-value">${saleData.transactionId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Delivery Date:</span>
            <span class="detail-value">${formatDate(deliveryData.scheduledDate)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time Slot:</span>
            <span class="detail-value">${getTimeSlotText(deliveryData.timeSlot)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Delivery Method:</span>
            <span class="detail-value">${getDeliveryMethodText(deliveryData.deliveryMethod)}</span>
          </div>
          ${deliveryData.priority === 'urgent' || deliveryData.priority === 'high' ? `
            <div class="detail-row">
              <span class="detail-label">Priority:</span>
              <span class="detail-value" style="color: #dc2626; text-transform: uppercase;">${deliveryData.priority}</span>
            </div>
          ` : ''}
        </div>

        <div class="address-box">
          <div class="address-title">📍 Delivery Address</div>
          <div class="address-text">
            ${deliveryData.address.fullAddress}<br>
            ${deliveryData.address.city}, ${deliveryData.address.state}
            ${deliveryData.address.postalCode ? ` ${deliveryData.address.postalCode}` : ''}
          </div>
        </div>

        <div class="items-section">
          <h3 style="color: #111827;">Items in Your Order</h3>
          ${saleData.items.map(item => `
            <div class="item">
              <div class="item-info">
                <div class="item-name">${item.productName}</div>
                <div class="item-quantity">Quantity: ${item.quantity} × ${formatCurrency(item.unitPrice)}</div>
              </div>
              <div class="item-price">${formatCurrency(item.total)}</div>
            </div>
          `).join('')}
        </div>

        <div class="total-section">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(saleData.subtotal || saleData.total)}</span>
          </div>
          ${deliveryData.deliveryFee > 0 ? `
            <div class="total-row">
              <span>Delivery Fee:</span>
              <span>${formatCurrency(deliveryData.deliveryFee)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>Total Amount:</span>
            <span>${formatCurrency((saleData.total || 0) + (deliveryData.deliveryFee || 0))}</span>
          </div>
          ${deliveryData.paymentStatus !== 'paid' ? `
            <div class="total-row" style="color: #dc2626;">
              <span>Payment Status:</span>
              <span style="text-transform: capitalize;">${deliveryData.paymentStatus.replace('_', ' ')}</span>
            </div>
          ` : ''}
        </div>

        ${deliveryData.notes ? `
          <div class="info-box">
            <strong style="color: #1e40af;">Special Instructions:</strong><br>
            <span style="color: #1e3a8a;">${deliveryData.notes}</span>
          </div>
        ` : ''}

        <div class="info-box">
          <strong style="color: #1e40af;">What to expect:</strong><br>
          <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
            <li>Our delivery team will contact you before delivery</li>
            <li>Please ensure someone is available to receive the order</li>
            ${deliveryData.paymentStatus === 'cash_on_delivery' ? '<li>Payment will be collected upon delivery</li>' : ''}
            <li>For any changes, please contact us immediately</li>
          </ul>
        </div>

        <p style="margin-top: 30px;">If you have any questions about your delivery, please don't hesitate to reach out to us.</p>

        <p><strong>Contact Information:</strong><br>
        ${storeName}<br>
        ${deliveryData.customerPhone ? `Phone: ${deliveryData.customerPhone}<br>` : ''}
        Email: support@ivma.ng</p>
        
        <p>Thank you for shopping with us!</p>
        
        <p>Best regards,<br>${storeName} Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
          <p>Powered by IVMA - Intelligent Inventory Management & Analytics</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Delivery Scheduled!
    
    Hi ${deliveryData.customerName},
    
    Your delivery has been scheduled and confirmed.
    
    Delivery Information:
    - Order Number: ${saleData.transactionId}
    - Delivery Date: ${formatDate(deliveryData.scheduledDate)}
    - Time Slot: ${getTimeSlotText(deliveryData.timeSlot)}
    - Delivery Method: ${getDeliveryMethodText(deliveryData.deliveryMethod)}
    
    Delivery Address:
    ${deliveryData.address.fullAddress}
    ${deliveryData.address.city}, ${deliveryData.address.state}
    
    Items in Your Order:
    ${saleData.items.map(item => `${item.productName} - Qty: ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`).join('\n')}
    
    Total: ${formatCurrency((saleData.total || 0) + (deliveryData.deliveryFee || 0))}
    ${deliveryData.paymentStatus !== 'paid' ? `Payment Status: ${deliveryData.paymentStatus.replace('_', ' ')}` : ''}
    
    ${deliveryData.notes ? `Special Instructions: ${deliveryData.notes}` : ''}
    
    What to expect:
    - Our delivery team will contact you before delivery
    - Please ensure someone is available to receive the order
    ${deliveryData.paymentStatus === 'cash_on_delivery' ? '- Payment will be collected upon delivery' : ''}
    
    Thank you for shopping with us!
    
    Best regards,
    ${storeName} Team
    
    © ${new Date().getFullYear()} ${storeName}. All rights reserved.
  `;

  return { html, text, subject: `Delivery Scheduled - Order ${saleData.transactionId}` };
};
