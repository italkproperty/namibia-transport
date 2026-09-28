"use client";

import * as React from "react";

import { sendTo } from "@/lib/marketing/google-ads";
import type { ConversionEvent } from "@/lib/marketing/conversion";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Reports one conversion, once per page load.
 *
 * Nothing is fired when the label is unset: an event sent to the account id
 * alone is counted against no conversion action while looking like it worked,
 * and a guess at a label would be counted against the wrong one. Silence is
 * the honest failure here, and `missingLabels()` is how an operator finds out.
 *
 * The repeat-view problem is handled by `transaction_id` and a conversion
 * action set to count One, not by us remembering — see `conversion.ts`.
 */
export function ConversionEventTag({ event }: { event: ConversionEvent }) {
  const destination = sendTo(event.kind);

  React.useEffect(() => {
    if (!destination || typeof window.gtag !== "function") return;

    window.gtag("event", "conversion", {
      send_to: destination,
      // A string, as stored. Google wants a number here, so it is parsed at
      // the boundary rather than kept as one — the project's rule is that
      // money moves as a decimal string and is parsed only for arithmetic.
      value: Number(event.value),
      currency: event.currency,
      transaction_id: event.transactionId,
    });
  }, [destination, event.value, event.currency, event.transactionId]);

  return null;
}
