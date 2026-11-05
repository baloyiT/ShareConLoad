-- Seeds the first draft of the operator participation terms, so accept_participation_terms()
-- has a current row. The text must match participationTermsPlainText() in
-- services/participationTerms.ts exactly: tests/front-door-operator.spec.ts checks both.
--
-- Draft for review by the founder and a lawyer. Accepted text is never rewritten, so a re-run
-- leaves an existing row alone, and this row only becomes current if no other row is.
-- The body uses \n escapes so line endings do not depend on how this file is checked out.
insert into public.participation_terms (version, title, body, is_current)
select
  '0.1-draft',
  'ShareConLoad Operator Participation Terms',
  E'ShareConLoad Operator Participation Terms\nVersion 0.1-draft\n\n1. Free Founding Leads. Leads are free of charge for founding operators for 90 days.\n\n2. Outcome Reporting. In return for free founding leads, you agree to report the outcome of the leads you receive.\n\n3. Preferential Pricing Later. After the founding period, founding operators will receive preferential pricing. These terms do not set a price or a discount.\n\n4. No Guaranteed Volumes. ShareConLoad does not guarantee any number of leads, quotes, customers or volume of work.\n\n5. Your Services. You are an independent operator. You are responsible for the services you offer and deliver. ShareConLoad connects you with customers and does not deliver the freight.\n\n6. Your Public Listing. If you are listed, your legal name will be shown publicly in the directory, together with your public description, public phone, public email, services and coverage.\n\n7. Data Handling. ShareConLoad uses the details and documents you provide to verify you and to connect you with customers. Your private contact details and your documents are not published. Questions about your data go to support@shareconload.com.',
  not exists (select 1 from public.participation_terms where is_current)
on conflict (version) do nothing;
