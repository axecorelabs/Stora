// One-off sender for the full-store subscription enforcement notice.
// Usage: node --env-file=.env.local scripts/send-full-store-enforcement-notice.mjs <email> [storeName]
//
// Deliberately takes an explicit recipient on the command line rather than
// querying real vendors itself -- the first real send is a single
// verification address (olaiyadotun05@gmail.com), not a blast to the
// full vendor list. A later, separate run against the real 28 full-store
// vendors is its own deliberate action, not something this script does
// by default.
import { sendFullStoreEnforcementNoticeEmail } from '../src/lib/email.js';

const [, , emailArg, storeNameArg] = process.argv;

if (!emailArg) {
  console.error('Usage: node --env-file=.env.local scripts/send-full-store-enforcement-notice.mjs <email> [storeName]');
  process.exit(1);
}

const result = await sendFullStoreEnforcementNoticeEmail(emailArg, storeNameArg || null);
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exit(1);
