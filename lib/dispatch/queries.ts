import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

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

/**
 * Reads for the dispatch side of the operation.
 *
 * The whole site promises the traveller gets a driver's name, the vehicle and
 * its registration before pickup. Until now the tables to record that existed
 * and nothing read or wrote them, so the promise rested entirely on somebody
 * remembering. These are the reads that let the product keep it.
 */

export type DriverRow = Awaited<ReturnType<typeof listDrivers>>[number];

export async function listDrivers() {
  if (!isDatabaseConfigured()) return [];

  try {
    const rows = await getDb()
      .select({
        id: drivers.id,
        fullName: drivers.fullName,
        whatsapp: drivers.whatsapp,
        phone: drivers.phone,
        status: drivers.status,
        licenseNumber: drivers.licenseNumber,
        licenseExpiresAt: drivers.licenseExpiresAt,
        notes: drivers.notes,
        createdAt: drivers.createdAt,
        vehicleId: vehicles.id,
        make: vehicles.make,
        model: vehicles.model,
        registration: vehicles.registration,
        colour: vehicles.colour,
        seats: vehicles.seats,
        vehicleClassName: vehicleClasses.name,
      })
      .from(drivers)
      .leftJoin(
        vehicles,
        and(eq(vehicles.driverId, drivers.id), eq(vehicles.isActive, true))
      )
      .leftJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .orderBy(asc(drivers.status), asc(drivers.fullName));

    return rows;
  } catch (error) {
    console.error("[dispatch] could not list drivers", error);
    return [];
  }
}

/**
 * Every booking's current assignment, keyed by booking id.
 *
 * One query rather than one per row: the dispatch board shows a page of
 * bookings at a time and an N+1 there is a slow board for whoever is trying to
 * get a car to an airport.
 */
export async function assignmentsByBooking(): Promise<
  Map<
    string,
    {
      assignmentId: string;
      status: string;
      driverName: string;
      driverWhatsapp: string | null;
      driverPhone: string | null;
      registration: string | null;
      make: string | null;
      model: string | null;
      colour: string | null;
      payoutAmount: string | null;
    }
  >
> {
  if (!isDatabaseConfigured()) return new Map();

  try {
    const rows = await getDb()
      .select({
        bookingId: dispatchAssignments.bookingId,
        assignmentId: dispatchAssignments.id,
        status: dispatchAssignments.status,
        payoutAmount: dispatchAssignments.payoutAmount,
        assignedAt: dispatchAssignments.assignedAt,
        driverName: drivers.fullName,
        driverWhatsapp: drivers.whatsapp,
        driverPhone: drivers.phone,
        registration: vehicles.registration,
        make: vehicles.make,
        model: vehicles.model,
        colour: vehicles.colour,
      })
      .from(dispatchAssignments)
      .innerJoin(drivers, eq(drivers.id, dispatchAssignments.driverId))
      .leftJoin(vehicles, eq(vehicles.id, dispatchAssignments.vehicleId))
      .orderBy(desc(dispatchAssignments.assignedAt));

    // Newest first, so the first row per booking wins and a re-assignment
    // shows the driver actually on the trip rather than the one replaced.
    const byBooking = new Map<string, ReturnType<typeof mapRow>>();
    for (const row of rows) {
      if (!byBooking.has(row.bookingId)) byBooking.set(row.bookingId, mapRow(row));
    }
    return byBooking;
  } catch (error) {
    console.error("[dispatch] could not read assignments", error);
    return new Map();
  }
}

function mapRow(row: {
  assignmentId: string;
  status: string;
  driverName: string;
  driverWhatsapp: string | null;
  driverPhone: string | null;
  registration: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  payoutAmount: string | null;
}) {
  return {
    assignmentId: row.assignmentId,
    status: row.status,
    driverName: row.driverName,
    driverWhatsapp: row.driverWhatsapp,
    driverPhone: row.driverPhone,
    registration: row.registration,
    make: row.make,
    model: row.model,
    colour: row.colour,
    payoutAmount: row.payoutAmount,
  };
}

/** Everything the assignment message needs, in one read. */
export async function getBookingForDispatch(bookingId: string) {
  if (!isDatabaseConfigured()) return null;

  const [row] = await getDb()
    .select({
      id: bookings.id,
      ref: bookings.ref,
      scheduledAt: bookings.scheduledAt,
      pickupLabel: bookings.pickupLabel,
      dropoffLabel: bookings.dropoffLabel,
      driverPayout: bookings.driverPayout,
      currency: bookings.currency,
      status: bookings.status,
      flightNumber: bookings.flightNumber,
      customerName: customers.fullName,
      customerWhatsapp: customers.whatsapp,
      customerEmail: customers.email,
      passengers: bookings.passengers,
      routeOrigin: routes.originLabel,
      routeDestination: routes.destinationLabel,
      /** What was sold, so an assignment cannot quietly shrink the car. */
      bookedClassName: vehicleClasses.name,
      bookedCapacity: vehicleClasses.capacity,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .leftJoin(routes, eq(routes.id, bookings.routeId))
    .leftJoin(vehicleClasses, eq(vehicleClasses.id, bookings.vehicleClassId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return row ?? null;
}
