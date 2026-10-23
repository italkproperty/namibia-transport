# Namibia Transport — Business Operating System Architecture

**Status:** Phase 0 architecture baseline  
**Scope:** Admin, CRM, quotations, bookings, transport operations, invoicing and financial controls  
**Decision:** Extend the existing Next.js + PostgreSQL/Drizzle application; do not introduce a parallel finance application or replace the database/payment provider as part of this work.

## 1. Executive decision

Namibia Transport should operate as one connected business system. Customer, quote, booking, invoice, payment, supplier obligation and driver settlement are distinct records with explicit relationships and a shared audit trail.

The first implementation slice is invoicing, but it must be built on an agreed financial model so that payment allocation, receipts, credit notes, refunds, supplier bills, expenses and management reporting can follow without replacing the first release.

No production schema changes are part of this architecture document.

## 2. Verified current-state inventory

Repository reviewed: `italkproperty/namibia-transport`, production target branch `main` (the repository default branch is different, so implementation work must explicitly target `main`).

| Capability | Current evidence | Architecture implication |
|---|---|---|
| Database schema | `db/schema.ts` | Reuse the existing PostgreSQL/Drizzle schema and migration journal. |
| Customer records | `customers` table in `db/schema.ts` | Invoice/customer links should reuse customer IDs where available and preserve billing snapshots on issued documents. |
| Standard bookings | `bookings` table in `db/schema.ts` | Booking price, driver payout, contribution and currency are already snapshotted. |
| Standard payment attempts | `payments` table in `db/schema.ts` | Reuse existing provider/payment history for standard bookings; do not create a duplicate generic gateway ledger. |
| Standard payment reconciliation | `lib/payments/reconcile.ts`, `app/api/payments/paytoday/return/route.ts` | Payment is verified server-side; URL parameters are not trusted as proof of payment. |
| Charter quotations | `charter_quotes` and `charter_quote_versions` in `db/schema.ts`; `lib/admin/charter-quote-actions.ts` | Preserve the existing quote/version history and create a clear link from charter invoices to the accepted quote. |
| Charter payment attempts | `charter_quote_payments` in `db/schema.ts`; `lib/charter/payment-actions.ts` | This is a separate existing ledger. Phase 0 must define a safe cross-ledger finance view without silently migrating or duplicating live payment history. |
| Corporate quotations | `corporate_quotes` and `corporate_quote_items` in `db/schema.ts` | Support these as another source for invoices; do not confuse quote items with invoice lines. |
| Admin navigation | `components/admin/shell.tsx` | Current navigation is a simple tab list. Add finance navigation within the existing admin shell only after the route and access model is decided. |
| Admin access | `lib/admin/auth.ts`, `components/admin/shell.tsx` | Current UI uses a shared admin gate. Sensitive finance actions need explicit server-side checks; a tab being hidden is not authorization. |
| Schema migrations | `db/migrations/`, `db/migrations/meta/_journal.json` | Use additive, versioned Drizzle migrations; no `db:seed`, destructive push or ad-hoc production schema edits. |
| Database connection | `db/index.ts` | Use the configured Supabase transaction pooler; keep transactions short and database access lean. |
| Payment provider | `lib/payments/types.ts`, `lib/payments/paytoday/provider.ts` | Keep PayToday behind the existing server-only adapter. No gateway secrets in client code. |
| Existing document tooling | Package manifest and current app routes require further inspection before selecting PDF/delivery implementation | Prefer a server-generated, reproducible invoice document; verify dependency and email setup before adding libraries. |

### Known design constraint

Standard booking payments and charter quote payments currently have different tables and workflows. The first finance release must expose a consistent invoice/payment experience while retaining source-specific reconciliation. A later ledger consolidation, if justified, is a separate migration with reconciliation and backfill evidence—not a prerequisite for issuing invoices.

## 3. Business modules and navigation target

1. **Business Overview** — trips today, unassigned jobs, unpaid/overdue invoices, upcoming supplier obligations, revenue and exceptions.
2. **Customers & CRM** — customer profile, enquiry history, quotes, bookings, invoices, payment history and follow-ups.
3. **Sales & Quotations** — standard and bespoke quotes, quote versions, approvals, expiry and conversion.
4. **Bookings & Dispatch** — itinerary legs, schedule, driver/vehicle allocation, trip status and closeout.
5. **Fleet & Suppliers** — partner vehicles, rental companies, supplier quotes/bills, availability and agreed costs.
6. **Finance** — invoices, payment allocations, receipts, credit notes, refunds, supplier bills, driver settlements, expenses and reconciliation.
7. **Analytics & Business Intelligence** — sales conversion, revenue, contribution, actual trip economics, receivables and cash reconciliation.
8. **AI & Sales Coach** — draft suggestions and analysis with human approval for external messages and commercial actions.
9. **Settings, Security & Audit** — company details, document numbering, permissions, integrations, audit history and health.

The above is the target model, not a claim that all modules exist today.

## 4. Core financial domain model

### Existing source records

