import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import {
  bookings,
  customers,
  dispatchAssignments,
  drivers,
  routes,
  vehicleClasses,
  vehicles,
} from "@/db/schema";

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
        /**
         * The driver, once one is on the trip. This is what the whole site
         * promises will arrive before pickup, so the booking page shows it the
         * moment it is true rather than leaving the traveller with only the
         * message we sent — a message they may have deleted or never received.
         */
        driverId: drivers.id,
        driverName: drivers.fullName,
        driverPhone: drivers.phone,
        driverWhatsapp: drivers.whatsapp,
        vehicleMake: vehicles.make,
        vehicleModel: vehicles.model,
        vehicleColour: vehicles.colour,
        vehicleRegistration: vehicles.registration,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(routes, eq(bookings.routeId, routes.id))
      .leftJoin(vehicleClasses, eq(bookings.vehicleClassId, vehicleClasses.id))
      // A cancelled assignment must not keep showing a driver who is no
      // longer coming; newest first so a re-assignment wins.
      .leftJoin(
        dispatchAssignments,
        and(
          eq(dispatchAssignments.bookingId, bookings.id),
          ne(dispatchAssignments.status, "cancelled"),
        ),
      )
      .leftJoin(drivers, eq(drivers.id, dispatchAssignments.driverId))
      .leftJoin(vehicles, eq(vehicles.id, dispatchAssignments.vehicleId))
      .where(eq(bookings.ref, ref))
      .orderBy(desc(dispatchAssignments.assignedAt))
      .limit(1);

    if (!row) return null;

    // The photograph is looked up separately and allowed to fail.
    //
    // `drivers.photo_url` arrives by migration, and a deployment whose
    // database has not had it applied yet would otherwise fail this entire
    // query — turning a missing avatar into a booking page that 404s for a
    // traveller holding a payment link. Degrade, never collapse.
    let driverPhotoUrl: string | null = null;
    if (row.driverId) {
      try {
        const [photo] = await getDb()
          .select({ photoUrl: drivers.photoUrl })
          .from(drivers)
          .where(eq(drivers.id, row.driverId))
          .limit(1);
        driverPhotoUrl = photo?.photoUrl ?? null;
      } catch {
        // Column not migrated yet. The card falls back to initials.
      }
    }

    return { ...row, driverPhotoUrl };
  } catch (error) {
    console.error("[booking] lookup failed", error);
    return null;
  }
}

export type BookingDetail = NonNullable<
  Awaited<ReturnType<typeof getBookingByRef>>
>;
