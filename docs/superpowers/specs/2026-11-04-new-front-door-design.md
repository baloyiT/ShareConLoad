# New Front Door: Design (Project 1 of 3)

Date: 2026-11-04
Source: `MyAsset/Business Strategy  Platform Design Blueprint v2.1.docx` (the file name says v2.1; its cover says 2.0). Sections 1–12 outrank the appendices.

## Why

ShareConLoad is moving from a container-sharing marketplace to freight discovery and qualified leads. The public site still sells container space and takes real Paystack payments, which contradicts the launch position: "ShareConLoad does not handle freight payments at this stage".

There is no pilot date and no founding operators yet. So the first job is a site that presents the new business honestly and lets operators join. Customer demand comes after that.

## The redesign in three projects

Agreed order. Each gets its own design, and this document covers only project 1.

1. **New front door (this document):** public site, hiding Stage 3, lighter operator sign-up, services and coverage, public directory.
2. **Enquiry to lead:** guided enquiry, admin review, qualification, manual matching, accept or decline.
3. **Quote to outcome:** quotes, comparison, outcome reporting, activity reports, billing records.

## Goals

- A first-time visitor understands ShareConLoad in seconds and can start describing a shipment.
- Nobody can discover or start a container booking from the public site.
- An operator can sign up, describe services and coverage, get verified and appear in the directory, without giving bank details.
- Anyone can browse approved operators without an account.

## Non-goals

- The guided enquiry form, leads, quotes and outcomes (projects 2 and 3).
- Any change to Module B behaviour beyond hiding entry points.
- Deleting Module B code, tables or Edge Functions.
- Lead billing, premium listings, automated matching, reviews or ratings for directory operators.

## Anti-goals: failure even if it works

- Any route exposes operator bank details, Paystack codes or compliance documents publicly.
- A customer with a booking in progress loses access to it or to a payment that is due.
- The site implies ShareConLoad carries freight, guarantees operators or promises the lowest price.
- `operator_is_compliant()` is loosened, letting a lightly verified operator list containers later.

## Decisions made by the founder

- Home page direction A: "What do you need to move?" leads, with browsing operators one click away.
- Container booking is hidden until Stage 3.
- Customers can submit an enquiry with contact details only, no account (built in project 2).
- Founding operators get a lighter sign-up, and the bank step is dropped until Stage 3.
- Claude drafts the operator participation terms for review.
- Individuals can be listed, labelled "Identity verified".
- Guided enquiry uses three short screens (project 2; mockup saved in `.superpowers/brainstorm/`).

## Home page (`app/page.tsx`)

Replaces the container listing. In order:

1. **Navigation:** logo with wordmark, Find operators, How it works, For operators, Log in, Get quotes button.
2. **Hero:** port image with navy overlay. Headline "Tell us what you need to move. We'll find the right operators." Support line: sea, air, road or rail, no freight terms needed.
3. **Hero form:** "What do you need to move?", From, To (reuse `LocationAutocomplete`), Continue. Link beneath: "Already know what you need? Browse operators".
4. **Three steps:** Describe it; We check and match; Compare and choose.
5. **Operator invitation:** short section linking to For operators.
6. **Footer:** the line "Independent operators deliver the freight and are responsible for it. ShareConLoad connects you." appears on every public page.

The wording is draft and may be polished. Claims not allowed: lowest price, guaranteed quotes, guaranteed operator quality, operator counts we don't have.

**Until project 2 ships:** Continue opens `/contact` with the three answers prefilled into the message. `contact_submissions` already stores these, so no new table is needed. Nothing reads that table today, so project 1 also adds a "Freight enquiry" subject, a simple `/admin/contact` list, and an email alert to support@shareconload.com using the existing `send-email` function. (My call.)

## Public pages

