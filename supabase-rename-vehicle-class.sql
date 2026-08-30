-- Rename the small-car class to match what it actually is.
--
-- The drawing on the site is a hatchback — a Polo Vivo, which is what most
-- small cars on Namibian roads are — and "Private Sedan" no longer describes
-- it. The class covers a hatchback or a small saloon either way.
--
-- The slug stays `private-sedan`: it is the join key to lib/vehicles.ts and to
-- every booking already taken on this class. Only the display name changes, so
-- nothing that has been sold is rewritten.
--
-- Run this once in the Supabase SQL editor. Safe to re-run.

update vehicle_classes
set
  name = 'Private Car',
  description = 'Air-conditioned hatchback or sedan for up to 3 passengers. The standard choice for couples, solo travellers and business trips.'
where slug = 'private-sedan';

select slug, name, capacity, luggage_capacity, price_multiplier
from vehicle_classes
order by sort_order;
