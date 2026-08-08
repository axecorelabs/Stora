export const getPasswordResetTemplate = (resetToken, firstName, email) => {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://ivma.ng'}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          width: 60px;
          height: 60px;
          background: #0d9488;
          border-radius: 12px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        h1 {
          color: #111827;
          margin: 0;
          font-size: 24px;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: #0d9488;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 20px 0;
          font-size: 14px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">IVMA</div>
          <h1>Password Reset Request</h1>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>We received a request to reset your IVMA account password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" class="button">
            Reset My Password
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #0d9488;">${resetUrl}</p>
        
        <p>This link will expire in <strong>1 hour</strong> for security reasons.</p>
        
        <div class="warning">
          <strong>⚠️ Security Note:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        </div>
        
        <p>If you're having trouble, contact our support team at support@ivma.ng</p>
        
        <p>Best regards,<br>The IVMA Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} IVMA. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
          <p>IVMA - Intelligent Inventory Management & Analytics</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request
    
    Hi ${firstName},
    
    We received a request to reset your IVMA account password.
    
    Click this link to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour for security reasons.
    
    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
    
    If you're having trouble, contact our support team at support@ivma.ng
    
    Best regards,
    The IVMA Team
    
    © ${new Date().getFullYear()} IVMA. All rights reserved.
  `;

  return { html, text, subject: 'Reset Your IVMA Password' };
};
