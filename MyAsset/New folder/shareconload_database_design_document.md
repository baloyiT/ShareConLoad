# SHARECONLOAD DATABASE DESIGN DOCUMENT (DDD)

## Platform
ShareConLoad Logistics Marketplace Platform

## Company
VEYQON GROUP (Pty) Ltd
Registration Number: 2026/353683/07

## Version
1.0

## Database Platform
PostgreSQL / Supabase

---

# 1. DOCUMENT PURPOSE

This Database Design Document (DDD) defines the logical and operational database architecture for the ShareConLoad logistics marketplace platform.

The document establishes:
- database architecture principles;
- core entities and relationships;
- operational workflow support;
- shipment lifecycle data structures;
- payment and payout models;
- compliance and audit structures;
- security considerations;
- and scalability principles.

This database design supports the operational, legal, financial, shipment, SLA, compliance, insurance, and governance frameworks established for ShareConLoad.

---

# 2. PLATFORM OVERVIEW

## 2.1 Platform Description

ShareConLoad is a technology-enabled logistics marketplace platform facilitating shared-container international maritime cargo shipments between Customers and independent Operators.

The platform coordinates:
- shipment bookings;
- cargo declarations;
- shared-container allocations;
- staged payment workflows;
- shipment milestone tracking;
- operational support;
- compliance management;
- dispute handling;
- and shipment release workflows.

---

## 2.2 Operational Model

The platform operates as:
- a multi-sided marketplace;
- coordinating Customers and Operators;
- while maintaining operational governance and financial workflow control.

The platform itself is not:
- a shipping line;
- freight carrier;
- customs broker;
- or warehouse operator.

---

# 3. DATABASE DESIGN PRINCIPLES

## 3.1 Core Design Principles

The database architecture prioritizes:
- operational traceability;
- workflow governance;
- financial control;
- auditability;
- modular scalability;
- event-driven shipment tracking;
- and compliance visibility.

---

## 3.2 Architectural Philosophy

The platform database is designed around:
- shipment lifecycle management;
- operational milestones;
- state transitions;
- staged financial orchestration;
- and dispute defensibility.

The design intentionally prioritizes:
- operational clarity;
- practical workflow implementation;
- and scalability readiness.

---

## 3.3 Database Platform

The platform uses:
- PostgreSQL;
- hosted through Supabase;
- with Row Level Security (RLS);
- authentication integration;
- and event-trigger support.

---

# 4. HIGH-LEVEL DATABASE ARCHITECTURE

## 4.1 Core Functional Domains

The database architecture consists of the following major domains:

| Domain | Purpose |
|---|---|
| Identity & Access | User authentication and roles |
| Customer Management | Customer profiles and verification |
| Operator Management | Operator onboarding and compliance |
| Shipment Management | Booking and shipment lifecycle |
| Container Operations | Shared-container coordination |
| Financial Management | Payments, payouts, refunds |
| Compliance & Customs | Regulatory and cargo governance |
| Dispute & Claims | Incident and claims management |
| SLA & Support | Operational support tracking |
| Notifications | Operational communications |
| Audit & Monitoring | Operational traceability |

---

# 5. ENTITY RELATIONSHIP OVERVIEW

## 5.1 Core Operational Relationships

### Core Flow

Users
→ Profiles
→ Bookings
→ Containers
→ Shipment Items
→ Payments
→ Payouts
→ Shipment Milestones
→ Customs Events
→ Release Authorization
→ Shipment Completion

---

## 5.2 Primary Relationships

| Parent Entity | Child Entity |
|---|---|
| bookings | shipment_items |
| bookings | declarations |
| bookings | payments |
| bookings | shipment_milestones |
| bookings | disputes |
| bookings | customs_events |
| bookings | insurance_claims |
| bookings | support_tickets |
| containers | bookings |
| disputes | dispute_evidence |
| payments | payouts |

---

# 6. IDENTITY & ACCESS DOMAIN

# 6.1 auth.users

Managed by Supabase Authentication.

Purpose:
- platform authentication;
- identity management;
- login and security.

---

# 6.2 profiles

## Purpose
Stores platform role assignments.

## Core Fields

| Field | Description |
|---|---|
| id | Internal profile ID |
| user_id | Supabase auth user reference |
| role_type | customer/operator/admin |
| created_at | Record creation timestamp |

## Relationships

- Many profiles belong to auth.users
- One profile may link to operator_profiles

---

# 7. OPERATOR MANAGEMENT DOMAIN

# 7.1 operator_profiles

## Purpose
Stores operator onboarding and compliance information.

## Core Fields

| Field | Description |
|---|---|
| legal_name | Registered operator entity |
| entity_type | individual/company |
| registration_number | Company registration |
| vat_number | VAT registration |
| phone_verified | Verification status |
| status | onboarding/compliance status |

