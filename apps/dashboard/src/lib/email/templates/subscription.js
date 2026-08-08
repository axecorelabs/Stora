export const getSubscriptionUpdateTemplate = (firstName, email, subscriptionDetails) => {
  const { plan, status, endDate } = subscriptionDetails;
  
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
        .info-box {
          background: #f9fafb;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
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
          <h1>Subscription Update</h1>
        </div>
        
        <p>Hi ${firstName},</p>
        
        <p>Your IVMA subscription has been updated successfully.</p>
        
        <div class="info-box">
          <div class="info-row">
            <strong>Plan:</strong>
            <span>${plan}</span>
          </div>
          <div class="info-row">
            <strong>Status:</strong>
            <span style="text-transform: capitalize;">${status}</span>
          </div>
          <div class="info-row">
            <strong>${status === 'active' ? 'Next Billing Date' : 'Expires On'}:</strong>
            <span>${new Date(endDate).toLocaleDateString()}</span>
          </div>
        </div>
        
        <p>You can manage your subscription anytime from your dashboard.</p>
        
        <p>Best regards,<br>The IVMA Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} IVMA. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Subscription Update
    
    Hi ${firstName},
    
    Your IVMA subscription has been updated successfully.
    
    Plan: ${plan}
    Status: ${status}
    ${status === 'active' ? 'Next Billing Date' : 'Expires On'}: ${new Date(endDate).toLocaleDateString()}
    
    You can manage your subscription anytime from your dashboard.
    
    Best regards,
    The IVMA Team
  `;

  return { html, text, subject: `IVMA Subscription Update - ${plan} Plan` };
};
