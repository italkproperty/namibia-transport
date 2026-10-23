import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import InvoicePrintButton from "./print-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvoiceRow = {
  invoice_number: string;
  booking_reference: string | null;
  customer_name: string;
  customer_email: string | null;
  description: string;
  currency: string;
  amount: string | number;
  vat_amount: string | number;
  total: string | number;
  payment_status: string;
  paid_at: string;
  created_at: string;
};

function money(value: string | number, currency: string) {
  return new Intl.NumberFormat("en-NA", { style: "currency", currency }).format(Number(value));
}

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("payment_invoices")
    .select("invoice_number, booking_reference, customer_name, customer_email, description, currency, amount, vat_amount, total, payment_status, paid_at, created_at")
    .eq("public_token", token).maybeSingle();

  if (error || !data) notFound();
  const invoice = data as InvoiceRow;
  const issuedDate = new Date(invoice.created_at).toLocaleDateString("en-NA", { dateStyle: "long", timeZone: "Africa/Windhoek" });
  const paidDate = new Date(invoice.paid_at).toLocaleDateString("en-NA", { dateStyle: "long", timeZone: "Africa/Windhoek" });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 print:bg-white print:p-0">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:shadow-none sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Namibia Transport</p>
            <h1 className="mt-3 text-3xl font-bold">Invoice</h1>
            <p className="mt-2 text-sm text-slate-500">{invoice.invoice_number}</p>
          </div>
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">PAID</div>
        </div>
        <div className="grid gap-6 py-8 sm:grid-cols-2">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Billed to</h2>
            <p className="mt-2 font-semibold">{invoice.customer_name}</p>
            {invoice.customer_email && <p className="text-sm text-slate-600">{invoice.customer_email}</p>}
          </section>
          <section className="sm:text-right">
            <p className="text-sm text-slate-600">Issue date: {issuedDate}</p>
            <p className="mt-1 text-sm text-slate-600">Payment date: {paidDate}</p>
            {invoice.booking_reference && <p className="mt-1 text-sm text-slate-600">Reference: {invoice.booking_reference}</p>}
          </section>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr className="border-y border-slate-200 text-slate-500"><th className="py-3 pr-4 font-semibold">Description</th><th className="py-3 text-right font-semibold">Amount</th></tr></thead>
          <tbody><tr className="border-b border-slate-200"><td className="py-5 pr-4">{invoice.description}</td><td className="py-5 text-right font-semibold">{money(invoice.amount, invoice.currency)}</td></tr></tbody>
        </table>
        <div className="ml-auto mt-6 max-w-xs space-y-3 text-sm">
          <div className="flex justify-between gap-6"><span>Subtotal</span><span>{money(invoice.amount, invoice.currency)}</span></div>
          <div className="flex justify-between gap-6"><span>VAT</span><span>{money(0, invoice.currency)}</span></div>
          <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 text-lg font-bold"><span>Total paid</span><span>{money(invoice.total, invoice.currency)}</span></div>
        </div>
        <p className="mt-8 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Namibia Transport is not VAT registered. VAT has not been charged on this invoice. Payment status: paid.</p>
        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">This invoice was generated electronically by Namibia Transport.</footer>
        <div className="mt-8 print:hidden"><InvoicePrintButton /></div>
      </article>
    </main>
  );
}
