import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { createInvoiceDraft } from "@/lib/admin/invoice-actions";
import { getAdminGateState } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Create invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const gate = await getAdminGateState();
  const params = await searchParams;
  const error = one(params.error);

  if (gate.state !== "signed-in") {
    return <AdminShell active="/admin/invoices"><div /></AdminShell>;
  }

  return (
    <AdminShell active="/admin/invoices">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/admin/invoices" className="text-sm text-muted-foreground hover:text-foreground">← All invoices</Link>
          <h1 className="mt-3 text-xl font-semibold">Create invoice draft</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the agreed customer charge. This creates a draft only; it does not send an invoice or mark anything as paid.</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

        <form action={createInvoiceDraft} className="space-y-6 rounded-xl border p-5 sm:p-6">
          <section className="space-y-4">
            <h2 className="font-medium">Bill to</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer / company name" name="billingName" required autoComplete="name" />
              <Field label="Email address" name="billingEmail" type="email" autoComplete="email" />
              <Field label="WhatsApp number" name="billingWhatsapp" type="tel" autoComplete="tel" />
              <Field label="Billing address (optional)" name="billingAddress" autoComplete="street-address" />
            </div>
            <p className="text-xs text-muted-foreground">Enter at least one contact method. If a matching customer record exists, the invoice will be linked to it; otherwise the invoice retains its own billing snapshot.</p>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h2 className="font-medium">Invoice details</h2>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Service description</label>
              <textarea id="description" name="description" required rows={3} maxLength={1000} placeholder="e.g. Private SUV charter — Namibia itinerary, including agreed transport services" className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Total amount (NAD)" name="amount" type="number" required min="0.01" max="99999999.99" step="0.01" placeholder="32400.00" />
              <Field label="Payment due date (optional)" name="dueAt" type="date" />
            </div>
            <div className="space-y-2">
              <label htmlFor="terms" className="text-sm font-medium">Payment terms / notes to client (optional)</label>
              <textarea id="terms" name="terms" rows={3} maxLength={2000} placeholder="e.g. Please pay using the secure payment instructions provided." className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]" />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Namibia Transport is not VAT-registered. No VAT will be added to this invoice. Review the amount and billing details before issuing.
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button asChild type="button" variant="outline"><Link href="/admin/invoices">Cancel</Link></Button>
            <Button type="submit">Save draft</Button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}

function Field({
  label, name, type = "text", required = false, ...props
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  min?: string;
  max?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium">{label}{required ? " *" : ""}</label>
      <input id={name} name={name} type={type} required={required} {...props} className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]" />
    </div>
  );
}
