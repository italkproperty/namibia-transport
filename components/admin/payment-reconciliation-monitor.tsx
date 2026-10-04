"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { autoReconcilePayments } from "@/lib/admin/booking-actions";

/**
 * Keeps the operations board honest while it is open.
 *
 * The first pass happens after the page has rendered so payment checks cannot
 * make the bookings page itself slow. While an operator leaves the board open,
 * repeat every five minutes. The server action remains the security boundary
 * and the existing manual "Check payment" control remains the explicit fallback.
 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function PaymentReconciliationMonitor({
  bookingRefs,
}: {
  bookingRefs: string[];
}) {
  const router = useRouter();
  const running = React.useRef(false);

  React.useEffect(() => {
    const refs = bookingRefs.slice(0, 5);
    if (refs.length === 0) return;

    let cancelled = false;

    const check = async () => {
      if (running.current || cancelled) return;
      running.current = true;

      try {
        const result = await autoReconcilePayments(refs);
        if (!cancelled && result.ok && result.changed > 0) {
          router.refresh();
        }
      } catch (error) {
        console.error("[admin] automatic payment reconciliation failed", error);
      } finally {
        running.current = false;
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [bookingRefs, router]);

  return null;
}
