import "server-only";

import { getMessenger } from "@/lib/messaging";

export type PaymentNotificationInput = {
  kind: "booking" | "charter quote";
  reference: string;
  amount: string;
  currency: string;
  customerName: string;
  customerEmail?: string | null;
  description: string;
  paidAt?: Date | null;
};

/** Send an internal alert only after PayToday status and amount are verified. */
export async function sendPaymentNotification(input: PaymentNotificationInput): Promise<void> {
  const recipient =
    process.env.PAYMENT_NOTIFICATION_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim();

  if (!recipient) {
    console.error("[payments:notification] no recipient configured; set PAYMENT_NOTIFICATION_EMAIL in Vercel", {
      reference: input.reference, kind: input.kind,
    });
    return;
  }

  const paidAt = input.paidAt ?? new Date();
  const body = [
    "A PayToday payment has been verified and recorded as paid.",
    "",
    `Type: ${input.kind}`,
    `Reference: ${input.reference}`,
    `Customer: ${input.customerName || "Not provided"}`,
    `Customer email: ${input.customerEmail || "Not provided"}`,
    `Description: ${input.description}`,
    `Amount received: ${input.currency} ${input.amount}`,
    `Recorded at: ${paidAt.toISOString()}`,
    "",
    "This alert is generated only after the server queries PayToday and verifies the payment amount.",
  ].join("\n");

  try {
    const result = await getMessenger().send({
      to: { fullName: "Namibia Transport Operations", email: recipient },
      channel: "email",
      subject: `Payment received — ${input.reference}`,
      body,
    });

    if (!result.delivered) {
      console.error("[payments:notification] email was not delivered by the configured messenger", {
        reference: input.reference, provider: result.provider, recipient,
      });
    } else {
      console.info("[payments:notification] payment alert sent", {
        reference: input.reference, provider: result.provider, messageId: result.messageId,
      });
    }
  } catch (error) {
    // Email failure must never roll back a verified payment.
    console.error("[payments:notification] failed to send payment alert", {
      reference: input.reference, error,
    });
  }
}
