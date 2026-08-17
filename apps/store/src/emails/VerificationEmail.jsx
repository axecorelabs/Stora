import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { brand, main, container, header, eyebrow, headerHeading, content, paragraph, footer, footerText } from './shared/brand';

export const VerificationEmail = ({
  firstName = 'User',
  verificationCode = '123456',
}) => {
  const previewText = `Verify your Stora account with code: ${verificationCode}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrow}>STORA</Text>
            <Heading style={headerHeading}>Verify your email</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            <Text style={paragraph}>
              Thanks for signing up. Use the code below to verify your email address.
            </Text>

            <Section style={codeBox}>
              <Text style={code}>{verificationCode}</Text>
            </Section>

            <Text style={paragraph}>
              This code expires in <strong>10 minutes</strong>.
            </Text>

            <Text style={paragraph}>
              If you didn&apos;t create a Stora account, you can safely ignore this email.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>This is an automated email -- please don&apos;t reply.</Text>
            <Text style={footerText}>© {new Date().getFullYear()} Stora. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default VerificationEmail;

const codeBox = {
  backgroundColor: brand[50],
  borderLeft: `3px solid ${brand[600]}`,
  borderRadius: '6px',
  padding: '20px',
  textAlign: 'center',
  margin: '0 0 20px',
};

const code = {
  fontSize: '32px',
  fontWeight: '700',
  letterSpacing: '8px',
  color: brand[800],
  margin: '0',
};
