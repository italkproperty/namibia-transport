import "server-only";

import { and, eq, isNotNull, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { customers } from "@/db/schema";

/**
 * Finding the person who is booking, when either contact channel may be
 * missing.
 *
 * Three places create customers — the public booking form, the admin quote
 * engine and the admin itinerary quote — and all three used to run the same
 * two lines inline: look up by `whatsapp`, insert if absent. That was safe
 * only because `customers.whatsapp` was NOT NULL and uniquely indexed, and
 * both of those were wrong:
 *
 *   The NOT NULL meant a traveller without WhatsApp could not book. WhatsApp
 *   is how dispatch actually works, which is an operating truth, not a reason
 *   to turn away an inbound German couple who use iMessage.
 *
 *   The unique index meant a couple sharing a number, or a PA booking for two
 *   executives from one handset, collided — the second insert failed with an
 *   error nobody could act on.
 *
 * With both relaxed, matching needs care that two inline lines were never
 * going to get right, so it lives here and all three paths call it.
 *
 * ## The rule
 *
 * Match on a channel the traveller actually gave us, WhatsApp first because
 * it is the stronger identifier, then email. Never match an absent value: in
 * SQL `whatsapp = NULL` is not true, but `whatsapp` left out of the query
 * entirely would match the first customer in the table — which is how a
 * stranger's booking ends up attached to somebody else's row. Every query
 * below is guarded so an absent channel produces no lookup at all.
 */

/**
 * A Drizzle handle that may be the connection or a transaction.
 *
 * The itinerary quote writes every leg and its customer inside one
 * transaction, because a quote is only ever true as a whole, so this has to
 * take `tx` as readily as `db`. Derived from the real types rather than
 * described structurally: the first version declared a hand-written shape and
 * cast to `any` to satisfy it, which compiled, failed the production lint, and
 * would have hidden a genuine type error in here for as long as it survived.
 */
type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

export type CustomerInput = {
  fullName: string;
  whatsapp: string | null;
  email: string | null;
  customerType?: "tourist" | "corporate";
};

export type ResolvedCustomer<T> = {
  customer: T;
  /** True when we had already seen this traveller — drives repeat pricing. */
  isRepeat: boolean;
};

/**
 * Returns the existing customer for these details, or creates one.
 *
 * `db` is the Drizzle handle, which may be a transaction — the itinerary quote
 * writes every leg and its customer in one, because a quote is only ever true
 * as a whole.
 */
export async function resolveCustomer(
  db: Executor,
  input: CustomerInput,
): Promise<ResolvedCustomer<typeof customers.$inferSelect>> {
  const whatsapp = input.whatsapp?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  const match = async (where: SQL | undefined) =>
    (await db.select().from(customers).where(where).limit(1))[0] as
      | typeof customers.$inferSelect
      | undefined;

  // WhatsApp first: it is the stronger identifier, and it is what dispatch
  // searches on. `isNotNull` is belt and braces — `eq` against a non-null
  // value already excludes NULL rows — but it states the intent, which is
  // that an absent channel must never match anything.
  let existing = whatsapp
    ? await match(and(eq(customers.whatsapp, whatsapp), isNotNull(customers.whatsapp)))
    : undefined;

  if (!existing && email) {
    existing = await match(and(eq(customers.email, email), isNotNull(customers.email)));
  }

  if (existing) {
    return { customer: existing, isRepeat: true };
  }

  const [created] = (await db
    .insert(customers)
    .values({
      fullName: input.fullName,
      whatsapp,
      email,
      customerType: input.customerType ?? "tourist",
    })
    .returning()) as (typeof customers.$inferSelect)[];

  return { customer: created, isRepeat: false };
}

/**
 * The channel to reach this traveller on, for a message we are about to send.
 *
 * WhatsApp when we have it, because that is where they will see it; otherwise
 * email. Null when we somehow have neither, which the booking schema prevents
 * but an older row may still be.
 */
export function preferredChannel(customer: {
  whatsapp?: string | null;
  email?: string | null;
}): "whatsapp" | "email" | null {
  if (customer.whatsapp?.trim()) return "whatsapp";
  if (customer.email?.trim()) return "email";
  return null;
}
