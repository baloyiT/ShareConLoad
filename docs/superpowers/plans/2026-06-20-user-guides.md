# ShareConLoad User Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce five role-accented A4 PDF user guides (Customer, Operator, Agent, Measurement Agent, Transporter) with live Playwright screenshots, full end-to-end workflow walkthroughs, and a shared HTML-to-PDF build pipeline.

**Architecture:** A three-stage Node.js build pipeline: (1) `capture-screenshots.js` logs into the live dev server as each test user and saves PNGs, (2) `generate-guides.js` renders a self-contained HTML file per role embedding those screenshots as absolute `file://` paths, (3) `export-pdfs.js` uses Playwright's `page.pdf()` to print each HTML to A4 PDF.

**Tech Stack:** `@playwright/test` (already installed), Node.js built-ins (`fs`, `path`), vanilla HTML/CSS for templates, no additional dependencies.

## Global Constraints

- Dev server must be running on `http://localhost:3000` during Task 4 (screenshot capture)
- Measurement Agent and Transporter accounts must be admin-approved (Task 2) before Task 4 runs
- All scripts are plain Node.js (`node scripts/xxx.js`) — not Next.js, not TypeScript
- Use `const { chromium } = require('@playwright/test')` — already in `node_modules`
- No new `npm install` — `@playwright/test@^1.60.0` is already in `package.json`
- Screenshots: absolute `file://` paths in HTML (no base64 bloat)
- Output root: `docs/user-guides/` — create subdirectories in scripts
- PDF settings: A4, `printBackground: true`, margins 15mm all sides
- Role accent hex values: Customer `#ff6a00`, Operator `#0b103a`, Agent `#0369a1`, Measurement Agent `#7c3aed`, Transporter `#059669`
- Screenshot viewport: 1280×800

---

### Task 1: Create test case profiles for Measurement Agent and Transporter

**Files:**
- Create: `Test Case/Measurement Agent/profile.json`
- Create: `Test Case/Transporter/profile.json`

**Interfaces:**
- Produces: credential files consumed by Task 2 (manual registration) and Task 3 (screenshot login)

- [ ] **Step 1: Create `Test Case/Measurement Agent/profile.json`**

```json
{
  "role": "measurement_agent",
  "email": "measurement.shareconload@gmail.com",
  "password": "TestMeasure@2026!",
  "full_name": "Thabo Nkosi",
  "personal": {
    "phone_number": "+27 71 234 5678"
  },
  "location": {
    "base_city": "Johannesburg",
    "base_country": "South Africa"
  },
  "quiz_answers": {
    "note": "Correct answers: B, B, C, B, B — scores 5/5"
  },
  "documents": {
    "id_document": "documents/identity-document.pdf",
    "selfie": "documents/selfie.pdf",
    "equipment_photo": "documents/equipment-photo.pdf"
  }
}
```

- [ ] **Step 2: Create `Test Case/Transporter/profile.json`**

```json
{
  "role": "transporter",
  "email": "transporter.shareconload@gmail.com",
  "password": "TestTransport@2026!",
  "full_name": "Sipho Dlamini",
  "personal": {
    "phone_number": "+27 63 987 6543"
  },
  "location": {
    "base_city": "Durban",
    "base_country": "South Africa"
  },
  "vehicle": {
    "vehicle_type": "small_truck",
    "vehicle_capacity_kg": 1500,
    "vehicle_capacity_cbm": 8.5,
    "vehicle_registration_number": "KZN 456-789"
  },
  "documents": {
    "drivers_licence": "documents/drivers-licence.pdf",
    "vehicle_ownership": "documents/vehicle-ownership.pdf",
    "vehicle_photo_1": "documents/vehicle-photo-1.jpg"
  }
}
```

- [ ] **Step 3: Create placeholder document files for both roles**

```bash
mkdir -p "Test Case/Measurement Agent/documents"
mkdir -p "Test Case/Transporter/documents"
```

Copy any existing PDF from `Test Case/Customer/documents/identity-document.pdf` into both new `documents/` folders, renaming as needed (these are placeholders — the actual uploads happen via browser in Task 2).

- [ ] **Step 4: Commit the new profiles**

```bash
git add "Test Case/Measurement Agent/" "Test Case/Transporter/"
git commit -m "chore: add test case profiles for measurement agent and transporter"
```

---

### Task 2: Register and admin-approve the two new test accounts (manual gate)

**Files:** none — this is a manual browser task

**Interfaces:**
- Consumes: credentials from Task 1 `profile.json` files
- Produces: two live DB accounts with `status = 'approved'`, required before Task 4

> This task cannot be automated because it requires file uploads (selfie, vehicle photos) that the test case `documents/` folder does not contain as real images. Complete this manually in the browser.

- [ ] **Step 1: Register Measurement Agent account**

  1. Start dev server: `npm run dev`
  2. Open `http://localhost:3000/auth/register`
  3. Register with email `measurement.shareconload@gmail.com`, password `TestMeasure@2026!`
  4. Navigate to `http://localhost:3000/onboarding/measurement-agent`
  5. Step 1 — Full Name: `Thabo Nkosi`, Phone: `+27 71 234 5678` → Next
  6. Step 2 — Base City: `Johannesburg`, Base Country: `South Africa` → Next
  7. Step 3 — Quiz: Answer B, B, C, B, B → Submit Quiz → Next
  8. Step 4 — Upload any valid image/PDF for ID Document, Selfie, Equipment Photo → Submit Application
  9. Sign out

- [ ] **Step 2: Register Transporter account**

  1. Open `http://localhost:3000/auth/register`
  2. Register with email `transporter.shareconload@gmail.com`, password `TestTransport@2026!`
  3. Navigate to `http://localhost:3000/onboarding/transporter`
  4. Step 1 — Full Name: `Sipho Dlamini`, Phone: `+27 63 987 6543` → Next
  5. Step 2 — Base City: `Durban`, Base Country: `South Africa`, Vehicle: `Small Truck`, Capacity kg: `1500`, Capacity CBM: `8.5`, Reg: `KZN 456-789` → Next
  6. Step 3 — Upload driver's licence + vehicle ownership doc → Next
  7. Step 4 — Upload at least one vehicle photo → Submit Application
  8. Sign out

- [ ] **Step 3: Admin-approve both accounts**

  1. Sign in as `support@shareconload.com` / `Admin@ShareCon2026!`
  2. Navigate to `http://localhost:3000/admin/measurement-agents`
  3. Find Thabo Nkosi → click Approve
  4. Navigate to `http://localhost:3000/admin/transporters`
  5. Find Sipho Dlamini → click Approve
  6. Sign out