- `customers`: customer identity and contact details.
- `bookings`: standard transport job and agreed customer/driver economics.
- `corporate_quotes` / `corporate_quote_items`: corporate proposal and its items.
- `charter_quotes` / `charter_quote_versions`: charter proposal and history.
- `payments`: standard booking payment attempts.
- `charter_quote_payments`: charter quote payment attempts.

### Proposed financial records

Names below are logical proposals; final table names and fields must be checked against the complete current schema and migrations before implementation.

- **invoices**: invoice number, status, customer reference, optional booking/quote source, issue/due dates, currency, totals, billing-party snapshot, terms, document snapshot/hash and timestamps.
- **invoice_lines**: description, quantity, unit price, discount if applicable, line total, currency and display order.
- **invoice_sequences**: concurrency-safe numbering by document type and year; unique database constraint on invoice number remains mandatory.
- **payment_allocations**: links verified payment records to invoices, supporting deposits, partial payments, one payment settling multiple invoices and overpayments. Provider payment records remain in their current source tables until a deliberate ledger design is approved.
- **receipts**: proof of confirmed received funds, linked to the verified payment/allocation and generated once idempotently.
- **credit_notes**: immutable adjustment against an issued invoice, with reason and line/tax snapshots; no silent edits to issued documents.
- **refund records/events**: amount, reason, provider reference, status and reconciliation evidence. A refund request is not the same as a confirmed refund.
- **supplier_bills**: supplier, bill number, booking/cost allocation, due date, amount and status.
- **trip_expenses**: estimated and actual operating costs with category, amount, source and booking/trip association.
- **driver_settlements**: payable amount, related booking/assignment, approval and settlement state.
- **audit_events**: actor, action, entity, timestamp and minimal before/after metadata for sensitive financial changes. Avoid storing credentials or unnecessary personal data.
- **document_delivery_events**: channel, recipient, document version, attempt status and timestamp, where needed for reliable delivery.

Do not create every proposed table automatically. Deliver the smallest coherent first migration and add later tables only when their workflows are ready.

## 5. Invoice lifecycle and invariants

Suggested lifecycle:

- **Draft**: editable, no official invoice number required until issue (unless a reviewed numbering policy decides otherwise).
- **Issued**: immutable commercial and billing snapshot; invoice number is permanently assigned.
- **Partially paid**: confirmed allocations are greater than zero and less than the amount due.
- **Paid**: confirmed allocations settle the invoice balance.
- **Overdue**: unpaid balance remains after due date; derive this from due date and balance rather than relying solely on a stale status.
- **Void / credited**: use controlled cancellation before issue or credit-note correction after issue; never delete an issued invoice to conceal history.

Rules:
- Invoice totals are computed server-side from validated decimal strings and line items; money remains PostgreSQL `numeric`, not floating-point storage.
- Invoice number uniqueness is enforced by the database and sequence allocation is concurrency-safe.
- Issue operation is idempotent; retries cannot create another invoice.
- Issued invoice data is snapshotted and remains stable when customer profile, pricing rules or quote data changes.
- Payment is considered received only after trusted provider reconciliation or an authorized manual verification recorded with evidence.
- Redirect query parameters never establish payment success.
- Payment allocations cannot exceed the confirmed unapplied payment amount without an explicit overpayment workflow.
- Partial payment, duplicate callbacks, refunds, credit notes and manual adjustments are separately auditable.
- PDF totals and contents are rendered from the issued snapshot, not recalculated from mutable live data.
- Email/WhatsApp delivery failures do not roll back an issued invoice or repeat the financial transaction.
- No VAT is calculated or charged while the business is not VAT-registered. Display a clear non-VAT-registered statement; tax treatment must be reviewed if the registration status changes.

## 6. Customer-to-cash workflow

1. Enquiry is captured and linked to a customer.
2. Quote is prepared with versioned terms and price.
3. Acceptance creates or confirms a booking while preserving the accepted price and itinerary.
4. Invoice can be issued from a booking, accepted quote or standalone admin entry.
5. Invoice is rendered from a stable snapshot and can be downloaded/shared securely.
6. Payment attempts use the existing PayToday adapter and source-specific payment workflows.
7. Server-side reconciliation verifies provider status and amount before payment allocation.
8. A receipt is created only for verified funds.
9. Refunds and invoice corrections use separate records.
10. Trip closeout records actual supplier, driver, fuel, accommodation, park and other costs.
11. Management reports compare invoiced revenue, collected cash, gateway fees and actual trip costs.

Invoices must support both pre-payment billing and invoice-after-payment workflows. An invoice is not a receipt.

## 7. Security and authorization

Current admin access is a shared gate, so the initial implementation must not assume it already provides fine-grained roles.

Before multi-user finance operations, define server-side permission checks for at least:
- view finance,
- create/edit draft invoices,
- issue invoices,
- record verified manual payments,
- initiate/record refunds,
- create credit notes,
- approve discounts,
- manage invoice settings,
- view/export reports.

A UI-only hidden button is not access control. Any server action or route that performs a privileged action must independently verify authorization. Shared-password limitations should be documented and a role-based identity model should be considered before expanding staff access.

