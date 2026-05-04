# PROJECT: ShareConLoad

## SYSTEM OVERVIEW

ShareConLoad is a global logistics marketplace that connects:

- Customers shipping goods internationally
- Operators providing shared container space

The platform enables:
- Container discovery
- Booking of space (CBM-based)
- Goods declaration
- Shipment tracking

This is NOT a generic app.
It is a structured logistics system with strict data and workflow rules.

---

## TECH STACK (FIXED)

Frontend:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- DaisyUI

Backend:
- Supabase
  - PostgreSQL
  - Auth
  - Auto-generated APIs

Hosting:
- Vercel

---

## ARCHITECTURE RULES (STRICT)

- Use client-side data fetching
- Use Supabase directly (no custom backend)
- Do NOT introduce:
  - Express / Node servers
  - GraphQL
  - Microservices
  - ORMs (Prisma, etc.)

- Do NOT change architecture unless explicitly instructed

---

## CORE DOMAIN MODEL

Entities:

- users
- containers
- bookings
- shipment_items
- declarations
- booking_status_history

Relationships:

- User (operator) → Containers
- User (customer) → Bookings
- Container → Bookings
- Booking → Shipment Items
- Booking → Declaration (1:1)
- Booking → Status History

---

## BUSINESS RULES (CRITICAL)

### Containers
- Must have origin + destination (country + city)
- Must track:
  - total_capacity_cbm
  - available_capacity_cbm
- available_capacity_cbm <= total_capacity_cbm

---

### Bookings
- Must reference container
- Must include:
  - total_cbm
  - total_price
- Cannot exceed available capacity

---

### Shipment Items
- One booking can have multiple items
- Must include description and declared_value

---

### Goods Declaration (MANDATORY)
- Every booking MUST have a declaration
- agreed_terms must be TRUE
- Booking is invalid without declaration

---

### Booking Status Lifecycle
Only allow:

pending → confirmed → loaded → in_transit → delivered

(cancelled allowed from any stage)

---

## FRONTEND STRUCTURE

app/
  page.tsx                     → Home (container listing)
  container/[id]/page.tsx     → Container details
  booking/[containerId]/page.tsx
  operator/page.tsx
  operator/create/page.tsx

components/
  reusable UI components only

services/
  supabaseClient.ts

---

## CODING STANDARDS

### TypeScript
- Always define types for data
- Do NOT use `any`
- Use clear, explicit types

---

### React / Next.js
- Functional components only
- Use hooks (useState, useEffect)
- Keep components small and focused

---

### Styling
- Use Tailwind CSS
- Use DaisyUI components
- Avoid custom CSS unless necessary

---

## UI PRINCIPLES

- Clean and minimal
- Functional over decorative
- Mobile-friendly
- No complex animations

---

## DATA ACCESS RULES

- Use Supabase client directly
- Keep queries simple
- Do not abstract prematurely
- Do not create unnecessary service layers

---

## ERROR HANDLING

- Log errors to console
- Show simple user-friendly messages
- Do NOT over-engineer error handling

---

## WHAT NOT TO BUILD (MVP)

Do NOT add:

- Payments
- Real-time tracking (GPS)
- Advanced analytics
- AI features
- External integrations

Unless explicitly requested

---

## DEVELOPMENT PRIORITY

Always prioritize:

1. Booking flow
2. Data integrity
3. Usability

---

## OUTPUT EXPECTATIONS (FOR AI)

When generating code:

- Provide complete working files
- Include imports
- Use correct TypeScript types
- Follow folder structure exactly
- Keep code simple and readable

---

## TOKEN EFFICIENCY RULES

- Do NOT repeat full system context
- Assume this file is always known
- Focus only on relevant module

---

## INSTRUCTION TO AI

- Do NOT redesign the system
- Do NOT introduce new technologies
- Do NOT overcomplicate solutions

Always follow:
- Defined schema
- Defined architecture
- Defined workflows

If unclear:
→ Ask for clarification instead of guessing