- [ ] **Step 4: Verify approved dashboards load**

  - Sign in as `measurement.shareconload@gmail.com` → `/measurement-agent` should show the approved dashboard (Jobs Completed, Active Jobs, Rating stats). Sign out.
  - Sign in as `transporter.shareconload@gmail.com` → `/transporter` should show the approved dashboard (vehicle info, Active Pickup Jobs). Sign out.

---

### Task 3: Write `scripts/capture-screenshots.js`

**Files:**
- Create: `scripts/capture-screenshots.js`

**Interfaces:**
- Consumes: live dev server at `http://localhost:3000`, credentials from Task 1
- Produces: PNG files at `docs/user-guides/screenshots/[role]/[NN-name].png`

- [ ] **Step 1: Create `scripts/capture-screenshots.js`**

```javascript
// scripts/capture-screenshots.js
'use strict';

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../docs/user-guides/screenshots');

async function ss(page, role, name) {
  const dir = path.join(OUT, role);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${role}/${name}.png`);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
}

// ─── CUSTOMER ────────────────────────────────────────────────────────────────

async function captureCustomer(browser) {
  console.log('\n── Customer ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'customer', '01-login');

  await login(page, 'customer.shareconload@gmail.com', 'TestCustomer@2026!');

  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2000);
  await ss(page, 'customer', '02-home-containers');

  // Click first container card
  const containerLink = page.locator('a[href^="/container/"]').first();
  await containerLink.waitFor({ timeout: 8000 });
  const containerId = (await containerLink.getAttribute('href')).split('/container/')[1].split('/')[0];
  await page.goto(`${BASE}/container/${containerId}`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '03-container-detail');

  await page.goto(`${BASE}/booking/${containerId}`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '04-booking-form');

  await page.goto(`${BASE}/payments/history`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '05-payment-history');

  await page.goto(`${BASE}/bookings`);
  await page.waitForTimeout(2000);
  // Try to get to a tracking page
  const trackLink = page.locator('a[href^="/booking/track/"]').first();
  const hasTrackLink = await trackLink.count() > 0;
  if (hasTrackLink) {
    await trackLink.click();
    await page.waitForTimeout(1500);
    await ss(page, 'customer', '06-tracking');
  } else {
    await ss(page, 'customer', '06-bookings-list');
  }

  await page.goto(`${BASE}/measurement-service`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '07-measurement-service');

  await page.goto(`${BASE}/disputes/new`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '08-dispute-new');

  await page.goto(`${BASE}/support/new`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '09-support-ticket');

  await page.goto(`${BASE}/onboarding/customer`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '00-kyc-onboarding');

  await ctx.close();
}

// ─── OPERATOR ────────────────────────────────────────────────────────────────

