import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { reviews, type Review } from "@/db/schema";

/**
 * Only explicitly published rows ever reach a page. There is no fallback and
 * no sample data: until real reviews exist, the section simply does not render.
 */
export async function getPublishedReviews(): Promise<Review[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    return await getDb()
      .select()
      .from(reviews)
      .where(eq(reviews.isPublished, true))
      .orderBy(desc(reviews.createdAt))
      .limit(12);
  } catch {
    return [];
  }
}
