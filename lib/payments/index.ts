import { PayTodayPaymentProvider } from "./paytoday/provider";
import { StubPaymentProvider } from "./stub";
import { isPayTodayConfigured, selectedPaymentProvider } from "./paytoday/config";
import type { PaymentProvider } from "./types";

export * from "./types";
export { StubPaymentProvider } from "./stub";
export { PayTodayPaymentProvider } from "./paytoday/provider";
export { isPayTodayConfigured } from "./paytoday/config";

let provider: PaymentProvider | undefined;

/**
 * Single entry point for payments. PayToday (Nedbank Namibia) is the live
 * gateway; the stub remains so the app runs — and bookings still get taken —
 * on a machine with no credentials.
 *
 * Selecting PayToday is deliberate (PAYMENT_PROVIDER=paytoday) rather than
 * automatic on the keys being present, so a stray environment variable can
 * never quietly switch a site between charging and not charging.
 */
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  if (selectedPaymentProvider() === "paytoday") {
    if (!isPayTodayConfigured()) {
      throw new Error(
        "PAYMENT_PROVIDER=paytoday but the PayToday keys are missing — set PAYTODAY_SHOP_KEY, PAYTODAY_SHOP_HANDLE and PAYTODAY_PRIVATE_KEY."
      );
    }
    provider = new PayTodayPaymentProvider();
  } else {
    provider = new StubPaymentProvider();
  }

  return provider;
}

/** Test seam: forces the next getPaymentProvider() to re-read the environment. */
export function resetPaymentProvider(): void {
  provider = undefined;
}
