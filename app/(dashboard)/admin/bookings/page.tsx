import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { AdminSignInForm } from "@/components/admin/sign-in-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminSignOut } from "@/lib/admin/actions";
import { getAdminGateState } from "@/lib/admin/auth";
import {
  getAdminSummary,
  listBookings,
  SORTABLE_COLUMNS,
  type SortKey,
} from "@/lib/admin/queries";
import { isDatabaseConfigured } from "@/db";
import type { BookingStatus, RouteCategory } from "@/db/schema";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatNad } from "@/lib/money";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

/** Always live: an operations view must never serve a cached page. */
export const dynamic = "force-dynamic";

const STATUSES: BookingStatus[] = [
  "pending_payment",
  "confirmed",
  "assigned",
  "completed",
  "cancelled",
];

const CATEGORIES: RouteCategory[] = [
  "airport",
  "intercity",
  "city",
  "corporate",
];

const STATUS_VARIANT: Record<
  BookingStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  pending_payment: "warning",
  confirmed: "default",
  assigned: "secondary",
  completed: "success",
  cancelled: "destructive",
};

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "scheduledAt", label: "Travel date" },
  { key: "createdAt", label: "Booked" },
  { key: "customerPrice", label: "Price" },
  { key: "contribution", label: "Contribution" },
  { key: "status", label: "Status" },
];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const gate = await getAdminGateState();
  const params = await searchParams;

  if (gate.state === "unconfigured") {
    return (
      <Shell>
        <div className="border-border mx-auto max-w-md rounded-2xl border border-dashed p-8">
          <h1 className="font-display text-2xl">Admin is not configured</h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Set <code className="text-foreground">ADMIN_PASSWORD</code> in your
            environment to open this view. It stays closed until you do.
          </p>
        </div>
      </Shell>
    );
  }

  if (gate.state === "signed-out") {
    return (
      <Shell>
        <div className="border-border/70 bg-card mx-auto max-w-sm rounded-2xl border p-8">
          <h1 className="font-display text-2xl">Dispatch</h1>
          <p className="text-muted-foreground mt-2 mb-6 text-sm">
            Internal view. Sign in to continue.
          </p>
          <AdminSignInForm />
        </div>
      </Shell>
    );
  }

  const statusParam = one(params.status);
  const categoryParam = one(params.category);
  const sortParam = one(params.sort);
  const dirParam = one(params.dir);

  const filters = {
    status: STATUSES.includes(statusParam as BookingStatus)
      ? (statusParam as BookingStatus)
      : undefined,
    category: CATEGORIES.includes(categoryParam as RouteCategory)
      ? (categoryParam as RouteCategory)
      : undefined,
    sort: (sortParam && sortParam in SORTABLE_COLUMNS
      ? sortParam
      : "createdAt") as SortKey,
    direction: dirParam === "asc" ? ("asc" as const) : ("desc" as const),
  };

  const [rows, summary] = await Promise.all([
    listBookings(filters),
    getAdminSummary(),
  ]);

  /** Preserves the other filters when one control changes. */
  function href(next: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = {
      status: filters.status,
      category: filters.category,
      sort: filters.sort,
      dir: filters.direction,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  }

  return (
    <Shell
      action={
        <form action={adminSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      }
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl">Bookings</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Every booking, with the economics behind it.
          </p>
        </div>

        {!isDatabaseConfigured() && (
          <p className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
            No database is connected, so there is nothing to show. Set{" "}
            <code className="text-foreground">DATABASE_URL</code> and run the
            migrations.
          </p>
        )}

        {/* ------------------------------------------------------- summary */}
        {summary && (
          <section aria-labelledby="summary-heading" className="space-y-4">
            <h2 id="summary-heading" className="sr-only">
              Summary
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Bookings this month"
                value={String(summary.bookingsThisMonth)}
              />
              <Stat
                label="Contribution this month"
                value={formatNad(summary.contributionThisMonth)}
              />
              <Stat
                label="Contribution all time"
                value={formatNad(summary.contributionAllTime)}
              />
            </div>

            {summary.byRoute.length > 0 && (
              <div className="border-border/70 bg-card rounded-2xl border p-5">
                <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Contribution by route
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Which routes earn enough to justify owning a vehicle.
                </p>
                <ul className="mt-4 space-y-3">
                  {summary.byRoute.map((route) => {
                    const share =
                      Number(summary.contributionAllTime) > 0
                        ? (Number(route.contribution) /
                            Number(summary.contributionAllTime)) *
                          100
                        : 0;
                    return (
                      <li key={route.slug ?? route.label}>
                        <div className="flex items-baseline justify-between gap-4 text-sm">
                          <span className="truncate">{route.label}</span>
                          <span className="tabular shrink-0 font-medium">
                            {formatNad(route.contribution)}
                            <span className="text-muted-foreground ml-2 font-normal">
                              {route.bookings}{" "}
                              {route.bookings === 1 ? "booking" : "bookings"}
                            </span>
                          </span>
                        </div>
                        <div
                          className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full"
                          role="img"
                          aria-label={`${share.toFixed(0)}% of total contribution`}
                        >
                          <div
                            className="bg-brand h-full rounded-full"
                            style={{ width: `${Math.max(share, 2)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------------------- filters */}
        <section aria-labelledby="filters-heading" className="space-y-3">
          <h2 id="filters-heading" className="sr-only">
            Filters
          </h2>

          <FilterRow label="Status">
            <FilterChip href={href({ status: undefined })} active={!filters.status}>
              All
            </FilterChip>
            {STATUSES.map((status) => (
              <FilterChip
                key={status}
                href={href({ status })}
                active={filters.status === status}
              >
                {humanise(status)}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="Category">
            <FilterChip
              href={href({ category: undefined })}
              active={!filters.category}
            >
              All
            </FilterChip>
            {CATEGORIES.map((category) => (
              <FilterChip
                key={category}
                href={href({ category })}
                active={filters.category === category}
              >
                {humanise(category)}
              </FilterChip>
            ))}
          </FilterRow>
        </section>

        {/* --------------------------------------------------------- table */}
        {rows.length === 0 ? (
          <p className="border-border text-muted-foreground rounded-2xl border border-dashed p-12 text-center text-sm">
            No bookings match these filters yet.
          </p>
        ) : (
          <div className="border-border/70 bg-card rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Category</TableHead>
                  {COLUMNS.map((column) => {
                    const isActive = filters.sort === column.key;
                    const nextDir =
                      isActive && filters.direction === "desc" ? "asc" : "desc";
                    return (
                      <TableHead key={column.key}>
                        <Link
                          href={href({ sort: column.key, dir: nextDir })}
                          aria-sort={
                            isActive
                              ? filters.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm focus-visible:ring-[3px] focus-visible:outline-none"
                        >
                          {column.label}
                          {isActive &&
                            (filters.direction === "asc" ? (
                              <ArrowUpIcon className="size-3" aria-hidden />
                            ) : (
                              <ArrowDownIcon className="size-3" aria-hidden />
                            ))}
                        </Link>
                      </TableHead>
                    );
                  })}
                  <TableHead>Payout</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Bags</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Return</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.ref}</TableCell>
                    <TableCell className="max-w-56 truncate">
                      {row.routeOrigin && row.routeDestination
                        ? `${row.routeOrigin} to ${row.routeDestination}`
                        : `${row.pickupLabel} to ${row.dropoffLabel}`}
                    </TableCell>
                    <TableCell>
                      {row.routeCategory ? (
                        <Badge variant="outline">
                          {humanise(row.routeCategory)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(row.scheduledAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="tabular font-medium">
                      {formatNad(row.customerPrice)}
                    </TableCell>
                    <TableCell className="tabular text-brand font-medium">
                      {formatNad(row.contribution)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {humanise(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {formatNad(row.driverPayout)}
                    </TableCell>
                    <TableCell className="tabular">{row.passengers}</TableCell>
                    <TableCell className="tabular">
                      {row.luggageCount}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {row.customerName ?? "—"}
                      {row.isRepeatCustomer && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          repeat
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.customerType ? humanise(row.customerType) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-44 truncate">
                      {row.acquisitionSource ?? "—"}
                    </TableCell>
                    <TableCell>{row.isReturn ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Showing up to 500 bookings. Access is a shared password for now —
          Supabase Auth with per-user accounts and row-level security replaces
          it before this leaves the founding team.
        </p>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-svh">
      <header className="border-border/60 border-b">
        <div className="mx-auto flex h-14 max-w-[110rem] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Namibia Transport
          </Link>
          {action}
        </div>
      </header>
      <main className="mx-auto max-w-[110rem] px-5 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 bg-card rounded-2xl border p-5">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="tabular mt-2 text-3xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground w-16 shrink-0 text-xs tracking-wider uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={[
        "focus-visible:ring-ring rounded-full border px-3 py-1 text-xs transition focus-visible:ring-[3px] focus-visible:outline-none",
        active
          ? "border-foreground bg-accent/50 font-medium"
          : "border-border text-muted-foreground hover:border-foreground/30",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
