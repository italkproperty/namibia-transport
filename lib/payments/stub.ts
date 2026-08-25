import type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
} from "./types";

/**
 * The no-credentials fallback, and the default. Records an intent and returns
 * it as pending — no money moves, and there is no redirect to a hosted page,
 * so bookings still get taken on a machine with no PayToday keys.
 * Stripe is deliberately absent: it does not serve Namibian entities.
 */
export class StubPaymentProvider implements PaymentProvider {
  readonly name = "stub";

  private readonly intents = new Map<string, PaymentIntent>();

  async createPayment(input: PaymentIntentInput): Promise<PaymentIntent> {
    const providerReference = `stub_${input.bookingRef}_${randomSuffix()}`;

    const intent: PaymentIntent = {
      provider: this.name,
      providerReference,
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      redirectUrl: null,
      raw: {
        stub: true,
        bookingId: input.bookingId,
        bookingRef: input.bookingRef,
        description: input.description,
        createdAt: new Date().toISOString(),
      },
    };

    this.intents.set(providerReference, intent);

    console.info(
      `[payments:stub] created pending payment ${providerReference} for booking ${input.bookingRef} — ${input.currency} ${input.amount}`
    );

    return intent;
  }

  async getPayment(providerReference: string): Promise<PaymentIntent | null> {
    return this.intents.get(providerReference) ?? null;
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
