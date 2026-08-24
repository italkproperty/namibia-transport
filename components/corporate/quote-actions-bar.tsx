"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  PrinterIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptCorporateQuote } from "@/lib/corporate/quote-actions";

type Props = {
  quoteNumber: string;
  total: string;
  companyName: string;
  status: string;
  /** Absolute URL of this quotation, for sharing. */
  shareUrl: string;
  supportEmail: string | null;
};

/**
 * The quotation's actions: print/save as PDF, share to WhatsApp or email,
 * and accept. Accepting moves the pipeline — everything else is distribution.
 */
export function QuoteActionsBar({
  quoteNumber,
  total,
  companyName,
  status,
  shareUrl,
  supportEmail,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const accepted = status === "accepted" || status === "fulfilled";

  const shareText = `Quotation ${quoteNumber} from Namibia Transport for ${companyName}: ${total}. ${shareUrl}`;

  function accept() {
    startTransition(async () => {
      const result = await acceptCorporateQuote(quoteNumber);
      if (result.ok) {
        toast.success("Quotation accepted", {
          description: "Our team confirms scheduling and invoicing within 24 hours.",
        });
        router.refresh();
      } else {
        toast.error("Could not accept the quotation", {
          description: "Please try again, or reply to us on WhatsApp.",
        });
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="press">
        <a
          href={`/corporate/quotes/${quoteNumber}/print`}
          target="_blank"
          rel="noopener"
        >
          <PrinterIcon className="size-4" aria-hidden />
          Download PDF
        </a>
      </Button>

      <Button asChild variant="outline" className="press">
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}>
          <MessageCircleIcon className="size-4" aria-hidden />
          Send via WhatsApp
        </a>
      </Button>

      <Button asChild variant="outline" className="press">
        <a
          href={`mailto:${supportEmail ?? ""}?subject=${encodeURIComponent(
            `Quotation ${quoteNumber}`
          )}&body=${encodeURIComponent(shareText)}`}
        >
          <MailIcon className="size-4" aria-hidden />
          Email quotation
        </a>
      </Button>

      {accepted ? (
        <span className="bg-success-subtle text-success inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-medium">
          <CheckIcon className="size-4" aria-hidden />
          Accepted
        </span>
      ) : (
        <Button
          onClick={accept}
          disabled={isPending}
          className="press bg-brand text-brand-foreground hover:bg-brand-hover"
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <CheckIcon className="size-4" aria-hidden />
          )}
          {isPending ? "Accepting…" : "Accept quotation"}
        </Button>
      )}
    </div>
  );
}