| Page | Action |
|---|---|
| `/about`, `/how-it-works` | Rewrite for the new model |
| `/pricing` | Rewrite: free for customers; listings and founding-operator leads are free. No lead price, it isn't set yet |
| `/operator-verification` | Rewrite to explain exactly what "Business verified" and "Identity verified" each mean, and that neither guarantees service quality |
| `/contact` | Keep, accept prefilled message |
| `/terms`, `/privacy` | Keep the routes. Text is replaced when the founder's new documents exist. Add the operator-responsibility statement now |
| `/cancellation`, `/payment-flow`, `/dispute-resolution` | Hide from navigation, keep reachable by direct link for existing bookings |
| `/agent`, `/transporter`, `/measurement-agent`, `/measurement-service`, `/pickup` | Hide from new visitors only. See "Hiding Stage 3": these are also working portals |
| New `/for-operators` | What operators get, free founding period, how verification works, Sign up button. No guaranteed volumes |

Site title and description in `app/layout.tsx` change from "Global Container Sharing" to the new position.

## Hiding Stage 3

- One switch, `STAGE_3_PUBLIC = false` in a small config file, read wherever an entry point is shown or guarded. Stage 3 turns it on.
- Remove from navigation and footers: Browse Containers, List Your Container, Become an Agent, Create Account links aimed at those roles. Known files: `app/page.tsx`, `app/about`, `app/agent`, `app/how-it-works`, `app/bookings`, `app/booking/[containerId]`, `app/onboarding/customer/status`.
- Redirect to home: `/container/[id]`, `/booking/[containerId]` (starting a new booking), `/onboarding/agent`, `/onboarding/transporter`, `/onboarding/measurement-agent`, and `/operator/create` for operators with no existing containers.
- **Rule for agent, transporter, measurement and pickup routes:** only people without that role, on the entry pages, are redirected. Role holders keep their portals and login routing. Job and booking pages are never redirected, including `/pickup/[bookingId]`, `/measurement-service/[jobId]` (it is the Paystack return URL and runs payment verification), `/agent/bookings`, `/transporter/jobs` and `/measurement-agent/jobs`.
- Role selection at `/onboarding` offers Customer and Operator only.
- **Stay fully working:** `/bookings`, `/booking/track/[id]`, `/payments/*`, `/disputes/*`, `/support/*`, operator booking pages, and all admin pages. Existing bookings, payments and payouts finish normally.
- Operators who already have containers or bookings still see those items in their menu, including the bank page so payouts can be fixed. New operators don't. (My call.)
- The hiding is a UI and routing change. A database guard against new bookings is left out because Module B is maintenance-only. (My call; reconsider if the builder finds an easy route around the redirect.)

No `proxy.ts` or middleware exists today. Page-level redirects fit the client-side rule and are preferred.

## Operator sign-up

Today `operator_is_compliant()` needs a Paystack recipient, signed agreement and six approved documents, including banking confirmation, tax clearance, warehouse proof and cargo insurance. That stays exactly as it is, as the Stage 3 gate for listing containers.

Add a separate, lighter path for leads and the directory:

1. **Profile:** legal or trading name, entity type, description.
2. **Contact:** phone, email, business address, plus separate public phone and public email fields, clearly labelled as shown in the directory. Private contact details are never published. (My call.)
3. **Services and coverage:** new step, see below.
4. **Documents:** companies upload `identity` and `business_registration`, which earns "Business verified" (the blueprint's Level 2; the document list is my call). Individuals upload `identity` only, which earns "Identity verified" (founder's decision). Do not use the existing `requiredDocTypes(entity_type)` here: it also asks for warehouse and banking documents. Add a separate lighter list.
5. **Participation terms:** accept new, shorter terms. Store this in its own column plus an `agreement_acceptances` record, with no PDF. Do not reuse `generate-agreement-pdf` as it stands: it sets `service_agreement_signed_at`, which counts towards `operator_is_compliant()`. (My call.)

`components/OperatorSidebar.tsx` and `app/operator/compliance/page.tsx` drop the Account step and show these five. The menu shows Services & coverage. Leads and Quotes appear in projects 2 and 3. The bank, full-document and service agreement pages remain for Stage 3 but aren't linked.

**Status:** following the blueprint, verification and participation are stored separately.

- `operator_profiles.verification_level`: `registered`, `identity_verified`, `business_verified`.
- `operator_profiles.participation_status`: `pending`, `active`, `suspended`, `deactivated`.
- The existing `status` column stays as it is for Module B.
- New SQL function `operator_is_listed(op_id)`: `identity_verified` or `business_verified`, `active`, terms accepted, and at least one service and one coverage row. `operator_is_compliant()` is not edited.

