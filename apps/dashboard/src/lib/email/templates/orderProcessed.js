import { formatCurrency, formatDate } from '../utils/formatters.js';

export const getOrderProcessedTemplate = (email, orderData, saleData, storeName = 'IVMA Store') => {
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
        .order-details {
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
          <h1>Order Processed Successfully!</h1>
          <div class="success-badge">Ready for Delivery</div>
        </div>
        
        <p>Hi ${orderData.customer.name},</p>
        
        <p>Great news! Your order has been successfully processed and is now ready for delivery. We've attached your receipt to this email for your records.</p>
        
        <div class="order-details">
          <h3 style="margin-top: 0; color: #111827;">Order Information</h3>
          <div class="detail-row">
            <span class="detail-label">Order Number:</span>
            <span class="detail-value">${orderData.orderNumber}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Processed Date:</span>
            <span class="detail-value">${formatDate(saleData.saleDate)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Transaction ID:</span>
            <span class="detail-value">${saleData.transactionId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Payment Method:</span>
            <span class="detail-value" style="text-transform: capitalize;">${saleData.paymentMethod}</span>
          </div>
        </div>

        <div class="items-section">
          <h3 style="color: #111827;">Order Items</h3>
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
            <span>${formatCurrency(saleData.subtotal)}</span>
          </div>
          ${saleData.discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-${formatCurrency(saleData.discount)}</span>
            </div>
          ` : ''}
          ${saleData.tax > 0 ? `
            <div class="total-row">
              <span>Tax:</span>
              <span>${formatCurrency(saleData.tax)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>Total Amount:</span>
            <span>${formatCurrency(saleData.total)}</span>
          </div>
        </div>

        <div class="info-box">
          <strong style="color: #1e40af;">Next Steps:</strong><br>
          <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
            <li>Your order is being prepared for delivery</li>
            <li>You will receive a delivery notification soon</li>
            <li>Please ensure someone is available to receive your order</li>
            <li>Your receipt is attached to this email</li>
          </ul>
        </div>

        <p style="margin-top: 30px;">If you have any questions about your order, please don't hesitate to reach out to us.</p>

        <p><strong>Contact Information:</strong><br>
        ${storeName}<br>
        ${orderData.customer.phone ? `Phone: ${orderData.customer.phone}<br>` : ''}
        Email: support@ivma.ng</p>
        
        <p>Thank you for your purchase!</p>
        
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
    Order Processed Successfully!
    
    Hi ${orderData.customer.name},
    
    Your order has been successfully processed and is now ready for delivery.
    
    Order Information:
    - Order Number: ${orderData.orderNumber}
    - Processed Date: ${formatDate(saleData.saleDate)}
    - Transaction ID: ${saleData.transactionId}
    - Payment Method: ${saleData.paymentMethod}
    
    Order Items:
    ${saleData.items.map(item => `${item.productName} - Qty: ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`).join('\n')}
    
    Subtotal: ${formatCurrency(saleData.subtotal)}
    ${saleData.discount > 0 ? `Discount: -${formatCurrency(saleData.discount)}\n` : ''}${saleData.tax > 0 ? `Tax: ${formatCurrency(saleData.tax)}\n` : ''}Total: ${formatCurrency(saleData.total)}
    
    Next Steps:
    - Your order is being prepared for delivery
    - You will receive a delivery notification soon
    - Please ensure someone is available to receive your order
    - Your receipt is attached to this email
    
    Thank you for your purchase!
    
    Best regards,
    ${storeName} Team
    
    © ${new Date().getFullYear()} ${storeName}. All rights reserved.
  `;

  return { html, text, subject: `Order Processed - #${orderData.orderNumber}` };
};
