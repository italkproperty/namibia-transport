-- Publish the route catalogue, and keep the vehicle classes in step.
--
-- Generated from lib/catalog.ts rather than typed by hand, so what runs here
-- is exactly what the application falls back to when the database is
-- unreachable. Re-run it any time the catalogue changes.
--
-- It is an upsert keyed on `slug`, which is the unique natural key the app
-- looks routes up by. Keying on slug rather than on the row id means a row
-- that already exists is updated in place even if its id was never the one in
-- the catalogue, so no booking loses the route or class it points at. Rows are
-- only ever inserted or updated — nothing is deleted.
--
-- Run in the Supabase SQL editor (SQL Editor -> New query -> paste -> Run).
-- Safe to re-run.

insert into routes (
  id, slug, origin_label, destination_label, category, fixed_price, pricing_unit, currency, default_driver_payout, is_active, distance_km, duration_min, sort_order, origin_lat, origin_lng, destination_lat, destination_lng, seo_title, seo_description, seo_body
) values
  (
    '6bbb2bd7-7148-5977-952e-9cd2e38b8aaf'::uuid, 'hosea-kutako-to-windhoek', 'Hosea Kutako International Airport (WDH)', 'Windhoek CBD',
    'airport'::route_category, '650.00'::numeric,
    'per_person'::pricing_unit, 'NAD',
    '455.00'::numeric, true,
    '45.00'::numeric, 45,
    10,
    -22.4799, 17.4709, -22.5609, 17.0658,
    'Hosea Kutako Airport to Windhoek Transfer — Fixed Price Private Car', 'Book a private transfer from Hosea Kutako International Airport (WDH) to Windhoek CBD. Fixed price, meet & greet in arrivals, flight monitoring and professional Namibian drivers.', 'Hosea Kutako International Airport sits about 45 kilometres east of Windhoek, a straight 45-minute run into the city on the B6. There is no train and no reliable scheduled shuttle, so a pre-booked private car is how most visitors make the trip. Your driver tracks your flight, waits in the arrivals hall with a name board, and helps with luggage — so a delayed landing costs you nothing and there is no queue to join at midnight.'
  ),
  (
    'a96d5856-218b-5043-8de1-623b918dadff'::uuid, 'hosea-kutako-to-swakopmund', 'Hosea Kutako International Airport (WDH)', 'Swakopmund',
    'airport'::route_category, '4200.00'::numeric,
    'per_vehicle'::pricing_unit, 'NAD',
    '2940.00'::numeric, true,
    '400.00'::numeric, 270,
    20,
    -22.4799, 17.4709, -22.6792, 14.5272,
    'Hosea Kutako Airport to Swakopmund Transfer — Private Car', 'Private door-to-door transfer from Hosea Kutako International Airport (WDH) to Swakopmund. One fixed price for the car, comfort stops en route, and professional Namibian drivers.', 'Swakopmund lies roughly 400 kilometres west of the airport, about four and a half hours of open road through the Khomas Hochland and across the Namib. Landing and driving straight to the coast is a common opening move for a Namibian itinerary, and it is far easier in a private vehicle than with a hire car after a long-haul flight. The price is for the whole car, not per seat, and includes comfort stops along the way.'
  ),
  (
    '3257ef79-ee65-5257-979a-6ac229960513'::uuid, 'windhoek-to-swakopmund', 'Windhoek', 'Swakopmund',
    'intercity'::route_category, '3900.00'::numeric,
    'per_vehicle'::pricing_unit, 'NAD',
    '2730.00'::numeric, true,
    '360.00'::numeric, 240,
    30,
    -22.5609, 17.0658, -22.6792, 14.5272,
    'Windhoek to Swakopmund Private Transfer — Fixed Price', 'Private car from Windhoek to Swakopmund on the B2. Fixed price for the whole vehicle, hotel pickup, comfort stops and professional Namibian drivers.', 'The B2 from Windhoek to Swakopmund is a four-hour drive of about 360 kilometres, climbing out of the highlands and dropping through Karibib and Usakos before the coastal fog takes over near the sea. We collect you from your Windhoek hotel or guesthouse at a time you choose. Because the fare covers the vehicle rather than each seat, it works out well for couples, families and small groups alike.'
  ),
  (
    '28b2c171-faaa-5b11-9a18-0292f9fa58ac'::uuid, 'hosea-kutako-to-walvis-bay', 'Hosea Kutako International Airport (WDH)', 'Walvis Bay',
    'airport'::route_category, '4400.00'::numeric,
    'per_vehicle'::pricing_unit, 'NAD',
    '3080.00'::numeric, true,
    '430.00'::numeric, 285,
    40,
    -22.4799, 17.4709, -22.9576, 14.5053,
    'Hosea Kutako Airport to Walvis Bay Transfer — Fixed Price Private Car', 'Private transfer from Hosea Kutako International Airport (WDH) to Walvis Bay — harbour, lagoon and cruise terminal. One fixed price for the vehicle, comfort stops, professional Namibian drivers.', 'Walvis Bay is about 430 kilometres west of the airport — roughly four and three quarter hours on the B2 through Okahandja, Karibib and Usakos, then the last stretch down the coast past Swakopmund. It is a long way to drive straight off a long-haul flight, which is why most people book the car rather than collect a rental at midnight. The lagoon, the harbour and the cruise terminal are all within a few minutes of each other, so tell us which you need and the driver takes you to the door. Comfort stops are built into the drive.'
  ),
  (
    '1a05a09a-16ea-5770-91c0-d02545783b35'::uuid, 'hosea-kutako-to-sossusvlei', 'Hosea Kutako International Airport (WDH)', 'Sossusvlei',
    'airport'::route_category, '6500.00'::numeric,
    'per_vehicle'::pricing_unit, 'NAD',
    '4550.00'::numeric, true,
    '380.00'::numeric, 330,
    50,
    -22.4799, 17.4709, -24.7272, 15.3444,
    'Hosea Kutako Airport to Sossusvlei Transfer — Private 4x4', 'Private 4x4 transfer from Hosea Kutako International Airport (WDH) to the Sossusvlei lodges via the Spreetshoogte or Remhoogte pass. Fixed price for the vehicle, door-to-door at your lodge.', 'Sossusvlei is around 380 kilometres from the airport but takes about five and a half hours, because the second half is gravel — south through Rehoboth, then west over the Spreetshoogte or Remhoogte pass and down onto the Namib plain. The passes are steep and the district roads are corrugated in places, so this route runs in the SUV or 4x4 rather than the small car. Most lodges sit near the Sesriem gate; give us the lodge name when you book and the driver takes you to reception rather than to a junction. If you are flying in and driving straight out, plan to arrive in daylight — the last section is not a road to meet for the first time after dark.'
  ),
  (
    '464694f5-0780-582e-ab6b-636027c2ad7e'::uuid, 'hosea-kutako-to-etosha', 'Hosea Kutako International Airport (WDH)', 'Etosha National Park',
    'airport'::route_category, '6900.00'::numeric,
    'per_vehicle'::pricing_unit, 'NAD',
    '4830.00'::numeric, true,
    '450.00'::numeric, 330,
    60,
    -22.4799, 17.4709, -19.1833, 15.9167,
    'Hosea Kutako Airport to Etosha Transfer — Private Car, Both Gates', 'Private transfer from Hosea Kutako International Airport (WDH) to Etosha National Park, routed to the Andersson or Von Lindequist gate for your camp. Fixed price, planned around gate closing time.', 'Etosha is about 450 kilometres north of the airport, five and a half hours on the B1 through Okahandja and Otjiwarongo. Which gate you want matters: Andersson Gate in the south serves Okaukuejo and the camps around it, while Von Lindequist in the east is the one for Namutoni. They are hours apart, so tell us your camp and we route accordingly. Park gates close at sunset and are strict about it, so we plan the departure backwards from that rather than from your landing time — if your flight lands late in the day, an overnight in Windhoek or Otjiwarongo is usually the sensible call and we will say so.'
  ),
  (
    'c3ead59c-a2c0-5e2f-b3ef-7715bc1ea9c4'::uuid, 'windhoek-to-walvis-bay', 'Windhoek', 'Walvis Bay',
    'intercity'::route_category, '4100.00'::numeric,
    'per_vehicle'::pricing_unit, 'NAD',
    '2870.00'::numeric, true,
    '395.00'::numeric, 260,
    70,
    -22.5609, 17.0658, -22.9576, 14.5053,
    'Windhoek to Walvis Bay Private Transfer — Fixed Price', 'Private car from Windhoek to Walvis Bay on the B2. Fixed price for the whole vehicle, hotel pickup, comfort stops and professional Namibian drivers.', 'The B2 from Windhoek to Walvis Bay is about 395 kilometres and a little over four hours, out through Okahandja and Karibib, past the Erongo mountains and into the coastal fog that sits over the last fifty kilometres for much of the year. We collect you from your Windhoek hotel or guesthouse at a time you choose. The fare covers the whole vehicle rather than each seat, so it works out the same for one traveller or four, and we can drop at the lagoon, the waterfront or the cruise terminal.'
  ),
  (
    'c865481a-6632-5ce1-901c-79d798fc1042'::uuid, 'corporate-windhoek-city', 'Windhoek CBD', 'Greater Windhoek',
    'corporate'::route_category, '550.00'::numeric,
    'per_vehicle'::pricing_unit, 'NAD',
    '385.00'::numeric, false,
    '20.00'::numeric, 30,
    80,
    -22.5609, 17.0658, -22.5609, 17.0658,
    'Corporate Ground Transport in Windhoek', 'Account-based ground transport for Windhoek businesses: staff runs, client collections and monthly billing.', null
  )
