// Single source of truth for the operator Service Agreement text. Rendered on the
// agreement page, sent to the generate-agreement-pdf Edge Function, and stored as the
// acceptance snapshot — keep all three identical.

export const OPERATOR_AGREEMENT_VERSION = '1.2';
export const OPERATOR_AGREEMENT_TITLE = 'ShareConLoad Operator Service Agreement';

export const OPERATOR_AGREEMENT_CLAUSES: { n: number; heading: string; body: string }[] = [
  { n: 1, heading: 'Platform Access', body: "ShareConLoad lets you list your spare container space and accept customer bookings. This permission is personal to you and can't be passed on to anyone else." },
  { n: 2, heading: 'Fees & Commission', body: 'ShareConLoad keeps a commission from each payout, taken from your earnings before we pay you (via Paystack). The bigger the booking, the lower the rate: 12% on bookings up to USD 500, 10% up to USD 2,000, 8% up to USD 5,000, and 6% above that. We may update these rates; the rate that applies is the one in place on the booking date.' },
  { n: 3, heading: 'Payout Conditions', body: "We release your payout once: the customer has paid, there is no open dispute on the booking, your payout account is verified and in good standing, and the refund window has passed." },
  { n: 4, heading: 'Operator Obligations', body: 'You agree to: only list space you are allowed to offer; keep your capacity and dates accurate; honour bookings you confirm; and follow all customs, import, and export rules.' },
  { n: 5, heading: 'Prohibited Goods', body: 'You will not ship anything banned, restricted, or dangerous under the law or international shipping rules.' },
  { n: 6, heading: 'Dispute Resolution', body: 'If a customer raises a dispute, we may hold your payout while we investigate. You agree to help with that review.' },
  { n: 7, heading: 'Termination', body: 'We may suspend or close your account, with or without notice, if you break this agreement, act fraudulently, or receive repeated customer complaints.' },
  { n: 8, heading: 'Limitation of Liability', body: "If something goes wrong with a booking, the most we will owe you is the net payout for that booking." },
  { n: 9, heading: 'Governing Law', body: 'This agreement is governed by South African law.' },
];

export function operatorAgreementPlainText(): string {
  const header = `${OPERATOR_AGREEMENT_TITLE}\nVersion ${OPERATOR_AGREEMENT_VERSION}\n\n`;
  const body = OPERATOR_AGREEMENT_CLAUSES
    .map((c) => `${c.n}. ${c.heading}. ${c.body}`)
    .join('\n\n');
  return header + body;
}
