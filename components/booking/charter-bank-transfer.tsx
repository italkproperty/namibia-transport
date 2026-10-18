"use client";

import * as React from "react";
import { CheckCircle2Icon, CopyIcon, LandmarkIcon } from "lucide-react";

export function CharterBankTransfer({
  lines,
  quoteNumber,
}: {
  lines: { label: string; value: string }[];
  quoteNumber: string;
}) {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // The displayed value remains selectable if clipboard access is blocked.
    }
  };

  return (
    <section aria-labelledby="charter-bank-transfer-heading" className="mt-4 rounded-xl border bg-card p-5">
      <h3 id="charter-bank-transfer-heading" className="flex items-center gap-2 text-base font-semibold">
        <LandmarkIcon className="size-4" aria-hidden />
        Pay by bank transfer
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Transfer the quoted amount using the details below. Use the proposal number as your payment reference so we can identify your payment.
      </p>
      <dl className="mt-4 grid gap-2">
        {lines.map((line) => (
          <div key={line.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-b-0">
            <dt className="text-sm text-muted-foreground">{line.label}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className={line.label === "Reference" ? "font-mono text-sm font-medium" : "font-mono text-sm"}>{line.value}</span>
              <button type="button" onClick={() => copy(line.label, line.value)} aria-label={`Copy ${line.label.toLowerCase()}`} className="rounded p-1 text-muted-foreground hover:text-foreground">
                {copied === line.label ? <CheckCircle2Icon className="size-4 text-green-600" aria-hidden /> : <CopyIcon className="size-4" aria-hidden />}
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        These bank details never change. Namibia Transport will never message you to say our account has changed. Verify any conflicting instructions with us before sending money.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Your trip is not confirmed when you make the transfer. We will verify receipt and issue a separate operational booking confirmation.
      </p>
    </section>
  );
}
