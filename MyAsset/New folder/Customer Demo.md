# Customer App Demo — ShareConLoad

Build a clickable interactive UI mockup for ShareConLoad (shareconload.com) — a digital logistics marketplace for shared container shipping — to be used as a screen-recorded demo video targeting customers, investors, and general audiences.

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

- Customer: Nomvula Dlamini · nomvula.dlamini@gmail.com · +27 82 345 6789 · South Africa
- Operator: AfriShip Logistics · Verified Operator · 4.9★
- Route: Durban, South Africa → Tema, Ghana
- Vessel: MV African Horizon
- Booking Ref: SCL-2026-00847
- Departure: 15 Jul 2026 · Arrival: 12 Aug 2026
- Cargo: Samsung 65" Smart TVs (x5) · Electronics · 125 kg · 3.5 CBM · Declared value: R 42,500
- Pricing: R 2,800/CBM · Total: R 10,290 · 20% deposit: R 2,058 · 50% balance: R 5,145 · 30% final: R 3,087

---

BUILD A MULTI-SCREEN WALKTHROUGH with a top progress bar and "Next →" / "← Back" navigation buttons. Each screen should feel like a real app screen. Mobile layout: max-width 420px centered with a phone shell frame (rounded corners, notch bar) for screen recording.

---

## SCREEN 1 — Landing / Hero

- Dark navy background
- ShareConLoad logo: "Share" (white) + "Con" (orange) + "Load" (white), large and bold
- Tagline: "Share the Load. Connect the World."
- Sub-copy: "Book verified shared container space from South Africa to Ghana — affordable, transparent, and fully tracked."
- Two CTA buttons: "Find Containers" (orange filled) · "See How It Works" (white outline)
- 3 value props with icons in a row:
  - 📦 Affordable Rates — From R 2,600/CBM
  - ✅ Verified Operators — All carriers vetted
  - 🔐 Secure Payments — Staged & protected
- Bottom: "VEYQON GROUP (Pty) Ltd · shareconload.com" in small muted text

---

## SCREEN 2 — Sign Up

- White card, clean form
- Heading: "Create your account" · Sub: "Join thousands of shippers moving goods across Africa"
- Form fields pre-filled:
  - Full Name: "Nomvula Dlamini"
  - Email: "nomvula.dlamini@gmail.com"
  - Phone: "+27 82 345 6789"
  - Country dropdown: "South Africa"
  - Password: "••••••••••"
- Orange "Create Account" button (full width)
- Divider: "— or sign up with —"
- Google button (outline) · LinkedIn button (outline)
- Footer: "Already have an account? Log in"
- Small print: "By signing up you agree to our Terms of Service and Privacy Policy."

---

## SCREEN 3 — Browse Available Containers

- Heading: "Available Containers"
- Search filter bar (horizontal scroll on mobile):
  - Origin: "Durban, SA"
  - Destination: "Tema, Ghana"
  - Cargo Type: "Electronics"
  - Departure: "Jul 2026"
  - Orange "Search" button
- Label: "3 containers found"
- Container listing cards (3 total):

  **Card 1 — SELECTED (highlighted orange border, "Selected ✓" badge)**
  - Route: Durban → Tema, Ghana
  - Operator: AfriShip Logistics · ✅ Verified · ⭐ 4.9
  - Departs: 15 Jul 2026 · Vessel: MV African Horizon
  - Space: 42 CBM available · Max weight: 8,000 kg
  - Price: R 2,800 / CBM
  - "Book Now" button (orange)

  **Card 2**
  - Route: Durban → Tema, Ghana
  - Operator: Cape Cargo Co. · ✅ Verified · ⭐ 4.7
  - Departs: 22 Jul 2026
  - Space: 18 CBM available
  - Price: R 3,100 / CBM
  - "Book Now" button (outline)

  **Card 3**
  - Route: Durban → Accra, Ghana
  - Operator: Pan-Africa Freight · ✅ Verified · ⭐ 4.6
  - Departs: 5 Aug 2026
  - Space: 60 CBM available
  - Price: R 2,600 / CBM
  - "Book Now" button (outline)