**Existing operators:** one-off backfill, all starting as `pending`. Companies with approved `identity` and `business_registration` documents start as `business_verified`, individuals with an approved `identity` document start as `identity_verified`, and everyone else starts as `registered`. All must add services and coverage and accept the new terms before being listed. The old service agreement doesn't count as acceptance. (My call.)

**Admin:** `/admin/operators` gets Verify and Activate/Suspend actions for the new fields. Each is written to the audit log. `/admin/taxonomy` manages service categories.

## Services and coverage

New tables as defined in `CLAUDE.md`: `service_categories` (seeded), `operator_services`, `operator_coverage`.

- **Seed categories:** sea, air, road and rail freight; forwarding; customs clearing; consolidation; warehousing; household removals; oversized cargo.
- **`/operator/services`:** `CoverageEditor` lets an operator tick services and add coverage (origin and destination country, optional city, mode) using `LocationAutocomplete`. A "domestic" or "worldwide" shortcut is left to the builder.

## Public directory

- **`/directory`:** search by service, mode, from and to. Shows only operators where `operator_is_listed` is true. Works without an account.
- **`/directory/[operatorId]`:** name, description, services, coverage, and the exact check passed ("Business verified" or "Identity verified"). Search results show the same label.
- **Contact:** a "Contact this operator" button fetches the operator's public phone and email on click, so they aren't sitting in the page for scrapers. It records a view for reporting but creates no lead.
- **Empty results:** every search with few or no results offers "Tell us what you're moving and we'll help", linking to the same route as Continue. This matters because 15–20 operators cannot cover worldwide routes.
- **Before there are operators:** the directory shows the same prompt, with no sample or fake operators.

**Data safety:** `operator_profiles` has no public read policy and holds bank fields. Do not add one. Expose a dedicated public view or security-definer function returning only the listed fields, for listed operators only. Add a test proving anonymous users cannot read bank, Paystack or document fields.

## Migrations

Continue numbering from the latest file (`_73`). Idempotent, per `CLAUDE.md`:

- `_74_service_taxonomy.sql`
- `_75_operator_services_coverage.sql`
- `_76_operator_listing_status.sql` (new columns, `operator_is_listed`, participation terms acceptance)
- `_77_public_directory.sql` (view or function, RLS)

The planned numbers 18–24 in `CLAUDE.md` are out of date and should be updated, along with open questions 1–4, which this design and the founder's answers settle.

## Brand

Follow `MyAsset/Brand Guideline.png`: navy `#081D3A`, orange `#FF6A00`, light orange `#FFB37B`, sky `#1FA8FF`, Poppins headings, Inter body, outlined `lucide-react` icons, real logistics photography.

Exception: use "Freight. Connected." from the blueprint, not "Share the Load. Connect the World.", and drop the guideline's container-focused wording. (My call. The founder saw it and didn't object.) `public/logo1.png` is icon-only, so the wordmark needs a proper asset or styled text.

## Release order and operator terms

Claude drafts short operator participation terms from the blueprint as part of this project: free founding leads for 90 days, outcome reporting in return, preferential pricing later, no guaranteed volumes, operators responsible for their services, data handling. The draft needs review by the founder or a lawyer. It is not legal advice.

1. The public site, hiding and directory can go live first. The directory shows the "tell us what you're moving" prompt until operators are listed.
2. Operator sign-up opens only after the founder approves the terms. Until then, For operators shows "Register your interest", linking to `/contact`.

## Outside the code: founder actions

- Review and approve the participation terms.
- Prepare customer terms and the privacy notice before the pilot.
- Recruit founding operators.

## Left to the builder

- Exact page wording within the rules above.
- Component breakdown, directory filter layout, mobile navigation.
- Whether the directory uses a view or a function.
- Test approach, following the repo's Playwright setup.
- Base branch: `feature/agreement-pdf` has 10 commits not on `master`. Start from a fresh branch after deciding whether they merge first.
