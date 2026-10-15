# NamibiaTransport charter pricing architecture

## Status

Stage 1 design, calculation foundation, route-to-cost adapter, and admin-configurable charter vehicle profiles. Persisted quote snapshots and the end-to-end charter quote UI are still pending. The additive database migration is prepared but has not been applied to production. This document does not claim production deployment.

## Design principles

1. One deterministic pricing engine for both manual and AI-assisted quotes.
2. AI extracts and clarifies trip requirements; it never determines the authoritative price.
3. Destination resolution, road routing, operating cost and commercial pricing are separate services.
4. Client-visible quote payloads must never include internal costs, fuel price, supplier cost, driver payout or margin.
5. Issued/accepted quote versions are immutable snapshots. New rates affect new calculations, not historical offers.
6. Unknown or approximate routes and unconfirmed supplier rates are visible to operators and cannot silently become firm quotes.
7. Existing airport transfer, booking, payment and dispatch flows must not regress.

## Target flow

Customer message or manual form -> validated itinerary -> resolved destinations -> road directions for every leg -> operating cost ledger -> commercial price calculation -> operator edits and approval -> immutable quote version -> customer quote -> acceptance and operational bookings.

## Cost inputs

- Vehicle: fuel type, litres/100km, non-fuel cost/km, applicable supplier or vehicle rate.
- Route: passenger kilometres, local kilometres, positioning kilometres, surface and drive duration.
- Service: driver/guide days and hours, overnight allowance, meals, accommodation and wait time.
- Third-party: park fees, permits, supplier charter rates and explicit exclusions.
- Commercial: overhead allocation, target contribution margin, payment fee, selling-price step and approval thresholds.

Kilometre categories must be mutually exclusive. An all-inclusive supplier line must suppress included component costs to prevent double-counting. Costs and selling price are distinct values; margin is calculated after percentage-based transaction fees.

## Routing

Use Mapbox Geocoding to resolve actual lodge/address coordinates and Mapbox Directions for road kilometres, duration and route geometry. Keep the existing curated road graph as an explicitly labelled fallback where coverage is adequate. Record route provider, coordinates, timestamp, route status and whether a value was manually confirmed. Do not silently replace a lodge with a distant town node or use straight-line distance for a firm price.

## Quote governance

- Draft: editable, internal only.
- Calculated: all known costs and route evidence captured; warnings visible.
- Approved/sent: immutable snapshot of itinerary, routing, cost inputs, commercial price and terms.
- Accepted: accepted version is retained and linked to operational bookings.
- Revision: creates a new version; does not mutate an already-issued version.
- Override: preserve calculated price, final price, delta, reason, actor and timestamp.
- Margin-floor exception: requires explicit reason and authorised approval.

## Privacy and security

The server recomputes all totals. Client-supplied amounts are never trusted. Server actions and route/cost endpoints recheck admin authorization. Public quote endpoints return only approved customer-facing fields. Map provider tokens remain server-side for geocoding and directions. Do not log raw customer conversation content or credentials.

## Rollout plan

1. Inventory current route, quote, booking, payment, schema and Vercel deployment paths.
2. Add destination resolution and multi-waypoint road routing with provenance and safe fallback. (Routing service implemented; itinerary-builder integration pending.)
3. Add fuel-aware, itemised costing and configurable vehicle/supplier profiles. (Pure cost engine, verified-route adapter, and admin-editable fuel/non-fuel profiles implemented; production migration must be applied before saving profiles.)
4. Add quote versions, manual price overrides, margin controls and approval history.
5. Connect AI extraction to the same structured itinerary and costing pipeline.
6. Run typecheck, all existing tests, new cost/routing tests, database migration checks, security review and Vercel Preview before release.

## Acceptance scenarios

- One-way airport transfer and its reverse retain their configured public fares.
- Multi-stop safari with overnight stays and local driving costs each kilometre once.
- Fuel cost matches driven kilometres x litres/100km / 100 x fuel price.
- Percentage-based payment fee is included in the selling-price recommendation.
- Manual override preserves the original model price and shows resulting margin.
- All-inclusive supplier rate does not double-count included fuel/accommodation.
- Unknown destination or unavailable routing provider is marked estimated and requires review.
- AI and manual intake produce the same calculation for identical itinerary inputs.
- Public quote response and customer PDF contain no internal cost/margin fields.
- Existing quote links and accepted bookings retain their original commercial snapshot.
