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

Live at namibiatransport.com. Every private transfer is priced per vehicle (WDH→Windhoek
is N$650 for the whole car); passenger count and luggage select the vehicle class, never
multiply the fare. Per-person pricing returns only with a genuine scheduled shared
shuttle, which does not exist yet.

## The bar
- **The money path outranks everything.** A traveller must be able to get a price, book,
  pay, and find their booking again. Work that does not serve that comes after work that
  does — and a new surface while the money path is broken is the wrong trade, however
  good the surface. This is the rule most often honoured in the wrong direction.
- **Finish what you start.** A feature that is half-built is worse than one not started —
  it looks like a promise. Ship whole, working units.
- **Decide, then say so.** When something is ambiguous, choose the reading a careful
  colleague would, state the assumption, and keep building. Stop only when proceeding
  either way would waste real money, break live bookings, or be hard to reverse.
- **Verify before claiming.** Run it, look at it, read the logs, look at the rendered
  page. "Should work" is not a result. If something is untested, say which part and why.
  A suite that passes against a schema production does not have has verified nothing.
  Green locally and 404 in production is the shape failure takes here, so the last step
  is loading the page.
- **Craft is measured, not asserted.** Contrast ratios computed, not eyeballed. Layouts
  checked at 360px. Figures traced to the function that produced them. "Looks
  professional" is not a standard; "a reader can check this and we survive the check" is.

## Non-negotiable: money and correctness
- **Pricing is always computed server-side.** The client sends no price, ever. The resolved
  fare, driver payout and contribution are snapshotted onto the booking so later price
  changes never rewrite what someone already agreed to.
- **Money is `numeric(10,2)` and moves as decimal strings.** Parse for arithmetic, format
  for display, never store a float.
- **Never trust a gateway redirect.** A `?status=` in a return URL is attacker-controlled.
  Payment status is only ever re-read from the gateway, and only marked paid when the
  amount matches what we recorded.
- **A trip is paid as a trip.** An itinerary is one agreed figure stored as one booking per
  driving job. Anything that records or confirms payment resolves the whole `group_ref`,
  never the leg whose reference happens to be on the transfer.
- **Only a human marks money received.** A traveller can declare a transfer; only an
  operator behind the admin gate can confirm one. Nothing a traveller clicks may ever
  set a booking to paid.
- **Quotes expire.** An unpaid booking at a public URL is a live price. It dies 45 days
  after it was struck, or when its travel date passes. Enforced server-side, not by
  hiding a button.
- Server Actions are public endpoints. Anything privileged re-checks authorisation itself,
  and every export in a `"use server"` file is a public endpoint whether or not a page
  calls it.

## Non-negotiable: schema and code ship together
This is the rule the project learned the hard way, and it is the one most likely to be
broken again, because nothing enforces it automatically.

Code deploys on `git push`. Schema deploys when a human pastes SQL into Supabase. Those
are two different clocks, and when they drift production breaks in a way that looks like
nothing: the query throws, the catch swallows it, and a booking page returns 404 while
the build is green and every test passes.

- **"`main` is deployable" means it works against the real database**, not that it
  compiles. A commit that adds a column is not done until the column exists in production.
- **A change needing SQL is not finished when it is merged.** It is finished when the
  migration has been run and the affected page has been loaded and seen to work.
- **Degrade loudly, not silently.** A `catch` that turns a missing column into a 404 hides
  exactly the failure an operator needs to see. Log what actually broke, and where a page
  can say "this needs a migration", let it.

**There is one migration file: `db/manual/RUN-ME.sql`.** It is cumulative, idempotent and
wrapped in a single transaction, so pasting the whole thing is always correct whatever
state the database is in. Add new changes to the bottom of it rather than starting
another file. **Always paste the SQL itself into the reply**, never a file path: the
person running it is in the Supabase SQL editor, not in the repository.

## Non-negotiable: credibility
This has cost more rework than anything else. The site sells trust to people who have not
landed yet, and one unearned claim discredits the rest.
- **Never state a capability we do not have.** No "24/7" until someone answers at 03:00.
  No "licensed" or "vetted" drivers until there is a document on file. No invented
  registration numbers, addresses, review counts or years in business.
