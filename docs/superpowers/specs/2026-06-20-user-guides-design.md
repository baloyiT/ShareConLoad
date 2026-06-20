# ShareConLoad User Guides — Design Spec

**Date:** 2026-06-20  
**Status:** Approved for implementation  
**Scope:** Five role-specific PDF user guides (Customer, Operator, Agent, Measurement Agent, Transporter)

---

## 1. Overview

Produce five polished, role-accented PDF user guides for the ShareConLoad logistics platform. Each guide is a full end-to-end walkthrough of its role — from registration through every core workflow and edge case — illustrated with live Playwright screenshots taken from the running app using real test-case credentials.

---

## 2. Delivery Format

- **Format:** PDF (A4), one file per role
- **Screenshot source:** Playwright automation against the live dev server
- **Build pipeline:** Three Node.js scripts (capture → generate HTML → export PDF)
- **Output directory:** `docs/user-guides/`

---

## 3. Role Accent Colors

| Role | Accent Color | Hex |
|---|---|---|
| Customer | Orange | `#ff6a00` |
| Operator | Navy | `#0b103a` |
| Agent | Sky Blue | `#0369a1` |
| Measurement Agent | Purple | `#7c3aed` |
| Transporter | Emerald | `#059669` |

All guides share the ShareConLoad brand (logo, navy/orange wordmark). The accent color drives: cover page background, section headers, step number badges, callout borders.

---

## 4. PDF Structure (all roles)

Every guide follows this section order:

| # | Section | Notes |
|---|---|---|
| 1 | Cover page | Full-bleed accent background, logo, role name, "User Guide", date |
| 2 | Table of contents | Auto-numbered with page references |
| 3 | Role overview | Who this is for, what the role does, 3–4 key capabilities |
| 4 | Getting started | Registration → login → onboarding, screenshot per step |
| 5 | Dashboard tour | Annotated full screenshot of main dashboard |
| 6 | Core workflows | Step-by-step panels: numbered callout left, screenshot right |
| 7 | Edge cases & error states | Rejection, payment failure, dispute, suspension |
| 8 | Quick reference | Table: common task → where to go |
| 9 | Support | `support@shareconload.com`, support ticket link |

---

## 5. Test Case Credentials

### Existing profiles

| Role | Name | Email |
|---|---|---|
| Customer | Alex Mensah | `customer.shareconload@gmail.com` |
| Operator | Mercy Afful-Baloyi | `mercy.affulbaloyi@gmail.com` |
| Agent | Justice Baloyi | `justice_baloyi@yahoo.com` |
| Admin | Justice Baloyi | `support@shareconload.com` |

### New profiles to create

Two new `profile.json` files must be created and their accounts registered in the live DB before screenshot capture:

**`Test Case/Measurement Agent/profile.json`**
- Role: `measurement_agent`
- Must have: full name, email, password, service area / zone, ID document

**`Test Case/Transporter/profile.json`**
- Role: `transporter`
- Must have: full name, email, password, vehicle type, vehicle capacity CBM, service area

Both accounts must be onboarded and **approved** by admin before screenshots can be taken of the approved dashboard states.

---

## 6. Role-Specific Workflow Coverage

### 6.1 Customer (Alex Mensah)

1. Register & complete KYC (ID, proof of address upload)
2. Browse container listings (home page)
3. View container detail page
4. Book container — CBM selection, shipment items, goods declaration
5. Staged payment flow — 20% deposit → 50% pre-departure → 30% final release
6. Payment history page
7. Shipment milestone tracker (`/booking/track/[id]`)
8. Request measurement service (`/measurement-service`)
9. Raise a dispute + upload evidence (`/disputes/new`, `/disputes/[id]`)
10. Open a support ticket (`/support/new`)

**Edge cases:** payment failure, dispute resolution status, KYC pending state

---

### 6.2 Operator (Mercy Afful-Baloyi)

1. Register & onboarding — company details, bank account, compliance documents
2. Compliance status gate (pending → approved)
3. Create a container (route, capacity, price, currency)
4. Operator dashboard — container list, available capacity
5. Manage bookings — confirm → loaded → in-transit → delivered lifecycle
6. Record shipment milestones
7. Payout dashboard — eligibility checks, payout status, payout history

**Edge cases:** compliance rejection, payout hold, booking cancellation

---

### 6.3 Agent (Justice Baloyi)

