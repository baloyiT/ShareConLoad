# ShareConLoad Test Plan

## Test Stack
- **Framework**: Playwright (already configured)
- **Runner**: `npx playwright test`
- **Base URL**: `http://localhost:3000`
- **Auth strategy**: Saved browser state via `playwright/.auth/` for authenticated test suites

---

## Coverage Status

| Area | Current | Target |
|---|---|---|
| Home page rendering | covered | done |
| Container search / filter | covered | done |
| Navbar navigation | covered | done |
| Login validation | covered | done |
| Register validation | covered | done |
| Auth redirects | covered | done |
| Container details | none | needed |
| Booking flow | none | needed |
| Payment flow | none | needed |
| Shipment tracking | none | needed |
| My Bookings | none | needed |
| Operator dashboard | none | needed |
| Operator: create container | none | needed |
| Operator: manage bookings | none | needed |
| Operator: compliance gate | none | needed |
| Operator: payouts | none | needed |
| Disputes | none | needed |
| Support tickets | none | needed |
| Admin: bookings | none | needed |
| Admin: operators | none | needed |
| Admin: payouts | none | needed |
| Admin: disputes | none | needed |
| Admin: cargo release | none | needed |
| Admin: compliance | none | needed |
| Policy pages | none | needed |
| Forgot / reset password | none | needed |

---

## Priority 1 — Critical Path (Booking + Payment)

### Container Details (`/container/[id]`)
- Renders container title, route, price per CBM, available capacity
- "Book Now" button is visible
- Shows "not found" state for invalid container ID
- Back button returns to previous page

### Booking Flow (`/booking/[containerId]`)
- Redirects unauthenticated user to login
- Renders booking form with CBM input, item description, declared value fields
- Shows running total as CBM changes
- Validates required fields on submit (empty CBM, missing declaration)
- Declaration checkbox must be checked before submission is allowed
- Photo upload: accepts image files, rejects non-images
- Shows error if CBM exceeds available capacity
- On valid submit, redirects to payment page

### Payment Flow (`/payments/[bookingId]`)
- Redirects unauthenticated user to login
- Shows the three payment stages (20% deposit, 50% pre-departure, 30% final release)
- Only Stage 1 is actionable on a fresh booking
- Stage 2 and 3 are locked until prior stage is paid
- "Pay Now" triggers Paystack redirect (assert redirect URL contains paystack.co)
- Payment callback page (`/payments/callback`) handles success and failure query params

### Payment History (`/payments/history`)
- Redirects unauthenticated user to login
- Shows list of payments for the logged-in user
- Empty state renders without error

### My Bookings (`/bookings`)
- Redirects unauthenticated user to login
- Renders booking list for logged-in customer
- Each booking shows status badge
- Empty state renders without error
- Clicking a booking opens the booking detail / tracking page

### Shipment Tracking (`/booking/track/[id]`)
- Redirects unauthenticated user to login
- Renders milestone timeline
- Shows current milestone highlighted
- Invalid booking ID shows error state

---

## Priority 2 — Operator Flows

### Onboarding (`/onboarding`, `/onboarding/operator`)
- `/onboarding` shows role selection (Customer / Operator)
- Selecting Operator navigates to `/onboarding/operator`
- Operator onboarding form renders all fields (company name, registration, bank details)
- Validates required fields on submit
- Paystack recipient setup: requires account number and bank name

### Operator Dashboard (`/operator`)
- Redirects unauthenticated user to login
- Renders container list for logged-in operator
- Shows total CBM, available CBM, and status for each container
- Empty state renders without error

### Create Container (`/operator/create`)
- Renders all required fields (origin, destination, capacity, price per CBM, departure date)
- Validates required fields on submit
- Rejects non-numeric values in CBM and price fields
- On valid submit, new container appears in operator dashboard

### Operator Bookings (`/operator/bookings`)
- Renders bookings across operator's containers
- Operator can record a shipment milestone
- Milestone dropdown shows correct options for current booking status
- Milestone save shows confirmation

### Operator Compliance (`/operator/compliance/*`)
- Profile step renders and saves company details
- Contact step renders and saves contact details
- Documents step accepts file uploads (PDF/image)
- Agreement step requires checkbox before proceeding
- Incomplete compliance gate blocks container creation