async function captureOperator(browser) {
  console.log('\n── Operator ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'operator', '01-login');

  await login(page, 'mercy.affulbaloyi@gmail.com', 'TestOperator@2026!');

  await page.goto(`${BASE}/operator`);
  await page.waitForTimeout(2000);
  await ss(page, 'operator', '02-dashboard');

  await page.goto(`${BASE}/operator/create`);
  await page.waitForTimeout(1500);
  await ss(page, 'operator', '03-create-container');

  await page.goto(`${BASE}/operator/bookings`);
  await page.waitForTimeout(2000);
  await ss(page, 'operator', '04-manage-bookings');

  await page.goto(`${BASE}/operator/payouts`);
  await page.waitForTimeout(2000);
  await ss(page, 'operator', '05-payouts');

  await page.goto(`${BASE}/operator/compliance`);
  await page.waitForTimeout(1500);
  await ss(page, 'operator', '06-compliance');

  await page.goto(`${BASE}/onboarding/operator`);
  await page.waitForTimeout(1500);
  await ss(page, 'operator', '00-onboarding');

  await ctx.close();
}

// ─── AGENT ───────────────────────────────────────────────────────────────────

async function captureAgent(browser) {
  console.log('\n── Agent ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'agent', '01-login');

  await login(page, 'justice_baloyi@yahoo.com', 'TestAgent@2026!');

  await page.goto(`${BASE}/agent`);
  await page.waitForTimeout(2000);
  await ss(page, 'agent', '02-dashboard');

  await page.goto(`${BASE}/agent/shippers/new`);
  await page.waitForTimeout(1500);
  await ss(page, 'agent', '03-add-shipper');

  await page.goto(`${BASE}/agent/shippers`);
  await page.waitForTimeout(2000);
  await ss(page, 'agent', '04-shippers-list');

  await page.goto(`${BASE}/agent/bookings`);
  await page.waitForTimeout(2000);
  await ss(page, 'agent', '05-bookings');

  await page.goto(`${BASE}/onboarding/agent`);
  await page.waitForTimeout(1500);
  await ss(page, 'agent', '00-onboarding');

  await page.goto(`${BASE}/onboarding/agent/status`);
  await page.waitForTimeout(1500);
  await ss(page, 'agent', '00b-application-status');

  await ctx.close();
}

// ─── MEASUREMENT AGENT ───────────────────────────────────────────────────────

async function captureMeasurementAgent(browser) {
  console.log('\n── Measurement Agent ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'measurement-agent', '01-login');

  await login(page, 'measurement.shareconload@gmail.com', 'TestMeasure@2026!');

  await page.goto(`${BASE}/measurement-agent`);
  await page.waitForTimeout(2000);
  await ss(page, 'measurement-agent', '02-dashboard');

  await page.goto(`${BASE}/measurement-agent/jobs`);
  await page.waitForTimeout(2000);
  await ss(page, 'measurement-agent', '03-jobs-list');

  // Try to open first job
  const jobLink = page.locator('a[href^="/measurement-agent/jobs/"]').first();
  const hasJob = await jobLink.count() > 0;
  if (hasJob) {
    await jobLink.click();
    await page.waitForTimeout(1500);
    await ss(page, 'measurement-agent', '04-job-detail');
  }

  await page.goto(`${BASE}/onboarding/measurement-agent`);
  await page.waitForTimeout(1500);
  await ss(page, 'measurement-agent', '00-onboarding-step1');

  await ctx.close();
}

// ─── TRANSPORTER ─────────────────────────────────────────────────────────────

async function captureTransporter(browser) {
  console.log('\n── Transporter ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'transporter', '01-login');

  await login(page, 'transporter.shareconload@gmail.com', 'TestTransport@2026!');

  await page.goto(`${BASE}/transporter`);
  await page.waitForTimeout(2000);
  await ss(page, 'transporter', '02-dashboard');

  await page.goto(`${BASE}/transporter/jobs`);
  await page.waitForTimeout(2000);
  await ss(page, 'transporter', '03-jobs-list');

  // Try to open first job
  const jobLink = page.locator('a[href^="/transporter/jobs/"]').first();
  const hasJob = await jobLink.count() > 0;
  if (hasJob) {
    await jobLink.click();
    await page.waitForTimeout(1500);
    await ss(page, 'transporter', '04-job-detail');
  }

  await page.goto(`${BASE}/onboarding/transporter`);
  await page.waitForTimeout(1500);
  await ss(page, 'transporter', '00-onboarding-step1');

  await ctx.close();
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

(async () => {
  const roleArg = process.argv[2]; // optional: --role customer
  const browser = await chromium.launch({ headless: true });

  try {
    if (!roleArg || roleArg === 'customer')         await captureCustomer(browser);
    if (!roleArg || roleArg === 'operator')         await captureOperator(browser);
    if (!roleArg || roleArg === 'agent')            await captureAgent(browser);
    if (!roleArg || roleArg === 'measurement-agent') await captureMeasurementAgent(browser);
    if (!roleArg || roleArg === 'transporter')      await captureTransporter(browser);
  } finally {
    await browser.close();
  }

  console.log('\n✅ Screenshots done → docs/user-guides/screenshots/');
})();
```

- [ ] **Step 2: Commit the capture script**

```bash
git add scripts/capture-screenshots.js
git commit -m "chore: add Playwright screenshot capture script for user guides"
```

---

### Task 4: Run screenshot capture and verify output

**Files:** none — runtime verification step

**Interfaces:**
- Consumes: `scripts/capture-screenshots.js`, live dev server, approved accounts from Task 2
- Produces: PNG files at `docs/user-guides/screenshots/[role]/`

- [ ] **Step 1: Ensure dev server is running**

In a separate terminal:
```bash
npm run dev
```
Wait until `http://localhost:3000` responds with the home page before proceeding.

- [ ] **Step 2: Run capture script**

```bash
node scripts/capture-screenshots.js
```

Expected console output (one line per screenshot):
```
── Customer ──
  ✓ customer/01-login.png
  ✓ customer/02-home-containers.png
  ...
── Operator ──
  ✓ operator/01-login.png
  ...
✅ Screenshots done → docs/user-guides/screenshots/
```

- [ ] **Step 3: Verify output files exist**

```bash
ls docs/user-guides/screenshots/customer/
ls docs/user-guides/screenshots/operator/
ls docs/user-guides/screenshots/agent/
ls docs/user-guides/screenshots/measurement-agent/
ls docs/user-guides/screenshots/transporter/
```

Each directory should contain at least 5 PNG files. Open 2–3 at random in an image viewer to confirm they show the correct pages (not blank, not error screens).

- [ ] **Step 4: Re-run for any missing screenshots**

If a screenshot shows a redirect to `/auth/login` (white login page instead of the expected screen), the session expired mid-run. Re-run with `--role` flag for the affected role only:
```bash
node scripts/capture-screenshots.js customer
```

---

### Task 5: Write `scripts/generate-guides.js`

**Files:**
- Create: `scripts/generate-guides.js`

**Interfaces:**
- Consumes: PNG files at `docs/user-guides/screenshots/[role]/[name].png`
- Produces: HTML files at `docs/user-guides/html/[role]-user-guide.html`

- [ ] **Step 1: Create `scripts/generate-guides.js`**

```javascript
// scripts/generate-guides.js
'use strict';

const fs   = require('fs');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../docs/user-guides/screenshots');
const OUT_HTML    = path.resolve(__dirname, '../docs/user-guides/html');

fs.mkdirSync(OUT_HTML, { recursive: true });

// ─── Role configs ──────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'customer',
    name: 'Customer',
    accent: '#ff6a00',
    accentDark: '#cc5500',
    accentLight: '#fff7ed',
    testUser: 'Alex Mensah',
    email: 'customer.shareconload@gmail.com',
    overview: {
      tagline: 'Ship goods internationally via shared container space.',
      capabilities: [
        'Browse available containers by route, date, and price',
        'Book space (CBM-based) and declare your goods',
        'Make staged payments: 20% deposit → 50% pre-departure → 30% on arrival',
        'Track your shipment milestone by milestone',
        'Raise disputes and open support tickets when needed',
      ],
    },
    sections: [
      {
        title: 'Getting Started',
        steps: [
          {
            title: 'Create your account',
            desc: 'Go to <strong>shareconload.com</strong> and click <strong>Register</strong>. Enter your name, email address, and a secure password. Check your inbox for the confirmation email.',
            shot: '01-login',
          },
          {
            title: 'Complete KYC verification',
            desc: 'Navigate to <strong>My Account → Verify Identity</strong>. Upload a valid government-issued ID and a proof of address (utility bill or bank statement). Verification takes 1–2 business days.',
            shot: '00-kyc-onboarding',
          },
        ],
      },
      {
        title: 'Finding & Booking Container Space',
        steps: [
          {
            title: 'Browse container listings',
            desc: 'The home page shows all available containers. Each card shows the <strong>route</strong>, <strong>departure date</strong>, <strong>available CBM</strong>, and <strong>price per CBM</strong>. Use the search bar to filter by origin or destination city.',
            shot: '02-home-containers',
          },
          {
            title: 'View container details',
            desc: 'Click any container card to see full details: operator profile, exact route, departure and arrival dates, total capacity, what\'s already booked, and the operator\'s description.',
            shot: '03-container-detail',
          },
          {
            title: 'Book your space',
            desc: 'Click <strong>Book Space</strong> on the container detail page. Enter the CBM you need, add your shipment items (description, quantity, weight, declared value), and agree to the goods declaration. Review the total price before submitting.',
            shot: '04-booking-form',
          },
        ],
      },
      {
        title: 'Making Staged Payments',
        steps: [
          {
            title: 'Pay the 20% deposit',
            desc: 'After booking, you will receive a payment link for the <strong>20% deposit</strong>. This must be paid within 24 hours to confirm your booking. Click <strong>Pay Now</strong> and you will be redirected to Paystack\'s secure payment page.',
            shot: '05-payment-history',
          },
          {
            title: 'Pre-departure payment (50%)',
            desc: 'Seven days before the container departs, you will receive a notification to pay the next stage (50% of total). Your booking status will not advance to <em>Loaded</em> until this is paid.',
            shot: '05-payment-history',
          },
          {
            title: 'Final release payment (30%)',
            desc: 'Once your cargo arrives at the destination port, pay the remaining 30% to unlock cargo release. You will receive a notification when the cargo arrives and the final payment is due.',
            shot: '05-payment-history',
          },
        ],
      },
      {
        title: 'Tracking Your Shipment',
        steps: [
          {
            title: 'View shipment milestones',
            desc: 'Go to <strong>My Bookings</strong> and click <strong>Track</strong> on any active booking. The timeline shows each milestone: Booked → Loaded → Departed → In Transit → Arrived → Delivered. Each milestone shows the date and a note from the operator.',
            shot: '06-tracking',
          },
        ],
      },
      {
        title: 'Requesting CBM Measurement',
        steps: [
          {
            title: 'Book a measurement agent',
            desc: 'Not sure how many CBM your goods occupy? Go to <strong>Measurement Service</strong> from the main menu. Enter your pickup address and city. The system will calculate a fee based on your location zone and show it before you pay.',
            shot: '07-measurement-service',
          },
        ],
      },
      {
        title: 'Raising a Dispute',
        steps: [
          {
            title: 'Submit a dispute',
            desc: 'If your cargo arrives damaged or short, go to <strong>My Bookings → Raise Dispute</strong>. Select the dispute type (damage, loss, delay), describe what happened, and upload supporting evidence (photos, delivery receipt).',
            shot: '08-dispute-new',
          },
        ],
      },
      {
        title: 'Getting Support',
        steps: [
          {
            title: 'Open a support ticket',
            desc: 'For any other issue, go to <strong>Support → New Ticket</strong>. Select a category, describe your issue, and submit. A support agent will respond to your registered email address within 1 business day.',
            shot: '09-support-ticket',
          },
        ],
      },
    ],
    quickRef: [
      { task: 'Browse containers', where: 'Home page (/)' },
      { task: 'View my bookings', where: '/bookings' },
      { task: 'Make a payment', where: '/payments/[bookingId]' },
      { task: 'Track a shipment', where: '/booking/track/[id]' },
      { task: 'Request CBM measurement', where: '/measurement-service' },
      { task: 'Raise a dispute', where: '/disputes/new' },
      { task: 'View payment history', where: '/payments/history' },
      { task: 'Open support ticket', where: '/support/new' },
    ],
    edgeCases: [
      { title: 'Payment failure', desc: 'If a Paystack payment fails, return to <strong>/payments/[bookingId]</strong> and click <strong>Retry Payment</strong>. Your booking is not cancelled — you have a grace period to retry.' },
      { title: 'KYC pending', desc: 'You can browse containers and start the booking flow before KYC is approved, but payment will be blocked until your identity is verified.' },
      { title: 'Dispute resolution', desc: 'Once you submit a dispute, it enters admin review. You can view the current status and add more evidence at <strong>/disputes/[id]</strong>. Resolution typically takes 5–10 business days.' },
    ],
  },

  {
    id: 'operator',
    name: 'Operator',
    accent: '#0b103a',
    accentDark: '#070b28',
    accentLight: '#f0f4ff',
    testUser: 'Mercy Afful-Baloyi',
    email: 'mercy.affulbaloyi@gmail.com',
    overview: {
      tagline: 'List available container space and earn from every CBM booked.',
      capabilities: [
        'Create container listings with custom routes, capacity, and pricing',
        'Manage the full booking lifecycle: confirm → load → transit → deliver',
        'Record shipment milestones that customers can track in real time',
        'Receive automated payouts as each payment stage is completed',
      ],
    },
    sections: [
      {
        title: 'Getting Started',
        steps: [
          {
            title: 'Register and start onboarding',
            desc: 'Register at <strong>shareconload.com</strong>, then go to <strong>Become an Operator</strong> from the onboarding page. You will provide your company details, bank account for payouts, and compliance documents.',
            shot: '00-onboarding',
          },
          {
            title: 'Submit compliance documents',
            desc: 'Navigate to <strong>Operator → Compliance</strong>. Upload your business registration certificate, tax clearance, proof of address, and identity document. Your account is gated until the admin team approves your documents.',
            shot: '06-compliance',
          },
        ],
      },
      {
        title: 'Creating Container Listings',
        steps: [
          {
            title: 'Create a new container',
            desc: 'Go to <strong>Operator → Create Container</strong>. Fill in the origin and destination (country + city), departure and arrival dates, total capacity in CBM, price per CBM, and select your pricing currency. Add a description for customers.',
            shot: '03-create-container',
          },
          {
            title: 'View your container dashboard',
            desc: 'The <strong>Operator Dashboard</strong> lists all your containers with their current status (Open, Full, Departed, Delivered) and how much capacity is still available.',
            shot: '02-dashboard',
          },
        ],
      },
      {
        title: 'Managing Bookings',
        steps: [
          {
            title: 'Confirm and advance bookings',
            desc: 'Go to <strong>Operator → Bookings</strong>. When a customer pays their deposit, their booking appears here with status <em>Pending</em>. Confirm it to move it to <em>Confirmed</em>, then advance through <em>Loaded → In Transit → Delivered</em> as the shipment progresses.',
            shot: '04-manage-bookings',
          },
          {
            title: 'Record shipment milestones',
            desc: 'On each booking\'s detail page, add milestones with a description and date (e.g. "Cargo loaded at Durban Port, 14 Aug 2026"). Customers see these updates in real time on their tracking page.',
            shot: '04-manage-bookings',
          },
        ],
      },
      {
        title: 'Receiving Payouts',
        steps: [
          {
            title: 'View your payout dashboard',
            desc: 'Go to <strong>Operator → Payouts</strong>. Each row shows a booking, the payment stage that has been paid, your payout amount (after platform commission), and the current payout status: Pending → Scheduled → Paid.',
            shot: '05-payouts',
          },
        ],
      },
    ],
    quickRef: [
      { task: 'Create a container listing', where: '/operator/create' },
      { task: 'View all containers', where: '/operator' },
      { task: 'Manage bookings', where: '/operator/bookings' },
      { task: 'View payouts', where: '/operator/payouts' },
      { task: 'Upload compliance docs', where: '/operator/compliance' },
      { task: 'Update bank account', where: '/operator/bank' },
    ],
    edgeCases: [
      { title: 'Compliance rejected', desc: 'If your compliance documents are rejected, you will see a rejection reason on the <strong>Compliance</strong> page. Re-upload corrected documents and resubmit.' },
      { title: 'Payout on hold', desc: 'Payouts may be placed on hold by the admin team during a dispute or compliance review. The payout dashboard will show the hold reason. Contact support to resolve it.' },
      { title: 'Booking cancellation', desc: 'If a customer cancels before the container departs, the booking status moves to <em>Cancelled</em>. Any refund decisions are made by the admin team.' },
    ],
  },

  {
    id: 'agent',
    name: 'Agent',
    accent: '#0369a1',
    accentDark: '#024f7a',
    accentLight: '#f0f9ff',
    testUser: 'Justice Baloyi',
    email: 'justice_baloyi@yahoo.com',
    overview: {
      tagline: 'Book container space on behalf of your clients as a licensed freight forwarder.',
      capabilities: [
        'Maintain a managed roster of shipper clients',
        'Book container space on behalf of any shipper in your roster',
        'Track all bookings across all shippers from one dashboard',
        'Earn commission on bookings you manage',
      ],
    },
    sections: [
      {
        title: 'Getting Started',
        steps: [
          {
            title: 'Register and apply as an agent',
            desc: 'Register at <strong>shareconload.com</strong>, then go to <strong>Become an Agent</strong>. You will provide your business name, years in operation, freight forwarding licence number and authority, and bank account for commission payments.',
            shot: '00-onboarding',
          },
          {
            title: 'Application review',
            desc: 'After submitting your application and documents, your account enters admin review. You can check the status at <strong>/onboarding/agent/status</strong>. You will receive an email notification when approved.',
            shot: '00b-application-status',
          },
        ],
      },
      {
        title: 'Managing Your Shippers',
        steps: [
          {
            title: 'Add a shipper to your roster',
            desc: 'Go to <strong>Agent → My Shippers → Add Shipper</strong>. Enter the shipper\'s name and contact details. Once added, you can book container space on their behalf.',
            shot: '03-add-shipper',
          },
          {
            title: 'View your shipper roster',
            desc: 'The <strong>My Shippers</strong> page lists all clients you manage, with their booking history and current shipment statuses.',
            shot: '04-shippers-list',
          },
        ],
      },
      {
        title: 'Booking on Behalf of Shippers',
        steps: [
          {
            title: 'Select a container and book',
            desc: 'Browse containers on the home page just like a customer. When you proceed to the booking form, you will see an additional dropdown: <strong>Booking for</strong>. Select the shipper from your roster, then complete the booking as normal.',
            shot: '02-dashboard',
          },
          {
            title: 'Track all agent bookings',
            desc: 'Go to <strong>Agent → Bookings</strong> to see every booking you have made, filtered by shipper or by status. Each row shows the shipper name, route, CBM, price, and current status.',
            shot: '05-bookings',
          },
        ],
      },
    ],
    quickRef: [
      { task: 'View agent dashboard', where: '/agent' },
      { task: 'Add a shipper', where: '/agent/shippers/new' },
      { task: 'View shipper roster', where: '/agent/shippers' },
      { task: 'View all bookings', where: '/agent/bookings' },
      { task: 'Browse containers to book', where: '/' },
      { task: 'Check application status', where: '/onboarding/agent/status' },
    ],
    edgeCases: [
      { title: 'Application rejected', desc: 'If your KYC application is rejected, the reason is shown on the status page. You may update your documents and resubmit. Contact support if the reason is unclear.' },
      { title: 'KYC re-submission', desc: 'If a compliance document expires or is flagged, you will receive a notification. Go to <strong>Agent → Compliance</strong> to upload a refreshed document.' },
    ],
  },

  {
    id: 'measurement-agent',
    name: 'Measurement Agent',
    accent: '#7c3aed',
    accentDark: '#5b21b6',
    accentLight: '#f5f3ff',
    testUser: 'Thabo Nkosi',
    email: 'measurement.shareconload@gmail.com',
    overview: {
      tagline: 'Measure cargo CBM at customer premises and get paid per completed job.',
      capabilities: [
        'Receive assigned measurement jobs in your city',
        'Record cargo dimensions (L×W×H) per item and calculate CBM',
        'Upload required photos: cargo, tape measure, scale, location',
        'Get rated by customers after each completed job',
      ],
    },
    sections: [
      {
        title: 'Getting Started',
        steps: [
          {
            title: 'Register and apply',
            desc: 'Register at <strong>shareconload.com</strong>, then go to <strong>Become a Measurement Agent</strong>. Enter your full name and phone number, then your base city and country — this is where you will be matched with cargo.',
            shot: '00-onboarding-step1',
          },
          {
            title: 'Pass the CBM certification quiz',
            desc: 'Complete the 5-question quiz on cargo measurement. You need at least 4/5 to proceed. The quiz tests: CBM definition, volume formula (L×W×H), and cargo declaration rules.',
            shot: '00-onboarding-step1',
          },
          {
            title: 'Upload your documents',
            desc: 'Upload your <strong>ID document</strong>, a clear <strong>selfie</strong>, and a photo of your <strong>measurement equipment</strong> (tape measure and/or scale). After submitting, your application enters admin review.',
            shot: '00-onboarding-step1',
          },
        ],
      },
      {
        title: 'Your Dashboard',
        steps: [
          {
            title: 'View your agent dashboard',
            desc: 'Once approved, your dashboard shows your lifetime <strong>Jobs Completed</strong>, number of <strong>Active Jobs</strong>, and your <strong>Average Rating</strong>. Use this to track your performance.',
            shot: '02-dashboard',
          },
        ],
      },
      {
        title: 'Completing Measurement Jobs',
        steps: [
          {
            title: 'View your assigned jobs',
            desc: 'Go to <strong>My Jobs</strong> to see all jobs assigned to you. Each job card shows the pickup address, city, the quoted fee, and the current status (Assigned, In Progress, Completed).',
            shot: '03-jobs-list',
          },
          {
            title: 'Start and complete a job',
            desc: 'Open a job and click <strong>Start Job</strong> when you arrive at the customer\'s location. For each item, enter the length, width, and height in metres — the app calculates CBM automatically. Upload all required photos before submitting.',
            shot: '04-job-detail',
          },
        ],
      },
    ],
    quickRef: [
      { task: 'View dashboard', where: '/measurement-agent' },
      { task: 'View assigned jobs', where: '/measurement-agent/jobs' },
      { task: 'Open a job', where: '/measurement-agent/jobs/[id]' },
      { task: 'Check application status', where: '/measurement-agent (pending state)' },
      { task: 'Contact support', where: '/support/new' },
    ],
    edgeCases: [
      { title: 'Application rejected', desc: 'If your application is rejected, the reason is displayed on your dashboard page. Correct the issue (e.g. re-upload a clearer ID photo) and contact support to request a re-review.' },
      { title: 'Account suspended', desc: 'If your account is suspended (e.g. due to a customer complaint), you will see a suspension notice on your dashboard. Contact support at support@shareconload.com to resolve the issue.' },
    ],
  },

  {
    id: 'transporter',
    name: 'Transporter',
    accent: '#059669',
    accentDark: '#047857',
    accentLight: '#f0fdf4',
    testUser: 'Sipho Dlamini',
    email: 'transporter.shareconload@gmail.com',
    overview: {
      tagline: 'Collect customer cargo and deliver it to the port — get paid per pickup job.',
      capabilities: [
        'Receive assigned pickup jobs near your base city',
        'Confirm cargo collection and delivery to the port',
        'Track your jobs, earnings, and rating from one dashboard',
        'Build your reputation through customer ratings',
      ],
    },
    sections: [
      {
        title: 'Getting Started',
        steps: [
          {
            title: 'Register and apply',
            desc: 'Register at <strong>shareconload.com</strong>, then go to <strong>Become a Transporter</strong>. Enter your full name and phone number, then your base city (where you will be matched with nearby jobs).',
            shot: '00-onboarding-step1',
          },
          {
            title: 'Enter your vehicle details',
            desc: 'Select your vehicle type (Bakkie, Small Truck, or Large Truck), enter the capacity in kg and CBM, and your vehicle registration number. This determines what size jobs you receive.',
            shot: '00-onboarding-step1',
          },
          {
            title: 'Upload your documents',
            desc: 'Upload your <strong>driver\'s licence</strong> and the <strong>vehicle ownership document</strong>. Then upload at least one vehicle photo. After submitting, your application enters admin review.',
            shot: '00-onboarding-step1',
          },
        ],
      },
      {
        title: 'Your Dashboard',
        steps: [
          {
            title: 'View your transporter dashboard',
            desc: 'Once approved, your dashboard shows your vehicle details, lifetime <strong>Jobs Completed</strong>, <strong>Average Rating</strong>, and the number of <strong>Active Pickup Jobs</strong>. Click <strong>View Jobs</strong> to see them.',
            shot: '02-dashboard',
          },
        ],
      },
      {
        title: 'Completing Pickup Jobs',
        steps: [
          {
            title: 'View your pickup jobs',
            desc: 'Go to <strong>My Jobs</strong>. Each job card shows the pickup address, city, country, quoted fee, and status (Assigned, Collected, Delivered). Tap a job to see full details.',
            shot: '03-jobs-list',
          },
          {
            title: 'Collect and deliver cargo',
            desc: 'Open a job and click <strong>Mark as Collected</strong> when you pick up the cargo. Drive to the port or designated drop-off point, then click <strong>Mark as Delivered</strong> to complete the job and trigger your payout.',
            shot: '04-job-detail',
          },
        ],
      },
    ],
    quickRef: [
      { task: 'View dashboard', where: '/transporter' },
      { task: 'View all pickup jobs', where: '/transporter/jobs' },
      { task: 'Open a job', where: '/transporter/jobs/[id]' },
      { task: 'Check application status', where: '/transporter (pending state)' },
      { task: 'Contact support', where: '/support/new' },
    ],
    edgeCases: [
      { title: 'Application rejected', desc: 'If your application is rejected, the rejection reason is shown on your dashboard. Common reasons: blurry document scan, expired driver\'s licence. Upload corrected documents and contact support.' },
      { title: 'Account suspended', desc: 'A suspended account blocks job assignments. The suspension notice on your dashboard explains the reason. Contact support@shareconload.com to resolve.' },
    ],
  },
];

// ─── HTML template ─────────────────────────────────────────────────────────

function imgPath(role, shot) {
  return path.join(SCREENSHOTS, role, `${shot}.png`);
}

function imgSrc(role, shot) {
  const p = imgPath(role, shot);
  if (!fs.existsSync(p)) return null;
  // Playwright PDF engine on Windows needs file:///C:/... (three slashes + drive letter)
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

function renderStep(role, step, index) {
  const src = imgSrc(role, step.shot);
  const imgHtml = src
    ? `<div class="screenshot-frame"><img src="${src}" alt="${step.title}" /></div>`
    : `<div class="screenshot-placeholder">Screenshot: ${step.shot}</div>`;

  return `
    <div class="step">
      <div class="step-left">
        <div class="step-number">${index + 1}</div>
        <div class="step-title">${step.title}</div>
        <div class="step-desc">${step.desc}</div>
      </div>
      <div class="step-right">${imgHtml}</div>
    </div>`;
}

function renderGuide(role) {
  const sc = role.sections
    .map((sec, si) => `
      <div class="section${si === 0 ? ' first-section' : ''}">
        <div class="section-header">
          <span class="section-number">${si + 1}</span>
          <h2 class="section-title">${sec.title}</h2>
        </div>
        ${sec.steps.map((st, idx) => renderStep(role.id, st, idx)).join('')}
      </div>`)
    .join('');

  const toc = role.sections
    .map((sec, i) => `<div class="toc-item"><span class="toc-num">${i + 1}</span><span>${sec.title}</span></div>`)
    .join('');

  const edgeCases = role.edgeCases
    .map(e => `<div class="edge-case"><div class="edge-title">${e.title}</div><div class="edge-desc">${e.desc}</div></div>`)
    .join('');

  const quickRef = role.quickRef
    .map(r => `<tr><td>${r.task}</td><td><code>${r.where}</code></td></tr>`)
    .join('');

  const caps = role.overview.capabilities
    .map(c => `<li>${c}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${role.name} User Guide — ShareConLoad</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #fff; color: #1a1a2e; line-height: 1.5; font-size: 13px; }

  /* ── Cover ── */
  .cover {
    page-break-after: always;
    min-height: 100vh;
    background: linear-gradient(135deg, ${role.accent} 0%, ${role.accentDark} 100%);
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 60px; color: white;
  }
  .cover-logo { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  .cover-logo span { color: #ff6a00; }
  .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 16px; }
  .cover-role-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 50px; display: inline-block; padding: 6px 20px; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; width: fit-content; }
  .cover-title { font-size: 56px; font-weight: 900; line-height: 1.1; }
  .cover-subtitle { font-size: 20px; opacity: 0.8; margin-top: 8px; }
  .cover-user { font-size: 13px; opacity: 0.6; margin-top: 24px; }
  .cover-footer { font-size: 12px; opacity: 0.5; }

  /* ── TOC ── */
  .toc { page-break-after: always; padding: 60px; }
  .toc h2 { font-size: 32px; font-weight: 900; color: ${role.accent}; margin-bottom: 32px; }
  .toc-item { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .toc-num { width: 32px; height: 32px; border-radius: 50%; background: ${role.accent}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
  .toc-extras { margin-top: 24px; }
  .toc-extras .toc-item { color: #6b7280; }

  /* ── Overview ── */
  .overview { page-break-after: always; padding: 60px; }
  .overview h2 { font-size: 32px; font-weight: 900; color: ${role.accent}; margin-bottom: 8px; }
  .overview .tagline { font-size: 16px; color: #4b5563; margin-bottom: 32px; }
  .overview ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .overview li { display: flex; align-items: flex-start; gap: 12px; font-size: 14px; color: #374151; }
  .overview li::before { content: '✓'; color: ${role.accent}; font-weight: 900; font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .overview .guide-user { margin-top: 40px; padding: 20px 24px; background: ${role.accentLight}; border-left: 4px solid ${role.accent}; border-radius: 8px; }
  .overview .guide-user strong { color: ${role.accent}; }

  /* ── Sections ── */
  .section { padding: 60px; page-break-before: always; }
  .first-section { page-break-before: avoid; }
  .section-header { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; }
  .section-number { width: 48px; height: 48px; border-radius: 12px; background: ${role.accent}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; flex-shrink: 0; }
  .section-title { font-size: 26px; font-weight: 800; color: #0b103a; }

  /* ── Steps ── */
  .step { display: flex; gap: 32px; margin-bottom: 48px; align-items: flex-start; }
  .step-left { width: 260px; flex-shrink: 0; }
  .step-number { width: 36px; height: 36px; border-radius: 50%; background: ${role.accent}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; margin-bottom: 12px; }
  .step-title { font-size: 15px; font-weight: 700; color: #0b103a; margin-bottom: 8px; }
  .step-desc { font-size: 13px; color: #4b5563; line-height: 1.6; }
  .step-right { flex: 1; }
  .screenshot-frame { border-radius: 10px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12); border: 2px solid #e5e7eb; }
  .screenshot-frame img { width: 100%; display: block; }
  .screenshot-placeholder { background: ${role.accentLight}; border: 2px dashed ${role.accent}; border-radius: 10px; height: 200px; display: flex; align-items: center; justify-content: center; color: ${role.accent}; font-size: 12px; font-weight: 600; }

  /* ── Edge cases ── */
  .edge-cases { padding: 60px; page-break-before: always; }
  .edge-cases h2 { font-size: 26px; font-weight: 800; color: #0b103a; margin-bottom: 32px; }
  .edge-case { border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; background: #fff5f5; }
  .edge-title { font-weight: 700; color: #991b1b; font-size: 14px; margin-bottom: 6px; }
  .edge-desc { font-size: 13px; color: #374151; line-height: 1.6; }

  /* ── Quick reference ── */
  .quick-ref { padding: 60px; page-break-before: always; }
  .quick-ref h2 { font-size: 26px; font-weight: 800; color: #0b103a; margin-bottom: 32px; }
  .quick-ref table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .quick-ref th { background: ${role.accent}; color: white; padding: 12px 16px; text-align: left; font-weight: 700; }
  .quick-ref th:first-child { border-radius: 8px 0 0 0; }
  .quick-ref th:last-child { border-radius: 0 8px 0 0; }
  .quick-ref td { padding: 11px 16px; border-bottom: 1px solid #f0f0f0; color: #374151; }
  .quick-ref tr:nth-child(even) td { background: ${role.accentLight}; }
  .quick-ref code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #374151; }

  /* ── Support ── */
  .support-section { padding: 60px; page-break-before: always; }
  .support-section h2 { font-size: 26px; font-weight: 800; color: #0b103a; margin-bottom: 24px; }
  .support-card { background: ${role.accentLight}; border: 1px solid ${role.accent}33; border-radius: 12px; padding: 32px; display: flex; flex-direction: column; gap: 12px; }
  .support-card .support-email { font-size: 20px; font-weight: 800; color: ${role.accent}; }
  .support-card p { color: #4b5563; font-size: 14px; }
  .support-card .ticket-link { display: inline-block; margin-top: 8px; background: ${role.accent}; color: white; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none; }

  @media print {
    .cover { min-height: 100vh; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ── Cover ── -->
<div class="cover">
  <div class="cover-logo">Share<span>Con</span>Load</div>
  <div class="cover-body">
    <div class="cover-role-badge">${role.name}</div>
    <div class="cover-title">User Guide</div>
    <div class="cover-subtitle">${role.overview.tagline}</div>
    <div class="cover-user">Test account: ${role.testUser} &nbsp;·&nbsp; ${role.email}</div>
  </div>
  <div class="cover-footer">ShareConLoad Logistics Platform &nbsp;·&nbsp; v1.0 &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
</div>

<!-- ── Table of Contents ── -->
<div class="toc">
  <h2>Contents</h2>
  ${toc}
  <div class="toc-extras">
    ${['Edge Cases & Error States', 'Quick Reference', 'Support'].map(t =>
      `<div class="toc-item"><span class="toc-num" style="background:#6b7280">·</span><span>${t}</span></div>`
    ).join('')}
  </div>
</div>

<!-- ── Role Overview ── -->
<div class="overview">
  <h2>About This Guide</h2>
  <p class="tagline">${role.overview.tagline}</p>
  <ul>${caps}</ul>
  <div class="guide-user">
    <strong>Test account used in this guide:</strong><br/>
    ${role.testUser} &nbsp;·&nbsp; <code>${role.email}</code>
  </div>
</div>

<!-- ── Workflow Sections ── -->
${sc}

<!-- ── Edge Cases ── -->
<div class="edge-cases">
  <h2>Edge Cases &amp; Error States</h2>
  ${edgeCases}
</div>

<!-- ── Quick Reference ── -->
<div class="quick-ref">
  <h2>Quick Reference</h2>
  <table>
    <thead><tr><th>Task</th><th>Where to go</th></tr></thead>
    <tbody>${quickRef}</tbody>
  </table>
</div>

<!-- ── Support ── -->
<div class="support-section">
  <h2>Getting Help</h2>
  <div class="support-card">
    <div class="support-email">support@shareconload.com</div>
    <p>Email us any time — support agents respond within 1 business day.</p>
    <p>For urgent issues related to an active shipment, include your Booking ID in the subject line.</p>
    <a class="ticket-link" href="http://localhost:3000/support/new">Open a Support Ticket</a>
  </div>
</div>

</body>
</html>`;
}

// ─── Write HTML files ───────────────────────────────────────────────────────

const roleArg = process.argv[2];

for (const role of ROLES) {
  if (roleArg && role.id !== roleArg) continue;
  const html = renderGuide(role);
  const outPath = path.join(OUT_HTML, `${role.id}-user-guide.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`✓ ${role.id}-user-guide.html`);
}

console.log('\n✅ HTML guides written → docs/user-guides/html/');
```

- [ ] **Step 2: Commit the generate script**

```bash
git add scripts/generate-guides.js
git commit -m "chore: add HTML guide generation script for user guides"
```

---

### Task 6: Write `scripts/export-pdfs.js`

**Files:**
- Create: `scripts/export-pdfs.js`

**Interfaces:**
- Consumes: HTML files at `docs/user-guides/html/[role]-user-guide.html`
- Produces: PDF files at `docs/user-guides/[role]-user-guide.pdf`

- [ ] **Step 1: Create `scripts/export-pdfs.js`**

```javascript
// scripts/export-pdfs.js
'use strict';

const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const HTML_DIR = path.resolve(__dirname, '../docs/user-guides/html');
const OUT_DIR  = path.resolve(__dirname, '../docs/user-guides');

const ROLES = ['customer', 'operator', 'agent', 'measurement-agent', 'transporter'];

(async () => {
  const roleArg = process.argv[2];
  const roles   = roleArg ? [roleArg] : ROLES;

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  for (const roleId of roles) {
    const htmlPath = path.join(HTML_DIR, `${roleId}-user-guide.html`);
    if (!fs.existsSync(htmlPath)) {
      console.warn(`⚠️  HTML not found for ${roleId} — run generate-guides.js first`);
      continue;
    }

    const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    const pdfPath = path.join(OUT_DIR, `${roleId}-user-guide.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });

    console.log(`✓ ${roleId}-user-guide.pdf`);
  }

  await browser.close();
  console.log('\n✅ PDFs exported → docs/user-guides/');
})();
```

- [ ] **Step 2: Commit the export script**

```bash
git add scripts/export-pdfs.js
git commit -m "chore: add PDF export script for user guides"
```

---

### Task 7: Write `scripts/build-user-guides.js` (orchestrator)

**Files:**
- Create: `scripts/build-user-guides.js`

**Interfaces:**
- Consumes: all three prior scripts
- Produces: runs generate → export in sequence (screenshots must already exist from Task 4)

> Note: screenshot capture is NOT included here because it requires the dev server to be running interactively. Run `node scripts/capture-screenshots.js` separately first.

- [ ] **Step 1: Create `scripts/build-user-guides.js`**

```javascript
// scripts/build-user-guides.js
// Usage: node scripts/build-user-guides.js [role]
// Runs: generate-guides.js → export-pdfs.js
// Screenshots must already exist (run capture-screenshots.js separately)
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const roleArg = process.argv[2] ?? '';
const flag    = roleArg ? ` ${roleArg}` : '';

function run(script) {
  const cmd = `node ${path.join(__dirname, script)}${flag}`;
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

run('generate-guides.js');
run('export-pdfs.js');

console.log('\n🎉  User guides build complete.');
```

- [ ] **Step 2: Commit the orchestrator**

```bash
git add scripts/build-user-guides.js
git commit -m "chore: add build-user-guides orchestrator script"
```

---

### Task 8: Run the full build and verify all five PDFs

**Files:** none — verification step

**Interfaces:**
- Consumes: all scripts from Tasks 3–7, screenshots from Task 4
- Produces: five verified PDFs at `docs/user-guides/`

- [ ] **Step 1: Generate HTML guides**

```bash
node scripts/generate-guides.js
```

Expected output:
```
✓ customer-user-guide.html
✓ operator-user-guide.html
✓ agent-user-guide.html
✓ measurement-agent-user-guide.html
✓ transporter-user-guide.html

✅ HTML guides written → docs/user-guides/html/
```

- [ ] **Step 2: Export PDFs**

```bash
node scripts/export-pdfs.js
```

Expected output:
```
✓ customer-user-guide.pdf
✓ operator-user-guide.pdf
✓ agent-user-guide.pdf
✓ measurement-agent-user-guide.pdf
✓ transporter-user-guide.pdf

✅ PDFs exported → docs/user-guides/
```

- [ ] **Step 3: Verify each PDF**

Open each of the five PDFs and confirm:
1. Cover page has the correct role name, accent color, and date
2. Table of contents lists all sections
3. Role overview section describes the correct capabilities
4. At least 3 screenshots appear (not blank/placeholder boxes)
5. Edge cases section is present
6. Quick reference table renders correctly
7. Support section shows `support@shareconload.com`

If screenshots appear as placeholder boxes, verify the PNG files exist at `docs/user-guides/screenshots/[role]/` and re-run Task 4.

- [ ] **Step 4: Spot-check accent colors**

| Guide | Expected accent |
|---|---|
| customer-user-guide.pdf | Orange cover (#ff6a00) |
| operator-user-guide.pdf | Navy cover (#0b103a) |
| agent-user-guide.pdf | Sky blue cover (#0369a1) |
| measurement-agent-user-guide.pdf | Purple cover (#7c3aed) |
| transporter-user-guide.pdf | Emerald green cover (#059669) |

---

### Task 9: Commit all outputs

**Files:**
- Add: `docs/user-guides/html/*.html` (5 files)
- Add: `docs/user-guides/*.pdf` (5 files)
- Add: `docs/user-guides/screenshots/` (all PNG files)

- [ ] **Step 1: Stage and commit everything**

```bash
git add docs/user-guides/ "Test Case/Measurement Agent/" "Test Case/Transporter/"
git commit -m "feat: generate five role-specific PDF user guides with Playwright screenshots"
```

- [ ] **Step 2: Verify final file tree**

```bash
ls docs/user-guides/*.pdf
```

Expected:
```
docs/user-guides/agent-user-guide.pdf
docs/user-guides/customer-user-guide.pdf
docs/user-guides/measurement-agent-user-guide.pdf
docs/user-guides/operator-user-guide.pdf
docs/user-guides/transporter-user-guide.pdf
```
