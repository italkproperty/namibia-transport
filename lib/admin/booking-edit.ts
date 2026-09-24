"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { isSettled } from "@/lib/admin/booking-actions";
import { namibianLocalToInstant } from "@/lib/booking/time";
import { toMoneyString } from "@/lib/money";

/**
 * Correcting a quote that has already been sent.
 *
 * Until now the only way to change anything about a quote was to void it and
 * write a new one. That is a different reference, a different link, and a
 * traveller mid-conversation being told to ignore the email they are looking
 * at — for a typo in a pickup point, a date moved by a day, or a fare that was
 * renegotiated on the call. Every operator faced with that either does it and
 * looks disorganised, or quietly leaves the quote wrong.
 *
 * ## What may change, and what may not
 *
 * A quote nobody has paid against is a proposal, and a proposal can be
 * corrected. The moment money arrives it stops being a proposal: what someone
 * paid is what they agreed to, and the snapshot on the row is the record of
 * it. So `isSettled` is the gate, and it looks at the whole `group_ref` — a
 * traveller who has paid for a four-leg trip has paid for all of it, and
 * re-pricing leg two afterwards would leave the total on their page
 * disagreeing with the money in the account.
 *
 * Cancelled and completed rows are equally out of bounds. A completed trip is
 * what a driver gets paid against; a cancelled one is evidence of what was
 * withdrawn. Editing either rewrites history rather than correcting a live
 * offer, and the honest remedy is a new quote.
 *
 * ## What it deliberately does not do
 *
 * It does not touch `created_at`, so editing cannot silently extend the 45-day
 * life of a quote. That means re-pricing a lapsed quote leaves it lapsed, and
 * the form says so rather than handing back a link that is already dead.
 * Giving a re-priced quote a fresh clock needs a column to record the
 * re-pricing in, and inventing one here would put the change behind another
 * migration nobody has run.
 */

export type EditState =
  | { ok: true; ref: string }
  | { ok: false; message: string }
  | null;

function text(form: FormData, key: string, max = 300): string {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

/**
 * A money field as the database wants it, or null when it is not money.
 *
 * `parseMoney` throws on anything unparseable and returns a number, so the
 * familiar `const x = parseMoney(raw); if (!x)` reads like a guard and is not
 * one — it throws before the check, and `0` fails the check for the wrong
 * reason. An operator correcting a fare deserves a sentence about the fare,
 * not a generic failure from an outer catch.
 */
function money(raw: string): string | null {
  if (!raw) return null;
  const amount = Number(raw.replace(/[\s,]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return toMoneyString(amount);
}

export async function editBooking(
  _previous: EditState,
  formData: FormData,
): Promise<EditState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Your session has expired — sign in again." };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const id = text(formData, "bookingId", 64);
  if (!id) return { ok: false, message: "Which booking?" };

  const db = getDb();

  const [booking] = await db
    .select({
      id: bookings.id,
      ref: bookings.ref,
      groupRef: bookings.groupRef,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return { ok: false, message: "That booking no longer exists." };

  if (booking.status === "cancelled" || booking.status === "completed") {
    return {
      ok: false,
      message:
        booking.status === "completed"
          ? "That trip has run. A completed trip is what the driver is paid against, so it cannot be re-priced — write a new quote if something else is owed."
          : "That quote is cancelled. Reinstate it first, or write a new one.",
    };
  }

  if (await isSettled(db, booking)) {
    return {
      ok: false,
      message:
        "Money has arrived against this trip, so the fare is what the traveller agreed to and paid. Raise a new quote for anything extra.",
    };
  }

  /* ------------------------------------------------------------ the money */

  const price = money(text(formData, "price", 32));
  if (!price) {
    return { ok: false, message: "The fare must be an amount like 6000 or 6000.00." };
  }

  const payoutRaw = text(formData, "payout", 32);
  const payout = money(payoutRaw);
  if (payoutRaw && !payout) {
    return { ok: false, message: "The driver payout must be an amount, or left blank." };
  }
  if (payout && Number(payout) > Number(price)) {
    return {
      ok: false,
      message: "The driver payout is more than the fare — that trip loses money.",
    };
  }

  /* ------------------------------------------------------------- the trip */

  const pickupLabel = text(formData, "pickupLabel", 200);
  const dropoffLabel = text(formData, "dropoffLabel", 200);
  if (!pickupLabel || !dropoffLabel) {
    return { ok: false, message: "Both ends of the trip are needed." };
  }

  const [datePart, timePart] = text(formData, "scheduledAt", 32).split("T");
  let scheduledAt: Date;
  try {
    scheduledAt = namibianLocalToInstant(datePart ?? "", timePart ?? "");
  } catch {
    return { ok: false, message: "Give the pickup date and time." };
  }

  const passengers = Math.max(1, Math.round(Number(text(formData, "passengers", 8)) || 1));
  const luggageCount = Math.max(
    0,
    Math.round(Number(text(formData, "luggageCount", 8)) || 0),
  );
  const vehicleClassId = text(formData, "vehicleClassId", 64) || null;
  const notes = text(formData, "notes", 600) || null;

  try {
    await db
      .update(bookings)
      .set({
        pickupLabel,
        dropoffLabel,
        scheduledAt,
        passengers,
        luggageCount,
        vehicleClassId,
        customerPrice: price,
        // Blank means "use the usual split" is NOT applied here: an edit that
        // silently re-derived the payout would quietly change what a driver is
        // owed on a trip an operator only meant to move by an hour. Left blank,
        // the payout stays exactly as it was.
        ...(payout ? { driverPayout: payout } : {}),
        notes,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    // Contribution is derived, never typed: it has to reconcile with whatever
    // the payout ended up being, including the case above where it was left
    // untouched. Read back rather than assumed.
    const [current] = await db
      .select({
        price: bookings.customerPrice,
        payout: bookings.driverPayout,
      })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);

    if (current) {
      const contribution = (
        Number(current.price) - Number(current.payout)
      ).toFixed(2);
      if (Number(contribution) < 0) {
        return {
          ok: false,
          message:
            "That fare is below the driver payout already recorded. Set the payout too, or raise the fare.",
        };
      }
      await db
        .update(bookings)
        .set({ contribution })
        .where(eq(bookings.id, booking.id));
    }
  } catch (error) {
    console.error("[admin] booking edit failed", error);
    return { ok: false, message: "The database refused the change." };
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/booking/${booking.ref}`);
  if (booking.groupRef) revalidatePath(`/quote/${booking.groupRef}`);

  return { ok: true, ref: booking.ref };
}
