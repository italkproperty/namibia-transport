import "server-only";

import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getMessenger } from "@/lib/messaging";

type PaidInvoiceInput = {
  paymentType: "booking" | "charter_quote";
  paymentId: string;
  reference: string;
  customerName: string;
  customerEmail?: string | null;
  description: string;
  amount: string;
  currency: string;
  paidAt?: Date | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

/**
 * Creates one immutable, non-VAT invoice per verified paid payment and emails
 * a private invoice link. The payment gateway must already have been queried
 * server-side before this function is called.
 */
export async function issuePaidInvoice(input: PaidInvoiceInput): Promise<void> {
  const supabase = createServiceRoleClient();
  const token = randomBytes(32).toString("hex");
  const invoiceNumber = `NTI-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const paidAt = input.paidAt ?? new Date();

  // Unique payment constraint makes repeated payment-return requests idempotent.
  const { data: existing, error: lookupError } = await supabase
    .from("payment_invoices")
    .select("invoice_number, public_token, emailed_at")
    .eq("payment_type", input.paymentType)
    .eq("payment_id", input.paymentId)
    .maybeSingle();

  if (lookupError) {
    console.error("[invoices] invoice lookup failed", { reference: input.reference, error: lookupError.message });
    return;
  }

  let invoice = existing;
  if (!invoice) {
    const { data, error } = await supabase.from("payment_invoices").insert({
      invoice_number: invoiceNumber,
      public_token: token,
      payment_type: input.paymentType,
      payment_id: input.paymentId,
      booking_reference: input.reference,
      customer_name: input.customerName || "Customer",
      customer_email: input.customerEmail.trim(),
      description: input.description,
      currency: input.currency,
      amount: input.amount,
      vat_rate: "0",
      vat_amount: "0.00",
      total: input.amount,
      payment_status: "paid",
      paid_at: paidAt.toISOString(),
    }).select("invoice_number, public_token, emailed_at").single();

    if (error || !data) {
      // Another concurrent request may have won the unique insert race.
      const { data: raced } = await supabase.from("payment_invoices")
        .select("invoice_number, public_token, emailed_at")
        .eq("payment_type", input.paymentType).eq("payment_id", input.paymentId).maybeSingle();
      if (!raced) {
        console.error("[invoices] invoice insert failed", { reference: input.reference, error: error?.message });
        return;
      }
      invoice = raced;
    } else {
      invoice = data;
    }
  }

  if (invoice.emailed_at) return;
  if (!input.customerEmail?.trim()) {
    console.warn("[invoices] invoice created but not emailed: customer has no email", { reference: input.reference, invoice: invoice.invoice_number });
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://namibiatransport.com").replace(/\/$/, "");
  const invoiceUrl = `${siteUrl}/invoice/${invoice.public_token}`;
  const name = escapeHtml(input.customerName || "Customer");
  const amount = `${input.currency} ${Number(input.amount).toFixed(2)}`;
  const body = [
    `Dear ${input.customerName || "Customer"},`,
    "",
    `Thank you for your payment. Your Namibia Transport invoice ${invoice.invoice_number} is available here:`,
    invoiceUrl,
    "",
    `Booking reference: ${input.reference}`,
    `Amount paid: ${amount}`,
    "VAT: Not charged (Namibia Transport is not VAT registered).",
    "",
    "Kind regards,",
    "Namibia Transport",
  ].join("\n");

  try {
    const result = await getMessenger().send({
      to: { fullName: input.customerName || "Customer", email: input.customerEmail.trim() },
      channel: "email",
      subject: `Your Namibia Transport invoice ${invoice.invoice_number}`,
      body,
      html: `<p>Dear ${name},</p><p>Thank you for your payment. Your invoice is ready.</p><p><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}<br/><strong>Booking reference:</strong> ${escapeHtml(input.reference)}<br/><strong>Amount paid:</strong> ${escapeHtml(amount)}</p><p>VAT is not charged; Namibia Transport is not VAT registered.</p><p><a href="${invoiceUrl}">View and print your invoice</a></p><p>Kind regards,<br/>Namibia Transport</p>`,
    });
    if (result.delivered) {
      await supabase.from("payment_invoices").update({ emailed_at: new Date().toISOString(), email_error: null })
        .eq("payment_type", input.paymentType).eq("payment_id", input.paymentId);
    } else {
      await supabase.from("payment_invoices").update({ email_error: "Email provider did not confirm delivery" })
        .eq("payment_type", input.paymentType).eq("payment_id", input.paymentId);
      console.error("[invoices] email not delivered", { reference: input.reference, provider: result.provider });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    await supabase.from("payment_invoices").update({ email_error: message.slice(0, 500) })
      .eq("payment_type", input.paymentType).eq("payment_id", input.paymentId);
    console.error("[invoices] email send failed", { reference: input.reference, error: message });
  }
}