### Operator Payouts (`/operator/payouts`)
- Renders payout history for logged-in operator
- Shows payout status (pending / paid)
- Empty state renders without error
- Payout hold notice shown when `payout_hold = true`

### Operator Bank (`/operator/bank`)
- Renders bank account form
- Validates required fields
- Saves successfully and shows confirmation

---

## Priority 3 — Disputes and Support

### Submit Dispute (`/disputes/new`)
- Redirects unauthenticated user to login
- Renders dispute form (booking ID, reason, description)
- Validates required fields
- File evidence upload accepts PDF and image files
- On valid submit, shows confirmation

### Dispute Detail (`/disputes/[id]`)
- Redirects unauthenticated user to login
- Renders dispute status and description
- Shows evidence files
- Invalid dispute ID shows error state

### Support Ticket (`/support/new`)
- Redirects unauthenticated user to login
- Renders subject and description fields
- Validates required fields
- On valid submit, shows confirmation

---

## Priority 4 — Admin

> Admin tests require a session with `is_admin = true`. Use saved auth state.

### Admin Hub (`/admin`)
- Renders navigation links to all admin sections
- Non-admin user is redirected or shown access denied

### Admin Bookings (`/admin/bookings`)
- Renders full booking list across all users
- Shows booking status badges
- Clicking a booking shows detail

### Admin Operators (`/admin/operators`)
- Renders operator list with payout status
- Toggle `payout_enabled` updates the operator record
- Toggle `payout_hold` updates the operator record

### Admin Payouts (`/admin/payouts`)
- Renders pending payouts
- Approve payout triggers transfer (assert API call or success message)
- Shows error if operator has no recipient code set

### Admin Disputes (`/admin/disputes`)
- Renders open disputes
- Admin can resolve a dispute and select outcome
- Resolved dispute changes status

### Admin Cargo Release (`/admin/release`)
- Renders cargo release authorizations
- Each of the four conditions can be toggled
- Release button only enabled when all four conditions are true

### Admin Compliance (`/admin/compliance`)
- Renders compliance flags list
- Admin can approve or reject an operator's compliance submission

### Admin Commission (`/admin/commission`)
- Renders commission settings
- Changes save correctly

---

## Priority 5 — Static and Auth Pages

### Policy Pages
- `/privacy` renders Privacy Policy heading and content
- `/terms` renders Terms and Conditions heading and content
- `/cancellation` renders Cancellation and Refund Policy heading and content
- `/pricing` renders Pricing heading, payment stage table, and commission table
- `/how-it-works` renders all three steps

### Forgot Password (`/auth/forgot-password`)
- Renders email field
- Validates empty submit
- Shows confirmation message on valid email

### Reset Password (`/auth/reset-password`)
- Renders new password and confirm password fields
- Validates mismatched passwords
- Validates minimum password length

---

## Test File Structure

```
tests/
  shareconload.spec.ts       # existing: home, search, nav, login, register, auth redirects
  booking.spec.ts            # container details, booking form, payment flow, tracking
  operator.spec.ts           # onboarding, dashboard, create container, bookings, compliance, payouts
  disputes.spec.ts           # disputes and support tickets
  admin.spec.ts              # all admin pages (requires admin auth state)
  policies.spec.ts           # static policy and info pages
  auth.setup.ts              # saves customer and operator auth state to playwright/.auth/
  admin.setup.ts             # saves admin auth state to playwright/.auth/
```

## Auth Setup Approach

Playwright supports saved authentication state via `storageState`. The setup files log in once and save cookies/localStorage so authenticated test suites skip the login step.

```ts
// tests/auth.setup.ts
import { test as setup } from '@playwright/test'

setup('authenticate as customer', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByPlaceholder('you@example.com').fill(process.env.TEST_CUSTOMER_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.TEST_CUSTOMER_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/')
  await page.context().storageState({ path: 'playwright/.auth/customer.json' })
})
```

Required env vars (add to `.env.local`):
```
TEST_CUSTOMER_EMAIL=
TEST_CUSTOMER_PASSWORD=
TEST_OPERATOR_EMAIL=
TEST_OPERATOR_PASSWORD=
TEST_ADMIN_EMAIL=
TEST_ADMIN_PASSWORD=
```
