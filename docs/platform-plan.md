# Platform audit and plan — 23 November 2026

The target: a traveller, or an operator holding an enquiry, gets from question to a payable
quote in under three minutes, for any place in Namibia, without an email or a WhatsApp. This
is measured against the enquiries actually received in November, not against a wish list.

## The evidence: five real enquiries

| Enquiry | What it needed | What happened |
|---|---|---|
| Airport → Keetmanshoop, one traveller (WhatsApp) | One-way, 535 km | Priced fine; the save hung on a phone for five minutes and the operator asked for an email the form did not need |
| Swakopmund Hotel → Etango Ranch → airport, concierge (email) | Two legs, two vehicles, a guest farm beside the airport, one payment | Underquoted by about N$3,190; the builder could not hold the trip; three emails each way |
| Windhoek → Namib Desert Lodge / Sossusvlei charters (ads) | A named lodge, multi-day | The most-searched lodge resolved to a place the model could not route |
| 1,478 km charter (email) | Multi-day, fuel-costed | Fuel was understated until per-class consumption defaults were derived |
| Site down, 20 November | — | Free hosting plan exhausted; every page and payment link dead until upgraded |

## What the audit found

Measured on the code, not estimated.

**1. The fare model priced half of every trip that starts away from Windhoek. Fixed.**
`modelCost` charged for the empty run home and nothing for the empty run to the pickup; its
own comment said "the car is already there". Sossusvlei → Windhoek was N$3,850 against
N$6,700 the other way. 2,259 of 2,352 priced pairs were affected. The run to the pickup is now
costed from the driver base (Windhoek), weighted by the same per-place judgement the return
already used. Median rise 30%; no fare fell; Windhoek-origin fares did not move.

**2. Two different lists shared one name, and it broke the things built on it. Fixed.**
79 lodges and sights with approximate pins and no roads had been added to the 49-node road
model's own array. 24 real nodes, including Sossusvlei, both Etosha gates, Lüderitz and Fish
River Canyon, were wrongly flagged search-only. The admin stop picker offered places it then
refused with "no road between two consecutive stops". `PLACE_NODES` is the road model again;
`SEARCH_PLACES` is the catalogue.

**3. The place resolver deleted letters. Fixed.** A mis-escaped pattern removed every `u`,
`f` and digit from what was typed. "Sossusvlei" became "sosssvlei" and matched nothing, so
the AI assistant could not anchor the country's best-known destination.

**4. Search hid the answer. Fixed.** Typing "Etosha" returned twelve lodges in the region
called "North & Etosha" and cut both Etosha gates off the end of the list.

**5. The test gate was red and nobody could see it. Fixed.** `npm test` stops at the first
failing suite. It had been failing at the fifth of forty-five, so thirty-nine suites had not
run in a normal check for weeks. Eleven suites were red; all forty-five now pass, with the
stale assertions rewritten to say why they changed.

**6. Open decisions the code cannot make** — listed under "Yours to decide" below.

## The plan

Ordered by money at risk, then by minutes saved per enquiry.

### Phase 1 — stop losing money on a quote (done in this change)
- Empty run to the pickup in every modelled fare.
- Road model and place catalogue separated; resolver, search and stop picker corrected.
- Etango Ranch and the Swakopmund Hotel anchored; any catalogued lodge resolves to its
  nearest priced node with the straight-line gap stated, never silently.
- Test gate green end to end.

### Phase 2 — every lodge priceable, by measurement (next)
The gap between "anchored to the nearest town" and "priced to the door" is the access road.
77 catalogued places have approximate pins, and 53 more have GPS-referenced positions in
`docs/map-coordinates.json`. Nothing here should be typed from memory: a pin placed by eye
once put Sossusvlei a hundred kilometres into the Kalahari.
- A `places` table: name, verified pin, anchor node, access km and surface, verified-by, date.
- An admin screen to verify a place on a map: confirm the pin, and Mapbox Directions measures
  the access drive from the anchor. A verified place becomes priceable everywhere at once.
- The public quote prices a verified place to the door; an unverified one says so and offers
  the anchor price plus "we confirm the last stretch", instead of a dead end.
- Target: the 50 most-requested lodges verified first (Sesriem and Sossusvlei lodges, Etango,
  Namib Desert Lodge, the Etosha camps), measured from enquiry and search logs.

### Phase 3 — the traveller builds the trip themselves
The concierge enquiry is the template: two or three legs, different days, one payment.
- Multi-leg on the public `/journey` page: add a stop, add a day, one total, one checkout.
- A trip the model cannot fully price becomes a structured request that lands in admin
  pre-filled, so the operator's work is one check and one tap.
- Driver and vehicle details on the confirmation page and email once assigned, so an agent
  never has to ask for them.

### Phase 4 — operate at volume
- Driver bases as data, so a coast-based partner removes the run from Windhoek automatically.
- Observed backhaul: replace the per-place judgements with what bookings actually show.
- A margin line on every admin quote: cost, payout, contribution, and a warning below cost.
- Uptime: a paid hosting plan (done), a database plan that cannot be throttled, and an
  external check that pages someone when the site or the payment page is down.

## Yours to decide

1. **Coastal backhaul.** The model assumes a 55% chance a car at the coast finds, or already
   is, a paying fare. With today's volume that is generous. At 30%, Swakopmund → airport is
   about N$5,150 instead of N$4,550. It is one number in `lib/network/nodes.ts`.
2. **Local trips far from Windhoek.** Walvis Bay airport → Swakopmund is now N$1,900, because
   a Windhoek car has to get there. That is honest and uncompetitive. The real answer is a
   coastal partner driver, not a lower price.
3. **Published Sossusvlei fare.** Hosea Kutako → Sossusvlei is published at N$6,500 against a
   modelled N$7,300.
4. **Cancellation terms.** Emails have said 72 and 48 hours; the site says 24.
5. **Contact rule.** The public form requires a mobile number and an email for card checkout;
   CLAUDE.md said one channel is enough. The form's rule is the live one.
