import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/corporate/print-toolbar";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { getInvoiceByToken } from "@/lib/invoices/issue";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type PageProps = { params: Promise<{ token: string }> };

/**
 * A private invoice link, like a quote link. No site chrome, so "Save as PDF"
 * from the print dialog produces the document and nothing else.
 */
export default async function InvoicePage({ params }: PageProps) {
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:p-0">
      <PrintToolbar noun="invoice" />
      <InvoiceDocument invoice={invoice} />
    </div>
  );
}
