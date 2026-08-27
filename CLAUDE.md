# CLAUDE.md — Project Context & Working Agreement

## What this is
Namibia Transport is the booking, payment and dispatch layer for ground transport across
Namibia. Three segments share one pipeline: airport transfers, intercity journeys, and
corporate accounts. Independent partner drivers fulfil the trips — we are demand,
software and coordination, not a fleet owner.

The goal is not a transfer website. It is the most capable ground-transport platform in
the country: the operator a traveller trusts before they land, the one a Windhoek company
gives its account to, and the only one that knows what Namibian ground transport actually
costs and where it moves. Judge work against that, not against "does it ship".

Live at namibiatransport.com. Airport transfers are priced per person (WDH→Windhoek is
N$650); long-distance and intercity are priced per vehicle.

## The bar
- **Finish what you start.** A feature that is half-built is worse than one not started —
  it looks like a promise. Ship whole, working units.
- **Decide, then say so.** When something is ambiguous, choose the reading a careful
  colleague would, state the assumption, and keep building. Stop only when proceeding
  either way would waste real money, break live bookings, or be hard to reverse.
- **Depth over breadth.** One surface that is genuinely excellent beats four that are
  adequate. "Silicon Valley tech company level and feel" is the standard.
- **Verify before claiming.** Run it, look at it, read the logs. "Should work" is not a
  result. If something is untested, say which part and why.

## Non-negotiable: Namibian reality
- **Payments.** Stripe and Paddle do not serve Namibian entities — never add them, or any
  subscription-billing library. The live gateway is **PayToday** (Nedbank Namibia:
  international cards, NAD settlement) behind the `PaymentProvider` adapter. The stub stays
  the default; PayToday is selected explicitly with `PAYMENT_PROVIDER=paytoday`.
- **PayToday keys are server-only.** Shop Key, Shop Handle and Private Key never take a
  `NEXT_PUBLIC_` prefix and never reach a browser bundle. Their guide §3.3 forbids keys in
  client code even though their own React sample does it; we follow the disclaimer and run
  the SDK server-side. PayToday also validates the request origin, so the site's domain
  must be registered with them.
- **PayToday has no sandbox.** Every transaction is live and charged in real currency
  (refunded in 3–5 business days; immediately for Nedbank accounts). Never wire real
  payment intents into an automated test.
- **Address data is sparse.** Never make free-text street-address autocomplete the primary
  input. A curated pick-list of known destinations, plus an optional dropped pin, plus a
  free-text landmark note. A landmark helps a Namibian driver more than a street name.
- **WhatsApp-first.** WhatsApp is the main customer channel; email is secondary. Behind the
  `Messenger` adapter — still stubbed until the Meta Cloud API lands.
- Currency is N$ with thousands separators. Namibia is **UTC+02:00 all year** — no DST
  since 2017, so the offset is fixed, never inferred from the runtime.

## Non-negotiable: credibility
This has cost more rework than anything else. The site sells trust to people who have not
landed yet, and one unearned claim discredits the rest.
- **Never state a capability we do not have.** No "24/7" until someone answers at 03:00.
  No "licensed" or "vetted" drivers until there is a document on file. No invented
  registration numbers, addresses, review counts or years in business.
- **Say what we do, not that we are trustworthy.** "Quote your reference and we can see
  your trip, your driver and your flight" beats "a real person on WhatsApp" — describing a
  floor reads as insecurity.
- Support hours, prices and inclusions are stated in exactly one place and read from there,
  so they cannot drift apart across pages.

## Non-negotiable: money and correctness
- **Pricing is always computed server-side.** The client sends no price, ever. The resolved
  fare, driver payout and contribution are snapshotted onto the booking so later price
  changes never rewrite what someone already agreed to.
- **Money is `numeric(10,2)` and moves as decimal strings.** Parse for arithmetic, format
  for display, never store a float.
- **Never trust a gateway redirect.** A `?status=` in a return URL is attacker-controlled.
  Payment status is only ever re-read from the gateway, and only marked paid when the
  amount matches what we recorded.
- Server Actions are public endpoints. Anything privileged re-checks authorisation itself.

## Tech stack
- Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (Radix)
- Supabase Postgres via Drizzle ORM · `@supabase/ssr` for auth/storage
- Vercel — every push to `main` auto-deploys. `DATABASE_URL` must be Supabase's
  **transaction pooler** (port 6543, user `postgres.<ref>`); the direct host is IPv6-only
  and unreachable from Vercel functions.
- Live behind adapters: **PayToday** (payments), **Mapbox** (route maps, Directions).
  `mapbox-gl` powers the interactive map and is ~230KB, so it is never in the
  initial bundle — the static image renders first and the library loads only
  when a map scrolls into view.
- Planned behind adapters: Meta WhatsApp Cloud API, Resend, a flight-status API.

**Adding a dependency is your call** when it is the right tool and earns its weight — say
what you added and why. **Replacing a pillar** (framework, ORM, database, host, payment
gateway) is a conversation first.

## Architecture
- ONE Next.js app, App Router route groups:
  - `app/(marketing)/` — SEO pages, programmatic route pages, corporate
  - `app/(booking)/` — booking flow and confirmation
  - `app/(dashboard)/` — internal admin and dispatch, password-gated
  - `app/driver/` — driver PWA, not yet built
  - `app/api/` — route handlers and gateway returns
- **Every external service sits behind a thin interface in `lib/`**, with a stub
  implementation, so it can be swapped or fail without touching business logic:
  `lib/payments/` (`PaymentProvider`), `lib/messaging/` (`Messenger`), `lib/maps/`
  (`RouteProvider`).
- **Degrade, never collapse.** The catalogue fallback renders routes when the database is
  unreachable; a gateway failure still saves the booking. A dependency being down must
  cost a feature, not the business.
- Prefer Server Components and Server Actions. TanStack Query only for genuinely live
  surfaces, like the dispatch board.
- Secrets live in `.env.local` (gitignored) and Vercel. `.env.example` carries placeholders
  and the reasoning. Never commit a real secret.

## Data model
Postgres via Drizzle, defined in full even where the UI uses part of it — growth should be
a migration, not a rewrite. Tables: customers, bookings, routes, vehicle_classes, vehicles,
drivers, pricing_rules, add_ons, booking_add_ons, promo_codes, payments,
dispatch_assignments, flight_status_events, corporate_enquiries, corporate_quotes,
corporate_quote_items, reviews.

Every booking records the full economics — customer price, driver payout, contribution — so
route profitability is queryable from day one. `routes` carries a slug, fixed price, SEO
fields and coordinates, powering fixed pricing, the programmatic SEO pages and route maps.
Migrations are generated with `drizzle-kit`, and applied via Supabase's SQL editor when a
local Postgres is not to hand.

## Working style
- Small, reviewable commits. Explain *why* in the message; the diff already shows what.
- `main` is always deployable and always deploying — never leave it broken.
- TypeScript strict, no `any` without a comment justifying it.
- Accessible by default: labels, focus states, keyboard nav, AA contrast measured rather
  than assumed.
- Comments explain reasoning and non-obvious constraints, not mechanics.

## Where we are
Live and working: the booking flow end to end on Supabase, server-computed fares, the
corporate quotation engine, the reviews admin, static route maps, the custom domain and
Spacemail.

In flight: PayToday returns 403 until the domain is registered with them. Next up: the
map-pin drop on the booking form, then WhatsApp via the Meta Cloud API — the messaging
adapter is stubbed and waiting.
