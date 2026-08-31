import {
  boolean,
  char,
  doublePrecision,
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
 * Namibia Transport is a demand-aggregation platform, not a single product.
 * The schema is shaped around that: routes carry a `category` so airport
 * transfers, intercity runs and corporate accounts share one pipeline, and
 * every booking records the full economics (what the customer paid, what the
 * driver is paid, what we keep) so route profitability is queryable from day
 * one. Tables the current UI does not touch yet are defined anyway — growth
 * should be a migration, never a rewrite.
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

/** What kind of demand a route serves. Drives copy, SEO and reporting. */
export const routeCategoryEnum = pgEnum("route_category", [
  "airport",
  "intercity",
  "city",
  "corporate",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending_payment",
  "confirmed",
  "assigned",
  "completed",
  "cancelled",
]);

export const customerTypeEnum = pgEnum("customer_type", [
  "tourist",
  "corporate",
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

/** What a corporate lead actually needs, so enquiries can be triaged. */
export const enquiryNeedEnum = pgEnum("enquiry_need", [
  "airport_transfers",
  "conference_event",
  "employee_site_transport",
  "other",
]);

export const enquiryStatusEnum = pgEnum("enquiry_status", [
  "new",
  "contacted",
  "quoted",
  "won",
  "lost",
]);

/**
 * How a route's fixed_price is charged. Airport transfers sell per seat;
 * long-distance private transfers sell the whole vehicle.
 */
export const pricingUnitEnum = pgEnum("pricing_unit", [
  "per_vehicle",
  "per_person",
]);

/** Corporate quote pipeline — the raw material for the future CRM. */
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "quoted",
  "sent",
  "negotiating",
  "accepted",
  "rejected",
  "expired",
  "fulfilled",
]);

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A sellable origin→destination pair. Powers fixed pricing, the booking form
 * and the programmatic SEO page at /transfers/[slug]. Rows with is_active
 * false are schema-ready but hidden from customers.
 */
export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    originLabel: text("origin_label").notNull(),
    destinationLabel: text("destination_label").notNull(),
    category: routeCategoryEnum("category").notNull(),
    /** Fare for the baseline vehicle class; multipliers scale from here. */
    fixedPrice: money("fixed_price").notNull(),
    /** What one unit of fixed_price buys: the whole vehicle, or one seat. */
    pricingUnit: pricingUnitEnum("pricing_unit").notNull().default("per_vehicle"),
    currency: currency(),
    /** What the partner driver earns; customer_price minus this is our margin. */
    defaultDriverPayout: money("default_driver_payout").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    /** Nullable until Mapbox provides real figures; used for "≈4 hours" copy. */
    distanceKm: numeric("distance_km", { precision: 8, scale: 2 }),
    durationMin: integer("duration_min"),
    sortOrder: smallint("sort_order").notNull().default(0),
    /* Geography. Feeds distance lookups, static route maps and the map pin. */
    originLat: doublePrecision("origin_lat"),
    originLng: doublePrecision("origin_lng"),
    destinationLat: doublePrecision("destination_lat"),
    destinationLng: doublePrecision("destination_lng"),
    /**
     * Encoded polyline of the driven road, cached from Mapbox Directions so
     * route maps draw the real path without an API call per page view.
     */
    routeGeometry: text("route_geometry"),

    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** Long-form route copy rendered on the landing page. */
    seoBody: text("seo_body"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("routes_slug_key").on(t.slug),
    index("routes_is_active_idx").on(t.isActive),
    index("routes_category_idx").on(t.category),
  ]
);

