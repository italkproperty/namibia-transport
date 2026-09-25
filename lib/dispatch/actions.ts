"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, isDatabaseConfigured } from "@/db";
import {
  bookings,
  dispatchAssignments,
  drivers,
  payments,
  vehicleClasses,
  vehicles,
} from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { getCompanyInfo } from "@/lib/company";
import { findNode } from "@/lib/network/nodes";
import {
  assignmentHtml,
  assignmentSubject,
  assignmentText,
  getMessenger,
  type AssignmentDetails,
} from "@/lib/messaging";

import { getBookingForDispatch } from "./queries";
import { describeDbError, isUniqueViolation } from "@/lib/db-error";

/**
 * Dispatch: recording who drives, and telling the traveller.
 *
 * Every action here re-checks the admin gate itself. A Server Action is a
 * public endpoint — being rendered inside a password-gated page proves nothing
 * about who is calling it, and these write to the driver roster and send mail
 * to a customer.
 */

export type DispatchResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

async function requireAdmin(): Promise<DispatchResult | null> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }
  return null;
}

/* ------------------------------------------------------------- the roster */

const driverSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the driver's name").max(120),
  whatsapp: z
    .string()
    .trim()
    .min(7, "A WhatsApp number is how we reach them")
    .max(24)
    .regex(/^\+?[\d\s()-]+$/, "Digits only, optionally starting with +"),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  licenseNumber: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
  /**
   * Where the driver lives, as a road-network slug. Checked against the
   * network rather than stored as typed — this is a Server Action, so the
   * value can be anything, and an unknown base would silently mis-place every
   * idle window on the calendar.
   */
  baseNode: z
    .string()
    .trim()
    .max(40)
    .refine((slug) => slug === "" || findNode(slug) !== null, {
      message: "That is not a place the road network knows.",
    })
    .optional()
    .or(z.literal("")),
  /** Optional, because a driver can be recorded before their car is. */
  vehicleClassId: z.string().uuid().optional().or(z.literal("")),
  make: z.string().trim().max(40).optional().or(z.literal("")),
  model: z.string().trim().max(40).optional().or(z.literal("")),
  registration: z.string().trim().max(20).optional().or(z.literal("")),
  colour: z.string().trim().max(30).optional().or(z.literal("")),
});

const empty = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export async function addDriver(
  _prev: DispatchResult | null,
  formData: FormData,
): Promise<DispatchResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = driverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }
  const values = parsed.data;

  try {
    const db = getDb();

    /**
     * One transaction for the driver and their car.
     *
     * These were two separate inserts. A registration already on file failed
     * the second one, and the driver row from the first stayed — a driver
     * recorded with no vehicle, who then cannot be assigned, sitting in the
     * list looking complete. The error message even said "the driver was not
     * saved", which was false.
     *
     * A driver and the car they arrive in is one thing an operator is
     * entering; it saves as one thing or not at all.
     */
    await db.transaction(async (tx) => {
      const [driver] = await tx
        .insert(drivers)
        .values({
          fullName: values.fullName,
          whatsapp: values.whatsapp,
          phone: empty(values.phone),
          licenseNumber: empty(values.licenseNumber),
          notes: empty(values.notes),
          baseNode: empty(values.baseNode),
          // "pending" until someone has actually checked them. Nothing on the
          // site claims a driver is vetted, and this default is why.
          status: "pending",
        })
        .returning({ id: drivers.id });

      // A vehicle only if enough of one was given to identify it on the day.
      if (
        driver &&
        values.registration &&
        values.make &&
        values.vehicleClassId
      ) {
        await tx.insert(vehicles).values({
          driverId: driver.id,
          vehicleClassId: values.vehicleClassId,
          make: values.make,
          model: empty(values.model) ?? "",
          registration: values.registration.toUpperCase(),
          colour: empty(values.colour),
        });
      }
    });

    revalidatePath("/admin/drivers");
    revalidatePath("/admin/calendar");
    return { ok: true, message: `${values.fullName} added.` };
  } catch (error) {
    console.error("[dispatch] could not add driver", error);

    /**
     * These branches existed and never fired. `String(error)` is Drizzle's
     * wrapper — "Failed query: insert into ..." — and the constraint name is
     * on the cause, so an operator adding a driver whose number was already
     * on file got "Could not save the driver." and nothing to act on. That is
     * how this was found: a real attempt, a real collision, a useless message.
     */
    if (isUniqueViolation(error, "drivers_whatsapp_key")) {
      // Name the driver who has it. "Already exists" leaves an operator
      // hunting a list; the name ends it, and usually reveals that the number
      // was put on somebody else's row by mistake.
      const [existing] = await getDb()
        .select({ fullName: drivers.fullName, status: drivers.status })
        .from(drivers)
        .where(eq(drivers.whatsapp, values.whatsapp))
        .limit(1);

      return {
        ok: false,
        message: existing
          ? `${existing.fullName} already has that WhatsApp number (${existing.status}). Edit that driver, or give this one a different number.`
          : "A driver with that WhatsApp number already exists.",
      };
    }
    if (isUniqueViolation(error, "vehicles_registration_key")) {
      return {
        ok: false,
        message: `${values.registration?.toUpperCase()} is already on file against another driver. The driver was not saved.`,
      };
    }

    return {
      ok: false,
      message: describeDbError(error, "Could not save the driver."),
    };
  }
}

