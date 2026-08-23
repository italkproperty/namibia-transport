import type { PaymentStatus } from "@/db/schema";

export type PaymentIntentInput = {
  bookingId: string;
  bookingRef: string;
  /** Decimal string, e.g. "650.00". */
  amount: string;
  currency: string;
  customer: {
    fullName: string;
    email?: string | null;
    whatsapp?: string | null;
  };
  description: string;
  /** Where the gateway sends the traveller once they are done paying. */
  returnUrl?: string;
};

export type PaymentIntent = {
  /** Which adapter produced this — persisted on the payments row. */
  provider: string;
  /** Gateway-side id, used to reconcile webhooks back to a booking. */
  providerReference: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  /** Hosted payment page to redirect to. Null while payment is stubbed. */
  redirectUrl: string | null;
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  /** Creates a payment attempt for a booking. */
  createPayment(input: PaymentIntentInput): Promise<PaymentIntent>;
  /** Re-reads status from the gateway, for webhook and reconciliation paths. */
  getPayment(providerReference: string): Promise<PaymentIntent | null>;
}
