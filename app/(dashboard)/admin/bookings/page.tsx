import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MapPinIcon,
  SearchIcon,
} from "lucide-react";

import { AssignDriver } from "@/components/admin/assign-driver";
import { BookingRowActions } from "@/components/admin/booking-actions";
import { PendingTransfers } from "@/components/admin/pending-transfers";
import { TravellerDetails } from "@/components/admin/traveller-details";
import { AdminShell } from "@/components/admin/shell";
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
import { attributionConfidence } from "@/lib/admin/channels";
import { AlertTriangleIcon } from "lucide-react";
import {
  adminReadFailures,
  beginAdminRead,
  BOOKINGS_PER_PAGE,
  countBookings,
  getAdminSummary,
  listBookings,
  SORTABLE_COLUMNS,
  type SortKey,
} from "@/lib/admin/queries";
import { listSubmittedDetails } from "@/lib/admin/detail-queries";
import { listPendingTransfers } from "@/lib/admin/transfer-queries";
import { isDatabaseConfigured } from "@/db";
import type { BookingStatus, RouteCategory } from "@/db/schema";
import { formatDate, formatDateTime } from "@/lib/format";
import { mapsLink } from "@/lib/maps/bounds";
import { assignmentsByBooking, listDrivers } from "@/lib/dispatch/queries";
import { formatNad } from "@/lib/money";
import { journeyLabel } from "@/lib/network/journey";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

/** Always live: an operations view must never serve a cached page. */
export const dynamic = "force-dynamic";

/**
 * Headroom over the default, which is what the 504 was hitting.
 *
 * Not a fix on its own — the reads are now behind a 6s deadline each, so a
 * database that will not answer produces a page with a banner rather than a
 * function that is killed. This is the margin that lets those deadlines fire
 * and the page render, instead of Vercel ending the request first.
 */
