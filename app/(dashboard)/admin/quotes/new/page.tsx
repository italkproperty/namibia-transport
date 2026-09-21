import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/shell";
import { QuoteForm } from "@/components/admin/quote-form";
import { listVehicleClasses } from "@/lib/maps";
import { isBankTransferConfigured } from "@/lib/payments/bank";

export const metadata: Metadata = {
  title: "New quote",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const vehicleClasses = await listVehicleClasses();
  const bankReady = isBankTransferConfigured();

  return (
    <AdminShell active="/admin/quotes">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/admin/quotes"
            className="text-muted-foreground hover:text-foreground focus-ring inline-flex items-center gap-1.5 rounded-sm text-xs"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Quotes
          </Link>
          <h1 className="mt-2 text-xl">Quote a trip by hand</h1>
          <p className="text-muted-foreground mt-1 text-sm text-pretty">
            For the enquiries the road model cannot price — lodges it does not
            know, a return agreed as one number, a fare already settled on
            WhatsApp. It creates a real booking page you can send as a link.
          </p>
        </div>

        {!bankReady && (
          <div className="border-warning/30 bg-warning-subtle/50 rounded-xl border p-4">
            <p className="text-sm font-medium">
              Bank details are not set on this deployment
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              The quote page will show the trip and the fare, but no way to pay.
              Set <code className="text-foreground">BANK_ACCOUNT_NAME</code>,{" "}
              <code className="text-foreground">BANK_ACCOUNT_NUMBER</code> and{" "}
              <code className="text-foreground">BANK_BRANCH_CODE</code> in
              Vercel, then redeploy.
            </p>
          </div>
        )}

        <QuoteForm
          vehicleClasses={vehicleClasses.map((vc) => ({
            id: vc.id,
            name: vc.name,
          }))}
        />
      </div>
    </AdminShell>
  );
}