- **A claim reworded is still the claim.** "Reachable whatever the hour" is "24/7" with
  the number filed off. Test the sentence against what happens at 03:00, not against
  whether it uses the forbidden words.
- **Say what we do, not that we are trustworthy.** "Quote your reference and we can see
  your trip, your driver and your flight" beats "a real person on WhatsApp" — describing a
  floor reads as insecurity.
- Support hours, prices, inclusions **and payment timing** are stated in exactly one place
  and read from there, so they cannot drift apart across pages. Payment timing was the
  gap: seven surfaces each phrased it differently, none of them said payment is what
  confirms the vehicle, and a traveller quoted our own page back at us to argue they
  should not have to pay in advance. It now lives in `lib/booking/payment-policy.ts` and
  `tests/payment-policy.test.ts` holds the retired sentences out of the source. The same
  happened with the availability promise: "Reachable throughout your journey, whatever the
  hour" was 24/7 reworded, and it survived a rule written against it because three of four
  surfaces typed the sentence instead of reading `SUPPORT`. `tests/support-claims.test.ts`
  now bans the phrasings across every page and component, not the digits.

## Non-negotiable: Namibian reality
- **Payments.** Stripe and Paddle do not serve Namibian entities — never add them, or any
  subscription-billing library. **PayToday is not a settled choice.** It has returned 403
  at `initialize()` since 27 August 2026 — `{"status":"unauthorized","error":"Authorization
  error:"}` with the reason blank after the colon. PayToday say their side is correct, and
  that is probably true *and* the 403 real: the refusal echoes our shop handle back, so
  they know who we are and are refusing anyway. The header theory is now dead, with
  evidence: the probe at `/admin/paytoday` ran against live credentials on 23 September
  and every variant was refused identically — no Origin, apex, www, browser User-Agent.
  We invented that `Origin` header, and it turned out to be neither the cause nor the
  cure. So the 403 does not depend on the shape of our request, `PAYTODAY_HEADER_VARIANT`
  stays unset, and re-running the probe or inventing a sixth variant is not progress —
  the open question is theirs and is with their support desk. Until it clears, bank
  transfer is the only way anyone can pay us, and evaluating an alternative gateway is
  legitimate work, not disloyalty to a decision. Whatever is chosen sits behind the
  `PaymentProvider` adapter; the stub stays the default.
- **PayToday keys are server-only.** Shop Key, Shop Handle and Private Key never take a
  `NEXT_PUBLIC_` prefix and never reach a browser bundle. Their guide §3.3 forbids keys in
  client code even though their own React sample does it; we follow the disclaimer and run
  the SDK server-side. Nothing in their guide documents an origin or domain check — that
  was a guess from an earlier session, and it is not a documented requirement.
- **PayToday has no sandbox.** Every transaction is live and charged in real currency
  (refunded in 3–5 business days; immediately for Nedbank accounts). Never wire real
  payment intents into an automated test.
- **Currency.** NAD is the amount owed, always, because we bank in it. The Namibian dollar
  is pegged at par to the rand, so a ZAR figure is exact and needs no hedging. Every other
  currency is an indicative conversion shown beside the fare, dated, rounded, and never
  instead of it. A traveller who cannot tell whether N$6,000 is fifty dollars or five
  hundred is a lost booking, so the conversion belongs wherever a price is shown — above
  all before they decide, not only on the confirmation page. Every fare renders through
  `<Fare>`, so a conversion cannot exist on one page and not another, and the NAD figure
  is server-rendered so the static pages stay static. Rates are operator-set
  (`USD_RATE`, `EUR_RATE`, `GBP_RATE`, `FX_RATE_AS_AT`), each bounded to its own
  plausible band, and baked in at build — so a rate change lands on the next build
  rather than instantly, which is why it is dated on screen.
- **WhatsApp is preferred, never required.** It is how dispatch and driver coordination
  actually work, and it is the best channel we have. It is not universal among inbound
  travellers, so it must never be the thing that blocks a booking: require *a* contact
  channel, ask for WhatsApp first, accept email instead. An operating truth is not an
  acquisition rule.
- **Address data is sparse.** Never make free-text street-address autocomplete the primary
  input. A curated pick-list of known destinations, plus an optional dropped pin, plus a
  free-text landmark note. A landmark helps a Namibian driver more than a street name.
