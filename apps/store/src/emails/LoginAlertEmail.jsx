import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { brand, gold, main, container, header, eyebrow, headerHeading, content, paragraph, footer, footerText, footerLink, footerCopyright } from './shared/brand';

export const LoginAlertEmail = ({
  firstName = 'there',
  browser = 'Unknown browser',
  os = 'Unknown device',
  ipAddress = 'Unknown',
  formattedTime = '',
  siteUrl = 'https://app.stora.com.ng',
}) => {
  const previewText = 'New sign-in to your Stora account';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrow}>STORA</Text>
            <Heading style={headerHeading}>New sign-in to your account</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            <Text style={paragraph}>
              Your Stora account was just signed into. If this was you, no action is needed.
            </Text>

            <Section style={detailsBox}>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td style={detailsLabel}>Time</td>
                    <td style={detailsValue}>{formattedTime}</td>
                  </tr>
                  <tr>
                    <td style={detailsLabel}>Device</td>
                    <td style={detailsValue}>{browser} on {os}</td>
                  </tr>
                  <tr>
                    <td style={detailsLabel}>IP address</td>
                    <td style={detailsValue}>{ipAddress}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={noticeBox}>
              <Text style={noticeText}>
                If you don&apos;t recognize this activity,{' '}
                <Link href={siteUrl} style={noticeLink}>sign in</Link> and reset your password
                right away.
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

export default LoginAlertEmail;

const detailsBox = {
  margin: '0 0 24px',
  padding: '4px 20px',
  backgroundColor: brand[50],
  borderLeft: `3px solid ${brand[600]}`,
  borderRadius: '6px',
};

const detailsLabel = {
  fontSize: '13px',
  color: brand[400],
  padding: '8px 0',
  width: '40%',
};

const detailsValue = {
  fontSize: '13px',
  color: brand[900],
  fontWeight: '500',
  padding: '8px 0',
  textAlign: 'right',
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

const noticeLink = {
  color: gold[700],
  fontWeight: '700',
};
