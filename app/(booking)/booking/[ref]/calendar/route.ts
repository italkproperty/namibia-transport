import { NextResponse } from "next/server";

import { getBookingByRef } from "@/lib/booking/queries";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** RFC 5545 needs UTC basic format: 20260915T063000Z. */
function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * "Add to calendar" for a confirmed booking. The ref is the capability: it is
 * random, personal and already the key to the confirmation page itself.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const detail = await getBookingByRef(decodeURIComponent(ref));

  if (!detail) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { booking } = detail;
  const start = new Date(booking.scheduledAt);
  const durationMin = booking.durationMin ?? 60;
  const end = new Date(start.getTime() + durationMin * 60 * 1000);

  const summary = `Transfer: ${booking.pickupLabel} → ${booking.dropoffLabel}`;
  const description = [
    `${SITE.name} booking ${booking.ref}`,
    booking.flightNumber ? `Flight ${booking.flightNumber}` : null,
    `Passengers: ${booking.passengers}`,
    "Your driver's name, vehicle and registration are sent on WhatsApp before pickup.",
  ]
    .filter(Boolean)
    .join("\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE.name}//Booking//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.ref}@namibia-transport`,
    `DTSTAMP:${icsStamp(new Date(booking.createdAt))}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(booking.pickupLabel)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`Transfer ${booking.ref} pickup in 2 hours`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.ref}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