- Currency is N$ with thousands separators. Namibia is **UTC+02:00 all year** — no DST
  since 2017, so the offset is fixed, never inferred from the runtime.

## Tech stack
- Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (Radix)
- Supabase Postgres via Drizzle ORM · `@supabase/ssr` for auth/storage
- Vercel — every push to `main` auto-deploys. `DATABASE_URL` must be Supabase's
  **transaction pooler** (port 6543, user `postgres.<ref>`); the direct host is IPv6-only
  and unreachable from Vercel functions. One connection pool per instance, cached on
  `globalThis` in production as well as development — the usual Next.js idiom is written
  the other way round and exhausts the pooler.
- Live behind adapters: **Mapbox** (route maps, Directions). `mapbox-gl` is ~230KB and is
  never in the initial bundle — the static image renders first and the library loads only
  when a map scrolls into view.
- Planned behind adapters: a working card gateway, Meta WhatsApp Cloud API, Resend, a
  flight-status API.
- `scripts/cutout.py` lifts a vehicle photograph off its studio backdrop. Run by hand when
  a photograph arrives; needs `pillow numpy scipy`, which are deliberately not project
  dependencies.

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
- A route group needs its own `layout.tsx` to be a boundary Next will render `not-found`
  or `error` from. Without one, `notFound()` falls past the group's file *and* the root's,
  to Next's bare default.
- **Every external service sits behind a thin interface in `lib/`**, with a stub
  implementation, so it can be swapped or fail without touching business logic:
  `lib/payments/` (`PaymentProvider`), `lib/messaging/` (`Messenger`), `lib/maps/`
  (`RouteProvider`).
- **Degrade, never collapse.** The catalogue fallback renders routes when the database is
  unreachable; a gateway failure still saves the booking. A dependency being down must
  cost a feature, not the business.
- Prefer Server Components and Server Actions. TanStack Query only for genuinely live
  surfaces, like the dispatch board.
- **Colour lives in `app/globals.css`.** Components use the tokens and never a hex.
  The four surfaces CSS cannot reach — Mapbox overlays, HTML email, `next/og` images,
  favicons — read `lib/brand-colors.ts`, which holds the same values as literals.
  Those two files are the only place a colour is written down.
- Secrets live in `.env.local` (gitignored) and Vercel. `.env.example` carries placeholders
  and the reasoning. This repository is public: anything that would invite invoice fraud
  or drain an account is server-only and never takes `NEXT_PUBLIC_`.

## Data model
Postgres via Drizzle, defined in full even where the UI uses part of it — growth should be
a migration, not a rewrite. Tables: customers, bookings, routes, vehicle_classes, vehicles,
drivers, pricing_rules, add_ons, booking_add_ons, promo_codes, payments,
dispatch_assignments, flight_status_events, corporate_enquiries, corporate_quotes,
corporate_quote_items, reviews.

Every booking records the full economics — customer price, driver payout, contribution — so
route profitability is queryable from day one. `routes` carries a slug, fixed price, SEO
fields and coordinates, powering fixed pricing, the programmatic SEO pages and route maps.

A booking's state is never inferred from what a screen last did. Whether money arrived is
read from the `payments` table, because a booking's own status is overwritten by
assignment and cancellation and cannot be trusted to remember.

## The road model
49 places and 62 road segments, so any of 2,352 ordered pairs can be priced from cost
rather than a price list. It is the moat, and most of the platform derives from it: the
`/journey` quote surface, the dispatch calendar and its marginal-offer engine, the
self-drive planner, park-gate feasibility from sunrise/sunset, rain-season closures,
160 leg pages at `/drive/<a>-to-<b>`, and 24 destination pages at `/destinations/<place>`.

A leg page answers a pair; a destination page answers "I am going to Sossusvlei, how do
I get there and what does it cost", which is the question a traveller actually has before
they have a pair. Both are generated, neither describes anybody's lodge — we can state
what it takes to reach a place, not whether the rooms are nice — and
`tests/destinations.test.ts` enforces that against the page source rather than trusting
it.

Two rules protect it. A figure shown to a traveller is produced by the model, not typed
beside it — which is why the homepage hero draws the network itself from `PLACE_NODES`
and `ROAD_EDGES` and cannot drift from the thing that prices the trips. And a judgement
is written down as a judgement: `LEG_DESTINATIONS` is a hand-kept list because dressing
it up as a derived score would encode a confidence the arithmetic does not support.

