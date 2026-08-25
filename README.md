# Namibia Transport

Booking and dispatch for private airport transfers in Namibia. Travellers book a
fixed-price transfer online; independent licensed partner drivers fulfil the trip.

Read [`CLAUDE.md`](./CLAUDE.md) first — it holds the project constraints, the
architecture rules, and the current phase's definition of done.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
shadcn/ui · Supabase (Postgres/Auth) · Drizzle ORM · Vercel

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run db:migrate             # apply migrations to your Supabase database
npm run db:seed                # seed the launch route + vehicle class
npm run dev
```

## Environment variables

Set these in `.env.local` locally, and in **Vercel → Project → Settings →
Environment Variables** for Preview and Production.

| Variable | Where to find it | Exposed to browser |
| --- | --- | --- |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI) | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | **No — bypasses RLS** |
| `ADMIN_PASSWORD` | Any strong secret you choose — gates `/admin/bookings` | No |
| `NEXT_PUBLIC_SITE_URL` | Your deployed origin, e.g. `https://example.com` | Yes |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | E.164 support WhatsApp — unlocks WhatsApp CTAs sitewide | Yes |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Optional support phone | Yes |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Optional support email | Yes |
| `NEXT_PUBLIC_COMPANY_LOCATION` | e.g. `Windhoek, Namibia` | Yes |
| `NEXT_PUBLIC_COMPANY_REGISTRATION` | Company registration number, shown on quotes/footer | Yes |
| `QUOTE_VAT_RATE` | e.g. `0.15` once VAT-registered; empty = quotes without VAT | No |
| `PAYMENT_PROVIDER` | `paytoday` to take real money; anything else uses the stub | No |
| `PAYTODAY_SHOP_KEY` | PayToday Support / Merchant Portal | **No — secret** |
| `PAYTODAY_SHOP_HANDLE` | PayToday Support / Merchant Portal | **No — secret** |
| `PAYTODAY_PRIVATE_KEY` | PayToday Support / Merchant Portal | **No — secret** |
| `PAYTODAY_ENVIRONMENT` | `production` — PayToday has no sandbox | No |
| `PAYTODAY_FALLBACK_EMAIL` | Receipt address for bookings made without an e-mail | No |
| `PAYTODAY_SDK_PATH` | Optional path to a vendored copy of the PayToday SDK | No |
| `PAYTODAY_SDK_SHA256` | Optional digest pin for that SDK | No |

`DATABASE_URL` is read at server start, so it must be present in every
environment that builds or runs the app.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a migration from `db/schema.ts` (no database needed) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly — dev only, skips migration files |
| `npm run db:seed` | Idempotent seed of routes + vehicle classes |
| `npm run db:studio` | Drizzle Studio |
| `npm run test:payments` | Payment reconciliation tests — needs a throwaway `DATABASE_URL` |

## Layout

```
app/(marketing)/   public + SEO pages, incl. programmatic route pages
app/(booking)/     booking flow and confirmation
app/(dashboard)/   internal admin + dispatch at /admin/bookings
app/driver/        partner-driver app (later phase)
app/api/           route handlers and webhooks
components/ui/     shadcn/ui components
db/                Drizzle schema, migrations, seed
lib/payments/      PaymentProvider interface — stub + PayToday (Nedbank)
lib/messaging/     Messenger interface — stubbed, WhatsApp + Resend later
lib/maps/          route reads — database, falling back to lib/catalog.ts
lib/pricing.ts     fare maths, shared by the client preview and the server
```

External services sit behind the adapter interfaces in `lib/`. Swap an
implementation there and nothing in the booking flow changes.

## Payments

Stripe and Paddle do not serve Namibian entities and must not be added. The live
gateway is **PayToday** (Nedbank Namibia): international cards, NAD settlement.

Two adapters implement the same `PaymentProvider` interface:

| `PAYMENT_PROVIDER` | Adapter | Behaviour |
| --- | --- | --- |
| unset / `stub` | `StubPaymentProvider` | Records a pending intent, no redirect, no money moves. |
| `paytoday` | `PayTodayPaymentProvider` | Creates a real intent and redirects to PayToday's hosted page. |

The stub is the default on purpose: a missing key should never quietly turn a
live site into one that takes bookings it cannot charge.

### How the flow works

1. `createBooking()` writes the booking as `pending_payment`, then asks the
   provider for an intent. The amount is re-derived server-side from the route
   and vehicle class — the form sends no price at all.
2. The traveller is redirected to PayToday's hosted `payment_url`.
3. PayToday returns them to `/api/payments/paytoday/return?ref=NT-XXXXXX`.
4. That handler **ignores** the `status` PayToday appends to the URL and calls
   `queryPaymentIntent()` server-side for the authoritative result. Anyone can
   type `?status=success`; only the gateway's own answer is written down.
5. A payment is marked paid only when the amount PayToday reports matches the
   amount recorded. A mismatch parks the booking for a human instead.
6. The confirmation page re-reconciles on load, which covers the case PayToday
   names explicitly: the traveller pays, then closes the tab before redirecting
   back. Settled payments short-circuit without a network call.

Intents lapse after 30 minutes. An unpaid booking offers "Pay now", which
resumes a live intent or issues a fresh one.

### Credentials

`PAYTODAY_SHOP_KEY`, `PAYTODAY_SHOP_HANDLE` and `PAYTODAY_PRIVATE_KEY` are
server-only — no `NEXT_PUBLIC_` prefix, never in a browser bundle. PayToday's
guide contradicts itself here (§3.3 forbids keys in client code; the React
sample puts the private key in `REACT_APP_*`). We follow the disclaimer and run
the SDK server-side, so the browser only ever sees the hosted payment URL.

Keys come from PayToday Support: paytodaysupport@nedbank.com.na.

### The SDK

PayToday publishes no REST specification — only a browser `<script>` SDK. It is
therefore fetched and evaluated in a Node VM (`lib/payments/paytoday/sdk.ts`) and
driven from server code. Because that means executing a third-party script in
the payment path, two controls exist and **at least one should be set before
taking real money**:

- `PAYTODAY_SDK_PATH` — run a vendored copy from disk instead of the network.
- `PAYTODAY_SDK_SHA256` — pin the digest; a mismatch refuses to run.

### No sandbox

PayToday has no test environment. Every transaction is live and charged in real
currency, refunded within 3–5 business days (immediately for Nedbank accounts).
Budget a small real payment for the first end-to-end test, and never wire real
intents into an automated test run.
