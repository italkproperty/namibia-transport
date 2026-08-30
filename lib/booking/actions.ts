"use server";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, payments, vehicleClasses } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { getRouteBySlug, listVehicleClasses } from "@/lib/maps";
import { getCompanyInfo } from "@/lib/company";
import {
  confirmationHtml,
  confirmationSubject,
  confirmationText,
  getMessenger,
  type ConfirmationDetails,
} from "@/lib/messaging";
import { formatNad } from "@/lib/money";
import { roundCoord } from "@/lib/maps/bounds";
import { getPaymentProvider } from "@/lib/payments";
import { INTENT_TTL_MS } from "@/lib/payments/paytoday/config";
import { defaultReturnUrl } from "@/lib/payments/paytoday/provider";
import { computeFare } from "@/lib/pricing";

import { generateBookingRef } from "./ref";
import {
  bookingFormSchema,
  type BookingActionResult,
  type BookingFormValues,
} from "./schema";
import { namibianLocalToInstant } from "./time";

/**
 * Attribution arrives from the browser, so it is untrusted text that ends up
 * in an admin table. Drop control characters and cap the length.
 */
function sanitiseSource(value: string | undefined): string | null {
  if (!value) return null;

  const cleaned = Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();

  return cleaned.length > 0 ? cleaned.slice(0, 200) : null;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Creates a booking.
 *
 * The price is re-derived here from the route and vehicle class as stored, and
 * the client's idea of the fare is never read — the form sends no price field
 * at all. The resolved figures are then snapshotted onto the booking, so a
 * later price change cannot rewrite what someone already agreed to.
 */
export async function createBooking(
  input: unknown,
): Promise<BookingActionResult> {
  const parsed = bookingFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      message: first?.message ?? "Please check the form and try again.",
    };
  }
  const values = parsed.data;

  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      message:
        "Bookings are not being accepted yet — the database is not connected. Please contact us on WhatsApp.",
    };
  }

  // Resolve the route and vehicle class server-side; both must be sellable.
  const route = await getRouteBySlug(values.routeSlug);
  if (!route || !route.isActive) {
    return { ok: false, message: "That route is not available to book." };
  }

  const classes = await listVehicleClasses();
  const vehicleClass = classes.find((c) => c.id === values.vehicleClassId);
  if (!vehicleClass) {
    return { ok: false, message: "That vehicle is not available." };
  }

  if (values.passengers > vehicleClass.capacity) {
    return {
      ok: false,
      message: `A ${vehicleClass.name} seats ${vehicleClass.capacity}. Choose a larger vehicle or reduce the passenger count.`,
    };
  }

  const scheduledAt = namibianLocalToInstant(values.date, values.time);
  if (scheduledAt.getTime() <= Date.now()) {
    return { ok: false, message: "Choose a pickup time in the future." };
  }

  const fare = computeFare(route, vehicleClass, values.passengers);
  const db = getDb();

  try {
    // Reuse the customer if we have seen this WhatsApp number before; that is
    // also what tells us whether this is a repeat booking.
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.whatsapp, values.whatsapp))
      .limit(1);

    const isRepeatCustomer = Boolean(existing);

    const customer =
      existing ??
      (
        await db
          .insert(customers)
          .values({
            fullName: values.fullName,
            whatsapp: values.whatsapp,
            email: emptyToNull(values.email),
            customerType: values.customerType,
          })
          .returning()
      )[0];

    // Vehicle class rows only exist once seeded; without one the foreign key
    // would fail with a message no traveller could act on.
    const [seededClass] = await db
      .select({ id: vehicleClasses.id })
      .from(vehicleClasses)
      .where(eq(vehicleClasses.id, vehicleClass.id))
      .limit(1);

    if (!seededClass) {
      return {
        ok: false,
        message:
          "The vehicle catalogue has not been seeded yet. Run `npm run db:seed` and try again.",
      };
    }

    const booking = await insertBookingWithUniqueRef(db, {
      routeId: route.id,
      vehicleClassId: vehicleClass.id,
      customerId: customer.id,
      pickupLabel: values.pickupLabel,
      dropoffLabel: values.dropoffLabel,
      scheduledAt,
      passengers: values.passengers,
      luggageCount: values.luggageCount,
      flightNumber: emptyToNull(values.flightNumber),
      customerPrice: fare.customerPrice,
      driverPayout: fare.driverPayout,
      contribution: fare.contribution,
      currency: fare.currency,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      acquisitionSource: sanitiseSource(values.acquisitionSource),
      isReturn: values.isReturn,
      isRepeatCustomer,
      status: "pending_payment",
      notes: emptyToNull(values.notes),
      // Rounded to ~11cm, which is well past what a dropped pin means and
      // past what any driver can act on. Storing more implies a precision the
      // input does not have.
      pickupLat: values.pickupPin ? roundCoord(values.pickupPin.lat) : null,
      pickupLng: values.pickupPin ? roundCoord(values.pickupPin.lng) : null,
      dropoffLat: values.dropoffPin ? roundCoord(values.dropoffPin.lat) : null,
      dropoffLng: values.dropoffPin ? roundCoord(values.dropoffPin.lng) : null,
    });

    // The booking is already saved, so a gateway failure must not throw it
    // away: we fall back to an unpaid booking that operations can chase,
    // rather than losing a traveller who has just filled in a form.
    let checkoutUrl: string | null = null;
    try {
      const intent = await getPaymentProvider().createPayment({
        bookingId: booking.id,
        bookingRef: booking.ref,
        amount: fare.customerPrice,
        currency: fare.currency,
        customer: {
          fullName: customer.fullName,
          email: customer.email,
          whatsapp: customer.whatsapp,
        },
        description: `${route.originLabel} to ${route.destinationLabel}`,
        returnUrl: defaultReturnUrl(booking.ref),
      });

      checkoutUrl = intent.redirectUrl;

      await db.insert(payments).values({
        bookingId: booking.id,
        provider: intent.provider,
        providerReference: intent.providerReference,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        checkoutUrl: intent.redirectUrl,
        expiresAt: intent.redirectUrl
          ? new Date(Date.now() + INTENT_TTL_MS)
          : null,
        raw: intent.raw,
      });
    } catch (error) {
      console.error(
        `[booking] payment could not be started for ${booking.ref}`,
        error,
      );
    }

    // Stubbed for now: logs the message it would send.
    // Comms are best-effort and deliberately outside the failure path. The
    // booking is already saved; a dead SMTP host or a rate-limited WhatsApp
    // API must not tell a traveller their booking failed when it did not.
    await sendConfirmations({
      customer,
      booking,
      route,
      vehicleClass,
      scheduledAt,
      fare,
      values,
      checkoutUrl,
    });

    return { ok: true, ref: booking.ref, checkoutUrl };
  } catch (error) {
    console.error("[booking] failed to create booking", error);
    return {
      ok: false,
      message:
        "Something went wrong saving your booking. Nothing was charged — please try again.",
    };
  }
}

