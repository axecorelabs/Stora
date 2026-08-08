import nodemailer from 'nodemailer';
import { getOrderProcessedTemplate } from './email/templates/orderProcessed.js';
import { getDeliveryScheduledTemplate } from './email/templates/deliveryScheduled.js';
import { generateReceiptPDF } from './email/utils/pdfGenerator.js';

// Determine which email provider to use
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'nodemailer'; // 'nodemailer' or 'resend'

// Nodemailer configuration with better error handling
const createNodemailerTransporter = () => {
  // Validate required environment variables
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPassword = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
  
  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error('SMTP configuration incomplete. Please check your .env.local file.');
  }

  const config = {
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    // Add these options to prevent connection issues
    pool: true,
    maxConnections: 5,
    maxMessages: 10,
    rateDelta: 1000,
    rateLimit: 5,
    // Prevent IPv6 issues
    family: 4, // Force IPv4
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 30000,
    // TLS options
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2'
    }
  };

  return nodemailer.createTransport(config);
};

// Resend configuration
const sendWithResend = async (to, subject, html, text) => {
  try {
    // Validate Resend API key
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'IVMA <noreply@ivma.ng>',
      to,
      subject,
      html,
      text,
    });

    return { success: true, messageId: response.id };
  } catch (error) {
    console.error('Resend email error:', error);
    return { success: false, error: error.message };
  }
};

// Generic send email function with retry logic
const sendEmail = async (to, subject, html, text = '', retries = 2) => {
  try {
    if (EMAIL_PROVIDER === 'resend') {
      return await sendWithResend(to, subject, html, text);
    } else {
      // Default to Nodemailer
      let lastError;
      
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const transporter = createNodemailerTransporter();
          
          // Verify connection before sending
          await transporter.verify();
          
          const mailOptions = {
            from: process.env.EMAIL_FROM || 'IVMA <noreply@ivma.ng>',
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
          };

          const info = await transporter.sendMail(mailOptions);
          
          // Close the transporter
          transporter.close();
          
          return { success: true, messageId: info.messageId };
        } catch (error) {
          lastError = error;
          
          // Wait before retrying (exponential backoff)
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      }
      
      // All retries failed
      throw lastError;
    }
  } catch (error) {
    console.error('Email sending error:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to send email';
    
    if (error.code === 'ESOCKET' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Unable to connect to email server. Please check SMTP configuration.';
    } else if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check SMTP credentials.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection timed out.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      code: error.code
    };
  }
};

