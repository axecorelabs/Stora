export const getWelcomeEmailTemplate = (firstName, email) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ivma.ng';
  
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
        .success-badge {
          background: #d1fae5;
          color: #065f46;
          padding: 8px 16px;
          border-radius: 20px;
          display: inline-block;
          font-size: 14px;
          font-weight: 600;
          margin: 20px 0;
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
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 30px 0;
        }
        .feature-item {
          background: #f9fafb;
          padding: 15px;
          border-radius: 8px;
          border-left: 3px solid #0d9488;
        }
        .feature-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 5px;
        }
        .feature-desc {
          font-size: 13px;
          color: #6b7280;
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
          <h1>Welcome Aboard!</h1>
          <div class="success-badge">✓ Account Verified</div>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>🎉 Congratulations! Your IVMA account has been successfully created and verified. You're now ready to revolutionize how you manage your inventory!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/dashboard" class="button">
            Go to Your Dashboard →
          </a>
        </div>
        
        <h2 style="color: #111827; font-size: 18px; margin-top: 30px;">Your 14-Day Trial Includes:</h2>
        
        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-title">📊 Real-Time Tracking</div>
            <div class="feature-desc">Monitor stock levels instantly</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">🌐 Free Website</div>
            <div class="feature-desc">Auto-synced with inventory</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">💳 POS System</div>
            <div class="feature-desc">Process sales seamlessly</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">📱 WhatsApp Integration</div>
            <div class="feature-desc">Direct checkout option</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">📈 Advanced Analytics</div>
            <div class="feature-desc">Weekly AI-powered insights</div>
          </div>
          <div class="feature-item">
            <div class="feature-title">🔔 Smart Alerts</div>
            <div class="feature-desc">Low-stock notifications</div>
          </div>
        </div>
        
        <h3 style="color: #111827; font-size: 16px; margin-top: 30px;">Getting Started:</h3>
        <ol style="padding-left: 20px;">
          <li style="margin: 10px 0;">Add your first inventory items</li>
          <li style="margin: 10px 0;">Set up your store information</li>
          <li style="margin: 10px 0;">Configure your free website</li>
          <li style="margin: 10px 0;">Start tracking sales with POS</li>
          <li style="margin: 10px 0;">Explore analytics and reports</li>
        </ol>
        
        <p style="margin-top: 30px;">Need help? We're here for you:</p>
        <ul style="padding-left: 20px;">
          <li>📧 Email: support@ivma.ng</li>
          <li>💬 Live Chat: Available in your dashboard</li>
          <li>📚 Help Center: ivma.ng/help</li>
        </ul>
        
        <p style="margin-top: 30px;">Best regards,<br>The IVMA Team</p>
        
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
    Welcome Aboard!
    
    Hi ${firstName},
    
    Congratulations! Your IVMA account has been successfully created and verified.
    
    Your 14-Day Trial Includes:
    - Real-Time Tracking: Monitor stock levels instantly
    - Free Website: Auto-synced with inventory
    - POS System: Process sales seamlessly
    - WhatsApp Integration: Direct checkout option
    - Advanced Analytics: Weekly AI-powered insights
    - Smart Alerts: Low-stock notifications
    
    Getting Started:
    1. Add your first inventory items
    2. Set up your store information
    3. Configure your free website
    4. Start tracking sales with POS
    5. Explore analytics and reports
    
    Go to your dashboard: ${appUrl}/dashboard
    
    Need help?
    - Email: support@ivma.ng
    - Live Chat: Available in your dashboard
    - Help Center: ivma.ng/help
    
    Best regards,
    The IVMA Team
    
    © ${new Date().getFullYear()} IVMA. All rights reserved.
  `;

  return { html, text, subject: 'Welcome to IVMA - Your Account is Ready!' };
};