type BookingInsert = typeof bookings.$inferInsert;

/**
 * Refs are random rather than sequential, so a collision is possible even if
 * unlikely. Retry on the unique-constraint violation instead of pre-checking,
 * which would still race.
 */
async function insertBookingWithUniqueRef(
  db: ReturnType<typeof getDb>,
  values: Omit<BookingInsert, "ref">,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [row] = await db
        .insert(bookings)
        .values({ ...values, ref: generateBookingRef() })
        .returning();
      return row;
    } catch (error) {
      const isDuplicateRef =
        error instanceof Error && /bookings_ref_key/.test(error.message);
      if (!isDuplicateRef || attempt === 4) throw error;
    }
  }
  throw new Error("Could not allocate a unique booking reference");
}

/**
 * WhatsApp first, email second — and neither can throw.
 *
 * Every failure here is logged and swallowed. The booking exists, the
 * traveller has a reference, and operations can chase a message that never
 * went out; what they cannot recover from is a traveller who was told the
 * booking failed and went somewhere else.
 */
async function sendConfirmations({
  customer,
  booking,
  route,
  vehicleClass,
  scheduledAt,
  fare,
  values,
  checkoutUrl,
}: {
  customer: { fullName: string; whatsapp: string | null; email: string | null };
  booking: { ref: string };
  route: { originLabel: string; destinationLabel: string };
  vehicleClass: { name: string };
  scheduledAt: Date;
  fare: { customerPrice: string };
  values: BookingFormValues;
  checkoutUrl: string | null;
}): Promise<void> {
  const messenger = getMessenger();
  const company = getCompanyInfo();
  const routeLabel = `${route.originLabel} to ${route.destinationLabel}`;

  const details: ConfirmationDetails = {
    ref: booking.ref,
    fullName: customer.fullName,
    routeLabel,
    scheduledAt,
    vehicleClassName: vehicleClass.name,
    passengers: values.passengers,
    total: fare.customerPrice,
    pickupLabel: values.pickupLabel,
    dropoffLabel: values.dropoffLabel,
    pickupPin: values.pickupPin ?? null,
    dropoffPin: values.dropoffPin ?? null,
    flightNumber: emptyToNull(values.flightNumber),
    notes: emptyToNull(values.notes),
    checkoutUrl,
    supportWhatsapp: company.whatsapp,
  };

  const to = {
    fullName: customer.fullName,
    whatsapp: customer.whatsapp,
    email: customer.email,
  };

  try {
    await messenger.send({
      to,
      channel: "whatsapp",
      template: "booking_received",
      variables: {
        ref: booking.ref,
        route: routeLabel,
        when: formatDateTime(scheduledAt),
        total: formatNad(fare.customerPrice),
      },
      body:
        `Thanks ${customer.fullName} — we have your booking ${booking.ref}. ` +
        `${routeLabel} on ${formatDateTime(scheduledAt)}, ` +
        `${formatNad(fare.customerPrice)} for a ${vehicleClass.name}. ` +
        (checkoutUrl
          ? `Once payment clears we will confirm your driver.`
          : `We will send payment details and confirm your driver shortly.`),
    });
  } catch (error) {
    console.error("[booking] WhatsApp confirmation failed", error);
  }

  if (!customer.email) return;

  try {
    await messenger.send({
      to,
      channel: "email",
      subject: confirmationSubject(details),
      body: confirmationText(details),
      html: confirmationHtml(details),
    });
  } catch (error) {
    console.error("[booking] email confirmation failed", error);
  }
}
