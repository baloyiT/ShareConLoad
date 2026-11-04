# New Front Door Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present ShareConLoad as a freight discovery platform, hide the container marketplace until Stage 3, give operators a lighter sign-up with services and coverage, and publish a safe public directory.

**Architecture:** Client-side Next.js pages call Supabase directly. Two constants control release: `STAGE_3_PUBLIC` and `OPERATOR_SIGNUP_OPEN`. All anonymous directory reads go through narrow `SECURITY DEFINER` functions, never through `operator_profiles`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, DaisyUI, lucide-react, Supabase (Postgres, Auth, Edge Functions), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-new-front-door-design.md`

## Global Constraints

- New work is Module A. Module B changes are limited to hiding entry points.
- `operator_is_compliant()` and `requiredDocTypes()` are not edited.
- No new public policy on `operator_profiles`. No Paystack calls in new code.
- No `any`. Status values are TypeScript unions matching the database exactly.
- Every migration is idempotent and saved in `supabase/migrations/`, per `CLAUDE.md`.
- Applying a migration changes the only Supabase project (`fkhfbifgvebygafsewot`). Get the user's confirmation before the first apply in a session.
- Brand: navy `#081D3A`, orange `#FF6A00`, light orange `#FFB37B`, sky `#1FA8FF`, Poppins headings, Inter body, `lucide-react` outlined icons.
- Tagline: "Freight. Connected."
- Footer line on every public page, verbatim: "Independent operators deliver the freight and are responsible for it. ShareConLoad connects you."
- Copy never claims lowest price, guaranteed quotes, guaranteed volumes, guaranteed operator quality or operator counts.
- Only email address: support@shareconload.com.
- Branch: create `feature/front-door` from `feature/agreement-pdf`, because `agreement_acceptances` and migration `_73` exist only there. Do not stage the unrelated working-tree changes (`CLAUDE.md`, `MyAsset/`, `.claude/`) except where a task says so.
- Test command: `npx playwright test tests/<file> --project=chromium`. Expected output for a pass: all listed tests pass, 0 failed.

## Review Focus

1. A customer returning from Paystack to `/measurement-service/[jobId]?verify=1` must reach the page and verify payment, never get redirected. Test in Task 4.
2. An operator using the API directly must not be able to set their own verification, participation or terms fields, because "Users manage own operator profile" allows `ALL`. Test in Task 2.
3. A suspended or unverified operator opened by direct URL must show "not found", and their contact details must not be returned. Test in Task 3.
4. Hero text with `&`, quotes, HTML or very long input must reach `/contact` intact, and must not inject HTML into the alert email. Test in Task 6.
5. A logged-in admin, operator or agent opening `/` must still reach their dashboard as today. Test in Task 5.

---

### Task 1: Taxonomy, services and coverage tables

**Files:**
- Create: `supabase/migrations/20261104_74_service_taxonomy.sql`
- Create: `supabase/migrations/20261104_75_operator_services_coverage.sql`
- Create: `services/freightTypes.ts`
- Test: `tests/front-door-schema.spec.ts`

**Interfaces:**
- Produces tables:
  - `service_categories(id uuid pk, name text, slug text unique, transport_mode transport_mode null, parent_id uuid null, sort_order int, is_active boolean default true)`
  - `operator_services(id uuid pk, operator_profile_id uuid fk, service_category_id uuid fk, unique pair)`
  - `operator_coverage(id uuid pk, operator_profile_id uuid fk, origin_country text, origin_city text null, destination_country text, destination_city text null, transport_mode transport_mode null)`
- Produces enum `transport_mode`: `sea`, `air`, `road`, `rail`.
- Produces TS in `services/freightTypes.ts`: `TransportMode`, `ServiceCategory`, `OperatorService`, `OperatorCoverage`.

- [ ] **Step 1: Create the branch and commit the spec and this plan.**

Run: `git switch -c feature/front-door`, then `git add docs/superpowers/specs/2026-11-04-new-front-door-design.md docs/superpowers/plans/2026-11-04-new-front-door.md` and commit.

- [ ] **Step 2: Write failing tests**

```ts
test('anon reads active categories, including customs-clearing', async () => {
  const { data } = await anon.from('service_categories').select('slug');
  expect(data?.map(c => c.slug)).toEqual(expect.arrayContaining([
    'sea-freight','air-freight','road-freight','rail-freight','forwarding',
    'customs-clearing','consolidation','warehousing','household-removals','oversized-cargo']));
});
test('anon cannot write categories', ...);          // insert returns an error
test('anon cannot read operator_coverage directly', ...); // 0 rows
test('operator cannot add coverage for another operator', ...); // insert returns an error
```

