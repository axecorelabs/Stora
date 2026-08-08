import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export const PasswordResetEmail = ({
  name = 'User',
  resetUrl = 'https://ivma.ng/reset-password',
  expiryMinutes = 30,
}) => {
  const previewText = `Reset your IVMA Store password`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={headerHeading}>🔒 Password Reset</Heading>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {name},</Text>
            <Text style={paragraph}>
              We received a request to reset your password for your IVMA Store account.
              Click the button below to create a new password:
            </Text>

            {/* Reset Button */}
            <Section style={buttonContainer}>
              <Link style={button} href={resetUrl}>
                Reset Password
              </Link>
            </Section>

            <Text style={linkText}>Or copy and paste this link into your browser:</Text>
            <Text style={linkBox}>{resetUrl}</Text>

            {/* Warning Box */}
            <Section style={warningBox}>
              <Text style={warningText}>
                <strong>⏱️ Important:</strong> This link will expire in {expiryMinutes}{' '}
                minutes for security reasons.
              </Text>
            </Section>

            <Text style={paragraph}>
              If you didn't request a password reset, please ignore this email. Your
              password will remain unchanged.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Need help? Contact us at{' '}
              <Link href="mailto:support@ivmastore.com" style={footerLink}>
                support@ivmastore.com
              </Link>
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} IVMA Store. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

// Styles
const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  marginTop: '20px',
  marginBottom: '20px',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  maxWidth: '600px',
};

const header = {
  background: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
  backgroundColor: '#0D9488',
  padding: '40px 30px',
  textAlign: 'center',
};

const headerHeading = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  lineHeight: '1.3',
};

const content = {
  padding: '40px 30px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '0 0 20px',
};

const buttonContainer = {
  margin: '30px 0',
  textAlign: 'center',
};

const button = {
  backgroundColor: '#0D9488',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '16px 40px',
};

const linkText = {
  fontSize: '14px',
  color: '#666666',
  lineHeight: '1.6',
  margin: '20px 0',
};

const linkBox = {
  padding: '12px',
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
  fontSize: '12px',
  color: '#666666',
  wordBreak: 'break-all',
  margin: '0 0 20px',
};

const warningBox = {
  margin: '30px 0',
  padding: '16px',
  backgroundColor: '#FEF3C7',
  borderLeft: '4px solid #F59E0B',
  borderRadius: '4px',
};

const warningText = {
  fontSize: '14px',
  color: '#92400E',
  lineHeight: '1.6',
  margin: '0',
};

const footer = {
  backgroundColor: '#f5f5f5',
  padding: '30px',
  textAlign: 'center',
  borderTop: '1px solid #e5e5e5',
};

const footerText = {
  fontSize: '14px',
  color: '#666666',
  margin: '0 0 10px',
};

const footerLink = {
  color: '#0D9488',
  textDecoration: 'none',
};

const footerCopyright = {
  fontSize: '12px',
  color: '#999999',
  margin: '0',
};
