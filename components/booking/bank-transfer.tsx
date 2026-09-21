"use client";

import * as React from "react";
import { CheckCircle2Icon, CopyIcon, LandmarkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  declareTransferAction,
  type DeclareState,
} from "@/lib/payments/transfer-actions";

/**
 * Paying by EFT, made as close to one tap as a bank transfer can be.
 *
 * The friction in a transfer is not the decision, it is the retyping: an
 * account number copied wrong bounces days later, and a missing reference
 * turns into an unidentifiable line on a statement. So every field copies with
 * one tap, and the reference is given the same weight as the amount.
 *
 * The button underneath says "I have made the transfer", not "Pay" — because
 * pressing it does not pay anything. It tells us to go looking, and the copy
 * says so rather than implying the booking is now settled.
 */
export function BankTransfer({
  bookingRef,
  lines,
  note,
  declaredAt,
  confirmed,
}: {
  bookingRef: string;
  lines: { label: string; value: string }[];
  note: string;
  declaredAt: string | null;
  confirmed: boolean;
}) {
  const [state, action, pending] = React.useActionState<DeclareState, FormData>(
    declareTransferAction,
    null,
  );
  const [copied, setCopied] = React.useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard is blocked in some in-app browsers. The value is on screen
      // and selectable, so failing silently is better than an error nobody
      // can act on.
    }
  };

  const declared = Boolean(declaredAt) || (state && "ok" in state);

  if (confirmed) {
    return (
      <section className="bg-card rounded-xl border p-5">
        <p className="text-success flex items-center gap-2 text-sm font-medium">
          <CheckCircle2Icon className="size-4" aria-hidden />
          Transfer received — your booking is confirmed.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="transfer-heading"
      className="bg-card rounded-xl border p-5"
    >
      <h2
        id="transfer-heading"
        className="flex items-center gap-2 text-base font-semibold"
      >
        <LandmarkIcon className="text-brand size-4" aria-hidden />
        Pay by bank transfer
      </h2>

      <dl className="mt-4 grid gap-1.5">
        {lines.map((line) => {
          const isReference = line.label === "Reference";
          return (
            <div
              key={line.label}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-1.5 last:border-b-0"
            >
              <dt className="text-muted-foreground text-sm">{line.label}</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    isReference
                      ? "tabular text-brand font-mono text-sm font-medium"
                      : "tabular font-mono text-sm"
                  }
                >
                  {line.value}
                </span>
                <button
                  type="button"
                  onClick={() => copy(line.label, line.value)}
                  aria-label={`Copy ${line.label.toLowerCase()}`}
                  className="press focus-ring text-muted-foreground hover:text-foreground rounded p-1"
                >
                  {copied === line.label ? (
                    <CheckCircle2Icon
                      className="text-success size-3.5"
                      aria-hidden
                    />
                  ) : (
                    <CopyIcon className="size-3.5" aria-hidden />
                  )}
                </button>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed text-pretty">
        Put <span className="text-foreground font-mono">{bookingRef}</span> in
        the reference field — it is how we match your transfer to this booking.{" "}
        {note}
      </p>

      {declared ? (
        <p className="text-success mt-4 flex items-start gap-2 text-sm leading-snug">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Thank you — we are watching for it. You will hear from us once it
            lands; there is nothing else for you to do.
          </span>
        </p>
      ) : (
        <form action={action} className="mt-4">
          <input type="hidden" name="ref" value={bookingRef} />
          <Button
            type="submit"
            disabled={pending}
            variant="outline"
            className="press h-11 w-full sm:w-auto"
          >
            {pending ? "Letting us know…" : "I have made the transfer"}
          </Button>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            This tells us to look out for it. Your booking is confirmed once we
            see the money, not when you press this.
          </p>
        </form>
      )}

      {state && "error" in state && (
        <p className="text-destructive mt-3 text-sm">{state.error}</p>
      )}
    </section>
  );
}