- [ ] **Step 3: Run tests, expect FAIL** (tables missing).
- [ ] **Step 4: Write both migrations.** Seed the ten slugs with `on conflict (slug) do nothing`; the four freight rows set `transport_mode`. RLS: categories are readable by everyone, writable by `is_admin()`. Services and coverage are managed by the owner (`operator_profile_id in (select op.id from operator_profiles op join profiles p on p.id = op.profile_id where p.user_id = auth.uid())`, using `IN` because users can hold several profile rows) and by `is_admin()`. No anon read.
- [ ] **Step 5: Apply migrations, run tests, expect PASS.**
- [ ] **Step 6: Commit.**

### Task 2: Operator listing status

**Files:**
- Create: `supabase/migrations/20261104_76_operator_listing_status.sql`
- Modify: `services/operatorCompliance.ts`
- Test: `tests/front-door-schema.spec.ts`

**Interfaces:**
- Produces columns on `operator_profiles`: `verification_level` (`registered` default, `identity_verified`, `business_verified`), `participation_status` (`pending` default, `active`, `suspended`, `deactivated`), `public_description`, `public_phone`, `public_email`, `participation_terms_accepted_at`, `participation_terms_version`.
- Produces SQL: `operator_is_listed(op_id uuid) returns boolean`; `accept_participation_terms(p_version text, p_text text) returns void`.
- Produces TS: `listingDocTypes(entity: string | null | undefined): string[]`, `VerificationLevel`, `ParticipationStatus`, `verificationLabel(level: VerificationLevel): string | null`.

- [ ] **Step 1: Write failing tests**

