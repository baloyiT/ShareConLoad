# How It Works — Page Redesign

## Goal

Rewrite and redesign `/how-it-works` to serve visitors who have never heard of shared container shipping. The page must explain the concept, walk through both the shipper and operator journeys, surface the payment structure as a trust signal, and convert visitors into either shippers or operators.

## Background

The current page jumps straight into numbered step cards without explaining what shared container shipping is. The step descriptions are too brief for a newcomer audience ("Book Space", "Declare Your Goods"). The payment flow is omitted entirely. The step layout uses a flat grid with no sense of progression or flow.

---

## Page Structure

Eight sections in order:

### 1. Navbar
Unchanged from the current page — sticky, logo + nav links + Login/Sign Up CTA.

### 2. Hero
**Rewritten headline:** "Ship smarter. Share the container."  
**Subheadline:** "ShareConLoad lets multiple shippers share a single container — so you only pay for the space you actually use, on a route that's already going your way."  
**Two CTA buttons:**
- "Browse Containers" → `/#listings`
- "List Your Container" → `/onboarding/operator` (or `/operator` if already an operator)

Dark navy background with world-map overlay at low opacity. Same visual treatment as the current hero.

### 3. Concept Explainer *(new)*
A white card section between the hero and the shipper journey.

**Eyebrow label:** "What is shared container shipping?"  
**Headline:** "You don't need the whole container. You just need your share."  
**Body:** One paragraph explaining that small and mid-size businesses have historically been forced to pay for a full container or wait for a consolidator. ShareConLoad changes that — operators list spare capacity, shippers book exactly the CBM they need, everyone pays their fair share.  
**Callout quote** (orange left-border highlight):  
> "Instead of booking a full 20ft container for $3,000+, book 3 CBM for your actual goods and pay only for that space."

### 4. Shipper Journey *(redesigned)*
**Audience pill:** "For Shippers" (orange)  
**Section headline:** "Book space in minutes"  
**Subline:** "From discovery to delivery — five steps, fully online."

**Layout:** Alternating left/right rows with a center vertical spine (orange gradient line). On mobile, collapses to a single-column vertical list with a left-aligned spine.

**Steps:**

| # | Title | Description | Badge |
|---|---|---|---|
| 1 | Find a Container | Browse verified operators with open routes. Filter by origin city, destination, departure date, and price per CBM. Every listing shows available space and operator compliance status. | — |
| 2 | Book Your Space | Enter the CBM you need — no whole-container commitment. Add shipment details and reserve your slot. Space is held once the deposit is paid. | "Takes under 5 minutes" |
| 3 | Declare & Pay Deposit | Provide item descriptions and declared values for customs. Pay the 20% deposit to confirm the booking. The remaining balance is split into two further stages as the shipment progresses. | "20% deposit secures your space" |
| 4 | Drop Off Your Goods | Deliver goods to the operator's warehouse or collection point before the loading deadline. The operator handles packing, loading, and customs coordination. | — |
| 5 | Track & Receive | Follow the shipment through every milestone — loading, departure, transit, arrival, customs clearance, delivery. Pay the remaining 30% before cargo is released at the destination. | "Cargo released once final payment clears" |

Step 1 is left-aligned; steps alternate left/right thereafter. Step numbers 1–4 use orange (`#f97316`); step 5 uses navy (`#0f2044`) to signal completion.

### 5. Payment Stages *(new)*
A dark navy card (`#0f2044`) positioned between the shipper journey and the operator journey.

**Eyebrow:** "How payments work"  
**Headline:** "Pay in three stages — never all at once"  
**Subline:** "Your payment is split across the shipment lifecycle. You're protected at every stage — no large upfront risk."

Three tiles in a row, connected by arrows:

| Stage | % | Label | Trigger |
|---|---|---|---|
| 1 | 20% | Deposit | Paid at booking to secure space |
| 2 | 50% | Pre-Departure | Due 7 days before the container departs |
| 3 | 30% | On Release | Final payment before cargo is released at destination |

### 6. Operator Journey *(redesigned)*
**Audience pill:** "For Operators" (navy)  
**Section headline:** "Turn empty space into revenue"  
**Subline:** "List your container, fill it with verified shippers, get paid."

Same alternating left/right layout as the shipper journey but with a navy spine (`#0f2044` gradient).

**Steps:**

| # | Title | Description | Badge |
|---|---|---|---|
| 1 | Create a Listing | Define route, departure date, total capacity, and price per CBM. The container goes live on the marketplace immediately, visible to shippers searching that route. | — |
| 2 | Complete Verification | Submit KYC documents — identity, business registration, banking, insurance, and warehouse address. Done once. Verified operators display a trust badge on all listings. | "One-time compliance check" |
| 3 | Accept Bookings | Shippers find the listing and book space. Review declarations, manage the manifest, and coordinate collection — all from the operator portal. | — |
| 4 | Ship & Update Milestones | Execute the shipment as planned. Post milestones at each stage so shippers stay informed automatically. | — |
| 5 | Get Paid | Payouts are released as each payment stage clears — after booking confirmation, pre-departure, and final cargo release. Minus the 5% platform commission. | "Staged payouts — predictable cash flow" |

Step 1 starts on the right side; steps alternate right/left thereafter. Step numbers 1–4 use navy; step 5 uses orange to signal payout.

### 7. Why ShareConLoad *(updated)*
**Headline:** "Why choose ShareConLoad?"  
**Subline:** "Benefits for both sides of the marketplace"

Two-column card layout — one card per audience:

**Shippers — "Ship smarter, spend less"**
- Pay only for space you use
- No waiting for full container loads
- Transparent staged payments
- Real-time shipment tracking
- Verified, compliant operators

**Operators — "Earn more per trip"**
- Fill unused container capacity
- Reach verified shippers globally
- Payments guaranteed per stage
- Digital booking management
- Dispute protection built in

### 8. Final CTA
**Headline:** "Ready to ship smarter?"  
**Subline:** "Join shippers and operators already using ShareConLoad to move goods across the world."  
**Buttons:** "Browse Containers →" + "Become an Operator"

Dark navy background with world-map overlay — matches the hero.

### 9. Footer
Updated to match the home page footer — three columns (Brand, Platform, Legal) + copyright bar.

---

## Layout Rules

### Alternating rows (desktop `lg+`)
- Three-column grid: `1fr 56px 1fr`
- Center column holds the step number circle and the connecting vertical line
- Odd steps: content on left, empty on right
- Even steps: empty on left, content on right
- Spine is a continuous vertical line threading all step circles

### Mobile (below `lg`)
- Collapses to a single-column layout
- Step number circle is left-aligned
- Vertical spine runs down the left side
- Content sits to the right of the number, full width

### Step number colors
- Shipper steps 1–4: `#f97316` (orange)
- Shipper step 5: `#0f2044` (navy) — signals arrival/completion
- Operator steps 1–4: `#0f2044` (navy)
- Operator step 5: `#f97316` (orange) — signals payout

---

## File to Change

| Action | Path |
|---|---|
| Rewrite | `app/how-it-works/page.tsx` |

No new components, no new routes, no DB changes. Single file rewrite.

---

## Out of Scope

- FAQ section
- Country-specific routing information
- Animated step transitions
- Video embed
- Operator onboarding form on this page
