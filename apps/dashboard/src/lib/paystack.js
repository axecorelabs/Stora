const PAYSTACK_BASE_URL = 'https://api.paystack.co';

async function paystackRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok || data.status === false) {
    const error = new Error(data.message || `Paystack request failed: ${response.status}`);
    error.paystackResponse = data;
    throw error;
  }

  return data.data;
}

// GET /bank -- list of Nigerian banks for the payout-settings bank dropdown.
// Cache this at the call site (banks/route.js), it changes rarely.
export function listBanks() {
  return paystackRequest('/bank?country=nigeria&currency=NGN&perPage=100');
}

// GET /bank/resolve -- confirms the account number belongs to the stated
// bank and returns the account holder's real name, so the vendor can
// visually confirm it before we create a subaccount against it.
export function resolveAccountNumber(accountNumber, bankCode) {
  return paystackRequest(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
}

// POST /subaccount -- settlement_schedule: 'manual' is load-bearing, not
// a default left as-is. It's what makes a refund safe: funds sit in the
// vendor's own subaccount, not yet paid to their bank, until the
// settlement-trigger cron job (apps/store) explicitly releases them 24h
// after payment. See apps/dashboard/supabase/migrations/20260816000000_paystack_payment_splits.sql.
export function createSubaccount({ businessName, bankCode, accountNumber, commissionRate, contactEmail, contactName }) {
  return paystackRequest('/subaccount', {
    method: 'POST',
    body: {
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: accountNumber,
      percentage_charge: commissionRate * 100,
      primary_contact_email: contactEmail,
      primary_contact_name: contactName,
      settlement_schedule: 'manual'
    }
  });
}

// POST /refund -- only ever called for a split still in 'pending'
// settlement status (apps/dashboard/src/app/api/orders/[id]/refund/route.js
// enforces this before calling it). amountKobo omitted means a full refund.
export function refundTransaction({ reference, amountKobo, note }) {
  return paystackRequest('/refund', {
    method: 'POST',
    body: {
      transaction: reference,
      ...(amountKobo != null ? { amount: amountKobo } : {}),
      ...(note ? { merchant_note: note } : {})
    }
  });
}
