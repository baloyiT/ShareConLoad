// Single source of truth for the operator participation terms text. Rendered on the terms
// page. The accepted text comes from participation_terms in the database, seeded by migration
// _85 and updated by _86: keep the two identical. Once anyone has accepted a version, a change
// needs a new row, because that text was accepted as is.
//
// DRAFT: waiting for review by the founder and a lawyer. Not legal advice.

export const PARTICIPATION_TERMS_VERSION = '0.1-draft';
export const PARTICIPATION_TERMS_TITLE = 'ShareConLoad Operator Participation Terms';

export const PARTICIPATION_TERMS_CLAUSES: { n: number; heading: string; body: string }[] = [
  { n: 1, heading: 'Free Founding Leads', body: 'Leads are free of charge for founding operators for 90 days.' },
  { n: 2, heading: 'Outcome Reporting', body: 'In return for free founding leads, you agree to report the outcome of the leads you receive.' },
  { n: 3, heading: 'Preferential Pricing Later', body: 'After the founding period, founding operators will receive preferential pricing. These terms do not set a price or a discount.' },
  { n: 4, heading: 'No Guaranteed Volumes', body: 'ShareConLoad does not guarantee any number of leads, quotes, customers or volume of work.' },
  { n: 5, heading: 'Your Services', body: 'You are an independent operator. You are responsible for the services you offer and deliver. ShareConLoad connects you with customers and does not deliver the freight.' },
  { n: 6, heading: 'Your Public Listing', body: 'If you are listed, the directory shows your trading name publicly. A company with no trading name is shown under its registered name. The directory also shows your public description, public phone, public email, services and coverage.' },
  { n: 7, heading: 'Data Handling', body: 'ShareConLoad uses the details and documents you provide to verify you and to connect you with customers. Your private contact details and your documents are not published. Questions about your data go to support@shareconload.com.' },
];

export function participationTermsPlainText(): string {
  const header = `${PARTICIPATION_TERMS_TITLE}\nVersion ${PARTICIPATION_TERMS_VERSION}\n\n`;
  const body = PARTICIPATION_TERMS_CLAUSES
    .map((c) => `${c.n}. ${c.heading}. ${c.body}`)
    .join('\n\n');
  return header + body;
}