---

## SCREEN 4 — Booking Form

- Selected shipment summary bar at top (navy background):
  - AfriShip Logistics · Durban → Tema · 15 Jul 2026 · 42 CBM available

- **Section 1 — Cargo Details** (card)
  - Item Description: 'Samsung 65" Smart TVs (x5)'
  - Cargo Type dropdown: "Electronics" (selected)
  - Weight: "125 kg"
  - Volume (CBM): "3.5"
  - Declared Value (ZAR): "R 42,500"

- **Section 2 — Item Photos** (card) — show the photo upload feature
  - Label: "Item Photos (optional · up to 3 · JPG/PNG/WEBP)"
  - Show 2 thumbnail previews already attached (small grey photo placeholders with camera icon)
  - "+ Add Photo" button (outline, small)
  - Note: "Photos help operators verify your goods"

- **Section 3 — Goods Declaration** (amber warning card)
  - Text: "I declare the goods listed are accurately described and contain no prohibited, restricted, or hazardous materials."
  - Checkbox: ✓ checked (orange)

- **Payment Summary panel** (bottom, navy/dark card):
  - Cargo shipping (3.5 CBM × R 2,800): R 9,800
  - Platform service fee (5%): R 490
  - Divider
  - Total: R 10,290
  - 20% Deposit due now: R 2,058 (orange, large)
  - "Confirm & Pay Deposit" orange button
  - Small text: "Remaining R 8,232 paid in staged instalments"

---

## SCREEN 5 — Payment Confirmation

- Large animated green checkmark circle (pulsing ring animation)
- "Booking Confirmed!" heading (navy, bold)
- Booking reference badge: SCL-2026-00847 (orange background, white text)
- Green confetti/celebration strip: "🎉 Deposit of R 2,058 received successfully"
- Summary table (white card):
  - Route: Durban → Tema, Ghana
  - Operator: AfriShip Logistics
  - Departure: 15 Jul 2026
  - Vessel: MV African Horizon
  - Cargo: 3.5 CBM · Electronics
  - Deposit Paid: R 2,058 ✓ (green)
  - Remaining Balance: R 8,232
- Blue info card: "📧 Booking receipt sent to nomvula.dlamini@gmail.com"
- "View My Bookings" orange button

---

## SCREEN 6 — My Bookings

- Heading: "My Bookings" · Sub: "Nomvula Dlamini · 👤 Shipper"
- Status filter tabs (horizontal scroll): All (1) · Pending · Confirmed · In Transit (1) · Delivered · Cancelled
- "In Transit" tab is active (navy background)
- Booking card for SCL-2026-00847:
  - Route header: Durban → Tema, Ghana (bold, orange arrow)
  - Sub: South Africa → Ghana
  - Chips: "Departs 15 Jul 2026" · "3.5 CBM" · "R 10,290" · "Booked 16 May 2026"
  - Status badge: "🔵 In Transit" (cyan)
  - Ref: #SCL-2026
  - Action buttons (stacked):
    - "View Details →" (navy)
    - "💬 Messages" with orange badge showing "2" unread
    - "Make Payment" (orange)
    - "Raise Dispute" (ghost red outline)
  - Status progress bar at bottom: Pending ✓ → Confirmed ✓ → Loaded ✓ → In Transit (active) → Delivered
  - Status message strip: "🚢 Your container is on its way to the destination."

---

## SCREEN 7 — Shipment Tracking

- Navy header card:
  - Ref: SCL-2026-00847
  - Route: Durban → Tema, Ghana
  - Sub: AfriShip Logistics · 3.5 CBM · Electronics
  - Estimated Arrival: 12 Aug 2026 · Current Status: In Transit (blue)
  - Horizontal progress fill bar (60% filled)

