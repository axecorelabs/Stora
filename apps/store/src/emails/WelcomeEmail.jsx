import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { main, container, header, eyebrow, headerHeading, content, paragraph, buttonContainer, button, footer, footerText } from './shared/brand';

export const WelcomeEmail = ({
  firstName = 'User',
  siteUrl = 'https://app.stora.com.ng',
}) => {
  const previewText = `Welcome to Stora, ${firstName}!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrow}>STORA</Text>
            <Heading style={headerHeading}>Welcome aboard</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            <Text style={paragraph}>
              Your email is verified -- you&apos;re all set to start shopping on Stora.
            </Text>
            <Text style={paragraph}>
              Explore products from local vendors and artisans across the platform.
            </Text>

            <Section style={buttonContainer}>
              <Link style={button} href={siteUrl}>
                Start shopping
              </Link>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>© {new Date().getFullYear()} Stora. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;