Secure invoice links must use unguessable tokens, avoid exposing customer data through predictable IDs, and provide a revocation/expiry strategy. Never place payment-provider secrets in client bundles.

## 8. Reliability, database load and Supabase egress

- Use small, paginated list queries and select only required columns.
- Avoid N+1 lookups and repeated full-table reads.
- Keep DB transactions limited to financial writes; do not call payment providers, render PDFs or send messages inside a transaction.
- Use unique constraints/idempotency keys for invoice issue, provider events and receipt creation.
- Record asynchronous delivery jobs/events so retries do not repeat financial writes.
- Set explicit, bounded query/request timeouts where appropriate and return useful errors.
- Keep production database connection string on Supabase's transaction pooler as required by the existing deployment architecture.
- Take and verify a backup before schema migration; use versioned additive migration SQL and test against a staging database.
- Do not use `db:seed` to repair production, do not use destructive `db:push`, and do not migrate providers while the root cause of the egress spike is unknown.
- Establish baseline query/egress measurements before and after rollout. The observed historical egress spike has not yet been causally attributed to a specific workflow.

## 9. Implementation phases and exit gates

### Phase 0 — Audit and design
- Verify `main` branch schema, migration journal, payment workflows, admin access, document tooling and current production deployment configuration.
- Inspect actual Supabase tables and migration state without changing production data.
- Reconcile standard booking payments and charter payment records.
- Agree invoice policy, numbering, billing fields, tax statement, permission matrix and acceptance tests.
- **Exit gate:** reviewed data model and migration plan, with no duplicate financial source of truth.

### Phase 1 — Invoice foundation
- Additive migration for invoices, lines, numbering and minimum audit fields.
- Admin invoice register and draft creation from booking/quote or standalone.
- Server-side issue action with immutable snapshot and concurrency-safe number.
- PDF generation/download and secure invoice sharing.
- Invoice states: draft, issued, partially paid, paid, overdue, void/credited.
- No-VAT presentation and invoice settings.
- **Exit gate:** create, issue, render, download and share invoices; test concurrency, totals, authorization, duplicate submission and stable issued snapshots.

### Phase 2 — Payment and receipt integration
- Map existing standard and charter payment attempts to invoices through explicit allocations.
- Reconcile provider status and amount server-side.
- Support deposits, partial payments, receipt generation, overpayments, refunds and credit notes.
- Manual payment confirmation requires permission and evidence.
- **Exit gate:** invoice balances reconcile to payment events; duplicate callbacks do not duplicate allocations or receipts.

### Phase 3 — Cost and settlement controls
- Supplier bills, driver settlements and trip expenses.
- Estimated-versus-actual trip contribution.
- Supplier payable register and reconciliation.
- **Exit gate:** a completed booking can be closed out and its margin explained.

### Phase 4 — Business dashboards and automation
- Receivables ageing, revenue, contribution, supplier obligations, cash reconciliation, sales conversion and acquisition source.
- Notifications and AI suggestions based on verified data with human approvals.
- **Exit gate:** reports reconcile to source records and automation failures are observable and safely retryable.

## 10. Acceptance test matrix

- Concurrent invoice issuance never duplicates a number.
- Invalid line quantity/price and malformed decimal values are rejected.
- Totals use decimal-safe arithmetic and match the PDF exactly.
- Editing a customer, quote or pricing setting does not alter an issued invoice.
- Repeated issue requests return the same issued invoice.
- Unauthorized server actions cannot issue, credit, refund or mark payments received.
- A forged payment return URL does not mark an invoice paid.
- Payment amount mismatch is held for review.
- Duplicate provider callbacks do not create duplicate payment allocations or receipts.
- Multiple partial payments settle the invoice accurately.
- One payment can be allocated across multiple invoices when permitted.
- Refund requests are not reported as completed until confirmed.
- Credit notes preserve the original invoice and adjustment reason.
- Email/PDF delivery failure does not repeat the financial write.
- DB timeout gives a bounded, actionable error; no request waits indefinitely.
- Migrations are tested against a staging copy and a backup/restore procedure is verified.
- No automated test initiates a live PayToday charge.

## 11. Immediate implementation sequence

1. Complete the Phase 0 inventory against the live `main` branch and Supabase migration state.
2. Confirm the minimum invoice fields and numbering policy.
3. Design the additive Drizzle schema and SQL migration; review before execution.
4. Implement invoice domain functions and tests before the UI.
5. Build the admin register/create/detail/issue/download surfaces.
6. Integrate verified payment allocations and receipts.
7. Run typecheck, lint, unit tests, build/preview and end-to-end acceptance tests.
8. Open a pull request to `main`; do not merge or declare production completion until checks pass and the deployed workflow is verified.

## 12. Decisions to preserve

- Namibia Transport is a transport coordination/demand platform with independent partner drivers, not a fleet-owner system.
- Existing customer, booking, quote and payment records are reused wherever appropriate.
- PayToday remains behind the server-side `PaymentProvider` adapter.
- Money is decimal-safe; NAD is the current operating currency.
- The current business is not VAT-registered; no VAT is charged in the initial invoice implementation.
- Production safety, traceability and correctness take precedence over shipping more screens quickly.
