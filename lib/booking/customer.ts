import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

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

/** Just enough of a Drizzle handle to work with `db` or a transaction. */
type Executor = {
  select: (...args: never[]) => unknown;
  insert: (...args: never[]) => unknown;
};

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
export async function resolveCustomer<D extends Executor>(
  db: D,
  input: CustomerInput,
): Promise<ResolvedCustomer<typeof customers.$inferSelect>> {
  const whatsapp = input.whatsapp?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Executor is
  // structural so this helper takes both `db` and a transaction; Drizzle's own
  // types for those two are not assignable to one another.
  const exec = db as any;

  const match = async (where: unknown) =>
    (await exec.select().from(customers).where(where).limit(1))[0] as
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

  const [created] = (await exec
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
