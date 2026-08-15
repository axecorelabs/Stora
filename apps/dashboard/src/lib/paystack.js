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

// POST /subaccount -- settlement_schedule intentionally left as Paystack's
// default ('auto', T+1). An earlier version of this design set it to
// 'manual' to hold funds back as a refund-safety window, but triggering a
// manual settlement turns out to require a human clicking a button in the
// Paystack dashboard, not an API call -- there's no way to automate
// releasing it, so 'manual' would have left vendor funds stuck
// indefinitely. Vendors get paid fast instead; a refund on an
// already-settled transaction is refunded from Stora's own Paystack
// balance (Paystack's behavior for any split transaction refund) and is
// an accepted, understood risk rather than one this code tries to
// engineer around.
export function createSubaccount({ businessName, bankCode, accountNumber, commissionRate, contactEmail, contactName }) {
  return paystackRequest('/subaccount', {
    method: 'POST',
    body: {
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: accountNumber,
      percentage_charge: commissionRate * 100,
      primary_contact_email: contactEmail,
      primary_contact_name: contactName
    }
  });
}

// POST /refund -- always allowed, no settlement-status gate (see the
// createSubaccount note above for why). Refunding an already-settled
// transaction still succeeds -- Paystack pulls it from Stora's main
// balance -- it's just an accepted cost, not a blocked action.
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
