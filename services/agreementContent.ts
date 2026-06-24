// Single source of truth for the operator Service Agreement text. Rendered on the
// agreement page, sent to the generate-agreement-pdf Edge Function, and stored as the
// acceptance snapshot — keep all three identical.

export const OPERATOR_AGREEMENT_VERSION = '1.1';
export const OPERATOR_AGREEMENT_TITLE = 'ShareConLoad Operator Service Agreement';

export const OPERATOR_AGREEMENT_CLAUSES: { n: number; heading: string; body: string }[] = [
  { n: 1, heading: 'Platform Access', body: 'ShareConLoad grants you a non-exclusive, non-transferable licence to list container space on the platform and accept bookings from customers.' },
  { n: 2, heading: 'Fees & Commission', body: 'ShareConLoad charges a tiered platform commission on each gross payout, based on the total booking value (normalised to USD): 12% on bookings up to USD 500; 10% from USD 501 to 2,000; 8% from USD 2,001 to 5,000; and 6% above USD 5,000. The commission is deducted from the gross payout and the net amount is transferred to your registered bank account via Paystack. ShareConLoad may update these rates from time to time; the rates in effect at the time of each booking apply.' },
  { n: 3, heading: 'Payout Conditions', body: "Payouts are released subject to: (a) the corresponding customer payment being confirmed as 'paid'; (b) no active dispute on the booking; (c) payout account being verified and in good standing; and (d) expiry of the applicable refund window." },
  { n: 4, heading: 'Operator Obligations', body: 'You must: (a) list only container space you have lawful authority to offer; (b) maintain accurate capacity and departure information; (c) honour confirmed bookings; (d) comply with all applicable customs, import, and export regulations.' },
  { n: 5, heading: 'Prohibited Goods', body: 'You must not facilitate the shipment of prohibited, restricted, or hazardous goods as defined by applicable law and international shipping conventions.' },
  { n: 6, heading: 'Dispute Resolution', body: 'In the event of a dispute raised by a customer, ShareConLoad reserves the right to place a payout hold pending investigation. You agree to co-operate fully with any such review.' },
  { n: 7, heading: 'Termination', body: 'ShareConLoad may suspend or terminate your account for breach of this agreement, fraudulent activity, or repeated customer complaints, with or without notice.' },
  { n: 8, heading: 'Limitation of Liability', body: "ShareConLoad's liability to you in connection with any booking shall not exceed the net payout amount for that booking." },
  { n: 9, heading: 'Governing Law', body: 'This agreement is governed by the laws of the Republic of South Africa.' },
];

export function operatorAgreementPlainText(): string {
  const header = `${OPERATOR_AGREEMENT_TITLE}\nVersion ${OPERATOR_AGREEMENT_VERSION}\n\n`;
  const body = OPERATOR_AGREEMENT_CLAUSES
    .map((c) => `${c.n}. ${c.heading}. ${c.body}`)
    .join('\n\n');
  return header + body;
}
