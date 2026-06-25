// Single source of truth for the operator Service Agreement text. Rendered on the
// agreement page, sent to the generate-agreement-pdf Edge Function, and stored as the
// acceptance snapshot — keep all three identical.

export const OPERATOR_AGREEMENT_VERSION = '1.2';
export const OPERATOR_AGREEMENT_TITLE = 'ShareConLoad Operator Service Agreement';

export const OPERATOR_AGREEMENT_CLAUSES: { n: number; heading: string; body: string }[] = [
  { n: 1, heading: 'Platform Access', body: 'ShareConLoad grants you permission to list your available container space and accept customer bookings. This permission is personal to you and may not be transferred to anyone else.' },
  { n: 2, heading: 'Fees & Commission', body: 'ShareConLoad deducts a commission from each payout before paying you via Paystack. The rate decreases as the booking value rises: 12% up to USD 500, 10% up to USD 2,000, 8% up to USD 5,000, and 6% above USD 5,000. These rates may change; the rate in effect on the booking date applies.' },
  { n: 3, heading: 'Payout Conditions', body: 'ShareConLoad releases your payout once the customer has paid, there is no open dispute on the booking, your payout account is verified and in good standing, and the refund window has passed.' },
  { n: 4, heading: 'Operator Obligations', body: 'You agree to: list only space you are authorised to offer; keep your capacity and dates accurate; honour the bookings you confirm; and comply with all customs, import, and export rules.' },
  { n: 5, heading: 'Prohibited Goods', body: 'You may not ship goods that are prohibited, restricted, or hazardous under applicable law or international shipping rules.' },
  { n: 6, heading: 'Dispute Resolution', body: 'If a customer raises a dispute, ShareConLoad may hold your payout while it investigates, and you agree to co-operate with the review.' },
  { n: 7, heading: 'Termination', body: 'ShareConLoad may suspend or close your account, with or without notice, if you breach this agreement, act fraudulently, or receive repeated customer complaints.' },
  { n: 8, heading: 'Limitation of Liability', body: "ShareConLoad's liability to you for any booking is limited to the net payout for that booking." },
  { n: 9, heading: 'Governing Law', body: 'This agreement is governed by South African law.' },
];

export function operatorAgreementPlainText(): string {
  const header = `${OPERATOR_AGREEMENT_TITLE}\nVersion ${OPERATOR_AGREEMENT_VERSION}\n\n`;
  const body = OPERATOR_AGREEMENT_CLAUSES
    .map((c) => `${c.n}. ${c.heading}. ${c.body}`)
    .join('\n\n');
  return header + body;
}
