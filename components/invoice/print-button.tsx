"use client";

import { Button } from "@/components/ui/button";

export function PrintInvoiceButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      Print / Save as PDF
    </Button>
  );
}
