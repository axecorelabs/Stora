import nodemailer from 'nodemailer';
import { getPartnershipProposalTemplate } from './email/templates/partnershipProposal.js';

// Trimmed copy of apps/dashboard/src/lib/email.js's dual-provider
// send function -- this app only ever sends one email type, so no need
// for the attachment path or the other templates that live there.
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'nodemailer';

const createNodemailerTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error('SMTP configuration incomplete. Please check apps/admin/.env.local.');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: smtpPassword },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production', minVersion: 'TLSv1.2' }
  });
};

const sendWithResend = async (to, subject, html, text) => {
  try {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Stora <noreply@stora.com.ng>',
      to, subject, html, text
    });
    return { success: true, messageId: response.id };
  } catch (error) {
    console.error('Resend email error:', error);
    return { success: false, error: error.message };
  }
};

const sendEmail = async (to, subject, html, text = '') => {
  try {
    if (EMAIL_PROVIDER === 'resend') {
      return await sendWithResend(to, subject, html, text);
    }
    const transporter = createNodemailerTransporter();
    await transporter.verify();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Stora <noreply@stora.com.ng>',
      to, subject, html,
      text: text || html.replace(/<[^>]*>/g, '')
    });
    transporter.close();
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message, code: error.code };
  }
};

export const sendPartnershipProposalEmail = async (email, firstName, proposalDetails) => {
  const { html, text, subject } = getPartnershipProposalTemplate(firstName || 'there', proposalDetails);
  return await sendEmail(email, subject, html, text);
};
