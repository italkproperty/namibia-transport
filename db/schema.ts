import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Full data model for the transfer marketplace. Phase 1 only reads/writes
 * routes, vehicle_classes, customers, bookings and payments — the rest are
 * defined up front so later phases are migrations, not redesigns.
 *
 * Money is `numeric(10, 2)` and surfaces in TypeScript as a string, which keeps
 * NAD amounts exact (no float drift). Parse/format via lib/money.ts.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/** ISO-4217. Namibian dollar for everything we sell today. */
const currency = () => char("currency", { length: 3 }).notNull().default("NAD");

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const bookingStatusEnum = pgEnum("booking_status", [
  "draft",
  "pending_payment",
  "confirmed",
  "assigned",
  "en_route",
  "completed",
  "cancelled",
  "no_show",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
  "cancelled",
]);

export const driverStatusEnum = pgEnum("driver_status", [
  "pending",
  "active",
  "suspended",
  "inactive",
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "offered",
  "accepted",
  "declined",
  "cancelled",
  "completed",
]);

export const pricingRuleTypeEnum = pgEnum("pricing_rule_type", [
  "base",
  "per_km",
  "multiplier",
  "flat_surcharge",
]);

export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

export const vehicleClasses = pgTable(
  "vehicle_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Seats we sell, not seats fitted. */
    capacityPassengers: smallint("capacity_passengers").notNull(),
    capacityLuggage: smallint("capacity_luggage").notNull().default(2),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("vehicle_classes_slug_key").on(t.slug)]
);

export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Powers both the fixed-price lookup and the /[slug] SEO page. */
    slug: text("slug").notNull(),
    originName: text("origin_name").notNull(),
    /** IATA code where the origin is an airport, e.g. WDH. */
    originCode: text("origin_code"),
    destinationName: text("destination_name").notNull(),
    destinationCode: text("destination_code"),
    distanceKm: numeric("distance_km", { precision: 8, scale: 2 }),
    durationMin: integer("duration_min"),
    /** Fixed fare for the default vehicle class; null falls back to per-km. */
    fixedPrice: money("fixed_price"),
    currency: currency(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    heroHeadline: text("hero_headline"),
    heroSubheadline: text("hero_subheadline"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("routes_slug_key").on(t.slug),
    index("routes_is_active_idx").on(t.isActive),
  ]
);

export const addOns = pgTable(
  "add_ons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: money("price").notNull(),
    currency: currency(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("add_ons_slug_key").on(t.slug)]
);

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    description: text("description"),
    discountType: discountTypeEnum("discount_type").notNull(),
    /** Percent (0-100) or a fixed NAD amount, per discount_type. */
    discountValue: numeric("discount_value", {
      precision: 10,
      scale: 2,
    }).notNull(),
    minFare: money("min_fare"),
    maxRedemptions: integer("max_redemptions"),
    timesRedeemed: integer("times_redeemed").notNull().default(0),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("promo_codes_code_key").on(t.code)]
);

/**
 * Modifiers layered on top of a route's fixed price (night surcharge, class
 * uplift, per-km fallback). Applied in `priority` order, lowest first.
 */
export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Null on either FK means "applies to all". */
    routeId: uuid("route_id").references(() => routes.id, {
      onDelete: "cascade",
    }),
    vehicleClassId: uuid("vehicle_class_id").references(
      () => vehicleClasses.id,
      { onDelete: "cascade" }
    ),
    ruleType: pricingRuleTypeEnum("rule_type").notNull(),
    /** Rands for base/per_km/flat_surcharge; a factor for multiplier. */
    amount: numeric("amount", { precision: 12, scale: 4 }).notNull(),
    priority: smallint("priority").notNull().default(0),
    activeFrom: timestamp("active_from", { withTimezone: true }),
    activeTo: timestamp("active_to", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("pricing_rules_route_idx").on(t.routeId),
    index("pricing_rules_vehicle_class_idx").on(t.vehicleClassId),
  ]
);

/* -------------------------------------------------------------------------- */
/* People and fleet                                                            */
/* -------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    /** E.164, the primary contact channel. */
    whatsapp: text("whatsapp"),
    email: text("email"),
    phone: text("phone"),
    locale: text("locale").notNull().default("en"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customers_whatsapp_key").on(t.whatsapp),
    uniqueIndex("customers_email_key").on(t.email),
  ]
);

