import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuoteDocument } from "@/components/corporate/quote-document";
import { PrintToolbar } from "@/components/corporate/print-toolbar";
import { getQuoteByNumber } from "@/lib/corporate/quote-queries";

export const metadata: Metadata = {
  title: "Quotation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ number: string }> };

/**
 * The A4 rendering. "Download PDF" is the browser's print-to-PDF over a page
 * that carries no site chrome — the document, exactly as filed.
 */
export default async function QuotePrintPage({ params }: PageProps) {
  const { number } = await params;
  const detail = await getQuoteByNumber(decodeURIComponent(number));

  if (!detail) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:p-0">
      <PrintToolbar />
      <QuoteDocument detail={detail} />
    </div>
  );
}
