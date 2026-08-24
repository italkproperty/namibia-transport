import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { corporateQuoteItems, corporateQuotes } from "@/db/schema";

/**
 * The quote number is the capability: random, personal, and the same key the
 * customer was handed. There is no enumeration endpoint.
 */
export async function getQuoteByNumber(quoteNumber: string) {
  if (!isDatabaseConfigured()) return null;

  try {
    const db = getDb();
    const [quote] = await db
      .select()
      .from(corporateQuotes)
      .where(eq(corporateQuotes.quoteNumber, quoteNumber))
      .limit(1);

    if (!quote) return null;

    const items = await db
      .select()
      .from(corporateQuoteItems)
      .where(eq(corporateQuoteItems.quoteId, quote.id))
      .orderBy(asc(corporateQuoteItems.sortOrder));

    return { quote, items };
  } catch (error) {
    console.error("[corporate] quote lookup failed", error);
    return null;
  }
}

export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuoteByNumber>>>;

/** Pipeline view for the admin — newest first. */
export async function listCorporateQuotes() {
  if (!isDatabaseConfigured()) return [];

  try {
    return await getDb()
      .select()
      .from(corporateQuotes)
      .orderBy(desc(corporateQuotes.createdAt))
      .limit(500);
  } catch (error) {
    console.error("[corporate] quote list failed", error);
    return [];
  }
}