- **5-step timeline** (white card, "Shipment Progress"):
  1. ✓ Booking Confirmed — 16 May 2026 · Deposit paid (green dot)
  2. ✓ Cargo Loaded — 15 Jul 2026 · Durban Port (green dot)
  3. 🔵 In Transit — Vessel: MV African Horizon · West Africa (active, pulsing blue dot)
  4. ○ Arrived at Port — Expected 10 Aug 2026 (grey)
  5. ○ Cargo Released — Pending final payment (grey)

- **Next Payment Due** banner (orange gradient):
  - "⏰ Next Payment Due"
  - R 5,145 (large, white)
  - "50% balance · Due 8 Jul 2026 (7 days before departure)"
  - Buttons: "Pay Now" (white) · "Message Operator" (outline)

---

## SCREEN 8 — Messages

- Heading: "Messages · SCL-2026-00847" with back arrow
- Sub: "AfriShip Logistics · Durban → Tema · In Transit"

- Message thread (chat-style bubbles):
  - [Operator — AfriShip Logistics — left bubble, grey]:
    "Hi Nomvula, just confirming your cargo has been loaded successfully at Durban Port. Vessel departs tomorrow at 06:00."
    · 15 Jul 2026, 14:32
  - [Customer — right bubble, navy]:
    "Thank you! Can you confirm the estimated arrival date at Tema Port?"
    · 15 Jul 2026, 15:10
  - [Operator — left bubble, grey]:
    "Estimated arrival is 12 Aug 2026, subject to port conditions. We'll notify you 48 hours before arrival."
    · 15 Jul 2026, 15:45
  - [Customer — right bubble, navy]:
    "Perfect, thank you for the update 🙏"
    · 15 Jul 2026, 16:02
  - [Operator — left bubble, grey] — UNREAD badge:
    "Your vessel has cleared Cape waters and is now in open Atlantic. All goods secured. Next update at Canary Islands waypoint."
    · 22 Jul 2026, 09:15

- Message input bar at bottom: text field "Type a message..." · Send button (orange)

---

## SCREEN 9 — Cargo Release & Final Payment

- "Your cargo has arrived! 🎉" banner (green gradient):
  - Tema Port, Ghana · Arrived 10 Aug 2026

- Booking ref row: SCL-2026-00847 · "Arrived ✓" badge (green)

- **Final Payment card** (white, prominent):
  - "30% Final Balance Due"
  - R 3,087 ZAR (large, orange)
  - Payment breakdown: Deposit paid R 2,058 ✓ · Mid-stage paid R 5,145 ✓ · Final due R 3,087
  - "🔓 Pay & Release Cargo" button (orange, full width)

- **Cargo Release Conditions** (navy card, checklist):
  - ✓ Final payment confirmed
  - ✓ Customs cleared
  - ✓ Identity verified
  - ✓ Operator confirmed
  - All 4 ticked with green checkmarks

- Dispute notice (amber strip):
  "You have 72 hours from arrival to raise a dispute before cargo is released."
  · "Raise Dispute" link (orange text)

---

## DESIGN REQUIREMENTS

- Pixel-perfect, professional UI — realistic logistics data, no lorem ipsum
- Smooth CSS slide transitions between screens (left/right directional)
- Progress bar at top: "Step N of 9 — Screen Name" with percentage fill and dot indicators
- Mobile phone shell: max-width 420px, rounded corners, notch bar, subtle drop shadow
- "DEMO MODE" watermark fixed in bottom-right corner, low opacity, rotated
- Navigation: "← Back" / "Next →" buttons update label per screen context (e.g. "Confirm & Pay Deposit →", "View My Bookings →")
- On Screen 9 the "Next →" button becomes "Restart Demo" and loops back to Screen 1
- Keyboard arrow keys for navigation (left/right)

Output as a single self-contained HTML file with all CSS and JS inline. No external CDN dependencies.
