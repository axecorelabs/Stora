// Shared shell for every plain-HTML-string transactional email in this app
// (apps/dashboard/src/lib/email/templates/*.js). Literal hex values, since
// email clients don't resolve CSS custom properties -- mirrors
// apps/dashboard/src/app/globals.css's --color-brand-*/--color-gold-*.
export const colors = {
  brand50: '#EAF1EE',
  brand100: '#D2E3DC',
  brand400: '#4C8870',
  brand600: '#145C41',
  brand700: '#0F4A38',
  brand800: '#0B3B2E',
  brand900: '#082A20',
  gold400: '#D8BC85',
  gold700: '#8A6A36',
};

// Solid color, not a gradient/logo image: renders identically everywhere,
// including Outlook desktop (no CSS gradient support) and Gmail/Outlook
// preview panes (images blocked by default). Table-based row layouts
// throughout every template built on this shell for the same reason --
// display:flex/grid don't render in Outlook desktop at all.
export function emailShell({ heading, bodyHtml, footerHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F5F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F0;padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${colors.brand100};max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${colors.brand800};padding:32px 30px;text-align:center;">
              <p style="color:${colors.gold400};font-size:12px;font-weight:700;letter-spacing:3px;margin:0 0 8px;">STORA</p>
              <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 30px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${colors.brand50};padding:24px 30px;text-align:center;border-top:1px solid ${colors.brand100};">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function defaultFooter(email) {
  return `
    <p style="font-size:13px;color:${colors.brand400};margin:0 0 8px;">
      Need help? <a href="mailto:support@app.stora.com.ng" style="color:${colors.brand700};text-decoration:none;font-weight:600;">support@app.stora.com.ng</a>
    </p>
    <p style="font-size:11px;color:${colors.brand400};margin:0;">
      © ${new Date().getFullYear()} Stora. All rights reserved.${email ? ` This email was sent to ${email}.` : ''}
    </p>`;
}

// Standard paragraph/label/box/button building blocks every template
// composes its body from -- keeps spacing and tone consistent without
// each template re-deriving its own values.
export function paragraph(html) {
  return `<p style="font-size:15px;line-height:1.6;color:${colors.brand900};margin:0 0 20px;">${html}</p>`;
}

export function label(text) {
  return `<p style="font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${colors.brand400};margin:0 0 10px;">${text}</p>`;
}

export function button(url, text) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="background-color:${colors.brand700};border-radius:8px;">
          <a href="${url}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${text}</a>
        </td>
      </tr>
    </table>`;
}

// Brand-tinted card (order/delivery summary, verification code) -- the
// platform's neutral "informational" container.
export function card(innerHtml) {
  return `<div style="margin:0 0 24px;padding:18px 20px;background-color:${colors.brand50};border-left:3px solid ${colors.brand600};border-radius:6px;">${innerHtml}</div>`;
}

// Gold-tinted callout -- reserved for something the reader needs to
// specifically notice (an expiry, a note, a special instruction), same
// role gold plays across the rest of the platform's UI.
export function notice(innerHtml) {
  return `<div style="margin:0 0 24px;padding:14px 16px;background-color:#FAF7F0;border-left:3px solid ${colors.gold400};border-radius:6px;color:${colors.gold700};">${innerHtml}</div>`;
}

// A label/value row inside a card -- table-based so it survives Outlook.
export function row(rowLabel, value, { emphasize = false } = {}) {
  const valueStyle = emphasize
    ? `font-size:15px;color:${colors.brand800};font-weight:700;`
    : `font-size:13px;color:${colors.brand900};font-weight:500;`;
  return `
    <tr>
      <td style="font-size:13px;color:${colors.brand400};padding:4px 0;width:40%;">${rowLabel}</td>
      <td style="${valueStyle}padding:4px 0;text-align:right;">${value}</td>
    </tr>`;
}