```ts
test('operator cannot set own verification_level', ...);     // update raises, value unchanged
test('operator cannot set own participation_status', ...);
test('operator cannot set participation_terms_accepted_at directly', ...);
test('accepting terms writes the column and one agreement_acceptances row with type operator_participation_terms', ...);
test('accepting terms leaves service_agreement_signed_at null', ...);
test('listed only when verified, active, terms accepted, one service and one coverage row', ...);
test('listingDocTypes: individual is identity only; company is identity and business_registration', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Write the migration.**
  - A `before update` trigger raises an exception when any of the four protected fields (`verification_level`, `participation_status`, `participation_terms_accepted_at`, `participation_terms_version`) change, `current_user` is `authenticated` or `anon`, and `is_admin()` is false. `SECURITY DEFINER` functions run as their owner, so they pass.
  - `accept_participation_terms` is `SECURITY DEFINER` with `search_path = public`. It resolves the caller's operator profile through `auth.uid()`, sets the two terms fields, and inserts into `agreement_acceptances` with `agreement_type = 'operator_participation_terms'`.
  - Backfill: `business_verified` for non-individuals with approved `identity` and `business_registration`; `identity_verified` for individuals with approved `identity`; everyone stays `pending`. The database holds 5 operators, all `draft`.
- [ ] **Step 4: Add the TS helpers.** `verificationLabel` returns "Business verified", "Identity verified", or `null` for `registered`.
- [ ] **Step 5: Apply, run tests, expect PASS.**
- [ ] **Step 6: Commit.**

### Task 3: Public directory data

**Files:**
- Create: `supabase/migrations/20261104_77_public_directory.sql`
- Modify: `services/freightTypes.ts`
- Test: `tests/front-door-directory-data.spec.ts`

**Interfaces:**
- Produces, all `SECURITY DEFINER`, granted to `anon, authenticated`:
  - `search_directory(p_service text, p_mode text, p_origin_country text, p_origin_city text, p_destination_country text, p_destination_city text)` returning `DirectoryOperator` rows. Every parameter is optional. A coverage row with a null city covers the whole country.
  - `get_directory_operator(op_id uuid)` returning one `DirectoryOperator`, or no rows if not listed.
  - `get_operator_contact(op_id uuid)` returning `public_phone, public_email`, or no rows if not listed. It inserts into `operator_contact_views(id, operator_profile_id, viewed_at)`.
- Produces TS `DirectoryOperator`: `{ id, display_name, public_description, verification_level, services: string[], coverage: OperatorCoverage[] }`. `display_name` comes from `legal_name`.

- [ ] **Step 1: Write failing tests** (seed a listed and a suspended test operator with the service-role key, remove them afterwards)

```ts
test('anon cannot select from operator_profiles', ...);       // 0 rows
test('search result keys contain no bank, paystack, id_number or phone fields', ...);
test('search with no filters returns only listed operators', ...);
test('country-wide coverage matches a search for a city in that country', ...);
test('suspended operator: get_directory_operator and get_operator_contact return no rows', ...);
test('get_operator_contact records one view and creates no lead', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Write the migration.** RLS on `operator_contact_views`: admin read only, no client writes.
- [ ] **Step 4: Apply, run tests, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 4: Stage 3 switch and gate

**Files:**
- Create: `services/releaseFlags.ts`, `components/Stage3Gate.tsx`
- Create: `app/container/layout.tsx`, `app/booking/[containerId]/layout.tsx`, `app/onboarding/agent/layout.tsx`, `app/onboarding/transporter/layout.tsx`, `app/onboarding/measurement-agent/layout.tsx`
- Modify: `app/agent/page.tsx`, `app/transporter/page.tsx`, `app/measurement-agent/page.tsx`, `app/measurement-service/page.tsx`, `app/operator/create/page.tsx`, `app/onboarding/page.tsx`
- Modify (remove "Browse Containers" and similar links): `app/bookings/page.tsx`, `app/booking/[containerId]/page.tsx`, `app/onboarding/customer/status/page.tsx`
- Test: `tests/front-door-hiding.spec.ts`

**Interfaces:**
- Produces: `export const STAGE_3_PUBLIC = false;` and `export const OPERATOR_SIGNUP_OPEN = false;`
- Produces: `type Stage3Audience = 'admin' | 'operator' | 'agent' | 'measurement_agent' | 'transporter' | 'has_booking' | 'has_containers'`
- Produces: `<Stage3Gate allow={Stage3Audience[]}>{children}</Stage3Gate>`. It renders children when `STAGE_3_PUBLIC` is true or the user matches; otherwise `router.replace('/')`. Admin always matches.

Audience checks: `profiles.role_type` and `profiles.is_admin`; `bookings.customer_id = user.id`; `containers.operator_id = user.id`.

| Route | `allow` |
|---|---|
| `/container/*` | `has_booking`, `has_containers` |
| `/booking/[containerId]` | none (admin only) |
| `/onboarding/agent/*`, `/agent` | `agent` |
| `/onboarding/transporter/*`, `/transporter` | `transporter` |
| `/onboarding/measurement-agent/*`, `/measurement-agent` | `measurement_agent` |
| `/measurement-service` (this page only, no layout) | `has_booking` |
| `/operator/create` | `has_containers` |

- [ ] **Step 1: Write failing tests**

```ts
test('anon is redirected to / from each hidden route', ...);  // /container/x, /booking/x, /agent, /transporter, /measurement-agent, /measurement-service, /onboarding/agent
test('/measurement-service/[jobId]?verify=1 is not redirected', ...);
test('/pickup/[bookingId] is not redirected', ...);
test('/booking/track/[id] and /bookings are not redirected', ...);
test('agent test user can open /agent', ...);
test('/onboarding offers only Customer and Operator to a user with no other role', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement.** Do not add a layout at `app/measurement-service/`, because it would wrap `[jobId]`. On `/onboarding`, keep role cards the user already holds.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 5: Shared navigation and home page

**Files:**
- Create: `components/PublicNav.tsx`, `components/PublicFooter.tsx`, `components/HomeEnquiryForm.tsx`
- Rewrite: `app/page.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/front-door-home.spec.ts`

**Interfaces:**
- Produces: `PublicNav` (no props) and `PublicFooter` (no props). Later tasks use both.
- Produces: `buildEnquiryContactUrl(what: string, from: string, to: string): string` in `components/HomeEnquiryForm.tsx`, returning `/contact?subject=Freight%20enquiry&message=...`, encoded with `encodeURIComponent`, and with `what` truncated to 500 characters.

- [ ] **Step 1: Write failing tests**

```ts
test('home shows "What do you need to move?" and Browse operators link', ...);
test('home has no container listing, List Your Container or Join as Agent', ...);
test('footer shows the operator responsibility line', ...);
test('Continue opens /contact with the three answers in the message', ...);
test('logged-in operator opening / reaches /operator', ...);
test('logged-in admin opening / reaches /admin', ...);
test('home has no horizontal scroll at 375px wide', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Build the components.** Move the login and role-menu logic from `app/page.tsx:250-470` into `PublicNav`. Keep the role redirect logic in `app/page.tsx`. Links: Find operators (`/directory`), How it works, For operators (`/for-operators`), Log in, Get quotes (`#get-quotes`). The wordmark uses `public/logo1.png` plus styled text, as in the approved mockup.
- [ ] **Step 4: Rewrite `app/page.tsx`** with the five sections from the spec. Copy for the headline and three steps comes from the approved mockup, option A, at `.superpowers/brainstorm/1093-1793807458/content/homepage.html` in the main checkout (the folder is git-ignored, so it won't exist in a worktree). Update site title to "ShareConLoad – Freight. Connected." and write a matching description.
- [ ] **Step 5: Run tests, expect PASS.**
- [ ] **Step 6: Commit.**

### Task 6: Contact prefill, alert and admin list

**Files:**
- Modify: `app/contact/page.tsx`, `app/admin/page.tsx`
- Create: `app/admin/contact/page.tsx`, `services/textUtils.ts`
- Test: `tests/front-door-contact.spec.ts`

**Interfaces:**
- Consumes: `buildEnquiryContactUrl` output.
- Produces: `escapeHtml(value: string): string` in `services/textUtils.ts` (Next.js page files can't have extra named exports).

- [ ] **Step 1: Write failing tests**

```ts
test('/contact prefills subject and message from the query string', ...);
test('hero text with & " < > survives the round trip unchanged', ...);
test('a 2000-character description does not break the page', ...);
test('freight enquiry submission still succeeds if the email alert fails', ...);
test('alert body escapes HTML', ...);
test('admin sees submissions newest first at /admin/contact; customer is redirected', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement.** Add "Freight enquiry" to the subject options. Wrap `useSearchParams` in `Suspense`. After a successful insert with that subject, call `supabase.functions.invoke('send-email', ...)` with `to: 'support@shareconload.com'` and escaped values. An alert failure is logged and never shown to the customer. Add `/admin/contact` to the `app/admin/page.tsx` list.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 7: Public pages

**Files:**
- Rewrite: `app/about/page.tsx`, `app/how-it-works/page.tsx`, `app/pricing/page.tsx`, `app/operator-verification/page.tsx`
- Create: `app/for-operators/page.tsx`
- Modify: `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/contact/page.tsx`, `app/cancellation/page.tsx`, `app/payment-flow/page.tsx`, `app/dispute-resolution/page.tsx`
- Modify: `tests/static-pages.spec.ts`
- Test: `tests/front-door-pages.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
const banned = /container space|list your container|escrow|cbm|become an agent/i;
test('about, how-it-works, pricing, for-operators contain no banned phrases', ...);
test('every public page shows the operator responsibility line', ...);
test('pricing says customers pay nothing and shows no lead price', ...);
test('operator-verification explains both labels and says neither guarantees service quality', ...);
test('for-operators shows Register your interest while OPERATOR_SIGNUP_OPEN is false', ...);
test('terms states operators deliver and are responsible for freight services', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Rewrite the pages** using the spec's table, `PublicNav` and `PublicFooter`. Update the `how-it-works` test in `tests/static-pages.spec.ts`, which expects agent and shipper journeys. `/payment-flow`, `/cancellation` and `/dispute-resolution` keep their content and only lose navigation links.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 8: Lighter operator sign-up

**Files:**
- Create: `services/participationTerms.ts`, `app/operator/compliance/terms/page.tsx`
- Modify: `components/OperatorSidebar.tsx`, `app/operator/compliance/page.tsx`, `app/operator/compliance/profile/page.tsx`, `app/operator/compliance/contact/page.tsx`, `app/operator/compliance/documents/page.tsx`, `app/operator/page.tsx`, `app/onboarding/operator/page.tsx`
- Test: `tests/front-door-operator.spec.ts`

**Interfaces:**
- Consumes: `listingDocTypes`, `accept_participation_terms`, `OPERATOR_SIGNUP_OPEN`, `Stage3Gate` audience checks.
- Produces: `PARTICIPATION_TERMS_VERSION`, `PARTICIPATION_TERMS_TITLE`, `PARTICIPATION_TERMS_CLAUSES`, `participationTermsPlainText()`, matching `services/agreementContent.ts` in shape.

Steps shown to new operators, in order: Profile, Contact, Services & coverage (`/operator/services`), Documents, Participation terms.

- [ ] **Step 1: Write failing tests**

```ts
test('new operator sees five steps and no Account step', ...);
test('new operator menu has no containers, bookings or payouts', ...);
test('operator with containers still sees those items and the bank page', ...);
test('documents page asks a company for two documents and an individual for one', ...);
test('contact step labels public phone and email as shown in the directory', ...);
test('/operator sends a new operator to /operator/compliance', ...);
test('/onboarding/operator redirects to /for-operators while OPERATOR_SIGNUP_OPEN is false', ...);
test('accepting terms records acceptance and leaves the Stage 3 gate false', ...); // operator_is_compliant stays false
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement.** Use `has_containers` or an operator's existing bookings to choose between the new and existing menu. The existing agreement and bank pages stay at their URLs. Add `public_description` to the Profile step, and `public_phone` and `public_email` to the Contact step. `OPERATOR_SIGNUP_OPEN` guards `/onboarding/operator` only, so existing operators are unaffected.
- [ ] **Step 4: Draft `services/participationTerms.ts`** covering the spec's list: free founding leads for 90 days, outcome reporting, preferential pricing later, no guaranteed volumes, operators responsible for services, data handling. Mark the version `0.1-draft`. Legal review is outstanding.
- [ ] **Step 5: Run tests, expect PASS.**
- [ ] **Step 6: Commit.**

### Task 9: Services and coverage editor

**Files:**
- Create: `components/CoverageEditor.tsx`, `app/operator/services/page.tsx`
- Modify: `components/OperatorSidebar.tsx`
- Test: `tests/front-door-operator.spec.ts`

**Interfaces:**
- Consumes: Task 1 tables and types; `LocationAutocomplete` with `onSelect?: (loc: Location | null) => void`.
- Produces: `CoverageEditor` props `{ operatorProfileId: string }`.

- [ ] **Step 1: Write failing tests**

```ts
test('operator ticks a service and it persists after reload', ...);
test('operator adds and removes a coverage row', ...);
test('adding the same coverage twice shows a friendly message', ...);
test('the step shows complete with one service and one coverage row', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement.** Add a unique index for duplicate coverage in a `_78` migration only if the database must enforce it; otherwise check in the client. Errors are logged and shown in plain language.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 10: Admin verification and taxonomy

**Files:**
- Modify: `app/admin/operators/page.tsx`, `app/admin/page.tsx`
- Create: `app/admin/taxonomy/page.tsx`
- Test: `tests/front-door-admin.spec.ts`

**Interfaces:**
- Consumes: `VerificationLevel`, `ParticipationStatus`, `logAudit({ action, target_type, target_id, metadata })`.

- [ ] **Step 1: Write failing tests**

```ts
test('admin verifies a company as Business verified, and an audit row is written', ...);
test('Verify offers only Identity verified for an individual', ...);
test('admin activates and suspends an operator, each audited', ...);
test('suspending removes the operator from the directory', ...);
test('admin adds, renames and deactivates a service category', ...);
test('non-admin cannot open /admin/taxonomy', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement** beside the existing operator actions. Leave the existing `status` controls alone. Audit actions: `operator_verified`, `operator_activated`, `operator_suspended`.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 11: Directory pages

**Files:**
- Create: `components/OperatorDirectoryCard.tsx`, `app/directory/page.tsx`, `app/directory/[operatorId]/page.tsx`
- Test: `tests/front-door-directory.spec.ts`

**Interfaces:**
- Consumes: `search_directory`, `get_directory_operator`, `get_operator_contact`, `DirectoryOperator`, `verificationLabel`, `buildEnquiryContactUrl`.

- [ ] **Step 1: Write failing tests**

```ts
test('anon can search and open a listed operator', ...);
test('card and profile show the exact verification label', ...);
test('no phone or email in the page until Contact this operator is clicked', ...);
test('no results shows "Tell us what you're moving and we'll help"', ...);
test('empty directory shows the prompt and no sample operators', ...);
test('unknown or suspended operator id shows a friendly not found', ...);
test('filter state survives opening a profile and going back', ...);
```

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement.** Filters live in the URL query, and `useSearchParams` is wrapped in `Suspense`. The prompt links through `buildEnquiryContactUrl` with any route the visitor searched.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 12: Regression pass and project docs

**Files:**
- Modify: `tests/shareconload.spec.ts`, `tests/booking-flow.spec.ts`, `tests/customer-kyc.spec.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full suite** with `npx playwright test --project=chromium` and list failures.
- [ ] **Step 2: Sort each failure.** A test of the old home page or a hidden entry point is updated, or skipped with the comment `// hidden until Stage 3`. Any other failure is a real bug: fix it.
- [ ] **Step 3: Update `CLAUDE.md`.** Replace planned migration numbers 18–24 with the real ones, remove open questions 1–4 and record their answers, and change the strategy source to v2.1. The working tree already has uncommitted `CLAUDE.md` edits: show the user the combined diff before committing.
- [ ] **Step 4: Run `npm run lint`, `npm run build` and the full suite.** Expected: lint and build exit 0, and no failing tests.
- [ ] **Step 5: Commit.**
