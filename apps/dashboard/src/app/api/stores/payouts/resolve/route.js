import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { resolveAccountNumber } from '@/lib/paystack';

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountNumber = searchParams.get('account_number');
    const bankCode = searchParams.get('bank_code');

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { success: false, message: 'Account number and bank are required' },
        { status: 400 }
      );
    }

    const resolved = await resolveAccountNumber(accountNumber, bankCode);

    return NextResponse.json({
      success: true,
      accountName: resolved.account_number ? resolved.account_name : null
    });
  } catch (error) {
    console.error('Account resolve error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Could not verify this account number' },
      { status: 400 }
    );
  }
}
