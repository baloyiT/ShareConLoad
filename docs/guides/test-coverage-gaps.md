# Test coverage gaps

What lost coverage in the Task 12 regression pass, when the old specs moved off the dead shared logins. None of this is covered by a passing test today. Add coverage here before Stage 3 goes public.

## Lost coverage

These flows have no working test:

- Agent portal and agent onboarding
- Messaging filter
- Dispute submission
- Tracking and ratings on a real booking
- Operator and agent RLS

## Tests that pass without testing anything

- `tests/rls.spec.ts` RLS-01 and RLS-09
- PAY-01 and PAY-05: they pass on an empty page. `tests/front-door-payments.spec.ts` now covers the three stages, the first-stage rule, access by another user and client inserts, but not a real payment.

## Safety skips

Skipped on purpose, because they would write to live data or open a real applicant's record:

- BOOK-05
- OPR-02, happy path
- RLS-04
- ADM-18
- ADM-11
- ADM-15
- KYC submission
- Support ticket submission
