"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateQuoteStatus } from "@/lib/corporate/quote-actions";
import type { QuoteStatus } from "@/db/schema";

const STATUSES: QuoteStatus[] = [
  "draft",
  "quoted",
  "sent",
  "negotiating",
  "accepted",
  "rejected",
  "expired",
  "fulfilled",
];

/** Inline pipeline move — the whole CRM this needs to be for now. */
export function QuoteStatusSelect({
  quoteId,
  status,
}: {
  quoteId: string;
  status: QuoteStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function onChange(next: string) {
    startTransition(async () => {
      const result = await updateQuoteStatus(quoteId, next as QuoteStatus);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error("Could not update the quote status");
      }
    });
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger size="sm" className="h-8 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {value.replace(/^./, (c) => c.toUpperCase())}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
