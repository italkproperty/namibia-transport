import "server-only";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, routes, vehicleClasses } from "@/db/schema";

/** One booking with everything the confirmation page needs to render. */
export async function getBookingByRef(ref: string) {
  if (!isDatabaseConfigured()) return null;

  try {
    const [row] = await getDb()
      .select({
        booking: bookings,
        customerName: customers.fullName,
        customerWhatsapp: customers.whatsapp,
        routeOrigin: routes.originLabel,
        routeDestination: routes.destinationLabel,
        routeSlug: routes.slug,
        vehicleClassName: vehicleClasses.name,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(routes, eq(bookings.routeId, routes.id))
      .leftJoin(vehicleClasses, eq(bookings.vehicleClassId, vehicleClasses.id))
      .where(eq(bookings.ref, ref))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error("[booking] lookup failed", error);
    return null;
  }
}

export type BookingDetail = NonNullable<
  Awaited<ReturnType<typeof getBookingByRef>>
>;
