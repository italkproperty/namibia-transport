import { SUPPORT } from "@/lib/company";

/**
 * Bank transfer, as a first-class way to pay.
 *
 * PayToday has been refusing our account at initialize() for weeks, and while
 * that is being resolved every traveller who wanted to pay by card has had no
 * way to pay at all. In Namibia an EFT is not a fallback anyway — it is how
 * most business-to-business money moves, and a lodge or a corporate account
 * will often prefer it. So this is a payment method, not a stopgap, and it
 * stays after the gateway comes back.
 *
 * The details are read from the environment rather than hard-coded, for one
 * specific reason: this repository is public. Account details in a public repo
 * are an invitation to invoice fraud — someone forks the details, sends a
 * convincing quotation, and the money goes somewhere else. Keeping them in
 * Vercel's environment means they exist in exactly one place we control.
 *
 * They are deliberately NOT `NEXT_PUBLIC_`. The block renders server-side on
 * the booking page, so the values never need to enter a browser bundle, and a
 * value that never enters the bundle cannot be scraped out of it.
 */

export type BankDetails = {
  accountName: string;
  accountNumber: string;
  branchCode: string;
  swift: string | null;
  bankName: string | null;
};

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Null until every required field is set. A half-configured block — an account
 * number with no branch code — is worse than none: the traveller tries, the
 * transfer bounces, and we look unable to take money.
 */
export function getBankDetails(): BankDetails | null {
  const accountName = env("BANK_ACCOUNT_NAME");
  const accountNumber = env("BANK_ACCOUNT_NUMBER");
  const branchCode = env("BANK_BRANCH_CODE");

  if (!accountName || !accountNumber || !branchCode) return null;

  return {
    accountName,
    accountNumber,
    branchCode,
    swift: env("BANK_SWIFT"),
    bankName: env("BANK_NAME"),
  };
}

export function isBankTransferConfigured(): boolean {
  return getBankDetails() !== null;
}

/**
 * What the traveller types into the reference field.
 *
 * It is the booking reference and nothing else. Reconciling a Namibian bank
 * statement is done by eye, and a reference that carries a name, a date or a
 * route gives the person doing it three things to read instead of one.
 */
export function transferReference(bookingRef: string): string {
  return bookingRef;
}

/**
 * The lines a traveller needs, in the order a banking app asks for them.
 * Kept here rather than in the page so the confirmation email and the booking
 * page cannot drift into quoting different account numbers.
 */
export function bankTransferLines(
  bank: BankDetails,
  bookingRef: string,
): { label: string; value: string }[] {
  const lines = [
    { label: "Account name", value: bank.accountName },
    { label: "Account number", value: bank.accountNumber },
    { label: "Branch code", value: bank.branchCode },
  ];

  if (bank.bankName)
    lines.splice(1, 0, { label: "Bank", value: bank.bankName });
  if (bank.swift)
    lines.push({ label: "SWIFT (from abroad)", value: bank.swift });

  lines.push({ label: "Reference", value: transferReference(bookingRef) });
  return lines;
}

/**
 * What we can honestly promise about timing.
 *
 * A Namibian EFT between different banks clears overnight on a working day;
 * same-bank is usually immediate. We do not promise same-day confirmation,
 * because confirming means a person has looked at the statement, and that
 * person keeps the hours in SUPPORT.
 */
export const TRANSFER_NOTE = `Transfers between Namibian banks usually clear by the next working day. We confirm by hand once it lands — coordination runs ${SUPPORT.officeHoursShort}, so a transfer made overnight is confirmed the following morning.`;
