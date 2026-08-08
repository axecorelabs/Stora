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

export const VerificationEmail = ({
  firstName = 'User',
  verificationCode = '123456',
}) => {
  const previewText = `Verify your IVMA Store account with code: ${verificationCode}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={headerHeading}>Welcome to IVMA Store! 🎉</Heading>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            <Text style={paragraph}>
              Thank you for signing up! To complete your registration, please verify your
              email address using the code below:
            </Text>

            {/* Code Box */}
            <Section style={codeBox}>
              <Text style={code}>{verificationCode}</Text>
            </Section>

            <Text style={paragraph}>
              This code will expire in <strong>10 minutes</strong>.
            </Text>

            <Text style={paragraph}>
              If you didn't create an account with IVMA Store, please ignore this email.
            </Text>

            <Text style={paragraph}>
              Best regards,
              <br />
              The IVMA Store Team
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} IVMA Store. All rights reserved.
            </Text>
            <Text style={footerText}>This is an automated email. Please do not reply.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default VerificationEmail;

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
  borderRadius: '10px',
  overflow: 'hidden',
  maxWidth: '600px',
};

const header = {
  background: 'linear-gradient(135deg, #0D9488 0%, #059669 100%)',
  backgroundColor: '#0D9488',
  padding: '30px',
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
  backgroundColor: '#f9f9f9',
  padding: '30px',
  borderRadius: '0 0 10px 10px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '0 0 20px',
};

const codeBox = {
  backgroundColor: '#ffffff',
  border: '2px solid #0D9488',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center',
  margin: '20px 0',
};

const code = {
  fontSize: '32px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  color: '#0D9488',
  margin: '0',
};

const footer = {
  textAlign: 'center',
  marginTop: '20px',
  padding: '20px',
};

const footerText = {
  fontSize: '12px',
  color: '#666666',
  margin: '5px 0',
};
