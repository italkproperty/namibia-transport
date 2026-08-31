"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, isDatabaseConfigured } from "@/db";
import {
  bookings,
  dispatchAssignments,
  drivers,
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

/**
 * Dispatch: recording who drives, and telling the traveller.
 *
 * Every action here re-checks the admin gate itself. A Server Action is a
 * public endpoint — being rendered inside a password-gated page proves nothing
 * about who is calling it, and these write to the driver roster and send mail
 * to a customer.
 */

export type DispatchResult = { ok: true; message?: string } | { ok: false; message: string };

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
  formData: FormData
): Promise<DispatchResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = driverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const values = parsed.data;

  try {
    const db = getDb();
    const [driver] = await db
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
    if (driver && values.registration && values.make && values.vehicleClassId) {
      await db.insert(vehicles).values({
        driverId: driver.id,
        vehicleClassId: values.vehicleClassId,
        make: values.make,
        model: empty(values.model) ?? "",
        registration: values.registration.toUpperCase(),
        colour: empty(values.colour),
      });
    }

    revalidatePath("/admin/drivers");
    return { ok: true, message: `${values.fullName} added.` };
  } catch (error) {
    console.error("[dispatch] could not add driver", error);
    const message = String(error);
    if (message.includes("drivers_whatsapp_key")) {
      return { ok: false, message: "A driver with that WhatsApp number already exists." };
    }
    if (message.includes("vehicles_registration_key")) {
      return { ok: false, message: "That registration is already on file." };
    }
    return { ok: false, message: "Could not save the driver." };
  }
}

export async function setDriverStatus(
  driverId: string,
  status: "pending" | "active" | "suspended" | "inactive"
): Promise<DispatchResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    await getDb().update(drivers).set({ status }).where(eq(drivers.id, driverId));
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
  formData: FormData
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
    if (!booking) return { ok: false, message: "That booking no longer exists." };

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

export async function unassignDriver(
  assignmentId: string,
  bookingId: string
): Promise<DispatchResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const db = getDb();
    await db
      .update(dispatchAssignments)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(eq(dispatchAssignments.id, assignmentId));

    // Back to confirmed, not to pending_payment: money already changed hands
    // or did not, and re-assignment must never rewrite that.
    await db
      .update(bookings)
      .set({ status: "confirmed" })
      .where(eq(bookings.id, bookingId));

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
  vehicle?: { make: string; model: string; colour: string | null; registration: string } | null;
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
