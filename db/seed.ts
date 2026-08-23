import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { CATALOG_ROUTES, CATALOG_VEHICLE_CLASSES } from "../lib/catalog";
import { requireDatabaseUrl } from "./env";
import { routes, vehicleClasses } from "./schema";

/**
 * Seeds the launch catalogue from lib/catalog.ts.
 *
 * Idempotent and non-destructive: every write is an upsert keyed on the
 * natural slug, and no row is ever deleted. Safe to re-run after editing a
 * price or adding a route.
 *
 *   npm run db:seed
 */
async function main() {
  const client = postgres(requireDatabaseUrl(), { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    for (const vehicleClass of CATALOG_VEHICLE_CLASSES) {
      await db
        .insert(vehicleClasses)
        .values(vehicleClass)
        .onConflictDoUpdate({
          target: vehicleClasses.slug,
          set: {
            name: vehicleClass.name,
            description: vehicleClass.description,
            capacity: vehicleClass.capacity,
            luggageCapacity: vehicleClass.luggageCapacity,
            priceMultiplier: vehicleClass.priceMultiplier,
            sortOrder: vehicleClass.sortOrder,
            updatedAt: new Date(),
          },
        });
      console.info(`  vehicle class  ${vehicleClass.name}`);
    }

    for (const route of CATALOG_ROUTES) {
      await db
        .insert(routes)
        .values(route)
        .onConflictDoUpdate({
          target: routes.slug,
          set: {
            originLabel: route.originLabel,
            destinationLabel: route.destinationLabel,
            category: route.category,
            fixedPrice: route.fixedPrice,
            pricingUnit: route.pricingUnit ?? "per_vehicle",
            defaultDriverPayout: route.defaultDriverPayout,
            isActive: route.isActive,
            distanceKm: route.distanceKm,
            durationMin: route.durationMin,
            sortOrder: route.sortOrder,
            seoTitle: route.seoTitle,
            seoDescription: route.seoDescription,
            seoBody: route.seoBody,
            updatedAt: new Date(),
          },
        });
      console.info(
        `  route          ${route.originLabel} -> ${route.destinationLabel}` +
          `  N$${route.fixedPrice}  ${route.isActive ? "live" : "hidden"}`
      );
    }

    console.info(
      `\nSeeded ${CATALOG_VEHICLE_CLASSES.length} vehicle classes and ${CATALOG_ROUTES.length} routes.`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
