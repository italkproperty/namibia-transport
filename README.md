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

## Layout

```
app/(marketing)/   public + SEO pages, incl. programmatic route pages
app/(booking)/     booking flow and confirmation
app/(dashboard)/   internal admin + dispatch at /admin/bookings
app/driver/        partner-driver app (later phase)
app/api/           route handlers and webhooks
components/ui/     shadcn/ui components
db/                Drizzle schema, migrations, seed
lib/payments/      PaymentProvider interface — stubbed, DPO Pay later
lib/messaging/     Messenger interface — stubbed, WhatsApp + Resend later
lib/maps/          route reads — database, falling back to lib/catalog.ts
lib/pricing.ts     fare maths, shared by the client preview and the server
```

External services sit behind the adapter interfaces in `lib/`. Swap an
implementation there and nothing in the booking flow changes.

## Payments

Stripe is not available to Namibian entities and must not be added. Payments run
through `StubPaymentProvider` until DPO Pay is integrated; bookings are written
with a `pending_payment` status and no money moves.
