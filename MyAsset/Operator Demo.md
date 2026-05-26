# Operator App Demo — ShareConLoad

Build a clickable interactive UI mockup for ShareConLoad (shareconload.com) — a digital logistics marketplace for shared container shipping — to be used as a screen-recorded demo video targeting operators (shipping carriers / logistics providers), investors, and general audiences.

## BRAND

- Primary navy: #1B2A4A
- Accent orange: #F26522
- Light salmon: #F4A27A
- Background: white / light grey (#F8F9FA)
- Font: Inter or system sans-serif
- Tagline: "Share the Load. Connect the World."
- Company: VEYQON GROUP (Pty) Ltd
- Currency: ZAR (R) throughout — no USD

## DUMMY DATA (use consistently across all screens)

- Operator: AfriShip Logistics (Pty) Ltd · Thabo Mokoena · thabo@afrishiplogistics.co.za · +27 11 456 7890 · South Africa
- Licence: ZA-OPS-2024-00312
- Bank: FNB Business · Account: 62847391052 · Branch: 250655
- Vessel: MV African Horizon
- Route: Durban, South Africa → Tema, Ghana
- Booking Ref: SCL-2026-00847 · Customer: Nomvula Dlamini · ⭐ 4.9 (12 trips)
- Cargo: Samsung 65" Smart TVs (x5) · 3.5 CBM · 125 kg · Declared value: R 42,500
- Pricing: R 2,800/CBM · Contract total: R 10,290 · Stage 1 (20%): R 2,058 · Stage 2 (50%): R 5,145 · Stage 3 (30%): R 3,087

---

BUILD A MULTI-SCREEN WALKTHROUGH with a top progress bar and "Next →" / "← Back" navigation buttons. Each screen should feel like a real operator dashboard with realistic data. Desktop layout: max-width 900px centered.

---

## SCREEN 1 — Operator Landing

- Dark navy background, full-width hero
- ShareConLoad logo: "Share" (white) + "Con" (orange) + "Load" (white)
- Headline: "Monetise Your Container Space"
- Sub-headline: "Connect with verified shippers. Get paid in stages. Grow your freight network across Africa."
- Two CTA buttons: "Register as Operator" (orange filled) · "Log In" (white outline)
- 3 value props (icon + title + description):
  - 📦 List Spare Capacity — "Post your available CBM in minutes. Set your own price."
  - 🔒 Verified Customers Only — "Every shipper is identity-verified before booking."
  - 💳 Staged Payout Protection — "20% on booking · 50% pre-departure · 30% on delivery."
- Social proof strip (light navy): "47 active operators · R 2.4M paid out to date · 98% on-time delivery"
- Footer: "VEYQON GROUP (Pty) Ltd · shareconload.com"

---

## SCREEN 2 — Operator Onboarding

- Two-column layout (left: form, right: summary panel)
- Heading: "Create Your Operator Account"
- **Tab 1 — Company Details** (active tab):
  - Company Name: "AfriShip Logistics (Pty) Ltd"
  - Contact Name: "Thabo Mokoena"
  - Email: "thabo@afrishiplogistics.co.za"
  - Phone: "+27 11 456 7890"
  - Country: "South Africa"
  - Operator Licence No.: "ZA-OPS-2024-00312"

- **Tab 2 — Bank Account** (shown as next tab, preview visible):
  - Section heading: "Payout Bank Account"
  - Bank: "FNB Business"
  - Account Holder: "AfriShip Logistics (Pty) Ltd"
  - Account Number: "62847391052"
  - Branch Code: "250655"
  - Note: "Payouts are processed within 2 business days of each payment stage."

- Right panel — "Why join ShareConLoad?":
  - Avg. earnings per container: R 28,000+
  - Active shippers in your region: 340+
  - Platform commission: 5% only
  - "Applications reviewed within 48 hours"

- "Submit Application" orange button (full width)

---

## SCREEN 3 — Post a Shipment Listing

- Heading: "Create a Container Listing"
- Form (two-column grid on desktop):
  - Origin Port: "Durban, South Africa"
  - Destination Port: "Tema, Ghana"
  - Vessel Name: "MV African Horizon"
  - Departure Date: "2026-07-15"
  - Estimated Arrival: "2026-08-12"
  - Available Space (CBM): "65"
  - Max Cargo Weight (kg): "12,000"
  - Price per CBM (ZAR): "R 2,800"
  - Cargo Types Accepted (checkboxes):
    - ✓ Electronics  ✓ Clothing & Apparel  ✓ Furniture  ✓ Personal Effects
    - ☐ Hazardous Materials  ☐ Perishables  ☐ Vehicles
- Insurance confirmation checkbox: ✓ "I confirm that cargo-in-transit insurance is active for this voyage."
- Preview panel (right side): shows a card preview of how the listing will appear to shippers
- "Publish Listing" orange button · "Save Draft" outline button

---

## SCREEN 4 — Incoming Booking Request

- Orange notification banner at top: "🔔 New Booking Request · SCL-2026-00847 · Just now"
- **Customer Card** (white, prominent):
  - Customer: Nomvula Dlamini
  - Verified badge: ✅ Identity Verified
  - Rating: ⭐ 4.9 / 5 (12 completed trips)
  - Member since: Jan 2025
- **Cargo Summary Card**:
  - Route: Durban → Tema, Ghana
  - Cargo: Samsung 65" Smart TVs (x5)
  - Type: Electronics
  - Weight: 125 kg · Volume: 3.5 CBM
  - Declared value: R 42,500
  - Photos: 2 photos attached (show 2 small thumbnail squares)
- **Financial Summary Card**:
  - Contract value: R 10,290
  - Stage 1 deposit (20%): R 2,058 — payable within 24h of acceptance
  - Platform commission (5%): R 515
  - Your net earnings: R 9,775
- Two action buttons (full width, stacked):
  - "✓ Accept Booking" (orange, large)
  - "✗ Decline" (ghost, red outline)

---

## SCREEN 5 — Operator Dashboard

- Heading: "Operator Dashboard · AfriShip Logistics"
- Stats row (4 KPI tiles):
  - Active Bookings: 3
  - CBM Utilised: 24 / 65 (37%)
  - Revenue This Month: R 19,200
  - Pending Payouts: R 14,760
- Heading: "Active Shipments"
- Table with 3 rows:

  | Booking Ref | Customer | Route | CBM | Status | Next Action |
  |---|---|---|---|---|---|
  | SCL-2026-00847 | Nomvula Dlamini | Durban → Tema | 3.5 | 🟡 Awaiting Departure | **"Update Status"** (orange btn) — ROW HIGHLIGHTED |
  | SCL-2026-00831 | Sipho Nkosi | Durban → Tema | 8.0 | 🔵 In Transit | "View Details" |
  | SCL-2026-00819 | Fatima Al-Hassan | Durban → Accra | 12.5 | 🟢 Delivered | "Release Cargo" (orange) |

- **Payout Summary panel** (below table, navy card):
  - Stage 1 (20% Deposit): R 3,840 ✓ Received
  - Stage 2 (50% Pre-departure): R 9,600 — Pending vessel departure
  - Stage 3 (30% On Release): R 5,760 — On cargo release
  - Total contract value: R 19,200

---

## SCREEN 6 — Messages

- Heading: "Messages · SCL-2026-00847" with back arrow
- Sub: "Nomvula Dlamini · Durban → Tema · In Transit"
- Customer info strip: ⭐ 4.9 · Electronics · 3.5 CBM

- Message thread (chat-style bubbles):
  - [Operator — right bubble, navy — "You"]:
    "Hi Nomvula, just confirming your cargo has been loaded successfully at Durban Port. Vessel departs tomorrow at 06:00."
    · 15 Jul 2026, 14:32
  - [Customer — left bubble, grey — "Nomvula Dlamini"]:
    "Thank you! Can you confirm the estimated arrival date at Tema Port?"
    · 15 Jul 2026, 15:10
  - [Operator — right bubble, navy — "You"]:
    "Estimated arrival is 12 Aug 2026, subject to port conditions. We'll notify you 48 hours before arrival."
    · 15 Jul 2026, 15:45
  - [Customer — left bubble, grey]:
    "Perfect, thank you for the update 🙏"
    · 15 Jul 2026, 16:02
  - [Customer — left bubble, grey] — UNREAD badge:
    "Hi, just checking — has the vessel cleared Cape waters? Any updates on position?"
    · 22 Jul 2026, 08:47

- Message input bar at bottom: text field "Type a message..." · Send button (orange)
- Note at bottom: "Messages are monitored for compliance. Do not share payment or personal details outside the platform."

---

## SCREEN 7 — Payout Tracker

- Heading: "Payout Tracker · AfriShip Logistics"
- **3-stage visual payout bar** (horizontal, full width):
  - Stage 1 — 20% Deposit: R 2,058 ✓ RECEIVED (green fill)
  - Stage 2 — 50% Pre-departure: R 5,145 ⏳ PENDING (orange, in-progress pulse)
  - Stage 3 — 30% On Release: R 3,087 🔒 LOCKED (grey)
  - Total: R 10,290

- **Balance card** (navy):
  - Available Balance: R 3,840
  - Pending: R 14,760
  - "Withdraw Funds" button — greyed out with tooltip: "Awaiting Stage 2 payment"

- **All Bookings Payout Summary** (white card, 3 rows):
  | Booking | Stage 1 | Stage 2 | Stage 3 | Total |
  |---|---|---|---|---|
  | SCL-2026-00847 | R 2,058 ✓ | R 5,145 ⏳ | R 3,087 🔒 | R 10,290 |
  | SCL-2026-00831 | R 1,470 ✓ | R 3,675 ⏳ | R 2,205 🔒 | R 7,350 |
  | SCL-2026-00819 | R 2,058 ✓ | R 5,145 ✓ | R 3,087 ⏳ | R 10,290 |

- **Recent Transactions** list:
  - 28 May 2026 · SCL-2026-00819 Stage 1 · +R 2,058 (green)
  - 14 May 2026 · SCL-2026-00831 Stage 1 · +R 1,470 (green)
  - 1 May 2026 · SCL-2026-00847 Stage 1 · +R 2,058 (green)
  - 30 Apr 2026 · Platform fee · -R 515 (red)

---

## SCREEN 8 — Performance & Ratings

- Heading: "Performance · AfriShip Logistics"
- **Verified Operator badge** (navy card, full width):
  - ✅ Verified Operator — Preferred Status
  - Orange "PREFERRED" pill badge
  - "Active since January 2024 · 47 completed shipments"

- **KPI scorecard** (3 large tiles):
  - Completion Rate: 98% ↑ (+2% vs last quarter)
  - On-Time Departures: 95% ↑ (+1%)
  - Customer Rating: 4.8 / 5 ⭐ (based on 43 reviews)

- **Secondary metrics** (smaller tiles, 2 columns):
  - Total CBM Shipped: 1,240 CBM
  - Avg. Response Time: 1.4 hrs
  - Dispute Rate: 0.2%
  - Repeat Customers: 68%

- **Recent Reviews** (3 cards):
  - "Cargo arrived on time and in perfect condition. Will use AfriShip again!" — Nomvula D. · ⭐⭐⭐⭐⭐ · 12 Aug 2026
  - "Professional team, clear communication throughout the journey." — Sipho N. · ⭐⭐⭐⭐⭐ · 30 Jul 2026
  - "Smooth process from booking to delivery. Highly recommended." — Fatima A. · ⭐⭐⭐⭐⭐ · 15 Jun 2026

- "View Full Report" text link (orange)

---

## DESIGN REQUIREMENTS

- Pixel-perfect, professional dashboard UI — realistic logistics data, no lorem ipsum
- Smooth CSS slide transitions between screens (left/right directional)
- Progress bar at top: "Step N of 8 — Screen Name" with percentage fill and dot indicators
- Desktop layout: max-width 900px, clean white card-based dashboard
- "DEMO MODE" watermark fixed in bottom-right corner, low opacity, rotated
- Navigation: "← Back" / "Next →" buttons update label per screen context
- On Screen 8 the "Next →" button becomes "Restart Demo" and loops back to Screen 1
- Keyboard arrow keys for navigation (left/right)

Output as a single self-contained HTML file with all CSS and JS inline. No external CDN dependencies.
