// Shared across every transactional email template in this app -- literal
// hex values, since email clients don't resolve CSS custom properties.
// Mirrors apps/store/src/app/globals.css's --color-brand-*/--color-gold-*.
export const brand = {
  50: '#EAF1EE',
  100: '#D2E3DC',
  400: '#4C8870',
  600: '#145C41',
  700: '#0F4A38',
  800: '#0B3B2E',
  900: '#082A20',
};

export const gold = {
  400: '#D8BC85',
  700: '#8A6A36',
};

// Common shell every template wraps its own content in: solid header (no
// gradient/image -- gradients don't render in Outlook desktop, images are
// blocked by default in Gmail/Outlook preview panes), consistent footer.
export const main = {
  backgroundColor: '#F5F5F0',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

export const container = {
  backgroundColor: '#ffffff',
  margin: '20px auto',
  borderRadius: '12px',
  overflow: 'hidden',
  maxWidth: '600px',
  border: `1px solid ${brand[100]}`,
};

export const header = {
  backgroundColor: brand[800],
  padding: '32px 30px',
  textAlign: 'center',
};

export const eyebrow = {
  color: gold[400],
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '3px',
  margin: '0 0 8px',
};

export const headerHeading = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0',
  lineHeight: '1.3',
};

export const content = {
  padding: '32px 30px',
};

export const paragraph = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: brand[900],
  margin: '0 0 20px',
};

export const label = {
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: brand[400],
  margin: '0 0 10px',
};

export const buttonContainer = {
  margin: '0 0 8px',
  textAlign: 'center',
};

export const button = {
  backgroundColor: brand[700],
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '14px 36px',
};

export const footer = {
  backgroundColor: brand[50],
  padding: '24px 30px',
  textAlign: 'center',
  borderTop: `1px solid ${brand[100]}`,
};

export const footerText = {
  fontSize: '13px',
  color: brand[400],
  margin: '0 0 8px',
};

export const footerLink = {
  color: brand[700],
  textDecoration: 'none',
  fontWeight: '600',
};

export const footerCopyright = {
  fontSize: '11px',
  color: brand[400],
  margin: '0',
};
