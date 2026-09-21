import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { SubmittedDetails } from "@/lib/admin/detail-queries";

/**
 * What travellers have told us since the quote went out.
 *
 * The point of asking them at all is that the answers reach dispatch, and a
 * field quietly filled in on a booking row reaches nobody. This is the same
 * shape as the pending-transfers panel above it: a short list of things that
 * arrived and need a person to look at them, newest first.
 */
export function TravellerDetails({ items }: { items: SubmittedDetails[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="details-heading"
      className="border-brand/30 bg-brand-subtle/40 rounded-xl border p-4"
    >
      <h2
        id="details-heading"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <PencilIcon className="text-brand size-4" aria-hidden />
        Details travellers have sent
        <span className="text-muted-foreground font-normal">
          ({items.length})
        </span>
      </h2>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Filled in on their own booking page after the quote went out. Pick-up
        times here have already moved the job on the calendar.
      </p>

      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item.ref} className="bg-card rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium">
                <Link
                  href={`/booking/${item.ref}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {item.ref}
                </Link>{" "}
                · {item.customerName}
              </p>
              <p className="text-muted-foreground text-xs">
                sent {formatDateTime(item.detailsUpdatedAt)}
              </p>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.pickupLabel} → {item.dropoffLabel} ·{" "}
              {formatDateTime(item.scheduledAt)}
            </p>
            <dl className="mt-2 grid gap-1 text-sm">
              {item.flightNumber && (
                <Row label="Flight">{item.flightNumber}</Row>
              )}
              {item.pickupDetail && (
                <Row label="Pick-up">{item.pickupDetail}</Row>
              )}
              {item.travellerNotes && (
                <Row label="Note">{item.travellerNotes}</Row>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground shrink-0">{label}:</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}