// Send verification email
export const sendVerificationEmail = async (email, verificationCode, firstName) => {
  const subject = 'Verify Your IVMA Account';
  
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
        .verification-code {
          background: #f3f4f6;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .code {
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #0d9488;
          font-family: 'Courier New', monospace;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 20px 0;
          font-size: 14px;
        }
        ul {
          padding-left: 20px;
        }
        li {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">IVMA</div>
          <h1>Welcome to IVMA!</h1>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>Thanks for signing up! To complete your registration and start managing your inventory, please verify your email address using the code below:</p>
        
        <div class="verification-code">
          <div class="code">${verificationCode}</div>
        </div>
        
        <p>This code will expire in <strong>15 minutes</strong>.</p>
        
        <div class="warning">
          <strong>⚠️ Security Note:</strong> If you didn't create an account with IVMA, please ignore this email or contact our support team.
        </div>
        
        <p>Once verified, you'll get instant access to:</p>
        <ul>
          <li>14-day free trial with all premium features</li>
          <li>Real-time inventory tracking</li>
          <li>Free website with inventory sync</li>
          <li>Advanced reporting and analytics</li>
          <li>WhatsApp checkout integration</li>
          <li>And much more!</li>
        </ul>
        
        <p>Need help? Our support team is here for you 24/7.</p>
        
        <p>Best regards,<br>The IVMA Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} IVMA. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
          <p>IVMA - Intelligent Inventory Management & Analytics</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to IVMA!
    
    Hi ${firstName},
    
    Thanks for signing up! To complete your registration, please verify your email address using this code:
    
    ${verificationCode}
    
    This code will expire in 15 minutes.
    
    If you didn't create an account with IVMA, please ignore this email.
    
    Best regards,
    The IVMA Team
    
    © ${new Date().getFullYear()} IVMA. All rights reserved.
  `;

  return await sendEmail(email, subject, html, text);
};

// Send welcome email after successful verification
export const sendWelcomeEmail = async (email, firstName) => {
  const subject = 'Welcome to IVMA - Your Account is Ready!';
  
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
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: #0d9488;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 30px 0;
        }
        .feature-item {
          background: #f9fafb;
          padding: 15px;
          border-radius: 8px;
          border-left: 3px solid #0d9488;
        }
        .feature-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 5px;
        }
        .feature-desc {
          font-size: 13px;
          color: #6b7280;
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
          <div class="logo">IVMA</div>
          <h1>Welcome Aboard!</h1>
          <div class="success-badge">✓ Account Verified</div>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>🎉 Congratulations! Your IVMA account has been successfully created and verified. You're now ready to revolutionize how you manage your inventory!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ivma.ng'}/dashboard" class="button">
            Go to Your Dashboard →
          </a>
        </div>
        
        <h2 style="color: #111827; font-size: 18px; margin-top: 30px;">Your 14-Day Trial Includes:</h2>
        
        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-title">📊 Real-Time Tracking</div>
            <div class="feature-desc">Monitor stock levels instantly</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">🌐 Free Website</div>
            <div class="feature-desc">Auto-synced with inventory</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">💳 POS System</div>
            <div class="feature-desc">Process sales seamlessly</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">📱 WhatsApp Integration</div>
            <div class="feature-desc">Direct checkout option</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">📈 Advanced Analytics</div>
            <div class="feature-desc">Weekly AI-powered insights</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">🔔 Smart Alerts</div>
            <div class="feature-desc">Low-stock notifications</div>
          </div>
        </div>
        
        <h3 style="color: #111827; font-size: 16px; margin-top: 30px;">Getting Started:</h3>
        <ol style="padding-left: 20px;">
          <li style="margin: 10px 0;">Add your first inventory items</li>
          <li style="margin: 10px 0;">Set up your store information</li>
          <li style="margin: 10px 0;">Configure your free website</li>
          <li style="margin: 10px 0;">Start tracking sales with POS</li>
          <li style="margin: 10px 0;">Explore analytics and reports</li>
        </ol>
        
        <p style="margin-top: 30px;">Need help? We're here for you:</p>
        <ul style="padding-left: 20px;">
          <li>📧 Email: support@ivma.ng</li>
          <li>💬 Live Chat: Available in your dashboard</li>
          <li>📚 Help Center: ivma.ng/help</li>
        </ul>
        
        <p style="margin-top: 30px;">Best regards,<br>The IVMA Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} IVMA. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
          <p>IVMA - Intelligent Inventory Management & Analytics</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome Aboard!
    
    Hi ${firstName},
    
    Congratulations! Your IVMA account has been successfully created and verified.
    
    Your 14-Day Trial Includes:
    - Real-Time Tracking: Monitor stock levels instantly
    - Free Website: Auto-synced with inventory
    - POS System: Process sales seamlessly
    - WhatsApp Integration: Direct checkout option
    - Advanced Analytics: Weekly AI-powered insights
    - Smart Alerts: Low-stock notifications
    
    Getting Started:
    1. Add your first inventory items
    2. Set up your store information
    3. Configure your free website
    4. Start tracking sales with POS
    5. Explore analytics and reports
    
    Go to your dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://ivma.ng'}/dashboard
    
    Need help?
    - Email: support@ivma.ng
    - Live Chat: Available in your dashboard
    - Help Center: ivma.ng/help
    
    Best regards,
    The IVMA Team
    
    © ${new Date().getFullYear()} IVMA. All rights reserved.
  `;

  return await sendEmail(email, subject, html, text);
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://ivma.ng'}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your IVMA Password';
  
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
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: #0d9488;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 20px 0;
          font-size: 14px;
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
          <div class="logo">IVMA</div>
          <h1>Password Reset Request</h1>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>We received a request to reset your IVMA account password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" class="button">
            Reset My Password
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #0d9488;">${resetUrl}</p>
        
        <p>This link will expire in <strong>1 hour</strong> for security reasons.</p>
        
        <div class="warning">
          <strong>⚠️ Security Note:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        </div>
        
        <p>If you're having trouble, contact our support team at support@ivma.ng</p>
        
        <p>Best regards,<br>The IVMA Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} IVMA. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
          <p>IVMA - Intelligent Inventory Management & Analytics</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request
    
    Hi ${firstName},
    
    We received a request to reset your IVMA account password.
    
    Click this link to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour for security reasons.
    
    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
    
    If you're having trouble, contact our support team at support@ivma.ng
    
    Best regards,
    The IVMA Team
    
    © ${new Date().getFullYear()} IVMA. All rights reserved.
  `;

  return await sendEmail(email, subject, html, text);
};

// Send subscription update email
export const sendSubscriptionUpdateEmail = async (email, firstName, subscriptionDetails) => {
  const { plan, status, endDate } = subscriptionDetails;
  const subject = `IVMA Subscription Update - ${plan} Plan`;
  
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
        .info-box {
          background: #f9fafb;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
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
          <div class="logo">IVMA</div>
          <h1>Subscription Update</h1>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>Your IVMA subscription has been updated successfully.</p>
        
        <div class="info-box">
          <div class="info-row">
            <strong>Plan:</strong>
            <span>${plan}</span>
          </div>
          <div class="info-row">
            <strong>Status:</strong>
            <span style="text-transform: capitalize;">${status}</span>
          </div>
          <div class="info-row">
            <strong>${status === 'active' ? 'Next Billing Date' : 'Expires On'}:</strong>
            <span>${new Date(endDate).toLocaleDateString()}</span>
          </div>
        </div>
        
        <p>You can manage your subscription anytime from your dashboard.</p>
        
        <p>Best regards,<br>The IVMA Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} IVMA. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Subscription Update
    
    Hi ${firstName},
    
    Your IVMA subscription has been updated successfully.
    
    Plan: ${plan}
    Status: ${status}
    ${status === 'active' ? 'Next Billing Date' : 'Expires On'}: ${new Date(endDate).toLocaleDateString()}
    
    You can manage your subscription anytime from your dashboard.
    
    Best regards,
    The IVMA Team
  `;

  return await sendEmail(email, subject, html, text);
};

