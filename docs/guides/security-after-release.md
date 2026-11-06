# Security work after the release

**Project:** ShareConLoad (`fkhfbifgvebygafsewot`)
**Purpose:** Two security gaps that stay open until the new frontend is live, and how to close them.

Neither can be closed today. Production still runs frontend commit `04f2c62`, and that frontend relies on both behaviours. Nothing in this guide has been changed on the live project.

## Order relative to Stage 3

Stage 3 is in `security-deployment-2026-11.md`.

1. Build the frontend parts below on a branch and merge them **before or with** Stage 3 step 1. They work with the live database as it stands.
2. Run Stage 3 steps 1 and 2: the frontend is live.
3. Deploy the `notify` function (gap 2). It must be live before the frontend that calls it, so if it ships in the same merge, deploy it just before step 1.
4. Run Stage 3 step 3, `send-email`.
5. Apply the two migrations below, the storage one first. Each one breaks the old frontend, so never apply them while `04f2c62` is live.

If the frontend is rolled back, roll these migrations back too.

## Gap 1: a file replaced behind an approved document

**The gap.** `Operators update compliance docs` lets an operator overwrite any object in their own folder of `compliance-documents`. The row in `compliance_documents` is a separate write. An operator can get a document approved, then replace the file at the same path without touching the row, and the row stays approved. The same policy covers the signed `service_agreement_*.pdf`, which `generate-agreement-pdf` writes with the service role into that same folder. `Customers update own KYC docs` gives the same power over a verified KYC file.

**Why it waits.** `app/operator/compliance/documents/page.tsx` builds the fixed path `<operator id>/<doc type>.<ext>` and uploads with `upsert: true`, on both refs. Re-uploading after a rejection is an overwrite, so removing the update policy today would break re-upload in production.

**Smallest design: a new path for every upload, and no client storage update.**

Frontend, in `app/operator/compliance/documents/page.tsx`:

- Build the path as `<operator id>/<doc type>_<Date.now()>.<ext>`.
- Upload with `upsert: false`.
- Nothing else changes. The page already writes the path into `file_url`, and every reader takes the path from that column. The `_91` guard accepts it, because it still sits directly in the operator's folder. The `_88` guard still sends the row back to review.

Migration, after the frontend is live:

```sql
drop policy if exists "Operators update compliance docs" on storage.objects;
drop policy if exists "Customers update own KYC docs" on storage.objects;
```

- The KYC page already uses a new path for each upload (`<user id>/<key>_<Date.now()>.<ext>`), so the second line needs no frontend change. Its `upsert: true` then has nothing to overwrite. Test one KYC upload after applying.
- `Operators update own bank docs` on `bank-documents` can go in the same migration. No page on this branch uploads to that bucket, so check first why the one object there exists.
- Old files stay in the bucket as a history. There is no client delete policy, so a file an admin approved can no longer change.

**Test first:** an operator can upload twice for the same document type and gets two objects. An operator cannot overwrite an existing object, including a `service_agreement_*.pdf`. The admin review page opens the newest file.

## Gap 2: cross-user notifications

**The gap.** Policy `authenticated_insert_notifications` lets any signed-in user write a notification to any user, with any title and text. `decideEmail` in `supabase/functions/_shared/auth.ts` lets any signed-in user send an email to any `recipientId`, once the new `send-email` is deployed. The text is escaped and carries no raw HTML, but it can still be used to mislead someone in the platform's name.

**Why it waits.** `notify()` in `services/notificationService.ts` runs in the browser, writes the row as the signed-in user and then calls `send-email`, on both refs. Dropping the policy today would silently stop every notification below.

**Client calls that reach another user.** Line numbers are from this branch.

| Sender | Where | Event | Recipient |
|---|---|---|---|
| Admin | `app/admin/disputes/page.tsx:111` | `dispute.update` | Dispute submitter |
| Admin | `app/admin/operators/page.tsx:313` | `operator.compliance_approved` | Operator |
| Admin | `app/admin/operators/page.tsx:346` | `operator.compliance_rejected` | Operator |
| Admin | `app/admin/release/page.tsx:110` | `cargo.released` | Booking customer |
| Operator | `app/operator/bookings/page.tsx:402` | `booking.cancelled` | Booking customer |
| Operator | `app/operator/bookings/page.tsx:408` | `booking.status_updated` | Booking customer |
| Operator | `app/operator/bookings/page.tsx:457` | `container.departure_notice` | Booking customer |
| Operator | `app/operator/page.tsx:155` | `container.departure_notice` | Booking customer |
| Customer or operator | `components/MessageThread.tsx:110` | `message.new` | The other party on the booking |

These calls send to the user themselves and keep working on `Users can insert own notifications`: `app/auth/callback/page.tsx:25`, `app/booking/[containerId]/page.tsx:400`, `app/operator/compliance/agreement/page.tsx:98`, `actions/operatorActions.ts:98`.

**Inserts that never arrive.** These write `notifications` directly with `user_id`, `message` and `type`. The table has `recipient_id`, `event` and `body` instead, and none of them checks the error, so they fail silently today. No test covers them.

- To another user: `app/operator/bookings/page.tsx:618`, `app/transporter/jobs/[id]/page.tsx:102` and `:148`, `actions/adminMeasurementJobActions.ts:48`, and both inserts in each of `actions/adminAgentActions.ts`, `adminCustomerActions.ts`, `adminMeasurementAgentActions.ts` and `adminTransporterActions.ts`.
- To the user themselves: `actions/agentActions.ts:199`, `actions/customerKycActions.ts:91`, `actions/measurementAgentActions.ts:56`, `actions/transporterActions.ts:63`.

So an agent, measurement agent, transporter or KYC customer is never told the admin's decision in the app. Decide whether to fix these in the same work. Moving the cross-user ones onto `notify()` is the natural fix.

**Smallest design: one Edge Function that chooses the recipient.**

1. Add a function `notify`, called with the signed-in user's token and `{ event, bookingId or disputeId or operatorProfileId, ...fields }`.
2. With the service role, it finds the recipient from the record and checks the caller's right to send that event:
   - admin events: the caller passes `is_admin()`;
   - booking events: the caller operates the booking's container;
   - `message.new`: the caller is a party to the booking, and the recipient is the other party.
3. It builds the title and body from the event, using the templates now in `notificationService.ts`, then writes the row and sends the email. The client no longer supplies any free text.
4. In `notificationService.ts`, `notify()` calls this function for the events in the table. Its callers do not change, except that `recipientId` is ignored for those events.
5. Keep `verify_jwt` true on this function, and add it to the table in `security-deployment-2026-11.md`.

Migration, after the frontend is live:

```sql
drop policy if exists "authenticated_insert_notifications" on public.notifications;
```

`Users can insert own notifications` stays for the calls that send to the user themselves. Rows from `fire_departure_notices` and Edge Functions bypass RLS.

In `decideEmail`, refuse a non-privileged `recipientId` unless it is the caller, and deploy `send-email` again. Then remove the `send-email` call from `notify()` for those events. Update the `decideEmail` tests in `tests/front-door-security.spec.ts`.

**Test first:** a signed-in user cannot insert a notification for another user. A stranger to a booking cannot send `message.new` or `booking.status_updated` for it. Each row in the table above still reaches its recipient. No test sends mail to an outside address.