export async function setDriverStatus(
  driverId: string,
  status: "pending" | "active" | "suspended" | "inactive",
): Promise<DispatchResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    await getDb()
      .update(drivers)
      .set({ status })
      .where(eq(drivers.id, driverId));
    revalidatePath("/admin/drivers");
    return { ok: true };
  } catch (error) {
    console.error("[dispatch] could not set driver status", error);
    return { ok: false, message: "Could not update that driver." };
  }
}

/* --------------------------------------------------------- the assignment */

export async function assignDriver(
  _prev: DispatchResult | null,
  formData: FormData,
): Promise<DispatchResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const bookingId = String(formData.get("bookingId") ?? "");
  const driverId = String(formData.get("driverId") ?? "");
  if (!bookingId || !driverId) {
    return { ok: false, message: "Choose a driver." };
  }

  try {
    const db = getDb();
    const booking = await getBookingForDispatch(bookingId);
    if (!booking)
      return { ok: false, message: "That booking no longer exists." };

    const [driver] = await db
      .select({
        id: drivers.id,
        fullName: drivers.fullName,
        whatsapp: drivers.whatsapp,
        phone: drivers.phone,
        status: drivers.status,
      })
      .from(drivers)
      .where(eq(drivers.id, driverId))
      .limit(1);

    if (!driver) return { ok: false, message: "That driver no longer exists." };
    if (driver.status !== "active") {
      return {
        ok: false,
        message: `${driver.fullName} is ${driver.status}, not active. Activate them first.`,
      };
    }

    const [vehicle] = await db
      .select({
        id: vehicles.id,
        make: vehicles.make,
        model: vehicles.model,
        colour: vehicles.colour,
        registration: vehicles.registration,
        className: vehicleClasses.name,
        capacity: vehicleClasses.capacity,
      })
      .from(vehicles)
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(and(eq(vehicles.driverId, driverId), eq(vehicles.isActive, true)))
      .limit(1);

    /**
     * A bigger car than was sold is a free upgrade and nobody minds. A smaller
     * one is a party that does not fit, discovered at an airport — so the
     * assignment is refused rather than warned about. Capacity is the test,
     * not the class name: what matters is whether everyone gets in.
     */
    if (vehicle && booking.bookedCapacity !== null) {
      if (vehicle.capacity < booking.bookedCapacity) {
        return {
          ok: false,
          message: `${driver.fullName} drives a ${vehicle.className} (${vehicle.capacity} seats). This booking is a ${booking.bookedClassName} for up to ${booking.bookedCapacity}. Assign a bigger vehicle.`,
        };
      }
      if (vehicle.capacity < booking.passengers) {
        return {
          ok: false,
          message: `${driver.fullName}'s ${vehicle.className} seats ${vehicle.capacity} and this trip has ${booking.passengers} passengers.`,
        };
      }
    }

    await db.insert(dispatchAssignments).values({
      bookingId,
      driverId,
      vehicleId: vehicle?.id ?? null,
      status: "accepted",
      // Snapshotted from the booking, which snapshotted it at sale. What a
      // driver is owed is fixed the moment they are put on the trip, whatever
      // the route's payout becomes later.
      payoutAmount: booking.driverPayout,
      currency: booking.currency,
    });

    await db
      .update(bookings)
      .set({ status: "assigned" })
      .where(eq(bookings.id, bookingId));

    const sent = await notifyTraveller({ booking, driver, vehicle });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin/drivers");
    revalidatePath(`/booking/${booking.ref}`);

    return {
      ok: true,
      message: sent
        ? `${driver.fullName} assigned, and ${booking.customerName} has been told.`
        : `${driver.fullName} assigned. The message did not go out — tell them by hand and check the logs.`,
    };
  } catch (error) {
    console.error("[dispatch] could not assign driver", error);
    return { ok: false, message: "Could not assign that driver." };
  }
}

