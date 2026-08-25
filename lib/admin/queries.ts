import "server-only";

import { and, asc, desc, eq, gte, sql, type SQL } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import {
  bookings,
  corporateEnquiries,
  customers,
  routes,
  vehicleClasses,
  type BookingStatus,
  type RouteCategory,
} from "@/db/schema";

/**
 * Read models for the internal view. These are the numbers that will decide
 * which routes justify owning a vehicle, so contribution is aggregated in
 * Postgres rather than summed in JavaScript over a truncated page.
 */

export const SORTABLE_COLUMNS = {
  scheduledAt: bookings.scheduledAt,
  createdAt: bookings.createdAt,
  customerPrice: bookings.customerPrice,
  contribution: bookings.contribution,
  status: bookings.status,
} as const;

export type SortKey = keyof typeof SORTABLE_COLUMNS;

export type BookingFilters = {
  status?: BookingStatus;
  category?: RouteCategory;
  sort: SortKey;
  direction: "asc" | "desc";
};

function buildWhere(filters: BookingFilters): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.status) clauses.push(eq(bookings.status, filters.status));
  if (filters.category) clauses.push(eq(routes.category, filters.category));
  return clauses.length > 0 ? and(...clauses) : undefined;
}

export async function listBookings(filters: BookingFilters) {
  if (!isDatabaseConfigured()) return [];

  const column = SORTABLE_COLUMNS[filters.sort];
  const order = filters.direction === "asc" ? asc(column) : desc(column);

  try {
    return await getDb()
      .select({
        id: bookings.id,
        ref: bookings.ref,
        scheduledAt: bookings.scheduledAt,
        createdAt: bookings.createdAt,
        passengers: bookings.passengers,
        luggageCount: bookings.luggageCount,
        flightNumber: bookings.flightNumber,
        customerPrice: bookings.customerPrice,
        driverPayout: bookings.driverPayout,
        contribution: bookings.contribution,
        currency: bookings.currency,
        acquisitionSource: bookings.acquisitionSource,
        isReturn: bookings.isReturn,
        isRepeatCustomer: bookings.isRepeatCustomer,
        status: bookings.status,
        pickupLabel: bookings.pickupLabel,
        dropoffLabel: bookings.dropoffLabel,
        routeSlug: routes.slug,
        routeOrigin: routes.originLabel,
        routeDestination: routes.destinationLabel,
        routeCategory: routes.category,
        vehicleClassName: vehicleClasses.name,
        customerName: customers.fullName,
        customerType: customers.customerType,
      })
      .from(bookings)
      .leftJoin(routes, eq(bookings.routeId, routes.id))
      .leftJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(vehicleClasses, eq(bookings.vehicleClassId, vehicleClasses.id))
      .where(buildWhere(filters))
      .orderBy(order)
      .limit(500);
  } catch (error) {
    console.error("[admin] booking list failed", error);
    return [];
  }
}

export type AdminBookingRow = Awaited<ReturnType<typeof listBookings>>[number];

/** First instant of the current month in Namibian local time (UTC+2). */
function startOfNamibianMonth(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Windhoek",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return new Date(`${parts}-01T00:00:00+02:00`);
}

export type AdminSummary = {
  bookingsThisMonth: number;
  contributionThisMonth: string;
  contributionAllTime: string;
  byRoute: Array<{
    label: string;
    slug: string | null;
    bookings: number;
    contribution: string;
    revenue: string;
  }>;
};

export async function getAdminSummary(): Promise<AdminSummary | null> {
  if (!isDatabaseConfigured()) return null;

  // Cancelled bookings never earned anything, so they stay out of the totals.
  const earning = sql`${bookings.status} <> 'cancelled'`;

  try {
    const db = getDb();

    const [thisMonth] = await db
      .select({
        count: sql<number>`count(*)::int`,
        contribution: sql<string>`coalesce(sum(${bookings.contribution}), 0)::text`,
      })
      .from(bookings)
      .where(and(gte(bookings.createdAt, startOfNamibianMonth()), earning));

    const [allTime] = await db
      .select({
        contribution: sql<string>`coalesce(sum(${bookings.contribution}), 0)::text`,
      })
      .from(bookings)
      .where(earning);

    const byRoute = await db
      .select({
        label: sql<string>`coalesce(${routes.originLabel} || ' to ' || ${routes.destinationLabel}, 'Unassigned route')`,
        slug: routes.slug,
        bookings: sql<number>`count(*)::int`,
        contribution: sql<string>`coalesce(sum(${bookings.contribution}), 0)::text`,
        revenue: sql<string>`coalesce(sum(${bookings.customerPrice}), 0)::text`,
      })
      .from(bookings)
      .leftJoin(routes, eq(bookings.routeId, routes.id))
      .where(earning)
      .groupBy(routes.slug, routes.originLabel, routes.destinationLabel)
      .orderBy(desc(sql`sum(${bookings.contribution})`));

    return {
      bookingsThisMonth: thisMonth?.count ?? 0,
      contributionThisMonth: thisMonth?.contribution ?? "0",
      contributionAllTime: allTime?.contribution ?? "0",
      byRoute,
    };
  } catch (error) {
    console.error("[admin] summary failed", error);
    return null;
  }
}

/** Corporate leads for the admin view, newest first. */
export async function listCorporateEnquiries() {
  if (!isDatabaseConfigured()) return [];

  try {
    return await getDb()
      .select()
      .from(corporateEnquiries)
      .orderBy(desc(corporateEnquiries.createdAt))
      .limit(500);
  } catch (error) {
    console.error("[admin] enquiry list failed", error);
    return [];
  }
}

export type AdminEnquiryRow = Awaited<
  ReturnType<typeof listCorporateEnquiries>
>[number];