export const vehicleClasses = pgTable(
  "vehicle_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Seats we sell, not seats fitted. */
    capacity: smallint("capacity").notNull(),
    luggageCapacity: smallint("luggage_capacity").notNull().default(2),
    /** Applied to a route's fixed_price. 1.0 is the baseline class. */
    priceMultiplier: numeric("price_multiplier", {
      precision: 4,
      scale: 2,
    })
      .notNull()
      .default("1.00"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("vehicle_classes_slug_key").on(t.slug)]
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
 * Modifiers layered on top of a route's fixed price (night surcharge, seasonal
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
    email: text("email"),
    /** E.164, the primary contact channel. */
    whatsapp: text("whatsapp").notNull(),
    customerType: customerTypeEnum("customer_type").notNull().default("tourist"),
    locale: text("locale").notNull().default("en"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customers_whatsapp_key").on(t.whatsapp),
    index("customers_email_idx").on(t.email),
    index("customers_type_idx").on(t.customerType),
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
    /** Short human code shown to the traveller, e.g. NT-7Q4K2M. */
    ref: text("ref").notNull(),
    routeId: uuid("route_id").references(() => routes.id, {
      onDelete: "set null",
    }),
    /**
     * The place pair, for a journey priced from the road network rather than
     * from a curated route: "sossusvlei-to-swakopmund". Null whenever
     * `route_id` is set, and the two are never both null on a booking that
     * came through the form.
     *
     * Without it a modelled booking would be invisible to route reporting —
     * the labels record where the traveller was collected, not which leg of
     * the country they bought — and the whole point of recording economics per
     * booking is that leg profitability is queryable.
     */
    journeySlug: text("journey_slug"),
    vehicleClassId: uuid("vehicle_class_id").references(
      () => vehicleClasses.id,
      { onDelete: "set null" }
    ),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    pickupLabel: text("pickup_label").notNull(),
    dropoffLabel: text("dropoff_label").notNull(),
    /**
     * Optional dropped pin. Namibian street addresses are sparse, so the
     * curated pick-list stays the primary input and a pin is the precision
     * upgrade for a guesthouse or home the list does not name.
     */
    pickupLat: doublePrecision("pickup_lat"),
    pickupLng: doublePrecision("pickup_lng"),
    dropoffLat: doublePrecision("dropoff_lat"),
    dropoffLng: doublePrecision("dropoff_lng"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    passengers: smallint("passengers").notNull().default(1),
    luggageCount: smallint("luggage_count").notNull().default(0),
    flightNumber: text("flight_number"),

    /* Economics — all snapshotted, so later price edits never rewrite history. */
    /** What the customer pays. */
    customerPrice: money("customer_price").notNull(),
    /** What the partner driver is paid. */
    driverPayout: money("driver_payout").notNull(),
    /** customer_price - driver_payout, computed server-side and persisted. */
    contribution: money("contribution").notNull(),
    currency: currency(),

    /** Nullable until Mapbox lands. */
    distanceKm: numeric("distance_km", { precision: 8, scale: 2 }),
    durationMin: integer("duration_min"),

    /* Attribution and segmentation. */
    /** UTM campaign or referrer host — which channel produced this booking. */
    acquisitionSource: text("acquisition_source"),
    isReturn: boolean("is_return").notNull().default(false),
    isRepeatCustomer: boolean("is_repeat_customer").notNull().default(false),

    status: bookingStatusEnum("status").notNull().default("pending_payment"),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    promoCodeId: uuid("promo_code_id").references(() => promoCodes.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bookings_ref_key").on(t.ref),
    index("bookings_route_idx").on(t.routeId),
    index("bookings_journey_idx").on(t.journeySlug),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_status_idx").on(t.status),
    index("bookings_scheduled_at_idx").on(t.scheduledAt),
    index("bookings_created_at_idx").on(t.createdAt),
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
    uniqueIndex("booking_add_ons_booking_add_on_key").on(
      t.bookingId,
      t.addOnId
    ),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    /** Adapter that produced this row: "paytoday" live, "stub" without keys. */
    provider: text("provider").notNull(),
    /** PayToday's payment_intent_token — the only handle on the transaction. */
    providerReference: text("provider_reference"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amount: money("amount").notNull(),
    currency: currency(),
    /** Hosted gateway page, so an unpaid booking can resume the same intent. */
    checkoutUrl: text("checkout_url"),
    /** PayToday intents lapse after 30 minutes; past this, issue a new one. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
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

/**
 * Corporate and group leads. Deliberately separate from bookings: these are
 * quoted by hand and may become many bookings, or none.
 */
export const corporateEnquiries = pgTable(
  "corporate_enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    whatsapp: text("whatsapp"),
    email: text("email"),
    needType: enquiryNeedEnum("need_type").notNull(),
    approxPassengers: integer("approx_passengers"),
    /** Free text — corporate travel dates are rarely a clean range. */
    datesNote: text("dates_note"),
    notes: text("notes"),
    status: enquiryStatusEnum("status").notNull().default("new"),
    acquisitionSource: text("acquisition_source"),
    ...timestamps,
  },
  (t) => [
    index("corporate_enquiries_status_idx").on(t.status),
    index("corporate_enquiries_created_at_idx").on(t.createdAt),
  ]
);

/**
 * A structured corporate quotation, priced by the server from the routes
 * table. One quote may carry many line items and eventually become many
 * bookings — or none. The status pipeline is what turns quoting into demand
 * data: industries asking, routes requested, values, and conversion.
 */
export const corporateQuotes = pgTable(
  "corporate_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-facing quotation number, e.g. NT-Q-2026-8H3K2M. */
    quoteNumber: text("quote_number").notNull(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactPosition: text("contact_position"),
    email: text("email"),
    whatsapp: text("whatsapp"),
    industry: text("industry"),
    companyRegistration: text("company_registration"),
    billingAddress: text("billing_address"),
    /** Selected service slugs, e.g. ["airport_transfers","site_transport"]. */
    services: jsonb("services").notNull(),
    passengers: integer("passengers"),
    vehicles: smallint("vehicles").notNull().default(1),
    /** Free text — corporate travel dates are rarely a clean range. */
    datesNote: text("dates_note"),
    frequency: text("frequency"),
    tripsCount: integer("trips_count").notNull().default(1),
    includeReturn: boolean("include_return").notNull().default(false),
    notes: text("notes"),
    subtotal: money("subtotal").notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0"),
    vatAmount: money("vat_amount").notNull().default("0.00"),
    total: money("total").notNull(),
    currency: currency(),
    /** True while any requested service could not be auto-priced. */
    isEstimate: boolean("is_estimate").notNull().default(true),
    status: quoteStatusEnum("status").notNull().default("quoted"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    acquisitionSource: text("acquisition_source"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("corporate_quotes_number_key").on(t.quoteNumber),
    index("corporate_quotes_status_idx").on(t.status),
    index("corporate_quotes_created_at_idx").on(t.createdAt),
  ]
);

export const corporateQuoteItems = pgTable(
  "corporate_quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => corporateQuotes.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    /** Null for items that need manual pricing before the quote is formal. */
    unitPrice: money("unit_price"),
    lineTotal: money("line_total"),
    currency: currency(),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("corporate_quote_items_quote_idx").on(t.quoteId)]
);

/**
 * Real customer reviews only. Nothing renders publicly until a row is
 * explicitly published — the site must never show fabricated social proof.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    authorContext: text("author_context"),
    rating: smallint("rating").notNull(),
    body: text("body").notNull(),
    /** Where it came from: "google", "whatsapp", "direct". */
    source: text("source").notNull().default("direct"),
    isPublished: boolean("is_published").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("reviews_published_idx").on(t.isPublished)]
);

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type Route = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;
export type VehicleClass = typeof vehicleClasses.$inferSelect;
export type NewVehicleClass = typeof vehicleClasses.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type CorporateEnquiry = typeof corporateEnquiries.$inferSelect;
export type CorporateQuote = typeof corporateQuotes.$inferSelect;
export type NewCorporateQuote = typeof corporateQuotes.$inferInsert;
export type CorporateQuoteItem = typeof corporateQuoteItems.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type NewCorporateEnquiry = typeof corporateEnquiries.$inferInsert;

export type RouteCategory = (typeof routeCategoryEnum.enumValues)[number];
export type EnquiryNeed = (typeof enquiryNeedEnum.enumValues)[number];
export type EnquiryStatus = (typeof enquiryStatusEnum.enumValues)[number];
export type PricingUnit = (typeof pricingUnitEnum.enumValues)[number];
export type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];

export type DriverStatus = (typeof driverStatusEnum.enumValues)[number];

export type AssignmentStatus =
  (typeof assignmentStatusEnum.enumValues)[number];
export type CustomerType = (typeof customerTypeEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
