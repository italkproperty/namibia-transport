"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Hidden in the printed output; saves the visitor hunting for Ctrl+P. */
export function PrintToolbar() {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
      <p className="text-muted-foreground text-sm">
        Use &ldquo;Save as PDF&rdquo; in the print dialog to download this
        quotation.
      </p>
      <Button
        onClick={() => window.print()}
        className="press bg-brand text-brand-foreground hover:bg-brand-hover"
      >
        <PrinterIcon className="size-4" aria-hidden />
        Print / save PDF
      </Button>
    </div>
  );
}