export const drivers = pgTable(
  "drivers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    whatsapp: text("whatsapp"),
    email: text("email"),
    phone: text("phone"),
    /** Namibian PDP / operator licence reference. */
    licenseNumber: text("license_number"),
    licenseExpiresAt: timestamp("license_expires_at", { withTimezone: true }),
    status: driverStatusEnum("status").notNull().default("pending"),
    rating: numeric("rating", { precision: 2, scale: 1 }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("drivers_whatsapp_key").on(t.whatsapp),
    index("drivers_status_idx").on(t.status),
  ]
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    vehicleClassId: uuid("vehicle_class_id")
      .notNull()
      .references(() => vehicleClasses.id, { onDelete: "restrict" }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: smallint("year"),
    colour: text("colour"),
    registration: text("registration").notNull(),
    seats: smallint("seats"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("vehicles_registration_key").on(t.registration),
    index("vehicles_driver_idx").on(t.driverId),
  ]
);

/* -------------------------------------------------------------------------- */
/* Bookings                                                                    */
/* -------------------------------------------------------------------------- */

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-facing reference shown to the traveller, e.g. NT-7Q4K2M. */
    ref: text("ref").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    routeId: uuid("route_id").references(() => routes.id, {
      onDelete: "set null",
    }),
    vehicleClassId: uuid("vehicle_class_id").references(
      () => vehicleClasses.id,
      { onDelete: "set null" }
    ),
    pickupPoint: text("pickup_point").notNull(),
    dropoffPoint: text("dropoff_point").notNull(),
    /** Free-text landmark/notes — Namibian street addresses are unreliable. */
    pickupNotes: text("pickup_notes"),
    dropoffNotes: text("dropoff_notes"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    flightNumber: text("flight_number"),
    passengers: smallint("passengers").notNull().default(1),
    luggage: smallint("luggage"),
    status: bookingStatusEnum("status").notNull().default("draft"),
    /** Snapshotted at booking time so later price edits never rewrite history. */
    distanceKm: numeric("distance_km", { precision: 8, scale: 2 }),
    durationMin: integer("duration_min"),
    fareTotal: money("fare_total").notNull(),
    currency: currency(),
    promoCodeId: uuid("promo_code_id").references(() => promoCodes.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bookings_ref_key").on(t.ref),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_status_idx").on(t.status),
    index("bookings_scheduled_at_idx").on(t.scheduledAt),
  ]
);

/** Add-ons attached to a booking, with the price snapshotted at purchase. */
export const bookingAddOns = pgTable(
  "booking_add_ons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    addOnId: uuid("add_on_id")
      .notNull()
      .references(() => addOns.id, { onDelete: "restrict" }),
    quantity: smallint("quantity").notNull().default(1),
    unitPrice: money("unit_price").notNull(),
    currency: currency(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("booking_add_ons_booking_add_on_key").on(t.bookingId, t.addOnId),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    /** Adapter that produced this row: "stub" now, "dpo" later. */
    provider: text("provider").notNull(),
    providerReference: text("provider_reference"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amount: money("amount").notNull(),
    currency: currency(),
    /** Verbatim gateway payload, for reconciliation and dispute handling. */
    raw: jsonb("raw"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    index("payments_provider_reference_idx").on(t.providerReference),
  ]
);

export const dispatchAssignments = pgTable(
  "dispatch_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    status: assignmentStatusEnum("status").notNull().default("offered"),
    /** What the partner driver is paid for this trip. */
    payoutAmount: money("payout_amount"),
    currency: currency(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("dispatch_assignments_booking_idx").on(t.bookingId),
    index("dispatch_assignments_driver_idx").on(t.driverId),
  ]
);

export const flightStatusEvents = pgTable(
  "flight_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    flightNumber: text("flight_number").notNull(),
    scheduledArrival: timestamp("scheduled_arrival", { withTimezone: true }),
    estimatedArrival: timestamp("estimated_arrival", { withTimezone: true }),
    actualArrival: timestamp("actual_arrival", { withTimezone: true }),
    /** Provider-reported status string, e.g. "landed", "delayed". */
    status: text("status"),
    source: text("source"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("flight_status_events_booking_idx").on(t.bookingId),
    index("flight_status_events_flight_number_idx").on(t.flightNumber),
  ]
);

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type Route = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;
export type VehicleClass = typeof vehicleClasses.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
