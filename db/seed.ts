import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireDatabaseUrl } from "./env";
import { routes, vehicleClasses } from "./schema";

/**
 * Idempotent seed for the launch catalogue. Safe to re-run: every insert is an
 * upsert keyed on the natural slug, so no rows are ever deleted.
 *
 *   npm run db:seed
 */
async function main() {
  const client = postgres(requireDatabaseUrl(), { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    const [sedan] = await db
      .insert(vehicleClasses)
      .values({
        slug: "private-sedan",
        name: "Private Sedan",
        description:
          "Air-conditioned sedan for up to 3 passengers, with meet & greet at arrivals.",
        capacityPassengers: 3,
        capacityLuggage: 3,
        sortOrder: 10,
      })
      .onConflictDoUpdate({
        target: vehicleClasses.slug,
        set: {
          name: "Private Sedan",
          capacityPassengers: 3,
          capacityLuggage: 3,
          updatedAt: new Date(),
        },
      })
      .returning();

    const [route] = await db
      .insert(routes)
      .values({
        slug: "hosea-kutako-to-windhoek",
        originName: "Hosea Kutako International Airport",
        originCode: "WDH",
        destinationName: "Windhoek CBD",
        distanceKm: "45.00",
        durationMin: 45,
        fixedPrice: "650.00",
        currency: "NAD",
        sortOrder: 10,
        seoTitle:
          "Hosea Kutako Airport to Windhoek Transfer — Fixed Price Private Car",
        seoDescription:
          "Book a private airport transfer from Hosea Kutako International Airport (WDH) to Windhoek CBD. Fixed price, meet & greet, flight monitoring and licensed local drivers.",
        heroHeadline: "Airport transfers from Hosea Kutako to Windhoek",
        heroSubheadline:
          "A private car waiting when you land. One fixed price, no meter, no surprises.",
      })
      .onConflictDoUpdate({
        target: routes.slug,
        set: {
          fixedPrice: "650.00",
          distanceKm: "45.00",
          durationMin: 45,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.info(`Seeded vehicle class: ${sedan.name} (${sedan.slug})`);
    console.info(
      `Seeded route: ${route.originName} -> ${route.destinationName} (${route.slug}) at N$${route.fixedPrice}`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
