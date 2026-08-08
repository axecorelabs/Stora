export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateLong = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export const getTimeSlotText = (slot) => {
  const slots = {
    'anytime': 'Anytime during the day',
    'morning': 'Morning (8AM - 12PM)',
    'afternoon': 'Afternoon (12PM - 5PM)',
    'evening': 'Evening (5PM - 8PM)'
  };
  return slots[slot] || 'Anytime';
};

export const getDeliveryMethodText = (method) => {
  const methods = {
    'self_delivery': 'Our Delivery Team',
    'courier': 'Courier Service',
    'pickup': 'Customer Pickup'
  };
  return methods[method] || method;
};
