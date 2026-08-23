import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCorporateEnquiries } from "@/lib/admin/queries";
import { NEED_LABELS } from "@/lib/corporate/schema";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Corporate enquiries",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  new: "default",
  contacted: "secondary",
  quoted: "warning",
  won: "success",
  lost: "destructive",
} as const;

export default async function AdminEnquiriesPage() {
  const enquiries = await listCorporateEnquiries();

  return (
    <AdminShell active="/admin/enquiries">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl">Corporate enquiries</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Group and account leads, quoted by hand. Newest first.
          </p>
        </div>

        {enquiries.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            No enquiries yet.
          </p>
        ) : (
          <div className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Need</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enquiries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.companyName}
                    </TableCell>
                    <TableCell>{row.contactName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {NEED_LABELS[row.needType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular">
                      {row.approxPassengers ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {row.datesNote ?? "—"}
                    </TableCell>
                    <TableCell>{row.whatsapp ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      {row.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate">
                      {row.acquisitionSource ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-64 truncate">
                      {row.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Showing up to 500 enquiries. Status is set in the database for now;
          an inline workflow lands with proper auth.
        </p>
      </div>
    </AdminShell>
  );
}
