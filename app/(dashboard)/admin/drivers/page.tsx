import type { Metadata } from "next";

import { DriverForm } from "@/components/admin/driver-form";
import { DriverStatusSelect } from "@/components/admin/driver-status";
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
import type { DriverStatus } from "@/db/schema";
import { listDrivers } from "@/lib/dispatch/queries";
import { formatDate } from "@/lib/format";
import { listVehicleClasses } from "@/lib/maps";

export const metadata: Metadata = {
  title: "Drivers",
  robots: { index: false, follow: false },
};

/** Always live: an operations view must never serve a cached page. */
export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<DriverStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  pending: "secondary",
  suspended: "destructive",
  inactive: "outline",
};

export default async function DriversPage() {
  const [rows, vehicleClasses] = await Promise.all([
    listDrivers(),
    listVehicleClasses(),
  ]);

  const active = rows.filter((row) => row.status === "active").length;
  const withVehicle = rows.filter((row) => row.registration).length;

  return (
    <AdminShell active="/admin/drivers">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Drivers</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug">
            The partner drivers we can put on a trip. {active} active
            {rows.length > 0 && ` of ${rows.length}`}
            {withVehicle > 0 && `, ${withVehicle} with a vehicle on file`}.
          </p>
        </div>

        <DriverForm vehicleClasses={vehicleClasses} />

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="font-medium">No drivers yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-snug">
              Until there is at least one active driver with a vehicle, a
              booking cannot be assigned and the traveller cannot be told who is
              coming &mdash; which is what the rest of the site promises.
            </p>
          </div>
        ) : (
          <div className="bg-card overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Licence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.id}-${row.vehicleId ?? "none"}`}>
                    <TableCell className="font-medium">{row.fullName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.whatsapp}
                      {row.phone && <span className="block">{row.phone}</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.make ? (
                        <>
                          {[row.colour, row.make, row.model]
                            .filter(Boolean)
                            .join(" ")}
                          {row.vehicleClassName && (
                            <span className="text-muted-foreground block text-xs">
                              {row.vehicleClassName}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          none on file
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular font-medium">
                      {row.registration ?? (
                        <span className="text-muted-foreground font-normal">
                          &mdash;
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.licenseNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {row.status}
                        </Badge>
                        <DriverStatusSelect
                          driverId={row.id}
                          status={row.status}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