export const maxDuration = 30;

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
  // Cleared before the reads so the banner below reflects this request only.
  beginAdminRead();

  const params = await searchParams;

  const statusParam = one(params.status);
  const categoryParam = one(params.category);
  const sortParam = one(params.sort);
  const dirParam = one(params.dir);
  const search = one(params.q)?.trim().slice(0, 100) || undefined;
  const page = Math.max(0, Number.parseInt(one(params.page) ?? "0", 10) || 0);

  const filters = {
    status: STATUSES.includes(statusParam as BookingStatus)
      ? (statusParam as BookingStatus)
      : undefined,
    category: CATEGORIES.includes(categoryParam as RouteCategory)
      ? (categoryParam as RouteCategory)
      : undefined,
    query: search,
    page,
    sort: (sortParam && sortParam in SORTABLE_COLUMNS
      ? sortParam
      : "createdAt") as SortKey,
    direction: dirParam === "asc" ? ("asc" as const) : ("desc" as const),
  };

  const [rows, total, summary, driverRows, assignments] = await Promise.all([
    listBookings(filters),
    countBookings(filters),
    getAdminSummary(),
    listDrivers(),
    assignmentsByBooking(),
  ]);

  const pages = Math.max(1, Math.ceil(total / BOOKINGS_PER_PAGE));
  const from = total === 0 ? 0 : page * BOOKINGS_PER_PAGE + 1;
  const to = Math.min(total, page * BOOKINGS_PER_PAGE + rows.length);

  /**
   * Only drivers who are active AND have a vehicle on file can be assigned.
   * What reaches the traveller is the make and the plate; one without the
   * other is not the promise the rest of the site makes.
   */
  const assignable = driverRows
    .filter((driver) => driver.status === "active" && driver.registration)
    .map((driver) => ({
      id: driver.id,
      fullName: driver.fullName,
      registration: driver.registration,
    }));

  /**
   * Preserves the other filters when one control changes — and drops the page
   * unless the caller is the pager itself, because page 7 of a narrower filter
   * is usually nothing at all.
   */
  function href(next: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = {
      status: filters.status,
      category: filters.category,
      q: search,
      sort: filters.sort,
      dir: filters.direction,
      page: undefined as string | undefined,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  }

  // Money a traveller says they have sent. Above everything else on the page
  // because it is the only item here with somebody waiting on the other end.
  const [pendingTransfers, submittedDetails] = await Promise.all([
    listPendingTransfers(),
    listSubmittedDetails(),
  ]);

  /**
   * What did not load.
   *
   * Every read here fails soft so one dead panel cannot take the payment queue
   * with it. Without this banner that softness is indistinguishable from good
   * news: an empty table reads as a quiet week, and the operator carries on
   * believing nobody has booked.
   */
  const failed = adminReadFailures();

  return (
    <AdminShell active="/admin/bookings">
      <div className="space-y-6">
        {failed.length > 0 && (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 flex gap-3 rounded-xl border p-4"
          >
            <AlertTriangleIcon
              className="text-warning mt-0.5 size-5 shrink-0"
              aria-hidden
            />
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                This page is incomplete — the database did not answer in time.
              </p>
              <p className="text-muted-foreground mt-1 leading-snug">
                {failed.join(", ")} {failed.length === 1 ? "is" : "are"}{" "}
                missing, so anything shown below may be short. Reload; if it
                persists, check that <code>DATABASE_URL</code> is
                Supabase&rsquo;s transaction pooler (port 6543, user{" "}
                <code>postgres.&lt;ref&gt;</code>) and that the project is not
                paused or at its connection limit.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl">Bookings</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Every booking, with the economics behind it.
            </p>
          </div>
          <Button asChild size="sm" className="press shrink-0">
            <Link href="/admin/quotes/new">Quote a trip by hand</Link>
          </Button>
        </div>

        <PendingTransfers transfers={pendingTransfers} />

        <TravellerDetails items={submittedDetails} />

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
              <div className="border-border/70 bg-card rounded-xl border p-4">
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

            {/* ------------------------------------------- where it comes from */}
            {summary.byChannel.length > 0 &&
              (() => {
                const confidence = attributionConfidence(summary.byChannel);
                const busiest = summary.byChannel[0]?.bookings ?? 0;
                return (
                  <div className="border-border/70 bg-card rounded-xl border p-4">
                    <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Where bookings come from
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs text-pretty">
                      {/* Stated rather than hidden: a referrer goes missing
                          whenever a link is opened from WhatsApp or an email
                          client, so a clean-looking chart here would be the
                          most misleading thing on the page. */}
                      {confidence.attributed} of {confidence.total}{" "}
                      {confidence.total === 1 ? "booking" : "bookings"} through
                      the site name a channel ({confidence.percent.toFixed(0)}
                      %). The rest arrived without one — a link opened from
                      WhatsApp or an email client usually does.
                      {confidence.internal > 0 &&
                        ` ${confidence.internal} more were quoted by us and never came through the site at all.`}
                    </p>
                    <ul className="mt-4 space-y-3">
                      {summary.byChannel.map((total) => {
                        const share =
                          busiest > 0 ? (total.bookings / busiest) * 100 : 0;
                        return (
                          <li key={total.channel.id}>
                            <div className="flex items-baseline justify-between gap-4 text-sm">
                              <span className="flex min-w-0 items-baseline gap-2">
                                <span className="truncate">
                                  {total.channel.label}
                                </span>
                                {total.channel.kind === "internal" && (
                                  <span className="text-muted-foreground shrink-0 text-xs">
                                    not the site
                                  </span>
                                )}
                              </span>
                              <span className="tabular shrink-0 font-medium">
                                {total.bookings}
                                <span className="text-muted-foreground ml-2 font-normal">
                                  {formatNad(total.revenue)}
                                </span>
                              </span>
                            </div>
                            <div
                              className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full"
                              role="img"
                              aria-label={`${total.bookings} of ${confidence.total} bookings`}
                            >
                              <div
                                className={
                                  total.channel.kind === "unknown" ||
                                  total.channel.kind === "internal"
                                    ? "bg-muted-foreground/40 h-full rounded-full"
                                    : "bg-brand h-full rounded-full"
                                }
                                style={{ width: `${Math.max(share, 2)}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
          </section>
        )}

        {/* ------------------------------------------------------- filters */}
        <section aria-labelledby="filters-heading" className="space-y-3">
          <h2 id="filters-heading" className="sr-only">
            Filters
          </h2>

          <FilterRow label="Status">
            <FilterChip
              href={href({ status: undefined })}
              active={!filters.status}
            >
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

          {/* A GET form, so a search is a URL an operator can send to someone
              else — and so the back button behaves. */}
          <form method="get" action="/admin/bookings" className="flex gap-2">
            {filters.status && (
              <input type="hidden" name="status" value={filters.status} />
            )}
            {filters.category && (
              <input type="hidden" name="category" value={filters.category} />
            )}
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="dir" value={filters.direction} />

            <label htmlFor="booking-search" className="sr-only">
              Find a booking
            </label>
            <div className="relative flex-1 sm:max-w-md">
              <SearchIcon
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <input
                id="booking-search"
                name="q"
                type="search"
                defaultValue={search ?? ""}
                placeholder="Reference, name, number, flight or place"
                className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="press h-10"
            >
              Find
            </Button>
            {search && (
              <Button asChild variant="ghost" size="sm" className="press h-10">
                <Link href={href({ q: undefined })}>Clear</Link>
              </Button>
            )}
          </form>
        </section>

        {/* --------------------------------------------------------- table */}
        {rows.length === 0 ? (
          <p className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            {search
              ? `Nothing matches “${search}”. Try a reference, part of a name, or a phone number.`
              : "No bookings match these filters yet."}
          </p>
        ) : (
          <div className="bg-card rounded-xl border">
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
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Void</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.ref}</TableCell>
                    <TableCell className="max-w-56">
                      <span className="block truncate">
                        {row.routeOrigin && row.routeDestination
                          ? `${row.routeOrigin} to ${row.routeDestination}`
                          : (journeyLabel(row.journeySlug) ??
                            `${row.pickupLabel} to ${row.dropoffLabel}`)}
                      </span>
                      {/* The pin is the whole reason it was collected: this is
                          the link dispatch sends the driver. */}
                      <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {row.pickupLat !== null && row.pickupLng !== null && (
                          <a
                            href={mapsLink({
                              lat: row.pickupLat,
                              lng: row.pickupLng,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand inline-flex items-center gap-0.5 text-xs underline underline-offset-2"
                          >
                            <MapPinIcon className="size-3" aria-hidden />
                            pickup pin
                          </a>
                        )}
                        {row.dropoffLat !== null && row.dropoffLng !== null && (
                          <a
                            href={mapsLink({
                              lat: row.dropoffLat,
                              lng: row.dropoffLng,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand inline-flex items-center gap-0.5 text-xs underline underline-offset-2"
                          >
                            <MapPinIcon className="size-3" aria-hidden />
                            drop-off pin
                          </a>
                        )}
                      </span>
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
                    <TableCell className="tabular text-brand font-semibold">
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
                    <TableCell>
                      <AssignDriver
                        bookingId={row.id}
                        drivers={assignable}
                        current={assignments.get(row.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <BookingRowActions
                        bookingId={row.id}
                        isCancelled={row.status === "cancelled"}
                        isCompleted={row.status === "completed"}
                        canComplete={
                          (row.status === "assigned" ||
                            row.status === "confirmed") &&
                          row.scheduledAt.getTime() <= Date.now()
                        }
                        isGroup={Boolean(row.groupRef)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {total > 0 && (
          <nav
            aria-label="Pages of bookings"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-muted-foreground text-sm" aria-live="polite">
              <span className="tabular">
                {from}–{to}
              </span>{" "}
              of{" "}
              <span className="tabular">{total.toLocaleString("en-US")}</span>
              {search ? " matching" : ""}
            </p>

            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  asChild={page > 0}
                  variant="outline"
                  size="sm"
                  className="press"
                  disabled={page === 0}
                >
                  {page > 0 ? (
                    <Link href={href({ page: String(page - 1) })} rel="prev">
                      Previous
                    </Link>
                  ) : (
                    <span>Previous</span>
                  )}
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page <span className="tabular">{page + 1}</span> of{" "}
                  <span className="tabular">{pages}</span>
                </span>
                <Button
                  asChild={page + 1 < pages}
                  variant="outline"
                  size="sm"
                  className="press"
                  disabled={page + 1 >= pages}
                >
                  {page + 1 < pages ? (
                    <Link href={href({ page: String(page + 1) })} rel="next">
                      Next
                    </Link>
                  ) : (
                    <span>Next</span>
                  )}
                </Button>
              </div>
            )}
          </nav>
        )}

        <p className="text-muted-foreground text-xs">
          Access is a shared password for now — Supabase Auth with per-user
          accounts and row-level security replaces it before this leaves the
          founding team.
        </p>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight">
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