## Operational Purpose

Supports:
- operator onboarding;
- compliance verification;
- payout governance;
- operational risk management.

---

# 8. CONTAINER OPERATIONS DOMAIN

# 8.1 containers

## Purpose
Represents shared-container shipment capacity published by Operators.

## Core Fields

| Field | Description |
|---|---|
| operator_id | Assigned operator |
| origin_country | Shipment origin |
| destination_country | Shipment destination |
| departure_date | Planned departure |
| total_capacity_cbm | Container capacity |
| available_capacity_cbm | Remaining capacity |
| price_per_cbm | Pricing model |
| status | open/in_transit/delivered |

## Operational Purpose

Supports:
- shared-container allocation;
- route management;
- capacity tracking;
- shipment planning.

---

# 9. SHIPMENT MANAGEMENT DOMAIN

# 9.1 bookings

## Purpose
Represents customer shipment reservations.

## Core Fields

| Field | Description |
|---|---|
| container_id | Assigned container |
| customer_id | Booking owner |
| total_cbm | Cargo volume |
| total_price | Shipment pricing |
| payment_status | Financial state |
| release_status | Cargo release state |
| status | Operational booking status |

## Operational Purpose

Central operational entity governing:
- shipment lifecycle;
- payments;
- disputes;
- customs;
- cargo release.

---

# 9.2 shipment_items

## Purpose
Represents individual cargo items within a booking.

## Core Fields

| Field | Description |
|---|---|
| description | Cargo description |
| declared_value | Declared cargo value |
| quantity | Item quantity |
| weight_kg | Cargo weight |

## Operational Purpose

Supports:
- customs declarations;
- insurance claims;
- prohibited cargo review;
- shipment valuation.

---

# 9.3 declarations

## Purpose
Stores cargo declaration submissions.

## Operational Purpose

Supports:
- customs workflows;
- cargo verification;
- compliance enforcement;
- prohibited cargo governance.

---

# 9.4 booking_status_history

## Purpose
Stores immutable booking state transitions.

## Operational Purpose

Critical for:
- auditability;
- SLA tracking;
- dispute investigations;
- operational analytics.

---

# 9.5 shipment_milestones

## Purpose
Tracks operational shipment events.

## Example Milestones

- booking_confirmed
- cargo_received
- container_loaded
- vessel_departed
- customs_hold
- destination_arrival
- customs_cleared
- release_authorized
- cargo_collected
- shipment_completed

## Operational Purpose

Supports:
- customer tracking;
- SLA reporting;
- operational workflows;
- notifications;
- dispute handling.

---

# 10. FINANCIAL MANAGEMENT DOMAIN

# 10.1 payments

## Purpose
Stores staged customer payments.

## Payment Stages

| Stage | Description |
|---|---|
| deposit_20 | Booking deposit |
| pre_departure_50 | Pre-shipment payment |
| final_release_30 | Final release payment |

## Operational Purpose

Supports:
- staged financial governance;
- payment orchestration;
- refund workflows;
- release control.

---

# 10.2 payouts

## Purpose
Stores operator settlement transactions.

## Operational Purpose

Supports:
- staged operator payouts;
- payout holds;
- recovery coordination;
- platform fee management.

---

# 11. CUSTOMS & COMPLIANCE DOMAIN

# 11.1 customs_events

## Purpose
Tracks customs-related shipment events.

## Example Events

- inspection
- hold
- released
- duty_pending
- documents_requested
- seized

## Operational Purpose

Supports:
- customs traceability;
- operational visibility;
- regulatory workflow management.

---

# 11.2 compliance_flags

## Purpose
Tracks operational and regulatory risk indicators.

## Example Flags

- prohibited_cargo
- sanctions_risk
- suspicious_payment
- customs_risk
- fraud_risk

## Operational Purpose

Supports:
- fraud management;
- operational risk control;
- compliance monitoring.

---

# 12. CARGO RELEASE DOMAIN

# 12.1 cargo_release_authorizations

## Purpose
Controls cargo release governance.

## Core Conditions

Cargo release depends on:
- customs clearance;
- final payment completion;
- consignee verification;
- operational approval.

## Operational Purpose

Prevents unauthorized cargo release.

Critical operational control table.

---

# 13. DISPUTE & CLAIMS DOMAIN

# 13.1 disputes

## Purpose
Stores operational disputes and investigations.

## Example Dispute Types

- cargo_damage
- cargo_missing
- shipment_delay
- customs_issue
- refund_request

## Operational Purpose

Supports:
- claims handling;
- operational investigations;
- dispute resolution.

---

# 13.2 dispute_evidence

## Purpose
Stores dispute evidence files.