on conflict (slug) do update set
  -- slug is the conflict target, so it is not reassigned here.
  origin_label = excluded.origin_label,
  destination_label = excluded.destination_label,
  category = excluded.category,
  fixed_price = excluded.fixed_price,
  pricing_unit = excluded.pricing_unit,
  currency = excluded.currency,
  default_driver_payout = excluded.default_driver_payout,
  is_active = excluded.is_active,
  distance_km = excluded.distance_km,
  duration_min = excluded.duration_min,
  sort_order = excluded.sort_order,
  origin_lat = excluded.origin_lat,
  origin_lng = excluded.origin_lng,
  destination_lat = excluded.destination_lat,
  destination_lng = excluded.destination_lng,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  seo_body = excluded.seo_body,
  updated_at = now();

-- Vehicle classes, including the "Private Sedan" -> "Private Car" rename that
-- the hatchback drawing and photograph made necessary. The slug is untouched:
-- it is the join key to lib/vehicles.ts and to every booking already taken.
insert into vehicle_classes (
  id, slug, name, description, capacity, luggage_capacity, price_multiplier,
  is_active, sort_order
) values
  (
    'ee436195-7c01-5604-b31d-de90e000ff07'::uuid, 'private-sedan', 'Private Car', 'Air-conditioned hatchback or sedan for up to 3 passengers. The standard choice for couples, solo travellers and business trips.',
    3, 3, '1.00'::numeric,
    true, 10
  ),
  (
    'df7a4870-673c-5036-ab29-80015c3fa66f'::uuid, 'suv-4x4', 'SUV / 4x4', 'Higher-clearance 4x4 for up to 5 passengers, with room for oversized luggage and camera gear.',
    5, 5, '1.40'::numeric,
    true, 20
  )
on conflict (slug) do update set
  -- slug is the conflict target, so it is not reassigned here.
  name = excluded.name,
  description = excluded.description,
  capacity = excluded.capacity,
  luggage_capacity = excluded.luggage_capacity,
  price_multiplier = excluded.price_multiplier,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- What you should see afterwards.
select slug, is_active, category, pricing_unit, fixed_price, sort_order
from routes order by sort_order;

select slug, name, capacity, luggage_capacity, price_multiplier
from vehicle_classes order by sort_order;