/**
 * Whether money has actually landed for this booking — the payments table is
 * the record, not the booking's own status, which an assignment overwrites.
 * A trip quoted as an itinerary is paid as one transfer against the group, so
 * a leg is settled when the trip is.
 */
async function isSettled(bookingId: string): Promise<boolean> {
  const db = getDb();

  const [booking] = await db
    .select({ id: bookings.id, groupRef: bookings.groupRef })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) return false;

  const ids = booking.groupRef
    ? (
        await db
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.groupRef, booking.groupRef))
      ).map((row) => row.id)
    : [booking.id];

  const [paid] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(inArray(payments.bookingId, ids), eq(payments.status, "paid")))
    .limit(1);

  return Boolean(paid);
}

export async function unassignDriver(
  assignmentId: string,
  bookingId: string,
): Promise<DispatchResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const db = getDb();
    await db
      .update(dispatchAssignments)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(eq(dispatchAssignments.id, assignmentId));

    // Back to where it was before the assignment. Setting "confirmed" flatly
    // was the reverse of what its own comment promised: a booking assigned on
    // trust before the money arrived came back from unassigning marked paid,
    // and the only record that it was not sat in the payments table where
    // nobody on the dispatch board looks. Cancelled and completed are left
    // alone — an assignment is not what put them there.
    await db
      .update(bookings)
      .set({
        status: (await isSettled(bookingId)) ? "confirmed" : "pending_payment",
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, "assigned")));

    revalidatePath("/admin/bookings");
    return { ok: true, message: "Assignment cancelled. Nobody has been told." };
  } catch (error) {
    console.error("[dispatch] could not unassign", error);
    return { ok: false, message: "Could not cancel that assignment." };
  }
}

/**
 * Tells the traveller who is coming. Never throws: an assignment that saved is
 * worth keeping even when the message fails, and the caller says so rather
 * than pretending it went.
 */
async function notifyTraveller({
  booking,
  driver,
  vehicle,
}: {
  booking: NonNullable<Awaited<ReturnType<typeof getBookingForDispatch>>>;
  driver: { fullName: string; whatsapp: string | null; phone: string | null };
  vehicle?: {
    make: string;
    model: string;
    colour: string | null;
    registration: string;
  } | null;
}): Promise<boolean> {
  const company = getCompanyInfo();

  const details: AssignmentDetails = {
    ref: booking.ref,
    fullName: booking.customerName,
    driverName: driver.fullName,
    driverPhone: driver.phone ?? driver.whatsapp,
    vehicle: vehicle
      ? [vehicle.colour, vehicle.make, vehicle.model].filter(Boolean).join(" ")
      : null,
    registration: vehicle?.registration ?? null,
    scheduledAt: booking.scheduledAt,
    pickupLabel: booking.pickupLabel,
    dropoffLabel: booking.dropoffLabel,
    meetingNote: booking.flightNumber
      ? "They will be waiting inside the arrivals hall with your name on a board. We are watching your flight, so a delay is fine."
      : null,
    supportWhatsapp: company.whatsapp,
  };

  const messenger = getMessenger();
  const to = {
    fullName: booking.customerName,
    whatsapp: booking.customerWhatsapp,
    email: booking.customerEmail,
  };

  let delivered = false;

  try {
    const result = await messenger.send({
      to,
      channel: "whatsapp",
      template: "driver_assigned",
      variables: {
        ref: booking.ref,
        driver: driver.fullName,
        registration: vehicle?.registration ?? "",
      },
      body: assignmentText(details),
    });
    delivered ||= result.delivered;
  } catch (error) {
    console.error("[dispatch] WhatsApp assignment message failed", error);
  }

  if (booking.customerEmail) {
    try {
      const result = await messenger.send({
        to,
        channel: "email",
        subject: assignmentSubject(details),
        body: assignmentText(details),
        html: assignmentHtml(details),
      });
      delivered ||= result.delivered;
    } catch (error) {
      console.error("[dispatch] email assignment message failed", error);
    }
  }

  return delivered;
}
