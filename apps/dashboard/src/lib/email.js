import nodemailer from 'nodemailer';
import { getOrderProcessedTemplate } from './email/templates/orderProcessed.js';
import { getDeliveryScheduledTemplate } from './email/templates/deliveryScheduled.js';
import { getVerificationEmailTemplate } from './email/templates/verification.js';
import { getWelcomeEmailTemplate } from './email/templates/welcome.js';
import { getPasswordResetTemplate } from './email/templates/passwordReset.js';
import { getSubscriptionUpdateTemplate } from './email/templates/subscription.js';
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
      from: process.env.EMAIL_FROM || 'Stora <noreply@app.stora.com.ng>',
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
            from: process.env.EMAIL_FROM || 'Stora <noreply@app.stora.com.ng>',
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
  const { html, text, subject } = getVerificationEmailTemplate(verificationCode, firstName, email);
  return await sendEmail(email, subject, html, text);
};

// Send welcome email after successful verification
export const sendWelcomeEmail = async (email, firstName) => {
  const { html, text, subject } = getWelcomeEmailTemplate(firstName, email);
  return await sendEmail(email, subject, html, text);
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  const { html, text, subject } = getPasswordResetTemplate(resetToken, firstName, email);
  return await sendEmail(email, subject, html, text);
};

// Send subscription update email
export const sendSubscriptionUpdateEmail = async (email, firstName, subscriptionDetails) => {
  const { html, text, subject } = getSubscriptionUpdateTemplate(firstName, email, subscriptionDetails);
  return await sendEmail(email, subject, html, text);
};

// Send delivery scheduled email
export const sendDeliveryScheduledEmail = async (email, deliveryData, saleData, storeName = 'Stora Store') => {
  const { html, text, subject } = getDeliveryScheduledTemplate(email, deliveryData, saleData, storeName);
  return await sendEmail(email, subject, html, text);
};

// Send order processed email with receipt
export const sendOrderProcessedEmail = async (email, orderData, saleData, storeName = 'Stora Store', storeLogoUrl = null, brandingColors = null) => {
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
        from: process.env.EMAIL_FROM || 'Stora <noreply@app.stora.com.ng>',
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
        from: process.env.EMAIL_FROM || 'Stora <noreply@app.stora.com.ng>',
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