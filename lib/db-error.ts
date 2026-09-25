/**
 * What the database actually objected to.
 *
 * Drizzle wraps a driver error in a `DrizzleQueryError` whose own message is
 * `Failed query: insert into "drivers" (...)` — the SQL, not the reason. The
 * reason is on the cause: `duplicate key value violates unique constraint
 * "drivers_whatsapp_key"`, with `constraint_name` and the SQLSTATE beside it.
 *
 * Every constraint check in this codebase read the wrapper. All of them were
 * dead:
 *
 *   Four reference-collision retries — the public booking path, both admin
 *   quote engines and the corporate quotation — tested `error.message` for
 *   `bookings_ref_key`, never matched, and rethrew instead of retrying. A
 *   duplicate reference has always been a failed booking rather than a second
 *   attempt, and the odds of one grow with every booking taken.
 *
 *   The driver form's "a driver with that WhatsApp number already exists"
 *   never fired either, so an operator adding a driver whose number was
 *   already on file got "Could not save the driver." and no way to work out
 *   why. That is how this was found.
 *
 * So the cause chain is walked once, here, and everything asks this.
 */

/** Postgres SQLSTATEs worth naming. */
export const PG = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  notNullViolation: "23502",
  checkViolation: "23514",
  undefinedColumn: "42703",
  undefinedTable: "42P01",
} as const;

type PgLike = {
  code?: string;
  constraint_name?: string;
  detail?: string;
  message?: string;
  cause?: unknown;
};

/**
 * Walks `cause` to the deepest driver error. Bounded rather than recursive on
 * trust: a cycle in a cause chain would otherwise hang a request, and a
 * request that hangs is the 504 this project already spent a day on.
 */
function unwrap(error: unknown): PgLike[] {
  const chain: PgLike[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 8 && current; depth += 1) {
    if (typeof current !== "object") break;
    const node = current as PgLike;
    chain.push(node);
    if (node.cause === current) break;
    current = node.cause;
  }

  return chain;
}

/** The constraint the database refused on, if it was a constraint at all. */
export function violatedConstraint(error: unknown): string | null {
  for (const node of unwrap(error)) {
    if (node.constraint_name) return node.constraint_name;
  }

  // Older drivers, and anything that stringified on the way here, still put
  // the name in quotes inside the message.
  for (const node of unwrap(error)) {
    const match = /constraint "([^"]+)"/.exec(node.message ?? "");
    if (match) return match[1];
  }

  return null;
}

/** The SQLSTATE, if there is one. */
export function errorCode(error: unknown): string | null {
  for (const node of unwrap(error)) {
    if (typeof node.code === "string" && /^[0-9A-Z]{5}$/.test(node.code)) {
      return node.code;
    }
  }
  return null;
}

/** True when the database refused this row because it already has one. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (errorCode(error) !== PG.uniqueViolation) return false;
  return constraint ? violatedConstraint(error) === constraint : true;
}

/**
 * True when the schema is behind the code — a column or table the query needs
 * does not exist in this database.
 *
 * Worth telling apart from every other failure, because the remedy is not
 * "try again" but "run the migration", and the two look identical in a catch
 * block that only has a message to go on.
 */
export function isMissingSchema(error: unknown): boolean {
  const code = errorCode(error);
  return code === PG.undefinedColumn || code === PG.undefinedTable;
}

/**
 * A line an operator can act on, for a failure with no better handler.
 *
 * Deliberately names the constraint rather than hiding it. "Could not save
 * the driver" tells somebody staring at a form precisely nothing; the
 * constraint name at least tells them, or us, where to look.
 */
export function describeDbError(error: unknown, fallback: string): string {
  if (isMissingSchema(error)) {
    return "This deployment's database is missing a column or table this needs — run db/manual/RUN-ME.sql in Supabase.";
  }

  const constraint = violatedConstraint(error);
  if (constraint && errorCode(error) === PG.uniqueViolation) {
    return `${fallback} Something with the same value already exists (${constraint}).`;
  }
  if (constraint) {
    return `${fallback} The database refused it (${constraint}).`;
  }

  return fallback;
}
