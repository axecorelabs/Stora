export const getVerificationEmailTemplate = (verificationCode, firstName, email) => {
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
        .verification-code {
          background: #f3f4f6;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .code {
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #0d9488;
          font-family: 'Courier New', monospace;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 20px 0;
          font-size: 14px;
        }
        ul {
          padding-left: 20px;
        }
        li {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">IVMA</div>
          <h1>Welcome to IVMA!</h1>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>Thanks for signing up! To complete your registration and start managing your inventory, please verify your email address using the code below:</p>
        
        <div class="verification-code">
          <div class="code">${verificationCode}</div>
        </div>
        
        <p>This code will expire in <strong>15 minutes</strong>.</p>
        
        <div class="warning">
          <strong>⚠️ Security Note:</strong> If you didn't create an account with IVMA, please ignore this email or contact our support team.
        </div>
        
        <p>Once verified, you'll get instant access to:</p>
        <ul>
          <li>14-day free trial with all premium features</li>
          <li>Real-time inventory tracking</li>
          <li>Free website with inventory sync</li>
          <li>Advanced reporting and analytics</li>
          <li>WhatsApp checkout integration</li>
          <li>And much more!</li>
        </ul>
        
        <p>Need help? Our support team is here for you 24/7.</p>
        
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
    Welcome to IVMA!
    
    Hi ${firstName},
    
    Thanks for signing up! To complete your registration, please verify your email address using this code:
    
    ${verificationCode}
    
    This code will expire in 15 minutes.
    
    If you didn't create an account with IVMA, please ignore this email.
    
    Best regards,
    The IVMA Team
    
    © ${new Date().getFullYear()} IVMA. All rights reserved.
  `;

  return { html, text, subject: 'Verify Your IVMA Account' };
};