1. Register & onboarding — business credentials, bank details, documents
2. Application review status (pending → approved)
3. Agent dashboard (booking summary, shipper count)
4. Add a managed shipper (`/agent/shippers/new`)
5. Book on behalf of a shipper (`/booking/[containerId]`)
6. Agent bookings list (`/agent/bookings`)
7. Shipper shipment tracking

**Edge cases:** application rejected, KYC re-submission

---

### 6.4 Measurement Agent (new test user)

1. Register & onboarding (`/onboarding/measurement-agent`)
2. Application under review state
3. Approved dashboard — jobs completed, active jobs, rating
4. Browse assigned measurement jobs (`/measurement-agent/jobs`)
5. Start a job → submit CBM measurement + notes (`/measurement-agent/jobs/[id]`)
6. Completed job + rating received

**Edge cases:** application rejected, account suspended

---

### 6.5 Transporter (new test user)

1. Register & onboarding (`/onboarding/transporter`)
2. Application under review state
3. Approved dashboard — vehicle info, active pickup jobs, rating
4. Browse pickup jobs (`/transporter/jobs`)
5. Accept and start a pickup (`/transporter/jobs/[id]`)
6. Mark cargo as delivered
7. Job history

**Edge cases:** application rejected, account suspended

---

## 7. Build System

### 7.1 Script: `scripts/capture-screenshots.js`

- Launches Playwright Chromium at 1280×800
- Logs in as each test user in turn
- Navigates to every key page for that role
- Injects numbered annotation overlays (red circles + callout labels) via `page.evaluate()` before capture
- Saves full-page PNGs to `docs/user-guides/screenshots/[role]/[NN-screen-name].png`
- Naming convention: `01-login.png`, `02-dashboard.png`, `03-create-booking.png`, etc.

### 7.2 Script: `scripts/generate-guides.js`

- Reads role config (name, accent color, workflow steps, screenshot paths)
- Renders self-contained HTML per role from a shared template
- Each workflow step = two-column panel: left (step number badge, title, description), right (screenshot in browser-frame mockup)
- Cover page: full-bleed accent gradient, logo, role name
- TOC: auto-generated from section list
- Outputs to `docs/user-guides/html/[role]-user-guide.html`

### 7.3 Script: `scripts/export-pdfs.js`

- Uses Playwright `page.pdf()` (Chromium print engine)
- Settings: A4, `printBackground: true`, margins 15mm all sides
- Outputs to `docs/user-guides/[role]-user-guide.pdf`

### 7.4 Orchestrator: `scripts/build-user-guides.js`

Single entry point: runs capture → generate → export in sequence. Can be scoped to one role via `--role customer` flag.

---

## 8. Output File Tree

```
docs/user-guides/
  screenshots/
    customer/            ← ~12 PNG files
    operator/            ← ~12 PNG files
    agent/               ← ~8 PNG files
    measurement-agent/   ← ~7 PNG files
    transporter/         ← ~7 PNG files
  html/
    customer-user-guide.html
    operator-user-guide.html
    agent-user-guide.html
    measurement-agent-user-guide.html
    transporter-user-guide.html
  customer-user-guide.pdf
  operator-user-guide.pdf
  agent-user-guide.pdf
  measurement-agent-user-guide.pdf
  transporter-user-guide.pdf

Test Case/
  Measurement Agent/
    profile.json         ← NEW
    documents/           ← NEW (placeholder PDFs)
  Transporter/
    profile.json         ← NEW
    documents/           ← NEW (placeholder PDFs)

scripts/
  capture-screenshots.js
  generate-guides.js
  export-pdfs.js
  build-user-guides.js
```

---

## 9. Implementation Order

1. Create `Test Case/Measurement Agent/profile.json` and `Test Case/Transporter/profile.json`
2. Register and onboard both accounts in the live DB; admin-approve both via `/admin/measurement-agents` and `/admin/transporters` respectively
3. Write `scripts/capture-screenshots.js` and capture all screenshots (dev server must be running)
4. Write shared HTML template + role configs in `scripts/generate-guides.js`
5. Write `scripts/export-pdfs.js`
6. Write `scripts/build-user-guides.js` orchestrator
7. Run full build, verify all 5 PDFs open correctly
8. Commit all outputs and scripts

---

## 10. Constraints

- Dev server (`npm run dev`) must be running on `localhost:3000` during screenshot capture
- Measurement Agent and Transporter accounts must be admin-approved before approved-dashboard screenshots can be taken
- All Playwright scripts run in Node.js (not Next.js); use `playwright` npm package directly
- No new npm dependencies beyond `playwright` (already present as the Playwright MCP)
- Screenshots are embedded as relative paths in HTML before PDF export (no external image loading)
