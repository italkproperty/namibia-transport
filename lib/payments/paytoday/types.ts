import type { PaymentStatus } from "@/db/schema";

/**
 * The wire shapes from PayToday's SDK, as documented in the Developer Guide
 * (§2.3) and the Payment Intent Query guide (§5).
 *
 * Everything is optional and re-validated at the edge: these are another
 * company's payloads, and a payment path should not throw on an unexpected
 * field or trust one it did not check.
 */

export type CreateIntentInput = {
  /** Major units — N$650.00 is sent as 650, not 65000. */
  amount: number;
  invoice_number: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  user_phone_number: string;
  return_url: string;
};

export type CreateIntentResponse = {
  success?: boolean;
  data?: {
    payment_url?: string;
    payment_intent_token?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type QueryIntentResponse = {
  success?: boolean;
  data?: {
    handle?: string;
    v?: string;
    intent?: {
      payment_token?: string;
      amount?: number | string;
      invoice_number?: string;
      transaction_status?: string;
      transaction_data?: {
        payment_reference?: string;
        status?: string;
        reason?: string;
        time_stamp?: string;
        [key: string]: unknown;
      } | null;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * PayToday's documented statuses are success, pending, failed and cancelled.
 * Anything we do not recognise maps to pending rather than to a terminal
 * state — an unknown string must never be read as "paid", and must never
 * close a booking that might still complete.
 */
export function mapTransactionStatus(value: unknown): PaymentStatus {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";

  switch (status) {
    case "success":
    case "successful":
    case "completed":
    case "paid":
      return "paid";
    case "failed":
    case "declined":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
}

/** Splits a single free-text name into the two fields PayToday requires. */
export function splitName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Traveller", lastName: "-" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/**
 * PayToday's sample sends a bare international number ("2648123456578"), so
 * strip the leading plus and any spacing we store for display.
 */
export function normalisePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/[^\d]/g, "");
}
