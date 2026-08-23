import { StubPaymentProvider } from "./stub";
import type { PaymentProvider } from "./types";

export * from "./types";
export { StubPaymentProvider } from "./stub";

let provider: PaymentProvider | undefined;

/**
 * Single entry point for payments. Swap the implementation here — and only
 * here — when DPO Pay lands; nothing in the booking flow should change.
 */
export function getPaymentProvider(): PaymentProvider {
  provider ??= new StubPaymentProvider();
  return provider;
}
