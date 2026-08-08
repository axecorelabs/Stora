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

export const WelcomeEmail = ({
  firstName = 'User',
  siteUrl = 'https://app.stora.com.ng',
}) => {
  const previewText = `Welcome to Stora Store, ${firstName}!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={headerHeading}>Welcome Aboard! 🎉</Heading>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            <Text style={paragraph}>
              Your email has been verified successfully! You're now part of the Stora Store
              community.
            </Text>
            <Text style={paragraph}>
              Start exploring amazing products from local artisans and vendors.
            </Text>

            {/* Action Button */}
            <Section style={buttonContainer}>
              <Link style={button} href={siteUrl}>
                Start Shopping
              </Link>
            </Section>

            <Text style={paragraph}>
              If you have any questions, feel free to reach out to our support team.
            </Text>
            <Text style={paragraph}>
              Happy shopping!
              <br />
              The Stora Store Team
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Stora Store. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

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

const buttonContainer = {
  margin: '20px 0',
  textAlign: 'center',
};

const button = {
  backgroundColor: '#0D9488',
  borderRadius: '5px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '12px 30px',
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
