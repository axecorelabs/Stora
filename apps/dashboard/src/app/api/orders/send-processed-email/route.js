import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { sendOrderProcessedEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { email, orderData, saleData, storeName } = await req.json();

    // Validate required fields
    if (!email || !orderData || !saleData) {
      console.error('Missing required fields:', { email: !!email, orderData: !!orderData, saleData: !!saleData });
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    console.log('Attempting to send order processed email to:', email);
    console.log('Order data:', orderData);
    console.log('Sale data summary:', { transactionId: saleData.transactionId, itemCount: saleData.items?.length });

    // Send the email
    const result = await sendOrderProcessedEmail(
      email,
      orderData,
      saleData,
      storeName || 'IVMA Store'
    );

    if (result.success) {
      console.log('Order processed email sent successfully:', result.messageId);
      return NextResponse.json({
        success: true,
        message: 'Order processed email sent successfully',
        messageId: result.messageId
      });
    } else {
      console.error('Failed to send email:', result.error);
      return NextResponse.json(
        { success: false, message: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Send order processed email error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
