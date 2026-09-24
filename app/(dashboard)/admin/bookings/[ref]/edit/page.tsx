import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/shell";
import {
  BookingEditForm,
  type EditableBooking,
} from "@/components/admin/booking-edit-form";
import { getDb, isDatabaseConfigured } from "@/db";
import { bookings } from "@/db/schema";
import { instantToNamibianLocal } from "@/lib/booking/time";
import { quoteValidity } from "@/lib/booking/validity";
import { listVehicleClasses } from "@/lib/maps";

export const metadata: Metadata = {
  title: "Edit quote",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  if (!isDatabaseConfigured()) notFound();

  const [row] = await getDb()
    .select()
    .from(bookings)
    .where(eq(bookings.ref, ref.toUpperCase()))
    .limit(1);

  if (!row) notFound();

  const classes = await listVehicleClasses();
  const validity = quoteValidity(row);

  const booking: EditableBooking = {
    id: row.id,
    ref: row.ref,
    pickupLabel: row.pickupLabel,
    dropoffLabel: row.dropoffLabel,
    scheduledAtLocal: instantToNamibianLocal(row.scheduledAt),
    passengers: row.passengers,
    luggageCount: row.luggageCount,
    vehicleClassId: row.vehicleClassId,
    customerPrice: row.customerPrice,
    driverPayout: row.driverPayout,
    notes: row.notes,
    groupRef: row.groupRef,
    expired: validity.expired ? validity.message : null,
  };

  return (
    <AdminShell active="/admin/bookings">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/admin/bookings"
            className="text-muted-foreground hover:text-foreground focus-ring inline-flex items-center gap-1.5 rounded-sm text-xs"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Bookings
          </Link>
          <h1 className="mt-2 text-xl">Correct {row.ref}</h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm text-pretty">
            {/* The point of editing rather than re-issuing: the link in the
                traveller's inbox keeps working. */}
            The reference and the link stay the same, so a traveller looking at
            the quote you already sent sees the correction rather than a dead
            page and a second email.
          </p>
        </div>

        <BookingEditForm
          booking={booking}
          vehicleClasses={classes.map((vc) => ({ id: vc.id, name: vc.name }))}
        />
      </div>
    </AdminShell>
  );
}
