import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { brand, gold, main, container, header, eyebrow, headerHeading, content, paragraph, buttonContainer, button, footer, footerText, footerLink, footerCopyright } from './shared/brand';

export const PasswordResetEmail = ({
  name = 'User',
  resetUrl = 'https://app.stora.com.ng/reset-password',
  expiryMinutes = 30,
}) => {
  const previewText = 'Reset your Stora password';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrow}>STORA</Text>
            <Heading style={headerHeading}>Reset your password</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>Hi {name},</Text>
            <Text style={paragraph}>
              We received a request to reset your Stora account password. Click below to
              choose a new one.
            </Text>

            <Section style={buttonContainer}>
              <Link style={button} href={resetUrl}>
                Reset password
              </Link>
            </Section>

            <Text style={linkText}>Or paste this link into your browser:</Text>
            <Text style={linkBox}>{resetUrl}</Text>

            <Section style={noticeBox}>
              <Text style={noticeText}>
                This link expires in {expiryMinutes} minutes. If you didn&apos;t request a
                password reset, your password is unchanged -- just ignore this email.
              </Text>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Need help? {' '}
              <Link href="mailto:support@stora.com.ng" style={footerLink}>
                support@stora.com.ng
              </Link>
            </Text>
            <Text style={footerCopyright}>© {new Date().getFullYear()} Stora. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

const linkText = {
  fontSize: '13px',
  color: brand[400],
  lineHeight: '1.6',
  margin: '4px 0 8px',
};

const linkBox = {
  padding: '12px',
  backgroundColor: brand[50],
  borderRadius: '6px',
  fontSize: '12px',
  color: brand[800],
  wordBreak: 'break-all',
  margin: '0 0 20px',
};

const noticeBox = {
  padding: '14px 16px',
  backgroundColor: '#FAF7F0',
  borderLeft: `3px solid ${gold[400]}`,
  borderRadius: '6px',
  margin: '0',
};

const noticeText = {
  fontSize: '13px',
  color: gold[700],
  lineHeight: '1.6',
  margin: '0',
};
