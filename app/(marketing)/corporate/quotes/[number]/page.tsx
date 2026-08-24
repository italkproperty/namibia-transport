import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuoteActionsBar } from "@/components/corporate/quote-actions-bar";
import { QuoteDocument } from "@/components/corporate/quote-document";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getCompanyInfo } from "@/lib/company";
import { getQuoteByNumber } from "@/lib/corporate/quote-queries";
import { formatNad } from "@/lib/money";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your quotation",
  robots: { index: false, follow: false },
};

/** A quotation is personal — never cached, never indexed. */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ number: string }> };

export default async function QuotePage({ params }: PageProps) {
  const { number } = await params;
  const detail = await getQuoteByNumber(decodeURIComponent(number));

  if (!detail) {
    notFound();
  }

  const company = getCompanyInfo();

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl">
                {detail.quote.isEstimate ? "Your estimate" : "Your quotation"}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                We follow up within 24 hours on WhatsApp/email. Quote{" "}
                <span className="text-foreground font-medium">
                  {detail.quote.quoteNumber}
                </span>{" "}
                in any correspondence.
              </p>
            </div>
          </div>

          <QuoteDocument detail={detail} />

          <div className="mt-5">
            <QuoteActionsBar
              quoteNumber={detail.quote.quoteNumber}
              total={formatNad(detail.quote.total)}
              companyName={detail.quote.companyName}
              status={detail.quote.status}
              shareUrl={`${SITE.url}/corporate/quotes/${detail.quote.quoteNumber}`}
              supportEmail={company.email}
            />
          </div>

          <p className="text-muted-foreground mt-6 text-sm">
            Need to change the requirement?{" "}
            <Link href="/corporate" className="underline underline-offset-2">
              Create a new quotation
            </Link>{" "}
            — it takes about a minute.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
