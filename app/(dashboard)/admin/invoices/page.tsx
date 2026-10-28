import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";

import { AdminShell } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { getDb, isDatabaseConfigured } from "@/db";
import { invoices } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { formatDate } from "@/lib/format";
import { formatNad } from "@/lib/money";

export const metadata: Metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminInvoicesPage({ searchParams }: PageProps) {
  const gate = await getAdminGateState();
  const params = await searchParams;
  const error = one(params.error);
  const saved = one(params.saved);

  if (gate.state !== "signed-in") {
    return <AdminShell active="/admin/invoices"><div /></AdminShell>;
  }

  let rows: Array<typeof invoices.$inferSelect> = [];
  let loadError = false;
  if (isDatabaseConfigured()) {
    try {
      rows = await getDb().select().from(invoices)
        .orderBy(desc(invoices.createdAt)).limit(100);
    } catch (cause) {
      loadError = true;
      console.error("[admin] invoice register failed", cause);
    }
  }

  const issuedTotal = rows.filter((row) => row.status === "issued")
    .reduce((sum, row) => sum + Number(row.total), 0);
  const draftCount = rows.filter((row) => row.status === "draft").length;

  return (
    <AdminShell active="/admin/invoices">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Invoices</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Create and issue customer invoices. Payment confirmation and receipts will be connected in the next finance phase.
            </p>
          </div>
          <Button asChild size="sm"><Link href="/admin/invoices/new">Create invoice</Link></Button>
        </div>

        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
        {saved && <p role="status" className="rounded-lg border p-3 text-sm">Invoice draft saved.</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Invoices listed" value={String(rows.length)} />
          <Stat label="Drafts awaiting issue" value={String(draftCount)} />
          <Stat label="Issued invoice value" value={formatNad(issuedTotal)} />
        </div>

        {!isDatabaseConfigured() ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">The database is not configured. No invoice data was loaded.</p>
        ) : loadError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-sm">The invoice register could not be loaded. Please retry later; no financial records were changed.</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <h2 className="font-medium">No invoices yet</h2>
            <p className="text-muted-foreground mt-2 text-sm">Create a draft invoice for a customer, then review and issue it.</p>
            <Button asChild className="mt-4" size="sm"><Link href="/admin/invoices/new">Create first invoice</Link></Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link className="hover:underline" href={"/admin/invoices/" + row.id}>{row.invoiceNumber ?? "Draft invoice"}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.billingName}</div>
                      <div className="text-muted-foreground text-xs">{row.billingEmail ?? row.billingWhatsapp ?? "No contact"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.dueAt ? formatDate(row.dueAt) : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNad(row.total)}</td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex rounded-full px-2 py-1 text-xs " + (
                        row.status === "issued" ? "bg-emerald-500/10 text-emerald-700" :
                        row.status === "void" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      )}>{row.status === "issued" ? "Issued" : row.status === "void" ? "Void" : "Draft"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">Showing the latest 100 invoices. Payment status is not yet represented in this first release.</p>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>;
}