// Send delivery scheduled email
export const sendDeliveryScheduledEmail = async (email, deliveryData, saleData, storeName = 'IVMA Store') => {
  const { html, text, subject } = getDeliveryScheduledTemplate(email, deliveryData, saleData, storeName);
  return await sendEmail(email, subject, html, text);
};

// Send order processed email with receipt
export const sendOrderProcessedEmail = async (email, orderData, saleData, storeName = 'IVMA Store', storeLogoUrl = null, brandingColors = null) => {
  const { html, text, subject } = getOrderProcessedTemplate(email, orderData, saleData, storeName);
  
  // Generate receipt PDF with logo and branding
  const receiptAttachment = await generateReceiptPDF(orderData, saleData, storeName, storeLogoUrl, brandingColors);
  
  // Send email with attachment
  return await sendEmailWithAttachment(email, subject, html, text, receiptAttachment);
};

// Helper function to send email with attachment
const sendEmailWithAttachment = async (to, subject, html, text, attachment) => {
  try {
    if (EMAIL_PROVIDER === 'resend') {
      // Resend with attachment
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const emailData = {
        from: process.env.EMAIL_FROM || 'IVMA <noreply@ivma.ng>',
        to,
        subject,
        html,
        text,
      };

      if (attachment) {
        emailData.attachments = [{
          filename: attachment.filename,
          content: Buffer.from(attachment.content, 'base64'),
        }];
      }

      const response = await resend.emails.send(emailData);
      return { success: true, messageId: response.id };
      
    } else {
      // Nodemailer with attachment
      const transporter = createNodemailerTransporter();
      await transporter.verify();
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'IVMA <noreply@ivma.ng>',
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      };

      if (attachment) {
        mailOptions.attachments = [{
          filename: attachment.filename,
          content: attachment.content,
          encoding: attachment.encoding,
          contentType: attachment.contentType
        }];
      }

      const info = await transporter.sendMail(mailOptions);
      transporter.close();
      
      return { success: true, messageId: info.messageId };
    }
  } catch (error) {
    console.error('Email with attachment error:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code
    };
  }
};

export default sendEmail;