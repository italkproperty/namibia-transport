/**
 * What an invoice says, computed once and stored.
 *
 * Pure: no database, no environment. The issue module reads the rows and
 * hands them here; the tests hand fixtures here. Money moves as decimal
 * strings and is rounded to the cent at every step, never carried as a float
 * between them.
 */

export type InvoiceLine = {
  description: string;
  quantity: number;
  /** Decimal string, per unit. */
  unitAmount: string;
  /** Decimal string, quantity × unit, rounded to the cent. */
  amount: string;
};

export type InvoiceTotals = {
  subtotal: string;
  vatRate: number;
  vatAmount: string;
  total: string;
};

function cents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

function fromCents(value: number): string {
  return (value / 100).toFixed(2);
}

export function invoiceLine(description: string, unitAmount: string | number, quantity = 1): InvoiceLine {
  const unit = cents(unitAmount);
  return {
    description,
    quantity,
    unitAmount: fromCents(unit),
    amount: fromCents(unit * quantity),
  };
}

/**
 * Totals for money that has already been paid.
 *
 * The amount the traveller paid is the total, full stop — an invoice for a
 * payment cannot say a different figure from the bank statement. So where a
 * VAT rate applies, VAT is carved out of the total (inclusive), not added on
 * top the way the corporate *quotation* does before anyone has paid. At the
 * rate of zero, which is where the business stands until it registers, the
 * subtotal and the total are the same number and no VAT line is printed.
 */
export function invoiceTotals(lines: InvoiceLine[], vatRate: number): InvoiceTotals {
  const total = lines.reduce((sum, line) => sum + cents(line.amount), 0);
  const rate = Number.isFinite(vatRate) && vatRate > 0 && vatRate < 1 ? vatRate : 0;
  const subtotal = rate > 0 ? Math.round(total / (1 + rate)) : total;
  return {
    subtotal: fromCents(subtotal),
    vatRate: rate,
    vatAmount: fromCents(total - subtotal),
    total: fromCents(total),
  };
}

/** NT-INV-2026-0042: the year it was issued and a sequence that never reuses. */
export function formatInvoiceNumber(year: number, sequence: number): string {
  return `NT-INV-${year}-${String(sequence).padStart(4, "0")}`;
}

export const INVOICE_NUMBER_PATTERN = /^NT-INV-\d{4}-\d{4,}$/;