## Operational Purpose

Supports:
- investigation workflows;
- operational defensibility;
- insurance coordination.

---

# 13.3 insurance_claims

## Purpose
Tracks insurance-related claims.

## Operational Purpose

Supports:
- insurer coordination;
- cargo damage workflows;
- operational claim tracking.

---

# 14. SUPPORT & SLA DOMAIN

# 14.1 support_tickets

## Purpose
Stores operational support requests.

## Operational Purpose

Supports:
- SLA tracking;
- customer support;
- operational escalation.

---

# 15. COMMUNICATION DOMAIN

# 15.1 notifications

## Purpose
Stores platform-generated notifications.

## Example Notifications

- payment reminders
- shipment milestones
- customs alerts
- cargo release notifications
- dispute updates

## Operational Purpose

Supports:
- operational communications;
- customer awareness;
- workflow coordination.

---

# 16. AUDIT & TRACEABILITY DOMAIN

# 16.1 audit_logs

## Purpose
Stores immutable operational audit records.

## Operational Purpose

Critical for:
- legal defensibility;
- financial reviews;
- dispute investigations;
- compliance traceability;
- security investigations.

---

# 17. DATABASE SECURITY DESIGN

## 17.1 Row Level Security (RLS)

The platform uses PostgreSQL Row Level Security.

RLS policies enforce:
- customer isolation;
- operator isolation;
- administrative access control;
- financial data protection.

---

## 17.2 Role-Based Access Control

The platform supports:
- customer roles;
- operator roles;
- support roles;
- finance roles;
- compliance roles;
- admin roles.

---

## 17.3 Sensitive Data Protection

Sensitive operational data includes:
- payment information;
- cargo declarations;
- identity verification data;
- customs documentation;
- dispute evidence.

Security controls include:
- encrypted transport;
- controlled access;
- audit logging;
- secure document storage.

---

# 18. EVENT-DRIVEN WORKFLOW DESIGN

## 18.1 Event-Based Architecture

The database supports event-driven workflows using:
- triggers;
- milestone tables;
- state transitions;
- notification events.

---

## 18.2 Existing Trigger Workflows

### Capacity Management

Confirmed bookings automatically reduce container capacity.

Cancelled bookings restore capacity.

---

### Booking Status Auditing

Status changes automatically create immutable history records.

---

### Payment Schedule Generation

New bookings automatically generate staged payment records.

---

# 19. PERFORMANCE & SCALABILITY DESIGN

## 19.1 Scalability Principles

The platform is designed for:
- modular growth;
- high operational traceability;
- incremental feature expansion;
- event-driven scalability.

---

## 19.2 Indexing Strategy

Indexes should exist on:
- foreign keys;
- booking references;
- payment status;
- shipment milestones;
- operational timestamps;
- dispute statuses.

---

## 19.3 Future Scalability Enhancements

Future scaling may include:
- partitioning high-volume tables;
- event buses;
- CQRS/event sourcing;
- operational data warehousing;
- AI risk analytics.

---

# 20. REPORTING & ANALYTICS SUPPORT

The database supports future reporting capabilities including:
- shipment analytics;
- operator performance;
- SLA compliance;
- customs delay analysis;
- dispute analytics;
- financial reconciliation;
- platform profitability.

---

# 21. MVP DATABASE SCOPE

## 21.1 MVP Critical Tables

### Existing
- profiles
- operator_profiles
- containers
- bookings
- shipment_items
- declarations
- notifications
- booking_status_history

### Added
- payments
- payouts
- shipment_milestones
- disputes
- support_tickets
- audit_logs

---

# 22. FUTURE DATABASE EVOLUTION

Potential future enhancements include:
- customs integration tables;
- AI risk scoring models;
- dynamic pricing engines;
- warehouse integrations;
- IoT tracking integration;
- sanctions screening integration;
- multi-currency accounting;
- enterprise reporting models.

---

# 23. STRATEGIC DATABASE OBSERVATIONS

The ShareConLoad platform database is fundamentally:
- workflow-driven;
- operationally governed;
- financially staged;
- and compliance-oriented.

The database architecture is intentionally designed to support:
- operational defensibility;
- regulatory readiness;
- scalable logistics coordination;
- and long-term marketplace governance.

This is substantially more important than early-stage UI complexity or over-optimization.

---

# 24. CONCLUSION

This database design establishes the foundational operational architecture required to support the ShareConLoad logistics marketplace platform.

The design aligns directly with:
- shipment governance;
- staged financial workflows;
- shared-container logistics operations;
- customs and compliance controls;
- dispute management;
- SLA governance;
- and operational scalability objectives.

The database architecture is designed to evolve from:
- MVP marketplace operations
into:
- enterprise-grade logistics coordination infrastructure.

