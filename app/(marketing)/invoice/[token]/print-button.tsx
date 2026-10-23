"use client";

export default function InvoicePrintButton() {
  return <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Print / Save as PDF</button>;
}
