import { formatCurrency, formatDateLong } from '../utils/formatters.js';

const getTimeSlotText = (slot) => {
  const slots = {
    'anytime': 'Anytime during the day',
    'morning': 'Morning (8AM - 12PM)',
    'afternoon': 'Afternoon (12PM - 5PM)',
    'evening': 'Evening (5PM - 8PM)'
  };
  return slots[slot] || 'Anytime';
};

const getDeliveryMethodText = (method) => {
  const methods = {
    'self_delivery': 'Our Delivery Team',
    'courier': 'Courier Service',
    'pickup': 'Customer Pickup'
  };
  return methods[method] || method;
};

export const getDeliveryScheduledTemplate = (email, deliveryData, saleData, storeName = 'IVMA Store') => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        /* ...existing styles from email.js delivery template... */
      </style>
    </head>
    <body>
      <!-- ...existing delivery HTML from email.js... -->
    </body>
    </html>
  `;

  const text = `
    Delivery Scheduled!
    
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
    ${saleData.items.map(item => `${item.productName} - Qty: ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`).join('\n')}
    
    Total: ${formatCurrency((saleData.total || 0) + (deliveryData.deliveryFee || 0))}
    ${deliveryData.paymentStatus !== 'paid' ? `Payment Status: ${deliveryData.paymentStatus.replace('_', ' ')}` : ''}
    
    ${deliveryData.notes ? `Special Instructions: ${deliveryData.notes}` : ''}
    
    Thank you for shopping with us!
    
    Best regards,
    ${storeName} Team
  `;

  return { 
    html, 
    text, 
    subject: `Delivery Scheduled - Order ${saleData.transactionId}` 
  };
};
