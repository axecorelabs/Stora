import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import VerificationEmail from '@/emails/VerificationEmail';
import WelcomeEmail from '@/emails/WelcomeEmail';
import PasswordResetEmail from '@/emails/PasswordResetEmail';
import NewOrderNotification from '@/emails/NewOrderNotification';
import LoginAlertEmail from '@/emails/LoginAlertEmail';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465 (implicit TLS), false for STARTTLS ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify transporter configuration
export async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log('Email server is ready');
    return true;
  } catch (error) {
    console.error('Email server error:', error);
    return false;
  }
}

// Send verification email
export async function sendVerificationEmail(email, firstName, verificationCode) {
  const emailHtml = await render(VerificationEmail({ firstName, verificationCode }));
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify Your Stora Store Account',
    html: emailHtml,
    text: `Hi ${firstName},\n\nThank you for signing up! Your verification code is: ${verificationCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't create an account with Stora Store, please ignore this email.\n\nBest regards,\nThe Stora Store Team`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
}

// Send welcome email
export async function sendWelcomeEmail(email, firstName) {
  const siteUrl = process.env.NEXTAUTH_URL || 'https://app.stora.com.ng';
  const emailHtml = await render(WelcomeEmail({ firstName, siteUrl }));
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Welcome to Stora Store!',
    html: emailHtml,
    text: `Hi ${firstName},\n\nYour email has been verified successfully! You're now part of the Stora Store community.\n\nStart exploring amazing products from local artisans and vendors.\n\nVisit: ${siteUrl}\n\nHappy shopping!\nThe Stora Store Team`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email, name, resetUrl, expiryMinutes) {
  const emailHtml = await render(PasswordResetEmail({ name, resetUrl, expiryMinutes }));

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@stora.com.ng',
    to: email,
    subject: 'Reset Your Password - Stora Store',
    html: emailHtml,
    text: `
Hi ${name},

We received a request to reset your password for your Stora Store account.

Click the link below to reset your password:
${resetUrl}

This link will expire in ${expiryMinutes} minutes for security reasons.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

Need help? Contact us at support@stora.com.ng

© ${new Date().getFullYear()} Stora Store. All rights reserved.
    `.trim()
  };

  return await transporter.sendMail(mailOptions);
}

// Send a "new sign-in" security notification -- fired on every new
// session (password sign-in, Google sign-in, and the auto-login right
// after email verification), not just the explicit /login route.
export async function sendLoginAlertEmail(email, firstName, { browser, os, ipAddress, time }) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.stora.com.ng';
  const formattedTime = time.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }) + ' UTC';

  const emailHtml = await render(LoginAlertEmail({
    firstName, browser, os, ipAddress: ipAddress || 'Unknown', formattedTime, siteUrl
  }));

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@stora.com.ng',
    to: email,
    subject: 'New sign-in to your Stora account',
    html: emailHtml,
    text: `
Hi ${firstName},

Your Stora account was just signed into. If this was you, no action is needed.

Time: ${formattedTime}
Device: ${browser} on ${os}
IP address: ${ipAddress || 'Unknown'}

If you don't recognize this activity, sign in and reset your password right away: ${siteUrl}

© ${new Date().getFullYear()} Stora. All rights reserved.
    `.trim()
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending login alert email:', error);
    return { success: false, error: error.message };
  }
}

// Send new order notification to store owner
export async function sendNewOrderNotification(storeEmail, storeName, order) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.stora.com.ng';
  const emailHtml = await render(NewOrderNotification({ storeName, storeEmail, order, baseUrl }));
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@stora.com.ng',
    to: storeEmail,
    subject: `New Order #${order.orderNumber} - ${storeName}`,
    html: emailHtml,
    text: `
Hi ${storeName},

Great news! You have received a new order through your Stora store.

Order Details:
- Order Number: #${order.orderNumber}
- Customer: ${order.customerSnapshot.firstName} ${order.customerSnapshot.lastName}
- Phone: ${order.customerSnapshot.phone}
- Total Items: ${order.storeItemCount}
- Order Total: ₦${order.storeTotal.toLocaleString()}

Ordered Items:
${order.storeItems.map(item => `- ${item.product_name} (${item.quantity}x) - ₦${item.subtotal.toLocaleString()}`).join('\n')}

Delivery Address:
${order.shippingAddress.firstName} ${order.shippingAddress.lastName}
${order.shippingAddress.city}, ${order.shippingAddress.state}
Phone: ${order.shippingAddress.phone}

${order.customerNotes ? `Customer Notes: ${order.customerNotes}\n` : ''}

Next Steps:
1. Contact the customer via WhatsApp to confirm the order
2. Prepare the items for delivery
3. Update the order status in your dashboard
4. Arrange delivery or pickup with the customer

View full order details: ${baseUrl}/dashboard/orders/${order._id}

Thank you for using Stora Store!

© ${new Date().getFullYear()} Stora Store. All rights reserved.
    `.trim()
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Order notification sent to ${storeEmail}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending order notification to ${storeEmail}:`, error);
    return { success: false, error: error.message };
  }
}
