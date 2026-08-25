# CLAUDE.md — Project Context & Working Agreement

## What this is
A booking + dispatch web app for airport transfers in Namibia. Travellers arriving at
Hosea Kutako International Airport (WDH) book a private transfer online; independent
licensed partner drivers fulfil the trip. We are the demand + booking + dispatch layer,
NOT a fleet owner.

Brand: Namibia Transport
Primary route to launch first: Hosea Kutako International Airport (WDH) → Windhoek CBD
Launch price for that route (fixed): N$650 per person. Airport transfers are priced
per person; long-distance/intercity transfers are priced per vehicle.

## Non-negotiable constraints (Namibia-specific — do not "helpfully" ignore these)
- **Payments:** Stripe is NOT available to Namibian entities. Do NOT add Stripe, Paddle, or
  any subscription-billing library. The live gateway is **PayToday** (Nedbank Namibia —
  international cards, NAD settlement), integrated behind the `PaymentProvider` adapter.
  It replaced the earlier DPO Pay plan. The STUB adapter remains the default; PayToday is
  selected explicitly with `PAYMENT_PROVIDER=paytoday`.
- **PayToday keys are server-only.** Shop Key, Shop Handle and Private Key never get a
  `NEXT_PUBLIC_` prefix and never reach a browser bundle. PayToday's own guide (§3.3) says
  keys must not appear in client-side code, even though its React sample does exactly that;
  we follow the disclaimer and drive the SDK server-side.
- **PayToday has no sandbox.** Every transaction is live and charged in real currency
  (refunded in 3–5 business days; immediately for Nedbank accounts). Do NOT write anything
  that fires real payment intents as part of a test run.
- **Address data in Namibia is sparse.** Do NOT build free-text street-address autocomplete
  as the primary input. Use: a curated pick-list of common destinations (hotels, suburbs,
  towns) + optional map-pin drop + a free-text "landmark/notes" field.
- **WhatsApp-first.** WhatsApp (Meta Cloud API, added later) is the main customer comms
  channel. Email is secondary. Build messaging behind a STUBBED adapter for now.
- Currency is N$ (Namibian dollar). Display as "N$" with thousands separators.

## Tech stack (do not substitute without asking)
- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS + shadcn/ui (Radix under the hood)
- Supabase (Postgres + Auth + Storage) — client via @supabase/ssr (cookie-based)
- Drizzle ORM for schema + queries
- Deployed on Vercel (already connected; every push to main auto-deploys)
- Later, behind adapters only: Mapbox (maps/routing),
  Meta WhatsApp Cloud API (messaging), Resend (email), a flight-status API.

## Architecture rules
- ONE Next.js app. Use App Router route groups:
  - `app/(marketing)/`  → SEO pages incl. programmatic route pages
  - `app/(booking)/`    → the booking flow + confirmation
  - `app/(dashboard)/`  → internal admin/dispatch (auth-gated), built later
  - `app/driver/`       → driver PWA, built later
  - `app/api/`          → route handlers, webhooks (later)
- **Adapter pattern for all external integrations.** Put each behind a thin interface in
  `lib/` so the real service can be swapped in without touching business logic:
  - `lib/payments/` → `PaymentProvider` interface, `StubPaymentProvider` (logs + returns a
    fake pending payment) and `PayTodayPaymentProvider` (live). Gateway status is only ever
    read back via `queryPaymentIntent`; the `?status=` on the return URL is never trusted.
  - `lib/messaging/` → `Messenger` interface + `StubMessenger` (console.log) now;
    WhatsApp + Resend implementations later.
  - `lib/maps/` → distance/fare helpers; fixed-route table now, Mapbox later.
- **Pricing is always computed server-side.** Never trust a price sent from the client.
  Persist the fully-resolved fare on the booking so later price changes don't alter old bookings.
- Prefer Server Components + Server Actions for reads/mutations. Add TanStack Query only for
  live/interactive surfaces (dispatch board) when we build them.
- Secrets go in `.env.local` (gitignored) and Vercel env settings. Keep an `.env.example`
  with placeholder keys. NEVER commit real secrets.

## Data model (define the FULL schema now, even if the UI only uses part of it)
Tables (Drizzle, Postgres): customers, bookings, drivers, vehicles, vehicle_classes, routes,
pricing_rules, add_ons, promo_codes, payments, dispatch_assignments, flight_status_events.
See the booking blueprint for fields. `bookings` must store: ref, customer_id, route_id,
pickup_point, dropoff_point, scheduled_at, flight_number, vehicle_class_id, status,
distance_km, duration_min, fare_total, currency, created_at. `routes` has a `slug` +
`fixed_price` + SEO fields and powers both fixed pricing and the programmatic SEO pages.

## Scope guardrail (IMPORTANT)
Build ONLY what the current task asks for. Do NOT pre-build Phase 2/3 features (live GPS
tracking, dispatch automation, AI assistant, native apps, flight monitoring) unless the
prompt explicitly says so. When in doubt, stop and ask rather than expanding scope.

## Working style
- Small, reviewable commits with clear messages. After each logical unit, summarise what
  changed and why.
- Keep the app deployable at all times — never leave main in a broken state.
- TypeScript strict; no `any` unless justified in a comment.
- Accessible components (labels, focus states, keyboard nav) by default.
- Ask before adding a new dependency that isn't in the stack above.

## Definition of done for Phase 1 (the current goal)
A visitor can: land on the WDH→Windhoek route page, click Book, fill a booking form
(date/time, passengers, flight number, name, WhatsApp), see a server-computed fixed fare,
submit, have a booking row written to Supabase, and land on a confirmation page with a
booking reference — with payment + messaging going through the STUB adapters and clearly
marked "pending". No real payment or WhatsApp yet.
