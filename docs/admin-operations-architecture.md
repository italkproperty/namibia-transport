# Namibia Transport — Admin Operations Architecture

## Purpose
The admin is the operating system for Namibia Transport. It is not a collection of CRUD pages.

Operator mental model:
Lead → Quote → Customer decision → Payment → Dispatch → Trip → Completion → Review → Reporting

The database may contain separate rows for legs, payments and assignments. The admin must present the business object first and database rows second.

## Current surface
- Bookings
- Drivers
- Calendar
- Quotes
- Enquiries
- Reviews
- Pricing
- PayToday

This is functional but fragmented. It mixes customer lifecycle, operations, configuration and diagnostics at the same level.

## Target navigation

### Command Centre
Answer in under 10 seconds: what needs attention now; today's/tomorrow's trips; quotes needing follow-up; payments needing reconciliation; unassigned/impossible trips; driver/vehicle conflicts; money at risk.

Transactional queues must render independently of analytics.

### Sales
Leads / Enquiries: New → Contacted → Qualified → Quoted → Negotiating → Won/Lost.
Quotes: Draft → Priced → Issued → Viewed → Negotiating → Accepted → Payment pending → Paid → Converted.
Terminal outcomes: Rejected / Expired / Cancelled.

Every quote needs customer, itinerary, dates, pax, vehicle, customer price, internal cost, contribution, validity, sent/viewed timestamps, follow-up state, public URL and payment state.

### Trips / Operations
A customer itinerary is one trip even when it contains several driving legs.

The trip page should show customer, contact channels, canonical quote URL, total price, payment state, itinerary, every operational leg, driver/vehicle, payout, contribution, route confidence, special requirements and history.

Dispatch / Calendar answers: who is driving, what vehicle, where it starts/ends, whether the next booking is reachable, turnaround time, double-booking and deadhead movement.

### Customers
Customer profile should show contact details, previous trips, active quotes, lifetime revenue, outstanding payment, acquisition source, notes, review history and communication history.

### Fleet
Drivers and vehicles should be first-class operational objects. Vehicle should not remain merely an attribute hidden inside a driver row.

Track vehicle registration, class, make/model, capacity, luggage, status, service/inspection reminders, driver allocation and operating cost profile.

### Finance
One queue should answer: awaiting payment, customer-reported payment, settled payment, driver payouts, trip contribution, refunds/cancellations and revenue at risk.
Payment truth comes from the payments table, never from a UI status alone.

### Pricing & Network
Separate road truth, cost truth, commercial price and customer fare snapshot.
AI interprets customer language; deterministic routing and pricing decide the authoritative distance, time and cost.

### Reviews
Completed → Review requested → Received → Verified → Published.

### System / Settings
Pricing constants, vehicle classes, route catalogue, currencies, payment provider, company details, authentication, notifications, audit log and data maintenance belong here.
PayToday diagnostics should not be a top-level business workflow.

## Trip-centric data model
The existing bookings table represents an operational leg. group_ref already provides the foundation for a trip.

Target domain:
Customer → Quote → Trip → Trip Legs → Assignments → Payments → Review

Do not rewrite bookings unnecessarily. Introduce an explicit trip abstraction only where it materially improves operator workflows.

## Quote URL architecture
Every issued quote has one canonical customer-facing URL.

That URL must be retrievable from quote list, trip page, operations list, customer page and enquiry/lead page.

Actions: Copy link | Open | Share | WhatsApp.

Permitted quote edits keep the same customer-facing URL.

## Test data lifecycle
Production and test records must be distinguishable at the database level.

Target field: record_environment = production | test.

Do not identify test data with fragile heuristics such as low price, old date, admin-itinerary, a customer named Test, or pending payment alone.

Test records must not enter production revenue reporting, conversion reporting or normal operational queues by default. They should have a dedicated Test Data view and explicit purge workflow.

Hard delete is permitted only for test records with no settled payment. Records containing financial evidence are archived instead.

### One-time cleanup
Existing test records must be reviewed before deletion. The cleanup screen must show reference, customer, travel date, created date, price, payment state, assignment state and group reference. The operator selects exact rows to purge.

No automatic rule such as delete all pending bookings is permitted.

## Auditability
Financially meaningful and destructive actions should record actor, action, object, before/after where appropriate, reason and timestamp.

Events include quote creation/price changes/issue/cancellation, booking cancellation/reinstatement, payment reconciliation, driver assignment, trip completion, review publication and test-data purge.

## Reliability
Critical paths: trips/bookings, payments and dispatch. Analytics must never block them.

Failed dependencies must identify what failed, whether data is partial, what the operator can safely do and whether retry is safe.

Quote/payment/assignment actions must be idempotent.

## Quote / route QA gate
Before issuing a quote verify customer contact and pax; resolved itinerary; coherent dates/times; explicit return; route existence; plausible distance/duration; access-road and park constraints; vehicle suitability; customer price; driver payout; contribution; positioning; leg-total reconciliation; driver/vehicle availability; and customer-page consistency.

## Namibia-specific routing principle
town anchor ≠ lodge ≠ park gate ≠ attraction ≠ parking/access point.

Customer-facing distance must never be presented as exact when the model is using an approximate anchor.

Places such as Namib Desert Lodge, Sesriem, Sossusvlei and Deadvlei should eventually be represented through their actual access chain rather than silently substituting a nearby town.

## Development acceptance test
Every feature is complete only when the business journey works:
Create → Find → Share → Open → Pay → Dispatch → Complete → Report

Every workflow should test the normal case, multi-leg case, duplicate submission, cancellation, edit, expiry, database timeout, malformed/missing route, payment already received, driver conflict and mobile operator experience.

A green build is necessary but not sufficient.