Page-set filters in `lib/network/legs.ts` exist to stop two of *our own* pages competing
for one query — that is cannibalisation, not caution about rivals. Nothing here avoids
competing with other operators; the whole model exists to beat them on 2,352 routes they
price off a list.

## Working style
- Small, reviewable commits. Explain *why* in the message; the diff already shows what.
- TypeScript strict, no `any` without a comment justifying it.
- Accessible by default: labels, focus states, keyboard nav, AA contrast measured rather
  than assumed.
- Comments explain reasoning and non-obvious constraints, not mechanics. When a fix cost
  three attempts, the two that failed belong in the comment — they are why the third
  looks strange.
- `npm test` runs every suite; the few needing a real Postgres skip themselves without
  `DATABASE_URL`. A guarantee about rows is tested against rows, not against a return
  value.
- **Do not ship a check that can pass a broken result.** If a quality heuristic cannot
  distinguish good from bad, say so and tell a human where to look instead. A green light
  on a ruined output is worse than no light.

## Where we are
*Keep this short and current. Three questions only: what works, what is broken, what is
next. The archaeology belongs in git, not here.*

**Works.** A booking needs one contact channel — WhatsApp or email — not a WhatsApp
number, and two travellers may share one. Where bookings come from, on `/admin/bookings` — `acquisition_source` folded
into channels by `lib/admin/channels.ts`, with the share we genuinely know stated rather
than a clean chart drawn over the gaps. Vercel Analytics is wired into the root layout.
Payment confirms the vehicle; booking holds the fare. Those are different
promises and the site says so in one voice, from one file.
Server-computed per-vehicle fares across 2,352 pairs. The road model and
everything derived from it. The admin quote engine, including multi-leg itineraries priced
as trips. Bank transfer, with confirmation gated behind the admin password. Dispatch,
the fleet calendar, corporate quotations, the reviews admin. 160 leg pages at `/drive`,
24 destination pages at `/destinations`, 11 guides and `/methodology`. Fares in the
reader's own currency on every surface that shows one. Twenty-five test suites, 946 checks.

**Broken, in order of cost.**
1. `db/manual/RUN-ME.sql` has a new block at the bottom (24 September) that has not been
   run against production: `customers.whatsapp` is still NOT NULL and uniquely indexed
   there, so the code now accepts an email-only booking that the database will refuse.
   The September 6–22 blocks were run on 24 September; `/booking/REF` should render, but
   that has not yet been confirmed against the live page.
2. No working card gateway. PayToday has 403'd for a month; bank transfer is the only
   channel. The header probe ran in production on 23 September and **every variant was
   refused identically** — no Origin, apex, www, browser User-Agent. That retires the
   header theory: the 403 does not depend on anything in the shape of our request, so
   nothing on our side is left to change and `PAYTODAY_HEADER_VARIANT` stays unset. It is
   now their question, and it is with them: the evidence went to
   `PayTodaySupport@nedbank.com.na` asking what check fails in their logs, what
   "Authorization error:" with an empty reason means, and whether API access is
   provisioned separately from the portal and plugin. Do not re-litigate the headers.
3. `MAIL_FROM` in Vercel is missing its angle brackets, so Spacemail rejected every
   confirmation email with `553 Sender address rejected`. The code now repairs a malformed
   value at runtime, but the variable is still wrong.
4. `GATE_RULES` covers Etosha twice, Waterberg and Fish River — but not Sossusvlei, which
   is the most gate-critical destination in the country. Its page carries no gate warning
   because we have no coordinates for the Sesriem gate, and guessing them would put a
   made-up number behind a real-looking deadline.

**Human-only.** Running the SQL. Enabling Web Analytics in the Vercel project settings —
the code is deployed but the beacon 404s until the dashboard toggle is on. Verifying
namibiatransport.com in Google Search Console, which is the only thing that will ever
answer "which queries found us". Fixing `MAIL_FROM`. The PayToday domain registration.
Rotating the database password and PayToday keys exposed in chat in an earlier session —
still unconfirmed, and a leaked credential is either rotated or it is live.

**Next.** Whatever unblocks the money path, in the order above.
