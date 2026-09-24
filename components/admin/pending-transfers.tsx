import Link from "next/link";
import { LandmarkIcon, MailIcon, MessageCircleIcon } from "lucide-react";

import { ConfirmTransferButton } from "@/components/admin/confirm-transfer";
import { whatsappLink } from "@/lib/company";
import { formatDateTime } from "@/lib/format";
import { formatNad } from "@/lib/money";
import type { PendingTransfer } from "@/lib/admin/transfer-queries";

/**
 * Money we have been told about and have not seen.
 *
 * Sits above the bookings table because it is the only thing on the page with
 * a deadline attached: a traveller who has paid and is waiting for a reply is
 * the most fragile state a booking can be in. Confirming is one press, and the
 * button says what it does — it marks the money received and confirms the
 * booking, which is a thing only a person looking at a bank statement should
 * ever do.
 */
export function PendingTransfers({
  transfers,
}: {
  transfers: PendingTransfer[];
}) {
  if (transfers.length === 0) return null;

  return (
    <section
      aria-labelledby="transfers-heading"
      className="border-warning/40 bg-warning-subtle/40 rounded-xl border p-4"
    >
      <h2
        id="transfers-heading"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <LandmarkIcon className="text-warning size-4" aria-hidden />
        Transfers to check on the statement
        <span className="text-muted-foreground font-normal">
          ({transfers.length})
        </span>
      </h2>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Each of these travellers says they have paid. Confirm only once you have
        seen the money — confirming marks the booking paid and releases it to
        dispatch.
      </p>

      <ul className="mt-3 grid gap-2">
        {transfers.map((transfer) => (
          <li
            key={transfer.bookingId}
            className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <Link
                  href={`/booking/${transfer.ref}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {transfer.ref}
                </Link>{" "}
                · {transfer.customerName}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {transfer.pickupLabel} → {transfer.dropoffLabel} ·{" "}
                {formatDateTime(transfer.scheduledAt)}
              </p>
              {transfer.declaredAt && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Said they paid {formatDateTime(new Date(transfer.declaredAt))}
                  {transfer.note ? ` — “${transfer.note}”` : ""}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="tabular text-sm font-semibold">
                {formatNad(transfer.amount)}
              </span>
              {/* Not every traveller has WhatsApp any more, so the contact
                  button follows the channel they actually gave us. A button
                  that silently does nothing is worse than an email link. */}
              {transfer.customerWhatsapp ? (
                <a
                  href={whatsappLink(
                    transfer.customerWhatsapp,
                    `Hi — about booking ${transfer.ref}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp ${transfer.customerName}`}
                  className="press focus-ring text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md"
                >
                  <MessageCircleIcon className="size-4" aria-hidden />
                </a>
              ) : transfer.customerEmail ? (
                <a
                  href={`mailto:${transfer.customerEmail}?subject=${encodeURIComponent(`About booking ${transfer.ref}`)}`}
                  aria-label={`Email ${transfer.customerName}`}
                  className="press focus-ring text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md"
                >
                  <MailIcon className="size-4" aria-hidden />
                </a>
              ) : null}
              <ConfirmTransferButton
                bookingId={transfer.bookingId}
                bookingRef={transfer.ref}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
