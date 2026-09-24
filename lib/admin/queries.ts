import "server-only";

import { and, asc, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { foldChannels, type ChannelTotal } from "@/lib/admin/channels";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";

/**
 * Which reads failed while rendering this request.
 *
 * Every read model here catches its own error and returns something empty, so
 * a page always renders. That is the right call — one dead panel must not take
 * the payment queue with it — but on its own it is exactly the silent failure
 * this project keeps writing rules against: an operator sees an empty table
 * and reads it as a quiet week rather than a database that never answered.
 *
 * A module-level Set is safe here only because each serverless request renders
 * one page and these are all awaited within it; it is cleared at the top of
 * the page render. It is a breadcrumb for a banner, never a source of truth.
 */
const readFailures = new Set<string>();

export function beginAdminRead(): void {
  readFailures.clear();
}

export function adminReadFailures(): string[] {
  return [...readFailures];
}
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

/** Rows an operator can hold in their head at once, and a query can serve. */
export const BOOKINGS_PER_PAGE = 50;

export type BookingFilters = {
  status?: BookingStatus;
  category?: RouteCategory;
  /** A reference, a traveller's name, a phone number, or a place. */
  query?: string;
  /** Zero-based. */
  page?: number;
  sort: SortKey;
  direction: "asc" | "desc";
};

function buildWhere(filters: BookingFilters): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.status) clauses.push(eq(bookings.status, filters.status));
  if (filters.category) clauses.push(eq(routes.category, filters.category));

  const term = filters.query?.trim();
  if (term) {
    // What an operator actually has in front of them when they need a booking:
    // a reference off a bank statement, a name from a WhatsApp message, the
    // number that called, or the place the traveller said.
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const found = or(
      ilike(bookings.ref, like),
      ilike(bookings.groupRef, like),
      ilike(customers.fullName, like),
      ilike(customers.whatsapp, like),
      ilike(customers.email, like),
      ilike(bookings.pickupLabel, like),
      ilike(bookings.dropoffLabel, like),
      ilike(bookings.flightNumber, like),
    );
    if (found) clauses.push(found);
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export async function listBookings(filters: BookingFilters) {
  if (!isDatabaseConfigured()) return [];

  const column = SORTABLE_COLUMNS[filters.sort];
  const order = filters.direction === "asc" ? asc(column) : desc(column);

  try {
    return await withDeadline("booking list", READ_DEADLINE_MS, () =>
      getDb()
        .select({
          id: bookings.id,
          ref: bookings.ref,
          groupRef: bookings.groupRef,
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
          pickupLat: bookings.pickupLat,
          pickupLng: bookings.pickupLng,
          dropoffLat: bookings.dropoffLat,
          dropoffLng: bookings.dropoffLng,
          // Null for a journey priced from the road network; `journeySlug`
          // carries the leg in that case.
          journeySlug: bookings.journeySlug,
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
        .leftJoin(
          vehicleClasses,
          eq(bookings.vehicleClassId, vehicleClasses.id),
        )
        .where(buildWhere(filters))
        // A second key, so a page boundary never lands inside a group of rows
        // that sort equal — without it, paging by status could show the same
        // booking on two pages and skip another entirely.
        .orderBy(order, desc(bookings.id))
        .limit(BOOKINGS_PER_PAGE)
        .offset(Math.max(0, filters.page ?? 0) * BOOKINGS_PER_PAGE),
    );
  } catch (error) {
    // An empty array here renders as "no bookings", which is the same picture
    // as a quiet week. The operator needs to know the difference, so the page
    // asks `adminReadFailed()` and says so.
    readFailures.add("booking list");
    console.error("[admin] booking list failed", error);
    return [];
  }
}

/**
 * How many bookings match, so the page can say where it is.
 *
 * The list used to stop at 500 rows with nothing to say it had. Assigning a
 * driver only exists on that page, so at fifty bookings a day the tenth day
 * put a real trip somewhere no operator could reach it — and the page looked
 * complete the whole time.
 */
export async function countBookings(filters: BookingFilters): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  try {
    const [row] = await withDeadline("booking count", READ_DEADLINE_MS, () =>
      getDb()
        .select({ total: sql<number>`count(*)::int` })
        .from(bookings)
        .leftJoin(routes, eq(bookings.routeId, routes.id))
        .leftJoin(customers, eq(bookings.customerId, customers.id))
        .where(buildWhere(filters)),
    );
    return row?.total ?? 0;
  } catch (error) {
    readFailures.add("booking count");
    console.error("[admin] booking count failed", error);
    return 0;
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
  /**
   * Where the business comes from, folded from the raw acquisition_source
   * strings. Aggregated by source in Postgres and collapsed into channels in
   * `foldChannels`, because the mapping is a judgement — four Google
   * hostnames are one channel — and a judgement belongs somewhere testable
   * rather than in a SQL CASE.
   */
  byChannel: ChannelTotal[];
};

export async function getAdminSummary(): Promise<AdminSummary | null> {
  if (!isDatabaseConfigured()) return null;

  // Cancelled bookings never earned anything, so they stay out of the totals.
  const earning = sql`${bookings.status} <> 'cancelled'`;

  try {
    const db = getDb();

    // One wave, not four. These were sequential awaits, so the page paid four
    // round trips to Supabase before it could draw a single number — and a
    // Vercel function in one region talking to a database in another pays
    // that latency four times over. Nothing here depends on anything else
    // here, so there was never a reason to queue them.
    const [thisMonthRows, allTimeRows, byRoute, bySource] = await withDeadline(
      "admin summary",
      READ_DEADLINE_MS,
      () =>
        Promise.all([
          db
            .select({
              count: sql<number>`count(*)::int`,
              contribution: sql<string>`coalesce(sum(${bookings.contribution}), 0)::text`,
            })
            .from(bookings)
            .where(
              and(gte(bookings.createdAt, startOfNamibianMonth()), earning),
            ),
          db
            .select({
              contribution: sql<string>`coalesce(sum(${bookings.contribution}), 0)::text`,
            })
            .from(bookings)
            .where(earning),
          db
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
            .orderBy(desc(sql`sum(${bookings.contribution})`)),
          db

            .select({
              source: bookings.acquisitionSource,
              bookings: sql<number>`count(*)::int`,
              revenue: sql<string>`coalesce(sum(${bookings.customerPrice}), 0)::text`,
            })
            .from(bookings)
            .where(earning)
            .groupBy(bookings.acquisitionSource),
        ]),
    );

    const thisMonth = thisMonthRows[0];
    const allTime = allTimeRows[0];

    return {
      byChannel: foldChannels(bySource),
      bookingsThisMonth: thisMonth?.count ?? 0,
      contributionThisMonth: thisMonth?.contribution ?? "0",
      contributionAllTime: allTime?.contribution ?? "0",
      byRoute,
    };
  } catch (error) {
    readFailures.add("summary");
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
