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
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";

export type DriverRow = Awaited<ReturnType<typeof listDrivers>>[number];

export async function listDrivers() {
  if (!isDatabaseConfigured()) return [];

  try {
    return await withDeadline("driver list", READ_DEADLINE_MS, () =>
      getDb()
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
          and(eq(vehicles.driverId, drivers.id), eq(vehicles.isActive, true)),
        )
        .leftJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
        .orderBy(asc(drivers.status), asc(drivers.fullName)),
    );
  } catch (error) {
    console.error("[dispatch] could not list drivers", error);
    return [];
  }
}

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
    const rows = await withDeadline("assignment list", READ_DEADLINE_MS, () =>
      getDb()
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
        .orderBy(desc(dispatchAssignments.assignedAt)),
    );

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
